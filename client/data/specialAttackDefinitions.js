import { getBaseItemId } from "./itemVariants.js";
import { spotAnimIds } from "./spotAnimIds.js";
var elderMaulSpecial = {
  energyCost: 50,
  defenceStyle: "melee_crush",
  animationId: 11124,
  graphicId: 2804,
  postHitEffects: [
    {
      effect: "drain_defence",
      percent: 35,
    },
  ],
};
var accursedSceptreSpecial = {
  energyCost: 50,
  poweredSpellWeaponId: 27665,
  styleOverride: "magic",
  attackKindOverride: "magic_fire",
  animationId: 9961,
  postHitEffects: [
    {
      effect: "condemn",
    },
  ],
};
var abyssalTentacleSpecial = {
  energyCost: 50,
  animationId: 1658,
  targetGraphic: {
    spotAnimId: 341,
    delayCycles: 0,
    height: 96,
  },
  onFireEffects: [
    {
      effect: "freeze",
      durationTicks: 8,
    },
    {
      effect: "poison",
      severity: 4,
      chancePercent: 50,
    },
  ],
};
var zaryteCrossbowSpecial = {
  energyCost: 75,
  animationId: 9168,
};
var specialAttackDefinitionByWeaponId = {
  29589: {
    energyCost: 50,
    defenceStyle: "melee_stab",
    animationId: 11138,
    graphicId: 2810,
    postHitEffects: [
      {
        effect: "weaken",
      },
    ],
  },
  27665: accursedSceptreSpecial,
  27679: accursedSceptreSpecial,
  27676: accursedSceptreSpecial,
  27291: { energyCost: 75, instantEffect: "tumekensLight" },
  11791: {
    energyCost: 100,
    instantEffect: "powerOfDeath",
  },
  12904: {
    energyCost: 100,
    instantEffect: "powerOfDeath",
  },
  22296: {
    energyCost: 100,
    instantEffect: "powerOfDeath",
  },
  24144: {
    energyCost: 100,
    instantEffect: "powerOfDeath",
  },
  12006: abyssalTentacleSpecial,
  26484: abyssalTentacleSpecial,
  13652: {
    defenceStyle: "melee_slash",
    energyCost: 50,
    isMultiHit: true,
    animationId: 7514,
    graphicId: 1171,
  },
  20784: {
    defenceStyle: "melee_slash",
    energyCost: 50,
    isMultiHit: true,
    animationId: 7514,
    graphicId: 1171,
  },
  11806: {
    defenceStyle: "melee_slash",
    energyCost: 50,
    animationId: 7640,
    graphicId: 1209,
    postHitEffects: [
      {
        effect: "heal_hp",
        percentOfDamage: 50,
      },
      {
        effect: "restore_prayer",
        percentOfDamage: 25,
      },
    ],
  },
  20372: {
    defenceStyle: "melee_slash",
    energyCost: 50,
    animationId: 7640,
    graphicId: 1209,
    postHitEffects: [
      {
        effect: "heal_hp",
        percentOfDamage: 50,
      },
      {
        effect: "restore_prayer",
        percentOfDamage: 25,
      },
    ],
  },
  11804: {
    defenceStyle: "melee_slash",
    energyCost: 50,
    animationId: 7642,
    postHitEffects: [
      {
        effect: "drain_defence",
        flat: true,
      },
    ],
  },
  20370: {
    defenceStyle: "melee_slash",
    energyCost: 50,
    animationId: 7642,
    postHitEffects: [
      {
        effect: "drain_defence",
        flat: true,
      },
    ],
  },
  11802: {
    defenceStyle: "melee_slash",
    energyCost: 50,
    animationId: 7644,
    graphicId: 1211,
  },
  20368: {
    defenceStyle: "melee_slash",
    energyCost: 50,
    animationId: 7644,
    graphicId: 1211,
  },
  11808: {
    defenceStyle: "melee_slash",
    energyCost: 50,
    animationId: 7638,
    graphicId: 1210,
    postHitEffects: [
      {
        effect: "freeze",
        durationTicks: 32,
      },
    ],
  },
  20374: {
    defenceStyle: "melee_slash",
    energyCost: 50,
    animationId: 7638,
    graphicId: 1210,
    postHitEffects: [
      {
        effect: "freeze",
        durationTicks: 32,
      },
    ],
  },
  13576: {
    defenceStyle: "melee_crush",
    energyCost: 50,
    animationId: 1378,
    graphicId: 1292,
    postHitEffects: [
      {
        effect: "drain_defence",
        percent: 30,
      },
    ],
  },
  // The Rondache, Shield Slam (WIKI: Rondache): the shield's own special, "barehanded or with any one-handed
  // weapon", from melee range, needing 10 charges and using "no special attack energy". It rolls against crush.
  // Its damage and accuracy are the profile's (profiles.js), its charges engine/rondache.js's.
  // TFA_HUMAN_RONDACHE_SPECIAL and VFX_TFA_RONDACHE_SPECIAL (CACHE: sequence and spot animation names).
  34719: {
    energyCost: 0,
    formulaStyleOverride: "melee_crush",
    defenceStyle: "melee_crush",
    styleOverride: "melee",
    attackKindOverride: "melee_crush",
    attackRange: 1,
    minimumRondacheCharges: 10,
    excludedTargetAttribute: "flying", // "Cannot be used against flying enemies" (WIKI: Rondache)
    animationId: 15108,
    graphicId: 4422,
  },
  // Zorya's tome, Zorya's flow (WIKI: Zorya's tome): 50%. Its accuracy and damage, and the attacks it speeds up
  // after it, are the profile's and launch.js's. It does not get Longrange's 2 more tiles (WIKI, "Known bugs"): 7.
  // TFA_HUMAN_ZORYA_TOME_SPECIAL_ATTACK and VFX_ZORYA_TOME_SPEC_SPOTANIM (CACHE: sequence and spot animation names).
  34725: {
    energyCost: 50,
    attackRange: 7,
    animationId: 15140,
    graphicId: 4432,
  },
  31113: {
    energyCost: 50,
    animationId: 12394,
    graphicId: 3364,
    attackSpeedOverride: 5,
    postHitEffects: [
      {
        effect: "drain_magic",
        base: 0,
        percentOfDamage: 100,
      },
    ],
  },
  29594: {
    energyCost: 25,
    styleOverride: "magic",
    onKillEffect: {
      refundSpecEnergy: 25,
      reduceAttackDelayTicks: 3,
      targetGraphicBySize: [
        spotAnimIds.VFX_IGNITE_STAFF_01_1X1,
        spotAnimIds.VFX_IGNITE_STAFF_01_2X2,
        spotAnimIds.VFX_IGNITE_STAFF_01_3X3,
      ],
    },
  },
  27690: {
    energyCost: 50,
    styleOverride: "magic",
    attackKindOverride: "magic_fire",
    guaranteedHit: true,
    animationId: 11275,
    graphicId: 2834,
    targetGraphic: {
      spotAnimId: 2363,
      delayCycles: 0,
      height: 0,
    },
  },
  29591: {
    energyCost: 25,
    targetAttribute: "demon",
    animationId: 11133,
    graphicId: 2806,
    targetGraphic: {
      spotAnimId: 2808,
      delayCycles: "projectile_arrival",
      height: 0,
    },
    hitDelayTicks: 3,
    onFireEffects: [
      {
        effect: "bind",
        delayTicks: 2,
        durationTicks: 21,
      },
      {
        effect: "burn",
        firstPulseDelayTicks: 3,
        pulses: 6,
        severity: "normal",
      },
    ],
  },
  29577: {
    energyCost: 35,
    isMultiHit: true,
    animationId: 11140,
    graphicId: 2814,
    postHitEffects: [
      {
        effect: "burn",
        pulses: 10,
        severity: "normal",
        chancePercentByBranch: [15, 30, 45],
      },
    ],
  },
  11785: {
    energyCost: 50,
    animationId: 7552,
  },
  // Zaryte crossbow, Evoke: 75% (WIKI, and OBS: energy 1000 -> 250 on the
  // shot); animation 9168, the crossbow's ordinary shot (OBS: all 18 Evokes of
  // two players in 12 recorded Nex kills, 2026). tsps had 9166 from an older
  // rsprox transcript; no recorded Evoke plays it.
  26374: zaryteCrossbowSpecial,
  27186: zaryteCrossbowSpecial,
  12926: {
    energyCost: 50,
    animationId: 5061,
    launchHeal: {
      percentOfDamage: 50,
      minimumHeal: 0,
    },
  },
  1215: {
    defenceStyle: "melee_slash",
    animationId: 1062,
  },
  1231: {
    defenceStyle: "melee_slash",
    animationId: 1062,
  },
  5680: {
    defenceStyle: "melee_slash",
    animationId: 1062,
  },
  5698: {
    defenceStyle: "melee_slash",
    animationId: 1062,
  },
  13265: {
    defenceStyle: "melee_slash",
    animationId: 3300,
  },
  13267: {
    defenceStyle: "melee_slash",
    animationId: 3300,
  },
  13269: {
    defenceStyle: "melee_slash",
    animationId: 3300,
  },
  13271: {
    defenceStyle: "melee_slash",
    animationId: 3300,
  },
  // Dragon longsword, Cleave: 25%, against slash (WIKI)
  1305: {
    defenceStyle: "melee_slash",
    energyCost: 25,
    animationId: 1058,
  },
  // Dragon sword (the wiki's Dragon shortsword), Wild Stab: 40% (WIKI). Protect from Melee is not ignored here.
  21009: {
    defenceStyle: "melee_stab",
    energyCost: 40,
    animationId: 7515,
  },
  4587: {
    energyCost: 55,
    defenceStyle: "melee_slash",
    animationId: 1872,
  },
  // Arkan blade, "Flames of Ralos" (oldschool.runescape.wiki/w/Arkan_blade,
  // read 2026-11-23): 30 % of the energy; one hit, rolled against slash
  // defence, with accuracy and damage raised by half (playerAttack/profiles.js);
  // a hit burns the target for 10 damage over 40 ticks, a strong burn. The
  // wiki has no ids: the animation and the effect on the player are the
  // cache's vmq4_arkan_blade_special and vmq4_arkan_blade_special_spotanim.
  30955: {
    energyCost: 30,
    defenceStyle: "melee_slash",
    animationId: 12297,
    graphicId: 3336,
    postHitEffects: [
      {
        effect: "burn",
        pulses: 10,
        severity: "strong",
      },
    ],
  },
  // Eldritch nightmare staff, "Invocate"
  // (oldschool.runescape.wiki/w/Eldritch_Nightmare_staff, read 2026-11-23): 55 %
  // of the energy; a magic hit that needs no runes, with a base max hit by
  // the Magic level (engine/weapons.js), cast from 10 tiles; it restores
  // prayer points by half the damage rolled, beyond the player's level too,
  // up to 120. A recording of the game (2026-11-23, four casts) has the rest: the hitsplat and the prayer come
  // 3 ticks after the animation; the animation and the two effects, one on
  // the player and one on the target, start on the tick of the cast; a hit
  // that the target's 48 hitpoints cut short restored 28.
  24425: {
    energyCost: 55,
    poweredSpellWeaponId: 24425,
    styleOverride: "magic",
    attackKindOverride: "magic_fire",
    attackRange: 10,
    hitDelayTicks: 3,
    animationId: 8532,
    graphicId: 1762,
    targetGraphic: {
      spotAnimId: 1761,
      delayCycles: 0,
      height: 0,
    },
    postHitEffects: [
      {
        effect: "restore_prayer",
        percentOfDamage: 50,
        ofRolledDamage: true,
        minimumRestore: 0,
        maximumPoints: 120,
      },
    ],
  },
  // Dragon mace, Shatter: 25% (WIKI)
  1434: {
    defenceStyle: "melee_crush",
    energyCost: 25,
    animationId: 1060,
  },
  11061: {
    defenceStyle: "melee_crush",
    animationId: 6147,
  },
  4153: {
    animationId: 1667,
  },
  12848: {
    animationId: 1667,
  },
  1377: {
    animationId: 1056,
  },
  // Dragon and crystal halberd, Sweep: 30% (WIKI: Special attacks)
  3204: {
    defenceStyle: "melee_slash",
    energyCost: 30,
    animationId: 1203,
  },
  23987: {
    defenceStyle: "melee_slash",
    energyCost: 30,
    animationId: 1203,
  },
  23986: {
    defenceStyle: "melee_slash",
    animationId: 1203,
  },
  1249: {
    energyCost: 25,
    animationId: 1064,
  },
  1263: {
    energyCost: 25,
    animationId: 1064,
  },
  5716: {
    energyCost: 25,
    animationId: 1064,
  },
  5730: {
    energyCost: 25,
    animationId: 1064,
  },
  11824: {
    energyCost: 25,
    animationId: 1064,
  },
  11889: {
    energyCost: 25,
    animationId: 1064,
  },
  4151: {
    energyCost: 50,
    defenceStyle: "melee_slash",
    animationId: 1658,
    targetGraphic: {
      spotAnimId: 341,
      delayCycles: 0,
      height: 96,
    },
  },
  12773: {
    energyCost: 50,
    defenceStyle: "melee_slash",
    animationId: 1658,
    targetGraphic: {
      spotAnimId: 341,
      delayCycles: 0,
      height: 96,
    },
  },
  12774: {
    energyCost: 50,
    defenceStyle: "melee_slash",
    animationId: 1658,
    targetGraphic: {
      spotAnimId: 341,
      delayCycles: 0,
      height: 96,
    },
  },
  26482: {
    energyCost: 50,
    defenceStyle: "melee_slash",
    animationId: 1658,
    targetGraphic: {
      spotAnimId: 341,
      delayCycles: 0,
      height: 96,
    },
  },
  // Saradomin sword, Saradomin's Lightning: 100%, against slash (WIKI)
  11838: {
    defenceStyle: "melee_slash",
    energyCost: 100,
    animationId: 1132,
  },
  12809: {
    animationId: 1132,
  },
  13263: {
    animationId: 3299,
    targetGraphic: {
      spotAnimId: 1284,
      delayCycles: 15,
      height: 0,
    },
  },
  21003: elderMaulSpecial,
  27100: elderMaulSpecial,
  21015: {
    defenceStyle: "melee_crush",
    animationId: 7511,
  },
  // Dark bow and its painted versions, Descent of Darkness / Dragons: 55% (WIKI: Dark bow)
  11235: {
    energyCost: 55,
    animationId: 426,
  },
  12765: {
    energyCost: 55,
    animationId: 426,
  },
  12766: {
    energyCost: 55,
    animationId: 426,
  },
  12767: {
    energyCost: 55,
    animationId: 426,
  },
  12768: {
    energyCost: 55,
    animationId: 426,
  },
  // Magic shortbow, Snapshot: 55%; the (i), 50% (WIKI: Magic shortbow, Magic shortbow (i))
  861: {
    energyCost: 55,
    animationId: 426,
  },
  // Seercull, Soulshot. WIKI: "consumes 100% of the player's special attack
  // energy", "is guaranteed to hit" and "lowers the opponent's Magic level
  // equal to damage dealt", and "will only drain the opponent's Magic level
  // if it is not already reduced". The hit and its damage are the profile's
  // (playerAttack/profiles.js). Animation: the bows' own shot, as the other
  // bows here; its graphics are the renderer's (rendering.js, PD).
  6724: {
    energyCost: 100,
    animationId: 426,
    postHitEffects: [
      {
        effect: "drain_magic",
        base: 0,
        percentOfDamage: 100,
        onlyIfUndrained: true,
      },
    ],
  },
  12788: {
    energyCost: 50,
    animationId: 426,
  },
  // Light and heavy ballista, Concentrated Shot: 65% (WIKI: Heavy ballista)
  19478: {
    energyCost: 65,
    animationId: 7555,
  },
  19481: {
    energyCost: 65,
    animationId: 7555,
  },
  // Dragon crossbow, Annihilate: 60% (WIKI: Dragon crossbow)
  21902: {
    energyCost: 60,
    animationId: 4230,
  },
  26219: {
    defenceStyle: "melee_stab",
    energyCost: 25,
    animationId: 11222,
    graphicId: 2833,
  },
  27246: {
    defenceStyle: "melee_stab",
    energyCost: 25,
    animationId: 11222,
    graphicId: 2833,
  },
  28338: {
    energyCost: 0,
    animationId: 10173,
    graphicId: 2430,
  },
  // No entry for the Blade of Saeldor (23995) or its (c) versions: it has no special attack (WIKI: Blade of
  // Saeldor; one was polled and did not pass). An entry gave it a special button that did nothing.
  22613: {
    defenceStyle: "melee_stab",
    animationId: 7515,
  },
  22622: {
    defenceStyle: "melee_stab",
    animationId: 7515,
  },
  22616: {
    defenceStyle: "melee_crush",
    animationId: 1378,
  },
  22625: {
    defenceStyle: "melee_crush",
    animationId: 1378,
  },
  22610: {
    animationId: 8184,
  },
  22619: {
    animationId: 8184,
  },
  22634: {
    animationId: 929,
  },
  22636: {
    animationId: 929,
  },
  22631: {
    animationId: 929,
  },
  22633: {
    animationId: 929,
  },
  11920: {
    animationId: 400,
  },
  12797: {
    animationId: 400,
  },
  23677: {
    animationId: 400,
  },
  25376: {
    animationId: 400,
  },
  4755: {
    animationId: 2062,
  },
  4982: {
    animationId: 2062,
  },
};
function getSpecialAttackDefinition(weaponId) {
  const definition = specialAttackDefinitionByWeaponId[getBaseItemId(weaponId)];
  if (definition !== undefined && weaponId === 28688) {
    return {
      ...definition,
      animationId: 10656,
    };
  } else {
    return definition;
  }
}
function hasSpecialAttack(weaponId) {
  return getSpecialAttackDefinition(weaponId) !== undefined;
}
// The item whose special attack the player's spec bar uses: the weapon's, or else the Rondache's, the one shield
// with a special of its own (CACHE: of the shields in enum 906, the table of special attacks, only the Rondache has
// a value above 0). A weapon with a special of its own keeps it (inferred). A two-handed weapon leaves no shield.
var RONDACHE_SPECIAL_ID = 34719;
function getEquippedSpecialAttackItemId(equipment) {
  const weapon = equipment?.weapon;
  if (weapon !== undefined && hasSpecialAttack(weapon)) {
    return weapon;
  }
  return equipment?.shield === RONDACHE_SPECIAL_ID ? RONDACHE_SPECIAL_ID : undefined;
}
export { getSpecialAttackDefinition, hasSpecialAttack, getEquippedSpecialAttackItemId };
