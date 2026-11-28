// Yama, the whole fight: the numbers and the geometry of what comes before
// the third phase (YamaFullEncounter.js). Tiles are those of his map square.
//
// OBS is a recording of five duo kills (encounter-recorder, 27 November 2026,
// revision 243), or of two solo kills ("solo 1", "solo 2", with the tick of
// the recording); a tick named "slot" is a tick on which Yama acts.
// WIKI is https://oldschool.runescape.wiki/w/Yama/Strategies, and
// https://oldschool.runescape.wiki/w/Judge_of_Yama for the Judge.

export const yamaFullKind = "yama_full";

export const npcTypeIds = {
  throneYama: 124, // CACHE: Yama on his throne, with the option "Challenge"
  throne: 14157, // CACHE: the empty throne
  judge: 14180,
  fireSpell: 13507,
  meteor: 14182, // CACHE: no name, 7 x 7; OBS: stands where a meteor falls
};
// OBS: one NPC, whose type changes from 124 to 14157 and back.
export const throneActorId = "yama-throne";
export const judgeActorId = "yama-judge";
export const meteorActorId = "yama-meteor";

// OBS: the throne's NPC stands on this tile, north of the arena.
export const throneTile = [31, 44];
// OBS (solo 1, ticks 5 to 22; solo 2, 2 to 14): he speaks on the tick after
// the player reaches the throne (B1), the throne plays its sequence a tick
// later, Yama is in the arena 3 ticks after the line, the throne NPC turns
// into the empty throne 2 ticks after that while its sequence goes on; the
// glyphs light up 5 ticks after he appears and he attacks 8 after. OBS (solo
// 1, ticks 7 and 729): as the throne's sequence starts, the three objects
// 29733 south of the arena, (30,19) to (32,19), turn into flames (56264),
// until his death.
export const challengeLine = "Back again I see. I can see how you would find these bouts exhilarating, being such a feeble opponent.";
// OBS (solo 1, tick 7): the flames' tiles and their rotations in quarter turns
// (orientations 1536, 1536, 512; solo 2 had 1024, 0, 0).
export const entranceFlames = { locId: 56264, tiles: [[30, 19, 3], [31, 19, 3], [32, 19, 1]] };
export const lineToThroneSeqTicks = 1;
export const lineToArrivalTicks = 3;
export const arrivalToEmptyThroneTicks = 2;
export const arrivalToGlyphsTicks = 5;
// OBS: "Fight duration" fits a clock started as the empty throne appears
// (solo 1: 7:13 at tick 734, solo 2: 6:17 at 637), shown 5 ticks after his
// death, when the throne NPC is back; the throne NPC says one of the defeat
// lines (constants.js) 9 ticks after the death. OBS: 11 ticks after it the
// loot lies before the throne, on (31, 40), with sound 10235; the run is won
// then (`completionTicks`; phase 3 alone is won 7 ticks after the death).
export const yamaDeath = { throneTicks: 5, lineTicks: 9, completionTicks: 11 };
export const fightDuration = (ticks) => {
  const seconds = Math.floor((ticks * 3) / 5);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};
// OBS: 8 ticks between two slots in phases 1 and 2 (WIKI: attack speed 8).
export const slotTicks = 8;
// He walks up to the player to melee him from the start of each phase, until
// the player attacks him with magic or ranged (the owner's account, and the
// WIKI: "Yama resets to melee behaviour at the start of P2"; OBS solo 1 and 2:
// his steps at the start of a phase stopped once the player's spells began).
// After that he walks only while the player is more than 6 tiles from his
// footprint (OBS), and again after a melee attack (WIKI).
export const yamaWalk = { keepWithinTiles: 6 };
// OBS: a magic or ranged attack hits 3 ticks after its slot.
export const autoWindupTicks = 3;
// WIKI: up to 46 without the prayer; the prayer blocks magic and ranged, and
// leaves a melee at most 6.
export const earlyAutoDamage = [0, 46];
export const earlyMeleePrayerReduction = { type: "cap", value: 6 };
export const earlyRangedMagicPrayerReduction = { type: "block" };
// OBS (solo 1, auto 335, hit 338, line 339; solo 2, 102/105/106; duo
// 1420/1423/1424): a magic or ranged auto poisons, also when the prayer blocks
// it, and the line "You have been poisoned!" comes a tick after the hit.
// inferred: half the time (3 of the 6 hits that could have); severity 100, as
// his melee's (boss.js).
export const autoPoison = { severity: 100, chance: 0.5 };

// WIKI: phase 1 ends at 66.6 % of his hitpoints, phase 2 at 33.3 %. OBS (14
// of 14 transitions, solo and duo): the first slot at or below it is an
// ordinary one, he says so on the next. Hits past the mark do full damage
// (OBS: duo 1215, solo 2 443), not the wiki's halving.
export const phaseEndHp = (maxHp) => ({ p1: Math.floor((maxHp * 2) / 3), p2: Math.floor(maxHp / 3) });
// OBS: on the slot of a phase-2 special he says one of three lines of its
// element (17 samples).
export const p2SpecialLines = {
  shadow: ["Umbra, proriumpse", "Umbra apprerendehe", "Ven, umbra eclipta"],
  fire: ["Colabesur infernus", "Colabi, infernus", "Ven, estella infernus"],
};

// --- Glyphs -----------------------------------------------------------------
// OBS: five glyphs, 3 x 3 each (objects 56335 shadow, 56336 fire, 56337 dark).
// `tile` is the south-west one; a player stands on the centre. Three have the
// colour of the majority, two the other; a kill keeps its layout for both
// phases. The start-glyph overlay of phase 3 (rendering.js) has the same tiles.
export const glyphSpots = [
  { tile: [25, 36], majority: true },
  { tile: [35, 36], majority: true },
  { tile: [30, 24], majority: true },
  { tile: [23, 29], majority: false },
  { tile: [37, 29], majority: false },
];
// WIKI: 10 ticks of immunity. OBS: "absorb" on tick 22, "fades away" on 32.
export const glyphProtectionTicks = 10;
// OBS (9 of 9): a taken glyph is lit again 96 ticks after it was taken, while
// the phase lasts.
export const glyphRelightTicks = 96;
// What taking a glyph costs, by the Chebyshev distance from the player to
// Yama's footprint. OBS (solo and duo): fire deals 2 at 5 tiles or more, 6 at
// 4, 9 at 3; shadow drains 2, 5 and 6 prayer. inferred: 12 and 8 at 2 or less
// (never seen).
export const glyphFireDamage = (distance) => (distance >= 5 ? 2 : distance === 4 ? 6 : distance === 3 ? 9 : 12);
export const glyphShadowDrain = (distance) => (distance >= 5 ? 2 : distance === 4 ? 5 : distance === 3 ? 6 : 8);
export const otherElement = (element) => (element === "shadow" ? "fire" : "shadow");
// WIKI: fire is his magic, shadow his ranged attack.
export const styleOfElement = (element) => (element === "shadow" ? "range" : "magic");
export const elementOfStyle = (style) => (style === "range" ? "shadow" : style === "magic" ? "fire" : null);

// --- Specials ---------------------------------------------------------------
// OBS, phase 1 (sequence 12145): the projectile leaves 3 ticks after the slot
// and the hit lands 6 ticks after it.
// The damage: 30 to 50 as a rule, says the player whose recording this is, of
// the fire special (the cache's "flaming rock"; every special of the recording
// was absorbed by a glyph, and the wiki gives no number for phase 1).
// inferred: the shadow special (the "shadow spike") does the same. It drains
// prayer too, says the same player; inferred: as much as Shadow Stomp does.
// OBS (solo 1, slot 249, hit 40 on 255): the fire special that lands sets the
// player alight a tick after the hit, a burn of 1 every 4 ticks (256, 260,
// 264, cut off by the transition); inferred: 5 of them.
export const p1Special = { impactTicks: 6, projectileTicks: 3, damage: [30, 50], shadowPrayerDrain: 20 };
export const p1Burn = { delayTicks: 1, intervalTicks: 4, hits: 5, damage: 1 };
// OBS, phase 2 shadow (sequence 12148, "Umbra, ..."): projectile 2 ticks after
// the slot, the hit 5 after it. WIKI: up to 80 (Yama's infobox; the strategy
// guide's 60 is low, says the player whose recording this is), roots for 2
// ticks, drains prayer. The same player sees it hit 40 to 60 as a rule: 40
// is the least here (the engine rolls evenly up to 80). inferred: the prayer
// drained. OBS (solo 1, tick 476): one landed for 61 and drained 20 prayer,
// and running was off for 6 ticks (varp 173, 476 to 482); it turns no prayer
// off. The hold of 2 ticks is not seen in the recording.
export const shadowStomp = { impactTicks: 5, projectileTicks: 2, damage: [40, 80], rootTicks: 2, prayerDrain: 20, runOffTicks: 6 };
// OBS, phase 2 fire ("Colab..., infernus"): NPC 14182 appears on the target's
// tile 2 ticks after the slot, the hit lands 6 after it, the NPC goes 10
// after it. WIKI: 80 at 2 tiles from the centre, 40 at 3, nothing from 4;
// running is off for the target until it lands. Within 1 tile it hits its
// most, 121 (WIKI, the contract table's max hit, and the player's own
// account), which the guide calls an instant kill.
export const meteor = { markTicks: 2, impactTicks: 6, goneTicks: 10 };
export const meteorDamage = (distance) => (distance <= 1 ? 121 : distance === 2 ? 80 : distance === 3 ? 40 : 0);

// --- Void flares ------------------------------------------------------------
// OBS: two flares 2 ticks after the slot, one on (26,25) or (35,25) and one
// on (23,33) or (38,33) (17 of 17 pairs, all kills). OBS (solo 1, ticks 123
// to 150): 26 ticks after a flare appears it goes off (sequence 12136 and its
// blast spot); a glyph takes the blast on that tick, judged by the immunity
// of that tick; a blast that lands hits a tick later, 27 after the flare
// appeared. Either way the player shows a spot at the blast tick + 30 cycles,
// 3241 of a fire flare and 3242 of a shadow one. A blast a glyph takes heals
// Yama nothing (3 of 3); one that lands heals him 8/3 of its damage (solo 1,
// tick 150: 112 for 42), as in phase 3 (voidFlares.js). The timer over a flare
// runs out 5 ticks before the blast, says the player whose recording this is
// (the recording does not have the timer).
// WIKI (Void Flare): 140 hitpoints; 42 to 45 at full health, less with less.
export const earlyFlares = { spawnTicks: 2, chargeTicks: 26, timerLeadTicks: 5, tilePairs: [[[26, 25], [35, 25]], [[23, 33], [38, 33]]], hp: 140, explosion: { atZeroHp: [0, 3], perRemainingHp: 0.3 } };

// --- Hazards ----------------------------------------------------------------
// OBS: before every special or flare slot but the first of a phase, fire
// streaks and shadow waves in turn, beginning with the element the first
// special does not have.
// Streaks (graphic 3267): 9 ticks before the slot a fire stands on the edge
// of its row for 3 ticks, then crosses it 2 tiles a tick. OBS: a tile's
// graphic starts 15 cycles after the one before it; the single tile of the
// first step starts 30 cycles into its tick. OBS (solo and duo):
// each streak is one row lit from one side, the side about half and half and
// the rows of a batch distinct. Phase 1 has a batch of 6 to 10, phase 2 two
// batches of 4 to 10, the second 6 ticks after the first.
export const streaks = { leadTicks: 9, warningTicks: 3, secondBatchTicks: 6, rows: [20, 40], count: { p1: [6, 10], p2: [4, 10] } };
// inferred: "around 20", from the player whose recording this is (nobody was
// hit in it), and the hold. WIKI says only that a streak damages and "sears
// to the ground".
export const streakHit = { damage: [18, 22], rootTicks: 3 };
// Waves (graphics 3265 "R" and 3266 "L", shadowWaves.js): one in phase 1, two
// in phase 2, 4 ticks apart and one from each side. OBS: a line is at
// y - x = -40 (or x + y = 20) 16 ticks before the slot.
// OBS (solo 1 673; solo 2 214, 628; duo 1306), in every phase: a wave that
// lands turns the protection prayers off, and they cannot be turned on again
// for 2 ticks (refused at hit + 1, on again by hit + 3 in the duo kill). A
// Glyph of Shadow takes it (duo 535).
export const waves = { leadTicks: 16, secondWaveTicks: 4, prayerLockTicks: 3 };

// --- The Judge --------------------------------------------------------------
// OBS: 6 ticks after "Begone" the player stands on [7, 29] (the second of a
// duo 50 tiles east) and the Judge on [6, 50].
export const transitionTeleportTicks = 6;
export const glyphFadeTicks = 2;
export const judgeArrivalTile = [7, 29];
export const judgeTile = [6, 50];
// OBS (object 56246, "Stone"): the rows of stones across the lava, south to
// north. A jump takes one tick.
export const stoneRows = [
  { y: 31, xs: [7] },
  { y: 34, xs: [6, 8] },
  { y: 37, xs: [5, 7, 9] },
  { y: 40, xs: [5, 7, 9] },
  { y: 43, xs: [6, 8] },
  { y: 46, xs: [7] },
];
export const startPlatform = { minX: 6, maxX: 8, minY: 28, maxY: 30 };
export const judgePlatform = { minX: 4, maxX: 10, minY: 47, maxY: 53 };
// OBS (14 of 14 visits): he rises from the floor where he lands and jumps 3
// ticks after the teleport at the earliest (duo 107: clicked at +1 and +2,
// jumped at +3).
export const judgeRiseTicks = 3;
// OBS (78 spells, both solo kills and the duo kills; solo 1 272 to 301): a
// fire spell (NPC 13507) appears on y 49 of one of five lanes as the Judge
// plays 69, stands for 2 ticks, then walks south a tile a tick, drawn smoothly
// (at every tick it is drawn on the middle of the tile it left: a step takes
// the whole tick); its walk is its pose 11456, it faces south (0) all
// the way and plays no animation. It is gone 29 ticks after it appears, on
// y 22, when it has just come to the middle of that tile. OBS (duo 786): one
// that ends a tick on the player's tile hits him on the next (27), with spot
// 1466 on him, and walks on.
export const fireSpells = { lanes: [5, 6, 7, 8, 9], startY: 49, waitTicks: 2, lifeTicks: 29, damage: [1, 29] }; // WIKI: fire surge 29
// OBS (14 of 14 visits): the Judge acts 1 tick after the arrival, wherever the
// player is, then every 4 ticks after a spell attack and every 5 after a
// fireball. His first 3 attacks send spells; from the 4th on he throws a
// fireball when the player stood on the last stone or the platform (y 46 or
// more) at the end of the tick before, and sends spells again when not (duo
// 226 +13 from [8, 43], duo 1466 +13 from [6, 43]: spells, then the fireball
// 4 ticks later). A spell attack sends 1 or 2 spells (10 of 44 attacks one;
// solo: 2, 2 and 1 in some order, duo also 2, 2, 2): inferred, two lanes
// drawn at random, the same lane twice is one spell (1 in 5).
export const judgeTiming = { firstAttackTicks: 1, spellGapTicks: 4, fireballGapTicks: 5, spellAttacks: 3, lanesPerAttack: 2 };
// OBS: projectile 2855 flies 4 ticks to the tile the player stood on at the
// end of the tick before (14 of 14 first fireballs; [7, 46], the last stone,
// in 6 of them). `fromY`: the last stone's row (OBS, above).
// WIKI: 18 at most ("AoE").
export const judgeFireball = { flightTicks: 4, damage: [1, 18], source: [7, 51], fromY: 46 };
// OBS (4 of 4 visits): the cavern shakes on his 5th and 10th attack, the hit
// lands 2 ticks after it. WIKI: 5 to 7.
export const cavernShake = { attacks: [5, 10], delayTicks: 2, damage: [5, 7] };
// OBS (solo 1, Judge's death 549): from his death he is gone after 5 ticks
// and Yama is back in the middle, the player sinks after 6, is back in the
// arena after 9, the glyphs light after 12 and Yama acts after 15 (duo: 14 to
// 15), in phase 2 and in phase 3.
export const judgeDeath = { goneTicks: 5, sinkTicks: 6, returnTicks: 9, glyphTicks: 12, firstSlotTicks: 15 };
export const returnTile = [32, 38];

// OBS: the player's own sequences: a jump from stone to stone, sinking into the floor 2 ticks after "Begone" and
// after the Judge is gone, and rising out of it where he lands (phase 3's intro has the same one).
export const playerSeqs = { jump: 12196, sink: 12149, rise: 12152 };
// A stone jump is a forced move of 30 cycles (OBS: every jump of the 14 crossings starts with 12196 on frame 0 on the
// old stone, and 30 cycles later he is drawn on the middle of the new one, 12196 on frame 8: solo 1, 283 and 284).
// The game's client moves an actor in a forced move only on the cycle a frame of its sequence ends (and on the
// last cycle), so he goes in steps, one at each frame's end, not smoothly (inferred: the client's rule). CACHE:
// 12196's frames last 3, 5, 4, 4, 2, 4, 4, 4, 3 and 4 cycles.
export const jumpMove = { cycles: 30, frameCycles: [3, 5, 4, 4, 2, 4, 4, 4, 3, 4] };
export const jumpMoveSteps = jumpMove.frameCycles.map((_, index, all) => all.slice(0, index + 1).reduce((sum, cycles) => sum + cycles)).filter((cycle) => cycle < jumpMove.cycles);
// Sequences (OBS) and what the render config calls them.
export const yamaClips = { p1special: 12145, p2special: 12148, begone: 12147, arrive: 12156 };
// OBS: the throne NPC plays sequence 12154 with spot 3278 as he is challenged,
// and 12165 with spot 3286 as he is back after the kill (presentation.js has
// the clips).
export const throneClips = { challenge: 12154, back: 12165 };
// OBS: the throne holds 12154 for 247 cycles (solo 1: from cycle 21308 to 21555; solo 2: 47743 to 47990), its
// last frame from cycle 150 on (the cache's length): the scene's one-shot clip holds its last frame as long.
export const throneChallengeCycles = 247;
export const spots = {
  throneChallenge: 3278, throneBack: 3286,
  streak: 3267,
  yamaArrive: 3279,
  yamaBegone: 3276, playerBegone: 3274, playerTeleport: 3275,
  glyphFire: 3280, glyphShadow: 3281,
  p1ShadowCast: 3256, p1ShadowProjectile: 3257, p1ShadowImpact: 3258,
  p1FireCast: 3253, p1FireProjectile: 3254, p1FireImpact: 3255,
  stompCast: 3259, stompProjectile: 3260, stompImpact: 3261,
  meteorCast: 3270, meteorFall: 3272,
  flareBlastFire: 3237, flareHitFire: 3241, flareHitShadow: 3242, // OBS: solo 1, tick 149
  judgeFireball: 2855, judgeFireballLanding: 2856, judgeFireballMark: 1446,
  fireSpellHit: 1466, // OBS: duo 787, on the player a spell hit
};

// Sounds, each { id, delayCycles }: the cycles (30 a tick) after the start of
// the animation, spot or event it is heard with. OBS: both solo kills and the
// duo kills. The presentation's audio rules play them (presentation.js): what
// a visual event carries as `sounds`, and the rules of phase 3's events.
// ponytail: all non-positional ("sfx"). The game sends most as area sounds of
// range 10 to 31 around Yama, the player, a flare or a tile, in an arena about
// 28 tiles wide: heard everywhere. Make one positional if that is ever wrong.
const at = (id, delayCycles = 0) => ({ id, delayCycles });
// Only the sounds that are not in the frames of an animation or a spot animation the scene draws: Yama's scene
// plays those itself (rendering.js, its frame sound tracker), and playing them here as well heard every one twice,
// a few cycles apart (the owner: "like we are inside of a bathroom"). CACHE: 12144 has 10251; spots 3246/3247
// 10261, 10263, 10216; 3243/3244 10254, 10272, 10252; 12145 10266; 3253 10221, 10234, 10230; 3256 10267, 10212,
// 10245; 12148 10276, 10260, 10242; 3259 10223, 10232; the meteor's 12118 10257, 10225; 12147 10242, 10271, 10259;
// 3274 10243; 3275 10250; 12154 10227, 10235; 3278 10213; 12156 10258; 12161 10277, 10248, 10275, 10269, 10240;
// 12165 10235 (the loot); the flares' 12135 10253, 12134 10239, 12136 10249, 10217. An empty entry is a moment
// whose sounds are all the scene's.
export const sounds = {
  challenge: [],
  arrive: [],
  magicAuto: [],
  rangedAuto: [],
  snap: [],
  // OBS: 180 is the impact, hit or absorbed (a sound of its own, in no frame).
  p1Fire: [at(10255, 180)],
  p1Shadow: [at(10246, 180)],
  setAlight: [at(2412)], // OBS: a tick after the hit, with "You have been set alight!"
  // OBS: 10270 at 64 and the impact's 10273 at 149, hit or absorbed.
  stomp: [at(10270, 64), at(10273, 149)],
  bound: [at(154), at(154, 30)], // OBS: the stomp lands and binds: on the hit tick and the next
  meteor: [at(156, 180)], // OBS: at the target tile
  glyphTaken: [at(99)], // OBS
  glyphEnds: [at(5062)], // OBS: with "The Glyph of ... fades away."; lighting, relighting and fading are silent
  streak: [at(10215)], // OBS: once a tick while a streak moves (not in its 3 ticks on the edge)
  wave: [at(10238)], // OBS: once a tick for each wave with a tile within `waveSoundTiles` of the player
  flareSpawn: [],
  flareGone: [],
  flareBlast: [],
  begone: [],
  teleport: [],
  jump: [at(2461, 5)], // OBS: on the player's 12196, each jump (CACHE: 12196 has no frame sounds)
  judgeFireball: [at(9335, 3), at(9221, 33), at(9215, 36)], // OBS: on 69 with projectile 2855; his spells are silent
  cavernShake: [at(1678)], // OBS: on that attack
  judgeDies: [at(5023)], // OBS: on his 9042 (CACHE: no frame sounds); the player's sink after it is spot 3274's
  p3Fireball: [at(9335, 3), at(10255, 100), at(10268, 105)], // OBS: each fireball of a burst, at its launch
  yamaDies: [],
};
export const waveSoundTiles = 5; // OBS: silent from 6 tiles on
export const soundIds = [...new Set(Object.values(sounds).flat().map((sound) => sound.id))];

// The audio layer of the whole fight (presentation.js). The layers of all
// encounters hear every event, this one before phase 3's of rendering.js: a
// rule answers `pass` to what is not its own.
//   colosseum_visual  what an event of YamaFullEncounter carries as `sounds`
//   fireball_spawned  each fireball of phase 3, as rendering.js plays it
//   wave_activated    a wave sound for each of `nearWaves` (YamaFullEncounter's
//                     emitWaveActivated); the stand-alone phase 3's event has
//                     none and keeps rendering.js's rule
// His autos and the flares have no rule: their sounds are in the frames of
// what the scene draws for them.
const pass = { kind: "pass" };
const play = (heard) => (heard.length ? { kind: "play", sound: heard.map((sound) => ({ ...sound, channel: "sfx" })) } : { kind: "silent" });
const rule = (heard, resolve = () => play(heard)) => ({ preloadIds: [...new Set(heard.map((sound) => sound.id))], resolve });
export const yamaFullAudio = {
  layerName: "yama_full",
  rules: {
    colosseum_visual: { preloadIds: soundIds, resolve: (event) => (event.sounds?.length ? play(event.sounds) : pass) },
    fireball_spawned: rule(sounds.p3Fireball),
    wave_activated: rule(sounds.wave, (event) => (event.nearWaves === undefined ? pass : play(Array(event.nearWaves).fill(sounds.wave).flat()))),
  },
};

export const inRect = ([x, y], rect) => x >= rect.minX && x <= rect.maxX && y >= rect.minY && y <= rect.maxY;
export const stoneRowIndex = ([x, y]) => stoneRows.findIndex((row) => row.y === y && row.xs.includes(x));

// The stone a player on the Judge's side jumps to this tick, or null. OBS
// (14 crossings, both solo kills and the duo kills): only "Jump" on a stone
// (object 56246, 1x1, its one action) jumps, one stone a click, a tick a jump;
// a click on the lava does nothing (duo 777: a walk to [7, 33] after a jump
// to [7, 31] was clicked, and he landed on [7, 31]). The stones jumped to were
// those of the next row, up to 2 tiles to the side ([7, 37] to [5, 40]: solo
// 2, 258; duo 1604). The owner (play-test): a stone beside him in his own row
// can be jumped to as well. Further is out of reach (inferred).
export const stoneReach = { sideTiles: 2, forwardTiles: 3 };
export function stoneJump(position, target) {
  if (stoneRowIndex(target) === -1 || (target[0] === position[0] && target[1] === position[1])) return null;
  const inReach = Math.abs(target[0] - position[0]) <= stoneReach.sideTiles && Math.abs(target[1] - position[1]) <= stoneReach.forwardTiles;
  return inReach ? [...target] : null;
}
// The platform a tile is on, or the one beside the first or last stone: a
// player walks only on his own platform, and off the first or last stone onto
// the platform beside it (OBS solo 1, 284: off [7, 46] onto [7, 48] with no
// jump of his own, no 12196 and no 2461, drawn as a run).
export function landOf(tile) {
  if (inRect(tile, startPlatform) || stoneRowIndex(tile) === 0) return "start";
  if (inRect(tile, judgePlatform) || stoneRowIndex(tile) === stoneRows.length - 1) return "judge";
  return null;
}

// The tiles a streak burns on `tick`: its edge tile while it warns, then two
// tiles a tick (the first step is one tile). Empty once it has left its row.
export function streakTiles(streak, tick) {
  const step = tick - streak.startTick;
  if (step < 0) return [];
  const { y, from, to } = streak;
  const direction = Math.sign(to - from);
  const offsets = step < streaks.warningTicks ? [0] : step === streaks.warningTicks ? [1] : [2 * (step - streaks.warningTicks), 2 * (step - streaks.warningTicks) + 1];
  return offsets.map((offset) => [from + direction * offset, y]).filter(([x]) => (direction > 0 ? x <= to : x >= to));
}
export const isStreakWarning = (streak, tick) => tick - streak.startTick < streaks.warningTicks;

// What Yama does slot after slot in phase 1 or 2 (OBS, all five kills): one
// attack of the minority's style, then blocks of a special and three attacks
// of its style, the element changing with every block. Once in a phase two
// void flares take a slot before a shadow special, and three more attacks of
// the old style follow them. WIKI: that is before the 2nd or 3rd shadow
// special when shadow opens, before the 1st or 2nd when fire does.
export function createSlotPlan(majority, random) {
  const shadowOpens = majority === "shadow";
  return {
    element: majority,
    shadowSpecials: 0,
    flareBeforeShadowSpecial: (shadowOpens ? 2 : 1) + (random() < 0.5 ? 0 : 1),
    flaresDone: false,
    blocks: 0,
    opening: { kind: "auto", style: styleOfElement(otherElement(majority)) },
  };
}
/** The next block of slots, and whether flares head it. Advances the plan. */
export function nextSlotBlock(plan) {
  plan.blocks += 1;
  const autos = (element) => [1, 2, 3].map(() => ({ kind: "auto", style: styleOfElement(element) }));
  if (plan.element === "shadow" && !plan.flaresDone && plan.shadowSpecials + 1 === plan.flareBeforeShadowSpecial) {
    plan.flaresDone = true;
    return [{ kind: "flares" }, ...autos("fire")];
  }
  const element = plan.element;
  if (element === "shadow") plan.shadowSpecials += 1;
  plan.element = otherElement(element);
  return [{ kind: "special", element }, ...autos(element)];
}
