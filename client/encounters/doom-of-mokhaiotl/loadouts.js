// The Doom of Mokhaiotl's default loadouts (the descriptor's `loadouts`,
// encounters/registry.js), from the wiki's strategy guide (Doom of
// Mokhaiotl/Strategies, read 2026-11-26): the twisted bow, the Zaryte
// crossbow for specials, a switch for each larva (Scorching bow, Darklight,
// Slayer's staff (e), all demonbane) and the noxious halberd or scythe to
// punish. Its divine rune pouch holds death, aether, blood and fire: Death
// Charge, Dark Demonbane, and the greater thralls with the Book of the Dead
// (fire, blood, and cosmic from the aether). They replace the presets the
// application held for the Doom (client/assets/application.js, `_le`), the
// first unchanged but for the rune pouch, now carried.
const runePouch = { kind: "divine", slots: [{ id: 560 }, { id: 30843 }, { id: 565 }, { id: 554 }] }; // Death, aether, blood, fire
const supplies = {
  equippedAmmo: { id: 33595 }, // Seeking dragon arrow
  quiverAmmo: { id: 9242 }, // Ruby bolts (e), for the Zaryte crossbow
  runePouch,
  selectedSpell: "Dark Demonbane",
  spellbook: "arceuus",
};
// Worn with either armour.
const jewellery = {
  cape: 28951, // Dizana's quiver
  amulet: 33639, // Necklace of rupture
  boots: 31097, // Avernic treads (max)
  ring: 25975, // Lightbearer
};
const masori = {
  head: 27235, // Masori mask (f)
  body: 27238, // Masori body (f)
  legs: 27241, // Masori chaps (f)
  hands: 26235, // Zaryte vambraces
};
// The guide's inventory, its first slot the weapon not worn.
const inventory = (firstSlot) => [
  firstSlot, 29796, 6746, 21255, // Noxious halberd, Darklight, Slayer's staff (e)
  29591, 22325, 23733, 2444, // Scorching bow, Scythe of Vitur, divine ranging, ranging
  2444, 6685, 6685, 6685, // Saradomin brews
  6685, 6685, 6685, 6685,
  3024, 3024, 3024, 3024, // Super restores
  3024, 3024, 13441, 13441, // Anglerfish
  13441, 13441, 13441, 27281, // The divine rune pouch
];

export const doomLoadouts = {
  max_tbow: {
    name: "Max (Twisted bow)",
    equipment: { ...masori, ...jewellery, weapon: 20997 }, // Twisted bow
    inventory: inventory(26374), // Zaryte crossbow
    supplies,
  },
  // The same, but for the Book of the Dead in the off-hand to cast thralls
  // from the start, with the one-handed Zaryte crossbow; the twisted bow is
  // carried in its place. (The guide does not recommend thralls here: more
  // acid. Some bring them.)
  max_tbow_thralls: {
    name: "Max (Twisted bow) with thralls",
    equipment: { ...masori, ...jewellery, weapon: 26374, shield: 25818 }, // Zaryte crossbow, Book of the Dead
    inventory: inventory(20997), // Twisted bow
    supplies,
  },
  // The guide's ranged table with full Void Knight equipment (elite), the
  // twisted bow ("with a Twisted bow, either Masori or Elite void works").
  void_tbow: {
    name: "Void (Twisted bow)",
    equipment: {
      ...jewellery,
      head: 11664, // Void ranger helm
      body: 13072, // Elite void top
      legs: 13073, // Elite void robe
      hands: 8842, // Void knight gloves
      weapon: 20997, // Twisted bow
    },
    inventory: inventory(26374), // Zaryte crossbow
    supplies,
  },
};
