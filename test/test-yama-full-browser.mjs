// Yama's whole fight on its route (/yama-full/): Yama's own scene draws the
// throne, and "Challenge" in his right-click menu reaches the encounter
// (Grid.js: acceptsInput, then the "npc-option" event, queued as an
// encounter command). Then the fight, ticked
// here: the glyphs light, he attacks every 8 ticks, and at two thirds of his
// hitpoints the player stands before the Judge. No model, sequence or spot
// animation of the earlier phases is missing from the trimmed cache.
// YAMA_FULL_SHOTS=<directory> keeps a screenshot of each stage.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const origin = process.env.TEST_ORIGIN;
const shots = process.env.YAMA_FULL_SHOTS;
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--enable-unsafe-swiftshader"],
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack ?? String(error)));
  page.on("console", (message) => {
    if (message.type() === "error" && /Empty container|No scene builder/.test(message.text())) errors.push(message.text());
  });
  await page.route("**/engine/SimulationEngine.js*", async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const marker = "this.encounter = options.encounter;";
    assert.ok(body.includes(marker));
    await route.fulfill({ response, body: body.replace(marker, marker + "if (options.encounter.kind === 'yama_full') window.engine = this;") });
  });
  await page.goto(origin + "/yama-full/");
  await page.waitForFunction(() => window.engine, null, { timeout: 60000 });
  await page.locator(".loading-screen").waitFor({ state: "hidden", timeout: 60000 });
  assert.equal(new URL(page.url()).pathname, "/yama-full/");
  const shot = async (name) => {
    if (!shots) return;
    await page.waitForTimeout(1500); // the application's own loop draws what was ticked
    await page.screenshot({ path: `${shots}/${name}.png` });
  };
  const state = () => page.evaluate(() => {
    const snapshot = engine.getEncounterSnapshot().state;
    return { phase: snapshot.phase, lit: snapshot.glyphs.filter((glyph) => glyph.state === "lit").length, npcs: [...engine.worldState.actors.keys()], player: [...engine.worldState.actors.get("player").position] };
  });

  // Ticks the fight; without a clicked tile the player stays where he is.
  await page.evaluate(() => {
    window.run = (ticks, tile) => { for (let tick = 0; tick < ticks; tick++) engine.advanceTick(tile ?? [...engine.worldState.actors.get("player").position]); };
  });
  // On his throne: nobody to fight, and only "Challenge" on him is the encounter's.
  await page.evaluate(() => run(5));
  assert.deepEqual(await state(), { phase: "throne", lit: 0, npcs: ["player", "yama-throne"], player: [32, 37] });
  assert.deepEqual(await page.evaluate(() => ["Challenge", "Talk-to"].map((option) => engine.acceptsInput({ kind: "npcOption", actorId: "yama-throne", option }))), [true, false]);
  await shot("1-throne");

  // The challenge: a right click on him (the default camera has him here), and the entry of the menu. Grid.js gives
  // the entry a click because the encounter accepts the option, and sends it as a command.
  await page.mouse.click(690, 610, { button: "right" });
  const entry = await page.getByText("Challenge", { exact: true }).boundingBox();
  await page.mouse.click(entry.x + entry.width / 2, entry.y + entry.height / 2);
  await page.waitForFunction(() => engine.getEncounterSnapshot().state.phase !== "throne", null, { timeout: 10000 });
  await page.evaluate(() => {
    engine.setMechanicsConfig({ ...engine.mechanicsConfig, infiniteHealth: true });
    for (let tick = 0; tick < 20 && engine.getEncounterSnapshot().state.glyphs.some((glyph) => glyph.state !== "lit"); tick++) run(1);
  });
  // He ran up to the throne first, as far as the arena goes.
  assert.deepEqual(await state(), { phase: "p1", lit: 5, npcs: ["player", "yama-throne", "yama"], player: [31, 40] });
  await shot("2-phase-1");

  // Phase 1 to its end: his first special (slot 2), then two thirds of his hitpoints and the teleport.
  await page.evaluate(() => run(12));
  await shot("3-special");
  await page.evaluate(() => {
    engine.injectAction({ type: "setBossHp", hp: 1600 });
    for (let tick = 0; tick < 40 && engine.getEncounterSnapshot().state.phase !== "judge1"; tick++) run(1);
    run(3);
  });
  const atJudge = await state();
  assert.equal(atJudge.phase, "judge1");
  assert.deepEqual(atJudge.player, [7, 29]);
  assert.ok(atJudge.npcs.includes("yama-judge") && atJudge.npcs.some((id) => id.startsWith("yama-fire-spell-")), atJudge.npcs.join(" "));
  await shot("4-judge");
  // Across the stones by a click on each (a click on the lava or the platform from the stones does nothing).
  await page.evaluate(() => {
    run(1, [7, 48]);
    for (const stone of [[7, 31], [6, 34], [7, 37], [7, 40], [6, 43], [7, 46]]) run(1, stone);
  });
  assert.ok((await state()).player[1] >= 46, "the player crossed the stones");
  await shot("5-platform");
  assert.deepEqual(errors, []);
  console.log("yama full fight on its route: ok");
} finally {
  await browser.close();
}
