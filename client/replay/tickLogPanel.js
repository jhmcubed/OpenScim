// The tick log beside the replay: a list of the ticks something happened on,
// with what happened (tickLog.js), that follows the playhead and moves it to
// the tick of a line that is clicked. The replay's bar mounts it while a
// replay is open (assets/Grid.js, ReplayTickLog) and hands it the recording,
// the frame on screen and the markers.
//
//   - The tick on screen is lit, and the list keeps it in view while it
//     follows. Scrolled by hand, it stops following until Follow, or a click
//     on a line.
//   - The ticks still to come are dimmed; a click on any line goes there.
//   - Each kind can be hidden (the buttons under the title); the log can be
//     closed to its title. Both are kept (tickLogStore).
//
// The panel holds no focus: the replay's keys (Space, the arrows) still play
// and step it after a click.
import { rowAtFrame, sentence, sharedTickLog, tickLogKinds, tickLogStore } from "./tickLog.js";

// The colour of a kind's mark (here and on the strip over the slider, traceStrip.js), and of a hitsplat's number.
export const kindColors = {
  marker: "#5fb8ff",
  death: "#ff5c7a",
  attack: "#f0a04b",
  taken: "#e8665a",
  special: "#ffcf4a",
  hit: "#9fd46e",
  xp: "#b9a77f",
  prayer: "#c3b4ff",
  gear: "#7fcbd8",
  supply: "#ef93bf",
  message: "#d8c8a8",
};
const splatColors = { damage: "#a8261c", block: "#2f5aa8", poison: "#2f7d32", venom: "#1f6f62", bleed: "#7a1212", burn: "#c2601a", heal: "#7d3f9e" };

const styleId = "replay-tick-log-style";
const css = `
.replay-tick-log { position: fixed; left: 8px; top: 40px; z-index: 31; width: 272px; max-width: calc(100vw - 16px); max-height: min(58vh, 520px);
  display: flex; flex-direction: column; box-sizing: border-box; pointer-events: auto; user-select: none;
  background: var(--color-bg-solid, #1e1812); border: 1px solid var(--color-border, #383023); border-radius: 2px;
  color: var(--color-text-body, #cec0a3); font: 16px/1.15 "RuneScape Plain 12", sans-serif; text-shadow: 1px 1px #000;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.45); animation: 0.15s ease-out backwards replayFadeIn; }
.replay-tick-log--closed { width: auto; max-height: none; }
.replay-tick-log__head { display: flex; align-items: center; gap: 6px; padding: 4px 6px; border-bottom: 1px solid var(--color-border, #383023); }
.replay-tick-log--closed .replay-tick-log__head { border-bottom: none; }
.replay-tick-log button { font: inherit; text-shadow: inherit; cursor: pointer; }
.replay-tick-log__title { flex: 1; display: flex; align-items: center; gap: 6px; padding: 0; border: none; background: none;
  color: var(--color-heading, #ddc9a3); text-align: left; }
.replay-tick-log__title::before { content: ""; width: 0; height: 0; border: 5px solid transparent; border-left-color: currentColor;
  border-right: none; transform: rotate(90deg); transition: transform 0.15s; }
.replay-tick-log--closed .replay-tick-log__title::before { transform: none; }
.replay-tick-log__follow { padding: 1px 6px; border: 1px solid var(--color-border, #383023); border-radius: 2px;
  background: var(--color-surface-inset, #0a0805); color: var(--color-text-muted, #948366); }
.replay-tick-log__follow[aria-pressed="true"] { color: var(--color-accent-text, #d6b26c); border-color: var(--color-primary, #c39a52); }
.replay-tick-log__kinds { display: flex; flex-wrap: wrap; gap: 3px; padding: 4px 6px; border-bottom: 1px solid var(--color-border, #383023); }
.replay-tick-log__kind { display: inline-flex; align-items: center; gap: 4px; padding: 0 5px; font-size: 14px !important;
  border: 1px solid var(--color-border, #383023); border-radius: 2px; background: var(--color-surface-inset, #0a0805); color: var(--color-text-dim, #5b4f40); }
.replay-tick-log__kind::before { content: ""; width: 7px; height: 7px; border-radius: 1px; background: var(--kind); opacity: 0.35; }
.replay-tick-log__kind[aria-pressed="true"] { color: var(--color-text-body, #cec0a3); }
.replay-tick-log__kind[aria-pressed="true"]::before { opacity: 1; }
.replay-tick-log__list { flex: 1; min-height: 0; overflow-y: auto; margin: 0; padding: 2px 0; list-style: none; scrollbar-width: thin; }
.replay-tick-log__empty { margin: 0; padding: 8px; color: var(--color-text-muted, #948366); }
.replay-tick-log__row { display: grid; grid-template-columns: 38px 1fr; padding: 2px 6px 2px 0; border-left: 2px solid transparent; cursor: pointer; }
.replay-tick-log__row:hover { background: var(--color-surface-hover, #363229); }
.replay-tick-log__row.is-current { border-left-color: var(--color-primary, #c39a52); background: var(--color-surface, #14100c); }
.replay-tick-log__row.is-current.is-on { background: var(--color-surface-hover, #363229); }
.replay-tick-log__row.is-current ~ .replay-tick-log__row { opacity: 0.55; }
.replay-tick-log__row.is-current ~ .replay-tick-log__row:hover { opacity: 0.9; }
.replay-tick-log--disabled .replay-tick-log__row { cursor: not-allowed; }
.replay-tick-log__tick { padding-right: 6px; text-align: right; color: var(--color-text-muted, #948366); font-variant-numeric: tabular-nums; }
.replay-tick-log__row.is-current .replay-tick-log__tick { color: var(--color-accent-text, #d6b26c); }
.replay-tick-log__entries { margin: 0; padding: 0; list-style: none; min-width: 0; }
.replay-tick-log__entry { display: flex; align-items: center; gap: 5px; min-width: 0; white-space: nowrap; }
.replay-tick-log__entry::before { content: ""; flex: none; width: 3px; align-self: stretch; margin: 2px 0; border-radius: 1px; background: var(--kind); }
.replay-tick-log__text { overflow: hidden; text-overflow: ellipsis; }
.replay-tick-log__note { color: var(--color-text-muted, #948366); overflow: hidden; text-overflow: ellipsis; }
.replay-tick-log__note--good { color: var(--color-success, #7fae72); }
.replay-tick-log__note--bad { color: #ef6f60; }
.replay-tick-log__splat { flex: none; min-width: 18px; padding: 0 3px; border-radius: 2px; text-align: center; color: #fff; font-variant-numeric: tabular-nums; }
.replay-tick-log__entry--special .replay-tick-log__text, .replay-tick-log__entry--death .replay-tick-log__text { color: var(--kind); }
.replay-tick-log__entry--message .replay-tick-log__text { color: var(--color-text-muted, #948366); }
.replay-tick-log__count-badge { flex: none; color: var(--color-text-muted, #948366); }
@media (max-width: 600px) { .replay-tick-log:not(.replay-tick-log--closed) { width: calc(100vw - 16px); } }
`;

function injectStyle(doc) {
  if (doc.getElementById(styleId)) return;
  const style = doc.createElement("style");
  style.id = styleId;
  style.textContent = css;
  doc.head.append(style);
}

/**
 * The panel, in `doc`. `onSeek(frameIndex)` moves the replay's playhead.
 * Returns { element, update({ frames, frameIndex, markers, disabled, itemName }), destroy() };
 * `markers` are the replay's on this recording, [{ frameIndex, label }].
 */
export function createTickLogPanel(doc, { onSeek }) {
  injectStyle(doc);
  const make = (tag, className, text) => {
    const element = doc.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const element = make("section", "replay-tick-log");
  element.setAttribute("aria-label", "Tick log");
  // The replay's cursor is drawn through it, as through the replay's bar (rendering.js).
  element.setAttribute("data-replay-viewer-chrome", "");
  const head = make("div", "replay-tick-log__head");
  const title = make("button", "replay-tick-log__title");
  title.type = "button";
  title.title = "Show or hide the tick log";
  title.append(make("span", "", "Tick log"));
  const follow = make("button", "replay-tick-log__follow", "Follow");
  follow.type = "button";
  follow.title = "Keep the tick on screen in view as the replay plays";
  head.append(title, follow);
  const kinds = make("div", "replay-tick-log__kinds");
  kinds.setAttribute("role", "group");
  kinds.setAttribute("aria-label", "Kinds shown");
  const kindButtons = tickLogKinds.map(({ key, label, info }) => {
    const button = make("button", "replay-tick-log__kind", label);
    button.type = "button";
    button.dataset.kind = key;
    button.title = info;
    button.style.setProperty("--kind", kindColors[key]);
    kinds.append(button);
    return button;
  });
  const list = make("ol", "replay-tick-log__list");
  const empty = make("p", "replay-tick-log__empty");
  element.append(head, kinds, list, empty);

  let props = { frames: [], frameIndex: 0, markers: [], disabled: false, itemName: undefined };
  let rows = [];
  let built = null;
  let rowElements = [];
  let current = null;
  let following = true;

  const settings = () => tickLogStore.getState().settings;

  function renderRow(row, shown) {
    const item = make("li", "replay-tick-log__row");
    item.dataset.frameIndex = row.frameIndex;
    item.setAttribute("role", "button");
    item.tabIndex = -1;
    item.append(make("span", "replay-tick-log__tick", String(row.tick)));
    const entries = make("ul", "replay-tick-log__entries");
    for (const entry of row.entries) {
      if (!shown(entry.kind)) continue;
      const line = make("li", `replay-tick-log__entry replay-tick-log__entry--${entry.kind}`);
      line.style.setProperty("--kind", entry.own ? "#ffcf4a" : kindColors[entry.kind]);
      line.title = sentence(entry);
      if (entry.amount !== undefined) {
        const splat = make("span", "replay-tick-log__splat", String(entry.amount));
        splat.style.background = splatColors[entry.splat] ?? splatColors.damage;
        line.append(splat);
      }
      line.append(make("span", "replay-tick-log__text", entry.special ? entry.text + " (special)" : entry.text));
      if (entry.note) line.append(make("span", "replay-tick-log__note" + (entry.tone ? " replay-tick-log__note--" + entry.tone : ""), entry.note));
      if (entry.count > 1) line.append(make("span", "replay-tick-log__count-badge", "x" + entry.count));
      entries.append(line);
    }
    item.append(entries);
    item.setAttribute("aria-label", `Tick ${row.tick}: ${row.entries.filter((entry) => shown(entry.kind)).map(sentence).join("; ")}`);
    return item;
  }

  // The rows, again when the recording, its markers or the kinds shown change.
  function build() {
    const { open, ...shownKinds } = settings();
    element.classList.toggle("replay-tick-log--closed", !open);
    title.setAttribute("aria-expanded", String(open));
    follow.hidden = !open;
    kinds.hidden = !open;
    for (const button of kindButtons) button.setAttribute("aria-pressed", String(shownKinds[button.dataset.kind] !== false));
    const key = [props.frames, props.frames.length, props.markers, props.itemName, open, ...Object.values(shownKinds)];
    if (built && key.length === built.length && key.every((part, index) => part === built[index])) return;
    built = key;
    const shown = (kind) => shownKinds[kind] !== false;
    rows = open ? sharedTickLog(props.itemName).rows(props.frames, props.markers).filter((row) => row.entries.some((entry) => shown(entry.kind))) : [];
    rowElements = rows.map((row) => renderRow(row, shown));
    list.replaceChildren(...rowElements);
    list.hidden = !open || rows.length === 0;
    current = null;
    const anyShown = tickLogKinds.some(({ key: kind }) => shown(kind));
    empty.hidden = !open || rows.length > 0;
    empty.textContent = anyShown ? "Nothing has happened yet." : "Every kind is hidden: pick one above.";
  }

  // The playhead: its row lit, and kept in view while the log follows.
  function place() {
    const index = rowAtFrame(rows, props.frameIndex);
    const row = rowElements[index] ?? null;
    if (row !== current) {
      current?.classList.remove("is-current", "is-on");
      row?.classList.add("is-current");
      current = row;
    }
    row?.classList.toggle("is-on", rows[index].frameIndex === props.frameIndex);
    follow.setAttribute("aria-pressed", String(following));
    if (following && !list.hidden) {
      const target = row ? row.offsetTop - list.offsetTop - (list.clientHeight - row.offsetHeight) / 2 : 0;
      list.scrollTop = Math.max(0, target);
    }
  }

  // Its place: under the launcher's tabs at the top left, below a pane of
  // theirs that is open there (Practice, Menu), and above the replay's bar.
  // The bar may be zoomed (the interface scale): the panel is inside it, so
  // what is measured on the page is divided by the zoom.
  function position() {
    const zoom = element.offsetWidth > 0 ? element.getBoundingClientRect().width / element.offsetWidth : 1;
    let top = 40 * zoom;
    for (const item of doc.querySelectorAll(".top-chrome .launcher-tabs, .top-chrome .launcher-pane")) {
      const rect = item.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && rect.left < element.getBoundingClientRect().right) top = Math.max(top, rect.bottom + 6 * zoom);
    }
    const bar = element.closest(".replay-bar")?.getBoundingClientRect();
    const bottom = bar && bar.height > 0 ? bar.top - 8 * zoom : doc.defaultView.innerHeight - 8 * zoom;
    const style = { top: `${top / zoom}px`, maxHeight: `${Math.max(96 * zoom, Math.min(bottom - top, doc.defaultView.innerHeight * 0.6)) / zoom}px` };
    if (element.style.top === style.top && element.style.maxHeight === style.maxHeight) return false;
    Object.assign(element.style, style);
    return true;
  }

  function render() {
    build();
    element.classList.toggle("replay-tick-log--disabled", props.disabled);
    position();
    place();
  }

  // No focus is taken: the replay's keys go on working.
  element.addEventListener("mousedown", (event) => event.preventDefault());
  title.addEventListener("click", () => tickLogStore.setSettings({ ...settings(), open: !settings().open }));
  follow.addEventListener("click", () => {
    following = !following;
    place();
  });
  kinds.addEventListener("click", (event) => {
    const kind = event.target.closest?.(".replay-tick-log__kind")?.dataset.kind;
    if (kind) tickLogStore.setSettings({ ...settings(), [kind]: settings()[kind] === false });
  });
  list.addEventListener("click", (event) => {
    const row = event.target.closest?.(".replay-tick-log__row");
    if (!row || props.disabled) return;
    following = true;
    onSeek(Number(row.dataset.frameIndex));
  });
  // Scrolled by hand: the log stops following.
  const stopFollowing = () => {
    if (!following) return;
    following = false;
    follow.setAttribute("aria-pressed", "false");
  };
  list.addEventListener("wheel", stopFollowing, { passive: true });
  list.addEventListener("touchmove", stopFollowing, { passive: true });
  list.addEventListener("pointerdown", (event) => event.target === list && stopFollowing());
  const unsubscribe = tickLogStore.subscribe(render);
  // A pane opens or closes, the window is resized, while the replay waits.
  const repositioning = doc.defaultView.setInterval(() => position() && place(), 400);

  return {
    element,
    update(next) {
      props = { ...props, ...next, markers: next.markers ?? [] };
      render();
    },
    destroy() {
      unsubscribe();
      doc.defaultView.clearInterval(repositioning);
      element.remove();
    },
  };
}
