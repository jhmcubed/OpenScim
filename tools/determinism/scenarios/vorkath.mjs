// Vorkath (client/encounters/vorkath/). She lies with her south-west tile at
// 29,30 (7 x 7); the player comes in at 32,22, south of her. The snapshot tells
// what a player watches for: her phase ("rising", "active", "acid", "spawn"),
// the next special, the acid on the floor, the rapid fire's and the fireballs'
// tiles and when they land, the freeze. Each script decides from it and the
// tick alone.
import { attack, castOn, protect, use, item } from "./common.mjs";

const KIND = "vorkath";
const BOSS = "vorkath";
const SPAWN = "vorkath-spawn";

const state = (api) => api.engine.getEncounterSnapshot().state;
const same = (a, b) => a[0] === b[0] && a[1] === b[1];
const has = (tiles, tile) => tiles.some((other) => same(other, tile));
const spawnAlive = (api) => api.npcs().some((npc) => npc.id === SPAWN);

// The wiki's crossbow setup (loadouts.js), with ruby bolts and a rune pouch for Crumble Undead.
const crossbow = {
  equipment: { weapon: 21012, shield: 22002, head: 23971, body: 23975, legs: 23979, hands: 7462, boots: 13237, amulet: 19547, cape: 22109, ring: 11771 },
  supplies: { equippedAmmo: { id: 21944 }, runePouch: { kind: "standard", slots: [{ id: 557 }, { id: 556 }, { id: 562 }] }, spellbook: "standard" },
  inventory: [22209, 12791], // Extended super antifire(4), rune pouch
};

// Off the fireball's tile and the one beside it, two tiles west or east.
function dodgeFireball(api, tick) {
  const position = api.player().position;
  const coming = state(api).fireballs.find((fireball) => fireball.landsAt > tick && Math.max(Math.abs(fireball.tile[0] - position[0]), Math.abs(fireball.tile[1] - position[1])) <= 1);
  if (!coming) return false;
  const step = position[0] > 24 ? -2 : 2;
  if (api.player().attackTarget !== null) attack(api, null); // with a target he walks to it, not to the tile
  api.moveTo(position[0] + step, position[1]);
  return true;
}

// In the acid: a step every tick (the rapid fire aims at the tile he stands
// on) to the nearest tile with no acid and no shot coming, south of her.
function walkAcid(api) {
  const { acidPools, rapidFire } = state(api);
  const position = api.player().position;
  const danger = [...acidPools, ...rapidFire.map((shot) => shot.tile), position];
  let best = null;
  for (let dx = -3; dx <= 3; dx++) {
    for (let dy = -2; dy <= 2; dy++) {
      const tile = [position[0] + dx, position[1] + dy];
      if (tile[0] < 23 || tile[0] > 41 || tile[1] < 22 || tile[1] > 28 || has(danger, tile)) continue;
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      if (!best || distance < best.distance) best = { tile, distance };
    }
  }
  if (!best) return;
  if (api.player().attackTarget !== null) attack(api, null); // with a target he walks to it, not to the tile
  api.moveTo(...best.tile);
}

export const scenarios = [
  {
    // The whole fight with the dragon hunter crossbow: Protect from Missiles,
    // an extended super antifire first, off every fireball, walking the acid,
    // and Crumble Undead on each spawn. Infinite health: to her death.
    name: "vorkath/crossbow-kill",
    kind: KIND,
    seed: 6,
    ticks: 900,
    mechanics: { infiniteHealth: true, infinitePrayer: true },
    ...crossbow,
    script(tick, api) {
      if (tick === 1) use(api, 0);
      // Back on after the corrupting breath switches it off (only when off: the same prayer again turns it off).
      if (!api.player().activePrayer && tick % 3 === 1) protect(api, "ProtectRange");
      if (spawnAlive(api)) {
        if (api.player().attackTarget !== SPAWN) castOn(api, SPAWN, "Crumble Undead");
        return;
      }
      if (dodgeFireball(api, tick)) return;
      if (state(api).phase === "acid") return walkAcid(api);
      if (api.player().attackTarget !== BOSS) attack(api, BOSS);
    },
  },
  {
    // The spawn left alone: frozen, the player cannot step away; it walks in
    // and explodes for its full 60. Then she is hittable again.
    name: "vorkath/spawn-explodes",
    kind: KIND,
    seed: 2,
    ticks: 140,
    mechanics: { infiniteHealth: true, infinitePrayer: true },
    ...crossbow,
    script(tick, api) {
      if (tick === 1) protect(api, "ProtectRange");
      if (state(api).frozen && tick % 3 === 0) {
        if (api.player().attackTarget !== null) attack(api, null);
        api.moveTo(32, 15); // tries to walk away, held by the freeze
        return;
      }
      if (dodgeFireball(api, tick)) return;
      if (!spawnAlive(api) && !state(api).frozen && api.player().attackTarget !== BOSS) attack(api, BOSS);
    },
  },
  {
    // Her breaths against no protection at all: no shield, no prayer, no potion.
    name: "vorkath/unprotected-dragonfire",
    kind: KIND,
    seed: 11,
    ticks: 120,
    mechanics: { infiniteHealth: true },
    equipment: { weapon: 21012 },
    supplies: { equippedAmmo: { id: 21944 } },
    script(tick, api) {
      if (dodgeFireball(api, tick)) return;
      if (api.player().attackTarget !== BOSS) attack(api, BOSS);
    },
  },
  // The snapshot of a fresh fight: she rises.
  {
    name: "vorkath/start",
    kind: KIND,
    seed: 1,
    ticks: 10,
    script() {},
  },
];
