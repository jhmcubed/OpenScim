import { commonMechanicsDefaults } from "./mechanicsConfig.js";
var Prayer = {
  ProtectMagic: "ProtectMagic",
  ProtectRange: "ProtectRange",
  ProtectMelee: "ProtectMelee",
  Redemption: "Redemption",
  Augury: "Augury",
  Rigour: "Rigour",
  Piety: "Piety",
  Zeal: "Zeal",
  EagleEye: "EagleEye",
  MysticMight: "MysticMight",
  Deadeye: "Deadeye",
  MysticVigour: "MysticVigour",
  Preserve: "Preserve",
  RapidRestore: "RapidRestore",
  RapidHeal: "RapidHeal",
  ThickSkin: "ThickSkin",
  BurstOfStrength: "BurstOfStrength",
  ClarityOfThought: "ClarityOfThought",
  SharpEye: "SharpEye",
  MysticWill: "MysticWill",
  RockSkin: "RockSkin",
  SuperhumanStrength: "SuperhumanStrength",
  ImprovedReflexes: "ImprovedReflexes",
  HawkEye: "HawkEye",
  MysticLore: "MysticLore",
  SteelSkin: "SteelSkin",
  UltimateStrength: "UltimateStrength",
  IncredibleReflexes: "IncredibleReflexes",
  Chivalry: "Chivalry",
};
// The lower-tier prayers sit in the "independent" slot, because in the game
// several of them stay on together (Steel Skin, Ultimate Strength and
// Incredible Reflexes; Steel Skin with Eagle Eye). Which ones turn each
// other off is prayerConflictGroupsByPrayer below.
var prayerSlotByPrayer = {
  ProtectMagic: "protection",
  ProtectRange: "protection",
  ProtectMelee: "protection",
  Redemption: "protection",
  Augury: "offensive",
  Rigour: "offensive",
  Piety: "offensive",
  Zeal: "offensive",
  EagleEye: "offensive",
  MysticMight: "offensive",
  Deadeye: "offensive",
  MysticVigour: "offensive",
  Preserve: "independent",
  RapidRestore: "independent",
  RapidHeal: "independent",
  ThickSkin: "independent",
  BurstOfStrength: "independent",
  ClarityOfThought: "independent",
  SharpEye: "independent",
  MysticWill: "independent",
  RockSkin: "independent",
  SuperhumanStrength: "independent",
  ImprovedReflexes: "independent",
  HawkEye: "independent",
  MysticLore: "independent",
  SteelSkin: "independent",
  UltimateStrength: "independent",
  IncredibleReflexes: "independent",
  Chivalry: "offensive",
};
// WIKI (Prayer, "Conflicting prayers"): switching a prayer on turns off every
// active prayer it conflicts with. Two prayers conflict when they boost the
// same group, or when one boosts melee (attack or strength), ranged or magic
// and the other boosts a different one of those three. Deadeye and Mystic
// Vigour boost Defence too but do not conflict with the three Skin prayers,
// so their entry leaves defence out. Prayers not listed never conflict.
var prayerConflictGroupsByPrayer = {
  ThickSkin: ["defence"],
  RockSkin: ["defence"],
  SteelSkin: ["defence"],
  BurstOfStrength: ["strength"],
  SuperhumanStrength: ["strength"],
  UltimateStrength: ["strength"],
  ClarityOfThought: ["attack"],
  ImprovedReflexes: ["attack"],
  IncredibleReflexes: ["attack"],
  SharpEye: ["ranged"],
  HawkEye: ["ranged"],
  EagleEye: ["ranged"],
  Deadeye: ["ranged"],
  MysticWill: ["magic"],
  MysticLore: ["magic"],
  MysticMight: ["magic"],
  MysticVigour: ["magic"],
  Chivalry: ["attack", "strength", "defence"],
  Piety: ["attack", "strength", "defence"],
  Zeal: ["attack", "strength", "defence"],
  Rigour: ["ranged", "defence"],
  Augury: ["magic", "defence"],
};
var offenceStyleByConflictGroup = {
  attack: "melee",
  strength: "melee",
  ranged: "ranged",
  magic: "magic",
};
function prayersConflict(firstPrayer, secondPrayer) {
  if (firstPrayer === secondPrayer) {
    return false;
  }
  const firstGroups = prayerConflictGroupsByPrayer[firstPrayer];
  const secondGroups = prayerConflictGroupsByPrayer[secondPrayer];
  if (firstGroups === undefined || secondGroups === undefined) {
    return false;
  }
  if (firstGroups.some((group) => secondGroups.includes(group))) {
    return true;
  }
  const firstStyles = firstGroups.map((group) => offenceStyleByConflictGroup[group]).filter(Boolean);
  const secondStyles = secondGroups.map((group) => offenceStyleByConflictGroup[group]).filter(Boolean);
  return firstStyles.some((style) => secondStyles.some((otherStyle) => otherStyle !== style));
}
// A lower-tier prayer: one in the independent slot that boosts a combat
// stat. An encounter rule that blocks offensive prayers blocks these too.
function isLowerTierBoostPrayer(prayer) {
  return prayerSlotByPrayer[prayer] === "independent" && prayerConflictGroupsByPrayer[prayer] !== undefined;
}
var mechanicsKeyByPrayer = {
  Deadeye: "upgradedPrayers",
  MysticVigour: "upgradedPrayers",
  Zeal: "zealPrayer",
};
function isPrayerUnlockedByMechanics(prayer, mechanicsConfig) {
  const mechanicsKey = mechanicsKeyByPrayer[prayer];
  return mechanicsKey === undefined || (mechanicsConfig[mechanicsKey] ?? commonMechanicsDefaults[mechanicsKey]) === true;
}
var prayerDrainEffects = {
  ProtectMagic: 12,
  ProtectRange: 12,
  ProtectMelee: 12,
  Piety: 24,
  Zeal: 24,
  Rigour: 24,
  Augury: 24,
  EagleEye: 12,
  MysticMight: 12,
  Deadeye: 12,
  MysticVigour: 12,
  Redemption: 6,
  Preserve: 2,
  RapidRestore: 1,
  RapidHeal: 2,
  // WIKI (Prayer, "Drain effect"): 1 is a point per 36 seconds, 6 per 6
  // seconds, 12 per 3 seconds.
  ThickSkin: 1,
  BurstOfStrength: 1,
  ClarityOfThought: 1,
  SharpEye: 1,
  MysticWill: 1,
  RockSkin: 6,
  SuperhumanStrength: 6,
  ImprovedReflexes: 6,
  HawkEye: 6,
  MysticLore: 6,
  SteelSkin: 12,
  UltimateStrength: 12,
  IncredibleReflexes: 12,
  Chivalry: 12,
};
var redemptionHealFraction = 0.25;
function createPrayerState() {
  return {
    points: 99,
    maxPoints: 99,
    drainCounter: 0,
    activePrayers: [],
    prayerActivationTicks: {},
  };
}
export {
  Prayer,
  prayerSlotByPrayer,
  prayersConflict,
  isLowerTierBoostPrayer,
  isPrayerUnlockedByMechanics,
  prayerDrainEffects,
  redemptionHealFraction,
  createPrayerState,
};
