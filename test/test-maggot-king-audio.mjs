// The Maggot King's sounds that the game's server sends (maggot-king/audio.js): the rules answer his events and no
// others, every sound they name is in the trimmed cache's list (one that is not is silent:
// docs/ADDING-AN-ENCOUNTER.md, section 7), and in fights of the harness each comes on the tick of what it goes with.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readCacheGroups } from "../tools/assets/cache-groups.mjs";
import { cacheZip, loadEnvironment, runScenario } from "../tools/determinism/harness.mjs";
import { installHooks } from "../tools/determinism/node-hooks.mjs";

// encounter.js imports what Node loads only through the harness's hooks: the harness registers them as it loads,
// without the cache this test does.
const fights = existsSync(cacheZip);
if (fights) await loadEnvironment();
else installHooks();
for (const name of ["self", "window"]) globalThis[name] ??= globalThis;
const { maggotKingAudio: audio } = await import("../client/encounters/maggot-king/audio.js");

const { zuk_attack: attack, inferno_visual: visual, hit_applied: hit, actor_died: died } = audio.rules;
const pass = { kind: "pass" };
const visualOf = (fields) => ({ type: "inferno_visual", animations: [], projectiles: [], graphics: [], ...fields });
const onTile = (spotAnimId, position) => ({ spotAnimId, target: { kind: "tile", position }, height: 0, delayCycles: 0 });
const fragment = (from, to) => ({ spotAnimId: 3797, sourcePosition: [from[0] + 0.5, from[1] + 0.5], target: { kind: "tile", position: to } });

// A spit is heard where it lands: the player's tile as he spits, 2 ticks on.
assert.deepEqual(attack.resolve({ attack: "maggot_king_range", targetPosition: [30, 25] }), { kind: "play", sound: [{ id: 11837, range: 1, position: [30, 25], delayCycles: 60, channel: "area" }] });
assert.deepEqual(attack.resolve({ attack: "maggot_king_magic", targetPosition: [30, 25] }).sound[0].id, 11822);
assert.deepEqual(attack.resolve({ attack: "phosanis_nightmare_magic", targetPosition: [30, 25] }), pass);
// A pile breaks once, from its tile, however many fragments; each fragment lands 2 ticks on, a spit's bile 3.
const broken = visual.resolve(visualOf({ projectiles: [fragment([30, 30], [29, 30]), fragment([30, 30], [31, 30]), fragment([20, 30], [21, 30])] }));
assert.deepEqual(broken.sound.map(({ id, position, delayCycles = 0 }) => [id, ...position, delayCycles]), [
  [11840, 30, 30, 0], [11840, 20, 30, 0], [11027, 29, 30, 60 + 3 + ((29 + 60) % 3)], [11027, 31, 30, 60 + 3 + ((31 + 60) % 3)], [11027, 21, 30, 60 + 3 + ((21 + 60) % 3)],
]);
const splashed = visual.resolve(visualOf({ graphics: [onTile(3999, [30, 25]), onTile(3999, [31, 25])] }));
assert.deepEqual(splashed.sound.map(({ id, range, delayCycles }) => [id, range, delayCycles >= 93 && delayCycles <= 95]), [[11027, 2, true], [11027, 2, true]]);
// Larvae: all dying with him are heard; a debris graphic or another fight's clip is not his.
assert.deepEqual(visual.resolve(visualOf({ animations: [{ actorId: "maggot-larva-4", clipId: "death", delayCycles: 0 }] })), { kind: "play", sound: [{ id: 602, channel: "sfx" }] });
for (const fields of [{ graphics: [onTile(3998, [30, 30])] }, { animations: [{ actorId: "leviathan", clipId: "death", delayCycles: 0 }] }, {}]) assert.deepEqual(visual.resolve(visualOf(fields)), pass);

// A hit on him or on a larva, 0 or not; with a magic splash, the shared rule's splash too.
assert.deepEqual(hit.resolve({ targetId: "maggot-king", targetPosition: [28, 40], damage: 0 }), { kind: "play", sound: [{ id: 11820, channel: "sfx" }] });
assert.deepEqual(hit.resolve({ targetId: "maggot-king", targetPosition: [28, 40], damage: 0, accurate: false, attackKind: "magic" }).sound.map(({ id }) => id), [11820, 227]);
assert.deepEqual(hit.resolve({ targetId: "maggot-larva-2", targetPosition: [25, 30], damage: 3 }), { kind: "play", sound: [{ id: 603, channel: "sfx" }] });
for (const targetId of ["player", "phosanis-nightmare"]) assert.deepEqual(hit.resolve({ targetId, targetPosition: [1, 1], damage: 5 }), pass);
assert.deepEqual(died.resolve({ actorId: "maggot-larva-2" }), { kind: "play", sound: [{ id: 602, channel: "sfx" }] });
for (const actorId of ["player", "maggot-king"]) assert.deepEqual(died.resolve({ actorId }), pass);

const listed = new Set(readCacheGroups()[4]);
const ids = [...new Set(Object.values(audio.rules).flatMap((rule) => rule.preloadIds))];
assert.deepEqual(ids.sort((a, b) => a - b), [227, 602, 603, 11027, 11820, 11822, 11837, 11840]);
for (const id of ids) assert.ok(listed.has(id), `sound ${id} is not under "4" in a list of tools/assets/cache-groups.mjs`);
console.log(`The Maggot King's ${ids.length} sounds answer his own events, and all are in the cache list`);

if (!fights) console.log(`skipped the fights: ${cacheZip} is missing (npm run assets)`);
else {
  // Fights of the harness: every event of a tick through the rules, and what each should bring on that tick.
  const { scenarios } = await import("../tools/determinism/scenarios/maggot-king.mjs");
  const kinds = new Set();
  for (const name of ["maggot-king/crossbow-and-bow", "maggot-king/larvae"]) {
    const wanted = []; // [tick, id, what]
    const played = new Set(); // "tick:id"
    await runScenario(scenarios.find((scenario) => scenario.name === name), {
      onTick(tick, engine) {
        for (const event of engine.getLastTickEvents()) {
          const answer = audio.rules[event.type]?.resolve(event);
          for (const { id } of answer?.kind === "play" ? answer.sound : []) played.add(`${tick}:${id}`);
          if (event.type === "zuk_attack" && event.attack === "maggot_king_range") wanted.push([tick, 11837, "a ranged spit"]);
          if (event.type === "zuk_attack" && event.attack === "maggot_king_magic") wanted.push([tick, 11822, "a magic spit"]);
          if (event.type === "inferno_visual" && event.projectiles.some(({ spotAnimId }) => spotAnimId === 3797)) wanted.push([tick, 11840, "a pile breaks"], [tick, 11027, "a fragment lands"]);
          if (event.type === "inferno_visual" && event.graphics.some(({ spotAnimId }) => spotAnimId === 3999)) wanted.push([tick, 11027, "a spit's bile lands"]);
          if (event.type === "hit_applied" && event.targetId === "maggot-king") wanted.push([tick, 11820, "a hit on him"]);
          if (event.type === "hit_applied" && event.targetId.startsWith("maggot-larva-")) wanted.push([tick, 603, "a hit on a larva"]);
          if (event.type === "actor_died" && event.actorId.startsWith("maggot-larva-")) wanted.push([tick, 602, "a larva dies"]);
        }
      },
    });
    assert.deepEqual(wanted.filter(([tick, id]) => !played.has(`${tick}:${id}`)), [], name);
    for (const [, , what] of wanted) kinds.add(what);
  }
  for (const what of ["a ranged spit", "a magic spit", "a pile breaks", "a fragment lands", "a spit's bile lands", "a hit on him", "a hit on a larva", "a larva dies"]) assert.ok(kinds.has(what), `the fights have no ${what}`);
  console.log(`In the harness's fights: ${[...kinds].join(", ")}, each heard on its tick`);
}
