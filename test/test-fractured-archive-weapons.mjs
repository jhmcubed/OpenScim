// The Fractured Archive's weapons and shield (WIKI: Ascension crossbows, Obligator, Zorya's tome, Rondache): the
// parts the determinism scenarios do not pin down on their own.
import assert from "node:assert/strict";
import { test } from "node:test";
import { loadEnvironment } from "../tools/determinism/harness.mjs";

await loadEnvironment();
const { isAmmoCompatibleWithWeapon, weaponRequiresAmmo } = await import("../client/engine/ammunition.js");
const { computePlayerCombatParams, getPoweredStaffBaseMaxHit } = await import("../client/engine/weapons.js");
const { selectPlayerAttackProfile } = await import("../client/engine/playerAttack/profiles.js");
const { getZoryasFlowAfterAttack, expireZoryasFlow } = await import("../client/engine/zoryasFlow.js");
const { mitigateRondacheHit, noteRondacheAttack, tickRondache, getRondacheCharges } = await import("../client/engine/rondache.js");
const { getEquippedSpecialAttackItemId } = await import("../client/data/specialAttackDefinitions.js");

const ASCENSION_CROSSBOWS = 34681;
const OBLIGATOR = 34715;
const OBLIGATOR_UNCHARGED = 34717;
const RONDACHE = 34719;
const ZORYAS_TOME = 34725;

test("the Ascension crossbows fire ascension bolts and nothing else", () => {
  assert.equal(weaponRequiresAmmo(ASCENSION_CROSSBOWS), true);
  for (const bolt of [34684, 34690, 34696, 34702, 34708]) assert.equal(isAmmoCompatibleWithWeapon(ASCENSION_CROSSBOWS, bolt), true, String(bolt));
  for (const other of [9144 /* Runite bolts */, 21905 /* Dragon bolts */, 9243 /* Diamond bolts (e) */]) {
    assert.equal(isAmmoCompatibleWithWeapon(ASCENSION_CROSSBOWS, other), false, String(other));
  }
  // Ascension bolts in another crossbow are not standard bolts either.
  assert.equal(isAmmoCompatibleWithWeapon(11785 /* Armadyl crossbow */, 34696), false);
});

test("the Ascension crossbows halve the enchanted bolt's chance: 5% Armour Piercing, 5.5% Life Leech", () => {
  const proc = (weaponId, ammoId) =>
    selectPlayerAttackProfile({ weaponId, formulaStyle: "ranged", resources: { kind: "ammo", ammoId }, targetAttributes: [] }).hit.proc;
  assert.equal(proc(ASCENSION_CROSSBOWS, 34696).chancePercent, 5);
  assert.equal(proc(ASCENSION_CROSSBOWS, 34708).chancePercent, 5.5);
  assert.equal(proc(ASCENSION_CROSSBOWS, 34684), undefined); // plain bolts have no effect
  assert.equal(proc(11785, 9243).chancePercent, 10); // other crossbows keep theirs
});

test("the Obligator's Smash attacks every 3 ticks and its Thrusts every 5", () => {
  // The cache gives the Obligator 5 ticks (param 14).
  const speed = (weapon, selectedAttackStyleIndex) =>
    computePlayerCombatParams({ equipmentStats: { attackSpeed: 5, attackRange: 1 }, equipment: { weapon }, selectedAttackStyleIndex }).attackSpeed;
  assert.equal(speed(OBLIGATOR, 0), 5);
  assert.equal(speed(OBLIGATOR, 1), 5);
  assert.equal(speed(OBLIGATOR, 2), 3);
  assert.equal(speed(OBLIGATOR_UNCHARGED, 2), 3);
});

test("the charged Thrust takes the highest of 2 rolls, one more for each of stab and slash above crush", () => {
  const thrust = (input) =>
    selectPlayerAttackProfile({ weaponId: OBLIGATOR, attackStyleIndex: 0, formulaStyle: "melee_crush", targetAttributes: [], ...input });
  assert.deepEqual(thrust({ targetDefensive: { stab: 10, slash: 10, crush: 50 } }).hit.damage, { kind: "highestOfUniformToMaxHit", rolls: 2 });
  assert.equal(thrust({ targetDefensive: { stab: 60, slash: 10, crush: 50 } }).hit.damage.rolls, 3);
  assert.equal(thrust({ targetDefensive: { stab: 60, slash: 60, crush: 50 } }).hit.damage.rolls, 4);
  // Bigger targets: +20% at 2 tiles, +40% at 3 or more.
  assert.deepEqual(thrust({ targetSize: 1 }).maxHit, { kind: "base" });
  assert.deepEqual(thrust({ targetSize: 2 }).maxHit.stages, [{ numerator: 6, denominator: 5 }]);
  assert.deepEqual(thrust({ targetSize: 5 }).maxHit.stages, [{ numerator: 7, denominator: 5 }]);
  // The Smash, and the uncharged Obligator, roll once.
  assert.equal(thrust({ attackStyleIndex: 2 }).hit.damage.kind, "uniformToMaxHit");
  assert.equal(thrust({ weaponId: OBLIGATOR_UNCHARGED }).hit.damage.kind, "uniformToMaxHit");
});

test("Zorya's flow stores 3 buffed attacks on a hit, 5 at most, for 50 ticks after the last", () => {
  let flow = getZoryasFlowAfterAttack(undefined, { tick: 10, isSpecialAttack: true, landed: true });
  assert.deepEqual(flow, { attacks: 3, expiresTick: 60 });
  assert.equal(getZoryasFlowAfterAttack(undefined, { tick: 10, isSpecialAttack: true, landed: false }), undefined);
  // A second Flow adds three and uses none, at most five: two in a row leave five; one that misses changes nothing.
  flow = getZoryasFlowAfterAttack(flow, { tick: 13, isSpecialAttack: true, landed: false });
  assert.equal(flow.attacks, 3);
  flow = getZoryasFlowAfterAttack(flow, { tick: 14, isSpecialAttack: false, landed: true });
  assert.equal(flow.attacks, 2);
  flow = getZoryasFlowAfterAttack(flow, { tick: 15, isSpecialAttack: true, landed: true });
  assert.equal(flow.attacks, 5);
  flow = getZoryasFlowAfterAttack(flow, { tick: 16, isSpecialAttack: true, landed: true });
  assert.equal(flow.attacks, 5);
  flow = getZoryasFlowAfterAttack(flow, { tick: 18, isSpecialAttack: false, landed: false });
  assert.deepEqual(flow, { attacks: 4, expiresTick: 68 });
  assert.equal(expireZoryasFlow(flow, 67), flow);
  assert.equal(expireZoryasFlow(flow, 68), undefined);
});

test("a buffed tome attack has 150% more accuracy and 60% more damage; a Flow on stored buffs 300% and 120%", () => {
  const tome = (input) => selectPlayerAttackProfile({ weaponId: ZORYAS_TOME, formulaStyle: "magic", resources: { kind: "none" }, targetAttributes: [], ...input });
  assert.equal(getPoweredStaffBaseMaxHit(ZORYAS_TOME, 99), 23); // floor(99 / 3) - 10
  assert.equal(tome({ zoryasFlowAttacks: 0 }).maxHit.kind, "base");
  assert.deepEqual(tome({ zoryasFlowAttacks: 2 }).maxHit.stages.at(-1), { numerator: 8, denominator: 5 });
  assert.deepEqual(tome({ zoryasFlowAttacks: 2 }).hit.accuracy.attackRollStages.at(-1), { numerator: 5, denominator: 2 });
  assert.deepEqual(tome({ isSpecialAttack: true, zoryasFlowAttacks: 0 }).hit.accuracy.attackRollStages.at(-1), { numerator: 5, denominator: 2 });
  assert.deepEqual(tome({ isSpecialAttack: true, zoryasFlowAttacks: 1 }).hit.accuracy.attackRollStages.at(-1), { numerator: 4, denominator: 1 });
  assert.deepEqual(tome({ isSpecialAttack: true, zoryasFlowAttacks: 1 }).maxHit.stages.at(-1), { numerator: 11, denominator: 5 });
});

test("the Rondache takes 2 off a hit and charges from it once armed, every 2 ticks at most, up to 20", () => {
  const player = { equipment: { shield: RONDACHE } };
  // Not armed yet: the damage is still lowered, but no charge.
  assert.equal(mitigateRondacheHit(player, 10, 1), 8);
  assert.equal(getRondacheCharges(player), 0);
  noteRondacheAttack(player, 2, false);
  assert.equal(mitigateRondacheHit(player, 10, 3), 8);
  assert.equal(getRondacheCharges(player), 2);
  assert.equal(mitigateRondacheHit(player, 10, 4), 8); // within 2 ticks: no charge
  assert.equal(getRondacheCharges(player), 2);
  assert.equal(mitigateRondacheHit(player, 1, 5), 0); // a hit of 1 gives 1
  assert.equal(getRondacheCharges(player), 3);
  assert.equal(mitigateRondacheHit(player, 0, 7), 0); // a hit the prayer stopped gives none
  assert.equal(getRondacheCharges(player), 3);
  for (let tick = 9; tick < 40; tick += 2) mitigateRondacheHit(player, 30, tick);
  assert.equal(getRondacheCharges(player), 20);
  // Shield Slam empties it and locks it for 13 ticks.
  noteRondacheAttack(player, 40, true);
  assert.equal(getRondacheCharges(player), 0);
  mitigateRondacheHit(player, 30, 52);
  assert.equal(getRondacheCharges(player), 0);
  mitigateRondacheHit(player, 30, 53);
  assert.equal(getRondacheCharges(player), 2);
  // A charge decays 50 ticks after it came; taking the shield off drops them.
  tickRondache(player, 102);
  assert.equal(getRondacheCharges(player), 2);
  tickRondache(player, 103);
  assert.equal(getRondacheCharges(player), 1);
  player.equipment = {};
  tickRondache(player, 104);
  assert.equal(player.rondache, undefined);
});

test("Shield Slam is the Rondache's special unless the weapon has one; x + x% damage", () => {
  assert.equal(getEquippedSpecialAttackItemId({ weapon: 22324 /* Ghrazi rapier */, shield: RONDACHE }), RONDACHE);
  assert.equal(getEquippedSpecialAttackItemId({ shield: RONDACHE }), RONDACHE);
  assert.equal(getEquippedSpecialAttackItemId({ weapon: 5698 /* Dragon dagger */, shield: RONDACHE }), 5698);
  assert.equal(getEquippedSpecialAttackItemId({ weapon: 22324 }), undefined);
  const slam = (charges) =>
    selectPlayerAttackProfile({ weaponId: 22324, isSpecialAttack: true, shieldSlamCharges: charges, formulaStyle: "melee_crush", targetAttributes: [] });
  assert.deepEqual(slam(20).hit.damage, { kind: "fixed", damage: 24 });
  assert.deepEqual(slam(10).hit.damage, { kind: "fixed", damage: 11 });
  // A Slayer helmet raises it by a sixth, as any melee hit.
  const helmed = selectPlayerAttackProfile({ weaponId: 22324, headId: 11864 /* Slayer helmet */, isSpecialAttack: true, shieldSlamCharges: 20, formulaStyle: "melee_crush", targetAttributes: [] });
  assert.deepEqual(helmed.hit.damage, { kind: "fixed", damage: 28 });
});
