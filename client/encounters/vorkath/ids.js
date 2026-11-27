// Vorkath's ids and her crater's tiles. The ids are the game cache's, as
// RSPSApp/tsps (server/plugins/bosses/vorkath/Shared.Vorkath.js, Combat, Specials)
// lists them from the cache and rsprox captures (61 recordings, about 500
// fights). Tiles are local to map square 35,63 (region 9023): tsps gives them
// in world coordinates, and a local tile is the world one minus (2240, 4032).
export const npcTypeIds = {
  vorkath: 8061, // CACHE, the post-quest Vorkath awake; TABLE "Vorkath" (Post-quest), 750 hitpoints, 7x7
  spawn: 8063, // CACHE, the post-quest Zombified Spawn; TABLE 38 hitpoints
};

export const seqIds = {
  idle: 7948, // CACHE: DS2_VORKATH_IDLE (7947 is DS2_VORKATH_WALK)
  wake: 7950, // CACHE, OBS (tsps): she rises, 210 cycles
  melee: 7951, // CACHE, OBS (tsps)
  breath: 7952, // CACHE, OBS (tsps): ranged, magic, every breath, and the ice
  acid: 7957, // CACHE, OBS (tsps): she channels the acid, 900 cycles
  high: 7960, // CACHE, OBS (tsps): the fireball and the spawn, thrown high
  death: 7949, // CACHE, OBS (tsps)
  spawnIdle: 7888, // CACHE: DS2_SPAWN_READY
  spawnWalk: 7887, // CACHE: DS2_SPAWN_WALK
  spawnExplode: 7890, // OBS (tsps docs/vorkath.md; REC): ds2_spawn_attack, as it explodes
  spawnLand: 7889, // OBS (REC, 10 of 10): the tick after it lands
  spawnDeath: 7891, // OBS (REC, 9 kills): 3 ticks after the hit that kills it
};

export const spotAnims = {
  rangedShot: 1477, // CACHE, OBS (tsps)
  rangedImpact: 1478,
  magicShot: 1479,
  magicImpact: 1480,
  dragonfire: 393, // the regular breath
  dragonfireImpact: 1466, // and the fireball's impact
  venomBreath: 1470,
  venomImpact: 1472,
  prayerBreath: 1471,
  prayerImpact: 1473,
  fireball: 1481,
  acid: 1483, // the acid lobbed onto a tile
  rapid: 1482, // a shot of the rapid fire
  rapidImpact: 131,
  ice: 395, // the icy breath
  frozen: 369, // the ice block on the player
  spawnThrown: 1484,
  spawnExplosion: 1460, // OBS (tsps docs/vorkath.md): watersurge_impact
};

export const acidPoolLoc = 32000; // CACHE, OBS (tsps): the acid on the floor

export const mapSquare = { x: 35, y: 63 }; // CACHE: the crater's square
export const bossSize = 7; // CACHE
// OBS (tsps): her south-west tile, in the middle of the crater.
export const bossStart = [29, 30];
// OBS (tsps): where the ice chunks set a player down, south of her.
export const playerStart = [32, 22];
// OBS (tsps): the 7 x 7 grid of 3 x 3 cells the acid is thrown on (one pool a
// cell, the middle cell none), its south-west tile, and the two edge pools a
// side, one tile outside it, on one of three tiles from 4 and from 14 along.
export const acidGrid = { origin: [22, 23], cells: 7, cellSize: 3, edgeNear: 4, edgeFar: 14, edgeSpread: 3 };

export const sameTile = (a, b) => a[0] === b[0] && a[1] === b[1];
export const underBoss = (boss, [x, y]) => x >= boss[0] && x < boss[0] + bossSize && y >= boss[1] && y < boss[1] + bossSize;
// Edge to edge, Chebyshev: 0 under her, 1 beside her (diagonally too).
export const edgeDistance = (position, size, [x, y]) =>
  Math.max(Math.max(position[0] - x, 0, x - (position[0] + size - 1)), Math.max(position[1] - y, 0, y - (position[1] + size - 1)));
// Her middle tile.
export const centreOf = (position) => [position[0] + (bossSize >> 1), position[1] + (bossSize >> 1)];
