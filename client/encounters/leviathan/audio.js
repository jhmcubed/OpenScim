// Its sounds that are in no animation. The game's server sends them, so here
// they are rules, keyed by the type of a tick event
// (docs/ADDING-AN-ENCOUNTER.md, section 5, `audio`). The layers of all
// encounters hear every event: a rule answers `pass` to what is not its own.
// The sounds of the frames of its animations and the tornado's are in the
// cache with them, and the scene plays those.
//
// OBS 11/25 as in encounter.js: each is there every time what it goes with is,
// and the count is of those. OBS 11/26: 31 recordings of two players
// (outside.wiki), post-quest and awakened. Not recorded, so without a sound
// here: the bite's hit, a roar's rock on the player.
// Recorded but not here: as the rubble crumbles, 8 ticks after the kill, 7035
// (range 10) from each rock the tick after its graphic, 2474. The fight draws
// 2474 as the Leviathan is removed (encounter.js, crumbleRubble) and stops then,
// before the sound's tick.
import { bossActorId, bossSize, bossStart, spots } from "./encounter.js";

// With no place: as loud wherever the player stands. Delays in cycles.
const everywhere = (id, delayCycles = 0) => ({ id, ...(delayCycles ? { delayCycles } : {}), channel: "sfx" });
const surfaceSound = everywhere(7037); // 4 of 4
const orbSounds = {
  leviathan_magic: everywhere(7030), // 40 of 40. CACHE, WIKI: its launch
  leviathan_range: everywhere(7041), // 26 of 26
  leviathan_melee: everywhere(7040), // 12 of 12
};
const roarSound = everywhere(7043, 5); // 53 of 53: as a stun is broken, the special begins and the enrage roars
const lightningSounds = { charge: everywhere(7486, 10), start: everywhere(7051, 41), strike: everywhere(7050, 4) }; // 23, 23 and 805
const smokeSounds = { spit: everywhere(7032, 9), rock: everywhere(7028, 2), charge: everywhere(7044, 17), blast: everywhere(7045) }; // 21, 210, 21 and 21
// 9 of 9, 3 of 3; melee OBS 11/26: 5 of 5, the impact drawn on a player it hurts
const impactSounds = { [spots.impact.magic]: everywhere(7023), [spots.impact.range]: everywhere(7026), [spots.impact.melee]: everywhere(7025) };
const rockHitSound = everywhere(7049, 30); // 4 of 4 rocks on the player, thrown or loose
// OBS 11/26: with the rocks of a roar, on the tick they start to fall: 183 of
// 192 roars, the enrage's among them (with the pathfinder's mark); 8 of the 9
// without are of one recording, which has no death sound either. None of 85
// waves of rocks while enraged.
const roarRocksSound = everywhere(1678);

// Heard from a tile.
const hurtSound = { id: 7031, range: 10, position: bossStart.map((at) => at + Math.floor(bossSize / 2)), channel: "area" }; // 200 of the 203 hits that hurt it
const rockSounds = [3308, 7035].map((id) => ({ id, range: 5, channel: "area" })); // 289 of 289 rocks that land
const sideOrbSound = { id: 7039, range: 3, channel: "area" }; // 1,164 of 1,164
const tornadoSound = { id: 7021, range: 6, channel: "area" }; // 9 of 9
// OBS 11/26: with its death animation (24 of 25; the 25th is the recording
// named above), 9 cycles in, from its middle tile as its hurt sound. The animation
// comes on the tick of the kill or the one after; here with the kill.
const deathSound = { ...hurtSound, id: 7034, range: 15, delayCycles: 9 };

// A falling rock's sounds come as it lands: so many cycles after it is sent.
const landsAfter = (spotAnimId, delayCycles) =>
  spots.falling.includes(spotAnimId) ? 210 : spots.debris.includes(spotAnimId) ? { 20: 180, 50: 210, 80: 240 }[delayCycles] : spotAnimId === spots.boulderLands ? 0 : null;

const play = (sounds) => (sounds.length > 0 ? { kind: "play", sound: sounds } : { kind: "pass" });

export const leviathanAudio = {
  layerName: "leviathan",
  rules: {
    zuk_attack: {
      preloadIds: Object.values(orbSounds).map(({ id }) => id),
      resolve: ({ attack }) => play(Object.hasOwn(orbSounds, attack) ? [orbSounds[attack]] : []),
    },
    inferno_visual: {
      preloadIds: [surfaceSound, roarSound, ...Object.values(lightningSounds), ...Object.values(smokeSounds), ...Object.values(impactSounds), rockHitSound, roarRocksSound, ...rockSounds, sideOrbSound, tornadoSound].map(({ id }) => id),
      resolve({ lightningCharges, rockHit, roarRocks, animations = [], projectiles = [], graphics = [] }) {
        const starts = (clip) => animations.some(({ actorId, clipId }) => actorId === bossActorId && clipId === clip);
        const draws = (id) => graphics.some(({ spotAnimId }) => spotAnimId === id);
        return play([
          ...(starts("spawn") ? [surfaceSound] : []),
          ...(starts("roar") ? [roarSound] : []),
          ...(lightningCharges ? [lightningSounds.charge] : []),
          ...(starts("lightning") ? [lightningSounds.start] : []),
          ...(draws(spots.lightning) ? [lightningSounds.strike] : []),
          ...(starts("spit") ? [smokeSounds.spit] : []),
          ...(projectiles.some(({ spotAnimId }) => spotAnimId === spots.boulder) ? [smokeSounds.rock] : []),
          ...(draws(spots.blastCharge) ? [smokeSounds.charge] : []),
          ...(draws(spots.blast) ? [smokeSounds.blast] : []),
          ...Object.keys(impactSounds).filter((id) => draws(Number(id))).map((id) => impactSounds[id]),
          ...(rockHit ? [rockHitSound] : []),
          ...(roarRocks ? [roarRocksSound] : []),
          ...(draws(spots.tornadoHit) ? graphics.filter(({ spotAnimId }) => spotAnimId === spots.tornadoHit).map(({ target }) => ({ ...tornadoSound, position: [...target.position] })) : []),
          ...graphics.filter(({ spotAnimId }) => spotAnimId === spots.sideOrbLands).map(({ target }) => ({ ...sideOrbSound, position: [...target.position] })),
          ...graphics.flatMap(({ spotAnimId, target, delayCycles }) => {
            const after = landsAfter(spotAnimId, delayCycles);
            return after == null ? [] : rockSounds.map((sound) => ({ ...sound, ...(after ? { delayCycles: after } : {}), position: [...target.position] }));
          }),
        ]);
      },
    },
    hit_applied: {
      preloadIds: [hurtSound.id],
      resolve: ({ targetId, damage }) => play(targetId === bossActorId && damage > 0 ? [hurtSound] : []),
    },
    actor_died: {
      preloadIds: [deathSound.id],
      resolve: ({ actorId }) => play(actorId === bossActorId ? [deathSound] : []),
    },
  },
};
