// An enchanted bolt's effect shows on the target as the bolt is fired, not as
// it lands (OBS: ruby and diamond bolts in recorded Nex kills put the graphic
// on the shot's tick, two to three ticks before the hitsplat). The scenario
// engine/ruby-bolt-blood-forfeit: a Zaryte crossbow's sixth shot procs.
import assert from "node:assert/strict";
import { runScenario, loadScenarios } from "../tools/determinism/harness.mjs";

const scenario = (await loadScenarios("engine")).find((s) => s.name === "engine/ruby-bolt-blood-forfeit");
const shots = [];
const graphics = [];
const hits = [];
await runScenario(scenario, {
  onTick(tick, engine) {
    for (const event of engine.getLastTickEvents()) {
      if (event.type === "attack_started" && event.sourceId === "player") shots.push(tick);
      if (event.type === "npc_graphic_applied" && event.spotAnimId === 754) graphics.push(tick);
      if (event.type === "hitsplat_spawned" && event.targetId !== "player") hits.push([tick, event.amount]);
    }
  },
});
assert.deepEqual(graphics, [26]);
assert.ok(shots.includes(26), JSON.stringify(shots));
// The Blood Forfeit lands later: 22% of Yama's hitpoints, at most 110 from a Zaryte crossbow.
assert.deepEqual(hits.find(([tick]) => tick > 26), [29, 110]);
console.log("enchanted bolt timing: ok");
process.exit(0);
