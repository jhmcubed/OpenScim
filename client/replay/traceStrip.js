// The replay's trace: a strip over its slider with the whole fight at a
// glance, read from the tick log (tickLog.js). The replay's bar mounts it
// (assets/Grid.js, ReplayTrace) over the slider, and each tick is drawn where
// the slider has it.
//
//   - Above the middle line, the damage done to the monsters on a tick; below
//     it, the damage done to you. A bar is as tall as the square root of the
//     damage, so that small hits still show beside the big ones.
//   - Along the top, the monsters' special attacks (orange) and yours (gold);
//     along the bottom, prayers (lilac), gear (blue) and food and potions
//     (pink) switched.
//   - A line across it where a monster died, red where you did.
//   - Over a tick, its lines from the log; a click goes there, and a drag goes
//     along it as the slider does. A click near a tick something happened on
//     goes to that tick.
//
// Where ticks are more than the strip has pixels, the ticks of a pixel are
// added up.
import { sentence, sharedTickLog } from "./tickLog.js";
import { kindColors } from "./tickLogPanel.js";

/**
 * A tick log's rows as the strip draws them: [{ frameIndex, tick, dealt,
 * taken, bossSpecial, special, kills, died, prayer, gear, supply, entries }],
 * only those with something to draw. Hits are added up, healing left out.
 */
export function traceOf(rows) {
  const trace = [];
  for (const { frameIndex, tick, entries } of rows) {
    const total = (kind) => entries.filter((entry) => entry.kind === kind && entry.amount !== undefined && entry.splat !== "heal").reduce((sum, entry) => sum + entry.amount * (entry.count ?? 1), 0);
    const has = (test) => entries.some(test);
    const point = {
      frameIndex,
      tick,
      dealt: total("hit"),
      taken: total("taken"),
      bossSpecial: has((entry) => entry.kind === "attack" && entry.special),
      special: has((entry) => entry.kind === "special"),
      kills: entries.filter((entry) => entry.kind === "death" && !entry.you).reduce((sum, entry) => sum + (entry.count ?? 1), 0),
      died: has((entry) => entry.kind === "death" && entry.you),
      prayer: has((entry) => entry.kind === "prayer"),
      gear: has((entry) => entry.kind === "gear"),
      supply: has((entry) => entry.kind === "supply"),
      entries,
    };
    const hasHits = entries.some((entry) => entry.amount !== undefined && entry.splat !== "heal");
    if (hasHits || point.bossSpecial || point.special || point.kills || point.died || point.prayer || point.gear || point.supply) trace.push(point);
  }
  return trace;
}

/** Where the slider has a frame: its x in a strip `width` wide, its thumb `thumb` wide (CSS, .replay-seek-track). */
export const frameX = (frameIndex, totalFrames, width, thumb) => thumb / 2 + ((width - thumb) * frameIndex) / Math.max(1, totalFrames - 1);

/** The frame at `x`, as the slider would take it. */
export const frameAtX = (x, totalFrames, width, thumb) => Math.min(totalFrames - 1, Math.max(0, Math.round(((x - thumb / 2) / Math.max(1, width - thumb)) * (totalFrames - 1))));

/**
 * The trace a pixel at a time: [{ x, dealt, taken, ... }] for the columns with
 * anything in them, the ticks of a column added up and its flags joined.
 */
export function columnsOf(trace, totalFrames, width, thumb) {
  const columns = new Map();
  for (const point of trace) {
    const x = Math.round(frameX(point.frameIndex, totalFrames, width, thumb));
    const column = columns.get(x) ?? { x, dealt: 0, taken: 0, bossSpecial: false, special: false, kills: 0, died: false, prayer: false, gear: false, supply: false };
    column.dealt += point.dealt;
    column.taken += point.taken;
    column.kills += point.kills;
    for (const flag of ["bossSpecial", "special", "died", "prayer", "gear", "supply"]) column[flag] ||= point[flag];
    columns.set(x, column);
  }
  return [...columns.values()].sort((a, b) => a.x - b.x);
}

/** The point of the trace nearest to `x`, if one is within `reach` pixels; else null. */
export function pointNear(trace, x, totalFrames, width, thumb, reach = 4) {
  let best = null;
  let bestDistance = reach + 0.5;
  for (const point of trace) {
    const distance = Math.abs(frameX(point.frameIndex, totalFrames, width, thumb) - x);
    if (distance < bestDistance) {
      best = point;
      bestDistance = distance;
    }
  }
  return best;
}

// --- the strip ---------------------------------------------------------------

const height = 26;
const lane = 3; // the rows of marks along the top and the bottom
const middle = height / 2;
const colors = {
  dealt: kindColors.hit,
  taken: kindColors.taken,
  bossSpecial: kindColors.attack,
  special: kindColors.special,
  kill: "rgba(255, 92, 122, 0.75)",
  died: "#ff3b3b",
  prayer: kindColors.prayer,
  gear: kindColors.gear,
  supply: kindColors.supply,
};

const styleId = "replay-trace-style";
const css = `
.replay-trace { position: relative; height: ${height}px; margin: 0 0 2px; cursor: pointer; touch-action: none; }
.replay-trace--empty { display: none; }
.replay-trace--disabled { cursor: not-allowed; opacity: 0.6; }
.replay-trace__canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
.replay-trace__playhead, .replay-trace__hover { position: absolute; top: 0; bottom: 0; width: 1px; margin-left: -0.5px; pointer-events: none; }
.replay-trace__playhead { background: var(--hud-accent, #bba57e); }
.replay-trace__hover { background: var(--hud-value, #cec0a3); opacity: 0.6; }
.replay-trace__tip { position: absolute; bottom: calc(100% + 6px); z-index: 3; max-width: 280px; padding: 4px 7px; pointer-events: none;
  background: var(--color-bg-solid, #1e1812); border: 1px solid var(--color-border, #383023); border-radius: 2px;
  color: var(--color-text-body, #cec0a3); font: 14px/1.15 "RuneScape Plain 12", sans-serif; text-shadow: 1px 1px #000; white-space: nowrap; }
.replay-trace__tip b { color: var(--color-accent-text, #d6b26c); font-weight: normal; }
.replay-trace__tip-line { overflow: hidden; text-overflow: ellipsis; }
`;

function injectStyle(doc) {
  if (doc.getElementById(styleId)) return;
  const style = doc.createElement("style");
  style.id = styleId;
  style.textContent = css;
  doc.head.append(style);
}

/**
 * The strip, in `doc`. `onSeek(frameIndex)` moves the replay's playhead.
 * Returns { element, update({ frames, frameIndex, disabled, itemName }), destroy() }.
 */
export function createTraceStrip(doc, { onSeek }) {
  injectStyle(doc);
  const element = doc.createElement("div");
  element.className = "replay-trace";
  element.setAttribute("aria-hidden", "true");
  element.setAttribute("data-replay-viewer-chrome", "");
  const canvas = doc.createElement("canvas");
  canvas.className = "replay-trace__canvas";
  const playhead = doc.createElement("div");
  playhead.className = "replay-trace__playhead";
  const hover = doc.createElement("div");
  hover.className = "replay-trace__hover";
  hover.hidden = true;
  const tip = doc.createElement("div");
  tip.className = "replay-trace__tip";
  tip.hidden = true;
  element.append(canvas, playhead, hover, tip);

  let props = { frames: [], frameIndex: 0, disabled: false, itemName: undefined };
  let trace = [];
  let drawnFor = null;

  // The strip's width in CSS pixels (before the bar's zoom), and the slider's thumb beside it.
  const width = () => element.clientWidth;
  const thumb = () => {
    const track = element.closest(".replay-seek-row")?.querySelector(".replay-seek-track");
    return (track && parseFloat(doc.defaultView.getComputedStyle(track).getPropertyValue("--seek-thumb"))) || 6;
  };
  const totalFrames = () => props.frames.length;
  // A pointer's x on the strip, in its CSS pixels, whatever the zoom.
  const xOf = (event) => {
    const rect = element.getBoundingClientRect();
    return ((event.clientX - rect.left) / Math.max(1, rect.width)) * width();
  };

  function draw() {
    const w = width();
    const key = [props.frames, props.frames.length, props.itemName, w];
    if (drawnFor && key.every((part, index) => part === drawnFor[index])) return;
    drawnFor = key;
    trace = traceOf(sharedTickLog(props.itemName).rows(props.frames));
    element.classList.toggle("replay-trace--empty", trace.length === 0 || totalFrames() < 2);
    const ratio = doc.defaultView.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(w * ratio));
    canvas.height = Math.round(height * ratio);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, w, height);
    context.fillStyle = "rgba(255, 255, 255, 0.08)";
    context.fillRect(0, middle - 0.5, w, 1);
    const columns = columnsOf(trace, totalFrames(), w, thumb());
    const most = Math.max(1, ...columns.map((column) => Math.max(column.dealt, column.taken)));
    const room = middle - lane - 1;
    const bar = (amount) => (amount > 0 ? Math.max(1, room * Math.sqrt(amount / most)) : 0);
    // As wide as a tick has room for, in a short fight; a pixel and a half in a long one.
    const perTick = (w - thumb()) / Math.max(1, totalFrames() - 1);
    const barWidth = Math.min(5, Math.max(1.5, perTick * 0.6));
    const markWidth = Math.min(5, Math.max(2.5, perTick * 0.6));
    for (const column of columns) {
      const x = column.x;
      if (column.kills > 0 || column.died) {
        context.fillStyle = column.died ? colors.died : colors.kill;
        context.fillRect(x - (column.died ? 1 : 0.5), 0, column.died ? 2 : 1, height);
      }
      if (column.dealt > 0) {
        context.fillStyle = colors.dealt;
        context.fillRect(x - barWidth / 2, middle - 0.5 - bar(column.dealt), barWidth, bar(column.dealt));
      }
      if (column.taken > 0) {
        context.fillStyle = colors.taken;
        context.fillRect(x - barWidth / 2, middle + 0.5, barWidth, bar(column.taken));
      }
      if (column.bossSpecial || column.special) {
        context.fillStyle = column.bossSpecial ? colors.bossSpecial : colors.special;
        context.fillRect(x - markWidth / 2, 0, markWidth, lane);
      }
      const switched = column.prayer ? colors.prayer : column.gear ? colors.gear : column.supply ? colors.supply : null;
      if (switched) {
        context.fillStyle = switched;
        context.fillRect(x - markWidth / 2, height - lane, markWidth, lane);
      }
    }
  }

  function placePlayhead() {
    playhead.style.left = `${frameX(props.frameIndex, totalFrames(), width(), thumb())}px`;
  }

  function render() {
    draw();
    element.classList.toggle("replay-trace--disabled", props.disabled);
    placePlayhead();
  }

  // Over the strip: the tick a click would go to, and its lines.
  const target = (event) => {
    const x = xOf(event);
    const point = pointNear(trace, x, totalFrames(), width(), thumb());
    return point ? { frameIndex: point.frameIndex, point } : { frameIndex: frameAtX(x, totalFrames(), width(), thumb()), point: null };
  };
  function showTip(event) {
    if (totalFrames() < 2) return;
    const { frameIndex, point } = target(event);
    const x = frameX(frameIndex, totalFrames(), width(), thumb());
    hover.hidden = false;
    hover.style.left = `${x}px`;
    const tick = props.frames[frameIndex]?.state?.currentTick ?? frameIndex;
    const lines = point ? point.entries.map(sentence) : [];
    const shown = lines.slice(0, 6);
    tip.replaceChildren();
    const head = doc.createElement("div");
    const bold = doc.createElement("b");
    bold.textContent = `Tick ${tick}`;
    head.append(bold);
    tip.append(head);
    for (const line of [...shown, ...(lines.length > shown.length ? [`and ${lines.length - shown.length} more`] : [])]) {
      const each = doc.createElement("div");
      each.className = "replay-trace__tip-line";
      each.textContent = line;
      tip.append(each);
    }
    tip.hidden = false;
    // Kept inside the strip's width.
    const tipWidth = tip.offsetWidth;
    tip.style.left = `${Math.min(Math.max(0, x - tipWidth / 2), Math.max(0, width() - tipWidth))}px`;
  }
  const hideTip = () => {
    hover.hidden = true;
    tip.hidden = true;
  };

  let dragging = false;
  element.addEventListener("pointerdown", (event) => {
    if (props.disabled || event.button !== 0 || totalFrames() < 2) return;
    event.preventDefault();
    dragging = true;
    element.setPointerCapture?.(event.pointerId);
    onSeek(target(event).frameIndex);
  });
  element.addEventListener("pointermove", (event) => {
    showTip(event);
    if (dragging && !props.disabled) {
      const frameIndex = frameAtX(xOf(event), totalFrames(), width(), thumb());
      if (frameIndex !== props.frameIndex) onSeek(frameIndex);
    }
  });
  const stop = (event) => {
    dragging = false;
    if (element.hasPointerCapture?.(event.pointerId)) element.releasePointerCapture(event.pointerId);
  };
  element.addEventListener("pointerup", stop);
  element.addEventListener("pointercancel", stop);
  element.addEventListener("pointerleave", () => !dragging && hideTip());
  // No focus is taken: the replay's keys go on working.
  element.addEventListener("mousedown", (event) => event.preventDefault());
  const resized = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => render());
  resized?.observe(element);

  return {
    element,
    update(next) {
      props = { ...props, ...next };
      render();
    },
    destroy() {
      resized?.disconnect();
      element.remove();
    },
  };
}
