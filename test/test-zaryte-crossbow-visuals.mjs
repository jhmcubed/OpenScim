// Zaryte crossbow as the renderer draws it (rendering.js FD), against 12
// recorded Nex kills: animation 9168 for a shot and for Evoke, the bolt
// leaving at height 177; enchanted dragon bolts fly as dragon bolts (1468),
// enchanted gem bolts as plain bolts (27), Evoke as its own bolt (1995).
import assert from "node:assert/strict";
import { loadEnvironment } from "../tools/determinism/harness.mjs";

const { rendering } = await loadEnvironment(); // the client uses web-root imports resolved by the harness loader
const ZCB = 26374;
const ACB = 11785;
const shot = (weaponId, ammoId, special = false) => {
  const visual = rendering.FD(weaponId, ammoId, special);
  return [visual?.attackAnimation, visual?.projectileId, visual?.projectileStartHeight, visual?.projectileEndHeight];
};

assert.deepEqual(shot(ZCB, 21944), [9168, 1468, 177, 146]); // Ruby dragon bolts (e)
assert.deepEqual(shot(ZCB, 21905), [9168, 1468, 177, 146]); // Dragon bolts
assert.deepEqual(shot(ZCB, 9242), [9168, 27, 177, 146]); // Ruby bolts (e)
assert.deepEqual(shot(ZCB, 21944, true), [9168, 1995, 177, 146]); // Evoke
// The Armadyl crossbow keeps its own shot; its enchanted dragon bolts fly as dragon bolts too.
assert.deepEqual(shot(ACB, 9242), [7552, 27, 155, 146]);
assert.deepEqual(shot(ACB, 21944), [7552, 1468, 155, 146]);
console.log("zaryte crossbow visuals: ok");
process.exit(0);
