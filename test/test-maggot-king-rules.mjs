// The Maggot King's poison and disease on the player (client/encounters/maggot-king/), run on the determinism
// harness: a player who stands still in the middle of the floor, unprayed, with infinite health, so that every
// spit hits him and its bile lands under him.
// OBS 15 kills: sticky bile is the game's disease hitsplat (hitsplat 4, 20 of 20) of 2 to 4, that much off
// hitpoints and off Attack, Strength or Defence, once; poisonous bile is the poison hitsplat.
import assert from "node:assert/strict";
import { runScenario } from "../tools/determinism/harness.mjs";
import { rangedGear } from "../tools/determinism/scenarios/common.mjs";

const ticks = [];
await runScenario(
  { name: "maggot-king/standing-still", kind: "maggot_king", seed: 3, ticks: 120, mechanics: { infiniteHealth: true }, start: [31, 35], ...rangedGear },
  {
    onTick(tick, engine) {
      const player = engine.player();
      ticks[tick] = {
        varp: player.poisonState.poisonVarp,
        drainable: ["attack", "strength", "defence"].reduce((sum, stat) => sum + player.stats[stat].current, 0),
        hits: engine.damageHistory.filter((hit) => hit.tick === tick && hit.targetId === "player").map(({ source, attackType, effectiveDamage }) => ({ source, attackType, effectiveDamage })),
        hitsplats: engine.getLastTickEvents().filter((event) => event.type === "hitsplat_spawned" && event.targetId === "player").map(({ amount, hitsplatType }) => [amount, hitsplatType]),
      };
    },
  },
);

{
  // Sticky bile: a disease hitsplat of what it takes, the same off one of the three stats.
  const sticky = ticks.flatMap((tick, n) => (tick?.hits.some((hit) => hit.source === "Sticky bile") ? [n] : []));
  assert.ok(sticky.length >= 3, "the player stands in sticky bile");
  for (const n of sticky) {
    const { effectiveDamage } = ticks[n].hits.find((hit) => hit.source === "Sticky bile");
    assert.ok(effectiveDamage >= 2 && effectiveDamage <= 4);
    assert.deepEqual(ticks[n].hitsplats, [[effectiveDamage, "disease"]], "tick " + n);
    assert.equal(ticks[n - 1].drainable - ticks[n].drainable, effectiveDamage, "tick " + n);
  }
}
{
  // Poisonous bile: the poison hitsplat as he steps in (OBS), and poison that then hits for 8 (40 on the engine's
  // scale, WIKI).
  const contact = ticks.find((tick) => tick?.hits.some((hit) => hit.source === "Poisonous bile"));
  assert.deepEqual(contact.hitsplats.map(([, type]) => type), ["poison"]);
  assert.equal(contact.varp, 40);
  const pulse = ticks.find((tick) => tick?.hits.some((hit) => hit.source === "Poison"));
  assert.deepEqual(pulse.hitsplats, [[8, "poison"]]);
}
console.log("The Maggot King's poison and disease are as recorded");
