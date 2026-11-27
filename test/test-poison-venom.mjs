// The player's poison and venom (client/engine/SimulationEngine.js, consumables.js) as the game has them, run on
// the determinism harness with Yama as a dummy that does nothing.
// OBS (Araxxor, 20 recorded kills): the poison value counts up from an anti-venom's -59 by one a pulse; at -38
// "Your venom resistance has worn off, but you are still resistant to poison", and an attack envenomed the player
// (6 kills of 6); the first venom hit then came on the immunity's own 30-tick beat. WIKI (Venom): an antipoison turns
// venom into poison of the venom's damage, a second dose cures it; an anti-venom cures it.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runScenario } from "../tools/determinism/harness.mjs";
import { meleeGear, use } from "../tools/determinism/scenarios/common.mjs";

const dummy = { yamaMageRange: false, yamaMelee: false, waves: false, fireballs: false, voidFlares: false };
const VENOM = 1_000_000;
const potion = { antidotePlusPlus: 5952, sanfew: 10925, antiVenom: 12905, antiVenomPlus: 12913, extendedAntiVenomPlus: 29824 };

// Runs `ticks` ticks. `before(tick, api)` acts before a tick; `after(tick, engine)` after it, where it may poison
// or envenom the player as an attack would. Returns each tick's poison value (before and after `after`) and the
// hitsplats on the player.
async function run({ ticks, inventory = [], prepot = true, before, after }) {
  const log = [];
  await runScenario(
    {
      name: "poison-venom", kind: "yama_p3", seed: 1, ticks, mechanics: { ...dummy, autoPrepot: prepot }, ...meleeGear, inventory,
      script: (tick, api) => before?.(tick, api),
    },
    {
      onTick(tick, engine) {
        const varp = () => engine.player().poisonState.poisonVarp;
        const hitsplats = engine.getLastTickEvents()
          .filter((event) => event.type === "hitsplat_spawned" && event.targetId === "player")
          .map(({ amount, hitsplatType }) => [amount, hitsplatType]);
        const was = varp();
        after?.(tick, engine);
        log[tick] = { was, varp: varp(), hitsplats };
      },
    },
  );
  return log;
}
const firstTick = (log, test) => log.findIndex((entry) => entry && test(entry));

{
  // An antidote++ (-40) keeps venom off for two pulses, then a venomous hit takes; poison never takes on a player
  // who is immune, nor in the place of venom.
  const log = await run({
    ticks: 100, inventory: [potion.antidotePlusPlus],
    after(tick, engine) {
      engine.applyPoisonToPlayer(40);
      engine.applyPoisonToPlayer(VENOM);
    },
  });
  assert.equal(log[0].varp, -40, "the pre-pot's antidote++");
  const envenomed = firstTick(log, (entry) => entry.varp >= VENOM);
  assert.ok(envenomed > 0, "venom takes once the antidote++'s venom immunity is over");
  assert.equal(log[envenomed].was, -38, "it takes at -38, not below");
  assert.ok(log.slice(0, envenomed).every((entry) => entry.varp < 0), "nothing takes before: neither poison nor venom");
  assert.ok(log.slice(envenomed).every((entry) => entry.varp >= VENOM), "poison does not take the place of venom");
  // The pulses go on at the immunity's beat: the first venom hit comes 30 ticks after the pulse that made it -38.
  const firstHit = firstTick(log, (entry) => entry.hitsplats.length > 0);
  assert.deepEqual(log[firstHit].hitsplats, [[6, "venom"]]);
  assert.equal(firstHit - envenomed, 30);
}
{
  // A player immune to poison (a sanfew's -20) is envenomed, and the first venom hit comes on the immunity's
  // beat (20 ticks later here), not 30 ticks after.
  const log = await run({
    ticks: 70, inventory: [potion.sanfew],
    after(tick, engine) {
      if (tick === 10) engine.applyPoisonToPlayer(VENOM);
    },
  });
  assert.equal(log[9].varp, -20, "the pre-pot's sanfew serum");
  assert.equal(log[10].varp, VENOM);
  assert.deepEqual(log.flatMap((entry, tick) => entry.hitsplats.map((hit) => [tick, ...hit])), [[30, 6, "venom"], [60, 8, "venom"]]);
}
{
  // An antidote++ drunk while envenomed turns the venom into poison of the venom's next damage (10 after 6 and 8):
  // no immunity, and the next hit is a poison hit of 10. A second dose cures it.
  const log = await run({
    ticks: 130, inventory: [potion.antidotePlusPlus], prepot: false,
    before(tick, api) {
      if (tick === 62 || tick === 100) use(api, 0);
    },
    after(tick, engine) {
      if (tick === 1) engine.applyPoisonToPlayer(VENOM);
    },
  });
  const hits = log.flatMap((entry, tick) => entry.hitsplats.map((hit) => [tick, ...hit]));
  assert.deepEqual(hits.slice(0, 2).map(([, ...hit]) => hit), [[6, "venom"], [8, "venom"]]);
  const drunk = firstTick(log, (entry) => entry.varp > 0 && entry.varp < VENOM);
  assert.ok(drunk >= 62 && drunk < 66, "the first dose");
  assert.equal(log[drunk].varp, 50, "poison that hits for 10 (ceil(50 / 5))");
  assert.deepEqual(hits[2].slice(1), [10, "poison"]);
  const cured = firstTick(log, (entry) => entry.varp < 0);
  assert.ok(cured >= 100 && cured < 104, "the second dose");
  assert.equal(log[cured].varp, -40);
}
{
  // Each anti-venom cures venom outright and keeps it off while its value is below -38: an anti-venom+ (-50) for
  // 12 pulses. An anti-venom is -41, an extended anti-venom+ -59 (OBS).
  const log = await run({
    ticks: 420, inventory: [potion.antiVenomPlus], prepot: false,
    before(tick, api) {
      if (tick === 5) use(api, 0);
    },
    after(tick, engine) {
      if (tick === 1 || tick > 10) engine.applyPoisonToPlayer(VENOM);
    },
  });
  const cured = firstTick(log, (entry) => entry.varp < 0);
  assert.ok(cured > 0, "the anti-venom+ cures venom");
  assert.equal(log[cured].varp, -50);
  const again = firstTick(log, (entry) => entry.was < 0 && entry.varp >= VENOM);
  assert.equal(log[again].was, -38, "venom takes again at -38");
  assert.deepEqual([...new Set(log.slice(cured, again + 1).map((entry) => entry.was))], [-50, -49, -48, -47, -46, -45, -44, -43, -42, -41, -40, -39, -38]);
  for (const [id, value] of [[potion.antiVenom, -41], [potion.extendedAntiVenomPlus, -59]]) {
    const drink = await run({ ticks: 8, inventory: [id], prepot: false, before: (tick, api) => tick === 5 && use(api, 0), after: (tick, engine) => tick === 1 && engine.applyPoisonToPlayer(VENOM) });
    assert.equal(drink.at(-1).varp, value, "item " + id);
  }
}
{
  // The game's own venom and disease hitsplats (CACHE: hitsplat 5 draws sprite 1632, hitsplat 4 sprite 1633), not
  // the poison one darkened.
  const manifest = readFileSync("tools/assets/manifest.json", "utf8");
  assert.match(manifest, /"path":"assets\/ui\/hitsplat-venom.png","pixels":"[0-9a-f]{64}","source":"sprite:8\/1632\/0"/);
  assert.match(manifest, /"path":"assets\/ui\/hitsplat-disease.png","pixels":"[0-9a-f]{64}","source":"sprite:8\/1633\/0"/);
  const rendering = readFileSync("client/assets/rendering.js", "utf8");
  assert.match(rendering, /venom: "\/assets\/ui\/hitsplat-venom.png"/);
  assert.match(rendering, /disease: "\/assets\/ui\/hitsplat-disease.png"/);
  assert.match(rendering, /disease: "disease"/, "a disease hitsplat is not drawn as damage");
  assert.doesNotMatch(rendering, /n\.type === "venom" \? "brightness/);
}
console.log("Poison, venom and their cures are as the game has them");
