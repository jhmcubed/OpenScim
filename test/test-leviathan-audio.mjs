// The Leviathan's sounds that the game's server sends (leviathan/audio.js): the
// rules answer its events and no others, and every sound they name is in the
// trimmed cache's list. One that is not in it throws nothing: it is silent
// (docs/ADDING-AN-ENCOUNTER.md, section 7).
import assert from "node:assert/strict";
import { register } from "node:module";
import { readCacheGroups } from "../tools/assets/cache-groups.mjs";

// encounter.js imports what Node loads only through the harness's hooks.
register(new URL("../tools/determinism/node-hooks.mjs", import.meta.url).href);
for (const name of ["self", "window"]) globalThis[name] ??= globalThis;
const { leviathanAudio } = await import("../client/encounters/leviathan/audio.js");

const { inferno_visual: visual, hit_applied: hit, zuk_attack: attack } = leviathanAudio.rules;
const pass = { kind: "pass" };
const play = (...sound) => ({ kind: "play", sound });
const everywhere = (id, delayCycles) => ({ id, ...(delayCycles ? { delayCycles } : {}), channel: "sfx" });
const event = (fields) => ({ type: "inferno_visual", eventId: 1, tick: 9, animations: [], projectiles: [], graphics: [], ...fields });
const clip = (clipId, actorId = "leviathan") => ({ animations: [{ actorId, clipId, delayCycles: 0 }] });
const graphic = (spotAnimId, x, y, delayCycles = 0) => ({ spotAnimId, target: { kind: "tile", position: [x, y] }, height: 0, delayCycles });
const rock = (x, y, delayCycles) => [3308, 7035].map((id) => ({ id, range: 5, channel: "area", ...(delayCycles ? { delayCycles } : {}), position: [x, y] }));

for (const [kind, id] of [["leviathan_magic", 7030], ["leviathan_range", 7041], ["leviathan_melee", 7040]]) assert.deepEqual(attack.resolve({ type: "zuk_attack", attack: kind }), play(everywhere(id)));
for (const kind of ["leviathan_bite", "duke_magic", undefined]) assert.deepEqual(attack.resolve({ type: "zuk_attack", attack: kind }), pass);

for (const [clipId, sound] of [["spawn", everywhere(7037)], ["roar", everywhere(7043, 5)], ["lightning", everywhere(7051, 41)], ["spit", everywhere(7032, 9)]])
  assert.deepEqual(visual.resolve(event(clip(clipId))), play(sound), clipId);
assert.deepEqual(visual.resolve(event({ lightningCharges: true })), play(everywhere(7486, 10)));
assert.deepEqual(visual.resolve(event({ rockHit: true })), play(everywhere(7049, 30)));
for (const [id, sound] of [[2493, everywhere(7050, 4)], [2494, everywhere(7044, 17)], [2505, everywhere(7045)], [2492, everywhere(7023)], [2490, everywhere(7026)]])
  assert.deepEqual(visual.resolve(event({ graphics: [graphic(id, 33, 36)] })), play(sound), String(id));
assert.deepEqual(visual.resolve(event({ projectiles: [{ spotAnimId: 2472, target: { kind: "tile", position: [41, 30] } }] })), play(everywhere(7028, 2)));
// The pathfinder's mark is heard once, however many tiles it covers.
assert.deepEqual(visual.resolve(event({ graphics: [graphic(2298, 39, 42), graphic(2298, 39, 43)] })), play(everywhere(1678)));
assert.deepEqual(visual.resolve(event({ graphics: [graphic(2507, 38, 38)] })), play({ id: 7021, range: 6, channel: "area", position: [38, 38] }));
assert.deepEqual(visual.resolve(event({ graphics: [graphic(2504, 27, 32), graphic(2504, 39, 41)] })), play(...[[27, 32], [39, 41]].map((position) => ({ id: 7039, range: 3, channel: "area", position }))));
// A thrown rock is heard as it lands; one that falls, as it will land, 6, 7 or 8 ticks on.
assert.deepEqual(visual.resolve(event({ graphics: [graphic(2473, 41, 30)] })), play(...rock(41, 30)));
assert.deepEqual(
  visual.resolve(event({ graphics: [graphic(2478, 41, 30, 50), graphic(2476, 25, 30, 20), graphic(2475, 26, 30, 80)] })),
  play(...rock(41, 30, 210), ...rock(25, 30, 180), ...rock(26, 30, 240)),
);
const silent = [clip("orbStart"), clip("stunned"), clip("roar", "zebak"), clip("spawn", "abyssal-pathfinder"), clip("weakSpot", "leviathan-tail-0"), {}, { graphics: [graphic(2503, 38, 34)] }, { projectiles: [{ spotAnimId: 2506 }] }];
for (const fields of silent) assert.deepEqual(visual.resolve(event(fields)), pass, JSON.stringify(fields));
assert.deepEqual(visual.resolve({ type: "inferno_visual" }), pass);

// A hit that hurts it is heard from its middle tile.
assert.deepEqual(hit.resolve({ type: "hit_applied", targetId: "leviathan", damage: 1 }), play({ id: 7031, range: 10, position: [33, 36], channel: "area" }));
for (const other of [{ targetId: "leviathan", damage: 0 }, { targetId: "player", damage: 9 }, { targetId: "zebak", damage: 9 }]) assert.deepEqual(hit.resolve({ type: "hit_applied", ...other }), pass);

const listed = new Set(readCacheGroups()[4]);
const ids = Object.values(leviathanAudio.rules).flatMap((rule) => rule.preloadIds);
assert.deepEqual(
  [...new Set(ids)].sort((a, b) => a - b),
  [1678, 3308, 7021, 7023, 7026, 7028, 7030, 7031, 7032, 7035, 7037, 7039, 7040, 7041, 7043, 7044, 7045, 7049, 7050, 7051, 7486],
);
for (const id of ids) assert.ok(listed.has(id), `sound ${id} is not under "4" in a list of tools/assets/cache-groups.mjs`);
console.log("The Leviathan's 21 sounds answer its own events, and all are in the cache list");
