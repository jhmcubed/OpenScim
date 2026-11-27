// Araxxor's default loadouts (the descriptor's `loadouts`, encounters/registry.js), from the wiki's strategy guide
// (Araxxor/Strategies): the best of each slot of its Melee and Ranged tables that the client has, and its
// inventory. The guide's first melee weapon is the Obligator; the defaults keep the scythe, its second, and the two
// "Beta:" setups at the end (after the defaults, the first staying a player's start) are the Fractured Archive's: the
// Obligator (two-handed, WIKI), and the Rondache, the guide's first shield, with the Inquisitor's mace.
// The client has no dark crabs: anglerfish stand in for the food. The guide's extended anti-venom+ keeps venom off for
// 6.3 minutes once pre-potted (WIKI, OBS: -59, client/engine/consumables.js). Its rune pouch holds the guide's blood, fire, aether and death runes
// for thralls, with the Book of the Dead.
const runePouch = { kind: "divine", slots: [{ id: 565 }, { id: 554 }, { id: 30843 }, { id: 560 }] }; // Blood, fire, aether, death
const meleeArmour = {
  head: 11865, // Slayer helmet (i)
  cape: 21295, // Infernal cape
  amulet: 29801, // Amulet of rancour
  body: 24420, // Inquisitor's hauberk
  legs: 24421, // Inquisitor's plateskirt
  hands: 22981, // Ferocious gloves
  boots: 31097, // Avernic treads (max)
  ring: 28307, // Ultor ring
};
const meleeSupplies = { equippedAmmo: { id: 22947 }, quiverAmmo: null, runePouch, blowpipe: null, selectedSpell: null, spellbook: "arceuus" }; // Rada's blessing 4
export const araxxorLoadouts = {
  scythe: {
    name: "Max (Scythe)",
    equipment: { ...meleeArmour, weapon: 22325 }, // Scythe of Vitur (crush, in Inquisitor's)
    inventory: [
      21003, 29796, 23685, 2434, // Elder maul (the guide's special), noxious halberd (for the araxytes), divine super combat, prayer potion
      2434, 2434, 2434, 29824, // Prayer potions, extended anti-venom+
      30875, 13441, 13441, 13441, // Surge potion, anglerfish
      13441, 13441, 13441, 13441,
      13441, 13441, 13441, 13441,
      13441, 13441, 13441, 13441,
      13441, 13441, 27281, 25818, // Anglerfish, the divine rune pouch, the Book of the Dead
    ],
    supplies: meleeSupplies,
  },
  inquisitors_mace: {
    name: "Inquisitor's mace",
    equipment: { ...meleeArmour, weapon: 24417, shield: 22322 }, // Inquisitor's mace, Avernic defender
    inventory: [
      21003, 29796, 23685, 2434, // As above
      2434, 2434, 2434, 29824,
      30875, 13441, 13441, 13441,
      13441, 13441, 13441, 13441,
      13441, 13441, 13441, 13441,
      13441, 13441, 13441, 13441,
      13441, 13441, 27281, 25818,
    ],
    supplies: meleeSupplies,
  },
  twisted_bow: {
    name: "Max (Twisted bow)",
    equipment: {
      head: 11865, // Slayer helmet (i)
      cape: 28951, // Dizana's quiver
      amulet: 33639, // Necklace of rupture
      weapon: 20997, // Twisted bow
      body: 27238, // Masori body (f)
      legs: 27241, // Masori chaps (f)
      hands: 26235, // Zaryte vambraces
      boots: 31097, // Avernic treads (max)
      ring: 25975, // Lightbearer
    },
    inventory: [
      21003, 26374, 23733, 2434, // Elder maul, Zaryte crossbow (the guide's other special), divine ranging potion, prayer potion
      2434, 2434, 29824, 30875, // Prayer potions, extended anti-venom+, surge potion
      13441, 13441, 13441, 13441, // Anglerfish
      13441, 13441, 13441, 13441,
      13441, 13441, 13441, 13441,
      13441, 13441, 13441, 13441,
      13441, 13441, 27281, 25818, // Anglerfish, the divine rune pouch, the Book of the Dead
    ],
    supplies: {
      equippedAmmo: { id: 33595 }, // Seeking dragon arrow
      quiverAmmo: { id: 21944 }, // Ruby dragon bolts (e), for the Zaryte crossbow
      runePouch,
      blowpipe: null,
      selectedSpell: null,
      spellbook: "arceuus",
    },
  },
  beta_obligator: {
    name: "Beta: Max (Obligator)",
    equipment: { ...meleeArmour, weapon: 34715 }, // Obligator (two-handed)
    inventory: [
      21003, 29796, 23685, 2434, // As the scythe's
      2434, 2434, 2434, 29824,
      30875, 13441, 13441, 13441,
      13441, 13441, 13441, 13441,
      13441, 13441, 13441, 13441,
      13441, 13441, 13441, 13441,
      13441, 13441, 27281, 25818,
    ],
    supplies: meleeSupplies,
  },
  beta_rondache: {
    name: "Beta: Inquisitor's mace (Rondache)",
    equipment: { ...meleeArmour, weapon: 24417, shield: 34719 }, // Inquisitor's mace, Rondache
    inventory: [
      21003, 29796, 23685, 2434, // As the scythe's
      2434, 2434, 2434, 29824,
      30875, 13441, 13441, 13441,
      13441, 13441, 13441, 13441,
      13441, 13441, 13441, 13441,
      13441, 13441, 13441, 13441,
      13441, 13441, 27281, 25818,
    ],
    supplies: meleeSupplies,
  },
};
