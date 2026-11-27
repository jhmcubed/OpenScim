// The sounds of the fight that are in no animation. The game's server sends
// each of them, so here they are rules, keyed by the type of a tick event
// (docs/ADDING-AN-ENCOUNTER.md, section 5, `audio`). The layers of all
// encounters hear every event, the Doom's before the Leviathan's and the
// shared rules: a rule answers `pass` to what is not its own, and what it
// answers is all that plays of that event.
// The sounds of the frames of his animations are in the cache with them, and
// the scene plays those.
//
// OBS: the rock sounds as in delves.js; the others from one recorded run of
// delves 1 to 8 (SaluteCFlagg, 2026-11-23). Each is there every time what it
// goes with is, and the count is of those.
import { spotAnims, bossSize } from "./delves.js";
import { bossActorId } from "./encounter.js";

// Heard from a tile.
// A thrown rock bursting, from the tile it bursts on, as the graphic of the
// burst appears (828 of 828 bursts).
const burstSound = { id: 10331, range: 10, channel: "area" };
// Each piece of the rock landing, from its tile, as its impact graphic
// appears (13,940 of 13,940 pieces).
const pieceSound = { id: 10297, range: 1, channel: "area" };
// A hit of the player's that hurts him, from his middle tile, shielded or
// burrowed too (336 of 340; none with a hit of 0).
const hurtSound = { id: 10345, range: 10, channel: "area" };

// With no place.
// An orb of his own, as it leaves him: 55 cycles into his orb attack, at once
// from under the ground (95 of 95). A rock's orbs have none of their own.
const orbSounds = { magic: 10375, range: 10341, melee: 10367 };
// An orb's burst on the player, as it is drawn: magic 61 of 61, ranged 60 of
// 60. No melee orb burst on the player was recorded: 7025 is the Leviathan's
// for the same graphic (leviathan/audio.js).
const impactSounds = { magic: 7023, range: 7026, melee: 7025 };
// His shield breaking, with the animation (7 of 7).
const shieldBreakSounds = [{ id: 10303 }, { id: 10301, delayCycles: 45 }, { id: 10372, delayCycles: 160 }];

const rockSplits = new Set(Object.values(spotAnims.rockSplit));
const trails = new Set(Object.values(spotAnims.burrowOrbTrail));
const styleOf = (ids, spotAnimId) => Object.keys(ids).find((style) => ids[style] === spotAnimId);

const play = (sounds) => (sounds.length > 0 ? { kind: "play", sound: sounds } : { kind: "pass" });
const at = (sound, { target, delayCycles }) => ({ ...sound, ...(delayCycles ? { delayCycles } : {}), position: [...target.position] });
const everywhere = (id, delayCycles = 0) => ({ id, ...(delayCycles ? { delayCycles } : {}), channel: "sfx" });

// His own orbs leave him 55 cycles in, or at once from under the ground with a
// trail (burrow.js). A rock's leave at once, with no trail (hazards.js).
const ownOrbs = (projectiles) => {
  const burrowed = projectiles.some(({ spotAnimId }) => trails.has(spotAnimId));
  return projectiles.flatMap(({ spotAnimId, startDelayCycles = 0 }) => {
    const style = styleOf(spotAnims.orb, spotAnimId);
    return style && (burrowed || startDelayCycles > 0) ? [everywhere(orbSounds[style], startDelayCycles)] : [];
  });
};

export const doomAudio = {
  layerName: "doomOfMokhaiotl",
  rules: {
    inferno_visual: {
      preloadIds: [burstSound.id, pieceSound.id, ...Object.values(orbSounds), ...Object.values(impactSounds), ...shieldBreakSounds.map(({ id }) => id)],
      resolve: ({ animations = [], projectiles = [], graphics = [] }) =>
        play([
          ...(animations.some(({ actorId, clipId }) => actorId === bossActorId && clipId === "shieldBreak") ? shieldBreakSounds.map(({ id, delayCycles }) => everywhere(id, delayCycles)) : []),
          ...ownOrbs(projectiles),
          ...graphics.flatMap((graphic) => {
            if (graphic.target?.kind === "actor") {
              const style = styleOf(spotAnims.orbImpact, graphic.spotAnimId);
              return style ? [everywhere(impactSounds[style])] : [];
            }
            if (graphic.target?.kind !== "tile") return [];
            if (rockSplits.has(graphic.spotAnimId)) return [at(burstSound, graphic)];
            if (graphic.spotAnimId === spotAnims.debrisImpact) return [at(pieceSound, graphic)];
            return [];
          }),
        ]),
    },
    hit_applied: {
      preloadIds: [hurtSound.id],
      resolve: ({ targetId, targetPosition, damage }) =>
        play(targetId === bossActorId && damage > 0 && targetPosition ? [{ ...hurtSound, position: targetPosition.map((at) => Math.floor(at) + (bossSize >> 1)) }] : []),
    },
  },
};
