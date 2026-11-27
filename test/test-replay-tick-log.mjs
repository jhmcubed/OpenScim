// The replay's tick log (client/replay/tickLog.js, tickLogPanel.js) and the
// strip over its slider (traceStrip.js). First what they say, without a
// page: on frames made up here, then on two scripted fights of each file of
// the determinism harness, where every hitsplat, monster attack on the player
// and death has its line on its tick. Then in the application, on the Fortis
// Colosseum: the log opens with the replay, a click on a tick moves the
// playhead there and leaves the replay's keys working, it follows the
// playhead as the replay plays, hides the kinds one hides and closes to its
// title, and goes with the replay; the strip draws the fight where the slider
// has each tick, says over a tick what happened on it, and a click or a drag
// on it moves the playhead.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { cacheZip, loadEnvironment, loadScenarios, runScenario, scenarioFiles } from "../tools/determinism/harness.mjs";

// The client's modules load as the harness loads them (web-root imports, stylesheets); it needs the game cache.
if (!existsSync(cacheZip)) {
  console.log(`${cacheZip} is missing (npm run assets): skipped`);
  process.exit(0);
}
await loadEnvironment();
const { describeFrame, createNames, createTickLog, rowAtFrame, sentence, tickLogKinds, tickLogText, prayerName } = await import("../client/replay/tickLog.js");
const { traceOf, frameX, frameAtX, columnsOf, pointNear } = await import("../client/replay/traceStrip.js");

// --- one tick, made up --------------------------------------------------------
const items = { 26374: "Zaryte crossbow", 22322: "Avernic defender", 3024: "Super restore(4)", 13441: "Anglerfish" };
const names = () => createNames((id) => items[id] ?? null);
const npc = (id, npcTypeId, archetypeId) => ({ id, npcTypeId, archetypeId, hp: 100 });
const state = (extra = {}) => ({
  currentTick: 10,
  isAlive: true,
  encounterOutcome: { phase: "active" },
  npcs: [npc("araxxor", 13668, "araxxor"), npc("araxxor-egg-0", 13674, "araxxor-egg")],
  prayerState: { activePrayers: [] },
  playerEquipment: { weapon: 4151, shield: 22322 },
  inventory: [{ id: 3024 }, { id: 13441 }, null],
  ...extra,
});
const before = { state: state({ currentTick: 9 }), events: [], actions: [] };
const tick = (events, extra = {}, actions = []) => describeFrame({ state: state(extra), events, actions }, before, names());
const said = (entries) => entries.map(sentence);

// Hits: the monster's name from its type, else its id; the player's with whether the prayer was right.
assert.deepEqual(
  said(
    tick([
      { type: "hit_applied", targetId: "araxxor", damage: 24, prayedCorrectly: null },
      { type: "hitsplat_spawned", targetId: "araxxor", amount: 24, hitsplatType: "damage" },
      { type: "hitsplat_spawned", targetId: "araxxor-egg-0", amount: 0, hitsplatType: "block" },
      { type: "hit_applied", targetId: "player", damage: 0, prayedCorrectly: true },
      { type: "hitsplat_spawned", targetId: "player", amount: 0, hitsplatType: "block" },
      { type: "hit_applied", targetId: "player", damage: 31, prayedCorrectly: false },
      { type: "hitsplat_spawned", targetId: "player", amount: 31, hitsplatType: "damage" },
      { type: "hitsplat_spawned", targetId: "player", amount: 6, hitsplatType: "venom" },
      { type: "hitsplat_spawned", targetId: "araxxor", amount: 12, hitsplatType: "heal" },
    ]),
  ),
  ["You took 0 (prayed right)", "You took 31 (wrong prayer)", "You took 6 (venom)", "Araxxor took 24", "Araxxor egg took 0", "Araxxor healed 12"],
);
const [prayedRight, wrongPrayer] = tick([
  { type: "hit_applied", targetId: "player", prayedCorrectly: true },
  { type: "hitsplat_spawned", targetId: "player", amount: 0, hitsplatType: "block" },
  { type: "hit_applied", targetId: "player", prayedCorrectly: false },
  { type: "hitsplat_spawned", targetId: "player", amount: 9, hitsplatType: "damage" },
]);
assert.deepEqual([prayedRight.tone, wrongPrayer.tone], ["good", "bad"]);
assert.deepEqual([prayedRight.text, prayedRight.amount, prayedRight.splat], ["on you", 0, "block"]);

// The monsters' attacks on the player, by the last word of their name; any but melee, magic and ranged is a special,
// unless it is the monster's only attack, named after it.
const attacks = describeFrame(
  {
    state: state({ npcs: [npc("araxxor", 13668, "araxxor"), npc("araxyte-2", 13675, "araxyte-mirrorback")] }),
    events: [
      { type: "zuk_attack", attack: "araxxor_melee", sourceId: "araxxor", targetId: "player" },
      { type: "zuk_attack", attack: "araxxor_drip", sourceId: "araxxor", targetId: "player" },
      { type: "zuk_attack", attack: "alchemical_hydra_range", sourceId: "araxxor", targetId: "player" },
      { type: "zuk_attack", attack: "araxyte_acidic", sourceId: "araxyte-2", targetId: "player" },
      { type: "zuk_attack", attack: "nibbler_melee", sourceId: "araxxor", targetId: "inferno_pillar_west" },
    ],
    actions: [],
  },
  before,
  names(),
);
assert.deepEqual(said(attacks), ["Araxxor: melee", "Araxxor: drip (special)", "Araxxor: ranged", "Acidic Araxyte attacks"]);
assert.deepEqual(attacks.map(({ special }) => special === true), [false, true, false, false]);

// XP drops, the player's special attacks (not the others), deaths, the end of the fight, messages.
assert.deepEqual(
  said(
    tick(
      [
        { type: "xp_drop", skills: [{ skill: "ranged", amount: 80 }, { skill: "hitpoints", amount: 26 }] },
        { type: "attack_started", sourceId: "player", targetId: "araxxor", usingSpecialAttack: true, weaponId: 26374 },
        { type: "attack_started", sourceId: "player", targetId: "araxxor", usingSpecialAttack: false, weaponId: 26374 },
        { type: "actor_died", actorId: "araxxor-egg-0" },
        { type: "actor_died", actorId: "player" },
        { type: "game_message", segments: [{ text: "Araxxor covers you " }, { text: "in venom." }] },
      ],
      { isAlive: false, encounterOutcome: { phase: "victory" } },
    ),
  ),
  ["Fight won", "Araxxor egg died", "You died", "Zaryte crossbow at Araxxor", "+106 xp (Ranged 80, Hitpoints 26)", "Araxxor covers you in venom."],
);

// Prayers, gear and supplies, from the state and the actions; the first frame has nothing to compare with.
assert.deepEqual(
  said(
    tick(
      [],
      { prayerState: { activePrayers: ["ProtectMagic", "Rigour"] }, playerEquipment: { weapon: 26374, shield: null } },
      [
        { type: "itemAction", inventoryIndex: 0, option: "default" },
        { type: "itemAction", inventoryIndex: 1, option: "default" },
        { type: "itemAction", inventoryIndex: 2, option: "default" },
      ],
    ),
  ),
  ["Protect from Magic, Rigour on", "Put on Zaryte crossbow; took off Avernic defender", "Drank Super restore(4)", "Ate Anglerfish"],
);
assert.deepEqual(said(describeFrame({ state: state({ currentTick: 10, prayerState: { activePrayers: [] } }), events: [], actions: [] }, { state: state({ prayerState: { activePrayers: ["ProtectMelee"] } }) }, names())), ["Protect from Melee off"]);
assert.deepEqual(describeFrame({ state: state(), events: [], actions: [] }, null, names()), []);
assert.equal(prayerName("EagleEye"), "Eagle Eye");
assert.equal(prayerName("Piety"), "Piety");

// The same line twice is one, counted; a tick lists its lines kind by kind, in the order of tickLogKinds.
const repeated = tick([
  { type: "xp_drop", skills: [{ skill: "magic", amount: 10 }] },
  { type: "hitsplat_spawned", targetId: "araxxor", amount: 3, hitsplatType: "damage" },
  { type: "hitsplat_spawned", targetId: "araxxor", amount: 3, hitsplatType: "damage" },
  { type: "zuk_attack", attack: "araxxor_melee", sourceId: "araxxor", targetId: "player" },
]);
assert.deepEqual(said(repeated), ["Araxxor: melee", "Araxxor took 3 x2", "+10 xp (Magic 10)"]);
const order = tickLogKinds.map(({ key }) => key);
assert.deepEqual(repeated.map(({ kind }) => order.indexOf(kind)), [...repeated.map(({ kind }) => order.indexOf(kind))].sort((a, b) => a - b));

// A monster keeps its name after it leaves the state.
const gone = createNames();
assert.equal(gone.actor("araxxor", { state: state() }), "Araxxor");
assert.equal(gone.actor("araxxor", { state: { npcs: [] } }), "Araxxor");
assert.equal(gone.actor("zuk_ranger_1", { state: { npcs: [] } }), "Zuk ranger");

// --- a recording, made up ---------------------------------------------------
const hit = (amount) => ({ type: "hitsplat_spawned", targetId: "araxxor", amount, hitsplatType: "damage" });
const frames = [[], [hit(5)], [], [], [hit(7)], [], [hit(9)]].map((events, index) => ({ state: state({ currentTick: 100 + index }), events, actions: [] }));
const log = createTickLog();
const rows = log.rows(frames, [{ frameIndex: 3, label: "wave 2" }, { frameIndex: 4, label: null }]);
assert.deepEqual(rows.map(({ frameIndex, tick }) => [frameIndex, tick]), [[1, 101], [3, 103], [4, 104], [6, 106]], "only the ticks something happened on");
assert.deepEqual(said(rows[2].entries), ["Your marker", "Araxxor took 7"], "a marker first");
assert.ok(rows[2].entries[0].own);
assert.equal(log.rows(frames)[0].entries, log.rows(frames)[0].entries, "a frame is described once");
assert.equal(tickLogText(rows, (kind) => kind !== "marker"), "tick 101: Araxxor took 5\ntick 104: Araxxor took 7\ntick 106: Araxxor took 9");
// The row of the playhead: the one it is on, or the last it passed.
assert.deepEqual([0, 1, 2, 3, 5, 6, 9].map((frameIndex) => rowAtFrame(rows, frameIndex)), [-1, 0, 0, 1, 2, 3, 3]);
assert.equal(rowAtFrame([], 4), -1);

// --- the strip over the slider, made up ----------------------------------------
// A tick's hits added up (twice the same hit is twice its damage), healing left out; flags for the rest.
const traced = traceOf([
  { frameIndex: 1, tick: 11, entries: [{ kind: "hit", amount: 3, splat: "damage", count: 2 }, { kind: "hit", amount: 9, splat: "heal" }, { kind: "taken", amount: 7, splat: "venom" }] },
  { frameIndex: 2, tick: 12, entries: [{ kind: "xp", text: "+10 xp" }, { kind: "message", text: "Wave: 2" }, { kind: "marker", text: "wave 2" }] },
  { frameIndex: 3, tick: 13, entries: [{ kind: "attack", text: "Araxxor: drip", special: true }, { kind: "death", text: "Araxxor egg died", count: 2 }, { kind: "prayer", text: "Rigour on" }] },
  { frameIndex: 4, tick: 14, entries: [{ kind: "death", text: "You died", you: true }, { kind: "taken", amount: 0, splat: "block" }] },
]);
assert.deepEqual(
  traced.map(({ frameIndex, dealt, taken, bossSpecial, kills, died, prayer }) => ({ frameIndex, dealt, taken, bossSpecial, kills, died, prayer })),
  [
    { frameIndex: 1, dealt: 6, taken: 7, bossSpecial: false, kills: 0, died: false, prayer: false },
    { frameIndex: 3, dealt: 0, taken: 0, bossSpecial: true, kills: 2, died: false, prayer: true },
    { frameIndex: 4, dealt: 0, taken: 0, bossSpecial: false, kills: 0, died: true, prayer: false },
  ],
  "a tick with nothing to draw (XP, messages, markers) is left out",
);
// Each frame where the slider has it, and back.
for (let frameIndex = 0; frameIndex < 57; frameIndex++) assert.equal(frameAtX(frameX(frameIndex, 57, 400, 6), 57, 400, 6), frameIndex);
assert.equal(frameX(0, 57, 400, 6), 3);
assert.equal(frameX(56, 57, 400, 6), 397);
assert.equal(frameAtX(-20, 57, 400, 6), 0);
assert.equal(frameAtX(900, 57, 400, 6), 56);
// More ticks than pixels: those of a pixel are added up.
const crowded = Array.from({ length: 6 }, (unused, index) => ({ frameIndex: 3000 + index, tick: 3000 + index, dealt: 10, taken: 1, bossSpecial: index === 5, special: false, kills: 0, died: false, prayer: false, gear: false, supply: false }));
const [column, ...others] = columnsOf(crowded, 6000, 100, 6);
assert.equal(column.x, 50);
assert.equal(others.length, 0);
assert.deepEqual([column.dealt, column.taken, column.bossSpecial], [60, 6, true]);
// Over the strip, the tick near the pointer, if one is near enough.
assert.equal(pointNear(traced, frameX(3, 57, 400, 6) + 3, 57, 400, 6).frameIndex, 3);
assert.equal(pointNear(traced, frameX(20, 57, 400, 6), 57, 400, 6), null);

// --- the scripted fights, two of each file: each hitsplat, attack on the player and death has its line, on its tick ---
const counted = (entries, kind) => entries.filter((entry) => entry.kind === kind).reduce((total, entry) => total + (entry.count ?? 1), 0);
let fights = 0;
const scenarios = [];
for (const file of scenarioFiles()) scenarios.push(...(await loadScenarios(file)).slice(0, 2));
for (const scenario of scenarios) {
  let recorded;
  await runScenario(scenario, { onRecorded: (run) => void (recorded = run.frames) });
  if (!recorded || recorded.length < 2) continue;
  fights++;
  const fightRows = createTickLog().rows(recorded);
  const byFrame = new Map(fightRows.map((row) => [row.frameIndex, row]));
  recorded.forEach((frame, index) => {
    const entries = byFrame.get(index)?.entries ?? [];
    const where = `${scenario.name}, tick ${frame.state.currentTick}`;
    const events = (type, test = () => true) => frame.events.filter((event) => event.type === type && test(event)).length;
    assert.equal(counted(entries, "hit") + counted(entries, "taken"), events("hitsplat_spawned"), `${where}: a line for each hitsplat`);
    assert.equal(counted(entries, "taken"), events("hitsplat_spawned", (event) => event.targetId === "player"), `${where}: the hits on the player`);
    assert.equal(counted(entries, "attack"), events("zuk_attack", (event) => event.targetId === "player"), `${where}: the monsters' attacks on the player`);
    const deaths = events("actor_died", (event) => event.actorId !== "player") + (index > 0 && recorded[index - 1].state.isAlive && !frame.state.isAlive ? 1 : 0);
    assert.equal(counted(entries, "death"), deaths, `${where}: the deaths`);
    for (const entry of entries) assert.ok(entry.text && !/undefined|NaN|\[object/.test(sentence(entry)), `${where}: "${sentence(entry)}"`);
    if (byFrame.has(index)) assert.equal(byFrame.get(index).tick, frame.state.currentTick);
  });
  // The strip draws all the damage done, to the monsters and to you.
  const splats = recorded.flatMap((frame) => frame.events.filter((event) => event.type === "hitsplat_spawned" && event.hitsplatType !== "heal"));
  const fightTrace = traceOf(fightRows);
  const added = (key) => fightTrace.reduce((sum, point) => sum + point[key], 0);
  assert.equal(added("dealt"), splats.filter((event) => event.targetId !== "player").reduce((sum, event) => sum + event.amount, 0), `${scenario.name}: the damage done`);
  assert.equal(added("taken"), splats.filter((event) => event.targetId === "player").reduce((sum, event) => sum + event.amount, 0), `${scenario.name}: the damage taken`);
}
assert.ok(fights > 15, `${fights} fights`);
console.log(`The tick log says every hit, attack and death of ${fights} scripted fights on its tick`);

// --- in the application ---------------------------------------------------------
const { openColosseum } = await import("./replay-page.mjs");
const fight = await openColosseum();
const { browser, page, errors, tick: liveTick, waitForTick } = fight;
try {
  await page.evaluate(() => localStorage.removeItem("openscim.plugin.replayTickLog"));
  await waitForTick(2);
  await fight.startWave();
  await fight.play();
  await waitForTick((await liveTick()) + 12);

  await fight.openReplay();
  const panel = page.locator(".replay-tick-log");
  await panel.waitFor({ timeout: 10000 });
  const last = await fight.playhead();
  // Its rows are the recording's ticks, in order, and the playhead's is lit.
  const shown = () =>
    page.evaluate(() =>
      [...document.querySelectorAll(".replay-tick-log__row")].map((row) => ({
        frameIndex: Number(row.dataset.frameIndex),
        tick: Number(row.querySelector(".replay-tick-log__tick").textContent),
        current: row.classList.contains("is-current"),
        on: row.classList.contains("is-on"),
        kinds: [...row.querySelectorAll(".replay-tick-log__entry")].map((entry) => entry.className.match(/--(\w+)$/)[1]),
      })),
    );
  let listed = await shown();
  assert.ok(listed.length >= 3, `${listed.length} ticks listed`);
  const ticks = await page.evaluate(() => recorder.L$().map((frame) => frame.state.currentTick));
  for (const row of listed) assert.equal(row.tick, ticks[row.frameIndex], "a row shows its frame's tick");
  assert.deepEqual(listed.map(({ frameIndex }) => frameIndex), [...listed.map(({ frameIndex }) => frameIndex)].sort((a, b) => a - b));
  const litRow = (rows, at) => rows.filter(({ frameIndex }) => frameIndex <= at).at(-1);
  assert.deepEqual(listed.filter(({ current }) => current), [litRow(listed, last)], "the last tick passed is lit");
  // The encounter's own markers are lines of their tick (client/replay/markers.js): the wave.
  assert.ok(listed.some(({ kinds }) => kinds.includes("marker")), "the wave's marker");
  assert.ok(listed.some(({ kinds }) => kinds.includes("attack") || kinds.includes("taken") || kinds.includes("hit")), "the fight's hits");

  // A click on a tick: the playhead goes there, the tick is lit, and the replay's keys still step it.
  const target = listed[Math.floor(listed.length / 2)];
  await page.locator(`.replay-tick-log__row[data-frame-index="${target.frameIndex}"]`).click();
  await fight.waitForPlayhead(target.frameIndex);
  await page.waitForFunction((at) => replayHook.displayState.currentTick === at, target.tick);
  listed = await shown();
  assert.deepEqual(listed.find(({ current }) => current), { ...target, current: true, on: true });
  await page.keyboard.press("ArrowRight");
  await fight.waitForPlayhead(target.frameIndex + 1);
  await page.keyboard.press("ArrowLeft");
  await fight.waitForPlayhead(target.frameIndex);
  const earliest = listed[0];
  await page.locator(`.replay-tick-log__row[data-frame-index="${earliest.frameIndex}"] .replay-tick-log__entry`).first().click();
  await fight.waitForPlayhead(earliest.frameIndex);

  // Played, it follows: the lit row is the last one passed, and it is in view.
  const inView = () =>
    page.evaluate(() => {
      const list = document.querySelector(".replay-tick-log__list");
      const row = document.querySelector(".replay-tick-log__row.is-current");
      const [a, b] = [list.getBoundingClientRect(), row.getBoundingClientRect()];
      return b.top >= a.top - 1 && b.bottom <= a.bottom + 1;
    });
  await page.keyboard.press("Space");
  await page.waitForFunction(() => replayHook.controlProps.isPlaying, null, { timeout: 5000 });
  await fight.waitForPlayhead(last);
  await page.waitForFunction(() => !replayHook.controlProps.isPlaying, null, { timeout: 20000 });
  listed = await shown();
  assert.equal(listed.find(({ current }) => current).frameIndex, litRow(listed, last).frameIndex);
  assert.ok(await inView(), "the tick on screen is in view");
  // Scrolled by hand, it stops following until Follow.
  const follow = page.locator(".replay-tick-log__follow");
  const scrolled = () => page.evaluate(() => document.querySelector(".replay-tick-log__list").scrollTop);
  await page.locator(".replay-tick-log__list").hover();
  await page.mouse.wheel(0, -5000);
  await page.waitForFunction(() => document.querySelector(".replay-tick-log__follow").getAttribute("aria-pressed") === "false");
  await page.waitForFunction(() => document.querySelector(".replay-tick-log__list").scrollTop === 0);
  await page.keyboard.press("ArrowLeft");
  await fight.waitForPlayhead(last - 1);
  assert.equal(await scrolled(), 0, "not following, the list stays where it was scrolled");
  await follow.click();
  assert.equal(await follow.getAttribute("aria-pressed"), "true");
  assert.ok(await inView());

  // The strip over the slider: the fight drawn, each tick where the slider has it; over one, what happened on it;
  // a click goes to it and a drag along the strip goes along the replay.
  const strip = await page.evaluate(async () => {
    const { traceOf, frameX } = await import("/replay/traceStrip.js");
    const { createTickLog } = await import("/replay/tickLog.js");
    const frames = recorder.L$();
    const element = document.querySelector(".replay-trace");
    const rect = element.getBoundingClientRect();
    const scale = rect.width / element.clientWidth;
    const thumb = parseFloat(getComputedStyle(document.querySelector(".replay-seek-track")).getPropertyValue("--seek-thumb"));
    const canvas = element.querySelector("canvas");
    const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    let painted = 0;
    for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 0) painted++;
    const at = (frameIndex) => rect.left + frameX(frameIndex, frames.length, element.clientWidth, thumb) * scale;
    // The slider's own thumb at the same frame: the strip has each tick where the slider has it.
    const seek = document.querySelector(".replay-seek");
    const seekRect = seek.getBoundingClientRect();
    const sliderAt = (frameIndex) => seekRect.left + (thumb / 2 + ((seek.clientWidth - thumb) * frameIndex) / (frames.length - 1)) * scale;
    const points = traceOf(createTickLog().rows(frames)).map(({ frameIndex }) => ({ frameIndex, x: at(frameIndex), slider: sliderAt(frameIndex) }));
    return { painted, points, left: rect.left, right: rect.right, y: rect.top + rect.height / 2, total: frames.length };
  });
  assert.ok(strip.points.length > 0 && strip.painted > 0, "the fight is drawn");
  for (const { x, slider } of strip.points) assert.ok(Math.abs(x - slider) < 1, `a tick at ${x} on the strip, ${slider} on the slider`);
  const marked = strip.points[Math.floor(strip.points.length / 2)];
  await page.mouse.move(marked.x, strip.y);
  const tip = page.locator(".replay-trace__tip");
  await tip.waitFor({ timeout: 5000 });
  assert.match(await tip.innerText(), new RegExp(`^Tick ${ticks[marked.frameIndex]}\\n.+`));
  await page.mouse.click(marked.x, strip.y);
  await fight.waitForPlayhead(marked.frameIndex);
  await page.mouse.move(strip.left + 2, strip.y);
  await page.mouse.down();
  await fight.waitForPlayhead(0);
  await page.mouse.move(strip.right - 2, strip.y, { steps: 10 });
  await page.mouse.up();
  await fight.waitForPlayhead(strip.total - 1);
  await page.keyboard.press("ArrowLeft");
  await fight.waitForPlayhead(strip.total - 2);
  await page.mouse.move(strip.left, strip.y - 200);
  await tip.waitFor({ state: "hidden", timeout: 5000 });

  // A kind hidden is gone from every tick, and kept; the log closes to its title, and is kept closed.
  const kind = listed.flatMap(({ kinds }) => kinds).find((each) => each !== "marker");
  const lines = page.locator(".replay-tick-log__entry--" + kind);
  const shownLines = await lines.count();
  const chip = page.locator(`.replay-tick-log__kind[data-kind="${kind}"]`);
  await chip.click();
  assert.equal(await chip.getAttribute("aria-pressed"), "false");
  assert.equal(await lines.count(), 0, `no line of the kind ${kind}`);
  assert.equal(await page.evaluate((kind) => JSON.parse(localStorage.getItem("openscim.plugin.replayTickLog")).settings[kind], kind), false);
  await chip.click();
  assert.equal(await lines.count(), shownLines);
  await page.locator(".replay-tick-log__title").click();
  assert.equal(await page.locator(".replay-tick-log__list").isVisible(), false);
  assert.equal(await page.locator(".replay-tick-log__title").getAttribute("aria-expanded"), "false");

  // It goes with the replay, and comes back with it as it was left.
  await fight.closeReplay();
  assert.equal(await panel.count(), 0);
  await fight.openReplay();
  await panel.waitFor({ timeout: 10000 });
  assert.equal(await page.locator(".replay-tick-log__list").isVisible(), false);
  await page.locator(".replay-tick-log__title").click();
  await page.locator(".replay-tick-log__row").first().waitFor({ timeout: 5000 });
  await fight.closeReplay();

  assert.deepEqual(errors, []);
  console.log("The tick log lists the replay's ticks, goes to one on a click, follows the playhead, hides kinds and closes; the strip draws the fight where the slider has each tick and goes where it is clicked or dragged");
} finally {
  await browser.close();
}
