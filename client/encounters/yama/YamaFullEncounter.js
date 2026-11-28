// Yama, the whole fight (kind "yama_full"): he sits on his throne until he is
// challenged, fights phases 1 and 2 in the arena with a visit to his Judge
// after each, and then phase 3, which is YamaEncounter's own.
//
// The numbers, and where each is from, are in fullFightData.js. What is left
// out of the first two phases is said where it would be (search "ponytail").
//
// One tick, before phase 3 (docs/ARCHITECTURE.md, "One tick"):
//   executeCommand   the challenge
//   resolveHazards   everything that was set for this tick (`pending`), the
//                    glyph under the player, streaks, waves, flares, the
//                    Judge and his spells: the damage the player takes
//   moveNpc, processNpcTick
//                    Yama's turn: a slot every 8 ticks
//   processPostTick  the waves' event
import { getMonsterFormulaStats } from "../../engine/monsterStats.js";
import { isArenaTileWalkable } from "../../engine/arena.js";
import { CollisionFlag } from "../../engine/collision.js";
import { getDistanceToFootprint } from "../../engine/attackRange.js";
import { canNpcActAtTick } from "../../engine/npcState.js";
import { createSeededRandom } from "../../engine/random.js";
import { defineNpc } from "../shared/npcDefinitions.js";
import { getBossPursuitMoves } from "../shared/npcRoutes.js";
import { emitColosseumVisual } from "../sol-heredit/constants.js";
import { getYamaWaveTiles } from "./shadowWaves.js";
import { yamaNpcTypeId, yamaSize, mixSeed, getYamaAttackKind, yamaDefeatOverheadTexts } from "./constants.js";
import { yamaBasePosition, isYamaSealedRow } from "./sceneConstants.js";
import { buildYamaControls } from "./controls.js";
import { healNpc, faceActorToward } from "../shared/npcHelpers.js";
import { createYamaAttackPolicyState, getYamaState, buildYamaAttack } from "./boss.js";
import { voidFlareNpcDefinition, destroyVoidFlare, getExplosionHeal } from "./voidFlares.js";
import { YamaEncounter, createYamaActor, isPlayerOnYamaWave, yamaActorId, yamaPursuitMovement } from "./YamaEncounter.js";
import {
  yamaFullKind, npcTypeIds, throneActorId, judgeActorId, meteorActorId, throneTile,
  challengeLine, lineToThroneSeqTicks, lineToArrivalTicks, arrivalToEmptyThroneTicks, arrivalToGlyphsTicks, yamaDeath, fightDuration,
  slotTicks, yamaWalk, autoWindupTicks, earlyAutoDamage, earlyMeleePrayerReduction,
  earlyRangedMagicPrayerReduction, autoPoison, phaseEndHp, p2SpecialLines, glyphSpots, glyphProtectionTicks, glyphRelightTicks, glyphFireDamage, glyphShadowDrain,
  otherElement, elementOfStyle, p1Special, p1Burn, shadowStomp, meteor, meteorDamage, earlyFlares, streaks, streakHit, waves,
  transitionTeleportTicks, glyphFadeTicks, judgeArrivalTile, judgeTile, stoneRows, startPlatform, judgePlatform, fireSpells,
  judgeTiming, judgeFireball, cavernShake, judgeDeath, returnTile, spots, sounds, waveSoundTiles, playerSeqs, stoneJump, landOf, judgeRiseTicks, jumpMove, jumpMoveSteps, streakTiles, isStreakWarning,
  createSlotPlan, nextSlotBlock,
  throneChallengeCycles,
} from "./fullFightData.js";

const never = 1e9;
const north = 1024; // a facing, in 2048ths of a turn from south
const key = ([x, y]) => `${x},${y}`;
const sameTile = (a, b) => a[0] === b[0] && a[1] === b[1];
const fighting = (phase) => phase === "p1" || phase === "p2";

const challengeCommand = { encounter: yamaFullKind, type: "challenge" };
const glyphName = { fire: "Fire", shadow: "Shadow" };
// The game's highlight colours for his fire, his shadow and a warning (the colours of phase 3's glyph note, controls.js).
const glyphColor = { fire: "#dd8d4b", shadow: "#b58cd9" };
const warningColor = "#ff3045";

// The NPCs that only stand or are moved by the encounter.
const propDefinition = defineNpc({ id: "yama-full-prop", move: false });
function propActor({ id, npcTypeId, size, position, tick, hp = 1, extra = {} }) {
  return propDefinition.createActor({
    id, kind: "npc", role: "minion", alive: true, npcTypeId, archetypeId: id, size,
    position: [...position], previousPosition: [...position], facing: 0, history: new Map(), spawnTick: tick,
    vitals: { hp, maxHp: hp }, untargetable: true, blocksNpcMovement: false, passThruNpcs: true,
    combat: { attackSpeed: 0, attackRange: 0, attackStyle: "typeless", nextActionTick: 0, targetId: null, lastAttackTick: null, animations: { idle: null, walk: null, run: null, attack: null, death: null } },
    ...extra,
  }, {});
}

function createFullState(run) {
  const majority = run.openingStyleSeed === "range" ? "shadow" : "fire"; // WIKI: phase 3 opens with the style of the majority
  return {
    phase: "throne", // throne, approach, rising, p1, p1-end, judge1, judge1-end, p2, p2-end, judge2, judge2-end, p3
    tick: 0,
    random: createSeededRandom(mixSeed(run.encounterSeed, 1178944589)),
    majority,
    // relightTick: when a taken glyph is lit again, while the phase lasts
    glyphs: glyphSpots.map((spot) => ({ tile: spot.tile, element: spot.majority ? majority : otherElement(majority), state: "dark", changedTick: 0, relightTick: null })),
    protection: { shadow: 0, fire: 0 }, // the tick each glyph's immunity ends on
    pending: [], // { tick, type, ... }: what resolveHazards does on that tick
    queue: [], // the slots to come: { tick, kind, style? | element? }
    plan: null,
    hazards: 0,
    windup: null,
    pastMark: false, // a slot of this phase saw his hitpoints at or under its mark
    firstSlotTick: 0,
    streaks: [],
    flareImpacts: [],
    rootedUntil: 0,
    playerAnimation: null, // { seqId, tick }: a sequence the scene plays on the player (presentation.js)
    challengeTick: null,
    approachFrom: null, // where the player stood a tick ago on his way to the throne
    clockStartTick: null, // "Fight duration" counts from here
    runWasEnabled: null, // the player's run setting while a special keeps it off, until `runOffUntil`
    runOffUntil: 0,
    lastPlayerStyle: null,
    judge: null,
    judgeRiseUntil: 0, // the player does not move before this tick of a visit (judgeRiseTicks)
    spells: [],
    spellCount: 0,
    fireballs: [],
    flamesLit: false, // the entrance flames (entranceFlames; presentation.js draws them)
    staleTile: null, // the tile clicked before the challenge, while the interface still hands it in
    lastTargetTile: null,
    snapTick: null, // phase 3: when the scene is shown a snap burst's 12144 (processPostTick)
  };
}

export class YamaFullEncounter extends YamaEncounter {
  full;
  // A blast a glyph takes heals him nothing: the flares' definition leaves the heal to stepFlares (voidFlares.js).
  flareHealsOnImpact = true;
  constructor() {
    super();
    this.kind = yamaFullKind;
    // The flares' definition keeps this object: its numbers are those of the
    // phase (voidFlares.js, getExplosionDamageRange).
    this.p3FlareExplosion = this.resolvedConfig.voidFlares.explosionDamage;
    this.flareExplosion = this.resolvedConfig.voidFlares.explosionDamage = structuredClone(earlyFlares.explosion);
    this.p3BeatStartTick = this.resolvedConfig.attackPattern.beatStartTick;
    this.p3SnapFireballBeats = this.resolvedConfig.attackPattern.snapFireballBeats;
    // OBS: no hitpoints bar over a flare, in any phase, also after a hit (its bar is a timer and stays full
    // through hits), and nothing on its tiles; the timer over it stays (rendering.js, UIOverlayRenderer.BL and
    // VoidFlareController).
    const spawnFlareAt = this.voidFlareCoordinator.spawnFlareAt.bind(this.voidFlareCoordinator);
    this.voidFlareCoordinator.spawnFlareAt = (voidFlares, context, spawn) => {
      const event = spawnFlareAt(voidFlares, context, spawn);
      const flare = context.world.getNpc(event.flareId);
      if (flare) {
        delete flare.alwaysShowHealthBar;
        Object.assign(flare, { noHealthBar: true, noTileFill: true });
      }
      return event;
    };
    this.reset();
  }
  reset(seeds) {
    if (this.flareExplosion) Object.assign(this.flareExplosion, structuredClone(earlyFlares.explosion));
    this.flareHealsOnImpact = true;
    // Phase 3's clock starts when phase 3 does (startPhase3); the fireball beats change in its second cycle (processPostTick).
    this.resolvedConfig.attackPattern.beatStartTick = never;
    if (this.p3SnapFireballBeats) this.resolvedConfig.attackPattern.snapFireballBeats = this.p3SnapFireballBeats;
    super.reset(seeds);
    this.full = createFullState(this.state.run);
    this.state.run.waveConfig = { ...this.state.run.waveConfig, startDelay: never };
  }
  getDefaultPlayerStart() {
    return [32, 37];
  }
  getIntroConfig() {
    return null;
  }
  getDefaultMechanicsConfig() {
    return yamaFullControls.defaultMechanicsConfig;
  }
  // The arena of the map without the passage south of the flames, and with
  // the Judge's side: two platforms and the stones between them.
  refineArenaConfig(arena) {
    if (!arena?.walkableTiles) return arena;
    const walkableTiles = new Set([...arena.walkableTiles].filter((tile) => !isYamaSealedRow(Number(tile.slice(tile.indexOf(",") + 1)))));
    // The platforms are the tiles of their squares that the map leaves open (a cross and a diamond).
    const open = (x, y) => !arena.collisionMap || !arena.collisionMap.hasFlag(x, y, CollisionFlag.FLOOR_BLOCKED | CollisionFlag.OBJECT);
    for (const rect of [startPlatform, judgePlatform])
      for (let x = rect.minX; x <= rect.maxX; x++) for (let y = rect.minY; y <= rect.maxY; y++) if (open(x, y)) walkableTiles.add(key([x, y]));
    for (const row of stoneRows) for (const x of row.xs) walkableTiles.add(key([x, row.y]));
    if (!arena.bounds) return { ...arena, walkableTiles };
    // The player's steps are kept within the bounds. The waves are not drawn or dealt by them: their diamond
    // (shadowWaves.js) is the arena's.
    const bounds = { ...arena.bounds, minX: Math.min(arena.bounds.minX, judgePlatform.minX), maxY: Math.max(arena.bounds.maxY, judgePlatform.maxY) };
    return { ...arena, walkableTiles, bounds: { ...bounds, width: bounds.maxX - bounds.minX + 1, height: bounds.maxY - bounds.minY + 1 } };
  }
  createNpcs() {
    this.yamaActor = null;
    return [propActor({ id: throneActorId, npcTypeId: npcTypeIds.throneYama, size: 1, position: throneTile, tick: 0, extra: { hoverShowsOption: true, untargetable: false } })]; // he can be clicked; his cache type has no "Attack"
  }
  npcDefinitionEntries() {
    return [...super.npcDefinitionEntries(), propDefinition.register({})];
  }
  getEngineRules() {
    return {
      // WIKI: the Judge prays against two styles: ranged always, and melee until a magic hit, then magic until a melee one.
      isPlayerAttackProtected: (style, target) =>
        target.id === judgeActorId && (style === "range" || style === (this.full.judge?.magicProtection ? "magic" : "melee")),
      // inferred: he cannot die before phase 3. OBS: 7 of 7 kills went through every phase; the wiki's "not a
      // hard cap" lets him go below a phase's mark before it ends, not skip it. Every hit of the player's on him
      // comes here: his own, his thrall's, a recoil, a poison or burn he set.
      playerDamageOnNpc: (damage, { target }) => (target.id === yamaActorId && this.full.phase !== "p3" ? Math.min(damage, target.vitals.hp - 1) : damage),
      // The same at launch, which the experience and the XP drop are given from (as the Alchemical Hydra's shield).
      predictPlayerDamageOnNpc: (damage, { target }) => (target.id === yamaActorId && this.full.phase !== "p3" ? Math.min(damage, Math.max(0, target.vitals.hp - 1)) : damage),
    };
  }
  glyphActive(element, tick) {
    return element !== null && tick < this.full.protection[element];
  }
  // The poison of a magic or ranged auto, in every phase (buildYamaAttack; phase 3's through YamaEncounter).
  autoPoison() {
    return this.full.random() < autoPoison.chance ? autoPoison.severity : undefined;
  }
  schedule(tick, effect) {
    this.full.pending.push({ tick, ...effect });
  }
  // A line of the chat box, in the game's colours (OBS: its text); no colour is the plain one.
  say(context, text, color, kind = "game") {
    context.tickEvents.emit({ type: "game_message", kind, segments: [color ? { text, color } : { text }] });
  }
  overhead(context, actorId, overheadText, overheadCycle = 5) {
    context.tickEvents.emit({ type: "overhead_text", anchor: { kind: "actor", actorId }, overheadText, overheadCycle });
  }
  // A glyph takes a hit: the game's line, and its shield of 0 on the player (OBS: hitsplat type 44; the
  // interface draws "absorb", rendering.js).
  absorb(context, element) {
    this.say(context, `The Glyph of ${glyphName[element]} absorbs the damage from the attack.`, glyphColor[element], "spam");
    context.tickEvents.emit({ type: "hitsplat_spawned", targetId: "player", amount: 0, hitsplatType: "absorb" });
  }
  // Running is off until `untilTick` (a meteor, a stomp), then as the player had it.
  holdRun(player, untilTick) {
    const f = this.full;
    if (f.runWasEnabled === null) f.runWasEnabled = player.isRunEnabled;
    player.isRunEnabled = false;
    f.runOffUntil = Math.max(f.runOffUntil, untilTick);
  }
  visual(context, { animations = [], graphics = [], projectiles = [], sounds: heard }) {
    emitColosseumVisual(context.tickEvents, { animations, graphics, projectiles, ...(heard ? { sounds: heard } : {}) });
  }
  // Sounds with nothing to see: visual() drops an event without an animation, a graphic or a projectile.
  hear(context, heard) {
    context.tickEvents.emit({ type: "colosseum_visual", animations: [], graphics: [], projectiles: [], sounds: structuredClone(heard) });
  }

  // --- The challenge ---------------------------------------------------------
  // A click on "Challenge" (Grid.js asks acceptsInput, then sends the option
  // as a command); the debug action sends the same.
  acceptsInput(input) {
    return input.kind === "npcOption" && input.actorId === throneActorId && input.option === "Challenge" && this.full.phase === "throne";
  }
  executeCommand(command, context) {
    if (command.encounter !== yamaFullKind) return undefined;
    const challenge = command.type === "challenge" || (command.type === "npc-option" && command.actorId === throneActorId && command.option === "Challenge");
    const player = context.world.getPlayer();
    if (!challenge || this.full.phase !== "throne" || !player?.alive) return undefined;
    // As with any NPC, the player goes up to him first: the throne is his target to walk to, not to attack (as
    // Zebak's jugs are, toa/zebak/phases.js), and the challenge is made where he can get no nearer (stepChallenge).
    this.full.phase = "approach";
    this.full.challengeTick = context.tick;
    this.full.approachFrom = null;
    player.attackTarget = throneActorId;
    player.attackInteractionActive = false;
    player.manualCastSpell = null;
    return { gameEvents: [] };
  }
  approachRange(targetId) {
    return targetId === throneActorId ? 1 : undefined;
  }
  stepChallenge(context) {
    const f = this.full;
    if (f.phase !== "approach") return;
    const player = context.world.getPlayer();
    // He is there on the tick after he can get no nearer: no open tile next to him is nearer the throne.
    const [x, y] = player.position;
    const fromThrone = (tx, ty) => Math.max(Math.abs(tx - throneTile[0]), Math.abs(ty - throneTile[1]));
    let nearest = true;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (isArenaTileWalkable(x + dx, y + dy) && fromThrone(x + dx, y + dy) < fromThrone(x, y)) nearest = false;
    // A click elsewhere calls it off.
    if (player.attackTarget !== throneActorId) {
      f.phase = "throne";
    } else if (context.tick > f.challengeTick && (nearest || (f.approachFrom && sameTile(f.approachFrom, player.position)))) {
      player.attackTarget = null;
      // He stays where he is: the interface still hands in the tile clicked before (moveDisplacedPlayer).
      f.staleTile = f.lastTargetTile;
      f.phase = "rising";
      this.overhead(context, throneActorId, challengeLine);
      this.schedule(context.tick + lineToThroneSeqTicks, { type: "throneSeq" });
      this.schedule(context.tick + lineToArrivalTicks, { type: "arrive" });
    } else f.approachFrom = [...player.position];
  }
  arrive(context) {
    const tick = context.tick;
    this.schedule(tick + arrivalToEmptyThroneTicks, { type: "emptyThrone" });
    const boss = createYamaActor({
      position: [...yamaBasePosition],
      hp: this.resolvedConfig.boss.maxHp,
      maxHp: this.resolvedConfig.boss.maxHp,
      openingStyle: this.state.run.openingStyleSeed,
      attackPattern: this.resolvedConfig.attackPattern,
      defenceDrainFloor: 145,
    });
    boss.formulaStats = { ...getMonsterFormulaStats(yamaNpcTypeId, "Normal"), demonbaneVulnerability: 1.2 };
    this.yamaActor = boss;
    context.spawnNpc(boss);
    this.visual(context, {
      animations: [{ actorId: yamaActorId, clipId: "arrive", delayCycles: 0 }],
      graphics: [{ spotAnimId: spots.yamaArrive, actorId: yamaActorId, delayCycles: 0 }],
      sounds: sounds.arrive,
    });
    this.schedule(tick + arrivalToGlyphsTicks, { type: "glyphsLight" });
    this.beginPhase("p1", tick + slotTicks);
  }

  // --- Slots -----------------------------------------------------------------
  beginPhase(phase, firstSlotTick) {
    const f = this.full;
    f.phase = phase;
    f.plan = createSlotPlan(f.majority, f.random);
    f.queue = [{ tick: firstSlotTick, ...f.plan.opening }];
    f.hazards = 0;
    f.windup = null;
    f.pastMark = false;
    f.firstSlotTick = firstSlotTick;
    f.lastPlayerStyle = null; // he comes to melee until the player attacks him from afar (yamaWalk)
    this.refillQueue();
  }
  refillQueue() {
    const f = this.full;
    while (f.queue.length < 4) {
      const start = f.queue[f.queue.length - 1].tick + slotTicks;
      const first = f.plan.blocks === 0;
      nextSlotBlock(f.plan).forEach((slot, index) => f.queue.push({ ...slot, tick: start + index * slotTicks }));
      if (!first) this.scheduleHazard(start);
    }
  }
  scheduleHazard(slotTick) {
    const f = this.full;
    const fire = (f.hazards++ % 2 === 0) === (f.majority === "shadow");
    if (!fire) {
      this.schedule(slotTick - waves.leadTicks, { type: "waves" });
      return;
    }
    this.schedule(slotTick - streaks.leadTicks, { type: "streaks" });
    if (f.phase === "p2") this.schedule(slotTick - streaks.leadTicks + streaks.secondBatchTicks, { type: "streaks" });
  }
  moveNpc(npc, context, mechanics) {
    const f = this.full;
    if (f.phase === "p3") return super.moveNpc(npc, context, mechanics);
    const tick = context.tick;
    // A fire spell walks a tile south a tick, drawn smoothly (fireSpells); it is gone before it would leave y 22.
    const spell = f.spells.find((candidate) => candidate.id === npc.id);
    if (spell) return tick - spell.spawnTick >= fireSpells.waitTicks ? [{ npcId: npc.id, path: [[npc.position[0], npc.position[1] - 1]] }] : [];
    if (npc.id !== yamaActorId || !fighting(f.phase) || f.windup || !canNpcActAtTick(npc, tick)) return [];
    // He comes to melee a player who has not attacked him this phase or last attacked him with melee, and walks
    // towards one too far off (yamaWalk).
    const far = getDistanceToFootprint(context.playerPos[0], context.playerPos[1], npc.position[0], npc.position[1], yamaSize) > yamaWalk.keepWithinTiles;
    if (!far && f.lastPlayerStyle !== null && f.lastPlayerStyle !== "melee") return [];
    return getBossPursuitMoves(npc, context.playerPos, this.state.run.pursuitRng, yamaPursuitMovement);
  }
  onPlayerAttackStarted(attack, context) {
    const f = this.full;
    if (attack.targetId === yamaActorId) f.lastPlayerStyle = attack.attackType;
    // OBS: the Judge's prayers change as the attack starts; the attack was judged unprotected before this
    // (playerAttack/launch.js), so it still lands.
    if (!f.judge || attack.targetId !== judgeActorId || (attack.attackType !== "magic" && attack.attackType !== "melee")) return;
    f.judge.magicProtection = attack.attackType === "magic";
    const actor = context.world.getNpc(judgeActorId);
    if (actor) actor.overheadPrayers = ["range", f.judge.magicProtection ? "magic" : "melee"];
  }
  processNpcTick(npc, context, mechanics) {
    if (this.full.phase === "p3") return super.processNpcTick(npc, context, mechanics);
    if (npc.id !== yamaActorId || this.state.lifecycle.defeated) return { environmentalDamages: [] };
    return { environmentalDamages: [], npcAttacks: this.takeTurn(npc, context, mechanics) };
  }
  takeTurn(boss, context, mechanics) {
    const f = this.full;
    const tick = context.tick;
    const state = getYamaState(boss);
    // What the scene animates him by (rendering.js reads the snapshot).
    state.latestAttackKind = null;
    state.latestAttackTick = null;
    const player = context.world.getPlayer();
    if (!boss.alive || !player?.alive) return [];
    const attacks = [];
    const attackEnvironment = {
      world: context.world,
      config: {
        meleeDamage: earlyAutoDamage, rangedMagicDamage: earlyAutoDamage, meleePrayerReduction: earlyMeleePrayerReduction,
        rangedMagicPrayerReduction: earlyRangedMagicPrayerReduction, wretchedStrength: false, accuracyRandom: this.state.run.accuracyRng,
        autoPoison: () => this.autoPoison(),
      },
    };
    if (f.windup && tick >= f.windup.releaseTick) {
      // WIKI: a glyph also takes the attacks of its element.
      const element = elementOfStyle(f.windup.style);
      if (this.glyphActive(element, tick)) this.absorb(context, element);
      else attacks.push(buildYamaAttack(boss, f.windup, attackEnvironment));
      f.windup = null;
    }
    const slot = fighting(f.phase) && f.queue[0]?.tick <= tick ? f.queue.shift() : null;
    if (!slot) return attacks;
    // OBS: the slot that sees the mark is an ordinary one; he goes on the next (phaseEndHp).
    if (f.pastMark) {
      this.beginTransition(boss, context);
      return attacks;
    }
    f.pastMark = boss.vitals.hp <= phaseEndHp(boss.vitals.maxHp)[f.phase];
    this.refillQueue();
    const play = (clipId, spotAnimId, heard) => this.visual(context, {
      animations: [{ actorId: yamaActorId, clipId, delayCycles: 0 }],
      graphics: [{ spotAnimId, actorId: yamaActorId, delayCycles: 0 }],
      sounds: heard,
    });
    if (slot.kind === "auto") {
      const adjacent = getDistanceToFootprint(player.position[0], player.position[1], boss.position[0], boss.position[1], yamaSize) <= 1;
      if (adjacent && mechanics.yamaMelee) {
        state.latestAttackKind = "melee_crush";
        state.latestAttackTick = tick;
        attacks.push(buildYamaAttack(boss, { style: "melee", attackKind: "melee_crush" }, attackEnvironment));
      } else if (mechanics.yamaMageRange) {
        const attackKind = getYamaAttackKind(slot.style);
        state.latestAttackKind = attackKind;
        state.latestAttackTick = tick;
        f.windup = { style: slot.style, attackKind, releaseTick: tick + autoWindupTicks };
        boss.combat.lastAttackTick = tick;
        context.tickEvents.emit({ type: "attack_started", sourceId: boss.id, targetId: "player", style: slot.style, attackKind, impactDelayTicks: autoWindupTicks });
      }
    } else if (slot.kind === "flares") {
      if (mechanics.voidFlares) {
        state.latestAttackKind = "fireball"; // the snap of his fingers, as on a fireball beat of phase 3
        state.latestAttackTick = tick;
        this.hear(context, sounds.snap);
        this.schedule(tick + earlyFlares.spawnTicks, { type: "flares" });
      }
    } else if (mechanics.yamaSpecials) {
      const shadow = slot.element === "shadow";
      if (f.phase === "p1") {
        play("p1special", shadow ? spots.p1ShadowCast : spots.p1FireCast, shadow ? sounds.p1Shadow : sounds.p1Fire);
        this.say(context, shadow ? "Yama launches a shadow-based attack at you." : "Yama conjures a fire-based attack at you.", glyphColor[slot.element]);
        this.schedule(tick + p1Special.projectileTicks, { type: "p1projectile", element: slot.element });
        this.schedule(tick + p1Special.impactTicks, { type: "p1impact", element: slot.element });
      } else if (shadow) {
        this.overhead(context, yamaActorId, p2SpecialLines.shadow[Math.floor(f.random() * 3)]);
        play("p2special", spots.stompCast, sounds.stomp);
        this.schedule(tick + shadowStomp.projectileTicks, { type: "stompProjectile" });
        this.schedule(tick + shadowStomp.impactTicks, { type: "stompImpact" });
      } else {
        this.overhead(context, yamaActorId, p2SpecialLines.fire[Math.floor(f.random() * 3)]);
        play("p2special", spots.meteorCast, sounds.meteor);
        this.schedule(tick + meteor.markTicks, { type: "meteorMark" });
      }
    }
    return attacks;
  }

  // --- What was set for a tick -------------------------------------------------
  resolveHazards(context, mechanics) {
    const f = this.full;
    // After his death only the throne's effects are left (onNpcDefeated).
    if (this.state.lifecycle.defeated) {
      this.runPending(context, mechanics, []);
      return [];
    }
    // OBS (solo 1, 339): the game's line a tick after the hit that poisons; the engine posts none.
    const poison = context.world.getPlayer()?.poisonState;
    if (poison?.poisonVarp > 0 && poison.startedTick === context.tick - 1) this.say(context, "You have been poisoned!");
    if (f.phase === "p3") return super.resolveHazards(context, mechanics);
    f.tick = context.tick;
    const damages = [];
    if (f.runWasEnabled !== null && context.tick >= f.runOffUntil) this.restoreRun(context.world.getPlayer());
    this.stepChallenge(context);
    // The glyph under the player first: it takes what lands on this same tick.
    this.stepGlyphs(context, damages);
    this.runPending(context, mechanics, damages);
    if (f.phase === "p3") return damages;
    this.stepStreaks(context, damages);
    const [x, y] = context.playerPos;
    if (mechanics.waves && isPlayerOnYamaWave(x, y, context.tick, this.state.run.waveConfig)) this.waveHit(context, damages);
    this.stepFlares(context, damages);
    this.stepJudge(context, damages);
    return damages;
  }
  runPending(context, mechanics, damages) {
    const f = this.full;
    for (let index = 0; index < f.pending.length; ) {
      if (f.pending[index].tick > context.tick) index++;
      else this.runEffect(f.pending.splice(index, 1)[0], context, mechanics, damages);
    }
  }
  // A wave touches the player, in every phase (YamaEncounter.resolveHazards in phase 3). OBS: a Glyph of Shadow
  // takes it; otherwise it turns his protection prayers off for a while (waves), and the offensive ones stay.
  // Nothing happens to a player who sinks out of the arena.
  waveHit(context, damages) {
    const f = this.full;
    if (f.phase.endsWith("-end")) return;
    if (this.glyphActive("shadow", context.tick)) return this.absorb(context, "shadow");
    this.say(context, "You've been injured and can't use protection prayers!", warningColor);
    damages.push({ baseDamage: this.resolvedConfig.waves.damage, attackType: "typeless", source: "Waves", disablesProtectionPrayersForTicks: waves.prayerLockTicks });
  }
  runEffect(effect, context, mechanics, damages) {
    const f = this.full;
    const tick = context.tick;
    const player = context.world.getPlayer();
    const boss = context.world.getNpc(yamaActorId);
    const onPlayer = (spotAnimId, extra = {}) => this.visual(context, { graphics: [{ spotAnimId, actorId: "player", delayCycles: 0, ...extra }] });
    const fromYama = (spotAnimId, endDelayCycles, flight) => boss && this.visual(context, {
      projectiles: [{
        spotAnimId, sourcePosition: [boss.position[0] + 2, boss.position[1] + 2],
        target: { kind: "actor", actorId: "player", size: 1, position: [...player.position] }, startDelayCycles: 0, endDelayCycles, ...flight,
      }],
    });
    switch (effect.type) {
      case "throneSeq":
        f.flamesLit = true;
        return this.visual(context, {
          animations: [{ actorId: throneActorId, clipId: "challenge", delayCycles: 0, durationCycles: throneChallengeCycles }],
          graphics: [{ spotAnimId: spots.throneChallenge, actorId: throneActorId, delayCycles: 0 }],
          sounds: sounds.challenge,
        });
      case "arrive":
        return this.arrive(context);
      case "emptyThrone": {
        // OBS: the same NPC turns into the empty throne while its sequence goes on (presentation.js draws it again
        // and carries the sequence over to the new model, from the frame it was on).
        const throne = context.world.getNpc(throneActorId);
        if (throne) Object.assign(throne, { npcTypeId: npcTypeIds.throne, untargetable: true, hoverShowsOption: false });
        f.clockStartTick = tick;
        return;
      }
      case "throneBack": {
        const throne = context.world.getNpc(throneActorId);
        if (throne) throne.npcTypeId = npcTypeIds.throneYama;
        this.visual(context, {
          animations: [{ actorId: throneActorId, clipId: "back", delayCycles: 0 }],
          graphics: [{ spotAnimId: spots.throneBack, actorId: throneActorId, delayCycles: 0 }],
        });
        this.say(context, `Fight duration: ${fightDuration(tick - f.clockStartTick)}.`);
        return;
      }
      case "defeatLine":
        // OBS: 9 ticks after his death (yamaDeath).
        if (context.world.getNpc(throneActorId)) this.overhead(context, throneActorId, yamaDefeatOverheadTexts[Math.floor(f.random() * yamaDefeatOverheadTexts.length)], 7);
        return;
      case "glyphsLight":
        for (const glyph of f.glyphs) Object.assign(glyph, { state: "lit", changedTick: tick, relightTick: null });
        return;
      case "playerAnimation":
        f.playerAnimation = { seqId: effect.seqId, tick };
        return;
      case "glyphsFade": {
        const lit = f.glyphs.filter((glyph) => glyph.state === "lit");
        for (const glyph of lit) Object.assign(glyph, { state: "fade", changedTick: tick });
        return; // OBS: silent
      }
      case "streaks":
        if (mechanics.fireStreaks) this.lightStreaks(tick);
        return;
      case "waves": {
        // One wave in phase 1, two in phase 2, each from one side (shadowWaves.js).
        const first = f.random() < 0.5 ? "L" : "R";
        const lines = f.phase.startsWith("p2") ? [first, first === "L" ? "R" : "L"] : [first];
        const deltas = lines.map((line, index) => index * waves.secondWaveTicks);
        this.state.run.waveConfig = { ...this.state.run.waveConfig, periodTicks: never, deltas, firstCycleDeltas: deltas, lines, startDelay: tick + 1, randomOffsets: false };
        return;
      }
      case "p1projectile":
        // OBS: 115 cycles, from 2000 high.
        return fromYama(effect.element === "shadow" ? spots.p1ShadowProjectile : spots.p1FireProjectile, 115, { slope: 60, startOffset: 100, startHeight: 2000, endHeight: 0 });
      case "p1impact":
        // OBS: its spot on the player whether it lands or a glyph takes it (solo 1: 3255 on 25, 3258 on 63).
        onPlayer(effect.element === "shadow" ? spots.p1ShadowImpact : spots.p1FireImpact);
        if (this.glyphActive(effect.element, tick)) return this.absorb(context, effect.element);
        damages.push({ baseDamage: p1Special.damage, attackType: "typeless", source: effect.element === "shadow" ? "Yama's shadow" : "Yama's fire" });
        if (effect.element === "shadow") player.prayerState.points = Math.max(0, player.prayerState.points - p1Special.shadowPrayerDrain);
        else this.schedule(tick + p1Burn.delayTicks, { type: "burn", left: p1Burn.hits });
        return;
      case "burn":
        // A transition drops what is left of it (beginTransition).
        if (effect.left === p1Burn.hits) {
          this.say(context, "You have been set alight!", glyphColor.fire);
          this.hear(context, sounds.setAlight);
        }
        damages.push({ baseDamage: p1Burn.damage, attackType: "typeless", source: "Burn", hitsplatType: "burn", noBlockAnimation: true }); // OBS: solo 1, 256, 260, 264: no block
        if (effect.left > 1) this.schedule(tick + p1Burn.intervalTicks, { type: "burn", left: effect.left - 1 });
        return;
      case "stompProjectile":
        this.say(context, "Yama conjures a shadow-based attack at you.", glyphColor.shadow); // OBS: 2 ticks after the slot
        return fromYama(spots.stompProjectile, 90, { slope: 127, startOffset: 150, startHeight: 10, endHeight: 10 }); // OBS
      case "stompImpact":
        onPlayer(spots.stompImpact); // OBS: landing or taken by a glyph (solo 1: 380, 476)
        if (this.glyphActive("shadow", tick)) return this.absorb(context, "shadow");
        this.hear(context, sounds.bound);
        this.say(context, "Yama briefly binds you!");
        damages.push({ baseDamage: shadowStomp.damage, attackType: "typeless", source: "Shadow Stomp", noBlockAnimation: true }); // OBS: solo 1, 476: no block (one sample)
        f.rootedUntil = tick + shadowStomp.rootTicks;
        this.holdRun(player, tick + shadowStomp.runOffTicks);
        player.prayerState.points = Math.max(0, player.prayerState.points - shadowStomp.prayerDrain);
        return;
      case "meteorMark": {
        this.say(context, "Yama conjures a fire-based attack at you.", glyphColor.fire);
        const centre = [...player.position];
        context.spawnNpc(propActor({ id: meteorActorId, npcTypeId: npcTypeIds.meteor, size: 7, position: [centre[0] - 3, centre[1] - 3], tick }));
        this.visual(context, { graphics: [{ spotAnimId: spots.meteorFall, actorId: meteorActorId, delayCycles: 0 }] });
        // WIKI: the target cannot run until it lands.
        const slotTick = tick - meteor.markTicks;
        this.holdRun(player, slotTick + meteor.impactTicks);
        this.schedule(slotTick + meteor.impactTicks, { type: "meteorImpact", centre });
        this.schedule(slotTick + meteor.goneTicks, { type: "meteorGone" });
        return;
      }
      case "meteorImpact": {
        if (this.glyphActive("fire", tick)) return this.absorb(context, "fire");
        const distance = Math.max(Math.abs(player.position[0] - effect.centre[0]), Math.abs(player.position[1] - effect.centre[1]));
        const damage = meteorDamage(distance);
        if (damage !== 0) damages.push({ baseDamage: damage, attackType: "typeless", source: "Meteor Strike" }); // ponytail: no burn (WIKI: 8)
        return;
      }
      case "meteorGone":
        if (context.world.getNpc(meteorActorId)) context.despawnNpc(meteorActorId);
        return;
      case "flares":
        return this.spawnFlares(context);
      case "teleportJudge":
        return this.arriveAtJudge(context);
      case "shake":
        damages.push({ baseDamage: cavernShake.damage, attackType: "typeless", source: "Cavern", noBlockAnimation: true }); // OBS: no block, 8 of 8 in the two solo kills
        return;
      case "judgeGone":
        for (const id of [judgeActorId, ...f.spells.map((spell) => spell.id)]) if (context.world.getNpc(id)) context.despawnNpc(id);
        f.spells = [];
        f.fireballs = [];
        // WIKI, OBS: he stands in the middle of the arena again.
        if (boss) {
          boss.position = [...yamaBasePosition];
          boss.previousPosition = [...yamaBasePosition];
        }
        return;
      case "return":
        return this.returnToArena(context);
    }
  }
  restoreRun(player) {
    const f = this.full;
    if (f.runWasEnabled !== null && player) player.isRunEnabled = f.runWasEnabled;
    f.runWasEnabled = null;
    f.runOffUntil = 0;
  }

  // --- Glyphs ----------------------------------------------------------------
  // A lit glyph is taken by standing on its centre, and lit again 96 ticks later while the phase lasts.
  stepGlyphs(context, damages) {
    const f = this.full;
    const tick = context.tick;
    const player = context.world.getPlayer();
    const boss = context.world.getNpc(yamaActorId);
    for (const element of ["shadow", "fire"])
      if (f.protection[element] === tick) {
        this.say(context, `The Glyph of ${glyphName[element]} fades away.`, warningColor, "spam");
        this.hear(context, sounds.glyphEnds);
      }
    for (const glyph of f.glyphs) {
      if (glyph.state === "fade" && tick > glyph.changedTick) Object.assign(glyph, { state: "dark", changedTick: tick });
      if (glyph.state === "dark" && glyph.relightTick !== null && tick >= glyph.relightTick) Object.assign(glyph, { state: "lit", changedTick: tick, relightTick: null });
      if (glyph.state !== "lit" || !player?.alive || !boss || !sameTile(player.position, [glyph.tile[0] + 1, glyph.tile[1] + 1])) continue;
      Object.assign(glyph, { state: "fade", changedTick: tick, relightTick: tick + glyphRelightTicks });
      f.protection[glyph.element] = tick + glyphProtectionTicks;
      this.say(context, `You absorb a Glyph of ${glyphName[glyph.element]}.`, glyphColor[glyph.element], "spam");
      const distance = getDistanceToFootprint(player.position[0], player.position[1], boss.position[0], boss.position[1], yamaSize);
      if (glyph.element === "fire") damages.push({ baseDamage: glyphFireDamage(distance), attackType: "typeless", source: "Glyph of Fire" });
      else player.prayerState.points = Math.max(0, player.prayerState.points - glyphShadowDrain(distance));
      this.visual(context, { graphics: [{ spotAnimId: glyph.element === "fire" ? spots.glyphFire : spots.glyphShadow, actorId: "player", delayCycles: 0 }], sounds: sounds.glyphTaken });
    }
  }

  // --- Fire streaks ------------------------------------------------------------
  lightStreaks(tick) {
    const f = this.full;
    const rows = [];
    for (let y = streaks.rows[0]; y <= streaks.rows[1]; y++) {
      let minX = null;
      let maxX = null;
      for (let x = 14; x <= 50; x++) {
        if (!isArenaTileWalkable(x, y)) continue;
        minX ??= x;
        maxX = x;
      }
      if (minX !== null && maxX > minX) rows.push({ y, minX, maxX });
    }
    // A seeded draw of `count` rows.
    const draw = (count) => {
      const left = [...rows];
      const drawn = [];
      while (drawn.length < count && left.length > 0) drawn.push(left.splice(Math.floor(f.random() * left.length), 1)[0]);
      return drawn;
    };
    // One streak a row, from a side drawn for it.
    const [least, most] = streaks.count[f.phase.slice(0, 2)];
    for (const row of draw(least + Math.floor(f.random() * (most - least + 1)))) {
      const west = f.random() < 0.5;
      f.streaks.push({ startTick: tick, y: row.y, from: west ? row.minX : row.maxX, to: west ? row.maxX : row.minX });
    }
  }
  stepStreaks(context, damages) {
    const f = this.full;
    const tick = context.tick;
    const graphics = [];
    let hit = false;
    f.streaks = f.streaks.filter((streak) => {
      const tiles = streakTiles(streak, tick);
      // OBS: the graphic of a tile, half a tick after the one before it; the first step's single tile a tick in (streaks).
      const firstStep = tick - streak.startTick === streaks.warningTicks;
      tiles.forEach((position, index) => graphics.push({ spotAnimId: spots.streak, position, delayCycles: firstStep ? 30 : 15 * (index + 1) }));
      if (!isStreakWarning(streak, tick) && tiles.some((tile) => sameTile(tile, context.playerPos))) hit = true;
      return tiles.length > 0;
    });
    const moving = f.streaks.some((streak) => !isStreakWarning(streak, tick));
    this.visual(context, { graphics, sounds: moving ? sounds.streak : undefined });
    // OBS: a Glyph of Fire takes it (duo 191, 1591).
    if (hit && f.phase.endsWith("-end")) return; // nothing happens to a player who sinks out of the arena
    if (hit && this.glyphActive("fire", tick)) this.absorb(context, "fire");
    else if (hit && tick >= f.rootedUntil) {
      damages.push({ baseDamage: streakHit.damage, attackType: "typeless", source: "Fire streak" });
      f.rootedUntil = tick + streakHit.rootTicks;
    }
  }

  // --- Void flares -------------------------------------------------------------
  // One of shadow and one of fire; a glyph of its element takes a flare's blast.
  spawnFlares(context) {
    const f = this.full;
    const tick = context.tick;
    // One tile of each pair (earlyFlares), and which element gets which drawn too.
    const tiles = earlyFlares.tilePairs.map((pair) => {
      const open = pair.filter((tile) => !sameTile(tile, context.playerPos));
      return open[Math.floor(f.random() * open.length)];
    });
    if (f.random() < 0.5) tiles.reverse();
    for (const variant of ["shadow", "fire"]) {
      const position = tiles.shift();
      const event = this.voidFlareCoordinator.spawnFlareAt(this.state.voidFlares, context, { position: [...position], hp: earlyFlares.hp, variant });
      context.tickEvents.emit(event);
      const flare = context.world.getNpc(event.flareId);
      // It goes off `chargeTicks` after it appears and its blast lands a tick later (voidFlares.js); the timer
      // over it ends `despawnTimerLeadTicks` before `despawnTick`, the blast.
      const explodeTick = tick + earlyFlares.chargeTicks;
      flare.despawnTick = explodeTick;
      flare.despawnTimerLeadTicks = earlyFlares.timerLeadTicks;
      voidFlareNpcDefinition.getState(flare).explodeTick = explodeTick;
    }
  }
  stepFlares(context, damages) {
    const f = this.full;
    const tick = context.tick;
    const player = context.world.getPlayer();
    if (!player?.alive) return;
    const exploding = [];
    for (const npc of context.world.getNpcs()) {
      const state = voidFlareNpcDefinition.getState(npc);
      if (state && npc.alive && state.lifecycle === "charging" && tick >= state.explodeTick) exploding.push(state.variant);
    }
    const definitionContext = this.buildNpcDefinitionContext(context);
    for (const npc of context.world.getNpcs()) damages.push(...this.npcDefinitions.resolveLocalEffects(npc, definitionContext));
    // The flares' definition leaves its blasts here on the blast tick, in the order they went off: a glyph
    // takes one now, one that lands hits a tick later (earlyFlares).
    this.state.voidFlares.pendingImpacts.splice(0).forEach((impact, index) => {
      const variant = exploding[index] ?? "shadow";
      this.visual(context, { graphics: [{ spotAnimId: variant === "fire" ? spots.flareHitFire : spots.flareHitShadow, actorId: "player", delayCycles: 30 }] });
      if (this.glyphActive(variant, tick)) this.absorb(context, variant);
      else f.flareImpacts.push(impact);
    });
    f.flareImpacts = f.flareImpacts.filter((impact) => {
      if (impact.impactTick > tick) return true;
      damages.push({ baseDamage: impact.damage, attackType: "typeless", source: "VoidFlare" });
      healNpc(context.world.getNpc(yamaActorId), getExplosionHeal(impact.damage), context.tickEvents);
      return false;
    });
  }

  // --- To the Judge and back -------------------------------------------------
  beginTransition(boss, context) {
    const f = this.full;
    const tick = context.tick;
    f.phase = `${f.phase}-end`;
    f.queue = [];
    f.windup = null;
    // What he had begun is dropped, the streaks and waves on their way stay.
    f.pending = f.pending.filter((effect) => effect.type === "streaks" || effect.type === "waves" || effect.type === "meteorGone");
    this.restoreRun(context.world.getPlayer());
    for (const glyph of f.glyphs) glyph.relightTick = null;
    boss.untargetable = true;
    // WIKI: the flares go without a blast.
    for (const npc of context.world.getNpcs()) if (voidFlareNpcDefinition.isActor(npc)) destroyVoidFlare(npc, { tick, tickEvents: context.tickEvents });
    this.visual(context, {
      animations: [{ actorId: yamaActorId, clipId: "begone", delayCycles: 0 }],
      graphics: [{ spotAnimId: spots.yamaBegone, actorId: yamaActorId, delayCycles: 0 }, { spotAnimId: spots.playerBegone, actorId: "player", delayCycles: 0 }],
      sounds: sounds.begone,
    });
    this.overhead(context, yamaActorId, ["Begone", "Enough.", "You bore me."][Math.floor(f.random() * 3)]); // OBS: one of the three
    this.schedule(tick + glyphFadeTicks, { type: "glyphsFade" });
    this.schedule(tick + glyphFadeTicks, { type: "playerAnimation", seqId: playerSeqs.sink });
    this.schedule(tick + transitionTeleportTicks, { type: "teleportJudge" });
  }
  arriveAtJudge(context) {
    const f = this.full;
    const tick = context.tick;
    f.phase = f.phase === "p1-end" ? "judge1" : "judge2";
    f.pending = [];
    f.streaks = [];
    f.flareImpacts = [];
    f.rootedUntil = 0;
    this.restoreRun(context.world.getPlayer());
    this.state.run.waveConfig = { ...this.state.run.waveConfig, startDelay: never };
    if (context.world.getNpc(meteorActorId)) context.despawnNpc(meteorActorId);
    context.teleportPlayer(judgeArrivalTile, north);
    f.judgeRiseUntil = tick + judgeRiseTicks;
    f.playerAnimation = { seqId: playerSeqs.rise, tick };
    this.visual(context, { graphics: [{ spotAnimId: spots.playerTeleport, actorId: "player", delayCycles: 0, height: 638 }], sounds: sounds.teleport }); // OBS: the height
    context.spawnNpc(propActor({
      id: judgeActorId, npcTypeId: npcTypeIds.judge, size: 3, position: judgeTile, tick, hp: 400, // TABLE; WIKI: 400
      extra: {
        untargetable: false, blocksNpcMovement: true, passThruNpcs: false, overheadPrayers: ["range", "melee"],
        // WIKI: "Attacks made on the judge always land as both successful and maximum hits."
        formulaStats: { ...getMonsterFormulaStats(npcTypeIds.judge), alwaysMaximumPlayerHit: true, alwaysAccuratePlayerHit: true },
      },
    }));
    f.judge = { nextAttackTick: tick + judgeTiming.firstAttackTicks, attacks: 0, magicProtection: false };
  }
  stepJudge(context, damages) {
    const f = this.full;
    const judge = f.judge;
    if (!judge) return;
    const tick = context.tick;
    const player = context.world.getPlayer();
    if (!player?.alive) return;
    // The spells walk south in their turns (moveNpc). Here, before anyone moves, the tiles are those the last tick
    // ended on: one that ended on the player's tile, or passed him, burns him now and walks on (fireSpells).
    f.spells = f.spells.filter((spell) => {
      if (tick - spell.spawnTick >= fireSpells.lifeTicks) {
        context.despawnNpc(spell.id);
        return false;
      }
      const actor = context.world.getNpc(spell.id);
      const met = sameTile(player.position, actor.position) || (sameTile(player.position, actor.previousPosition) && sameTile(player.previousPosition, actor.position)); // inferred: passing him
      // inferred: once a spell, and no prayer answers it (the recording's players prayed none).
      if (met && !spell.spent) {
        spell.spent = true;
        damages.push({ baseDamage: fireSpells.damage, attackType: "typeless", source: "Fire spell" });
        this.visual(context, { graphics: [{ spotAnimId: spots.fireSpellHit, actorId: "player", delayCycles: 0 }] });
      }
      return true;
    });
    f.fireballs = f.fireballs.filter((fireball) => {
      if (fireball.landTick > tick) return true;
      if (sameTile(player.position, fireball.tile)) damages.push({ baseDamage: judgeFireball.damage, attackType: "typeless", source: "Judge of Yama" }); // ponytail: one under the Judge does not hurt him (WIKI: 13 to 18)
      return false;
    });
    const actor = context.world.getNpc(judgeActorId);
    if (actor?.alive) faceActorToward(actor, player); // OBS: he turns to the player every tick (29 and 36 facings, solo 1 and 2)
    if (!actor?.alive || tick < judge.nextAttackTick) return;
    judge.attacks += 1;
    const animations = [{ actorId: judgeActorId, clipId: "attack", delayCycles: 0 }];
    // The player's tile is still the one the last tick ended on (judgeTiming, judgeFireball).
    if (judge.attacks > judgeTiming.spellAttacks && player.position[1] >= judgeFireball.fromY) {
      const tile = [...player.position];
      f.fireballs.push({ tile, landTick: tick + judgeFireball.flightTicks });
      this.visual(context, {
        animations,
        graphics: [{ spotAnimId: spots.judgeFireballMark, position: tile, delayCycles: 30 }, { spotAnimId: spots.judgeFireballLanding, position: tile, delayCycles: 120 }], // OBS
        projectiles: [{ spotAnimId: spots.judgeFireball, sourcePosition: judgeFireball.source, target: { kind: "tile", position: tile }, startDelayCycles: 0, endDelayCycles: 120, slope: 30, startOffset: 128, startHeight: 345, endHeight: 0 }], // OBS
        sounds: sounds.judgeFireball,
      });
      judge.nextAttackTick = tick + judgeTiming.fireballGapTicks;
    } else {
      const lanes = new Set(Array.from({ length: judgeTiming.lanesPerAttack }, () => fireSpells.lanes[Math.floor(f.random() * fireSpells.lanes.length)]));
      for (const x of lanes) {
        const id = `yama-fire-spell-${f.spellCount++}`;
        context.spawnNpc(propActor({ id, npcTypeId: npcTypeIds.fireSpell, size: 1, position: [x, fireSpells.startY], tick })); // ponytail: cannot be put out with a water spell
        f.spells.push({ id, spawnTick: tick });
      }
      this.visual(context, { animations });
      judge.nextAttackTick = tick + judgeTiming.spellGapTicks;
    }
    if (cavernShake.attacks.includes(judge.attacks)) {
      this.schedule(tick + cavernShake.delayTicks, { type: "shake" });
      this.hear(context, sounds.cavernShake);
    }
  }
  onNpcDefeated(defeat, context, completionOwnership) {
    const f = this.full;
    if (defeat.npcId === yamaActorId && !this.state.lifecycle.defeated) {
      super.onNpcDefeated(defeat, context, completionOwnership);
      // After his death only the throne's effects run (resolveHazards), until the run is won (yamaDeath). The
      // scene's corpse goes by `decisiveTick` (rendering.js, deathRetentionTicks), not by this.
      const outcome = this.state.lifecycle.outcome;
      if (outcome.phase === "resolving") outcome.completionTick = defeat.tick + yamaDeath.completionTicks;
      f.pending = [];
      f.flamesLit = false; // OBS: the flames go out on his death (solo 1, 729)
      this.hear(context, sounds.yamaDies);
      this.schedule(defeat.tick + yamaDeath.throneTicks, { type: "throneBack" });
      this.schedule(defeat.tick + yamaDeath.lineTicks, { type: "defeatLine" });
      return;
    }
    if (defeat.npcId !== judgeActorId) return super.onNpcDefeated(defeat, context, completionOwnership);
    if (!f.phase.startsWith("judge") || f.phase.endsWith("-end")) return;
    f.phase = `${f.phase}-end`;
    f.pending = [];
    this.hear(context, sounds.judgeDies);
    // OBS (solo 1, 549): the player's sink shows 3274 90 cycles after the death (its 10243 is in judgeDies).
    this.visual(context, { graphics: [{ spotAnimId: spots.playerBegone, actorId: "player", delayCycles: 90 }] });
    this.schedule(defeat.tick + judgeDeath.goneTicks, { type: "judgeGone" });
    this.schedule(defeat.tick + judgeDeath.sinkTicks, { type: "playerAnimation", seqId: playerSeqs.sink });
    this.schedule(defeat.tick + judgeDeath.returnTicks, { type: "return" });
  }
  // The throne NPC says it, later (the "defeatLine" effect).
  emitDefeatLine() {}
  returnToArena(context) {
    const f = this.full;
    const tick = context.tick;
    const boss = context.world.getNpc(yamaActorId);
    const second = f.phase === "judge2-end";
    f.judge = null;
    boss.untargetable = false;
    context.teleportPlayer(returnTile, north);
    f.playerAnimation = { seqId: playerSeqs.rise, tick };
    this.visual(context, { graphics: [{ spotAnimId: spots.playerTeleport, actorId: "player", delayCycles: 0, height: 638 }], sounds: sounds.teleport });
    if (second) return this.startPhase3(boss, tick);
    this.schedule(tick + judgeDeath.glyphTicks - judgeDeath.returnTicks, { type: "glyphsLight" });
    this.beginPhase("p2", tick + judgeDeath.firstSlotTicks - judgeDeath.returnTicks);
  }
  // Phase 3 is YamaEncounter's, with its clocks set to now: his first beat, a
  // burst of fireballs, is 15 ticks after the Judge's death (judgeDeath), and
  // the waves keep their place after it (inferred).
  startPhase3(boss, tick) {
    const f = this.full;
    f.phase = "p3";
    f.pending = [];
    // OBS (both solo kills, J the Judge's death: first burst's markers J+17, first auto J+22): the clock a tick
    // before his first action, as autos launch the tick after their beat; the snap of that first burst is
    // shown at J+15, a tick after its beat (processPostTick).
    const beatStartTick = tick + judgeDeath.firstSlotTicks - judgeDeath.returnTicks - 1;
    this.resolvedConfig.attackPattern.beatStartTick = beatStartTick;
    this.flareHealsOnImpact = false; // no glyphs now: a blast heals him as it goes off
    this.state.run.waveConfig = {
      ...this.resolvedConfig.waves, seed: mixSeed(this.state.run.encounterSeed, 1463899717),
      startDelay: beatStartTick - this.p3BeatStartTick + this.resolvedConfig.waves.startDelay,
    };
    Object.assign(this.flareExplosion, { atZeroHp: [...this.p3FlareExplosion], perRemainingHp: 0 });
    boss.formulaStats = { ...getMonsterFormulaStats(yamaNpcTypeId, "Phase 3"), demonbaneVulnerability: 1.2 };
    const state = getYamaState(boss);
    Object.assign(state, {
      attackPolicy: createYamaAttackPolicyState(state.openingStyle, this.resolvedConfig.attackPattern),
      queuedAttack: null, windup: null, latestAttackKind: null, latestAttackTick: null, alternatingAttackCount: 0, didPlanMelee: false,
    });
  }

  // --- The player's feet -------------------------------------------------------
  // Held by a streak or a stomp; on the Judge's side, from stone to stone.
  moveDisplacedPlayer(player, targetTile, place) {
    const f = this.full;
    const hold = () => {
      player.previousPosition = [...player.position];
      player.movementPath = [];
      player.isMoving = false;
      player.isRunning = false;
      return false;
    };
    // The tile clicked before the challenge is not walked to while the interface still hands it in; another is.
    if (!f.staleTile || !targetTile || !sameTile(targetTile, f.staleTile)) f.staleTile = null;
    else if (!player.attackTarget) return hold();
    f.lastTargetTile = targetTile ? [...targetTile] : null;
    if (f.phase !== "p3" && f.tick < f.rootedUntil) return hold();
    const onJudgeSide = player.position[0] < 14;
    // A tile clicked on the other side (the interface keeps the last click over a teleport) is not walked to.
    const target = player.attackTarget === judgeActorId ? judgeTile : targetTile;
    if (!target || target[0] < 14 !== onJudgeSide) return player.attackTarget ? undefined : hold();
    if (!onJudgeSide) return undefined;
    if (f.tick < f.judgeRiseUntil) return hold();
    // A clicked stone in reach: he jumps onto it (stoneJump). Otherwise he walks on his own platform, or off the
    // first or last stone onto the one beside it (landOf); the lava, a stone out of reach, or the Judge from the
    // stones keep him where he is (he still attacks what is in range).
    const next = player.attackTarget ? null : stoneJump(player.position, target);
    if (!next) return landOf(player.position) !== null && landOf(player.position) === landOf(target) ? undefined : hold();
    const [dx, dy] = [next[0] - player.position[0], next[1] - player.position[1]];
    // OBS (solo 1, ticks 274-279): he turns to the stone he jumps to (o 1024, then towards 919 for [7, 31] to
    // [6, 34]): the angle of the jump, 0 south, 512 west, 1024 north.
    place(next, Math.round((Math.atan2(-dx, -dy) * 1024) / Math.PI) & 2047);
    // The scene restarts 12196 on every jump (presentation.js plays it once for each tick) and draws the jump as a
    // forced move (getSnapshot, forcedMoveCycles).
    f.playerAnimation = { seqId: playerSeqs.jump, tick: f.tick };
    return true;
  }
  processPostTick(context, mechanics) {
    if (this.full.phase === "p3") {
      // OBS (3 of 3): from his second cycle on, beat 3 is an attack and a burst ("overlay", beatClock.js); beats 0
      // and 7 stay bursts alone.
      const pattern = this.resolvedConfig.attackPattern;
      if (context.tick === pattern.beatStartTick + pattern.beatsPerCycle * pattern.beatIntervalTicks)
        pattern.snapFireballBeats = this.p3SnapFireballBeats.filter((beat) => beat !== 3);
      const result = super.processPostTick(context, mechanics);
      // A snap burst began (a fireball beat without an auto): his 12144 without a spot, shown a tick after the
      // beat as his autos are (startPhase3), with its sound.
      const boss = context.world.getNpc(yamaActorId);
      const state = boss && getYamaState(boss);
      if (state?.latestAttackKind === "fireball" && state.latestAttackTick === context.tick) {
        Object.assign(state, { latestAttackKind: null, latestAttackTick: null });
        this.full.snapTick = context.tick + 1;
      } else if (state && this.full.snapTick === context.tick && state.latestAttackKind === null) {
        Object.assign(state, { latestAttackKind: "fireball", latestAttackTick: context.tick });
        this.hear(context, sounds.snap);
      }
      return result;
    }
    if (mechanics.waves && !this.state.lifecycle.defeated) this.emitWaveActivated(context);
    if (this.full.playerAnimation?.seqId === playerSeqs.jump && this.full.playerAnimation.tick === context.tick) this.hear(context, sounds.jump);
    return [];
  }
  // The waves' event (YamaEncounter), with the number of waves that have a tile within `waveSoundTiles` of the
  // player: the presentation plays a wave sound for each (OBS: none from 6 tiles on). In every phase.
  emitWaveActivated(context) {
    const [x, y] = context.playerPos;
    const r = waveSoundTiles;
    const nearWaves = new Set(getYamaWaveTiles(context.tick, x - r, x + r, y - r, y + r, this.state.run.waveConfig).map((tile) => tile.waveIndex)).size;
    super.emitWaveActivated({ ...context, tickEvents: { emit: (event) => context.tickEvents.emit({ ...event, nearWaves }) } });
  }
  getSnapshot(request) {
    const snapshot = super.getSnapshot(request);
    const f = this.full;
    return {
      ...snapshot,
      state: {
        ...snapshot.state,
        phase: f.phase,
        glyphs: f.glyphs.map((glyph) => ({ ...glyph })),
        glyphProtection: { ...f.protection },
        playerAnimation: f.playerAnimation,
        // OBS (solo 1, ticks 274-279, cycles 29320-29469): the drawn model covers a jump of 2 or 3 tiles in the 30
        // client cycles of the jump's tick, in the stand pose under 12196. Read by the scene's path follower
        // (rendering.js, PlayerVisualTracker); null on every other tick.
        forcedMoveCycles: f.playerAnimation?.seqId === playerSeqs.jump && f.playerAnimation.tick === f.tick ? jumpMove.cycles : null,
        forcedMoveSteps: jumpMoveSteps, // the cycles the drawn place changes on (jumpMove)
        flamesLit: f.flamesLit,
        // The flares of shadow, which the scene draws blue (presentation.js); the others are the cache's red.
        shadowFlareIds: request.world ? request.world.getNpcs().filter((npc) => voidFlareNpcDefinition.getState(npc)?.variant === "shadow").map((npc) => npc.id) : [],
      },
    };
  }
  getAutoMarkers() {
    const labels = { p1: "Phase 1", judge1: "Judge of Yama", p2: "Phase 2", judge2: "Judge of Yama (second)", p3: "Phase 3" };
    const label = labels[this.full.phase];
    return label ? [{ id: this.full.phase, label }] : [];
  }
}

const baseControls = buildYamaControls();
export const yamaFullControls = {
  ...baseControls,
  defaultMechanicsConfig: { ...baseControls.defaultMechanicsConfig, yamaSpecials: true, fireStreaks: true },
  mechanicsToggles: [
    ...baseControls.mechanicsToggles.filter(({ key }) => key !== "yamaStartGlyphs"),
    { key: "yamaSpecials", label: "Specials (Phases 1-2)" },
    { key: "fireStreaks", label: "Fire Streaks" },
  ],
  // Phase 3's debug actions are commands of the kind "yama_p3".
  debugActions: [{ command: challengeCommand, label: "Challenge Yama" }],
};
