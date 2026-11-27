import { zNumber, zObject } from "../../assets/vendor.js";
import { createSeededRandom } from "../../engine/random.js";
import { NpcDefinitionRegistry } from "../shared/npcDefinitions.js";
import { scheduleNpcHitpointRegen } from "../../engine/npcState.js";
import { solArenaBounds, solBasePosition, solPlayerStart, enrageSandDelayTickRange, solBeamPreparedEventType, solHereditActorId, solHereditName, emitColosseumVisual, solMessageColors, isSolArenaTile, grappleWindowTicks } from "./constants.js";
import { buildLightBeamGraphics, beamCrystalEdges, beamCrystalNpcDefinition, getBeamCrystalEdgeTile, getBeamCrystalDirection, LightBeamRuntime } from "./lightBeams.js";
import { solPhases, solDefeatOverheadTexts, getSolPhaseForHp, isSolEnragePhase } from "./phases.js";
import { solHereditAttackStyleKey, buildSolHereditControls } from "./controls.js";
import { buildGroundAttackArea, createSolAttackScheduler, isSolAttackDue, clearSolPendingAttacks, clearSolAttackState } from "./bossAttacks.js";
import { createColosseumActor } from "./actors.js";
import { grappleOverheadTextColor, buildGrappleTauntSegments, buildGrappleTauntMessage, resolveSolGrapple } from "./grapple.js";
import { solNpcDefinition, canSolLaunchAttackFrom, tryLaunchSolAttack } from "./boss.js";
import { warbanderNpcDefinition, beeSwarmNpcDefinition } from "./minions.js";
import { solarflareNpcDefinition } from "./solarflare.js";
import { SolModifierState } from "./modifiers.js";
import { healingTotemNpcDefinition, SolModifierEffects } from "./modifierEffects.js";
import { MoltenSand, buildSandStrikeVisualEvent } from "./moltenSand.js";
var solHereditSeedsSchema = zObject({
  encounterSeed: zNumber().int().min(0).max(4294967295),
}).strict();
// Sol Heredit: the encounter class. The encounter registry (in
// client/assets/rendering.js) constructs it as `new SolHereditEncounter(undefined,
// modifiers)`: no seed, and the modifiers chosen in the menu.
//
// The order of the hooks within one tick (docs/ARCHITECTURE.md, "One tick").
// Sol's own turn is not processNpcTick: it is completeNpcBand.
//   1. executeCommand    the debug commands the interface queued
//   2. resolveHazards    molten sand: strikes ripen, a burning tile hurts
//   3. prepareNpcBand    the beams are cancelled when their toggle is off
//   4. moveNpc           Sol walks, unless a phase change is due; when he is
//                        expected to launch an attack this tick the crystals
//                        are marked as charging. Crystals, orbs, bees and
//                        the warbander move.
//      processNpcTick    only the warbander acts here
//   5. completeNpcBand   in this order: the modifiers' actors; the cleanup
//                        after Sol's death; the entrance lines; a phase
//                        transition starts; due transitions (a sand strike,
//                        a crystal); enrage sand; the light beams; the
//                        grapple resolves; ground and triple hits land
//                        (resolveLocalEffects of solNpcDefinition); the next
//                        attack is launched; a round of beams is prepared
//      (the hits on the player land; the player moves and attacks)
//   6. processPostTick   victory, once the death has played out
function createSolActor(bossSetup) {
  const baseActor = createColosseumActor("sol", bossSetup.id, bossSetup.position);
  baseActor.combat.targetId = bossSetup.targetId;
  scheduleNpcHitpointRegen(baseActor, bossSetup.addedTick);
  return solNpcDefinition.createActor(baseActor, {
    scheduler: createSolAttackScheduler(bossSetup.firstAttackTick),
    grapple: {
      pending: null,
    },
    immobileUntilTick: bossSetup.holdUntilTick,
    grappleReadyTick: 0,
    guaranteedMaxHitUntilTick: null,
    relentless: bossSetup.relentless ?? 0,
  });
}
function consumeSolGuaranteedMaxHit(boss, tick) {
  const bossState = solNpcDefinition.getState(boss);
  if (!boss.alive || !bossState || bossState.guaranteedMaxHitUntilTick === null || tick > bossState.guaranteedMaxHitUntilTick) {
    return false;
  }
  bossState.guaranteedMaxHitUntilTick = null;
  return true;
}
function createBeamCrystalActor(crystalSetup) {
  const crystalTrack = beamCrystalEdges[crystalSetup.index];
  const spawnAlong = crystalSetup.spawnAlong ?? crystalTrack.spawn;
  if (spawnAlong < crystalTrack.from || spawnAlong > crystalTrack.to) {
    throw new RangeError(
      `Crystal ${crystalSetup.index} cannot spawn at ${spawnAlong}, off its ${crystalTrack.edge} edge`,
    );
  }
  return beamCrystalNpcDefinition.createActor(
    {
      ...createColosseumActor("beam_crystal", crystalSetup.id, getBeamCrystalEdgeTile(crystalSetup.index, spawnAlong)),
      spawnTick: crystalSetup.tick,
    },
    {
      index: crystalSetup.index,
      direction: -1,
      firstStepTaken: false,
      nextStepTick: crystalSetup.tick + (spawnAlong === crystalTrack.from ? 4 : 3),
      charging: crystalSetup.charging,
    },
  );
}
var SolHereditEncounter = class {
  kind = "sol_heredit";
  encounterSeed;
  random;
  outcome = {
    phase: "active",
  };
  boss = null;
  definitions = new NpcDefinitionRegistry([
      solNpcDefinition.register({
        arena: solArenaBounds,
      }),
      beamCrystalNpcDefinition.register(undefined),
      solarflareNpcDefinition.register(undefined),
      beeSwarmNpcDefinition.register(undefined),
      warbanderNpcDefinition.register(undefined),
      healingTotemNpcDefinition.register(undefined),
    ]);
  sand = new MoltenSand();
  beams = new LightBeamRuntime();
  phase = 0;
  attacksWereEnabled = true;
  nextEnrageSandTick = null;
  // The tick on which syncBossHp armed the enrage sand, so that
  // enterBossHpPhase on the same tick does not roll its delay again.
  rawEnrageArmTick = null;
  pendingTransitions = [];
  deathCleanupTick = null;
  sandRemovalTick = null;
  modifiers;
  modifierState;
  modifierEffects;
  constructor(encounterSeed = Math.floor(Math.random() * 4294967296), modifiers = {}) {
    this.encounterSeed = solHereditSeedsSchema.parse({
      encounterSeed: encounterSeed,
    }).encounterSeed;
    this.random = createSeededRandom(this.encounterSeed);
    this.modifierState = new SolModifierState(modifiers);
    this.modifiers = this.modifierState.selection;
    this.modifierEffects = new SolModifierEffects(this.modifiers);
  }
  configureRunStart(mechanics) {
    this.modifierState.configureRunStart(mechanics);
    this.attacksWereEnabled = mechanics.solHereditAttacks !== false;
  }
  getDefaultPlayerStart() {
    return [...solPlayerStart];
  }
  getIntroConfig() {
    return null;
  }
  getNpcDefinitions() {
    return this.definitions;
  }
  createNpcs() {
    this.boss = createSolActor({
      id: solHereditActorId,
      position: solBasePosition,
      targetId: "player",
      addedTick: 0,
      firstAttackTick: 5,
      holdUntilTick: 6,
      relentless: this.modifiers.relentless ?? 0,
    });
    return [this.boss];
  }
  getSeeds() {
    return {
      encounterSeed: this.encounterSeed,
    };
  }
  reset(seeds) {
    this.modifierState.reset();
    this.modifierEffects.reset();
    this.encounterSeed = solHereditSeedsSchema.parse(
      seeds ?? {
        encounterSeed: Math.floor(Math.random() * 4294967296),
      },
    ).encounterSeed;
    this.random = createSeededRandom(this.encounterSeed);
    this.outcome = {
      phase: "active",
    };
    this.boss = null;
    this.sand.clear();
    this.beams.reset();
    this.phase = 0;
    this.attacksWereEnabled = true;
    this.nextEnrageSandTick = null;
    this.rawEnrageArmTick = null;
    this.pendingTransitions = [];
    this.deathCleanupTick = null;
    this.sandRemovalTick = null;
  }
  getArenaConfig() {
    const walkableTiles = new Set();
    for (let x = solArenaBounds.minX; x <= solArenaBounds.maxX; x++) {
      for (let y = solArenaBounds.minY; y <= solArenaBounds.maxY; y++) {
        if (isSolArenaTile([x, y], solArenaBounds)) {
          walkableTiles.add(`${x},${y}`);
        }
      }
    }
    return {
      bounds: {
        ...solArenaBounds,
        width: 14,
        height: 14,
      },
      walkableTiles: walkableTiles,
      collisionMap: null,
    };
  }
  getNpcDamageSourceLabel(sourceId) {
    if (sourceId === "sol_quartet_warbander") {
      return "FremennikWarbandAttack";
    } else {
      return "SolHereditAttack";
    }
  }
  getDefaultMechanicsConfig() {
    return buildSolHereditControls().defaultMechanicsConfig;
  }
  getOutcome() {
    return this.outcome;
  }
  // The replay's auto markers (client/replay/markers.js): each phase after the first.
  getAutoMarkers() {
    return this.phase > 0 ? [{ id: `phase ${this.phase + 1}`, label: `phase ${this.phase + 1}` }] : [];
  }
  getEngineRules() {
    return {
      ...this.modifierState.getEngineRules(),
      // `false` refuses the attack; anything else, `null` here, lets the engine
      // go on (it compares with `false`).
      validateAttack: (attackKind, targetId) =>
        !targetId.startsWith("sol_crystal") && !targetId.startsWith("sol_solarflare") && null,
      consumePlayerGuaranteedMaxHit: (encounterContext) =>
        this.boss !== null &&
        consumeSolGuaranteedMaxHit(this.boss, encounterContext.tick),
    };
  }
  acceptsInput(input) {
    return (
      input.kind === "equipmentSlotClick" &&
      this.boss !== null &&
      this.boss.state.grapple.pending !== null
    );
  }
  prepareNpcBand(context, mechanics) {
    if (mechanics.solHereditBeams === false) {
      this.beams.cancelActiveRound(this.getAliveCrystals(context.world));
    }
  }
  moveNpc(npc, context, mechanics) {
    const definitionContext = {
      ...context,
      random: this.random,
    };
    const boss =
      this.boss && context.world.actors.get(this.boss.id) === this.boss
        ? this.boss
        : null;
    if (npc === boss) {
      const phaseChangeDue = getSolPhaseForHp(boss.vitals.hp, boss.vitals.maxHp) > this.phase;
      const crystals = this.getAliveCrystals(context.world);
      if (
        mechanics.solHereditBeams !== false &&
        !phaseChangeDue &&
        this.beams.isReady(crystals, context.tick) &&
        this.isAttackLaunchExpected(boss, context, mechanics)
      ) {
        this.beams.markCrystalsCharging(crystals);
      }
      if (phaseChangeDue) {
        return [];
      } else {
        return this.definitions.move(boss, definitionContext);
      }
    }
    if (beamCrystalNpcDefinition.isActor(npc)) {
      return this.definitions.move(npc, definitionContext);
    } else if (solarflareNpcDefinition.isActor(npc)) {
      if (this.modifierEffects.areOrbsActive(context.tick)) {
        return this.definitions.move(npc, definitionContext);
      } else {
        return [];
      }
    } else if ((beeSwarmNpcDefinition.isActor(npc) || warbanderNpcDefinition.isActor(npc)) && boss?.alive) {
      return this.definitions.move(npc, definitionContext);
    } else {
      return [];
    }
  }
  processNpcTick(npc, context) {
    if (warbanderNpcDefinition.isActor(npc) && this.boss?.alive === true) {
      return this.definitions.tick(npc, {
        ...context,
        random: this.random,
      });
    } else {
      return {
        environmentalDamages: [],
      };
    }
  }
  resolveHazards(context, mechanics) {
    this.modifierState.configureRunStart(mechanics);
    this.modifierEffects.advanceBeeRespawns(context);
    this.sand.advance(context.tick);
    if (
      mechanics.solHereditSand !== false &&
      this.boss?.alive &&
      context.world.actors.get(this.boss.id) === this.boss
    ) {
      return this.sand.resolve(context);
    } else {
      return [];
    }
  }
  completeNpcBand(context, mechanics) {
    const attacksEnabled = mechanics.solHereditAttacks !== false;
    if (this.attacksWereEnabled && !attacksEnabled && this.boss) {
      clearSolPendingAttacks(this.boss);
    }
    this.attacksWereEnabled = attacksEnabled;
    const bossAlive = this.boss?.alive === true;
    const damages = this.modifierEffects.processTick(context, bossAlive, this.random);
    this.modifierEffects.processTotems(context, bossAlive ? this.boss : null);
    const definitionContext = {
      ...context,
      random: this.random,
    };
    if (this.deathCleanupTick !== null && context.tick >= this.deathCleanupTick) {
      this.deathCleanupTick = null;
      for (const crystal of context.world.getNpcs().filter(beamCrystalNpcDefinition.isActor)) {
        context.despawnNpc(crystal.id);
      }
      this.modifierEffects.despawnBeesAndWarbanders(context);
      this.say(context, solDefeatOverheadTexts[this.encounterSeed % solDefeatOverheadTexts.length]);
    }
    if (this.sandRemovalTick !== null && context.tick >= this.sandRemovalTick) {
      this.sandRemovalTick = null;
      this.sand.clear();
    }
    const boss = this.boss;
    if (!boss?.alive || context.world.actors.get(boss.id) !== boss) {
      return damages;
    }
    if (context.tick === 1) {
      context.tickEvents.emit({
        type: "game_message",
        kind: "game",
        segments: solEntranceMessage,
      });
    }
    if (context.tick === 3) {
      this.say(context, "Let's start by testing your footwork.");
    }
    this.startPhaseTransition(context, boss);
    this.resolvePendingTransitions(context, mechanics);
    this.strikeEnrageSand(context, mechanics);
    damages.push(...this.processLightBeams(context, mechanics));
    damages.push(...resolveSolGrapple(boss, context, this.random));
    damages.push(...this.definitions.resolveLocalEffects(boss, definitionContext));
    const attackLaunch = tryLaunchSolAttack(boss, context, {
      phase: this.phase,
      random: this.random,
      enabled: attacksEnabled,
      stylePin: getSolStylePin(mechanics),
    });
    const grappleTarget = boss.state.grapple.pending?.target;
    if (attackLaunch.taunt !== null && grappleTarget) {
      context.tickEvents.emit(this.buildGrappleOverheadTextEvent(grappleTarget));
      context.tickEvents.emit({
        type: "game_message",
        kind: "game",
        segments: buildGrappleTauntMessage(grappleTarget),
      });
    } else if (attackLaunch.taunt !== null) {
      this.say(context, attackLaunch.taunt);
    }
    if (mechanics.solHereditBeams !== false && (attackLaunch.launched || !attacksEnabled)) {
      const fireInTicks = this.beams.prepare(this.getAliveCrystals(context.world), context.tick, isSolEnragePhase(this.phase));
      if (fireInTicks !== null) {
        context.tickEvents.emit({
          type: solBeamPreparedEventType,
          fireInTicks: fireInTicks,
        });
      }
    }
    return damages;
  }
  processPostTick(context) {
    if (
      this.outcome.phase === "resolving" &&
      context.tick >= this.outcome.completionTick &&
      context.world.getPlayer()?.alive
    ) {
      this.outcome = {
        ...this.outcome,
        phase: "victory",
      };
    }
    return [];
  }
  onNpcDefeated(defeat, context, completionOwnership) {
    this.modifierEffects.onNpcDefeated(defeat, context.world);
    if (defeat.npcId === "sol_heredit") {
      if (this.boss) {
        this.modifierEffects.scheduleBossDefeatEffects(defeat.tick, this.boss.position, this.boss.size);
      }
      if (this.boss) {
        clearSolAttackState(this.boss);
      }
      this.beams.reset();
      emitColosseumVisual(context.tickEvents, {
        animations: this.getAliveCrystals(context.world).map((crystal) => ({
          actorId: crystal.id,
          clipId: "despawn",
          delayCycles: 0,
        })),
        graphics: [],
      });
      this.deathCleanupTick = defeat.tick + 1;
      this.sand.cancelPendingStrikes(defeat.tick);
      this.sandRemovalTick = defeat.tick + 2;
      this.nextEnrageSandTick = null;
      this.pendingTransitions = [];
      if (completionOwnership === "encounter-owned") {
        this.outcome = {
          phase: "resolving",
          decisiveTick: defeat.tick,
          completionTick: defeat.tick + 9, // victory 9 ticks after the kill (processPostTick)
          primaryActorId: solHereditActorId,
          completionActorIds: [solHereditActorId],
        };
      }
    }
  }
  // What the scene draws; nothing in this directory reads it. `dangerTiles` is
  // the pending spear or shield as it would land on the player's tile now.
  getSnapshot(request) {
    const bossState = this.boss ? solNpcDefinition.getState(this.boss) : null;
    const pendingGrapple = bossState?.grapple.pending;
    const player = request.world.getPlayer();
    return {
      kind: "sol_heredit",
      state: {
        phase: this.phase,
        modifiers: this.modifiers,
        doomStacks: this.modifierState.doomStacks,
        solarflareTiles: this.modifierEffects
          .orbs(request.world)
          .map((orb) => [...orb.position]),
        beeTiles: this.modifierEffects
          .bees(request.world)
          .map((beeSwarm) => [...beeSwarm.position]),
        dangerTiles:
          bossState?.scheduler.pendingGround && this.boss && player
            ? buildGroundAttackArea(bossState.scheduler.pendingGround, {
                position: this.boss.position,
                target: player.position,
                arena: solArenaBounds,
              }).tiles.map(([x, y]) => [x, y])
            : [],
        beamTiles: this.beams.getBeamTiles().map(([x, y]) => [x, y]),
        beamFiredTiles: this.beams.getFiredBeamTiles(request.tick).map(([x, y]) => [x, y]),
        sandTiles: request.mechanics.solHereditSand === false ? [] : this.sand.getPoolTiles(),
        sandDespawning: this.sandRemovalTick !== null,
        grapple: pendingGrapple
          ? {
              slot: pendingGrapple.target.slot,
              taunt: pendingGrapple.target.taunt,
              resolveTick: pendingGrapple.startTick + grappleWindowTicks,
            }
          : null,
        tripleHitTicks: bossState?.scheduler.pendingTriple.map((tripleHit) => tripleHit.tick) ?? [],
        crystalCount: this.getAliveCrystals(request.world).length,
      },
      visuals: {},
    };
  }
  executeCommand(command, context, mechanics) {
    if (command.encounter === "sol_heredit") {
      if (!this.boss?.alive || context.world.actors.get(this.boss.id) !== this.boss) {
        return {};
      }
      switch (command.type) {
        case "spawn-crystal":
          this.spawnCrystal(context);
          break;
        case "trigger-grapple":
          this.boss.state.scheduler.forcedSpecial = "grapple";
          break;
        case "trigger-triple":
          this.boss.state.scheduler.forcedSpecial = "triple";
          break;
        case "strike-sand": {
          const sandStrike = this.sand.strike(context.playerPos, 6, context.tick, this.random);
          return {
            gameEvents: mechanics.solHereditSand === false ? [] : [buildSandStrikeVisualEvent(sandStrike)],
          };
        }
        case "clear-sand":
          this.sand.clear();
          break;
        default:
          return throwUnknownSolHereditAction(command);
      }
      return {};
    }
  }
  syncBossHp(bossHp, context) {
    if (this.boss) {
      this.phase = getSolPhaseForHp(bossHp, this.boss.vitals.maxHp);
      if (!isSolEnragePhase(this.phase) || bossHp <= 0) {
        this.nextEnrageSandTick = null;
      } else if (this.nextEnrageSandTick === null) {
        this.nextEnrageSandTick = context.world.tick + this.rollEnrageSandDelay();
        this.rawEnrageArmTick = context.world.tick;
        this.beams.capReadyTick(context.world.tick);
      }
    }
  }
  enterBossHpPhase(bossHp, context) {
    if (!this.boss?.alive || bossHp <= 0) {
      return;
    }
    this.phase = getSolPhaseForHp(bossHp, this.boss.vitals.maxHp);
    const boss = this.boss;
    const firstAttackTick = context.tick + 7;
    clearSolAttackState(boss);
    boss.state.scheduler = createSolAttackScheduler(firstAttackTick);
    boss.state.immobileUntilTick = 0;
    this.pendingTransitions = [];
    this.sand.clear();
    for (const crystal of context.world.getNpcs().filter(beamCrystalNpcDefinition.isActor)) {
      context.despawnNpc(crystal.id);
    }
    this.modifierEffects.resetTotems(context);
    this.beams.reset();
    const crystalCount = solPhases
      .slice(0, this.phase)
      .filter((solPhase) => solPhase.addsCrystal).length;
    for (let i = 0; i < crystalCount; i++) {
      this.spawnCrystal(context);
    }
    if (isSolEnragePhase(this.phase)) {
      if (
        this.nextEnrageSandTick === null ||
        this.rawEnrageArmTick !== context.tick
      ) {
        this.nextEnrageSandTick = context.tick + this.rollEnrageSandDelay();
      }
    } else {
      this.nextEnrageSandTick = null;
    }
  }
  say(context, text) {
    context.tickEvents.emit(this.buildOverheadTextEvent(text));
    context.tickEvents.emit({
      type: "game_message",
      kind: "public",
      speaker: solHereditName,
      segments: [
        {
          text: text,
        },
      ],
    });
  }
  buildOverheadTextEvent(overheadText) {
    return {
      type: "overhead_text",
      anchor: {
        kind: "actor",
        actorId: solHereditActorId,
      },
      overheadText: overheadText,
      overheadCycle: 5, // the text stays for 5 ticks
    };
  }
  buildGrappleOverheadTextEvent(grappleTarget) {
    return {
      ...this.buildOverheadTextEvent(grappleTarget.taunt),
      overheadTextColor: grappleOverheadTextColor,
      overheadTextSegments: buildGrappleTauntSegments(grappleTarget),
    };
  }
  startPhaseTransition(context, boss) {
    if (
      getSolPhaseForHp(boss.vitals.hp, boss.vitals.maxHp) <= this.phase ||
      boss.state.grapple.pending !== null ||
      !isSolAttackDue(boss.state.scheduler, context.tick)
    ) {
      return;
    }
    const enteredPhase = solPhases[this.phase];
    // The next phase. The guard above keeps this.phase at 4 or less, so the
    // lookup is this.phase + 1.
    this.phase = [0, 1, 2, 3, 4, 5][this.phase + 1];
    this.say(context, enteredPhase.taunt);
    boss.state.immobileUntilTick = Math.max(boss.state.immobileUntilTick, context.tick + 5);
    boss.state.scheduler.nextAttackTick = context.tick + 7;
    boss.state.scheduler.forceSpearNext = true;
    this.pendingTransitions.push({
      tick: context.tick + 1,
      kind: "sand",
    });
    if (enteredPhase.addsCrystal) {
      this.pendingTransitions.push({
        tick: context.tick + 2,
        kind: "crystal",
      });
    }
    if (isSolEnragePhase(this.phase)) {
      this.nextEnrageSandTick = context.tick + 1 + this.rollEnrageSandDelay();
      this.beams.capReadyTick(context.tick);
    }
  }
  resolvePendingTransitions(context, mechanics) {
    const dueTransitions = this.pendingTransitions.filter((transition) => transition.tick === context.tick);
    this.pendingTransitions = this.pendingTransitions.filter(
      (transition) => transition.tick > context.tick,
    );
    for (const transition of dueTransitions) {
      switch (transition.kind) {
        case "sand":
          this.emitSandStrikeVisual(
            context,
            mechanics,
            this.sand.strike(
              context.playerPos,
              isSolEnragePhase(this.phase) ? 5 : 6,
              context.tick,
              this.random,
            ),
          );
          break;
        case "crystal":
          if (mechanics.solHereditBeams !== false) {
            this.spawnCrystal(context);
          }
          break;
        default:
          throwUnknownSolHereditAction(transition.kind);
      }
    }
  }
  rollEnrageSandDelay() {
    const [minDelay, maxDelay] = enrageSandDelayTickRange;
    return minDelay + Math.floor(this.random() * (maxDelay - minDelay + 1));
  }
  strikeEnrageSand(context, mechanics) {
    if (
      this.nextEnrageSandTick !== null &&
      !(context.tick < this.nextEnrageSandTick)
    ) {
      this.nextEnrageSandTick = context.tick + 3;
      this.emitSandStrikeVisual(
        context,
        mechanics,
        this.sand.strike(context.playerPos, 1, context.tick, this.random, false),
      );
    }
  }
  emitSandStrikeVisual(context, mechanics, sandStrike) {
    if (mechanics.solHereditSand !== false) {
      context.tickEvents.emit(buildSandStrikeVisualEvent(sandStrike));
    }
  }
  getAliveCrystals(world) {
    return world
      .getNpcs()
      .filter(beamCrystalNpcDefinition.isActor)
      .filter((crystal) => crystal.alive)
      .sort((crystal, otherCrystal) => crystal.state.index - otherCrystal.state.index);
  }
  isAttackLaunchExpected(boss, context, mechanics) {
    return mechanics.solHereditAttacks === false || canSolLaunchAttackFrom(boss, context, boss.position);
  }
  processLightBeams(context, mechanics) {
    const crystals = this.getAliveCrystals(context.world);
    if (mechanics.solHereditBeams === false) {
      this.beams.cancelActiveRound(crystals);
      return [];
    }
    const beamDamages = this.beams.resolveBeamHit(context.tick, context.playerPos, {
      random: this.random,
      relentless: this.modifiers.relentless ?? 0,
    });
    const chargingRound = this.beams.startRoundCharge(crystals, context.tick);
    if (chargingRound) {
      emitColosseumVisual(context.tickEvents, {
        animations: chargingRound.lines.map((line) => ({
          actorId: line.actorId,
          clipId: "charge",
          delayCycles: 0,
        })),
        graphics: chargingRound.lines.flatMap((line) => buildLightBeamGraphics(getBeamCrystalDirection(line.index), line.tiles, "charge")),
      });
    }
    const fired = this.beams.fireRound(crystals, {
      tick: context.tick,
      playerPos: context.playerPos,
      phase: this.phase,
      random: this.random,
    });
    if (fired) {
      emitColosseumVisual(context.tickEvents, {
        animations: fired.round.lines.map((line) => ({
          actorId: line.actorId,
          clipId: "attack",
          delayCycles: 0,
        })),
        graphics: fired.round.lines.flatMap((line) =>
          buildLightBeamGraphics(getBeamCrystalDirection(line.index), line.tiles, "fire"),
        ),
      });
    }
    return beamDamages;
  }
  spawnCrystal(context) {
    const existingCrystals = context.world.getNpcs().filter(beamCrystalNpcDefinition.isActor);
    const crystalIndex = [0, 1, 2, 3].find((candidateIndex) => existingCrystals.every((crystal) => crystal.state.index !== candidateIndex));
    if (crystalIndex === undefined) {
      return;
    }
    const spawnedCrystal = createBeamCrystalActor({
      id: `sol_crystal_${crystalIndex}`,
      index: crystalIndex,
      tick: context.tick,
      charging: this.beams.hasActiveRound(),
    });
    this.beams.ensureReadyTick(context.tick);
    context.spawnNpc(spawnedCrystal);
    if (context.tickEvents) {
      emitColosseumVisual(context.tickEvents, {
        animations: [
          {
            actorId: spawnedCrystal.id,
            clipId: "spawn",
            delayCycles: 0,
          },
        ],
        graphics: [],
      });
    }
  }
};
function throwUnknownSolHereditAction(action) {
  throw new TypeError(`Unknown Sol Heredit action: ${JSON.stringify(action)}`);
}
function getSolStylePin(mechanics) {
  const attackStyle = mechanics[solHereditAttackStyleKey];
  if (attackStyle === "spear" || attackStyle === "shield") {
    return attackStyle;
  } else {
    return undefined;
  }
}
var solEntranceMessage = [
  {
    text: `${solHereditName} jumps down from his seat...`,
    color: solMessageColors.red,
  },
];
export { SolHereditEncounter };
