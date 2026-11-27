// The Doom of Mokhaiotl's sounds that the game's server sends: a thrown rock
// bursting and each of its pieces landing, heard from their tiles with the
// recorded ranges and delays, and nothing for what is not his; every sound
// the rules name is in the trimmed cache's list. A sound that is not in it
// throws nothing: it is silent (docs/ADDING-AN-ENCOUNTER.md, section 7).
import assert from "node:assert/strict";
import { register } from "node:module";
import { readCacheGroups } from "../tools/assets/cache-groups.mjs";

// delves.js imports what Node loads only through the harness's hooks.
register(new URL("../tools/determinism/node-hooks.mjs", import.meta.url).href);
for (const name of ["self", "window"]) globalThis[name] ??= globalThis;
const { doomAudio } = await import("../client/encounters/doom-of-mokhaiotl/audio.js");
const { doomPresentation, doomDeepPresentation } = await import("../client/encounters/doom-of-mokhaiotl/presentation.js");

const { inferno_visual: visual } = doomAudio.rules;
const pass = { kind: "pass" };
const none = { animations: [], projectiles: [], graphics: [] };
const onTile = (spotAnimId, position, delayCycles = 0) => ({ spotAnimId, target: { kind: "tile", position }, height: 0, delayCycles, onGround: true });

// A burst (either style) with the shadows of its pieces: the burst alone is heard.
for (const split of [3386, 3387])
  assert.deepEqual(visual.resolve({ ...none, graphics: [onTile(split, [31, 33]), onTile(2380, [31, 30]), onTile(2380, [33, 29])] }), {
    kind: "play",
    sound: [{ id: 10331, range: 10, channel: "area", position: [31, 33] }],
  });
// Two ticks on, each piece as it lands, with its graphic's delay.
assert.deepEqual(visual.resolve({ ...none, graphics: [onTile(3404, [31, 30], 9), onTile(3404, [33, 29], 12), onTile(3404, [32, 31])] }), {
  kind: "play",
  sound: [
    { id: 10297, range: 1, channel: "area", delayCycles: 9, position: [31, 30] },
    { id: 10297, range: 1, channel: "area", delayCycles: 12, position: [33, 29] },
    { id: 10297, range: 1, channel: "area", position: [32, 31] },
  ],
});
// Not his rocks: the same graphic on an actor, his own animations, other graphics.
const onActor = { spotAnimId: 3404, target: { kind: "actor", actorId: "player" }, height: 0, delayCycles: 0 };
assert.deepEqual(visual.resolve({ ...none, graphics: [onActor, onTile(2380, [31, 30]), onTile(2699, [30, 30])] }), pass);
assert.deepEqual(visual.resolve({ ...none, animations: [{ actorId: "doom", clipId: "rockThrow", delayCycles: 0 }] }), pass);
assert.deepEqual(visual.resolve(none), pass);

// Both rooms play them.
for (const presentation of [doomPresentation, doomDeepPresentation]) assert.equal(presentation(class {}).audio, doomAudio);

const listed = new Set(readCacheGroups()[4]);
for (const [type, rule] of Object.entries(doomAudio.rules))
  for (const id of rule.preloadIds) assert.ok(listed.has(id), `sound ${id} of the ${type} rule is not under "4" in a list of tools/assets/cache-groups.mjs`);
assert.deepEqual(new Set(Object.values(doomAudio.rules).flatMap((rule) => rule.preloadIds)), new Set([10297, 10331]));
console.log("The Doom's rock bursts and their pieces are heard from their tiles, and their sounds are in the trimmed cache");
