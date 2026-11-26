// Phosani's Nightmare's sounds that the game's server sends (phosanis-nightmare/audio.js): the rules answer
// her events and no others, every sound they name is in the trimmed cache's list (one that is not is silent:
// docs/ADDING-AN-ENCOUNTER.md, section 7), and in a kill of the harness each comes on the tick of what it goes with.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { register } from "node:module";
import { readCacheGroups } from "../tools/assets/cache-groups.mjs";
import { cacheZip, loadEnvironment, runScenario } from "../tools/determinism/harness.mjs";

// encounter.js imports what Node loads only through the harness's hooks: the harness registers them as it loads,
// without the cache this test does.
const fights = existsSync(cacheZip);
if (fights) await loadEnvironment();
else register(new URL("../tools/determinism/node-hooks.mjs", import.meta.url).href);
for (const name of ["self", "window"]) globalThis[name] ??= globalThis;
const { phosanisNightmareAudio: audio } = await import("../client/encounters/phosanis-nightmare/audio.js");

const { zuk_attack: attack, inferno_visual: visual, hit_applied: hit, actor_died: died } = audio.rules;
const pass = { kind: "pass" };
const heard = (answer) => (answer.kind === "play" ? answer.sound.map(({ id, delayCycles = 0 }) => [id, delayCycles]) : []);
const visualOf = (fields) => ({ type: "inferno_visual", animations: [], projectiles: [], graphics: [], ...fields });
const clip = (clipId, actorId = "phosanis-nightmare") => visualOf({ animations: [{ actorId, clipId, delayCycles: 0 }] });

// Her attacks: their run, and the impact of a magic or ranged one as it lands.
assert.deepEqual(heard(attack.resolve({ attack: "phosanis_nightmare_magic", projectileArrivalCycles: 60 })), [[4334, 10], [4239, 32], [4286, 35], [4333, 50], [4258, 84], [223, 60]]);
assert.deepEqual(heard(attack.resolve({ attack: "phosanis_nightmare_range", projectileArrivalCycles: 50 })), [[4221, 2], [4251, 26], [4340, 56], [4237, 86], [4270, 90], [4323, 93], [4219, 50]]);
assert.deepEqual(heard(attack.resolve({ attack: "phosanis_nightmare_melee" })), [[4327, 6], [4253, 24], [4282, 51]]);
assert.deepEqual(attack.resolve({ attack: "leviathan_magic" }), pass);
// Her specials share a run; the curse and the flowers add one of their own.
const special = [[4310, 3], [4225, 34], [4331, 62], [4325, 68], [4330, 78]];
for (const name of ["spores", "husks"]) assert.deepEqual(heard(visual.resolve(clip(name))), special, name);
assert.deepEqual(heard(visual.resolve(clip("curse"))), [...special, [4287, 0]]);
assert.deepEqual(heard(visual.resolve(clip("flowers"))), [...special, [4284, 6]]);
assert.deepEqual(heard(visual.resolve(clip("leave"))), [[4271, 9], [4337, 19]]);
assert.deepEqual(heard(visual.resolve(clip("blast"))), [[4328, 54], [4293, 59], [4297, 62], [4259, 74]]);
// A set of claws is heard once, however many portals; the totems' bolts once, however many totems.
const claw = (x) => ({ spotAnimId: 1767, target: { kind: "tile", position: [x, 30] }, height: 0, delayCycles: 0 });
assert.deepEqual(heard(visual.resolve(visualOf({ graphics: [claw(25), claw(26), claw(27)] }))), [[4307, 3], [4274, 54], [4228, 58], [4322, 165]]);
assert.deepEqual(heard(visual.resolve(visualOf({ projectiles: [{ spotAnimId: 1768 }, { spotAnimId: 1768 }] }))), [[4032, 30], [4031, 90]]);
// The minions', by the start of their ids; another fight's clips of the same name are not hers.
assert.deepEqual(heard(visual.resolve(clip("rise", "nightmare-husk-3-magic"))), [[4341, 0]]);
assert.deepEqual(heard(visual.resolve(clip("magic", "nightmare-husk-3-magic"))), [[4302, 15], [218, 28], [219, 67]]);
assert.deepEqual(heard(visual.resolve(clip("rise", "nightmare-parasite-0"))), [[1457, 0]]);
for (const event of [clip("roar", "leviathan"), clip("spawn", "leviathan"), clip("rise", "colosseum-minion"), visualOf({})]) assert.deepEqual(visual.resolve(event), pass);
// What the encounter attaches still plays, as before.
assert.deepEqual(visual.resolve(visualOf({ nightmareSounds: [{ id: 4254 }] })), { kind: "play", sound: [{ id: 4254, delayCycles: 0, channel: "sfx" }] });

// A hit on her, from her middle tile; with a magic splash, the shared rule's splash too.
assert.deepEqual(hit.resolve({ targetId: "phosanis-nightmare", targetPosition: [30, 29], damage: 0 }), { kind: "play", sound: [{ id: 4281, range: 7, position: [32, 31], channel: "area" }] });
assert.deepEqual(heard(hit.resolve({ targetId: "phosanis-nightmare", targetPosition: [30, 29], damage: 0, accurate: false, attackKind: "magic" })), [[4281, 0], [227, 0]]);
assert.deepEqual(hit.resolve({ targetId: "player", targetPosition: [33, 28], damage: 5 }), pass);
// A minion that dies is heard from the tile it was last hit on.
assert.deepEqual(hit.resolve({ targetId: "nightmare-sleepwalker-2", targetPosition: [25, 30], damage: 10 }), pass);
assert.deepEqual(died.resolve({ actorId: "nightmare-sleepwalker-2" }), { kind: "play", sound: [{ id: 4292, range: 10, position: [25, 30], channel: "area" }, { id: 4223, channel: "sfx" }] });
assert.deepEqual(heard(died.resolve({ actorId: "phosanis-nightmare" })), [[4295, 6], [4315, 38], [4275, 72], [4246, 111], [4269, 132], [4226, 192], [4313, 195]]);
for (const actorId of ["player", "leviathan"]) assert.deepEqual(died.resolve({ actorId }), pass);

const listed = new Set(readCacheGroups()[4]);
const ids = [...new Set(Object.values(audio.rules).flatMap((rule) => rule.preloadIds))];
assert.equal(ids.length, 76);
for (const id of ids) assert.ok(listed.has(id), `sound ${id} is not under "4" in a list of tools/assets/cache-groups.mjs`);
console.log(`Phosani's Nightmare's ${ids.length} sounds answer her own events, and all are in the cache list`);

if (!fights) console.log(`skipped the fight: ${cacheZip} is missing (npm run assets)`);
else {
  // The harness's kill: every event of a tick through the rules, and what each should bring on that tick.
  const { scenarios } = await import("../tools/determinism/scenarios/phosanis-nightmare.mjs");
  const kill = scenarios.find(({ name }) => name === "phosanis-nightmare/kill");
  const wanted = []; // [tick, id, what]
  const played = new Set(); // "tick:id"
  await runScenario(kill, {
    onTick(tick, engine) {
      for (const event of engine.getLastTickEvents()) {
        const rule = audio.rules[event.type];
        const answer = rule?.resolve(event);
        for (const [id] of answer ? heard(answer) : []) played.add(`${tick}:${id}`);
        if (event.type === "zuk_attack" && event.attack === "phosanis_nightmare_magic") wanted.push([tick, 4334, "her magic"]);
        if (event.type === "zuk_attack" && event.attack === "phosanis_nightmare_melee") wanted.push([tick, 4327, "her melee"]);
        if (event.type === "hit_applied" && event.targetId === "phosanis-nightmare") wanted.push([tick, 4281, "a hit on her"]);
        if (event.type === "inferno_visual" && event.animations.some(({ actorId, clipId }) => actorId === "phosanis-nightmare" && ["spores", "husks", "flowers", "curse"].includes(clipId))) wanted.push([tick, 4310, "a special"]);
        if (event.type === "inferno_visual" && event.graphics.some(({ spotAnimId }) => spotAnimId === 1767)) wanted.push([tick, 4307, "claws"]);
        if (event.type === "actor_died" && event.actorId.startsWith("nightmare-husk-")) wanted.push([tick, 4278, "a husk dies"]);
        if (event.type === "actor_died" && event.actorId.startsWith("nightmare-sleepwalker-")) wanted.push([tick, 4292, "a sleepwalker dies"]);
        if (event.type === "actor_died" && event.actorId === "phosanis-nightmare") wanted.push([tick, 4295, "her death"]);
      }
    },
  });
  const missed = wanted.filter(([tick, id]) => !played.has(`${tick}:${id}`));
  assert.deepEqual(missed, []);
  const kinds = new Set(wanted.map(([, , what]) => what));
  for (const what of ["her magic", "her melee", "a hit on her", "a special", "claws", "her death"]) assert.ok(kinds.has(what), `the kill has no ${what}`);
  console.log(`In the harness's kill: ${wanted.length} sounds on the ticks of what they go with (${[...kinds].join(", ")})`);
}
