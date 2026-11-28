import { getMonsterFormulaStats } from "../../engine/monsterStats.js";
import { getArenaBounds, isArenaTileWalkable } from "../../engine/arena.js";
import { arenaConfigFromCache } from "./cacheArena.js";
import { createSeededRandom } from "../../engine/random.js";
import { yamaBasePosition, isYamaSealedRow } from "./sceneConstants.js";
import { canNpcActAtTick } from "../../engine/npcState.js";
import { NpcDefinitionRegistry } from "../shared/npcDefinitions.js";
import {
  defaultYamaWaveDeltas,
  defaultYamaFirstCycleWaveDeltas,
  getYamaWaveCyclePosition,
  isYamaWaveActiveInCycle,
  isInsideYamaWaveDiamond,
  getYamaWaveRandomOffset,
  getYamaWaveTiles,
} from "./shadowWaves.js";
import { activeOutcome } from "../shared/npcHelpers.js";
import { getBossPursuitMoves } from "../shared/npcRoutes.js";
import { yamaNpcTypeId, yamaSize, mixSeed, voidFlareSpawnTiles, yamaDefeatOverheadTexts, yamaPlayerStartMin, yamaPlayerStartMax } from "./constants.js";
import { getYamaBeatInfo } from "./beatClock.js";
import { defaultYamaAttackPattern, defaultYamaBossHp, defaultRangedMagicPrayerReduction, defaultMeleePrayerReduction, defaultWaveDamage, defaultFireballDamage, contractLevelOverrides, noContract } from "./contracts.js";
import { buildYamaControls } from "./controls.js";
import { voidFlareNpcDefinition, VoidFlareCoordinator } from "./voidFlares.js";
import { createYamaAttackPolicyState, yamaNpcDefinition, getYamaState } from "./boss.js";
import { FireballRuntime, isValidSeed } from "./fireballs.js";
// Yama, phase 3: the encounter class. The encounter registry (in
// client/assets/rendering.js) constructs it, as `new YamaEncounter()` or with
// one of the five contracts of contracts.js, and without a seed; the engine
// then calls `reset(seeds)` for a run, a restart or a replay, and the hooks.
//
// The order of the hooks within one tick (docs/ARCHITECTURE.md, "One tick"),
// which every timeline of the fight depends on:
//   1. executeCommand     the debug commands the interface queued
//   2. resolveHazards     shadow waves, void flare impacts and explosions,
//                         fireballs: the damage the player takes this tick
//   3. moveNpc, then processNpcTick
//                         Yama's turn: he launches what he queued in the last
//                         post-tick
//   4. completeNpcBand    the void flares owed since the last post-tick spawn
//      (the hits on the player land; the player moves and attacks)
//   5. processPostTick    on a beat: Yama queues his next attack, a fireball
//                         burst starts, void flares become owed
// So the attack a post-tick decides on, and the void flares it owes for a
// beat or a melee, show one tick later. (The continuous flares of Divine
// Severance spawn in the post-tick itself.) The first fireball of a burst
// starts 3 ticks after its beat (getFireballBurstStartTicks).
function deriveFireballSeed(seed) {
  const random = createSeededRandom(seed ^ 3287234336);
  return Math.floor(random() * 4294967296) >>> 0;
}
function createYamaEncounterState(config, seeding) {
  const seeds = seeding.source === "reset" ? seeding.seeds : undefined;
  const encounterSeed =
    seeding.source === "constructor"
      ? (seeding.encounterSeed ?? Math.floor(Math.random() * 4294967295))
      : isValidSeed(seeds?.encounterSeed)
        ? seeds.encounterSeed
        : Math.floor(Math.random() * 4294967295);
  const openingStyle =
    seeding.source !== "reset" ||
    (seeds?.firstRangeMageType !== "magic" && seeds?.firstRangeMageType !== "range")
      ? createSeededRandom(encounterSeed ^ 2779096485)() < 0.5
        ? "magic"
        : "range"
      : seeds.firstRangeMageType;
  const fireballSeed =
    seeding.source === "reset" && isValidSeed(seeds?.fireballSeed)
      ? seeds.fireballSeed
      : deriveFireballSeed(encounterSeed);
  const voidFlareSeed =
    seeding.source === "reset" && isValidSeed(seeds?.voidFlareSeed)
      ? seeds.voidFlareSeed
      : mixSeed(fireballSeed, encounterSeed ^ 2654435769);
  return {
    run: {
      encounterSeed: encounterSeed,
      waveConfig: {
        ...config.waves,
        seed: mixSeed(encounterSeed, 1463899717),
      },
      pursuitRng: createSeededRandom(mixSeed(encounterSeed, 1347768915)),
      accuracyRng: createSeededRandom(mixSeed(encounterSeed, 1094927189)),
      // Not a seed: "magic" or "range", the style of Yama's first magic or
      // ranged attack. The key is part of the recorded state and keeps its
      // name. The same value is `firstRangeMageType` in the seeds and in the
      // snapshot, and `openingStyle` in Yama's own state.
      openingStyleSeed: openingStyle,
    },
    fireballs: {
      seed: fireballSeed,
      // Fireball id -> the centre of its impact: the player's tile in the
      // post-tick before the fireball's start tick. A scheduled fireball
      // without an entry never started.
      startPositions: new Map(),
      pendingSpawnEvents: [],
      impactDealt: new Set(),
      impactEmitted: new Set(),
      explosionDealt: new Set(),
      registeredIds: new Set(),
      burstShapes: new Map(),
      perfectDodgeTriggered: new Set(),
      shadowWaveImmunityTick: null,
      manual: new Map(),
      manualNextId: 0,
      manualBurstCount: 0,
    },
    voidFlares: {
      seed: voidFlareSeed,
      spawnIndex: voidFlareSeed % voidFlareSpawnTiles.length,
      nextId: 0,
      pendingSpawnCount: 0,
      pendingImpacts: [],
    },
    lifecycle: {
      defeated: false,
      outcome: activeOutcome,
    },
  };
}
var yamaActorId = "yama";
var yamaPursuitMovement = {
  size: yamaSize,
  maxSpeed: 1,
  underFootprint: "random-cardinal",
  unreachable: "nearest-reachable",
  canOccupy: (southWestTile, size) => {
    for (let dx = 0; dx < size; dx++) {
      for (let dy = 0; dy < size; dy++) {
        if (!isArenaTileWalkable(southWestTile[0] + dx, southWestTile[1] + dy)) {
          return false;
        }
      }
    }
    return true;
  },
};
var fallbackYamaArenaBounds = {
  minX: 17,
  maxX: 44,
  minY: 0,
  maxY: 45,
};
function getNearestPosition(fromTile, tiles) {
  let nearestTile = tiles[0];
  let nearestDistanceSquared = Number.POSITIVE_INFINITY;
  for (const tile of tiles) {
    const dx = tile[0] - fromTile[0];
    const dy = tile[1] - fromTile[1];
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared < nearestDistanceSquared) {
      nearestDistanceSquared = distanceSquared;
      nearestTile = tile;
    }
  }
  return nearestTile;
}
function resolveEncounterConfig(encounterOverrides) {
  const attackPattern = encounterOverrides?.attackPattern;
  const fireballBeats = attackPattern?.fireballBeats ?? defaultYamaAttackPattern.fireballBeats;
  const snapFireballBeatSet = new Set(attackPattern?.snapFireballBeats ?? fireballBeats);
  const snapFireballBeats = fireballBeats.filter((beatIndex) => snapFireballBeatSet.has(beatIndex));
  return {
    attackPattern: {
      beatStartTick: attackPattern?.beatStartTick ?? defaultYamaAttackPattern.beatStartTick,
      beatIntervalTicks: attackPattern?.beatIntervalTicks ?? defaultYamaAttackPattern.beatIntervalTicks,
      beatsPerCycle: attackPattern?.beatsPerCycle ?? defaultYamaAttackPattern.beatsPerCycle,
      fireballBeats: fireballBeats,
      snapFireballBeats: snapFireballBeats,
      voidFlareBeats: attackPattern?.voidFlareBeats ?? defaultYamaAttackPattern.voidFlareBeats,
    },
    autoAttacks: {
      meleeDamage: encounterOverrides?.autoAttacks?.meleeDamage ?? [0, 46],
      rangedMagicDamage: encounterOverrides?.autoAttacks?.rangedMagicDamage ?? [0, 46],
      meleePrayerReduction: encounterOverrides?.autoAttacks?.meleePrayerReduction ?? defaultMeleePrayerReduction,
      rangedMagicPrayerReduction:
        encounterOverrides?.autoAttacks?.rangedMagicPrayerReduction ?? defaultRangedMagicPrayerReduction,
      wretchedStrength: encounterOverrides?.autoAttacks?.wretchedStrength ?? false,
    },
    waves: {
      damage: encounterOverrides?.waves?.damage ?? defaultWaveDamage,
      periodTicks: encounterOverrides?.waves?.periodTicks ?? 70,
      deltas: encounterOverrides?.waves?.deltas ?? defaultYamaWaveDeltas,
      speedTilesPerTick: encounterOverrides?.waves?.speedTilesPerTick ?? 2,
      randomOffsets: encounterOverrides?.waves?.randomOffsets ?? false,
      seed: 0, // replaced in createYamaEncounterState
      startDelay: encounterOverrides?.waves?.startDelay ?? 7,
      firstCycleDeltas: encounterOverrides?.waves?.firstCycleDeltas ?? defaultYamaFirstCycleWaveDeltas,
    },
    fireballs: {
      damage: encounterOverrides?.fireballs?.damage ?? defaultFireballDamage,
    },
    voidFlares: {
      hp: encounterOverrides?.voidFlares?.hp ?? 71,
      spawnCount: encounterOverrides?.voidFlares?.spawnCount ?? 2,
      maxActive: encounterOverrides?.voidFlares?.maxActive ?? 4,
      chargeTicks: encounterOverrides?.voidFlares?.chargeTicks ?? 25,
      explosionDamage: encounterOverrides?.voidFlares?.explosionDamage ?? [10, 27],
      continuous: encounterOverrides?.voidFlares?.continuous ?? false,
      continuousIntervalTicks: Math.max(
        1,
        encounterOverrides?.voidFlares?.continuousIntervalTicks ?? 20,
      ),
      continuousHp: encounterOverrides?.voidFlares?.continuousHp ?? encounterOverrides?.voidFlares?.hp ?? 71,
      guaranteedPlayerMaximum:
        encounterOverrides?.voidFlares?.guaranteedPlayerMaximum ?? true,
    },
    boss: {
      hp: encounterOverrides?.boss?.hp ?? defaultYamaBossHp,
      maxHp: encounterOverrides?.boss?.maxHp ?? 2500,
    },
    pursuit: encounterOverrides?.pursuit ?? false,
  };
}
function createYamaActor(bossSetup) {
  const baseFormulaStats = getMonsterFormulaStats(yamaNpcTypeId, "Phase 3");
  if (baseFormulaStats === undefined) {
    throw new TypeError("Missing Phase 3 Yama formula stats");
  }
  const formulaStats = bossSetup.levelOverrides
    ? {
        ...baseFormulaStats,
        levels: {
          ...baseFormulaStats.levels,
          ...bossSetup.levelOverrides,
        },
      }
    : baseFormulaStats;
  const baseActor = {
    id: "yama",
    kind: "npc",
    role: "boss",
    alive: true,
    position: bossSetup.position,
    previousPosition: bossSetup.position,
    facing: 0,
    size: yamaSize,
    vitals: {
      hp: bossSetup.hp,
      maxHp: bossSetup.maxHp,
    },
    npcTypeId: yamaNpcTypeId,
    archetypeId: "yama",
    history: new Map(),
    // The general fields of an actor record. When Yama attacks is decided by
    // the beat clock (`attackTimer` and `postTick` of yamaNpcDefinition), and
    // he does not move by the default pursuit (`move: false`).
    combat: {
      attackSpeed: 1,
      attackRange: 10,
      attackStyle: "magic",
      nextActionTick: 0,
      targetId: "player",
      lastAttackTick: null,
      animations: {
        idle: null,
        walk: null,
        run: null,
        attack: null,
        death: null,
      },
    },
    formulaStats: {
      ...formulaStats,
      demonbaneVulnerability: 1.2,
    },
    defenceDrainFloor: bossSetup.defenceDrainFloor,
  };
  return yamaNpcDefinition.createActor(baseActor, {
    openingStyle: bossSetup.openingStyle,
    attackPolicy: createYamaAttackPolicyState(bossSetup.openingStyle, bossSetup.attackPattern),
    queuedAttack: null,
    windup: null,
    latestAttackKind: null,
    latestAttackTick: null,
    alternatingAttackCount: 0,
    didPlanMelee: false,
  });
}
// The wave lines of getYamaWaveTiles (shadowWaves.js), tested for one tile
// instead of listed for the arena.
function isPlayerOnYamaWave(playerX, playerY, tick, waveConfig) {
  const periodTicks = waveConfig?.periodTicks ?? 70;
  const deltas = waveConfig?.deltas ?? defaultYamaWaveDeltas;
  const speedTilesPerTick = waveConfig?.speedTilesPerTick ?? 2;
  const startDelay = waveConfig?.startDelay ?? 7;
  const firstCycleDeltas = waveConfig?.firstCycleDeltas ?? defaultYamaFirstCycleWaveDeltas;
  const seed = waveConfig?.seed;
  const useRandomOffsets = waveConfig?.randomOffsets === true && seed !== undefined;
  const diagonalDifference = playerY - playerX;
  const diagonalSum = playerX + playerY;
  for (let waveIndex = 0; waveIndex < deltas.length; waveIndex++) {
    const { tp: ticksIntoPeriod, cycleNum: cycleNum } = getYamaWaveCyclePosition(tick, deltas[waveIndex], periodTicks, startDelay);
    if (!isYamaWaveActiveInCycle(deltas[waveIndex], cycleNum, firstCycleDeltas)) {
      continue;
    }
    const tilesTravelled = speedTilesPerTick * ticksIntoPeriod;
    let leftWaveStart = -40;
    let rightWaveStart = 20;
    if (useRandomOffsets) {
      const randomOffset = getYamaWaveRandomOffset(seed, waveIndex, deltas[waveIndex], cycleNum);
      leftWaveStart += randomOffset[0];
      rightWaveStart += randomOffset[1];
    }
    if (!isInsideYamaWaveDiamond(diagonalDifference, diagonalSum)) {
      continue;
    }
    const onlyLine = waveConfig?.lines?.[waveIndex];
    const leftWaveLine = diagonalDifference - tilesTravelled;
    if (onlyLine !== "R" && (leftWaveLine === leftWaveStart || leftWaveLine === leftWaveStart + 1)) {
      return true;
    }
    const rightWaveLine = diagonalSum - tilesTravelled;
    if (onlyLine !== "L" && (rightWaveLine === rightWaveStart || rightWaveLine === rightWaveStart + 1)) {
      return true;
    }
  }
  return false;
}
function recordFireballAsLatestAttack(actor, tick) {
  const state = yamaNpcDefinition.getState(actor);
  if (state) {
    state.latestAttackKind = "fireball";
    state.latestAttackTick = tick;
  }
}
function setYamaOpeningStyle(actor, openingStyle, attackPattern) {
  const state = yamaNpcDefinition.getState(actor);
  if (state) {
    state.openingStyle = openingStyle;
    state.attackPolicy = createYamaAttackPolicyState(openingStyle, attackPattern);
    state.alternatingAttackCount = 0;
  }
}
var YamaEncounter = class {
  kind;
  contract;
  resolvedConfig;
  fireballRuntime;
  voidFlareCoordinator;
  npcDefinitions;
  state;
  yamaActor = null;
  attackMechanics = {
    meleeEnabled: false,
    rangedMagicEnabled: false,
  };
  sealedArenaConfig = null;
  sealedArenaSource = null;
  constructor(contract, encounterSeed) {
    this.contract = contract ?? noContract;
    this.resolvedConfig = resolveEncounterConfig(this.contract.encounter);
    this.kind = this.contract.kind;
    this.fireballRuntime = new FireballRuntime(
      yamaActorId,
      this.resolvedConfig.attackPattern,
      this.resolvedConfig.fireballs.damage,
      this.contract.contractId === null,
    );
    this.voidFlareCoordinator = new VoidFlareCoordinator(this.resolvedConfig.voidFlares);
    this.state = createYamaEncounterState(
      {
        waves: this.resolvedConfig.waves,
      },
      encounterSeed === undefined
        ? {
            source: "constructor",
          }
        : {
            source: "constructor",
            encounterSeed: encounterSeed,
          },
    );
    this.npcDefinitions = this.createNpcDefinitions();
  }
  getOutcome() {
    return this.state.lifecycle.outcome;
  }
  getDefaultPlayerStart() {
    return [
      yamaPlayerStartMin[0] + Math.floor(Math.random() * (yamaPlayerStartMax[0] - yamaPlayerStartMin[0] + 1)),
      yamaPlayerStartMin[1] + Math.floor(Math.random() * (yamaPlayerStartMax[1] - yamaPlayerStartMin[1] + 1)),
    ];
  }
  getIntroConfig() {
    return {
      facingAngle: 0,
      animationSeqId: 12152,
    };
  }
  createNpcs(startPosition) {
    this.yamaActor = createYamaActor({
      position: [...yamaBasePosition],
      hp: this.resolvedConfig.boss.hp,
      maxHp: this.resolvedConfig.boss.maxHp,
      openingStyle: this.state.run.openingStyleSeed,
      attackPattern: this.resolvedConfig.attackPattern,
      levelOverrides: this.contract.contractId === null ? undefined : contractLevelOverrides,
      defenceDrainFloor: 145,
    });
    return [this.yamaActor];
  }
  reset(seeds) {
    this.state = createYamaEncounterState(
      {
        waves: this.resolvedConfig.waves,
      },
      seeds === undefined
        ? {
            source: "reset",
          }
        : {
            source: "reset",
            seeds: seeds,
          },
    );
    this.yamaActor = null;
    this.attackMechanics = {
      meleeEnabled: false,
      rangedMagicEnabled: false,
    };
    this.npcDefinitions = this.createNpcDefinitions();
  }
  getSeeds() {
    const state = this.state;
    return {
      encounterSeed: state.run.encounterSeed,
      fireballSeed: state.fireballs.seed,
      voidFlareSeed: state.voidFlares.seed,
      firstRangeMageType: state.run.openingStyleSeed,
    };
  }
  getNpcDefinitions() {
    return this.npcDefinitions;
  }
  moveNpc(npc, context) {
    if (
      npc.id === yamaActorId &&
      canNpcActAtTick(npc, context.tick) &&
      this.resolvedConfig.pursuit &&
      !this.state.lifecycle.defeated
    ) {
      return getBossPursuitMoves(npc, context.playerPos, this.state.run.pursuitRng, yamaPursuitMovement);
    } else {
      return [];
    }
  }
  resolveHazards(context, mechanics) {
    if (this.state.lifecycle.defeated) {
      return [];
    }
    const damages = [];
    if (
      mechanics.waves &&
      context.tick !== this.state.fireballs.shadowWaveImmunityTick &&
      isPlayerOnYamaWave(context.playerPos[0], context.playerPos[1], context.tick, this.state.run.waveConfig)
    ) {
      this.waveHit(context, damages);
    }
    this.voidFlareCoordinator.resolvePendingImpacts(this.state.voidFlares, context, damages);
    if (context.world.getPlayer()?.alive) {
      const definitionContext = this.buildNpcDefinitionContext(context);
      for (const npc of context.world.getNpcs()) {
        damages.push(...this.npcDefinitions.resolveLocalEffects(npc, definitionContext));
      }
    }
    this.fireballRuntime.resolveHazards(this.state.fireballs, context, {
      mechanics: mechanics,
      damages: damages,
    });
    return damages;
  }
  // A wave touches the player (the whole fight, YamaFullEncounter.js, has its own).
  waveHit(context, damages) {
    damages.push({
      baseDamage: this.resolvedConfig.waves.damage,
      attackType: "typeless",
      source: "Waves",
    });
  }
  processNpcTick(npc, context, mechanics) {
    if (npc.id !== yamaActorId || this.state.lifecycle.defeated) {
      return {
        environmentalDamages: [],
      };
    } else {
      this.updateAttackMechanics(mechanics);
      return this.npcDefinitions.tick(npc, this.buildNpcDefinitionContext(context));
    }
  }
  completeNpcBand(context, mechanics) {
    if (
      this.state.lifecycle.outcome.phase === "resolving" &&
      context.tick >= this.state.lifecycle.outcome.completionTick
    ) {
      this.state.lifecycle.outcome = {
        ...this.state.lifecycle.outcome,
        phase: "victory",
      };
    }
    if (!this.state.lifecycle.defeated) {
      this.spawnPendingVoidFlares(context, mechanics);
    }
    return [];
  }
  spawnPendingVoidFlares(context, mechanics) {
    this.voidFlareCoordinator.spawnPendingFlares(
      this.state.voidFlares,
      context,
      mechanics.voidFlares === true,
    );
  }
  processPostTick(context, mechanics) {
    if (this.state.lifecycle.defeated) {
      return [];
    }
    const beatInfo = getYamaBeatInfo(context.tick, this.resolvedConfig.attackPattern);
    const boss = context.world.getNpc(yamaActorId);
    this.updateAttackMechanics(mechanics);
    if (boss) {
      this.npcDefinitions.postTick(boss, this.buildNpcDefinitionContext(context));
    }
    const bossState = boss ? getYamaState(boss) : null;
    if (mechanics.waves) {
      this.emitWaveActivated(context);
    }
    if (
      this.fireballRuntime.processPostTick(this.state.fireballs, context, {
        beatInfo: beatInfo,
        didPlanMelee: bossState?.didPlanMelee === true,
        mechanics: mechanics,
      }) &&
      boss
    ) {
      recordFireballAsLatestAttack(boss, context.tick);
    }
    this.voidFlareCoordinator.processPostTick(this.state.voidFlares, context, {
      enabled: mechanics.voidFlares === true,
      beatInfo: beatInfo,
      didPlanMelee: bossState?.didPlanMelee === true,
    });
    return [];
  }
  emitWaveActivated(context) {
    const bounds = this.getArenaConfig().bounds ?? getArenaBounds() ?? fallbackYamaArenaBounds;
    const waveTiles = getYamaWaveTiles(
      context.tick,
      bounds.minX,
      bounds.maxX,
      bounds.minY,
      bounds.maxY,
      this.state.run.waveConfig,
    );
    if (waveTiles.length > 0) {
      const wavePositions = waveTiles.map((waveTile) => [waveTile.x, waveTile.y]);
      // Emitted on every tick that has a wave tile in the arena, not once
      // per wave. The scenes know the event by this name.
      context.tickEvents.emit({
        type: "wave_activated",
        position: getNearestPosition(context.playerPos, wavePositions),
        wavePositions: wavePositions,
      });
    }
  }
  getSnapshot(request) {
    const bossState = this.yamaActor ? getYamaState(this.yamaActor) : null;
    return {
      kind: this.kind,
      state: {
        contractId: this.contract.contractId,
        firstRangeMageType: bossState?.openingStyle ?? this.state.run.openingStyleSeed,
        lastAttackKind: bossState?.latestAttackKind ?? null,
        lastAttackTick: bossState?.latestAttackTick ?? null,
        waveConfig: this.state.run.waveConfig,
        attackPattern: this.resolvedConfig.attackPattern,
      },
      visuals: this.fireballRuntime.buildVisuals(this.state.fireballs, {
        tick: request.tick,
        defeated: this.state.lifecycle.defeated,
        mechanics: request.mechanics,
      }),
    };
  }
  onNpcDefeated(defeat, context, completionOwnership) {
    if (defeat.npcId !== yamaActorId || this.state.lifecycle.defeated) {
      return;
    }
    this.state.lifecycle.defeated = true;
    this.fireballRuntime.clearFireballs(this.state.fireballs);
    this.voidFlareCoordinator.clearFlares(this.state.voidFlares, context, defeat.tick);
    context.world.removePendingHitsFromSource(yamaActorId);
    this.emitDefeatLine(context);
    if (completionOwnership === "encounter-owned") {
      this.state.lifecycle.outcome = {
        phase: "resolving",
        decisiveTick: defeat.tick,
        completionTick: defeat.tick + 7,
        primaryActorId: yamaActorId,
        completionActorIds: [yamaActorId],
      };
    }
  }
  // His line at his death (the whole fight has the throne NPC say it later).
  emitDefeatLine(context) {
    const random = createSeededRandom(this.state.run.encounterSeed ^ 1497451841);
    const overheadTextIndex = Math.floor(random() * yamaDefeatOverheadTexts.length);
    context.tickEvents.emit({
      type: "overhead_text",
      anchor: {
        kind: "actor",
        actorId: yamaActorId,
      },
      overheadText: yamaDefeatOverheadTexts[overheadTextIndex],
      overheadCycle: 7, // the text stays for 7 ticks
    });
  }
  getEngineRules() {
    return this.contract.engineRules;
  }
  getDefaultMechanicsConfig() {
    return buildYamaControls(this.contract).defaultMechanicsConfig;
  }
  getNpcDamageSourceLabel() {
    return "YamaAttack";
  }
  getArenaConfig() {
    const arenaConfig = arenaConfigFromCache || {
      bounds: null,
      walkableTiles: null,
      collisionMap: null,
    };
    if (!arenaConfig.walkableTiles) {
      return arenaConfig;
    }
    if (this.sealedArenaConfig && this.sealedArenaSource === arenaConfig.walkableTiles) {
      return this.sealedArenaConfig;
    }
    const sealedWalkableTiles = new Set();
    for (const tileKey of arenaConfig.walkableTiles) {
      if (!isYamaSealedRow(Number(tileKey.slice(tileKey.indexOf(",") + 1)))) {
        sealedWalkableTiles.add(tileKey);
      }
    }
    this.sealedArenaSource = arenaConfig.walkableTiles;
    this.sealedArenaConfig = {
      ...arenaConfig,
      walkableTiles: sealedWalkableTiles,
    };
    return this.sealedArenaConfig;
  }
  executeCommand(command, context, mechanics) {
    if (command.encounter === "yama_p3") {
      return this.executeYamaCommand(command, context, mechanics);
    }
  }
  executeYamaCommand(command, context, mechanics) {
    switch (command.type) {
      // The interface holds the two commands of this type, for "magic" and
      // for "range" (client/assets/rendering.js).
      case "set-opening-style":
        this.state.run.openingStyleSeed = command.style;
        {
          const boss = context.world.getNpc(yamaActorId) ?? this.yamaActor;
          if (boss) {
            setYamaOpeningStyle(boss, command.style, this.resolvedConfig.attackPattern);
          }
        }
        return {};
      case "spawn-fireball":
        if (!this.state.lifecycle.defeated) {
          this.fireballRuntime.spawnManualBurst(this.state.fireballs, {
            tick: context.tick,
            mechanics: mechanics,
          });
        }
        return {};
      case "spawn-void-flare": {
        if (this.state.lifecycle.defeated) {
          return {};
        }
        const event = this.voidFlareCoordinator.spawnManualFlare(this.state.voidFlares, context);
        if (event) {
          return {
            gameEvents: [event],
          };
        } else {
          return {};
        }
      }
      default:
        return command;
    }
  }
  createNpcDefinitions() {
    return new NpcDefinitionRegistry(this.npcDefinitionEntries());
  }
  npcDefinitionEntries() {
    return [
      yamaNpcDefinition.register({
        attackPattern: this.resolvedConfig.attackPattern,
        meleeDamage: this.resolvedConfig.autoAttacks.meleeDamage,
        rangedMagicDamage: this.resolvedConfig.autoAttacks.rangedMagicDamage,
        meleePrayerReduction:
          this.resolvedConfig.autoAttacks.meleePrayerReduction,
        rangedMagicPrayerReduction:
          this.resolvedConfig.autoAttacks.rangedMagicPrayerReduction,
        wretchedStrength: this.resolvedConfig.autoAttacks.wretchedStrength,
        accuracyRandom: this.state.run.accuracyRng,
        autoPoison: () => this.autoPoison?.(), // the whole fight's (YamaFullEncounter.js); none here
        getMechanics: () => this.attackMechanics,
      }),
      voidFlareNpcDefinition.register({
        damageSeed: this.state.fireballs.seed,
        explosionDamage: this.resolvedConfig.voidFlares.explosionDamage,
        healsOnImpact: () => this.flareHealsOnImpact === true, // set by the whole fight only
        getBoss: ({ world: world }) => world.getNpc(yamaActorId),
        scheduleImpact: (impact) => this.state.voidFlares.pendingImpacts.push(impact),
      }),
    ];
  }
  updateAttackMechanics(mechanics) {
    this.attackMechanics = {
      meleeEnabled: mechanics.yamaMelee === true,
      rangedMagicEnabled: mechanics.yamaMageRange === true,
    };
  }
  buildNpcDefinitionContext(context) {
    return {
      ...context,
      random: this.state.run.accuracyRng,
    };
  }
};
export { YamaEncounter, createYamaActor, isPlayerOnYamaWave, yamaActorId, yamaPursuitMovement };
