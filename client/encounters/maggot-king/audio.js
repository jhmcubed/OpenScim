// The Maggot King's sounds that are in no animation. The game's server sends
// them, so here they are rules, keyed by the type of a tick event
// (docs/ADDING-AN-ENCOUNTER.md, section 5, `audio`). The layers of all
// encounters hear every event: a rule answers `pass` to what is not its own.
// The sounds of the frames of his and the larvae's animations (the spits, the
// slam, the screech, his walk and death) are in the cache with them, and the
// scene plays those.
//
// OBS 15 kills, as in encounter.js: each is there every time what it goes with
// is, and the count is of those. Delays in cycles.
import { bossActorId } from "./encounter.js";
import { spotAnims } from "./ids.js";

const larvaPrefix = "maggot-larva-"; // larvae.js
const bileTicks = 3; // encounter.js: the bile lies 3 ticks after the spit lands
const fragmentTicks = 2; // encounter.js: a fragment lands 2 ticks after its pile breaks

// Heard from a tile.
// Where a spit lands, the player's tile as he spits: 178 of 178 ranged, 146 of 146 magic.
const spitSounds = { maggot_king_range: 11837, maggot_king_magic: 11822 };
// A pile breaking into fragments, from the pile (786 of 789).
const pileBreaks = { id: 11840, range: 2 };
// Whatever lands on the floor and lies there, from its tile, as it lands:
// carrion, poisonous and sticky bile (4,273 of 4,273). 3, 4 or 5 cycles in, a
// third each, at random (OBS); here by the tile, the same each time.
const lands = { id: 11027, range: 2 };
const landsAfter = ([x, y]) => 3 + ((x + 2 * y) % 3);
// The shared rule's magic splash (application.js, coreAudioRules), which an
// answer here would hide: the game plays both (81 splashes).
const splash = { id: 227, range: 10 };

// With no place.
const hurt = 11820; // 1,269 of 1,269 hits of the player's on him, 0 or not
const larvaHit = 603; // 100 of 101 hits on a larva
// A larva's death, with its animation: as the player kills it (64 of 64), and
// as all die with him (21 of 21; range 10 in the game, from the larva: the event
// names no tile). Its animation comes 2 or 3 ticks after the kill; here with
// the kill, as the scene draws it.
const larvaDies = 602;

const play = (sounds) => (sounds.length > 0 ? { kind: "play", sound: sounds } : { kind: "pass" });
const atTile = ({ id, range }, position, delayCycles = 0) => ({ id, range, position: [...position], ...(delayCycles ? { delayCycles } : {}), channel: "area" });
const everywhere = (id) => ({ id, channel: "sfx" });
const tileOf = (position) => position.map(Math.floor);
const sameTile = (a, b) => a[0] === b[0] && a[1] === b[1];
const isSplash = ({ accurate, attackKind }) => accurate === false && typeof attackKind === "string" && attackKind.startsWith("magic");

export const maggotKingAudio = {
  layerName: "maggotKing",
  rules: {
    zuk_attack: {
      preloadIds: Object.values(spitSounds),
      resolve: ({ attack, targetPosition }) =>
        play(Object.hasOwn(spitSounds, attack) && targetPosition ? [atTile({ id: spitSounds[attack], range: 1 }, targetPosition, 60)] : []),
    },
    inferno_visual: {
      preloadIds: [pileBreaks.id, lands.id, larvaDies],
      resolve({ animations = [], projectiles = [], graphics = [] }) {
        const fragments = projectiles.filter(({ spotAnimId }) => spotAnimId === spotAnims.fragment);
        const piles = [];
        for (const { sourcePosition } of fragments) {
          const pile = tileOf(sourcePosition);
          if (!piles.some((other) => sameTile(other, pile))) piles.push(pile);
        }
        // The tiles a spit splashes: its bile lies there bileTicks later.
        const splashed = graphics.filter(({ spotAnimId }) => spotAnimId === spotAnims.splat).map(({ target }) => target.position);
        return play([
          ...piles.map((pile) => atTile(pileBreaks, pile)),
          ...fragments.map(({ target }) => atTile(lands, target.position, fragmentTicks * 30 + landsAfter(target.position))),
          ...splashed.map((tile) => atTile(lands, tile, bileTicks * 30 + landsAfter(tile))),
          ...(animations.some(({ actorId, clipId }) => actorId?.startsWith(larvaPrefix) && clipId === "death") ? [everywhere(larvaDies)] : []),
        ]);
      },
    },
    hit_applied: {
      preloadIds: [hurt, larvaHit, splash.id],
      resolve(event) {
        const { targetId, targetPosition } = event;
        const splashed = isSplash(event) && targetPosition ? [atTile(splash, targetPosition)] : [];
        if (targetId === bossActorId) return play([everywhere(hurt), ...splashed]);
        if (typeof targetId === "string" && targetId.startsWith(larvaPrefix)) return play([everywhere(larvaHit), ...splashed]);
        return { kind: "pass" };
      },
    },
    actor_died: {
      preloadIds: [larvaDies],
      resolve: ({ actorId }) => play(typeof actorId === "string" && actorId.startsWith(larvaPrefix) ? [everywhere(larvaDies)] : []),
    },
  },
};
