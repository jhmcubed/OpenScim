// The rocks of the Doom of Mokhaiotl still block the way when the arena is
// applied anew during the fight: the application does so after it has rebuilt
// a fight at a tick of its replay (Take Over, Practice). Each time a fresh
// copy of the room's collision becomes the one the player moves on. Plain
// Node with the harness's module hooks and the trimmed cache.
import assert from "node:assert/strict";
import { loadEnvironment } from "../tools/determinism/harness.mjs";

const { prepareArena, engineModule, objTypeLoader } = await loadEnvironment();
const { CollisionFlag } = await import("../client/engine/collision.js");
const { getArenaCollisionMap } = await import("../client/engine/arena.js");

// The player walks to the rock's tile, and in the end stands as near as he can.
function walkTo(engine, tile) {
  engine.injectAction({ type: "attackTarget", targetId: null });
  for (let tick = 0; tick < 15; tick++) engine.advanceTick(tile);
  return engine.player().position;
}
const standing = (engine) => [...engine.encounter.rocks.standing].map((tile) => tile.split(",").map(Number));
const open = (engine) => standing(engine).filter(([x, y]) => !(getArenaCollisionMap().getFlag(x, y) & CollisionFlag.OBJECT));

// Both rooms: delve 1's, and the one of delves 2 to 8.
for (const [kind, doomDelve] of [["doom_of_mokhaiotl", "1"], ["doom_of_mokhaiotl_deep", "2"]]) {
  await prepareArena(kind);
  const engine = engineModule.createSimulationEngine({
    encounterConfig: { kind, mechanics: { doomDelve, infiniteHealth: true } },
    objTypeLoader,
    combatSeed: 3,
    inventory: new Array(28).fill(null),
    equipment: {},
    combatSupplies: engineModule.createEmptyCombatSupplies(),
    attackStylePerCategory: {},
    startPosition: [31, 28],
  });
  // As the application records a run: until two rocks stand.
  const recording = engine.getEngineRunConfig();
  const frames = [{ input: null, actions: [], events: engine.getLastTickEvents(), state: engine.getState() }];
  while (standing(engine).length < 2) {
    assert.ok(frames.length < 300, `${kind}: two rocks stand within 300 ticks`);
    const input = [31 + (frames.length % 20 < 10 ? 0 : 3), 28];
    engine.advanceTick(input);
    frames.push({ input, actions: [], events: engine.getLastTickEvents(), state: engine.getState() });
  }
  assert.deepEqual(open(engine), [], `${kind}: the rocks block as they fall`);

  const rebuilt = engineModule.rebuildEngineAtReplayFrame(recording, frames, frames.length - 1, objTypeLoader);
  // What the application does with it then.
  rebuilt.clearReplayTakeoverWork();
  rebuilt.reapplyArenaConfig();
  assert.deepEqual(standing(rebuilt), standing(engine), `${kind}: the same rocks stand`);
  assert.deepEqual(open(rebuilt), [], `${kind}: the rocks block in the rebuilt fight`);
  const [rock] = standing(rebuilt);
  assert.notDeepEqual(walkTo(rebuilt, rock), rock, `${kind}: nobody walks onto a rock`);

  // A rock that goes leaves its tile open, on the map that is in use.
  const before = standing(rebuilt);
  rebuilt.encounter.rocks.reset();
  assert.ok(before.every(([x, y]) => !(getArenaCollisionMap().getFlag(x, y) & CollisionFlag.OBJECT)), `${kind}: rocks gone, the way is free`);
}
console.log("The Doom's rocks block the way in a fight rebuilt from its replay, in both rooms");
process.exit(0);
