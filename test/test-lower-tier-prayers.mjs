// The lower-tier prayers (Thick Skin to Incredible Reflexes, Sharp Eye, Hawk
// Eye, Mystic Will, Mystic Lore) and Chivalry. WIKI: Prayer, "Prayers list"
// and "Conflicting prayers": switching a prayer on turns off every active
// prayer it conflicts with; the Skin, Strength and Reflexes prayers stay on
// together, and the Skin prayers stay on beside Eagle Eye, Deadeye, Mystic
// Might and Mystic Vigour.
import assert from "node:assert/strict";
import { installHooks } from "../tools/determinism/node-hooks.mjs";

installHooks();
globalThis.self ??= globalThis;
globalThis.location ??= { pathname: "/" };
const { Prayer, prayersConflict, prayerDrainEffects } = await import("../client/engine/prayerTables.js");
const { applyPrayerActions } = await import("../client/engine/prayers.js");
const { getPrayerMultipliers, getPlayerAccuracyRolls, getFormulaMaxHit } = await import("../client/engine/combatFormulas.js");

const none = { protection: null, offensive: null, independent: [], quickPrayersActive: false };
const toggle = (start, ...actions) => applyPrayerActions(start, actions, true);
const offensive = (prayer) => ({ type: "offensive", prayer });
const independent = (prayer) => ({ type: "independent", prayer });
const state = (update) => ({ protection: update.protection, offensive: update.offensive, independent: update.independent, quickPrayersActive: update.quickPrayersActive });

// The three melee lower tiers stay on together.
let update = toggle(none, independent(Prayer.SteelSkin), independent(Prayer.UltimateStrength), independent(Prayer.IncredibleReflexes));
assert.deepEqual(update.independent, [Prayer.SteelSkin, Prayer.UltimateStrength, Prayer.IncredibleReflexes]);

// A higher tier of the same group replaces the lower one.
update = toggle(state(update), independent(Prayer.BurstOfStrength));
assert.deepEqual(update.independent, [Prayer.SteelSkin, Prayer.IncredibleReflexes, Prayer.BurstOfStrength]);

// A ranged prayer turns off the attack and strength prayers, not the Skin.
update = toggle(state(update), independent(Prayer.HawkEye));
assert.deepEqual(update.independent, [Prayer.SteelSkin, Prayer.HawkEye]);

// Eagle Eye (the offensive slot) turns off Hawk Eye and keeps Steel Skin.
update = toggle(state(update), offensive(Prayer.EagleEye));
assert.equal(update.offensive, Prayer.EagleEye);
assert.deepEqual(update.independent, [Prayer.SteelSkin]);
assert.equal(update.independentTouched, true);

// Ultimate Strength turns off Eagle Eye.
update = toggle(state(update), independent(Prayer.UltimateStrength));
assert.equal(update.offensive, null);
assert.equal(update.offensiveTouched, true);
assert.deepEqual(update.independent, [Prayer.SteelSkin, Prayer.UltimateStrength]);

// Piety turns off all three groups' lower tiers; a Skin prayer then turns off Piety.
update = toggle(state(update), offensive(Prayer.Piety));
assert.equal(update.offensive, Prayer.Piety);
assert.deepEqual(update.independent, []);
update = toggle(state(update), independent(Prayer.RockSkin));
assert.equal(update.offensive, null);
assert.deepEqual(update.independent, [Prayer.RockSkin]);

// Rapid Heal and Preserve never conflict.
update = toggle(state(update), independent(Prayer.RapidHeal), independent(Prayer.Preserve), offensive(Prayer.Rigour));
assert.equal(update.offensive, Prayer.Rigour);
assert.deepEqual(update.independent, [Prayer.RapidHeal, Prayer.Preserve]);

// Deadeye and Mystic Vigour boost Defence but keep the Skin prayers on.
assert.equal(prayersConflict(Prayer.Deadeye, Prayer.SteelSkin), false);
assert.equal(prayersConflict(Prayer.MysticVigour, Prayer.ThickSkin), false);
assert.equal(prayersConflict(Prayer.Augury, Prayer.SteelSkin), true);
assert.equal(prayersConflict(Prayer.MysticLore, Prayer.SharpEye), true);
assert.equal(prayersConflict(Prayer.ClarityOfThought, Prayer.BurstOfStrength), false);

// Quick prayers: a later selection turns off an earlier one it conflicts with.
update = toggle(none, { type: "quickPrayers", selections: [Prayer.Piety, Prayer.SteelSkin, Prayer.UltimateStrength, Prayer.ProtectMelee] });
assert.equal(update.offensive, null);
assert.equal(update.protection, Prayer.ProtectMelee);
assert.deepEqual(update.independent, [Prayer.SteelSkin, Prayer.UltimateStrength]);

// Drain effects. WIKI: 1 per 36 s, 6 per 6 s, 12 per 3 s.
assert.equal(prayerDrainEffects[Prayer.ThickSkin], 1);
assert.equal(prayerDrainEffects[Prayer.HawkEye], 6);
assert.equal(prayerDrainEffects[Prayer.UltimateStrength], 12);
assert.equal(prayerDrainEffects[Prayer.Chivalry], 12);

// Boosts reach the formulas through the independent prayers.
const multipliers = getPrayerMultipliers(null, null, [Prayer.SteelSkin, Prayer.UltimateStrength, Prayer.IncredibleReflexes]);
assert.equal(multipliers.attack, 1.15);
assert.equal(multipliers.strength, 1.15);
assert.equal(multipliers.defence, 1.15);
assert.equal(getPrayerMultipliers(null, Prayer.EagleEye, [Prayer.SteelSkin]).defence, 1.15);
assert.equal(getPrayerMultipliers(null, Prayer.EagleEye, [Prayer.SteelSkin]).ranged, 1.15);
assert.equal(getPrayerMultipliers(null, null, [Prayer.MysticLore]).magicDamage, 1.01);
assert.deepEqual(getPrayerMultipliers(null, Prayer.Chivalry), { ...getPrayerMultipliers(null, null), attack: 1.15, strength: 1.18, defence: 1.2 });

// End to end: 99 Attack with Incredible Reflexes is floor(99 x 1.15) = 113,
// + 8 = 121 effective; 99 Strength with Ultimate Strength is 113 + 8 = 121
// and a max hit of floor(0.5 + 121 x (100 + 64) / 640) = 31.
const player = { kind: "player", levels: { attack: 99, strength: 99, defence: 99, ranged: 99, magic: 99 }, stance: "Other", magicBaseMaxHit: 30 };
const monster = {
  kind: "npc",
  levels: { attack: 1, strength: 1, defence: 1, ranged: 1, magic: 1 },
  offensive: { atk: 0, str: 0, ranged: 0, rangedStr: 0, magic: 0, magicStr: 0 },
  defensive: { stab: 0, slash: 0, crush: 0, magic: 0, rangedLight: 0, rangedStandard: 0, rangedHeavy: 0 },
};
const gear = {
  attackStab: 0, attackSlash: 0, attackCrush: 0, attackMagic: 0, attackRanged: 0, defenceStab: 0, defenceSlash: 0, defenceCrush: 0, defenceMagic: 0, defenceRanged: 0,
  meleeStrength: 100, rangedStrength: 100, magicDamage: 0, prayer: 0, attackSpeed: 4, attackRange: 1,
};
assert.equal(getPlayerAccuracyRolls(player, monster, "melee_slash", gear, multipliers).attackRoll, 121 * 64);
assert.equal(getFormulaMaxHit(player, "melee_slash", gear, multipliers), 31);

console.log("lower-tier prayers: ok");
