// Zaryte crossbow: Evoke (doubled accuracy, the bolt effect certain on an
// accurate hit), its passive on enchanted bolts, and the bolt effects the
// roller and the projection agree on.
import assert from "node:assert/strict";
import { installHooks } from "../tools/determinism/node-hooks.mjs";

// The client's import graph reaches a stylesheet; the harness's hooks make it an empty module.
installHooks();
globalThis.self ??= globalThis; // as the harness: PicoGL reads `self` when it loads
globalThis.location ??= { pathname: "/" };
const { selectPlayerAttackProfile } = await import("../client/engine/playerAttack/profiles.js");
const { resolveBoltProcSpec } = await import("../client/engine/playerAttack/plan.js");
const { rollAttackPlan } = await import("../client/engine/playerAttack/roll.js");
const { projectPlayerAttack } = await import("../client/engine/playerAttack/projection.js");
const { getSpecialAttackDefinition } = await import("../client/data/specialAttackDefinitions.js");

const ZCB = 26374;
const ACB = 11785;
const bolts = { opal: 9236, pearl: 9238, sapphire: 9240, emerald: 9241, ruby: 9242, diamond: 9243, dragonstone: 9244, onyx: 9245, rubyDragon: 21944 };

function profile(weaponId, ammoId, extra = {}) {
  return selectPlayerAttackProfile({
    weaponId,
    formulaStyle: "ranged",
    resources: { kind: "ammo", ammoId },
    targetCurrentHp: 600,
    playerCurrentHp: 99,
    playerRangedLevel: 112,
    targetRangedLevel: 300,
    targetAttributes: [],
    ...extra,
  });
}

// The special: 75% energy, and the crossbow's own shot as its animation (OBS: 9168 on every recorded Evoke).
assert.deepEqual(getSpecialAttackDefinition(ZCB), { energyCost: 75, animationId: 9168 });
assert.deepEqual(getSpecialAttackDefinition(27186), getSpecialAttackDefinition(ZCB));

// Evoke doubles the attack roll and guarantees the bolt.
{
  const evoke = profile(ZCB, bolts.ruby, { isSpecialAttack: true });
  assert.deepEqual(evoke.hit.accuracy.attackRollStages, [{ numerator: 2, denominator: 1 }]);
  assert.equal(evoke.hit.proc.guaranteed, true);
  // 22% of 600 is 132, capped at 110 (WIKI: "a guaranteed 110 damage").
  assert.equal(resolveBoltProcSpec(evoke.hit.proc, 50).damage, 110);
  const normalZcb = profile(ZCB, bolts.rubyDragon);
  assert.equal(normalZcb.hit.proc.guaranteed, false);
  assert.equal(resolveBoltProcSpec(normalZcb.hit.proc, 50).damage, 110);
  assert.equal(resolveBoltProcSpec(profile(ACB, bolts.ruby).hit.proc, 50).damage, 100);
  assert.equal(resolveBoltProcSpec(profile(ACB, bolts.ruby, { targetCurrentHp: 250 }).hit.proc, 50).damage, 50);
}

// The passive on each bolt, Zaryte against Armadyl crossbow, at visible Ranged 112.
{
  const bonusOf = (weaponId, ammoId, extra) => resolveBoltProcSpec(profile(weaponId, ammoId, extra).hit.proc, 50);
  assert.equal(bonusOf(ACB, bolts.opal).bonus, 11); // WIKI: 112 Ranged gives 11
  assert.equal(bonusOf(ZCB, bolts.opal).bonus, 12);
  assert.equal(bonusOf(ACB, bolts.pearl).bonus, 5);
  assert.equal(bonusOf(ZCB, bolts.pearl, { targetAttributes: ["fiery"] }).bonus, 8);
  assert.equal(bonusOf(ACB, bolts.dragonstone).bonus, 22); // WIKI: 112 Ranged gives 22
  assert.equal(bonusOf(ZCB, bolts.dragonstone).bonus, 24);
  assert.deepEqual(profile(ZCB, bolts.dragonstone, { targetAttributes: ["dragon"] }).hit.proc, undefined);
  assert.equal(bonusOf(ACB, bolts.diamond).maximumInclusive, 57);
  assert.equal(bonusOf(ZCB, bolts.diamond).maximumInclusive, 63);
  assert.equal(bonusOf(ZCB, bolts.onyx).maximumInclusive, 66);
  assert.deepEqual(profile(ZCB, bolts.onyx, { targetAttributes: ["undead"] }).hit.proc, undefined);
  assert.deepEqual(bonusOf(ZCB, bolts.emerald).effects, [{ effect: "poison", severity: 27 }]);
  assert.deepEqual(bonusOf(ACB, bolts.emerald).effects, [{ effect: "poison", severity: 25 }]);
  assert.deepEqual(bonusOf(ZCB, bolts.sapphire).effects, [{ effect: "restore_prayer", points: 3 }]); // WIKI: Zulrah gives 3
}

// Seeded generator for the roller.
function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
function planWith(proc, accuracyChance) {
  return {
    application: { outgoingDamageMultiplier: 1, specialAttackDamageMultiplier: 1 },
    hits: [{
      gate: { kind: "always" },
      accuracy: { kind: "roll", chance: accuracyChance },
      damage: { kind: "uniform", minimumInclusive: 0, maximumInclusive: 20 },
      proc,
      style: "ranged",
      attackKind: "range_arrow",
      impactDelayTicks: 2,
    }],
  };
}

// Roller and projection agree on the expected damage, in every mode.
const cases = {
  "opal (ignores accuracy, adds)": resolveBoltProcSpec(profile(ACB, bolts.opal).hit.proc, 20),
  "dragonstone (accurate only, adds)": resolveBoltProcSpec(profile(ACB, bolts.dragonstone).hit.proc, 20),
  "onyx (accurate only, rerolls)": resolveBoltProcSpec(profile(ACB, bolts.onyx).hit.proc, 20),
  "ruby (ignores accuracy, replaces)": resolveBoltProcSpec(profile(ACB, bolts.ruby).hit.proc, 20),
  "Evoke ruby": resolveBoltProcSpec(profile(ZCB, bolts.ruby, { isSpecialAttack: true }).hit.proc, 20),
  "Evoke opal": resolveBoltProcSpec(profile(ZCB, bolts.opal, { isSpecialAttack: true }).hit.proc, 20),
  "Evoke onyx": resolveBoltProcSpec(profile(ZCB, bolts.onyx, { isSpecialAttack: true }).hit.proc, 20),
};
for (const [name, proc] of Object.entries(cases)) {
  const plan = planWith(proc, 0.4);
  const projected = projectPlayerAttack(plan).hits[0];
  const random = seeded(12345);
  const rolls = 200000;
  let total = 0;
  for (let i = 0; i < rolls; i++) {
    const [hit] = rollAttackPlan(plan, random).hits;
    total += hit.accuracySucceeded ? hit.rolledDamage : 0;
  }
  const mean = total / rolls;
  assert.ok(Math.abs(mean - projected.expectedRolledDamage) < 0.02 * Math.max(1, projected.expectedRolledDamage),
    `${name}: rolled ${mean.toFixed(3)}, projected ${projected.expectedRolledDamage.toFixed(3)}`);
}

// Evoke: an accurate hit always carries the effect; a miss with ruby still has ruby's 6%.
{
  const evokeRuby = cases["Evoke ruby"];
  const random = seeded(7);
  let accurate = 0, procs = 0, missProcs = 0, misses = 0;
  for (let i = 0; i < 100000; i++) {
    const plan = planWith(evokeRuby, 0.5);
    const [hit] = rollAttackPlan(plan, random).hits;
    if (hit.procActivated) procs++;
    if (hit.accuracySucceeded && hit.rolledDamage === 110) accurate++;
    if (!hit.accuracySucceeded) misses++;
  }
  missProcs = procs - 50000;
  assert.ok(Math.abs(procs / 100000 - (0.5 + 0.5 * 0.06)) < 0.01, `Evoke ruby procs ${procs}`);
  assert.equal(accurate, procs);
  assert.ok(Math.abs(misses / 100000 - 0.5 * 0.94) < 0.01);
  assert.ok(missProcs > 0);
  const [hit] = rollAttackPlan(planWith(cases["Evoke onyx"], 1), seeded(1)).hits;
  assert.deepEqual(hit.procEffects, [{ effect: "heal_hp", percentOfDamage: 25, minimumHeal: 0 }]);
  assert.equal(hit.procSpotAnimId, 753);
}
console.log("zaryte crossbow: ok");
