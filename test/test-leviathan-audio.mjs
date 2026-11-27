// The Leviathan's sounds that the game's server sends (leviathan/audio.js): the
// rules answer its events and no others, and every sound they name is in the
// trimmed cache's list. One that is not in it throws nothing: it is silent
// (docs/ADDING-AN-ENCOUNTER.md, section 7). Then fights of the harness, heard
// through the rules: a sound comes on the tick of what it goes with.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readCacheGroups } from "../tools/assets/cache-groups.mjs";
import { cacheZip, loadEnvironment, runScenario } from "../tools/determinism/harness.mjs";
import { installHooks } from "../tools/determinism/node-hooks.mjs";

// encounter.js imports what Node loads only through the harness's hooks: the
// harness registers them as it loads, without the cache this test does.
const fights = existsSync(cacheZip);
if (fights) await loadEnvironment();
else installHooks();
for (const name of ["self", "window"]) globalThis[name] ??= globalThis;
const { leviathanAudio } = await import("../client/encounters/leviathan/audio.js");

const { inferno_visual: visual, hit_applied: hit, zuk_attack: attack, actor_died: died } = leviathanAudio.rules;
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
for (const [id, sound] of [[2493, everywhere(7050, 4)], [2494, everywhere(7044, 17)], [2505, everywhere(7045)], [2492, everywhere(7023)], [2490, everywhere(7026)], [2491, everywhere(7025)]])
  assert.deepEqual(visual.resolve(event({ graphics: [graphic(id, 33, 36)] })), play(sound), String(id));
assert.deepEqual(visual.resolve(event({ projectiles: [{ spotAnimId: 2472, target: { kind: "tile", position: [41, 30] } }] })), play(everywhere(7028, 2)));
// A roar's rocks are heard once as they start to fall, however many there are.
assert.deepEqual(visual.resolve(event({ roarRocks: true })), play(everywhere(1678)));
assert.deepEqual(visual.resolve(event({ graphics: [graphic(2507, 38, 38)] })), play({ id: 7021, range: 6, channel: "area", position: [38, 38] }));
assert.deepEqual(visual.resolve(event({ graphics: [graphic(2504, 27, 32), graphic(2504, 39, 41)] })), play(...[[27, 32], [39, 41]].map((position) => ({ id: 7039, range: 3, channel: "area", position }))));
// A thrown rock is heard as it lands; one that falls, as it will land, 6, 7 or 8 ticks on.
assert.deepEqual(visual.resolve(event({ graphics: [graphic(2473, 41, 30)] })), play(...rock(41, 30)));
assert.deepEqual(
  visual.resolve(event({ graphics: [graphic(2478, 41, 30, 50), graphic(2476, 25, 30, 20), graphic(2475, 26, 30, 80)] })),
  play(...rock(41, 30, 210), ...rock(25, 30, 180), ...rock(26, 30, 240)),
);
const silent = [{ graphics: [graphic(2298, 39, 42)] }, clip("orbStart"), clip("stunned"), clip("roar", "zebak"), clip("spawn", "abyssal-pathfinder"), clip("weakSpot", "leviathan-tail-0"), {}, { graphics: [graphic(2503, 38, 34)] }, { projectiles: [{ spotAnimId: 2506 }] }];
for (const fields of silent) assert.deepEqual(visual.resolve(event(fields)), pass, JSON.stringify(fields));
assert.deepEqual(visual.resolve({ type: "inferno_visual" }), pass);

// A hit that hurts it is heard from its middle tile.
assert.deepEqual(hit.resolve({ type: "hit_applied", targetId: "leviathan", damage: 1 }), play({ id: 7031, range: 10, position: [33, 36], channel: "area" }));
for (const other of [{ targetId: "leviathan", damage: 0 }, { targetId: "player", damage: 9 }, { targetId: "zebak", damage: 9 }]) assert.deepEqual(hit.resolve({ type: "hit_applied", ...other }), pass);
// Its death, from there too.
assert.deepEqual(died.resolve({ type: "actor_died", actorId: "leviathan" }), play({ id: 7034, range: 15, position: [33, 36], channel: "area", delayCycles: 9 }));
for (const actorId of ["player", "zebak", "leviathan-tornado"]) assert.deepEqual(died.resolve({ type: "actor_died", actorId }), pass);

const listed = new Set(readCacheGroups()[4]);
const ids = Object.values(leviathanAudio.rules).flatMap((rule) => rule.preloadIds);
assert.deepEqual(
  [...new Set(ids)].sort((a, b) => a - b),
  [1678, 3308, 7021, 7023, 7025, 7026, 7028, 7030, 7031, 7032, 7034, 7035, 7037, 7039, 7040, 7041, 7043, 7044, 7045, 7049, 7050, 7051, 7486],
);
for (const id of ids) assert.ok(listed.has(id), `sound ${id} is not under "4" in a list of tools/assets/cache-groups.mjs`);
console.log("The Leviathan's 23 sounds answer its own events, and all are in the cache list");

// Fights: every event of a tick through the rules, with the ticks of the rocks and of its death.
const { attack: shoot, rangedGear, setBossHp } = await import("../tools/determinism/scenarios/common.mjs");
async function fight({ ticks, script }) {
  const log = [];
  const mechanics = { infiniteHealth: true, infinitePrayer: true, infiniteStamina: true };
  await runScenario({ name: "leviathan-audio", kind: "leviathan", seed: 5, ticks, mechanics, ...rangedGear, script }, {
    onTick(tick, engine) {
      for (const event of engine.getLastTickEvents()) {
        const answer = leviathanAudio.rules[event.type]?.resolve(event);
        for (const { id } of answer?.kind === "play" ? answer.sound : []) log.push({ tick, sound: id });
        if (event.type === "inferno_visual") for (const { spotAnimId } of event.graphics) log.push({ tick, graphic: spotAnimId });
        if (event.type === "actor_died") log.push({ tick, died: event.actorId });
      }
    },
  });
  const ticksOf = (test) => [...new Set(log.filter(test).map(({ tick }) => tick))];
  return { rocks: ticksOf(({ graphic }) => graphic >= 2477 && graphic <= 2480), heard: (id) => ticksOf(({ sound }) => sound === id), died: ticksOf(({ died }) => died === "leviathan") };
}
if (!fights) console.log(`skipped the fights: ${cacheZip} is missing (npm run assets)`);
else {
  // A roar after a one-tick volley: its rocks start to fall with 1678.
  const roar = await fight({ ticks: 24, script: (tick, api) => tick === 1 && (api.engine.encounter.volley = 3) });
  assert.ok(roar.rocks.length > 0, "no roar");
  assert.deepEqual(roar.heard(1678), roar.rocks);
  // Enraged: the enrage's roar is heard with its rocks, the waves after it are not.
  const enraged = await fight({ ticks: 40, script: (tick, api) => tick === 1 && setBossHp(api, 180) });
  assert.ok(enraged.rocks.length >= 3, enraged.rocks.join());
  assert.deepEqual(enraged.heard(1678), enraged.rocks.slice(0, 1));
  // The kill: its death sound on the tick it dies.
  const kill = await fight({ ticks: 80, script(tick, api) {
    if (tick === 1) setBossHp(api, 1);
    if (tick > 8) shoot(api, "leviathan");
  } });
  assert.equal(kill.died.length, 1, "it did not die");
  assert.deepEqual(kill.heard(7034), kill.died);
  console.log("In a fight: a roar's rocks, the enrage's alone, and its death are heard on their ticks");
}
