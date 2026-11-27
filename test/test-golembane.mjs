// Golembane (client/engine/playerAttack/formula.js): against a monster with the
// golem attribute, the granite hammer's accuracy and damage are up by 30% and
// the Barronite mace's by 15% (WIKI: Golembane weapons, Golem (attribute)), as
// a stage of the roll and of the maximum hit, beside the Slayer helmet's. Any
// other weapon or target is as before.
import assert from "node:assert/strict";
import { installHooks } from "../tools/determinism/node-hooks.mjs";

// The client's import graph reaches a stylesheet; the harness's hooks make it an empty module.
installHooks();
globalThis.self ??= globalThis; // as the harness: PicoGL reads `self` when it loads
globalThis.location ??= { pathname: "/" };
const { selectPlayerAttackProfile } = await import("../client/engine/playerAttack/profiles.js");
const { getMonsterFormulaStats } = await import("../client/engine/monsterStats.js");

const GRANITE_HAMMER = 21742;
const BARRONITE_MACE = 25641;
const BARRONITE_MACE_LOCKED = 25643;
const ABYSSAL_WHIP = 4151;
const ARCLIGHT = 19675;

const hit = (weaponId, targetAttributes, extra = {}) =>
  selectPlayerAttackProfile({ weaponId, formulaStyle: "melee_crush", resources: { kind: "none" }, targetAttributes, ...extra });
const stages = (profile) => ({ accuracy: profile.hit.accuracy.attackRollStages ?? [], maxHit: profile.maxHit.stages ?? [] });
const percent = (n) => ({ numerator: 100 + n, denominator: 100 });

// Against a golem: the weapon's percentage on the roll and on the maximum.
assert.deepEqual(stages(hit(GRANITE_HAMMER, ["golem"])), { accuracy: [percent(30)], maxHit: [percent(30)] });
assert.deepEqual(stages(hit(BARRONITE_MACE, ["golem"])), { accuracy: [percent(15)], maxHit: [percent(15)] });
assert.deepEqual(stages(hit(BARRONITE_MACE_LOCKED, ["golem"])), { accuracy: [percent(15)], maxHit: [percent(15)] });

// Not a golem, or not a golembane weapon: nothing.
assert.deepEqual(stages(hit(GRANITE_HAMMER, [])), { accuracy: [], maxHit: [] });
assert.deepEqual(stages(hit(GRANITE_HAMMER, ["demon"])), { accuracy: [], maxHit: [] });
assert.deepEqual(stages(hit(ABYSSAL_WHIP, ["golem"])), { accuracy: [], maxHit: [] });
// Demonbane is as it was.
assert.deepEqual(stages(hit(ARCLIGHT, ["demon"])), { accuracy: [percent(70)], maxHit: [percent(70)] });

// It stacks with the Slayer helmet: both stages, the helmet's first (WIKI: Granite hammer, "multiplicatively").
const onTask = stages(hit(GRANITE_HAMMER, ["golem"], { headId: 11865 }));
const helmet = stages(hit(ABYSSAL_WHIP, [], { headId: 11865 })).maxHit;
assert.equal(helmet.length, 1, "the helmet's own stage");
assert.deepEqual(onTask.maxHit, [...helmet, percent(30)]);
assert.deepEqual(onTask.accuracy, [...stages(hit(ABYSSAL_WHIP, [], { headId: 11865 })).accuracy, percent(30)]);

// The monster table's golems carry the attribute to the formula: the Mad Angel (TABLE: 16305) among them.
assert.ok(getMonsterFormulaStats(16305).attributes.includes("golem"));

console.log("Golembane: the granite hammer's 30% and the Barronite mace's 15% against golems, nothing else changed.");
