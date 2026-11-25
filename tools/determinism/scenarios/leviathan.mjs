// The Leviathan (client/encounters/leviathan/), post-quest and awakened. It lies at 30,33 (7 x 7) in
// the pool, which is blocked from 29,32 to 37,40 but for its corners; the
// player starts at 24,34, west of it. The snapshot tells the orbs on their way
// (`orbs`, each with its style and the tick it lands) and the rocks on theirs
// (`falling`), which is what a player watches for.
import { isSheltered } from "../../../client/encounters/leviathan/geometry.js";
import { attack, castOn, protect, rangedGear, setBossHp } from "./common.mjs";

const KIND = "leviathan";
const AWAKENED = "leviathan_awakened";
const BOSS = "leviathan";
const prayerFor = { magic: "ProtectMagic", range: "ProtectRange", melee: "ProtectMelee" };
const rune = { air: 556, death: 560, blood: 565, soul: 566 };
const shadowRunes = { spellbook: "ancient", runePouch: { kind: "divine", slots: [{ id: rune.blood }, { id: rune.death }, { id: rune.soul }] } };

const state = (api) => api.engine.getEncounterSnapshot().state;
const at = (tile, [x, y]) => tile[0] === x && tile[1] === y;

// The protection prayer for the orb that lands this tick (the prayer counts as
// it lands), set before the tick; if none lands, the one for the next orb.
function prayAgainstOrbs(api, tick) {
  const orbs = [...state(api).orbs].sort((a, b) => a.lands - b.lands);
  const orb = orbs.find((o) => o.lands >= tick);
  const wanted = orb && prayerFor[orb.style];
  if (wanted && api.player().activePrayer !== wanted) protect(api, wanted);
}

// Off a tile a rock will land on, to the first open tile beside it among
// these (west of the pool, clear of its edge).
function dodgeRocks(api, spots) {
  const { falling, rubble } = state(api);
  const position = api.player().position;
  if (!falling.some(({ tile }) => at(tile, position))) return false;
  const taken = (tile) => falling.some((rock) => at(rock.tile, tile)) || rubble.some((rock) => at(rock, tile));
  const spot = spots.find((tile) => !taken(tile) && Math.max(Math.abs(tile[0] - position[0]), Math.abs(tile[1] - position[1])) <= 2);
  if (!spot) return false;
  if (api.player().attackTarget !== null) attack(api, null);
  api.moveTo(...spot);
  return true;
}
const westSpots = [24, 25, 26].flatMap((x) => [31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41].map((y) => [x, y]));

// The 40 tiles beside the pool, clockwise from its north-west: two of them a
// tick keep ahead of the lightning.
const poolside = [
  [29, 41], [30, 41], [31, 41], [32, 41], [33, 41], [34, 41], [35, 41], [36, 41], [37, 41], [38, 40], [38, 39], [38, 38], [38, 37], [38, 36], [38, 35], [38, 34], [38, 33], [38, 32],
  [37, 31], [36, 31], [35, 31], [34, 31], [33, 31], [32, 31], [31, 31], [30, 31], [29, 31], [28, 32], [28, 33], [28, 34], [28, 35], [28, 36], [28, 37], [28, 38], [28, 39], [28, 40],
];
const distance = ([ax, ay], [bx, by]) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
function runRoundPool(api) {
  const at = api.player().position;
  const nearest = poolside.reduce((best, tile, n) => (distance(tile, at) < distance(poolside[best], at) ? n : best), 0);
  if (api.player().attackTarget !== null) attack(api, null);
  api.moveTo(...poolside[(nearest + (distance(poolside[nearest], at) > 0 ? 0 : 2)) % poolside.length]);
}
// Two ticks on each of five tiles of the east side as the rocks come, then
// behind what they leave, where the blast does not reach. By the ticks of the
// special gone: a rock falls on where the player stood the tick before.
function sitOutSmoke(api, gone) {
  if (api.player().attackTarget !== null) attack(api, null);
  const { rubble } = state(api);
  const isRock = (tile) => rubble.some((rock) => at(rock, tile));
  if (gone < 12) return api.moveTo(41, 28 + Math.max(0, Math.floor((gone - 2) / 2)));
  const [px, py] = api.player().position;
  const hides = [[42, 29], [42, 30], [42, 31], [42, 32], [42, 33], [43, 33], [43, 34]].filter((tile) => !isRock(tile) && (gone < 15 ? true : isSheltered(tile, isRock)));
  const hide = hides.filter((tile) => isSheltered(tile, isRock)).sort((a, b) => distance(a, [px, py]) - distance(b, [px, py]))[0] ?? hides[0];
  if (hide) api.moveTo(...hide);
}
// Stunned whenever it can be, hit from behind whenever it is stunned, its
// specials run from and sat out.
function stunLoop(tick, api, stunnedFrom) {
  const { stunnedUntil, special, enraged, orbs } = state(api);
  const [x, y] = api.player().position;
  if (special?.kind === "lightning") return runRoundPool(api);
  if (special?.kind === "smoke") return sitOutSmoke(api, tick - special.start);
  if (enraged) return;
  if (stunnedUntil === null) {
    stunnedFrom.at = [x, y];
    if (orbs.length) prayAgainstOrbs(api, tick);
    if (stunnedFrom.cast === undefined || tick - stunnedFrom.cast > 6) {
      stunnedFrom.cast = tick;
      castOn(api, BOSS, "Shadow Barrage");
    }
    return;
  }
  // Its back is the half of the arena away from where the player stood.
  const behind = (x - 33) * (stunnedFrom.at[0] - 33) + (y - 36) * (stunnedFrom.at[1] - 36) < 0;
  if (!behind) return runRoundPool(api);
  if (api.player().attackTarget !== BOSS) attack(api, BOSS);
}

export const scenarios = [
  {
    // Twisted bow from the west of the pool, praying against every orb as it
    // lands and stepping off every rock: the first five volleys, their roars and
    // rocks, and the first roar's two that tell the special.
    name: "leviathan/volleys",
    kind: KIND,
    seed: 3,
    ticks: 130,
    mechanics: { infiniteHealth: true, infinitePrayer: true },
    ...rangedGear,
    script(tick, api) {
      prayAgainstOrbs(api, tick);
      if (dodgeRocks(api, westSpots)) return;
      if (api.player().attackTarget !== BOSS) attack(api, BOSS);
    },
  },
  {
    // A shadow barrage stuns it; the player walks round to its back and shoots
    // it there, which wakes it with its first special, the smoke. Back to the
    // west, a second stun and a second shot in the back: the lightning, which
    // the player outruns by walking up and down beside the arena's wall.
    // Infinite health: what still hits lands where it may.
    name: "leviathan/stun-and-back",
    kind: KIND,
    seed: 5,
    ticks: 160,
    mechanics: { infiniteHealth: true, infinitePrayer: true },
    ...rangedGear,
    supplies: { ...rangedGear.supplies, ...shadowRunes },
    inventory: [rune.air],
    script(tick, api) {
      const { stunnedUntil, special, rubble } = state(api);
      const [x, y] = api.player().position;
      if (tick === 6 || tick === 76) castOn(api, BOSS, "Shadow Barrage");
      if (tick === 50) {
        attack(api, null);
        api.moveTo(24, 34);
      }
      // Stunned facing the player, who is west of it: its back is east of the
      // pool, as wide as the pool (x 37 on, y 32 to 40).
      if (stunnedUntil !== null && !(x >= 37 && y >= 32 && y <= 40)) {
        if (api.player().attackTarget !== null) attack(api, null);
        const free = [36, 35, 37, 34, 38].map((ty) => [39, ty]).find((tile) => !rubble.some((rock) => at(rock, tile)));
        api.moveTo(...free);
        return;
      }
      if (stunnedUntil !== null && api.player().attackTarget !== BOSS) attack(api, BOSS);
      if (special?.kind === "lightning") {
        if (api.player().attackTarget !== null) attack(api, null);
        api.moveTo(43, tick % 8 < 4 ? 34 : 38);
      }
      if (special) prayAgainstOrbs(api, tick);
    },
  },
  {
    // Into the enrage at once: the roar, orbs every 2 ticks, rocks every 8, the
    // pathfinder from the north-west going clockwise. The player keeps to its
    // middle and shoots until the Leviathan dies.
    name: "leviathan/enrage-and-kill",
    kind: KIND,
    seed: 7,
    ticks: 150,
    mechanics: { infiniteHealth: true, infinitePrayer: true },
    ...rangedGear,
    script(tick, api) {
      if (tick === 1) setBossHp(api, 260);
      prayAgainstOrbs(api, tick);
      const pathfinder = api.npcs().find((npc) => npc.id === "abyssal-pathfinder");
      if (pathfinder) {
        const middle = [pathfinder.position[0] + 1, pathfinder.position[1] + 1];
        const [px, py] = api.player().position;
        if (Math.max(Math.abs(px - middle[0]), Math.abs(py - middle[1])) > 1) {
          if (api.player().attackTarget !== null) attack(api, null);
          api.moveTo(...middle);
          return;
        }
      }
      if (api.player().attackTarget !== BOSS) attack(api, BOSS);
    },
  },
  {
    // Beside the pool: one bite early, then orbs until the third roar, then a
    // bite on some of its turns, the volleys and roars going on.
    name: "leviathan/bites",
    kind: KIND,
    seed: 9,
    ticks: 130, // past the fourth volley's roar
    mechanics: { infiniteHealth: true, infinitePrayer: true },
    ...rangedGear,
    script(tick, api) {
      if (tick === 1) api.moveTo(28, 36);
      if (tick === 1) protect(api, "ProtectMelee");
    },
  },
  {
    // Awakened, never stunned: its first volleys, a plus of rocks and the loose
    // ones at each roar, and no bite, the player beside the pool. They step off
    // the plus, out along the pool.
    name: "leviathan/awakened-volleys",
    kind: AWAKENED,
    seed: 13,
    ticks: 110,
    mechanics: { infiniteHealth: true, infinitePrayer: true },
    ...rangedGear,
    script(tick, api) {
      prayAgainstOrbs(api, tick);
      if (state(api).falling.some(({ tile }) => at(tile, api.player().position))) return runRoundPool(api);
      if (api.player().attackTarget !== BOSS) attack(api, BOSS);
    },
  },
  {
    // Awakened, stunned and hit from behind again and again: lightning run from
    // round the pool, smoke sat out behind its rocks and those of the one before.
    name: "leviathan/awakened-specials",
    kind: AWAKENED,
    seed: 5,
    ticks: 300,
    mechanics: { infiniteHealth: true, infinitePrayer: true, infiniteStamina: true },
    ...rangedGear,
    supplies: { ...rangedGear.supplies, ...shadowRunes },
    inventory: [rune.air],
    script: (() => {
      let from = {};
      return (tick, api) => {
        if (tick === 1) from = {};
        stunLoop(tick, api, from);
      };
    })(),
  },
  {
    // Awakened, at half its hitpoints: the tornado comes, the player walks round
    // the pool with it behind, then stands still until it is on them, twice.
    name: "leviathan/awakened-tornado",
    kind: AWAKENED,
    seed: 11,
    ticks: 90,
    mechanics: { infiniteHealth: true, infinitePrayer: true },
    ...rangedGear,
    script(tick, api) {
      if (tick === 1) setBossHp(api, 1360);
      prayAgainstOrbs(api, tick);
      if (tick >= 20 && tick < 45) return runRoundPool(api);
      if (api.player().attackTarget !== BOSS) attack(api, BOSS);
    },
  },
  {
    // Awakened, into the enrage by a hit from behind: the special it sets off
    // stops, the rocks and the roar, the pathfinder, an orb a tick; the player
    // keeps to the pathfinder's middle and shoots until it dies.
    name: "leviathan/awakened-enrage-and-kill",
    kind: AWAKENED,
    seed: 7,
    ticks: 220,
    mechanics: { infiniteHealth: true, infinitePrayer: true, infiniteStamina: true },
    ...rangedGear,
    supplies: { ...rangedGear.supplies, ...shadowRunes },
    inventory: [rune.air],
    script: (() => {
      let from = {};
      return (tick, api) => {
        if (tick === 1) {
          from = {};
          setBossHp(api, 545);
        }
        if (!state(api).enraged) return stunLoop(tick, api, from);
        prayAgainstOrbs(api, tick);
        const pathfinder = api.npcs().find((npc) => npc.id === "abyssal-pathfinder");
        if (pathfinder) {
          const middle = [pathfinder.position[0] + 1, pathfinder.position[1] + 1];
          if (distance(api.player().position, middle) > 1) {
            if (api.player().attackTarget !== null) attack(api, null);
            return api.moveTo(...middle);
          }
        }
        if (api.player().attackTarget !== BOSS) attack(api, BOSS);
      };
    })(),
  },
];
