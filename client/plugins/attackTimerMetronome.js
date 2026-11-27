// The plugin Attack Timer Metronome: the ticks until the player's next attack,
// as a number over the player's head and as a bar. Rebuilt from the RuneLite
// plugin of that name (github.com/ngraves95/attacktimer, v1.3.8, BSD 2-Clause),
// from its options, their defaults and what it shows; no code of it is here.
// Left out: its overlay layer choice ("Draw": the page has one layer for bars),
// "Disable Font Size Scaling" (the number is never scaled here), its debug
// logging and its deprecated switch. Its panel is named and grouped here as
// the Plugins panel's others are, with fewer fonts and two bar switches kept
// at their defaults (attackTimerMetronomeOptions).
//
// What is the application's own: the timer is the engine's. The plugin in the
// game has to work an attack out from the player's animation and a table of
// weapons, eats and bosses (its VariableSpeed); here the fight itself keeps the
// tick of the next attack (`playerNextAttackTick`) and the cycle of the one
// scheduled (`playerAttackSpeed`), so what is shown is what the engine does,
// for every weapon and every encounter. The Plugins panel lists it by its store
// (application.js, PluginStoreEntry), and rendering.js draws what this module
// returns (DL for the number, LL for the bar).
//
// In the plugin's terms, with T the ticks until the next attack (the next
// attack's tick minus this one): the number is T while T > 0 (T - 1 when
// zero-based), in the last tick colour when T is 1. Once T reaches 0 the attack
// is late: -1, -2, ... in the lost tick colour, up to the maximum, then nothing
// until the next attack. The bar shows from the attack until T is 0, at
// (T - 1) / (cycle - 1) of its width by default.
import { createPluginStore, toHexColor } from "./pluginStore.js";

const choices = (...pairs) => pairs.map(([value, label]) => ({ value, label }));

/**
 * The options, with the plugin's defaults, named and grouped as the Plugins
 * panel names the others' (Defence Tracker's). The keys are the plugin's.
 * Left out of the panel: its fonts other than these four, and its "Empties
 * Before Attack" and "Fills Before Attack", kept at their defaults (both on).
 */
export const attackTimerMetronomeOptions = [
  { key: "showTick", label: "Show tick number", section: "General", type: "boolean", default: true, info: "Shows the ticks until your next attack over your head", keywords: ["overhead timer", "overhead number", "attack cycle", "above head", "cooldown ticks"] },
  { key: "showBar", label: "Show attack bar", section: "General", type: "boolean", default: false, info: "Shows a bar over your head that runs down to your next attack", keywords: ["cooldown bar", "attack timer bar", "attack bar"] },
  { key: "useZeroBasedTickCount", label: "Count down to 0", section: "Tick Number", type: "boolean", default: false, info: "Counts down to 0 instead of 1", keywords: ["zero based", "count to zero", "0 based"] },
  { key: "showLostTicks", label: "Show late ticks", section: "Tick Number", type: "boolean", default: true, info: "Shows -1, -2 when an attack is late", keywords: ["lost ticks", "late attack", "negative ticks"] },
  { key: "maximumLostTicks", label: "Late ticks shown", section: "Tick Number", type: "number", min: 1, max: 20, default: 2, info: "How far past an attack the count keeps going", keywords: ["lost ticks", "late attack", "negative ticks"] },
  {
    key: "ticksPosition",
    label: "Position",
    section: "Tick Number",
    type: "select",
    choices: choices(["DEFAULT", "Above head"], ["TOP", "Top"], ["CENTERED", "Centre of player"], ["BOTTOM", "At feet"]),
    default: "DEFAULT",
    info: "Where the tick number is drawn", keywords: ["placement", "above head", "feet", "overhead number"],
  },
  { key: "tickHeightOffset", label: "Y offset", section: "Tick Number", type: "number", min: -50, max: 50, default: 0, info: "Moves the number up (positive) or down (negative)", keywords: ["offset", "height", "move up", "move down"] },
  { key: "fontSize", label: "Font size", section: "Tick Number", type: "number", min: 8, max: 50, default: 15, info: "The size of the tick number", keywords: ["font size", "text size", "number size"] },
  {
    key: "fontType",
    label: "Font",
    section: "Tick Number",
    type: "select",
    choices: choices(["REGULAR", "RuneScape"], ["BOLD", "RuneScape bold"], ["ARIAL", "Arial"], ["VERDANA", "Verdana"]),
    default: "REGULAR",
    info: "The font of the tick number", keywords: ["font", "typeface", "bold"],
  },
  {
    key: "barStyle",
    label: "Style",
    section: "Attack Bar",
    type: "select",
    choices: choices(["AUTO", "Match Interface Styles"], ["STANDARD", "Standard"], ["HIGH_DETAIL", "High detail"]),
    default: "AUTO",
    info: "The bar's look; by default the same as your health bar's", keywords: ["hd bar", "high detail", "health bar style"],
  },
  { key: "barDrains", label: "Drain instead of fill", section: "Attack Bar", type: "boolean", default: true, info: "Starts full and empties, rather than starting empty and filling", keywords: ["fill", "empty", "drain", "bar direction"] },
  // PLUGIN: "Height Offset", as the number's.
  { key: "barHeightOffset", label: "Bar Y offset", section: "Attack Bar", type: "number", min: -100, max: 100, default: 0, info: "Moves the bar up (positive) or down (negative)", keywords: ["offset", "bar height", "move up", "move down"] },
  // PLUGIN: java.awt.Color.CYAN for the first two, RED for the last.
  { key: "numberColor", label: "Number colour", section: "Colours", type: "color", default: "FF00FFFF", info: "The colour of the tick number", keywords: ["colour", "color", "text colour"] },
  { key: "lastColor", label: "Last tick colour", section: "Colours", type: "color", default: "FF00FFFF", info: "The colour of the tick number on the last tick before an attack", keywords: ["colour", "color", "last tick"] },
  { key: "lostTickColor", label: "Late tick colour", section: "Colours", type: "color", default: "FFFF0000", info: "The colour of -1, -2 when an attack is late", keywords: ["colour", "color", "late tick", "red"] },
];
export const attackTimerMetronomeStore = createPluginStore("attackTimerMetronome", attackTimerMetronomeOptions);

// Before it kept its own settings, the metronome's were the application's
// (Grid.js, kept under "osrs-yama-settings"): on, "Show Attack Bar", "Show
// Attack Cooldown Ticks" and a font size, with an offset and "above prayer
// icon" that RuneLite's plugin has no match for. Once, before the application
// next saves its settings without them (this module is loaded first), they are
// carried into the store: for a player who had it on, the bar, the number and
// its size, and no late ticks (the old metronome drew none), so that it looks
// as it did, but for the offsets and "above prayer icon" (no match) and the
// bar's place (RuneLite's); for one who had it off, only what was changed from
// what they were by default then, so that it is RuneLite's when first switched
// on.
const legacyKey = "osrs-yama-settings";
const legacyDefaults = { attackTimerMetronomeShowBar: true, attackTimerMetronomeShowTicks: false, attackTimerMetronomeFontSize: 24 };
export function carryOverLegacySettings(store = attackTimerMetronomeStore, storage = globalThis.localStorage) {
  try {
    if (!storage || storage.getItem("openscim.plugin." + store.key) !== null) return false; // its own already, or nowhere to keep any
    const app = JSON.parse(storage.getItem(legacyKey) ?? "null");
    if (typeof app?.attackTimerMetronomeEnabled !== "boolean") return false;
    const on = app.attackTimerMetronomeEnabled;
    const chosen = (key, valid) => valid(app[key]) && (on || app[key] !== legacyDefaults[key]);
    const settings = { ...store.getState().settings };
    if (chosen("attackTimerMetronomeShowBar", (v) => typeof v === "boolean")) settings.showBar = app.attackTimerMetronomeShowBar;
    if (chosen("attackTimerMetronomeShowTicks", (v) => typeof v === "boolean")) settings.showTick = app.attackTimerMetronomeShowTicks;
    // Its old size could be 8 to 72; RuneLite's is 8 to 50.
    if (chosen("attackTimerMetronomeFontSize", Number.isFinite)) settings.fontSize = Math.max(8, Math.min(50, Math.round(app.attackTimerMetronomeFontSize)));
    // The old metronome drew no late ticks: none for a player who had it on, whatever the number.
    if (on) settings.showLostTicks = false;
    const changed = Object.keys(settings).some((key) => settings[key] !== store.defaults[key]);
    if (!on && !changed) return false; // nothing of the player's to keep
    store.setSettings(settings);
    store.setEnabled(on);
    return true;
  } catch {
    return false; // not readable: the defaults
  }
}
carryOverLegacySettings();

// What the CSS of the page calls each of the plugin's fonts. "RS Regular" is
// the client's RuneScape font, and its bold the RuneScape bold.
const fontFamilies = {
  REGULAR: '"RuneScape Plain 12", sans-serif',
  BOLD: '"RuneScape Bold 12", sans-serif',
  ARIAL: "Arial, sans-serif",
  VERDANA: "Verdana, sans-serif",
};

// PLUGIN: the height of the number over the tile, in the game's units (128 a
// tile), for each position: the player's logical height and 20 more, 214, 100,
// and 10 (the text location at the feet); the height offset adds to each.
export const tickHeights = { DEFAULT: (logicalHeight) => logicalHeight + 20, TOP: () => 214, CENTERED: () => 100, BOTTOM: () => 10 };

// Whether Interface Styles draws high detail health bars: the bar's "Auto"
// follows it. Set by the application (application.js), which keeps that option.
let hdHealthBars = false;
export function setAttackTimerHdHealthBars(on) {
  hdHealthBars = on === true;
}

const ticksUntilNextAttack = ({ currentTick, nextAttackTick }) =>
  // -1: the engine has no attack scheduled yet (none was made).
  Number.isFinite(nextAttackTick) && nextAttackTick >= 0 ? nextAttackTick - currentTick : null;

/**
 * The number over the player's head: { text, textColor, fontSize, fontFamily,
 * position, heightOffset }, or null. `state`: { currentTick, nextAttackTick }.
 */
export function getAttackTimerNumber(state) {
  const { enabled, settings } = attackTimerMetronomeStore.getState();
  if (!enabled) return null;
  const ticks = ticksUntilNextAttack(state);
  if (ticks === null) return null;
  let text;
  let color;
  if (ticks > 0) {
    if (!settings.showTick) return null;
    text = String(settings.useZeroBasedTickCount ? ticks - 1 : ticks);
    color = ticks === 1 ? settings.lastColor : settings.numberColor;
  } else {
    if (!settings.showLostTicks) return null;
    const lost = 1 - ticks;
    if (lost > settings.maximumLostTicks) return null;
    text = "-" + lost;
    color = settings.lostTickColor;
  }
  return {
    text,
    textColor: toHexColor(color),
    fontSize: settings.fontSize,
    fontFamily: fontFamilies[settings.fontType] ?? fontFamilies.REGULAR,
    position: settings.ticksPosition,
    heightOffset: settings.tickHeightOffset,
  };
}

// PLUGIN: the standard bar is 30 x 5, (201, 161, 28) on black; the high detail
// one is drawn here as Interface Styles' health bar, 40 x 7 (rendering.js draws
// a timer bar of that width with those pictures when it is given none).
const solid = (color) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="30" height="5"><rect width="30" height="5" fill="${color}"/></svg>`)}`;
const standardBar = { width: 30, height: 5, frontImage: solid("#C9A11C"), backImage: solid("#000000") };
const highDetailBar = { width: 40, height: 7 };

/**
 * The bar: { ratio, width, height, frontImage?, backImage?, heightOffset }, or
 * null. `state`: { currentTick, nextAttackTick, attackSpeed }.
 */
export function getAttackTimerBar(state) {
  const { enabled, settings } = attackTimerMetronomeStore.getState();
  if (!enabled || !settings.showBar) return null;
  const ticks = ticksUntilNextAttack(state);
  // PLUGIN: shown from the attack until the tick the next one could be made (its
  // one tick of "debounce" after the cooldown), then gone.
  if (ticks === null || ticks < 0) return null;
  const period = Math.max(1, state.attackSpeed ?? 1);
  // PLUGIN: "Fills Before Attack" and "Empties Before Attack", on by default (not in the panel here).
  const numerator = ticks - 1;
  const denominator = period - 1;
  const fraction = denominator > 0 ? numerator / denominator : 0;
  const clamp = (value) => Math.max(0, Math.min(1, value));
  const hd = settings.barStyle === "HIGH_DETAIL" || (settings.barStyle === "AUTO" && hdHealthBars);
  return {
    ratio: settings.barDrains ? clamp(fraction) : clamp(1 - fraction),
    ...(hd ? highDetailBar : standardBar),
    heightOffset: settings.barHeightOffset,
  };
}
