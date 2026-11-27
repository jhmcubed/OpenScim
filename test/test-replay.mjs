// The replay in the application, without its undo and markers
// (test-replay-markers.mjs): a recorded fight is opened, stepped through,
// sought and played; the fight waits meanwhile and goes on after; Take Over
// and Practice restore a tick as it was, with the start-of-fight countdown; a
// shared replay is read back as it was recorded and opens in the page.
import assert from "node:assert/strict";
import { openColosseum } from "./replay-page.mjs";

const fight = await openColosseum();
const { browser, page, errors, tick, waitForTick, seek } = fight;

try {
  await waitForTick(2);
  await fight.startWave();
  await fight.play();
  await waitForTick((await tick()) + 6);

  // Every frame of what was recorded can be rebuilt, and what would be shared is what was recorded.
  assert.deepEqual(await fight.checkRecording(), []);

  // --- opened, the fight waits ---
  await fight.openReplay();
  const stoppedAt = await tick();
  const last = await fight.playhead();
  assert.equal(last, (await page.evaluate(() => recorder.getFrameCount())) - 1, "the replay opens at its end");
  await page.waitForTimeout(1200);
  assert.equal(await tick(), stoppedAt, "the fight does not tick under its replay");
  const shown = () => page.evaluate(() => replayHook.displayState.currentTick);

  // --- stepped and sought: the scene and the interface are handed the tick of the frame ---
  await page.keyboard.press("ArrowLeft");
  await fight.waitForPlayhead(last - 1);
  await page.waitForFunction((at) => replayHook.displayState.currentTick === at, stoppedAt - 1);
  await page.keyboard.press("ArrowRight");
  await fight.waitForPlayhead(last);
  await page.keyboard.press("Home");
  await fight.waitForPlayhead(0);
  await page.waitForFunction(() => replayHook.displayState.currentTick === 0);
  await page.keyboard.press("End");
  await fight.waitForPlayhead(last);
  await page.evaluate((at) => replayHook.controlProps.onSeek(at), last - 5);
  await fight.waitForPlayhead(last - 5);
  await page.waitForFunction((at) => replayHook.displayState.currentTick === at, stoppedAt - 5);
  // What is shown is what was recorded, not a run of its own.
  assert.ok(await page.evaluate((at) => JSON.stringify(replayHook.displayState.npcs.map(({ id, position }) => [id, position])) === JSON.stringify(recorder.I$(at).state.npcs.map(({ id, position }) => [id, position])), last - 5));

  // --- played from there to its end, where it stops ---
  await page.keyboard.press("Space");
  await page.waitForFunction(() => replayHook.controlProps.isPlaying, null, { timeout: 5000 });
  await fight.waitForPlayhead(last);
  await page.waitForFunction(() => !replayHook.controlProps.isPlaying, null, { timeout: 10000 });
  assert.equal(await shown(), stoppedAt);
  assert.equal(await page.evaluate(() => replayHook.controlProps.playbackError), null);

  // --- closed, the same fight goes on from where it waited ---
  const before = await page.evaluate(() => (window.beforeReplay = window.engine).currentTick);
  assert.equal(before, stoppedAt);
  await fight.closeReplay();
  await waitForTick(stoppedAt + 2);
  assert.ok(await page.evaluate(() => window.engine === window.beforeReplay), "closing a replay takes nothing over");
  assert.deepEqual(await fight.checkRecording(), []);

  // --- Take Over: the tick before the one shown, with the countdown ---
  await fight.openReplay();
  const end = await fight.playhead();
  await page.evaluate((at) => replayHook.controlProps.onSeek(at), end - 4);
  await fight.waitForPlayhead(end - 4);
  const expected = await page.evaluate((at) => {
    const { state } = recorder.I$(at);
    return { tick: state.currentTick, hp: state.playerHP, position: state.playerPosition, npcs: state.npcs.map(({ id, position }) => [id, position]) };
  }, end - 5);
  await page.evaluate(() => void (window.beforeReplay = window.engine));
  await page.evaluate(() => replayHook.controlProps.onTakeOver());
  await seek.waitFor({ state: "detached", timeout: 20000 });
  await page.waitForFunction(() => window.engine !== window.beforeReplay, null, { timeout: 5000 });
  const takenOverAt = Date.now();
  const read = () => page.evaluate(() => ({ tick: engine.currentTick, hp: engine.getState().playerHP, position: engine.getState().playerPosition, npcs: engine.getState().npcs.map(({ id, position }) => [id, position]) }));
  assert.deepEqual(await read(), expected);
  assert.equal(await page.evaluate(() => recorder.getFrameCount()), end - 4, "the recording ends with the tick taken over");
  await waitForTick(expected.tick + 1);
  assert.ok(Date.now() - takenOverAt > 1200, `a countdown of 5 ticks (1.5 seconds) first: the next tick came after ${Date.now() - takenOverAt} ms`);
  await fight.play();
  assert.deepEqual(await fight.checkRecording(), [], "what is recorded after a Take Over rebuilds too");

  // --- Practice: Ctrl+R goes back to the tick practised ---
  await fight.openReplay();
  const practiceEnd = await fight.playhead();
  await page.evaluate((at) => replayHook.controlProps.onSeek(at), practiceEnd - 3);
  await fight.waitForPlayhead(practiceEnd - 3);
  await page.evaluate(() => replayHook.replayPractice.onStartPractice());
  await seek.waitFor({ state: "detached", timeout: 20000 });
  await page.waitForFunction(() => replayHook.replayPractice.startTick !== null, null, { timeout: 5000 });
  const practiceFrom = await page.evaluate(() => replayHook.replayPractice.startTick - 1);
  await waitForTick(practiceFrom + 4);
  await page.evaluate(() => void (window.beforeReplay = window.engine));
  await page.keyboard.press("Control+r");
  await page.waitForFunction(() => window.engine !== window.beforeReplay, null, { timeout: 10000 });
  await page.waitForFunction((from) => engine.currentTick >= from && engine.currentTick <= from + 1, practiceFrom, { timeout: 5000 });
  assert.equal(await page.evaluate(() => replayHook.replayPractice.startTick), practiceFrom + 1, "the practice start is kept");
  // Cleared, Ctrl+R restarts the fight: the same engine, at its first tick.
  await page.evaluate(() => replayHook.replayPractice.onClearStart());
  await page.waitForFunction(() => replayHook.replayPractice.startTick === null, null, { timeout: 5000 });

  // --- shared and read back ---
  await waitForTick(practiceFrom + 3);
  const shared = await fight.shareAndRead();
  assert.ok(shared.eligible);
  assert.equal(shared.read, shared.frames);
  assert.ok(shared.same, "ticks, inputs, actions and events");
  assert.equal(shared.hp[0], shared.hp[1]);
  // Opened as a shared replay is: it shows from its start and leaves to a new run.
  await page.evaluate(() => {
    const data = replayHook.exportReplayData();
    const { bytes } = replayCode.pack(data, { startFrame: 0, endFrame: data.frames.length - 1 }, { share: {} });
    replayHook.loadExternalReplay(replayCode.toData(replayCode.unpack(bytes)));
  });
  await seek.waitFor({ timeout: 20000 });
  await fight.waitForPlayhead(0);
  await page.keyboard.press("End");
  await fight.waitForPlayhead(shared.frames - 1);
  assert.equal(await page.evaluate(() => replayHook.controlProps.playbackError), null);
  await fight.closeReplay();
  await page.waitForFunction(() => !replayHook.replayMode, null, { timeout: 5000 });

  await page.keyboard.press("Control+r");
  await page.waitForFunction(() => engine.currentTick <= 1, null, { timeout: 20000 });
  assert.deepEqual(errors, []);
  console.log("The replay opens, steps, seeks, plays and closes; Take Over and Practice restore a tick exactly; a shared replay reads back");
} finally {
  await browser.close();
}
