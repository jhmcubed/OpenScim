// The sounds of the fight that are in no animation. The game's server sends
// each of them, so here they are rules, keyed by the type of a tick event
// (docs/ADDING-AN-ENCOUNTER.md, section 5, `audio`). The layers of all
// encounters hear every event: a rule answers `pass` to what is not its own.
// The sounds of the frames of his animations are in the cache with them, and
// the scene plays those.
//
// OBS as in delves.js (19 recordings of delves 1 to 8). Both are heard from
// a tile, with no delay of their own but the graphic's.
import { spotAnims } from "./delves.js";

// OBS: a thrown rock bursting, from the tile it bursts on, as the graphic of
// the burst appears (828 of 828 bursts).
const burstSound = { id: 10331, range: 10, channel: "area" };
// OBS: each piece of the rock landing, from its tile, as its impact graphic
// appears (13,940 of 13,940 pieces).
const pieceSound = { id: 10297, range: 1, channel: "area" };
const rockSplits = new Set(Object.values(spotAnims.rockSplit));

const play = (sounds) => (sounds.length > 0 ? { kind: "play", sound: sounds } : { kind: "pass" });
const at = (sound, { target, delayCycles }) => ({ ...sound, ...(delayCycles ? { delayCycles } : {}), position: [...target.position] });

export const doomAudio = {
  layerName: "doomOfMokhaiotl",
  rules: {
    inferno_visual: {
      preloadIds: [burstSound.id, pieceSound.id],
      resolve: ({ graphics = [] }) =>
        play(
          graphics.flatMap((graphic) => {
            if (graphic.target?.kind !== "tile") return [];
            if (rockSplits.has(graphic.spotAnimId)) return [at(burstSound, graphic)];
            if (graphic.spotAnimId === spotAnims.debrisImpact) return [at(pieceSound, graphic)];
            return [];
          }),
        ),
    },
  },
};
