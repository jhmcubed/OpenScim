// The replay's tick log: what happened on each tick of a recording, in a few
// words, for the list beside the replay (tickLogPanel.js). It is read from what
// every frame of a recording already keeps (assets/Grid.js, ReplayRecorder,
// recordFrame): the tick's events, the player's actions and the state after
// the tick. Nothing is recorded for it, so it works on any recording,
// a shared one too.
//
// What a tick shows, by kind (tickLogKinds): a monster's hit points going
// down or up and the player's, XP drops, the player's special attacks, the
// monsters' attacks on the player (their specials stand out), prayers turned
// on and off, gear put on and taken off, food and potions, deaths, the
// replay's markers (client/replay/markers.js: phases, waves, the player's own)
// and the game's messages.
//
// No DOM is needed to load this module and it imports no chunk.
import { getMonsterName } from "../data/monsters.js";
import { getItemName } from "../data/equipment.js";
import { getConsumableDefinition } from "../engine/consumables.js";
import { createPluginStore } from "../plugins/pluginStore.js";

// In the order a tick lists them: what changes the fight first.
export const tickLogKinds = [
  { key: "marker", label: "Markers", info: "Phases, waves, the end of the fight and your own markers" },
  { key: "death", label: "Deaths", info: "Monsters that die, and you" },
  { key: "attack", label: "Attacks", info: "The monsters' attacks on you; their special attacks stand out" },
  { key: "taken", label: "Taken", info: "Hits on you, blocked or not, and poison, venom and bleeding" },
  { key: "special", label: "Specials", info: "Your special attacks" },
  { key: "hit", label: "Hits", info: "Hits on the monsters, and their healing" },
  { key: "xp", label: "XP", info: "XP drops" },
  { key: "prayer", label: "Prayer", info: "Prayers turned on and off" },
  { key: "gear", label: "Gear", info: "Gear put on and taken off" },
  { key: "supply", label: "Supplies", info: "Food and potions" },
  { key: "message", label: "Messages", info: "The game's messages" },
];
const kindOrder = new Map(tickLogKinds.map(({ key }, index) => [key, index]));

// Whether the log is open, and the kinds it shows. Kept as the plugins keep
// their settings (localStorage); there is no switch beside the panel's own.
export const tickLogStore = createPluginStore("replayTickLog", [
  { key: "open", label: "Open", section: null, type: "boolean", default: true, info: "The tick log is shown beside the replay" },
  ...tickLogKinds.map(({ key, label, info }) => ({ key, label, section: null, type: "boolean", default: true, info })),
]);

// --- names ---------------------------------------------------------------------

const capitalize = (text) => (text ? text[0].toUpperCase() + text.slice(1) : text);
/** "doom-larva", "inferno_pillar" as "Doom larva", "Inferno pillar". */
const fromId = (id) => capitalize(String(id).replace(/[-_]+/g, " ").replace(/\s+\d+$/, "").trim().toLowerCase());

// The game's names of the prayers the engine keeps by key.
const prayerNames = {
  ProtectMelee: "Protect from Melee",
  ProtectRange: "Protect from Missiles",
  ProtectMagic: "Protect from Magic",
  EagleEye: "Eagle Eye",
  MysticMight: "Mystic Might",
  RapidHeal: "Rapid Heal",
  RapidRestore: "Rapid Restore",
};
/** "ProtectMagic", "Rigour" as "Protect from Magic", "Rigour". */
export const prayerName = (key) => prayerNames[key] ?? String(key).replace(/([a-z])([A-Z])/g, "$1 $2");

/**
 * Who and what a recording names: the actors by their id, from the state of
 * the frames (an NPC's type, else its id), the items by their id
 * (`itemName(id)` gives the game cache's name where there is one; else the
 * client's table of equipment). Names are kept once found: an NPC that died
 * is no longer in the state that follows.
 */
export function createNames(itemName = () => null) {
  const actors = new Map([["player", "you"]]);
  const items = new Map();
  return {
    actor(id, ...frames) {
      if (actors.has(id)) return actors.get(id);
      const npc = frames.flatMap((frame) => frame?.state?.npcs ?? []).find((each) => each.id === id);
      if (!npc) return fromId(id);
      const name = getMonsterName(npc.npcTypeId) ?? fromId(npc.archetypeId ?? id);
      actors.set(id, name);
      return name;
    },
    item(id) {
      if (!items.has(id)) items.set(id, itemName(id) ?? getItemName(id, undefined, null) ?? `item ${id}`);
      return items.get(id);
    },
  };
}

// --- one tick ------------------------------------------------------------------

// The attacks every monster has; any other is one of its special attacks.
const plainStyles = new Set(["melee", "magic", "range", "ranged"]);
/** The last word of an attack's name: "araxxor_drip" as "drip", "alchemical_hydra_range" as "ranged". */
const attackStyle = (attack) => {
  const word = String(attack).split("_").at(-1);
  return word === "range" ? "ranged" : word;
};
const sumXp = (skills) => skills.reduce((total, { amount }) => total + amount, 0);
const splatWords = { poison: "poison", venom: "venom", bleed: "bleeding", burn: "burn" };

/**
 * What happened on the tick of `frame`, `previous` being the frame before
 * (null for the first): [{ kind, text, amount?, splat?, target?, note?,
 * tone?, special? }]. A hit is its `amount` and `splat` (the hitsplat's type)
 * "on" its `target`; its `note` says what kind of hit, or whether the prayer
 * was right (`tone` "good" or "bad"). `sentence(entry)` says an entry in full.
 * The same line twice on a tick is one, with its `count`.
 */
export function describeFrame(frame, previous, names = createNames()) {
  const entries = [];
  const add = (kind, text, extra = {}) => entries.push({ kind, text, ...extra });
  const actor = (id) => names.actor(id, frame, previous);
  let applied = null;
  for (const event of frame.events ?? []) {
    switch (event.type) {
      case "hit_applied":
        // Its hitsplat comes next and says the same; this says whether the prayer was right.
        applied = event;
        break;
      case "hitsplat_spawned": {
        const prayed = applied?.targetId === event.targetId ? applied.prayedCorrectly : null;
        applied = null;
        const splat = event.hitsplatType;
        const hit = { amount: event.amount, splat, ...(splatWords[splat] ? { note: splatWords[splat] } : {}) };
        if (event.targetId === "player") {
          const prayer = splatWords[splat] || prayed === null || prayed === undefined ? {} : prayed ? { note: "prayed right", tone: "good" } : { note: "wrong prayer", tone: "bad" };
          add("taken", "on you", { target: "You", ...hit, ...prayer });
        } else {
          const target = capitalize(actor(event.targetId));
          add("hit", splat === "heal" ? target + " healed" : "on " + target, { target, ...hit });
        }
        break;
      }
      case "xp_drop":
        if (event.skills?.length) {
          add("xp", `+${sumXp(event.skills)} xp`, { note: event.skills.map(({ skill, amount }) => `${capitalize(skill)} ${amount}`).join(", ") });
        }
        break;
      case "attack_started":
        if (event.sourceId === "player" && event.usingSpecialAttack) {
          const weapon = event.weaponId === undefined ? "Special attack" : names.item(event.weaponId);
          add("special", `${weapon} at ${actor(event.targetId)}`);
        }
        break;
      // Every monster's attack is a "zuk_attack", the Inferno's name for it (encounters/inferno/events.js).
      case "zuk_attack":
        if (event.targetId === "player") {
          const style = attackStyle(event.attack);
          const source = capitalize(actor(event.sourceId));
          // A monster whose attack has its own name has no other ("araxyte_mirrorback" of the Mirrorback Araxyte).
          if (source.toLowerCase().includes(style)) add("attack", `${source} attacks`);
          else add("attack", `${source}: ${style}`, plainStyles.has(style) ? {} : { special: true });
        }
        break;
      case "actor_died":
        // The player's death is read from the state below.
        if (event.actorId !== "player") add("death", `${capitalize(actor(event.actorId))} died`);
        break;
      case "game_message": {
        const text = (event.segments ?? []).map((segment) => segment.text).join("").trim();
        if (text) add("message", text);
        break;
      }
    }
  }
  if (previous) {
    const state = frame.state;
    const before = previous.state;
    if (before.isAlive && state.isAlive === false) add("death", "You died", { you: true });
    if (before.encounterOutcome?.phase !== "victory" && state.encounterOutcome?.phase === "victory") add("marker", "Fight won");
    describePrayers(before.prayerState?.activePrayers, state.prayerState?.activePrayers, add);
    describeGear(before.playerEquipment, state.playerEquipment, names, add);
    for (const action of frame.actions ?? []) {
      if (action.type !== "itemAction") continue;
      const itemId = before.inventory?.[action.inventoryIndex]?.id;
      const track = itemId === undefined ? undefined : getConsumableDefinition(itemId)?.track;
      if (track) add("supply", `${track === "potion" ? "Drank" : "Ate"} ${names.item(itemId)}`);
    }
  }
  return foldRepeats(entries).sort((a, b) => kindOrder.get(a.kind) - kindOrder.get(b.kind));
}

function describePrayers(was = [], is = [], add) {
  const on = is.filter((key) => !was.includes(key)).map(prayerName);
  const off = was.filter((key) => !is.includes(key)).map(prayerName);
  if (on.length === 0 && off.length === 0) return;
  add("prayer", [on.length ? on.join(", ") + " on" : "", off.length ? off.join(", ") + " off" : ""].filter(Boolean).join("; "));
}

function describeGear(was, is, names, add) {
  if (!was || !is) return;
  const slots = [...new Set([...Object.keys(was), ...Object.keys(is)])];
  const on = slots.filter((slot) => is[slot] != null && is[slot] !== was[slot]).map((slot) => names.item(is[slot]));
  const off = slots.filter((slot) => was[slot] != null && is[slot] == null).map((slot) => names.item(was[slot]));
  if (on.length === 0 && off.length === 0) return;
  add("gear", [on.length ? "Put on " + on.join(", ") : "", off.length ? "took off " + off.join(", ") : ""].filter(Boolean).join("; ").replace(/^t/, "T"));
}

function foldRepeats(entries) {
  const folded = [];
  for (const entry of entries) {
    const same = folded.find((other) => other.kind === entry.kind && other.text === entry.text && other.amount === entry.amount && other.splat === entry.splat && other.note === entry.note);
    if (same) same.count = (same.count ?? 1) + 1;
    else folded.push(entry);
  }
  return folded;
}

/** An entry in full words: "Araxxor took 24 (venom)", "You took 0 (prayed right)", "+106 xp (Strength 80, Hitpoints 26)". */
export function sentence(entry) {
  const what = entry.amount === undefined ? entry.text : `${entry.target} ${entry.splat === "heal" ? "healed" : "took"} ${entry.amount}`;
  return what + (entry.special ? " (special)" : "") + (entry.note ? ` (${entry.note})` : "") + (entry.count > 1 ? ` x${entry.count}` : "");
}

// --- a recording --------------------------------------------------------------

/**
 * The log of a recording, kept between calls: `rows(frames, markers)` returns
 * [{ frameIndex, tick, entries }] for the frames something happened on, in
 * their order. A frame is described once (by its state, which outlives the
 * frame that holds it); a recording is a list of frames that a run that goes
 * another way shares up to where it does. `markers` are the replay's
 * ({ frameIndex, label }: the encounter's, or null for the player's own).
 */
export function createTickLog({ itemName } = {}) {
  const names = createNames(itemName);
  const described = new WeakMap();
  const describe = (frame, previous) => {
    const key = frame.state;
    if (!described.has(key)) described.set(key, describeFrame(frame, previous, names));
    return described.get(key);
  };
  return {
    rows(frames, markers = []) {
      const markersAt = new Map();
      for (const marker of markers) {
        const list = markersAt.get(marker.frameIndex) ?? [];
        list.push({ kind: "marker", text: marker.label ?? "Your marker", ...(marker.label === null ? { own: true } : {}) });
        markersAt.set(marker.frameIndex, list);
      }
      const rows = [];
      frames.forEach((frame, frameIndex) => {
        const described = describe(frame, frames[frameIndex - 1] ?? null);
        const entries = markersAt.has(frameIndex) ? [...markersAt.get(frameIndex), ...described] : described;
        if (entries.length > 0) rows.push({ frameIndex, tick: frame.state.currentTick, entries });
      });
      return rows;
    },
  };
}

// One log for each way of naming items: the list and the strip over the slider (traceStrip.js) describe a frame once.
const sharedLogs = new WeakMap();
const sharedDefault = {};
/** The log `createTickLog({ itemName })` makes, the same one for the same `itemName`. */
export function sharedTickLog(itemName) {
  const key = itemName ?? sharedDefault;
  if (!sharedLogs.has(key)) sharedLogs.set(key, createTickLog({ itemName }));
  return sharedLogs.get(key);
}

/** The row the playhead is on or last passed, by its index in `rows`; -1 before the first. */
export function rowAtFrame(rows, frameIndex) {
  let low = 0;
  let high = rows.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (rows[middle].frameIndex <= frameIndex) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
}

/** The log as text, a line a tick: "tick 47: Araxxor: drip; You took 23 (wrong prayer)". */
export const tickLogText = (rows, shown = () => true) =>
  rows
    .map(({ tick, entries }) => [tick, entries.filter((entry) => shown(entry.kind))])
    .filter(([, entries]) => entries.length > 0)
    .map(([tick, entries]) => `tick ${tick}: ${entries.map(sentence).join("; ")}`)
    .join("\n");
