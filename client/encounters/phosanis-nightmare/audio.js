// The sounds of the fight that are in no animation. The game's server sends
// each of them, so here they are rules, keyed by the type of a tick event
// (docs/ADDING-AN-ENCOUNTER.md, section 5, `audio`). The layers of all
// encounters hear every event: a rule answers `pass` to what is not its own.
// The sounds of the frames of her sequences are in the cache with them, and
// the scene plays those.
//
// tsps, as in encounter.js: the sounds the encounter attaches to its events
// (`nightmareSounds`), each with its id and delay. OBS (Outside): one recording
// of a kill (as in ids.js), with the counts of it below: the rest, which the
// game sends as a run of sounds, each with its delay in cycles, on the tick of
// what it goes with. Recorded but not here: a parasite's cast (4304, 4294 and
// 158, once).
import { bossActorId } from "./encounter.js";
import { bossSize, sounds, spotAnims } from "./ids.js";

const impactSounds = {
  phosanis_nightmare_magic: sounds.magicImpact, // on the player as it lands
  phosanis_nightmare_range: sounds.rangeImpact,
};

// [id, delay in cycles], with no place.
const runs = {
  // Her attacks, as she starts each: 26 of 26, 21 of 21, 5 of 5.
  phosanis_nightmare_magic: [[4334, 10], [4239, 32], [4286, 35], [4333, 50], [4258, 84]],
  phosanis_nightmare_range: [[4221, 2], [4251, 26], [4340, 56], [4237, 86], [4270, 90], [4323, 93]],
  phosanis_nightmare_melee: [[4327, 6], [4253, 24], [4282, 51]],
};
// Her own animations, by clip (encounter.js, specials.js, minions.js).
const special = [[4310, 3], [4225, 34], [4331, 62], [4325, 68], [4330, 78]]; // 11 of 11: spores, husks, flowers and the curse
const clipRuns = {
  spores: special, // 3 of 3
  husks: special, // 3 of 3
  flowers: [...special, [4284, 6]], // 2 of 2
  curse: [...special, [4287, 0]], // 3 of 3
  parasite: [[4336, 5], [4241, 6], [4233, 60]], // 2 of 2
  surge: [[4240, 32]], // 2 of 2
  leave: [[4271, 9], [4337, 19]], // 7 of 7
  back: [[4262, 4]], // 4 of 4
  blastForm: [[4262, 4]], // 3 of 3
  blast: [[4328, 54], [4293, 59], [4297, 62], [4259, 74]], // 3 of 3
  wake: [[4246, 10], [4291, 112]], // 1 of 1
};
const clawRun = [[4307, 3], [4274, 54], [4228, 58], [4322, 165]]; // 35 of 35 sets of claws
const totemRun = [[4032, 30], [4031, 90]]; // 3 of 3 bolts of the totems at her
// Her death, its animation a tick after the kill (1 of 1); here with the kill, as
// the scene draws it.
const deathRun = [[4295, 6], [4315, 38], [4275, 72], [4246, 111], [4269, 132], [4226, 192], [4313, 195]];
// The minions', by the start of the id the encounter gives each (minions.js).
const minionRuns = {
  "nightmare-husk-": { rise: [[4341, 0]], magic: [[4302, 15], [218, 28], [219, 67]], range: [[4264, 38]] }, // 3 of 3, 3 of 3, 2 of 2
  "nightmare-parasite-": { rise: [[1457, 0]] }, // 2 of 2
  // Range 8 in the game, from the sleepwalker; the event has no tile: as loud anywhere (3 of 3).
  "nightmare-sleepwalker-": { absorb: [[4227, 0]] },
};

// Heard from a tile: a hit on her from her middle tile, range 7 (139 of the 143
// hitsplats on her; 4 of other kinds were not). A minion that dies, from its tile:
const hitOnHer = { id: 4281, range: 7 };
const minionDeaths = {
  "nightmare-husk-": [{ id: sounds.huskDies, range: 10 }, { id: 4252, range: 8 }], // 6 of 6, both
  "nightmare-parasite-": [{ id: 4296, range: 10 }, { id: 4305, range: 8, delayCycles: 30 }], // 2 of 2: the second with its death animation, a tick on
  // 9 of 9; then with its death animation, with no place, 8 of 9.
  "nightmare-sleepwalker-": [{ id: 4292, range: 10 }, { id: 4223 }],
};

const play = (played) => (played.length > 0 ? { kind: "play", sound: played } : { kind: "pass" });
const everywhere = (run) => run.map(([id, delayCycles]) => ({ id, ...(delayCycles ? { delayCycles } : {}), channel: "sfx" }));
const ofMinion = (actorId) => Object.keys(minionRuns).find((prefix) => typeof actorId === "string" && actorId.startsWith(prefix));
// The ids in runs ([id, delay] pairs), sounds ({ id }) and plain ids, however nested.
const ids = (...lists) => {
  const found = new Set();
  const visit = (entry) => {
    if (typeof entry === "number") found.add(entry);
    else if (Array.isArray(entry) && entry.length === 2 && entry.every((part) => typeof part === "number")) found.add(entry[0]);
    else if (Array.isArray(entry)) entry.forEach(visit);
    else if (entry && typeof entry.id === "number") found.add(entry.id);
  };
  lists.forEach(visit);
  return [...found];
};
// What the encounter attaches to its visual events (encounter.js, `visual`):
// { id, delayCycles?, range?, position? }, a sound on a tile when it has a position.
const sound = ({ id, delayCycles = 0, range, position }) =>
  position ? { id, delayCycles, range: range ?? 1, position: [...position], channel: "area" } : { id, delayCycles, channel: "sfx" };

// A minion's tile as it is last hit: its death event names no tile.
const lastHitAt = new Map();

export const phosanisNightmareAudio = {
  layerName: "phosanis_nightmare",
  rules: {
    zuk_attack: {
      preloadIds: ids(Object.values(impactSounds), Object.values(runs)),
      resolve({ attack, projectileArrivalCycles }) {
        if (!Object.hasOwn(runs, attack)) return { kind: "pass" };
        const impact = impactSounds[attack];
        return play([...everywhere(runs[attack]), ...(impact ? [{ id: impact, delayCycles: projectileArrivalCycles ?? 0, channel: "sfx" }] : [])]);
      },
    },
    inferno_visual: {
      preloadIds: ids(Object.values(sounds), Object.values(clipRuns), clawRun, totemRun, Object.values(minionRuns).flatMap(Object.values)),
      resolve({ nightmareSounds, animations = [], graphics = [], projectiles = [] }) {
        const clips = animations.flatMap(({ actorId, clipId }) => {
          if (actorId === bossActorId) return clipRuns[clipId] ? [clipRuns[clipId]] : [];
          const prefix = ofMinion(actorId);
          return prefix && minionRuns[prefix][clipId] ? [minionRuns[prefix][clipId]] : [];
        });
        return play([
          ...(nightmareSounds ?? []).map(sound),
          ...clips.flatMap(everywhere),
          ...(graphics.some(({ spotAnimId }) => spotAnimId === spotAnims.claw) ? everywhere(clawRun) : []),
          ...(projectiles.some(({ spotAnimId }) => spotAnimId === spotAnims.totemBolt) ? everywhere(totemRun) : []),
        ]);
      },
    },
    hit_applied: {
      preloadIds: [hitOnHer.id, 227],
      resolve({ targetId, targetPosition, accurate, attackKind }) {
        if (ofMinion(targetId) && targetPosition) lastHitAt.set(targetId, [...targetPosition]);
        if (targetId !== bossActorId || !targetPosition) return { kind: "pass" };
        const middle = targetPosition.map((at) => at + Math.floor(bossSize / 2));
        // A magic splash: the shared rule's sound too (application.js, coreAudioRules), which this answer would
        // hide. The game plays both on the Maggot King (maggot-king/audio.js); inferred to be the same here.
        const splashed = accurate === false && typeof attackKind === "string" && attackKind.startsWith("magic");
        return play([{ ...hitOnHer, position: middle, channel: "area" }, ...(splashed ? [{ id: 227, range: 10, position: [...targetPosition], channel: "area" }] : [])]);
      },
    },
    actor_died: {
      preloadIds: ids(deathRun, Object.values(minionDeaths)),
      resolve({ actorId }) {
        if (actorId === bossActorId) return play(everywhere(deathRun));
        const prefix = ofMinion(actorId);
        const at = lastHitAt.get(actorId);
        lastHitAt.delete(actorId);
        if (!prefix || !minionDeaths[prefix]) return { kind: "pass" };
        return play(minionDeaths[prefix].map(({ id, range, delayCycles }) =>
          range && at ? { id, range, position: at, ...(delayCycles ? { delayCycles } : {}), channel: "area" } : { id, ...(delayCycles ? { delayCycles } : {}), channel: "sfx" }));
      },
    },
  },
};
