// The replay after undos and markers have been at its recording: every frame
// of it still rebuilds, its clock and events still go forward, it still opens,
// plays, is taken over and shared; a marker's copy is not changed by what
// is recorded after it, and is put back as Take Over's own cut leaves a
// recording. First the copy itself, on a recording of the page.
import assert from "node:assert/strict";
import { openColosseum } from "./replay-page.mjs";

const fight = await openColosseum();
const { browser, page, errors, tick, waitForTick, seek } = fight;
// A key that goes back, until the fight has been taken over.
const rewind = async (key) => {
  await page.evaluate(() => void (window.beforeRewind = window.recorder.L$().length && window.engine));
  await page.keyboard.press(key);
  await page.waitForFunction(() => window.engine !== window.beforeRewind && !replayHook.replayPractice.busy, null, { timeout: 20000 });
};
const message = () => page.evaluate(() => document.querySelector(".replay-marker-message")?.textContent ?? "");

try {
  await waitForTick(2);
  await fight.startWave();
  await fight.play();

  // --- the copy of a recording ---
  await page.evaluate(() => {
    const { recorder } = window;
    window.copyAt = recorder.getFrameCount() - 3;
    window.copy = recorder.copyRun(copyAt);
    window.copyText = JSON.stringify(copy);
    // What Take Over leaves of the same recording: the whole of it, cut at the frame (ReplayRecorder, d$).
    const cut = new replayCode.Recorder({}, recorder.clock, recorder.options);
    cut.load(recorder.F$());
    cut.d$(copyAt, 0);
    window.cutData = JSON.stringify(cut.F$());
    window.cutStats = JSON.stringify(cut.getStats());
  });
  // The fight goes on: clicks, the cursor and ticks are recorded over the original.
  await fight.play();
  for (let step = 0; step < 20; step++) await page.mouse.move(400 + step * 10, 300 + step * 5);
  await waitForTick((await tick()) + 4);
  assert.ok(await page.evaluate(() => JSON.stringify(copy) === copyText), "the copy is not changed by what is recorded after it");
  const restored = await page.evaluate(() => {
    const recording = new replayCode.Recorder({}, recorder.clock, recorder.options);
    recording.restoreRun(copy);
    recording.d$(copyAt, 0);
    return { sameData: JSON.stringify(recording.F$()) === cutData, stats: JSON.stringify(recording.getStats()), expected: cutStats, copy: JSON.stringify(copy) === copyText };
  });
  assert.ok(restored.sameData, "restored, it is what Take Over's cut leaves");
  assert.equal(restored.stats, restored.expected, "and its sizes are counted the same");
  // A recording restored from a copy is recorded on; the copy stays as it was, to be restored again.
  assert.ok(
    await page.evaluate(() => {
      const recording = new replayCode.Recorder({}, recorder.clock, recorder.options);
      recording.restoreRun(copy);
      recording.d$(copyAt, 0);
      const { state, input } = recorder.L$()[copyAt + 1];
      recording.recordAction({ type: "toggleRun" });
      recording.recordFrame(state.currentTick, input, recorder.I$(copyAt + 1).state, []);
      recording.recordFrameTiming({ lateByMs: 90 });
      recording.v$(300, 300, 1, { left: 0, top: 0, width: 1280, height: 850 }, performance.now());
      return recording.getFrameCount() === copyAt + 2 && JSON.stringify(copy) === copyText;
    }),
    "recording on leaves the copy alone",
  );

  // --- a fight with undos, markers and a restart in it ---
  await page.keyboard.press("F8");
  assert.match(await message(), /^Marked tick/);
  const marked = Number((await message()).match(/\d+/)[0]);
  await waitForTick(marked + 4);
  await rewind("Control+z");
  await fight.play();
  assert.deepEqual(await fight.checkRecording(), [], "after an undo");
  await rewind("Control+z");
  await rewind("Control+z");
  assert.deepEqual(await fight.checkRecording(), [], "after two in a row");
  await rewind("F9");
  assert.equal(await page.evaluate((marked) => recorder.L$().at(-1).state.currentTick - marked <= 1, marked), true);
  await fight.play();
  assert.deepEqual(await fight.checkRecording(), [], "after a marker of a branch that was left");
  await page.keyboard.press("F8");
  await waitForTick((await tick()) + 3);
  await page.keyboard.press("Control+r");
  await page.waitForFunction(() => engine.currentTick <= 1, null, { timeout: 20000 });
  await waitForTick(3);
  assert.deepEqual(await fight.checkRecording(), [], "after a restart");
  await rewind("F9");
  await fight.play();
  assert.deepEqual(await fight.checkRecording(), [], "after a marker of the run before");
  // Died and undone.
  await page.evaluate(() => {
    engine.setMechanicsConfig({ ...engine.mechanicsConfig, infiniteHealth: false });
    engine.player().vitals.hp = 0;
  });
  await page.waitForFunction(() => !engine.getState().isAlive, null, { timeout: 20000 });
  await page.waitForTimeout(800);
  await rewind("Control+z");
  await waitForTick((await tick()) + 2);
  assert.deepEqual(await fight.checkRecording(), [], "after a death that was undone");

  // --- the replay of it ---
  const shared = await fight.shareAndRead();
  assert.ok(shared.eligible, "it can be shared");
  assert.ok(shared.read === shared.frames && shared.same, "and reads back as it was recorded");
  assert.equal(shared.hp[0], shared.hp[1]);
  await fight.openReplay();
  const last = await fight.playhead();
  assert.equal(last, (await page.evaluate(() => recorder.getFrameCount())) - 1);
  for (const key of ["Home", "End"]) {
    await page.keyboard.press(key);
    await fight.waitForPlayhead(key === "Home" ? 0 : last);
  }
  await page.evaluate((at) => replayHook.controlProps.onSeek(at), last - 8);
  await fight.waitForPlayhead(last - 8);
  await page.keyboard.press("Space");
  await fight.waitForPlayhead(last);
  assert.equal(await page.evaluate(() => replayHook.controlProps.playbackError), null);

  // Undo does nothing to a replay that is open.
  const open = await page.evaluate(() => [recorder.getFrameCount(), (window.beforeRewind = window.engine).currentTick]);
  await page.keyboard.press("Control+z");
  assert.equal(await message(), "Undo works in the fight, not in its replay");
  await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(() => [recorder.getFrameCount(), engine.currentTick]), open);
  assert.ok(await page.evaluate(() => window.engine === window.beforeRewind));

  // Take Over keeps its own rules after all that: the tick before, and the countdown.
  await page.evaluate((at) => replayHook.controlProps.onSeek(at), last - 2);
  await fight.waitForPlayhead(last - 2);
  const takenOver = await page.evaluate((at) => recorder.L$()[at].state.currentTick, last - 3);
  await page.evaluate(() => replayHook.controlProps.onTakeOver());
  await seek.waitFor({ state: "detached", timeout: 20000 });
  const takenOverAt = Date.now();
  assert.equal(await tick(), takenOver);
  await waitForTick(takenOver + 1);
  assert.ok(Date.now() - takenOverAt > 1200, `the countdown: the next tick came after ${Date.now() - takenOverAt} ms`);

  // --- Practice and the markers, each with its own start ---
  await waitForTick(takenOver + 4);
  await page.keyboard.press("F8");
  const beforePractice = Number((await message()).match(/\d+/)[0]);
  await waitForTick(beforePractice + 5);
  await fight.openReplay();
  const practiceAt = (await fight.playhead()) - 1;
  await page.evaluate((at) => replayHook.controlProps.onSeek(at), practiceAt);
  await fight.waitForPlayhead(practiceAt);
  await page.evaluate(() => replayHook.replayPractice.onStartPractice());
  await seek.waitFor({ state: "detached", timeout: 20000 });
  await page.waitForFunction(() => replayHook.replayPractice.startTick !== null, null, { timeout: 5000 });
  const practiceTick = await page.evaluate(() => replayHook.replayPractice.startTick);
  await waitForTick(practiceTick + 3);
  // An undo that stays after the practice start keeps it, and Ctrl+R still goes there.
  await page.evaluate(() => replayHook.markerActions.undo());
  await page.waitForFunction((from) => engine.currentTick <= from + 1, practiceTick, { timeout: 5000 });
  assert.equal(await page.evaluate(() => replayHook.replayPractice.startTick), practiceTick);
  await waitForTick(practiceTick + 1);
  await rewind("Control+r");
  assert.ok((await tick()) <= practiceTick);
  // A marker from before it takes it away: that tick is no longer in the recording.
  await rewind("F9");
  assert.equal(await page.evaluate(() => replayHook.replayPractice.startTick), null);
  assert.deepEqual(await fight.checkRecording(), []);

  // So does a marker that is further on, where its recording went another way before the practice start.
  await waitForTick((await tick()) + 8);
  await page.keyboard.press("F8");
  const other = Number((await message()).match(/\d+/)[0]);
  await rewind("Control+z");
  await rewind("Control+z");
  assert.ok((await tick()) <= other - 4);
  await fight.play();
  await waitForTick(other + 3);
  await fight.openReplay();
  const [startFrame, branches] = await page.evaluate((other) => {
    const frames = recorder.L$();
    const index = frames.findIndex((frame) => frame.state.currentTick === other) - 1;
    return [index, frames[index].state.currentTick];
  }, other);
  assert.equal(branches, other - 1);
  await page.evaluate((at) => replayHook.controlProps.onSeek(at), startFrame);
  await fight.waitForPlayhead(startFrame);
  await page.evaluate(() => replayHook.replayPractice.onStartPractice());
  await seek.waitFor({ state: "detached", timeout: 20000 });
  await page.waitForFunction(() => replayHook.replayPractice.startTick !== null, null, { timeout: 5000 });
  assert.ok((await page.evaluate(() => replayHook.replayPractice.startTick)) < other);
  await rewind("F9");
  assert.equal(await page.evaluate(() => replayHook.replayPractice.startTick), null, "the practice start was of the recording that was left");
  assert.deepEqual(await fight.checkRecording(), []);

  // --- a shared replay: its ticks can be marked and played from ---
  await page.evaluate(() => {
    const data = replayHook.exportReplayData();
    const { bytes } = replayCode.pack(data, { startFrame: 0, endFrame: data.frames.length - 1 }, { share: {} });
    replayHook.loadExternalReplay(replayCode.toData(replayCode.unpack(bytes)));
  });
  await seek.waitFor({ timeout: 20000 });
  assert.equal(await page.locator(".replay-marker").count(), 0, "the markers of the run on screen are not those of a replay that was opened");
  await page.keyboard.press("End");
  const sharedEnd = await page.evaluate(() => recorder.getFrameCount() - 1);
  await fight.waitForPlayhead(sharedEnd);
  await page.evaluate((at) => replayHook.controlProps.onSeek(at), sharedEnd - 2);
  await fight.waitForPlayhead(sharedEnd - 2);
  await page.keyboard.press("F8");
  await page.locator(".replay-marker").waitFor({ timeout: 5000 });
  const sharedTick = Number((await message()).match(/\d+/)[0]);
  await rewind("F9");
  assert.equal(await page.evaluate(() => recorder.L$()[recorder.L$().length - 1].state.currentTick >= engine.currentTick), true);
  assert.ok((await tick()) - sharedTick <= 1);
  await fight.play();
  assert.deepEqual(await fight.checkRecording(), [], "a fight played from a shared replay");

  assert.deepEqual(errors, []);
  console.log("The replay still rebuilds, opens, plays, is taken over, practised and shared after undos and markers; a marker's copy is its own");
} finally {
  await browser.close();
}
