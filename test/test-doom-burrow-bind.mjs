// A bind on the Doom of Mokhaiotl (the scorching bow's special) doesn't stop his burrow (#145): the burrowed form
// is immune to freezes (WIKI), so a bind from before he burrows ends as he does, and one that lands while he's
// burrowed doesn't hold him. Asserted on the harness's delve-5 burrow (tools/determinism/scenarios/doom-of-mokhaiotl.mjs).
import assert from "node:assert/strict";
import { runScenario } from "../tools/determinism/harness.mjs";
import { scenarios } from "../tools/determinism/scenarios/doom-of-mokhaiotl.mjs";

const burrowedId = 14709;
const scenario = scenarios.find((each) => each.name === "doom/delve-5-burrow");

// His tile and form each tick; `bindAt(tick)` binds him on the ticks it returns a length for.
async function run(bindAt = () => 0) {
  const ticks = [];
  await runScenario(scenario, {
    onTick(tick, engine) {
      const boss = engine.worldState.getNpc("doom");
      ticks[tick] = { position: boss.position.join(), burrowed: boss.npcTypeId === burrowedId };
      const length = bindAt(tick, ticks);
      if (length > 0) {
        boss.debuffs ??= {};
        boss.debuffs.boundFromTick = tick;
        boss.debuffs.boundUntilTick = tick + length;
      }
    },
  });
  return ticks;
}
const burrowWindow = (ticks) => {
  const from = ticks.findIndex((tick) => tick?.burrowed);
  let to = from;
  while (ticks[to + 1]?.burrowed) to++;
  return [from, to];
};

const free = await run();
const [from, to] = burrowWindow(free);
assert.ok(from > 0, "he burrows in the delve-5 scenario");
const tiles = new Set(free.slice(from, to + 1).map((tick) => tick.position));
assert.ok(tiles.size > 1, "unbound, his zooms move him");

// Bound 3 ticks before he burrows, for the scorching bow's 21 ticks and more: the same burrow.
const boundBefore = await run((tick) => (tick === from - 3 ? 40 : 0));
assert.deepEqual(boundBefore.slice(from, to + 1), free.slice(from, to + 1), "a bind from before the burrow ends as he burrows");

// Bound while burrowed, before his first zoom: he still zooms.
const boundDuring = await run((tick) => (tick === from + 2 ? 40 : 0));
assert.deepEqual(boundDuring.slice(from, to + 1), free.slice(from, to + 1), "a bind while burrowed doesn't hold him");
console.log(`Bound before or during his burrow (ticks ${from}-${to}), Doom zooms across ${tiles.size} tiles as he does unbound.`);
