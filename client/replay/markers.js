// The replay's markers and undo: keys that rewind the fight a few ticks, mark
// ticks of it and go back to the marks, without opening the replay. A part of
// the replay (its recorder and player are in assets/Grid.js: ReplayRecorder, useReplay), not a
// plugin: it is there wherever there is a recording, and has options but no
// switch of its own. A key one does not want is unbound.
//
//   - Undo: back as many ticks as "Undo ticks" says; pressed again, as many
//     further. After a death it counts from the last tick alive.
//   - Add marker: marks the tick the fight (or the open replay) is on. In the
//     replay, again on a tick of a marker of one's own, takes it away.
//   - Load marker: back to the marker added or gone to last.
//   - Previous and next marker: to the markers before and after this tick, the
//     player's and the encounter's. In the replay they move the playhead.
//   - Load auto marker: back to the moment the encounter itself marked last
//     (its optional getAutoMarkers, docs/ARCHITECTURE.md): a wave, its
//     reinforcements, the healers of a Jad.
//
// The markers of the recording that is open are drawn on the replay's
// timeline; a click on one moves the playhead there.
//
// A tick is restored by what Take Over restores it with: the run is played
// again from its recorded inputs and compared with the recorded state
// (useReplay, gR); one that differs is not restored and the fight goes on. A marker
// keeps the recording it belongs to, so it outlives a restart, a death and an
// undo past it; it is gone when the page is reloaded. The options are in
// Settings, Simulation; the keys in the game panel's Keybindings
// (assets/rendering.js).
//
// No DOM is needed to load this module and it imports no chunk.
import { createPluginStore } from "../plugins/pluginStore.js";

// Settings, Simulation lists them. The store is the plugins' for what it keeps
// (the options, in localStorage); nothing here reads its switch.
export const replayMarkerOptions = [
  { key: "undoTicks", label: "Undo ticks", section: null, type: "number", min: 1, max: 50, default: 3, info: "How many ticks one press of Undo goes back" },
  { key: "pauseAfterUndo", label: "Pause after undo", section: null, type: "boolean", default: false, info: "The fight waits after an undo until your next action, or Space" },
  { key: "pauseAfterLoad", label: "Pause after loading a marker", section: null, type: "boolean", default: false, info: "The fight waits after a marker is loaded until your next action, or Space" },
  { key: "autoMarkers", label: "Auto markers", section: null, type: "boolean", default: true, info: "Marks the key moments of an encounter that has them: waves, reinforcements, healers, phases" },
  { key: "showMessages", label: "Show messages", section: null, type: "boolean", default: true, info: "Says briefly what was marked, loaded or undone" },
];
export const replayMarkerStore = createPluginStore("replayMarkers", replayMarkerOptions);

// The keybinding of each action (assets/rendering.js).
const keybindingActions = [
  ["replayUndo", "undo"],
  ["replayAddMarker", "add"],
  ["replayLoadMarker", "load"],
  ["replayPreviousMarker", "previous"],
  ["replayNextMarker", "next"],
  ["replayLoadAutoMarker", "loadAuto"],
];

/**
 * The frame Undo goes back to, `ticks` before the last one that can be
 * restored, or null when there is none before the fight's present. Frames
 * that cannot be restored (the intro, a death, a victory) are passed over;
 * the first, from before any tick, is recorded without the gear's bonuses and
 * never rebuilds exactly: a restart goes there.
 * A press while an earlier one is still being restored adds to it (Grid.js).
 */
export function findUndoFrameIndex(frames, ticks, isRestorable) {
  let last = frames.length - 1;
  while (last > 0 && !isRestorable(frames[last].state)) last--;
  if (last <= 0) return null;
  let first = last;
  while (first > 1 && last - first < ticks && isRestorable(frames[first - 1].state)) first--;
  return first < frames.length - 1 ? first : null;
}

// --- the markers -----------------------------------------------------------
// A marker is { run, restoreFrameIndex, startTick, label, ... } (Grid.js,
// markFrame); `label` is null for the player's own.

const markerLimits = { own: 20, auto: 60 };

/**
 * Whether the marker's tick is one of these frames: the recording has not
 * gone another way since. The state is compared and not the frame, which is
 * replaced when its timing is recorded.
 */
export const isOnTimeline = (marker, frames) => frames[marker.restoreFrameIndex]?.state === marker.run.frames[marker.restoreFrameIndex].state;

/**
 * The markers with one more. One of the same kind on the same tick of the
 * timeline is replaced, and so is an encounter's marker of the same name that
 * is no longer on it (the wave was started again). The oldest go when there
 * are too many.
 */
export function addMarker(markers, marker) {
  const { frames } = marker.run;
  const auto = marker.label !== null;
  const kept = markers.filter((other) => {
    if ((other.label !== null) !== auto) return true;
    if (isOnTimeline(other, frames)) return other.restoreFrameIndex !== marker.restoreFrameIndex;
    return !auto || other.label !== marker.label;
  });
  const sameKind = kept.filter((other) => (other.label !== null) === auto);
  const limit = auto ? markerLimits.auto : markerLimits.own;
  const dropped = new Set(sameKind.slice(0, Math.max(0, sameKind.length + 1 - limit)));
  return [...kept.filter((other) => !dropped.has(other)), marker];
}

// How long after going to a marker the keys still count from it: the fight goes on while they are pressed.
const graceTicks = 3;

/**
 * The marker before (-1) or after (1) a tick, or null; of two on a tick the
 * newer. `last` is the marker gone to last, if any.
 */
export function pickMarker(markers, direction, tick, last = null) {
  const from = last !== null && tick >= last.startTick && tick - last.startTick <= graceTicks ? last.startTick : tick;
  let picked = null;
  for (const marker of markers) {
    if ((marker.startTick - from) * direction <= 0) continue;
    if (picked === null || (marker.startTick - picked.startTick) * direction <= 0) picked = marker;
  }
  return picked;
}

/** The encounter's marker that Load auto marker goes to: the last on the timeline, or the newest of another run. */
export function pickAutoMarker(markers, frames) {
  const autos = markers.filter((marker) => marker.label !== null);
  return autos.filter((marker) => isOnTimeline(marker, frames)).sort((a, b) => a.startTick - b.startTick).at(-1) ?? autos.at(-1) ?? null;
}

/**
 * The name of what the encounter reached on this tick, or null: its markers
 * (getAutoMarkers, [{ id, label }]) whose id the tick before did not have.
 */
export function nameNewAutoMarkers(previousIds, autoMarkers) {
  if (!replayMarkerStore.getState().settings.autoMarkers) return null;
  return autoMarkers.filter(({ id }) => !previousIds.has(id)).map(({ label }) => label).join(", ") || null;
}

export const describeMarker = (marker) => (marker.label === null ? `tick ${marker.startTick}` : `${marker.label} (tick ${marker.startTick})`);

// --- the pause after a rollback ---------------------------------------------
// The engine that waits, if one does: the tick loop asks (Grid.js, $Ie), as it
// asks the sandbox. The player's next action lets go of it.
let heldEngine = null;

export const isRollbackHeld = (engine) => heldEngine !== null && heldEngine === engine;

/** Holds the engine a tick was restored to, where the options say so. */
export function holdAfterRollback(engine, isUndo) {
  const { settings } = replayMarkerStore.getState();
  heldEngine = (isUndo ? settings.pauseAfterUndo : settings.pauseAfterLoad) ? engine : null;
  return heldEngine !== null;
}

/** Lets the fight go on. True when it was held. */
export function releaseRollback() {
  if (heldEngine === null) return false;
  heldEngine = null;
  hideMessage();
  return true;
}

// --- the keys ----------------------------------------------------------------

/**
 * The keys, on the document: the application cancels every F key at the
 * window, after it. `getKeybinds()` returns the keybindings,
 * `matches(event, keybind)` says if the event is that one, `isBlocked(event)`
 * if the page takes it (a dialog, a field); `getActions()` returns { undo,
 * add, load, previous, next, loadAuto, isReplaying }. Returns the function
 * that stops listening.
 */
export function listenForReplayKeys(target, { getKeybinds, matches, isBlocked, getActions }) {
  const typing = (event) => typeof HTMLElement !== "undefined" && event.target instanceof HTMLElement && (event.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName));
  // The replay's slider or an option just ticked keeps the focus, and its keys are not text.
  const notText = (event) => ["range", "checkbox", "radio"].includes(event.target?.type);
  const onKeyDown = (event) => {
    if (event.defaultPrevented || (typing(event) && !notText(event)) || isBlocked(event)) return;
    if (event.key === " " && !typing(event) && !getActions().isReplaying && releaseRollback()) {
      event.preventDefault();
      return;
    }
    const keybinds = getKeybinds();
    const action = keybindingActions.find(([key]) => keybinds[key] && matches(event, keybinds[key]))?.[1];
    if (!action) return;
    event.preventDefault();
    // Held down, a key would rewind the whole fight.
    if (!event.repeat) getActions()[action]();
  };
  target.addEventListener("keydown", onKeyDown);
  return () => target.removeEventListener("keydown", onKeyDown);
}

// --- the message ---------------------------------------------------------------

const messageMs = 1800;
let messageElement = null;
let messageTimer;

function hideMessage() {
  clearTimeout(messageTimer);
  if (messageElement) messageElement.style.opacity = "0";
}

/** A line over the top of the scene, for a moment; while the fight is held, until it goes on. */
export function showReplayMessage(text) {
  const held = heldEngine !== null;
  if (typeof document === "undefined" || !replayMarkerStore.getState().settings.showMessages) return;
  if (!messageElement) {
    messageElement = document.createElement("div");
    messageElement.className = "replay-marker-message";
    messageElement.setAttribute("role", "status");
    messageElement.style.cssText =
      "position:fixed;top:72px;left:50%;transform:translateX(-50%);z-index:1200;pointer-events:none;padding:6px 14px;border-radius:6px;background:rgba(20,20,20,.85);color:#fff;font:600 13px/1.4 system-ui,sans-serif;transition:opacity .2s";
    document.body.append(messageElement);
  }
  messageElement.textContent = held ? `${text}. Paused: act or press Space to go on` : text;
  messageElement.style.opacity = "1";
  clearTimeout(messageTimer);
  if (!held) messageTimer = setTimeout(hideMessage, messageMs);
}
