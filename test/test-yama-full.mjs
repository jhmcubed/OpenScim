// Yama's whole fight (client/encounters/yama/fullFightData.js): the order of
// his slots in phases 1 and 2, the stones to his Judge, a fire streak's tiles
// and a meteor's damage, against the recording they were read from.
import assert from "node:assert/strict";
import { createSlotPlan, nextSlotBlock, stoneJump, landOf, streakTiles, meteorDamage, glyphFireDamage, glyphShadowDrain, phaseEndHp, fightDuration } from "../client/encounters/yama/fullFightData.js";

const slots = (majority, roll, blocks) => {
  const plan = createSlotPlan(majority, () => roll);
  const names = [`auto:${plan.opening.style}`];
  for (let block = 0; block < blocks; block++) for (const slot of nextSlotBlock(plan)) names.push(slot.kind === "auto" ? `auto:${slot.style}` : slot.kind === "flares" ? "flares" : slot.element);
  return names.join(" ");
};
const three = (style) => `auto:${style} auto:${style} auto:${style}`;
// OBS, kill 1 (shadow glyphs by the throne): magic, the shadow special, three ranged, the fire special, three magic,
// flares in the place before the second shadow special, three more magic.
assert.equal(slots("shadow", 0, 4), `auto:magic shadow ${three("range")} fire ${three("magic")} flares ${three("magic")} shadow ${three("range")}`);
// OBS, kill 3 (fire glyphs): ranged, the fire special, three magic, flares before the first shadow special.
assert.equal(slots("fire", 0, 3), `auto:range fire ${three("magic")} flares ${three("magic")} shadow ${three("range")}`);
// OBS, kill 2: no flares before the first shadow special, so before the second.
assert.equal(slots("fire", 0.9, 4), `auto:range fire ${three("magic")} shadow ${three("range")} fire ${three("magic")} flares ${three("magic")}`);

// OBS (solo 1, ticks 273-284): a click on each stone, a jump each, [7, 29] to [7, 46]; then a walk onto the platform.
const crossing = [[7, 31], [6, 34], [7, 37], [7, 40], [6, 43], [7, 46]];
crossing.reduce((from, stone) => (assert.deepEqual(stoneJump(from, stone), stone), stone), [7, 29]);
assert.equal(landOf([7, 46]), landOf([7, 48])); // off the last stone he walks
assert.equal(landOf([7, 31]), landOf([7, 29])); // and off the first one back
assert.deepEqual(stoneJump([7, 37], [5, 40]), [5, 40]); // OBS: 2 tiles to the side
assert.deepEqual(stoneJump([7, 37], [5, 37]), [5, 37]); // the owner: the stone beside him in his row
assert.deepEqual(stoneJump([7, 48], [7, 46]), [7, 46]); // and back onto the last stone
// The owner, OBS (duo 777): the lava does nothing, nor a stone out of reach, nor a click on the platform from the stones.
assert.equal(stoneJump([7, 31], [7, 33]), null);
assert.equal(stoneJump([7, 29], [6, 34]), null);
assert.equal(stoneJump([5, 37], [8, 43]), null);
assert.equal(stoneJump([7, 29], [7, 48]), null);
assert.notEqual(landOf([6, 34]), landOf([7, 48]));
assert.equal(landOf([7, 33]), null);

// OBS: a streak from x 17 stands 3 ticks, then 18, then two tiles a tick.
const streak = { startTick: 44, y: 33, from: 17, to: 43 };
assert.deepEqual([44, 46, 47, 48, 49].map((tick) => streakTiles(streak, tick).map(([x]) => x)), [[17], [17], [18], [19, 20], [21, 22]]);
assert.deepEqual(streakTiles(streak, 61), []);
assert.deepEqual(streakTiles({ ...streak, from: 43, to: 17 }, 48).map(([x]) => x), [41, 40]);

assert.deepEqual([0, 1, 2, 3, 4].map(meteorDamage), [121, 121, 80, 40, 0]); // WIKI
// OBS: by the distance to his footprint, 5 or more, 4, 3; inferred at 2 or less.
assert.deepEqual([6, 5, 4, 3, 2, 1].map(glyphFireDamage), [2, 2, 6, 9, 12, 12]);
assert.deepEqual([6, 5, 4, 3, 2, 1].map(glyphShadowDrain), [2, 2, 5, 6, 8, 8]);
assert.deepEqual(phaseEndHp(2500), { p1: 1666, p2: 833 });
// OBS: solo 1, 723 ticks on the clock, "7:13"; solo 2, 629 ticks, "6:17".
assert.deepEqual([723, 629, 100].map(fightDuration), ["7:13", "6:17", "1:00"]);
console.log("yama full fight: ok");
