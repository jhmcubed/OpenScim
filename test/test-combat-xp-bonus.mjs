// A player's combat experience is multiplied by the target monster's combat
// experience bonus (WIKI, client/data/combatXpBonus.js), and the XP drop's
// "(hit)" stays the hit.
import assert from "node:assert/strict";
import { test } from "node:test";
import { runScenario, loadScenarios } from "../tools/determinism/harness.mjs";

const { combatXpBonusByNpcTypeId } = await import("../client/data/combatXpBonus.js");
const scenarios = await loadScenarios();
const scenario = (name) => scenarios.find((each) => each.name === name);

// The player's hitpoints experience over the damage of every XP drop, the
// "(hit)": 4/3 times the target's multiplier in every style (WIKI, Combat).
// The scenarios used hit one monster, or ones of the same bonus.
async function hitpointsXpPerDamage(name, { overrides } = {}) {
  let hits = 0;
  let engine;
  await runScenario(scenario(name), {
    onTick(tick, tickEngine) {
      engine = tickEngine;
      if (tick === 0 && overrides) engine.encounterRules = { ...engine.encounterRules, combatXpBonusOverrides: overrides };
      for (const event of engine.getLastTickEvents()) if (event.type === "xp_drop") hits += event.predictedHit;
    },
  });
  assert.ok(hits > 100, `${name}: the player hits the boss`);
  return engine.player().xpCounters.hitpoints / hits;
}
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected}`);

test("the wiki's bonuses of the bosses", () => {
  const bonus = (id) => combatXpBonusByNpcTypeId.get(id) ?? 0;
  assert.equal(bonus(8615), 20); // Alchemical Hydra
  assert.equal(bonus(13668), 67.5); // Araxxor
  assert.equal(bonus(15742), 145); // Maggot King
  assert.equal(bonus(9035), 45); // Corrupted Hunllef
  assert.equal(bonus(14707), 62.5); // Doom of Mokhaiotl
  assert.equal(bonus(12821), 85); // Sol Heredit
  assert.equal(bonus(14176), 82.5); // Yama
  assert.equal(bonus(7706), 57.5); // TzKal-Zuk
  assert.equal(bonus(12214), 97.5); // The Leviathan, post-quest (awakened 187.5)
  assert.equal(bonus(12223), 55); // Vardorvis, post-quest (awakened 95)
  assert.equal(bonus(12191), 52.5); // Duke Sucellus
  assert.equal(bonus(11730), 62.5); // Zebak
  assert.equal(bonus(9416), 0); // Phosani's Nightmare
});

test("a hit on the Alchemical Hydra gives 20% more experience, and its XP drop shows the hit", async () => {
  close(await hitpointsXpPerDamage("alchemical-hydra/kill"), (4 / 3) * 1.2);
});

test("the encounter's combatXpBonusOverrides replace the table's bonus", async () => {
  const hydraIds = [8615, 8616, 8617, 8618, 8619, 8620, 8621, 8622];
  const overrides = Object.fromEntries(hydraIds.map((id) => [id, 0]));
  close(await hitpointsXpPerDamage("alchemical-hydra/kill", { overrides }), 4 / 3);
});

test("a monster without a bonus gives the normal experience", async () => {
  close(await hitpointsXpPerDamage("phosanis-nightmare/kill"), 4 / 3);
});

test("the awakened Vardorvis gives his awakened bonus, 95%, though his NPC id is the post-quest one's", async () => {
  close(await hitpointsXpPerDamage("vardorvis/awakened-fight"), (4 / 3) * 1.95);
  close(await hitpointsXpPerDamage("vardorvis/kill"), (4 / 3) * 1.55);
});
