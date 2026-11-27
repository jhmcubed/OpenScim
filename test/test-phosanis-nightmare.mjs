// Phosani's Nightmare loads on its route and is drawn from the trimmed cache
// (the dream's map square on plane 3, each of her forms, the totems); her
// spores and flowers are drawn as the map objects they are; a new form is
// drawn as its own NPC type; she dies into the victory screen. The mechanics
// themselves are digested by the determinism harness
// (tools/determinism/scenarios/phosanis-nightmare.mjs) and asserted by
// test/test-phosanis-nightmare-rules.mjs.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { browserOptions } from "../tools/browser.mjs";

const origin = process.env.TEST_ORIGIN;
const browser = await chromium.launch(browserOptions);

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack));
  // A model, an animation or a map square missing from the trimmed cache is logged, not thrown.
  page.on("console", (message) => message.text().includes("Empty container") && errors.push(message.text()));
  for (const [path, marker, probe] of [
    ["**/engine/SimulationEngine.js*", "this.encounter = options.encounter;", "if (options.encounter.kind === 'phosanis_nightmare') window.engine = this;"],
    ["**/encounters/shared/buildScene.js*", "const scene = new Scene();", "window.scene = scene;"],
  ]) {
    await page.route(path, async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      assert.ok(body.includes(marker));
      await route.fulfill({ response, body: body.replace(marker, marker + probe) });
    });
  }

  await page.goto(origin + "/phosanis-nightmare/");
  await page.waitForFunction(() => window.engine && window.scene, null, { timeout: 60000 });
  await page.locator(".loading-screen").waitFor({ state: "hidden", timeout: 60000 });
  assert.equal(new URL(page.url()).pathname, "/phosanis-nightmare/");

  // The player starts in the first of her setups (loadouts.js, the wiki's strategies page): Inquisitor's mace and
  // armour, Tumeken's shadow for the totems, a full inventory.
  const setup = await page.evaluate(() => {
    const { equipment, inventory, position } = engine.player();
    return { weapon: equipment.weapon, head: equipment.head, items: inventory.filter(Boolean).length, shadow: inventory[0]?.id, position };
  });
  assert.deepEqual(setup, { weapon: 24417, head: 24419, items: 28, shadow: 27275, position: [33, 28] });

  // Every form she takes and the totems are loaded; she stands on plane 3, 1,240 over plane 0.
  const types = [9416, 9417, 9418, 11153, 9419, 9420, 9421, 11155, 9422, 11154, 9434, 9435, 9436];
  await page.waitForFunction((types) => types.every((id) => scene.isNpcTypeLoaded(id)), types, { timeout: 60000 });
  assert.equal(await page.evaluate(() => scene.terrainHeights[32][31]), -1240);

  // Her spores and flowers: drawn as their map objects, on their tiles, from the encounter's snapshot.
  const drawn = await page.evaluate(() => {
    engine.setMechanicsConfig({ ...engine.mechanicsConfig, infiniteHealth: true });
    const encounter = engine.encounter;
    const context = () => ({ tick: engine.worldState.tick, world: engine.worldState, tickEvents: engine.tickEvents });
    const advance = (n) => { for (let i = 0; i < n; i++) engine.advanceTick(engine.player().position); };
    const draw = () => scene.sceneObjectController.update({ state: { encounter: engine.getEncounterSnapshot(), tick: engine.worldState.tick }, interpolatedTick: engine.worldState.tick })
      .map(({ data }) => [data.locId, data.localX, data.localY]);
    encounter.untilSpecial = 1000; // no special of her own meanwhile
    encounter.specials.startSpores(context());
    advance(6);
    // Armed: each spore drawn on its tile (one set off by the player is drawn bursting for 2 ticks).
    const armed = draw().filter(([locId]) => locId === 37739).map(([, x, y]) => x + "," + y);
    const tiles = encounter.getSnapshot().state.spores?.tiles ?? [];
    const spores = tiles.filter(([x, y]) => armed.includes(x + "," + y)).length;
    const sporeTiles = tiles.length;
    encounter.specials.interrupt();
    encounter.specials.startFlowers(context());
    advance(15);
    const flowers = draw().filter(([locId]) => locId >= 37740 && locId <= 37745);
    return { spores, sporeTiles, flowers: flowers.length, open: flowers.every(([locId]) => locId === 37742 || locId === 37745) };
  });
  assert.ok(drawn.sporeTiles >= 10 && drawn.spores === drawn.sporeTiles, JSON.stringify(drawn));
  assert.ok(drawn.flowers > 30 && drawn.open, JSON.stringify(drawn));

  // Her second form (the boss hitpoints preset): drawn as its own type once the scene has caught up.
  const second = await page.evaluate(() => {
    engine.applyBossHpPreset(2134);
    engine.advanceTick(engine.player().position);
    return engine.worldState.getNpc("phosanis-nightmare").npcTypeId;
  });
  assert.equal(second, (await page.evaluate(() => engine.getEncounterSnapshot().state.forms))[1]);
  await page.waitForFunction(
    (type) => [...scene.npcInstanceManager.instanceRegistry.values()].some((instance) => instance.npcTypeId === type),
    second,
    { timeout: 30000 },
  );

  // Her shield up, the boss bar at the top shows it out of 400 in the shield's blue (the Outside recording), not her
  // hitpoints; in her desperation, her hitpoints again.
  const bossBar = () => page.evaluate(() => {
    const values = document.querySelector(".boss-hp__values")?.textContent.replace(/\s/g, "");
    return { values, shield: !!document.querySelector(".boss-hp__fill--shield") };
  });
  await page.evaluate(() => {
    engine.encounter.shield = 362;
    engine.advanceTick(engine.player().position);
  });
  await page.waitForFunction(() => document.querySelector(".boss-hp__values")?.textContent.replace(/\s/g, "") === "362/400", null, { timeout: 15000 });
  assert.deepEqual(await bossBar(), { values: "362/400", shield: true });

  // Drawn a frame at a time as the application's loop plays them: her surge slides her along the lane (no jump to its
  // end) with her surge animation; a run of her claws holds its run animation (9103) from its second set to its end,
  // never standing up between sets (the Outside recordings).
  const watch = (start, ticks) => page.evaluate(async ({ start, ticks }) => {
    const encounter = engine.encounter;
    const context = () => ({ tick: engine.worldState.tick, world: engine.worldState, tickEvents: engine.tickEvents });
    encounter.untilSpecial = 1000; // no special of her own meanwhile
    encounter.nextAttackAt = engine.worldState.tick + 1000;
    encounter.specials.interrupt();
    encounter.specials[start](context());
    const until = engine.worldState.tick + ticks;
    const frames = [];
    await new Promise((done) => {
      const sample = () => {
        const instance = scene.npcInstanceManager.instanceRegistry.get(scene.getNpcRenderInstanceId("phosanis-nightmare"));
        frames.push({ tick: engine.worldState.tick, at: instance?.lastRenderPosition && [...instance.lastRenderPosition], seq: instance?.animController?.Fw()?.seqId });
        if (engine.worldState.tick >= until) done();
        else requestAnimationFrame(sample);
      };
      sample();
    });
    return { frames, surge: encounter.getSnapshot().state.surge };
  }, { start, ticks });
  const surge = await watch("startSurge", 10);
  const xs = surge.frames.filter((frame) => frame.seq === 8597).map((frame) => frame.at);
  assert.ok(xs.length > 3, JSON.stringify(surge.frames.map((frame) => frame.seq)));
  const between = xs.filter(([x, y], n) => n > 0 && (x !== xs[0][0] || y !== xs[0][1]) && (x !== xs.at(-1)[0] || y !== xs.at(-1)[1]));
  assert.ok(between.length > 0, "slid: " + JSON.stringify(xs));
  const run = await watch("startSpores", 6 + 5 * 6 + 2);
  const seqs = run.frames.map((frame) => frame.seq);
  const from = seqs.indexOf(9103);
  const to = seqs.indexOf(9104);
  assert.ok(from > 0 && to > from, JSON.stringify([...new Set(seqs)]));
  assert.ok(seqs.slice(from, to).every((seq) => seq === 9103), "held: " + JSON.stringify([...new Set(seqs.slice(from, to))]));

  // Cursed, the icon over the player is that of the style his protection stops now (the Outside recordings): Protect
  // from Magic shows the missiles icon; the curse gone, the magic one again.
  const overhead = (name) => page.waitForFunction((name) => [...document.querySelectorAll("img")].some((img) => img.getAttribute("src")?.endsWith("/overhead_" + name + ".png")), name, { timeout: 15000 });
  await page.evaluate(() => {
    engine.encounter.specials.curse = { turns: 5, endsAt: null, since: engine.worldState.tick };
    engine.player().activePrayer = "ProtectMagic";
  });
  await overhead("missiles");
  // As the curse lands, a pink glow over the scene (the wiki; a player's video): hot pink, fading in, gone 2 ticks on
  // though the curse goes on. With the practice aid Curse Prayer Markers, each protection prayer outlined in the colour
  // of what it stops now: Protect from Magic green (ranged), Protect from Missiles red (melee), Protect from Melee blue
  // (magic).
  await page.getByRole("button", { name: "Prayer (F5)" }).click();
  await page.locator(".encounter-screen-tint").waitFor({ state: "attached", timeout: 15000 });
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".encounter-screen-tint")).backgroundColor), "rgba(243, 0, 98, 0.53)");
  // On request, a picture of the glow at its strongest: the last taken while it is still there.
  while (process.env.PHOSANI_CURSE_SHOT) {
    const shot = await page.screenshot();
    if (!(await page.locator(".encounter-screen-tint").count())) break;
    (await import("node:fs")).writeFileSync(process.env.PHOSANI_CURSE_SHOT, shot);
  }
  await page.locator(".encounter-screen-tint").waitFor({ state: "detached", timeout: 15000 });
  assert.ok(await page.evaluate(() => engine.encounter.specials.curse !== null), "still cursed");
  assert.equal(await page.locator(".prayer-marker").count(), 0, "markers only with the aid");
  await page.evaluate(() => engine.setMechanicsConfig({ ...engine.mechanicsConfig, phosaniCurseMarkers: true }));
  await page.waitForFunction(() => document.querySelectorAll(".prayer-marker").length === 3, null, { timeout: 15000 });
  const markers = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll(".prayer-marker")].map((marker) => [marker.dataset.prayer, getComputedStyle(marker).borderTopColor])));
  assert.deepEqual(markers, { ProtectMagic: "rgb(32, 224, 32)", ProtectRange: "rgb(255, 48, 48)", ProtectMelee: "rgb(47, 143, 255)" });
  await page.evaluate(() => {
    engine.encounter.specials.curse = null;
    engine.player().activePrayer = "ProtectMagic";
  });
  await overhead("magic");
  await page.waitForFunction(() => !document.querySelector(".prayer-marker"), null, { timeout: 15000 });

  // Her desperation, then her death; the application's own loop plays it and ends the fight.
  await page.evaluate(() => {
    engine.applyBossHpPreset(150);
    engine.advanceTick(engine.player().position);
  });
  assert.equal(await page.evaluate(() => engine.worldState.getNpc("phosanis-nightmare").npcTypeId), 11154);
  await page.waitForFunction(() => document.querySelector(".boss-hp__values")?.textContent.replace(/\s/g, "") === "150/3200", null, { timeout: 15000 });
  assert.equal((await bossBar()).shield, false);
  await page.evaluate(() => engine.setBossHp(0));
  await page.waitForFunction(() => engine.getEncounterOutcome().phase === "victory" && document.body.innerText.includes("PHOSANI'S NIGHTMARE DEFEATED"), null, { timeout: 120000 });
  assert.deepEqual(errors, []);
  console.log("Phosani's Nightmare: route, drawing and victory");
} finally {
  await browser.close();
}
