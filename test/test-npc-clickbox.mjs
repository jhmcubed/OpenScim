// Which NPC a click is on (rendering.js, the pick Grid.js calls). For an NPC
// larger than a tile the game takes each face's rectangle on screen, 5 pixels
// wider on each side, but only where the pointer is over the model's box
// (RuneLite's Perspective.getClickbox clips the rectangles to it). Without
// that box a click just beside the model's edge went to the NPC, and tiles
// beside Araxxor and Vardorvis could not be clicked. No browser, no cache.
import assert from "node:assert/strict";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { installHooks } from "../tools/determinism/node-hooks.mjs";

installHooks();
globalThis.self ??= globalThis; // PicoGL reads `self` when it loads
const { CZ: pickNpcs } = await import(pathToFileURL(process.cwd() + "/client/assets/rendering.js").href);

// A camera 10 tiles above the ground (x, y; z is up), looking straight down,
// with a 90 degree field of view on a 200 x 200 viewport: 10 pixels a tile,
// the point under the camera in the middle. Matrices are column-major.
const size = 200;
const view = Float64Array.from([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -10, 1]);
const near = 0.1, far = 100;
const projection = Float64Array.from([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, (2 * far * near) / (near - far), 0]);
const ray = { origin: { x: 0, y: 0, z: 10 }, direction: { x: 0, y: 0, z: -1 } };
const identity = Float32Array.from([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

// A square of 2 x 2 tiles flat on the ground, centred on the model's origin: on
// screen, from 90 to 110 on both axes.
const square = (useBoundingBox) => ({
  verticesX: Float32Array.from([-1, 1, 1, -1]),
  verticesY: Float32Array.from([-1, -1, 1, 1]),
  verticesZ: Float32Array.from([0, 0, 0, 0]),
  verticesCount: 4,
  indices1: Uint16Array.from([0, 0]),
  indices2: Uint16Array.from([1, 2]),
  indices3: Uint16Array.from([2, 3]),
  faceCount: 2,
  faceColors3: null,
  modelMatrix: identity,
  useBoundingBox,
});
const clicked = (x, y, hitTestData) =>
  pickNpcs({ x, y }, ray, [{ actorId: "npc", hitTestData }], view, projection, size, size, (actorId) => ({ actorId, npcTypeId: 1, position: [0, 0] })).map(({ actorId }) => actorId);

test("a larger NPC is clicked on its model, not a few pixels beside its edge", () => {
  const model = square(false);
  assert.deepEqual(clicked(100, 100, model), ["npc"]); // the middle
  assert.deepEqual(clicked(109, 100, model), ["npc"]); // just inside the east edge
  // 3 pixels east of the edge: inside the face's rectangle widened by 5, outside the model's box.
  assert.deepEqual(clicked(113, 100, model), []);
  assert.deepEqual(clicked(100, 87, model), []);
});

test("a one-tile NPC keeps its box, an eighth of a tile wider than its model", () => {
  const model = square(true);
  assert.deepEqual(clicked(110.5, 100, model), ["npc"]);
  assert.deepEqual(clicked(113, 100, model), []);
});
