// The default loadouts of Yama's whole fight (the descriptor's `loadouts`,
// encounters/registry.js), from https://oldschool.runescape.wiki/w/Yama/Strategies,
// "Max Mage" and "Melee": the first item of each slot, and the inventory.
// Left out: the teleport tablet, and the Soulflame horn (no special of it in
// this client); anglerfish fill their slots.
const runePouch = { kind: "divine", slots: [{ id: 30843 }, { id: 554 }, { id: 560 }, { id: 565 }] }; // Aether, fire, death, blood
const supplies = { equippedAmmo: { id: 22947 }, quiverAmmo: null, runePouch, blowpipe: null, selectedSpell: null, spellbook: "arceuus" }; // Rada's blessing 4
const anglerfish = (count) => Array(count).fill(13441);
export const yamaFullLoadouts = {
  mage: {
    name: "Max Mage",
    equipment: {
      head: 21018, amulet: 12002, cape: 21791, body: 21021, legs: 21024, // Ancestral, occult necklace, imbued Saradomin cape
      hands: 31106, boots: 31097, weapon: 29594, shield: 27251, ring: 28313, // Confliction gauntlets, Avernic treads (max), purging staff, Elidinis' ward (f), magus ring
    },
    inventory: [
      27275, 27665, 10925, 10925, // Tumeken's shadow, accursed sceptre, Sanfew serum x2
      11806, 3024, 3024, 3024, // Saradomin godsword (for the Judge), super restores
      3024, 27641, ...anglerfish(16), // Saturated heart
      27281, 25818, // Divine rune pouch, Book of the Dead
    ],
    supplies,
  },
  melee: {
    name: "Melee (Emberlight)",
    equipment: {
      head: 26382, amulet: 29801, cape: 21295, body: 26384, legs: 26386, // Torva, amulet of rancour, infernal cape
      hands: 22981, boots: 31097, weapon: 29589, shield: 22322, ring: 28307, // Ferocious gloves, Avernic treads (max), Emberlight, Avernic defender, ultor ring
    },
    inventory: [
      29594, 31106, 23685, 10925, // Purging staff and confliction gauntlets (for the Judge and the flares), divine super combat, Sanfew serum
      12002, 29577, 21003, 11806, // Occult necklace, burning claws, elder maul, Saradomin godsword
      3024, 3024, 3024, 3024, // Super restores
      ...anglerfish(14),
      27281, 25818, // Divine rune pouch, Book of the Dead
    ],
    supplies,
  },
};
