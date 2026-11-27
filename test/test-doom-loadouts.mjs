// The Doom of Mokhaiotl's setups (client/encounters/doom-of-mokhaiotl/
// loadouts.js): Max (Twisted bow) with its divine rune pouch carried; the
// same with thralls (the Zaryte crossbow and the Book of the Dead worn, the
// twisted bow carried), which casts a greater thrall from the pouch's runes
// and fires the quiver's bolts; and Void (Twisted bow), in full elite void.
// Plain Node with the harness's module hooks and the trimmed cache.
import assert from "node:assert/strict";
import { loadEnvironment } from "../tools/determinism/harness.mjs";

const { prepareArena, engineModule, objTypeLoader } = await loadEnvironment();
const { doomDefinition } = await import("../client/encounters/doom-of-mokhaiotl/encounter.js");
const loadouts = doomDefinition.descriptor.loadouts;

assert.deepEqual(Object.entries(loadouts).map(([key, { name }]) => [key, name]), [
  ["max_tbow", "Max (Twisted bow)"],
  ["max_tbow_thralls", "Max (Twisted bow) with thralls"],
  ["void_tbow", "Void (Twisted bow)"],
]);
const { max_tbow: max, max_tbow_thralls: thralls, void_tbow: voidSet } = loadouts;
for (const { inventory, supplies } of Object.values(loadouts)) {
  assert.equal(inventory.length, 28);
  assert.ok(inventory.includes(27281), "the divine rune pouch is carried");
  assert.deepEqual(supplies.runePouch, { kind: "divine", slots: [{ id: 560 }, { id: 30843 }, { id: 565 }, { id: 554 }] }); // death, aether, blood, fire
  assert.equal(supplies.spellbook, "arceuus");
}
assert.deepEqual(max.equipment, {
  head: 27235, body: 27238, legs: 27241, hands: 26235, cape: 28951, amulet: 33639, boots: 31097, ring: 25975, weapon: 20997,
});
// With thralls: the crossbow and the book worn, the bow where the crossbow was; the rest as Max.
assert.deepEqual(thralls.equipment, { ...max.equipment, weapon: 26374, shield: 25818 });
assert.deepEqual(thralls.inventory, [20997, ...max.inventory.slice(1)]);
assert.equal(max.inventory[0], 26374);
assert.deepEqual(thralls.supplies, max.supplies);
// Void: the four void pieces in place of Masori.
assert.deepEqual(voidSet.equipment, { ...max.equipment, head: 11664, body: 13072, legs: 13073, hands: 8842 });

await prepareArena("doom_of_mokhaiotl");
const startFight = ({ equipment, inventory, supplies }) =>
  engineModule.createSimulationEngine({
    encounterConfig: { kind: "doom_of_mokhaiotl", mechanics: { doomDelve: "1", infiniteHealth: true } },
    objTypeLoader,
    combatSeed: 3,
    inventory: inventory.map((id) => (id === null ? null : { id })),
    equipment: { ...equipment },
    combatSupplies: { ...engineModule.createEmptyCombatSupplies(), ...structuredClone(supplies) },
    attackStylePerCategory: {},
    startPosition: [31, 28],
  });
const step = (engine) => engine.advanceTick(engine.getState().playerPosition);
const messages = (engine) => engine.getLastTickEvents().filter((event) => event.type === "game_message").map((event) => event.segments.map(({ text }) => text).join(""));

// With thralls: a ghost from the pouch's runes, and the crossbow's bolts at him.
{
  const engine = startFight(thralls);
  engine.injectAction({ type: "castThrall", spell: "Resurrect Greater Ghost" });
  step(engine);
  assert.equal(engine.player().thrall?.spellName, "Resurrect Greater Ghost", `cast: ${messages(engine)}`);
  engine.injectAction({ type: "attackTarget", targetId: "doom" });
  const attacks = [];
  const started = engine.encounter.onPlayerAttackStarted.bind(engine.encounter);
  engine.encounter.onPlayerAttackStarted = (attack, context) => (attacks.push(attack), started(attack, context));
  for (let tick = 0; tick < 8 && attacks.length === 0; tick++) step(engine);
  assert.equal(attacks[0]?.targetId, "doom", "the Zaryte crossbow fires");
}
// Max (Twisted bow): no book, no thrall.
{
  const engine = startFight(max);
  engine.injectAction({ type: "castThrall", spell: "Resurrect Greater Ghost" });
  step(engine);
  assert.equal(engine.player().thrall ?? null, null);
  assert.ok(messages(engine).includes("You need the Book of the Dead to cast this spell."));
}
console.log("The Doom's setups: Max (Twisted bow) and Void carry the rune pouch, the thralls setup casts a ghost and fires its crossbow");
process.exit(0);
