// The Doom of Mokhaiotl's sounds that the game's server sends: a thrown rock
// bursting and each of its pieces landing, heard from their tiles with the
// recorded ranges and delays; his own orbs as they leave him (not a rock's),
// an orb's burst on the player, his shield breaking, and a hit that hurts him
// from his middle tile; nothing for what is not his. Every sound the rules
// name is in the trimmed cache's list. A sound that is not in it
// throws nothing: it is silent (docs/ADDING-AN-ENCOUNTER.md, section 7). In
// fights of the harness each comes on the tick of what it goes with.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readCacheGroups } from "../tools/assets/cache-groups.mjs";
import { cacheZip, loadEnvironment, runScenario } from "../tools/determinism/harness.mjs";
import { installHooks } from "../tools/determinism/node-hooks.mjs";

// delves.js imports what Node loads only through the harness's hooks: the
// harness installs them as it loads, without the cache this test does.
const fights = existsSync(cacheZip);
if (fights) await loadEnvironment();
else installHooks();
for (const name of ["self", "window"]) globalThis[name] ??= globalThis;
const { doomAudio } = await import("../client/encounters/doom-of-mokhaiotl/audio.js");
const { doomPresentation, doomDeepPresentation } = await import("../client/encounters/doom-of-mokhaiotl/presentation.js");

const { inferno_visual: visual, hit_applied: hit } = doomAudio.rules;
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

// His own orb leaves 55 cycles into the attack: its sound with it, one per style.
const orb = (spotAnimId, startDelayCycles) => ({ spotAnimId, sourcePosition: [32.5, 37.5], target: { kind: "actor", actorId: "player" }, startDelayCycles, endDelayCycles: 175 });
const attack = { actorId: "doom", clipId: "orb", delayCycles: 0 };
for (const [spotAnimId, id] of [[3379, 10375], [3380, 10341], [3378, 10367]])
  assert.deepEqual(visual.resolve({ ...none, animations: [attack], projectiles: [orb(spotAnimId, 55)] }), { kind: "play", sound: [{ id, delayCycles: 55, channel: "sfx" }] });
// From under the ground, with its trail, at once.
assert.deepEqual(visual.resolve({ ...none, projectiles: [orb(3378, 0), orb(2488, 0)] }), { kind: "play", sound: [{ id: 10367, channel: "sfx" }] });
// A rock's orbs leave at once, with no trail: none.
assert.deepEqual(visual.resolve({ ...none, projectiles: [orb(3379, 0), orb(3380, 0)] }), pass);
// An orb's burst on the player.
const onPlayer = (spotAnimId) => ({ spotAnimId, target: { kind: "actor", actorId: "player" }, height: 100, delayCycles: 0 });
for (const [spotAnimId, id] of [[2492, 7023], [2490, 7026], [2491, 7025]])
  assert.deepEqual(visual.resolve({ ...none, graphics: [onPlayer(spotAnimId)] }), { kind: "play", sound: [{ id, channel: "sfx" }] });
// His shield breaking: three sounds, 0, 45 and 160 cycles in.
assert.deepEqual(visual.resolve({ ...none, animations: [{ actorId: "doom", clipId: "shieldBreak", delayCycles: 0 }] }), {
  kind: "play",
  sound: [{ id: 10303, channel: "sfx" }, { id: 10301, delayCycles: 45, channel: "sfx" }, { id: 10372, delayCycles: 160, channel: "sfx" }],
});
// A hit that hurts him, from his middle tile (he is 5 by 5); none for 0, nor on another.
assert.deepEqual(hit.resolve({ targetId: "doom", targetPosition: [30, 35], damage: 12 }), { kind: "play", sound: [{ id: 10345, range: 10, channel: "area", position: [32, 37] }] });
assert.deepEqual(hit.resolve({ targetId: "doom", targetPosition: [30, 35], damage: 0 }), pass);
assert.deepEqual(hit.resolve({ targetId: "player", targetPosition: [30, 30], damage: 12 }), pass);

// Both rooms play them.
for (const presentation of [doomPresentation, doomDeepPresentation]) assert.equal(presentation(class {}).audio, doomAudio);

const listed = new Set(readCacheGroups()[4]);
for (const [type, rule] of Object.entries(doomAudio.rules))
  for (const id of rule.preloadIds) assert.ok(listed.has(id), `sound ${id} of the ${type} rule is not under "4" in a list of tools/assets/cache-groups.mjs`);
assert.deepEqual(new Set(Object.values(doomAudio.rules).flatMap((rule) => rule.preloadIds)), new Set([10297, 10331, 10375, 10341, 10367, 7023, 7026, 7025, 10303, 10301, 10372, 10345]));
console.log("The Doom's rocks, orbs, orb bursts, shield break and hurt sounds play as recorded, and their sounds are in the trimmed cache");

if (!fights) console.log(`skipped the fights: ${cacheZip} is missing (npm run assets)`);
else {
  // Fights of the harness: every event of a tick through the rules, and what
  // each should bring on that tick. The ids are the game's (delves.js).
  const { scenarios } = await import("../tools/determinism/scenarios/doom-of-mokhaiotl.mjs");
  const orbs = { 3379: 10375, 3380: 10341, 3378: 10367 };
  const trails = [2487, 2488, 2489];
  const bursts = { 2492: 7023, 2490: 7026, 2491: 7025 };
  const kinds = new Set();
  for (const name of ["doom/delve-2-melee", "doom/delve-1-earthen-shield", "doom/delve-4-coloured-larvae", "doom/delve-5-burrow", "doom/delve-8-ranged"]) {
    const wanted = []; // [tick, id, what]
    const played = new Set(); // "tick:id"
    const rockOrbs = []; // [tick, ids heard]
    await runScenario(scenarios.find((scenario) => scenario.name === name), {
      onTick(tick, engine) {
        for (const event of engine.getLastTickEvents()) {
          const answer = doomAudio.rules[event.type]?.resolve(event);
          const heard = answer?.kind === "play" ? answer.sound.map(({ id }) => id) : [];
          for (const id of heard) played.add(`${tick}:${id}`);
          if (event.type === "inferno_visual") {
            const burrowed = event.projectiles.some(({ spotAnimId }) => trails.includes(spotAnimId));
            for (const { spotAnimId, startDelayCycles } of event.projectiles) {
              if (!orbs[spotAnimId]) continue;
              if (burrowed) wanted.push([tick, orbs[spotAnimId], "an orb from under the ground"]);
              else if (event.animations.some(({ actorId, clipId }) => actorId === "doom" && clipId === "orb")) wanted.push([tick, orbs[spotAnimId], "an orb of his attack"]);
              else if (!startDelayCycles) rockOrbs.push([tick, heard.filter((id) => Object.values(orbs).includes(id))]);
            }
            for (const { spotAnimId, target } of event.graphics) if (bursts[spotAnimId] && target.kind === "actor") wanted.push([tick, bursts[spotAnimId], "an orb bursts on the player"]);
            if (event.animations.some(({ actorId, clipId }) => actorId === "doom" && clipId === "shieldBreak")) wanted.push([tick, 10303, "his shield breaks"]);
          }
          if (event.type === "hit_applied" && event.targetId === "doom" && event.damage > 0) wanted.push([tick, 10345, "a hit hurts him"]);
        }
      },
    });
    assert.deepEqual(wanted.filter(([tick, id]) => !played.has(`${tick}:${id}`)), [], name);
    assert.deepEqual(rockOrbs.filter(([, heard]) => heard.length > 0), [], `${name}: a rock's orb is heard`);
    for (const [, , what] of wanted) kinds.add(what);
    if (rockOrbs.length) kinds.add("a rock's orbs, unheard");
  }
  for (const what of ["an orb of his attack", "an orb from under the ground", "an orb bursts on the player", "his shield breaks", "a hit hurts him", "a rock's orbs, unheard"])
    assert.ok(kinds.has(what), `the fights have no ${what}`);
  console.log(`In the harness's fights: ${[...kinds].join(", ")}, each on its tick`);
}
