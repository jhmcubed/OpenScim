import { zNumber, zObject } from "../../assets/vendor.js";
import { combatStatNames } from "../../engine/playerState.js";
import {
  setArenaConfig,
  isArenaTileWalkable,
  isInsideArenaBounds,
  getArenaCollisionMap,
  getArenaDefaultWalkable,
} from "../../engine/arena.js";
import { createSeededRandom, hashInteger } from "../../engine/random.js";
import { isNpcAlive, scheduleNpcHitpointRegen } from "../../engine/npcState.js";
import { createRandomDecisions, weightEqually, getContextDecisions } from "../../engine/decisions.js";
import { NpcDefinitionRegistry } from "../shared/npcDefinitions.js";
import { canChooseInfernoStartTile, formatTileString, validateInfernoStartTile, clampInfernoWave } from "./startTile.js";
import { formatInfernoSpawnLayout } from "./spawnLayout.js";
import { emitInfernoVisual, isOutsideZukShieldCoverage } from "./events.js";
import { activeOutcome } from "../shared/npcHelpers.js";
import { infernoObstacleCollisionFlags } from "./collisionFlags.js";
import { infernoNpcTypeIds, zukMagerNpcTypeId, zukRangerNpcTypeId, zukJadNpcTypeId, zukJadHealerNpcTypeId, zukHealerNpcTypeId, infernoArenaBounds, zukPlayerStart, zukIntroStartTickOffset, zukIntroTeleportTickOffset, zukIntroSpawnTickOffset, zukRiseClipId, zukCavernShakeMessage, tzhaarKetKehName, zukPrisonBreakingMessage, infernoEncounterKind, infernoPlayerStart, infernoDefaultStartTile, infernoWaveMessageColor, jadHealerSpawnDistanceRange } from "./constants.js";
import { chooseDistinctValues } from "./monsterHelpers.js";
import { infernoPillars, pillarCollapseRemovalTicks, scriptedPillarCollapseRemovalTicks, getInfernoPillarTiles, buildArenaConfigWithPillars, infernoPillarNpcDefinition, infernoPillarCollapseNpcDefinition, createPillarActorRecord, createInfernoPillarActor } from "./pillars.js";
import { buildSpawnLayoutFromSpawns, infernoJadWaveConfigs, mixInfernoWaveSeed, createWaveNpcRandom, buildInfernoWaveSpawns } from "./waves.js";
import { infernoStartWaveKey, infernoSpawnLayoutKey, infernoStartTileKey, infernoPinnedWaveKey, infernoPillarDestroyedKeys, getInfernoSetup, buildInfernoControls } from "./controls.js";
import { batNpcDefinition } from "./bat.js";
import { blobNpcDefinition, blobChildNpcDefinition } from "./blob.js";
import { jadHealerNpcDefinition, jadExecution, jadNpcDefinition } from "./jad.js";
import { meleerNpcDefinition } from "./meleer.js";
import { nibblerNpcDefinition } from "./nibbler.js";
import { corpseSpeciesByNpcTypeId, removeWaveMonsterIfDue, waveMonsterFactories } from "./waveMonsters.js";
import { magerNpcDefinition } from "./mager.js";
import { rangerNpcDefinition } from "./ranger.js";
import { zukShieldNpcDefinition, zukNpcDefinition } from "./zuk.js";
import { zukHealerNpcDefinition } from "./zukHealers.js";
import { zukShieldPatrol, ZukFight } from "./zukFight.js";
// The Inferno: the encounter class. The encounter registry (in
// client/assets/rendering.js) constructs it as `new InfernoEncounter()`. The
// start wave, the standing pillars and a chosen spawn layout arrive as
// mechanics, in configureRunStart.
//
// The order of the hooks within one tick (docs/ARCHITECTURE.md, "One tick").
// From wave 69 a ZukFight (zukFight.js) exists and most hooks hand over to it.
//   1. executeCommand   Zuk's debug commands, handed to the ZukFight. A practice
//                       command (retry, next wave) is not run here: the engine
//                       plans a restart with planPracticeRestart.
//   2. resolveHazards   nothing during the waves; in Zuk's fight the sparks of
//                       his healers
//   3. prepareNpcBand   the wave-69 intro advances; the pillars are put into
//                       the world once; a cleared wave is noticed
//   4. for each NPC: removeNpcIfDue (a dead monster after its delay, with a
//      blob's split), moveNpc, resolveNpcLocalEffects, processNpcTick. These
//      go to the monster's own definition: one module per monster.
//      (the hits on the player land; the player moves and attacks)
//   5. processPostTick  a cleared wave is noticed; the next wave begins when
//                       its countdown is over. In Zuk's fight: the set clock.
var infernoSeedValueSchema = zNumber().int().min(0).max(4294967295);
var infernoSeedsSchema = zObject({
  runSeed: infernoSeedValueSchema,
  attemptSeed: infernoSeedValueSchema.optional(),
}).strict();
function getInfernoStage(wave) {
  if (wave === 69) {
    return "zuk";
  } else {
    return "waves";
  }
}
var infernoMeleeAttackKinds = new Set(["melee_slash", "melee_stab", "melee_crush"]);
function createRandomInfernoSeed() {
  return Math.floor(Math.random() * 4294967296);
}
function isInfernoTileOpen(x, y) {
  return isInsideArenaBounds(x, y) && isArenaTileWalkable(x, y) && getArenaCollisionMap()?.hasFlag(x, y, infernoObstacleCollisionFlags) !== true;
}
function getCorpseSpecies(npc) {
  return corpseSpeciesByNpcTypeId[npc.npcTypeId] ?? null;
}
function getBatHitDrains(hit) {
  if (hit.sourceKind !== "combat" || hit.sourceNpcTypeId !== infernoNpcTypeIds.bat) {
    return null;
  }
  if (hit.prayedCorrectly === true) {
    return null;
  }
  const playerStatDrains =
    hit.effectiveDamage > 0
      ? Object.fromEntries(combatStatNames.map((skill) => [skill, 1]))
      : undefined;
  return {
    runEnergyDelta: -300, // 3 %: run energy counts to 10000
    ...(playerStatDrains
      ? {
          playerStatDrains: playerStatDrains,
        }
      : {}),
  };
}
function isZukCommand(command) {
  return command.encounter === "zuk";
}
function isNpcAtPillar(npc, pillarPosition) {
  const [pillarX, pillarY] = pillarPosition;
  return (
    npc.position[0] <= pillarX + 3 &&
    npc.position[0] + npc.size >= pillarX &&
    npc.position[1] <= pillarY + 3 &&
    npc.position[1] + npc.size >= pillarY
  );
}
function buildPillarCollapseHits(world, pillar, attackerId, isNibbler) {
  return world
    .getNpcs()
    .filter(
      (npc) =>
        isNibbler(npc) &&
        isNpcAlive(npc) &&
        isNpcAtPillar(npc, pillar.position),
    )
    .map((nibbler) => ({
      attackerId: attackerId,
      targetId: nibbler.id,
      style: "typeless",
      attackKind: "typeless",
      rolledDamage: nibbler.vitals.hp,
      accuracySucceeded: true,
      impactDelayTicks: 0,
      sourceDeathPolicy: "persist",
    }));
}
function pickWaveNibblerPillar(runSeed, wave, pillarKeys, openDecisions = createRandomDecisions, tick = -1) {
  if (pillarKeys.length === 0) {
    return null;
  } else {
    return openDecisions(createSeededRandom(mixInfernoWaveSeed(runSeed, wave, 1313423956))).choose(
      {
        site: "inferno.nibbler.pillar",
        tick: tick,
      },
      weightEqually(pillarKeys),
    );
  }
}
function findJadHealerSpawnTiles(
  jad,
  healerCount,
  { isOpen: isOpen, player: playerTile, decisions: decisions, key: decisionKey },
) {
  const [jadX, jadY] = jad.position;
  const centerOffset = (jad.size - 1) / 2;
  const [centerX, centerY] = [jadX + centerOffset, jadY + centerOffset];
  const isFreeTile = (x, y) =>
    isOpen(x, y) && (!playerTile || playerTile[0] !== x || playerTile[1] !== y);
  const { min: minDistance, max: maxDistance } = jadHealerSpawnDistanceRange;
  const candidateTiles = [];
  for (let x = Math.floor(centerX - maxDistance); x <= Math.ceil(centerX + maxDistance); x++) {
    for (let y = Math.floor(centerY - maxDistance); y <= Math.ceil(centerY + maxDistance); y++) {
      const distanceSquared = (x - centerX) ** 2 + (y - centerY) ** 2;
      if (distanceSquared >= minDistance * minDistance && distanceSquared <= maxDistance * maxDistance && isFreeTile(x, y)) {
        candidateTiles.push([x, y]);
      }
    }
  }
  const healerTiles = chooseDistinctValues(decisions, decisionKey, candidateTiles, healerCount);
  const isTaken = (x, y) => healerTiles.some(([takenX, takenY]) => takenX === x && takenY === y);
  for (let ringDistance = 1; ringDistance <= 8 && healerTiles.length < healerCount; ringDistance++) {
    for (let x = jadX - ringDistance; x <= jadX + jad.size - 1 + ringDistance && healerTiles.length < healerCount; x++) {
      for (let y = jadY - ringDistance; y <= jadY + jad.size - 1 + ringDistance && healerTiles.length < healerCount; y++) {
        if (
          Math.max(
            jadX - x,
            x - (jadX + jad.size - 1),
            jadY - y,
            y - (jadY + jad.size - 1),
          ) === ringDistance &&
          isFreeTile(x, y) &&
          !isTaken(x, y)
        ) {
          healerTiles.push([x, y]);
        }
      }
    }
  }
  return healerTiles;
}
function registerWaveMonsters(waveMonsterServices) {
  return [
    nibblerNpcDefinition.register({
      getWaveTarget: waveMonsterServices.getWaveTarget,
    }),
    batNpcDefinition.register(undefined),
    blobNpcDefinition.register(undefined),
    blobChildNpcDefinition.register(undefined),
    meleerNpcDefinition.register(undefined),
    rangerNpcDefinition.register(undefined),
    magerNpcDefinition.register({
      resurrection: waveMonsterServices.resurrection,
    }),
  ];
}
function registerWaveNpcs(services) {
  return [
    ...registerWaveMonsters({
      getWaveTarget: services.waveNibblerTarget,
      resurrection: services.resurrection,
    }),
    jadHealerNpcDefinition.register({
      sampleHeal: () => 10,
      presentHeal: services.presentParentHeal,
      melee: {
        formulaStyle: "melee_crush",
        attackKind: "melee_crush",
        impactDelayTicks: 0,
        maxHit: 18,
      },
    }),
    jadNpcDefinition.register({
      execution: jadExecution,
      spawnHealers: services.spawnJadHealers,
    }),
  ];
}
function registerZukNpcs(getZukFight, presentParentHeal) {
  return [
    zukShieldNpcDefinition.register(zukShieldPatrol),
    zukHealerNpcDefinition.register({
      sampleHeal: ({ context: context }) =>
        15 + Math.floor(context.random() * 10),
      presentHeal: presentParentHeal,
      castSparks: ({ actor: actor, target: target, context: context }) =>
        getZukFight().castSparks(actor, target, context),
    }),
    zukNpcDefinition.register({
      attacksEnabled: () => getZukFight().attacksEnabled,
      targetsPlayer: isOutsideZukShieldCoverage,
      spawnJad: (zukId, context) => {
        getZukFight().spawnJad(zukId, context);
      },
      spawnHealers: (zukId, context) => {
        getZukFight().spawnHealers(zukId, context);
      },
    }),
  ];
}
// What is marked when it comes (getAutoMarkers): the NPC types of actors.js.
// 7701 is the healer of a wave's Jad; the others are of Zuk's fight.
var autoMarkerLabels = new Map([
  [zukMagerNpcTypeId, "Zuk's set"],
  [zukRangerNpcTypeId, "Zuk's set"],
  [zukJadNpcTypeId, "Zuk's Jad"],
  [7701, "Jad's healers"],
  [zukJadHealerNpcTypeId, "Jad's healers"],
  [zukHealerNpcTypeId, "Zuk's healers"],
]);
var InfernoEncounter = class {
  constructor(runSeed = createRandomInfernoSeed(), options = {}) {
    this.kind = infernoEncounterKind;
    this.runStartMechanicsKeys = [
      infernoStartWaveKey,
      ...Object.values(infernoPillarDestroyedKeys),
      infernoSpawnLayoutKey,
      infernoStartTileKey,
      infernoPinnedWaveKey,
      "zukShieldStart",
    ];
    this.runSeed = undefined;
    this.attemptSeed = undefined;
    this.openStream = undefined;
    this.decisions = undefined;
    this.random = () => this.decisions.next();
    this.nextActorId = 0;
    this.setup = getInfernoSetup({});
    this.wave = 1;
    this.phase = "countdown";
    this.nextWaveTick = null;
    this.combatants = new Map();
    this.corpses = [];
    this.pillars = [];
    this.waveNibblerPillar = null;
    this.waveSpawnLayout = "";
    this.waveStartDestroyedPillars = this.setup.destroyedPillars;
    this.waveStartPlayerTile = null;
    this.pillarsMaterialized = false;
    this.arenaBase = null;
    this.parentHealTick = null;
    this.healedParents = new Set();
    this.zukControlTick = null;
    this.zuk = null;
    this.openedStage = null;
    this.services = {
      waveNibblerTarget: (context) => this.waveNibblerTarget(context.world),
      resurrection: {
        eligibleCorpses: () => (this.zuk ? [] : this.corpses),
        revive: (corpse, spawnTile, context) => this.revive(corpse, spawnTile, context),
      },
      spawnJadHealers: (jadId, context) => {
        if (context.world.getNpc(jadId)?.npcTypeId === 7704) {
          this.requireZukFight().spawnJadHealers(jadId, context);
        } else {
          this.spawnJadHealers(jadId, context);
        }
      },
      presentParentHeal: (parent, context) => this.presentParentHeal(parent, context),
    };
    this.definitions = undefined;
    this.runSeed = infernoSeedsSchema.parse({
      runSeed: runSeed,
    }).runSeed;
    this.openStream = options.decisionRandom ?? ((streamLabel, wave, random) => createRandomDecisions(random));
    this.decisions = this.openStream(
      "npc",
      this.wave,
      createWaveNpcRandom(this.getCombatSeed(), this.wave),
    );
    this.configureRunStart({});
    this.definitions = new NpcDefinitionRegistry([
      infernoPillarNpcDefinition.register({
        collapse: (pillarKey, context) => this.collapsePillar(pillarKey, context, pillarCollapseRemovalTicks),
      }),
      infernoPillarCollapseNpcDefinition.register(undefined),
      ...registerWaveNpcs(this.services),
      ...registerZukNpcs(
        () => this.requireZukFight(),
        (parent, context) => this.presentParentHeal(parent, context),
      ),
    ]);
  }
  getDefaultPlayerStart(mechanics = {}) {
    return this.getPlayerStartForSetup(this.getSetupFromMechanics(mechanics));
  }
  getIntroConfig(mechanics = {}) {
    if (this.getSetupFromMechanics(mechanics).startWave !== 1) {
      return null;
    } else {
      return {
        facingAngle: 1024,
        animationSeqId: 4367,
        message: "You hit the ground in the centre of The Inferno.",
      };
    }
  }
  getNpcDefinitions() {
    return this.definitions;
  }
  createNpcs() {
    this.openedStage = getInfernoStage(this.wave);
    return this.zuk?.createNpcs() ?? [];
  }
  configureRunStart(mechanics, runStartContext) {
    const setup = this.getSetupFromMechanics(mechanics);
    const previousStage = this.openedStage;
    const startStage = getInfernoStage(setup.startWave);
    if (previousStage === "zuk" && startStage === "zuk" && this.zuk) {
      this.setup = setup;
      this.zuk.setShieldStart(setup.zukShieldStart);
      return;
    }
    if (previousStage !== null && runStartContext) {
      for (const npcId of this.zuk?.bossAndGlyphIds ?? []) {
        runStartContext.despawnNpc(npcId);
      }
    }
    this.setup = setup;
    this.nextActorId = 0;
    this.wave = this.setup.startWave;
    this.phase = startStage === "zuk" ? "active" : "countdown";
    this.nextWaveTick = startStage === "zuk" ? null : 0 + (this.wave === 1 ? 11 : 1);
    this.zukControlTick = startStage === "zuk" ? 0 : null;
    this.zuk =
      startStage === "zuk"
        ? new ZukFight(this.runSeed, this.getCombatSeed(), 0, this.setup.zukShieldStart)
        : null;
    this.combatants.clear();
    this.corpses = [];
    this.waveSpawnLayout = "";
    this.waveStartDestroyedPillars = {
      ...this.setup.destroyedPillars,
    };
    this.waveStartPlayerTile = null;
    this.pillars = infernoPillars.map((pillar) => ({
      pillar: pillar,
      intact: this.wave <= 66 && !this.setup.destroyedPillars[pillar.key],
      proxyId: null,
    }));
    this.pillarsMaterialized = false;
    this.decisions = this.openStream(
      "npc",
      this.wave,
      createWaveNpcRandom(this.getCombatSeed(), this.wave),
    );
    this.parentHealTick = null;
    this.healedParents.clear();
    this.refreshArenaConfig();
    if (previousStage !== null && runStartContext) {
      this.openedStage = startStage;
      for (const npc of this.createNpcs()) {
        runStartContext.spawnNpc(npc);
      }
      if (previousStage !== startStage) {
        runStartContext.placePlayer(this.getDefaultPlayerStart(mechanics));
      }
    }
  }
  getSeeds() {
    return {
      runSeed: this.runSeed,
      ...(this.attemptSeed === undefined
        ? {}
        : {
            attemptSeed: this.attemptSeed,
          }),
    };
  }
  reset(seeds) {
    const parsedSeeds = infernoSeedsSchema.parse(
      seeds ?? {
        runSeed: createRandomInfernoSeed(),
      },
    );
    this.runSeed = parsedSeeds.runSeed;
    this.attemptSeed = parsedSeeds.attemptSeed;
    this.openedStage = null;
    this.configureRunStart({});
  }
  refineArenaConfig(arenaConfig) {
    this.arenaBase = arenaConfig;
    return buildArenaConfigWithPillars(arenaConfig, this.getIntactPillarKeys());
  }
  resolveHazards(context) {
    return this.zuk?.resolveHazards(context) ?? [];
  }
  prepareNpcBand(context, mechanics) {
    if (this.zukControlTick !== null && this.phase === "countdown") {
      this.advanceZukIntro(context);
    }
    if (this.zuk) {
      this.zuk.prepareNpcBand(context, mechanics);
    } else {
      if (!this.pillarsMaterialized) {
        this.materializePillars(context);
      }
      this.completeWaveIfCleared(context);
    }
  }
  removeNpcIfDue(npc, context) {
    const removalTick = infernoPillarCollapseNpcDefinition.getState(npc)?.removeAt;
    if (removalTick === undefined) {
      if (this.combatants.has(npc.id)) {
        if (
          removeWaveMonsterIfDue(npc, context, (split) =>
            this.spawnCombatant(
              split.species,
              {
                position: [...split.position],
                origin: "split",
              },
              context,
            ),
          )
        ) {
          this.combatants.delete(npc.id);
        }
      } else {
        this.zuk?.removeNpcIfDue(npc, context);
      }
    } else if (context.tick >= removalTick) {
      context.despawnNpc(npc.id);
    }
  }
  moveNpc(npc, context) {
    if (this.zuk) {
      return this.zuk.moveNpc(npc, context, this.definitions);
    } else {
      return this.definitions.move(npc, this.buildNpcDefinitionContext(context));
    }
  }
  resolveNpcLocalEffects(npc, context) {
    return this.definitions.resolveLocalEffects(npc, this.buildNpcDefinitionContext(context));
  }
  processNpcTick(npc, context) {
    return this.definitions.tick(npc, this.buildNpcDefinitionContext(context));
  }
  processPostTick(context, mechanics) {
    if (this.zuk) {
      this.zuk.processPostTick(context, mechanics);
      return [];
    } else {
      this.completeWaveIfCleared(context);
      if (
        this.phase === "countdown" &&
        this.wave <= 68 &&
        this.nextWaveTick !== null &&
        context.tick >= this.nextWaveTick
      ) {
        this.beginWave(context);
      }
      return [];
    }
  }
  onNpcDefeated(defeat, context, completionOwnership) {
    this.zuk?.onNpcDefeated(defeat, context, completionOwnership, this.definitions);
    const combatant = this.combatants.get(defeat.npcId);
    const defeatedNpc = context.world.getNpc(defeat.npcId);
    const species = defeatedNpc
      ? getCorpseSpecies(defeatedNpc)
      : null;
    if (combatant && species && combatant.origin !== "resurrection") {
      this.corpses.push({
        id: defeat.npcId,
        species: species,
      });
    }
  }
  getSnapshot(request) {
    return {
      kind: infernoEncounterKind,
      state: {
        wave: this.wave,
        startWave: this.setup.startWave,
        startDestroyedPillars: {
          ...this.setup.destroyedPillars,
        },
        startSpawnLayout: this.setup.spawnLayout
          ? formatInfernoSpawnLayout(this.setup.spawnLayout)
          : "",
        startPlayerTile: this.getStartPlayerTile(),
        ...(this.setup.pinnedWave === undefined
          ? {}
          : {
              pinnedWave: this.setup.pinnedWave,
            }),
        waveSpawnLayout: this.waveSpawnLayout,
        waveStartDestroyedPillars: {
          ...this.waveStartDestroyedPillars,
        },
        waveStartPlayerTile: this.waveStartPlayerTile
          ? [this.waveStartPlayerTile[0], this.waveStartPlayerTile[1]]
          : null,
        phase: this.phase,
        nextWaveTick: this.nextWaveTick,
        zuk: this.zuk?.getZukSnapshot(request) ?? null,
        pillars: this.pillars.map(
          ({ pillar: pillar, intact: intact, proxyId: proxyId }) => {
            const proxyNpc = proxyId === null ? null : request.world.getNpc(proxyId);
            return {
              key: pillar.key,
              locId: pillar.locId,
              position: [pillar.position[0], pillar.position[1]],
              intact: intact,
              hp: intact ? (proxyNpc?.vitals.hp ?? 255) : 0,
            };
          },
        ),
      },
      visuals: {
        pillarLocs: this.pillars
          .filter((pillarState) => pillarState.intact)
          .map(({ pillar: pillar }) => ({
            key: pillar.key,
            locId: pillar.locId,
            position: [pillar.position[0], pillar.position[1]],
          })),
        zukControlTick: this.zukControlTick,
      },
    };
  }
  getOutcome() {
    return this.zuk?.getOutcome() ?? activeOutcome;
  }
  // The replay's auto markers (client/replay/markers.js): the tick a wave is placed on, and
  // those on which Zuk's sets, his Jad and the healers come.
  getAutoMarkers({ world }) {
    const markers = this.phase === "active" ? [{ id: `wave ${this.wave}`, label: `wave ${this.wave}` }] : [];
    for (const npc of world.getNpcs()) {
      const label = autoMarkerLabels.get(npc.npcTypeId);
      const id = `${label} ${npc.spawnTick}`;
      if (label !== undefined && npc.alive && !markers.some((marker) => marker.id === id)) {
        markers.push({ id, label });
      }
    }
    return markers;
  }
  syncBossHp(bossHp, context) {
    this.zuk?.syncBossHp(bossHp, context);
  }
  enterBossHpPhase(bossHp, context) {
    if (this.zuk?.isBossAliveInWorld(context)) {
      this.parentHealTick = null;
      this.healedParents.clear();
      this.zuk.enterBossHpPhase(bossHp, context);
    }
  }
  getDefaultMechanicsConfig() {
    return buildInfernoControls().defaultMechanicsConfig;
  }
  getNpcDamageSourceLabel() {
    if (this.zuk) {
      return "ZukAttack";
    } else {
      return "InfernoAttack";
    }
  }
  getArenaConfig() {
    return {
      bounds: {
        ...infernoArenaBounds,
        width: 29,
        height: 30,
      },
      walkableTiles: null,
      collisionMap: null,
    };
  }
  getEngineRules() {
    return {
      onPlayerDamageTaken: (hit) =>
        getBatHitDrains(hit),
      validateAttack: (attackKind, targetId, rulesContext) => {
        const targetNpcTypeId = rulesContext.world.getNpc(targetId)?.npcTypeId;
        return (
          // A pillar (7709), a collapsing pillar (7710) and Zuk's shield (7707)
          // cannot be attacked, and Zuk not with melee. `false` refuses the
          // attack; anything else, `null` here, lets the engine go on.
          targetNpcTypeId !== 7709 &&
          targetNpcTypeId !== 7710 &&
          targetNpcTypeId !== 7707 &&
          (targetId !== "zuk" || !infernoMeleeAttackKinds.has(attackKind)) &&
          null
        );
      },
      playerInputLocked: (rulesContext) =>
        this.zukControlTick !== null &&
        rulesContext.tick >= this.zukControlTick + zukIntroStartTickOffset &&
        rulesContext.tick <= this.zukControlTick,
    };
  }
  executeCommand(command, context) {
    if (
      isZukCommand(command)
    ) {
      if (this.zuk) {
        return this.zuk.executeCommand(command, context);
      } else {
        return {};
      }
    } else if (command.encounter === "inferno") {
      return {};
    } else {
      return undefined;
    }
  }
  planPracticeRestart(command, mechanics, restartContext) {
    if (command.encounter !== "inferno") {
      return;
    }
    const buildRestartPlan = (startWave, keepRunSeed, mechanicsOverrides = {}, keepPlayerPosition = true) => {
      const runMechanics = {
        [infernoStartWaveKey]: String(clampInfernoWave(startWave)),
        ...mechanicsOverrides,
      };
      const startPosition = keepPlayerPosition
        ? this.getRestartStartPosition(
            {
              ...mechanics,
              ...runMechanics,
            },
            restartContext.playerPos,
          )
        : undefined;
      return {
        ...(keepRunSeed
          ? {
              encounterSeeds: {
                runSeed: this.runSeed,
                attemptSeed: createRandomInfernoSeed(),
              },
            }
          : {}),
        runMechanics: runMechanics,
        ...(startPosition
          ? {
              startPosition: startPosition,
            }
          : {}),
      };
    };
    const startSpawnLayout = this.setup.spawnLayout ? formatInfernoSpawnLayout(this.setup.spawnLayout) : "";
    const configuredSpawnLayout = this.getSetupFromMechanics(mechanics).spawnLayout;
    const spawnLayoutOverride =
      startSpawnLayout === (configuredSpawnLayout ? formatInfernoSpawnLayout(configuredSpawnLayout) : "")
        ? {}
        : {
            [infernoSpawnLayoutKey]: startSpawnLayout,
          };
    const configuredStartTileKey = formatTileString(
      this.getSetupFromMechanics({
        ...mechanics,
        [infernoStartWaveKey]: String(this.wave),
      }).startTile,
    );
    const startTileOverride =
      canChooseInfernoStartTile(this.wave) && this.getStartPlayerTile() !== "" && this.getStartPlayerTile() !== configuredStartTileKey
        ? {
            [infernoStartTileKey]: this.getStartPlayerTile(),
          }
        : {};
    const pinnedWaveOverride = {
      [infernoPinnedWaveKey]: String(this.wave),
    };
    const isWavePinned = this.setup.pinnedWave === this.wave;
    switch (command.type) {
      case "retry-wave":
        return buildRestartPlan(this.wave, isWavePinned || this.setup.spawnLayout?.wave === this.wave, {
          ...spawnLayoutOverride,
          ...startTileOverride,
          ...(isWavePinned ? pinnedWaveOverride : {}),
        });
      case "keep-spawns":
        return buildRestartPlan(this.wave, true, {
          ...spawnLayoutOverride,
          ...startTileOverride,
          ...pinnedWaveOverride,
        });
      case "reroll-wave":
        return buildRestartPlan(this.wave, false, {
          ...(this.setup.spawnLayout?.wave === this.wave
            ? {
                [infernoSpawnLayoutKey]: "",
              }
            : spawnLayoutOverride),
          ...startTileOverride,
        });
      case "go-to-wave": {
        const targetWave = clampInfernoWave(command.wave);
        return buildRestartPlan(targetWave, targetWave === this.wave, {}, false);
      }
      default:
        return (function (command) {
          throw new TypeError(`Unknown Inferno command: ${JSON.stringify(command)}`);
        })(command);
    }
  }
  planRestartStart(mechanics, restartContext) {
    return this.getRestartStartPosition(mechanics, restartContext.playerPos);
  }
  getIntactPillarKeys() {
    return new Set(
      this.pillars.filter((pillarState) => pillarState.intact).map((pillarState) => pillarState.pillar.key),
    );
  }
  refreshArenaConfig() {
    if (this.arenaBase !== null) {
      setArenaConfig(buildArenaConfigWithPillars(this.arenaBase, this.getIntactPillarKeys()), getArenaDefaultWalkable());
    }
  }
  getCombatSeed() {
    const runSeed = this.runSeed;
    const attemptSeed = this.attemptSeed;
    if (attemptSeed === undefined) {
      return runSeed;
    } else {
      return hashInteger((runSeed ^ hashInteger((attemptSeed ^ 1096044628) >>> 0)) >>> 0);
    }
  }
  allocateActorId(species) {
    return `inferno_${species}_${this.nextActorId++}`;
  }
  buildNpcDefinitionContext(context) {
    if (this.zuk) {
      return this.zuk.buildNpcDefinitionContext(context);
    } else {
      return {
        ...context,
        random: this.random,
        decisions: this.decisions,
      };
    }
  }
  getSetupFromMechanics(mechanics) {
    return getInfernoSetup(mechanics);
  }
  getStartPlayerTile() {
    if (canChooseInfernoStartTile(this.setup.startWave)) {
      return formatTileString(this.setup.startTile);
    } else {
      return "";
    }
  }
  getPlayerStartForSetup(setup) {
    if (setup.startWave === 69) {
      return [...zukPlayerStart];
    }
    if (!canChooseInfernoStartTile(setup.startWave)) {
      return [...infernoPlayerStart];
    }
    const arenaBase = this.arenaBase;
    if (
      validateInfernoStartTile(
        setup.startTile,
        setup,
        (x, y) =>
          arenaBase === null ||
          ((arenaBase.walkableTiles?.has(`${x},${y}`) ?? true) &&
            arenaBase.collisionMap?.hasFlag(x, y, infernoObstacleCollisionFlags) !== true),
      ).ok
    ) {
      return [...setup.startTile];
    } else {
      return [...infernoDefaultStartTile];
    }
  }
  getRestartStartPosition(mechanics, playerPos) {
    const { startWave: startWave, destroyedPillars: destroyedPillars } =
      this.getSetupFromMechanics(mechanics);
    if (startWave === 1 || getInfernoStage(startWave) === "zuk" || getInfernoStage(this.wave) === "zuk") {
      return;
    }
    const [playerX, playerY] = playerPos;
    const [defaultX, defaultY] = this.getDefaultPlayerStart(mechanics);
    if (
      (playerX === defaultX && playerY === defaultY) ||
      !isInfernoTileOpen(playerX, playerY) ||
      (startWave <= 66 &&
        infernoPillars.some(
          (pillar) =>
            !destroyedPillars[pillar.key] &&
            getInfernoPillarTiles(pillar).some(([x, y]) => x === playerX && y === playerY),
        ))
    ) {
      return undefined;
    } else {
      return [playerX, playerY];
    }
  }
  requireZukFight() {
    if (!this.zuk) {
      throw new TypeError("A wave-69 NPC acted before wave 69 began");
    }
    return this.zuk;
  }
  advanceZukIntro(context) {
    const zukControlTick = this.zukControlTick;
    if (zukControlTick === null) {
      return;
    }
    const introTickOffset = context.tick - zukControlTick;
    if (introTickOffset === zukIntroStartTickOffset) {
      context.tickEvents.emit({
        type: "game_message",
        kind: "game",
        segments: [
          {
            text: zukCavernShakeMessage,
          },
        ],
      });
    }
    if (introTickOffset === zukIntroTeleportTickOffset) {
      if (!context.teleportPlayer) {
        throw new TypeError(
          "Wave 69's intro needs the engine's player teleport",
        );
      }
      context.teleportPlayer([...zukPlayerStart], 1024);
    }
    if (introTickOffset === zukIntroSpawnTickOffset) {
      this.zuk = new ZukFight(
        this.runSeed,
        this.getCombatSeed(),
        zukControlTick,
        this.setup.zukShieldStart,
      );
      for (const npc of this.zuk.createNpcs()) {
        context.spawnNpc(npc);
      }
      emitInfernoVisual(context.tickEvents, {
        animations: [
          {
            actorId: "zuk",
            clipId: zukRiseClipId,
            delayCycles: 0,
          },
        ],
        projectiles: [],
        graphics: [],
      });
      context.tickEvents.emit({
        type: "game_message",
        kind: "public",
        speaker: tzhaarKetKehName,
        segments: [
          {
            text: zukPrisonBreakingMessage,
          },
        ],
      });
    }
    if (introTickOffset === 0) {
      this.phase = "active";
      this.nextWaveTick = null;
      context.tickEvents.emit({
        type: "game_message",
        kind: "game",
        segments: [
          {
            text: "Wave: 69",
            color: infernoWaveMessageColor,
          },
        ],
      });
    }
  }
  materializePillars(context) {
    this.pillarsMaterialized = true;
    for (const pillarState of this.pillars) {
      if (!pillarState.intact) {
        continue;
      }
      const proxyNpc = createInfernoPillarActor({
        pillar: pillarState.pillar,
        id: `inferno_pillar_${pillarState.pillar.key}`,
        spawnTick: context.tick,
      });
      context.spawnNpc(proxyNpc);
      pillarState.proxyId = proxyNpc.id;
    }
  }
  waveNibblerTarget(world) {
    const targetPillarState = this.pillars.find((pillarState) => pillarState.pillar.key === this.waveNibblerPillar);
    const proxyNpc = targetPillarState?.intact && targetPillarState.proxyId !== null ? world.getNpc(targetPillarState.proxyId) : null;
    if (proxyNpc && isNpcAlive(proxyNpc)) {
      return proxyNpc;
    } else {
      return null;
    }
  }
  collapsePillar(pillarKey, context, removeAfterTicks) {
    const collapsingPillarState = this.pillars.find((pillarState) => pillarState.pillar.key === pillarKey);
    if (!collapsingPillarState?.intact) {
      return;
    }
    collapsingPillarState.intact = false;
    if (collapsingPillarState.proxyId !== null) {
      context.despawnNpc(collapsingPillarState.proxyId);
    }
    collapsingPillarState.proxyId = null;
    this.refreshArenaConfig();
    const { pillar: pillar } = collapsingPillarState;
    const collapseSetup = {
      pillar: pillar,
      id: `inferno_pillar_${pillarKey}_collapse`,
      spawnTick: context.tick,
      removeAt: context.tick + removeAfterTicks,
    };
    const collapseNpc = infernoPillarCollapseNpcDefinition.createActor(
      createPillarActorRecord({
        id: collapseSetup.id,
        npcTypeId: 7710,
        archetypeId: "inferno_pillar_collapse",
        position: collapseSetup.pillar.position,
        spawnTick: collapseSetup.spawnTick,
        hp: 1,
      }),
      {
        pillar: collapseSetup.pillar.key,
        removeAt: collapseSetup.removeAt,
      },
    );
    context.spawnNpc(collapseNpc);
    const collapseHits = buildPillarCollapseHits(
      context.world,
      pillar,
      collapseNpc.id,
      (npc) => this.combatants.get(npc.id)?.kind === "nibbler",
    );
    if (collapseHits.length > 0 && !context.queueNpcHit) {
      throw new TypeError("A pillar collapse needs the engine hit queue");
    }
    for (const hit of collapseHits) {
      context.queueNpcHit?.(hit);
    }
    context.tickEvents.emit({
      type: "inferno_pillar_collapse",
      pillar: pillarKey,
      position: [pillar.position[0], pillar.position[1]],
      soundId: 1021,
      soundPosition: [pillar.position[0] + 1, pillar.position[1] + 1],
    });
  }
  spawnCombatant(species, spawnSetup, context) {
    const npc = waveMonsterFactories[species]({
      ...spawnSetup,
      id: this.allocateActorId(species),
      spawnTick: context.tick,
    });
    scheduleNpcHitpointRegen(npc, context.tick);
    context.spawnNpc(npc);
    this.combatants.set(npc.id, {
      kind: species,
      origin: spawnSetup.origin,
    });
    return npc;
  }
  beginWave(context) {
    this.decisions = this.openStream(
      "npc",
      this.wave,
      createWaveNpcRandom(this.getCombatSeed(), this.wave),
    );
    const intactPillarKeys = this.pillars.filter((pillarState) => pillarState.intact).map((pillarState) => pillarState.pillar.key);
    const wave = this.wave;
    this.waveNibblerPillar = pickWaveNibblerPillar(
      this.runSeed,
      wave,
      intactPillarKeys,
      (random) => this.openStream("nibbler_target", wave, random),
      context.tick,
    );
    this.corpses = [];
    context.tickEvents.emit({
      type: "game_message",
      kind: "game",
      segments: [
        {
          text: `Wave: ${this.wave}`,
          color: infernoWaveMessageColor,
        },
      ],
    });
    const waveSpawns = buildInfernoWaveSpawns(
      this.runSeed,
      wave,
      (random) => this.openStream("layout", wave, random),
      context.tick,
      this.setup.spawnLayout,
    );
    const spawnLayout = buildSpawnLayoutFromSpawns(wave, waveSpawns);
    this.waveSpawnLayout = spawnLayout ? formatInfernoSpawnLayout(spawnLayout) : "";
    const isPillarDestroyed = (pillarKey) => !this.pillars.some((pillarState) => pillarState.pillar.key === pillarKey && pillarState.intact);
    this.waveStartDestroyedPillars = {
      west: isPillarDestroyed("west"),
      south: isPillarDestroyed("south"),
      northEast: isPillarDestroyed("northEast"),
    };
    const player = context.world.getPlayer();
    this.waveStartPlayerTile = player ? [player.position[0], player.position[1]] : null;
    for (const spawn of waveSpawns) {
      this.spawnCombatant(
        spawn.kind,
        {
          position: spawn.position,
          origin: "wave",
          ...(spawn.jad
            ? {
                jad: spawn.jad,
              }
            : {}),
        },
        context,
      );
    }
    this.phase = "active";
    this.nextWaveTick = null;
  }
  completeWaveIfCleared(context) {
    if (this.phase === "active") {
      for (const npcId of [...this.combatants.keys()]) {
        if (!context.world.getNpc(npcId)) {
          this.combatants.delete(npcId);
        }
      }
      if (!(this.combatants.size > 0)) {
        context.tickEvents.emit({
          type: "game_message",
          kind: "game",
          segments: [
            {
              text: "Wave completed!",
            },
          ],
        });
        if (this.wave === 66) {
          for (const pillarState of this.pillars) {
            if (pillarState.intact) {
              this.collapsePillar(pillarState.pillar.key, context, scriptedPillarCollapseRemovalTicks);
            }
          }
        }
        this.wave += 1;
        this.phase = "countdown";
        this.waveSpawnLayout = "";
        this.waveStartPlayerTile = null;
        if (this.wave === 69) {
          this.corpses = [];
          this.zukControlTick = context.tick + 6 - zukIntroStartTickOffset;
          this.nextWaveTick = this.zukControlTick;
          return;
        }
        this.nextWaveTick = context.tick + 6;
      }
    }
  }
  revive(corpse, spawnTile, context) {
    this.corpses = this.corpses.filter((otherCorpse) => otherCorpse !== corpse);
    this.spawnCombatant(
      corpse.species,
      {
        position: [...spawnTile],
        origin: "resurrection",
      },
      context,
    );
  }
  spawnJadHealers(jadId, context) {
    const jad = context.world.getNpc(jadId);
    if (!jad) {
      return [];
    }
    return findJadHealerSpawnTiles(jad, infernoJadWaveConfigs[this.wave === 68 ? 68 : 67].healersPerJad, {
      isOpen: isInfernoTileOpen,
      player: context.world.getPlayer()?.position ?? null,
      decisions: getContextDecisions(context),
      key: {
        site: "inferno.jad_healer.tile",
        tick: context.tick,
        actorId: jadId,
      },
    }).map((healerTile) =>
      this.spawnCombatant(
        "jad_healer",
        {
          position: [...healerTile],
          origin: "healer",
          parentId: jadId,
        },
        context,
      ),
    );
  }
  presentParentHeal(parent, context) {
    if (this.parentHealTick !== context.tick) {
      this.parentHealTick = context.tick;
      this.healedParents.clear();
    }
    if (!this.healedParents.has(parent.id)) {
      this.healedParents.add(parent.id);
      emitInfernoVisual(context.tickEvents, {
        animations: [],
        projectiles: [],
        graphics: [
          {
            spotAnimId: 444,
            target: {
              kind: "actor",
              actorId: parent.id,
              size: parent.size,
              position: [...parent.position],
            },
            height: 256,
            delayCycles: 0,
          },
        ],
      });
    }
  }
};
export { InfernoEncounter };
