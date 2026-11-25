// Shapes of the Leviathan's fight, all around the middle of its 7 x 7: the
// sectors of its lightning, the line its smoke is sheltered from by, and the
// eight ways its tornado heads. No state and no randomness.
//
// OBS 11/25 is as in encounter.js (the awakened fight); every rule here gives
// each recorded case.
export const centre = [33, 36]; // the middle of its 7 x 7

// The lightning strikes one of 20 sectors of 18 degrees, counted counter-
// clockwise from the east, and hits every tile of it at once.
export const sectorCount = 20;
export function sectorOf([x, y]) {
  const degrees = (Math.atan2(y - centre[1], x - centre[0]) * 180) / Math.PI;
  return Math.floor((degrees < 0 ? degrees + 360 : degrees) / (360 / sectorCount)) % sectorCount;
}
// OBS 11/25: from one strike to the next it turns at most one sector, the
// shorter way (782 of 782 turns).
export function turnSector(from, to) {
  const turn = ((to - from + sectorCount + sectorCount / 2) % sectorCount) - sectorCount / 2;
  return (from + Math.sign(turn) + sectorCount) % sectorCount;
}
// OBS 11/25: the tiles of each sector's strike (805 strikes, 20 shapes, each
// always the same), as runs [y, from x, to x]. They are drawn 2 cycles later
// for each ring out from the middle.
const sectorRuns = [
  [[36, 33, 42], [37, 37, 44], [38, 40, 43]], // 0 to 18 degrees
  [[36, 33, 33], [37, 35, 36], [38, 36, 39], [39, 38, 43], [40, 39, 43], [41, 40, 42], [42, 42, 42]], // 18 to 36 degrees
  [[36, 33, 33], [37, 34, 34], [38, 35, 35], [39, 36, 37], [40, 36, 38], [41, 37, 39], [42, 38, 41], [43, 39, 42], [44, 39, 42], [45, 40, 42]], // 36 to 54 degrees
  [[36, 33, 33], [38, 34, 34], [39, 34, 35], [40, 35, 35], [41, 35, 36], [42, 35, 37], [43, 36, 38], [44, 36, 38], [45, 36, 39], [46, 36, 40], [47, 36, 38]], // 54 to 72 degrees
  [[38, 33, 33], [39, 33, 33], [40, 33, 34], [41, 33, 34], [42, 33, 34], [43, 33, 35], [44, 33, 35], [45, 33, 35], [46, 35, 35]], // 72 to 90 degrees
  [[36, 33, 33], [37, 33, 33], [38, 33, 33], [39, 33, 33], [40, 32, 33], [41, 32, 33], [42, 32, 33], [43, 31, 33], [44, 31, 33], [45, 31, 33]], // 90 to 108 degrees
  [[36, 33, 33], [38, 32, 32], [39, 31, 32], [40, 31, 31], [41, 30, 31], [42, 29, 31], [43, 28, 30], [44, 28, 30], [45, 27, 30], [46, 27, 29]], // 108 to 126 degrees
  [[36, 33, 33], [37, 32, 32], [38, 31, 31], [39, 29, 30], [40, 28, 30], [41, 27, 29], [42, 25, 28], [43, 24, 27], [44, 24, 27], [45, 24, 26]], // 126 to 144 degrees
  [[36, 33, 33], [37, 30, 31], [38, 27, 30], [39, 23, 28], [40, 23, 27], [41, 23, 26], [42, 24, 24]], // 144 to 162 degrees
  [[36, 22, 33], [37, 23, 29], [38, 23, 26]], // 162 to 180 degrees
  [[33, 23, 23], [34, 22, 26], [35, 22, 29], [36, 24, 33]], // 180 to 198 degrees
  [[30, 24, 24], [31, 23, 26], [32, 23, 27], [33, 24, 28], [34, 27, 30], [35, 30, 31], [36, 33, 33]], // 198 to 216 degrees
  [[27, 24, 26], [28, 24, 27], [29, 24, 27], [30, 25, 28], [31, 27, 29], [32, 28, 30], [33, 29, 30], [34, 31, 31], [35, 32, 32], [36, 33, 33]], // 216 to 234 degrees
  [[26, 28, 30], [27, 27, 30], [28, 28, 30], [29, 28, 30], [30, 29, 31], [31, 30, 31], [32, 31, 31], [33, 31, 32], [34, 32, 32], [36, 33, 33]], // 234 to 252 degrees
  [[26, 31, 33], [27, 31, 33], [28, 31, 33], [29, 31, 33], [30, 32, 33], [31, 32, 33], [32, 32, 33], [33, 33, 33], [34, 33, 33], [35, 33, 33], [36, 33, 33]], // 252 to 270 degrees
  [[27, 33, 35], [28, 33, 35], [29, 33, 35], [30, 33, 34], [31, 33, 34], [32, 33, 34], [33, 33, 33], [34, 33, 33], [35, 33, 33], [36, 33, 33]], // 270 to 288 degrees
  [[27, 36, 39], [28, 36, 38], [29, 36, 38], [30, 35, 37], [31, 35, 36], [32, 35, 35], [33, 34, 35], [34, 34, 34], [36, 33, 33]], // 288 to 306 degrees
  [[27, 40, 42], [28, 39, 42], [29, 39, 42], [30, 38, 41], [31, 37, 39], [32, 36, 38], [33, 36, 37], [34, 35, 35], [35, 34, 34], [36, 33, 33]], // 306 to 324 degrees
  [[30, 42, 42], [31, 40, 42], [32, 39, 42], [33, 38, 44], [34, 36, 39], [35, 35, 36]], // 324 to 342 degrees
  [[34, 40, 44], [35, 37, 44], [36, 34, 44]], // 342 to 360 degrees
];
export const lightningSectors = sectorRuns.map((runs) => runs.flatMap(([y, from, to]) => Array.from({ length: to - from + 1 }, (_, n) => [from + n, y])));
export const ring = ([x, y]) => Math.max(Math.abs(x - centre[0]), Math.abs(y - centre[1]));

// The way of eight nearest to a step of (dx, dy), as a unit step. OBS 11/25:
// the tornado's 796 steps and the 5,976 pieces of the smoke's wave: straight
// up to a slope of one half, diagonal past it, and at one half itself straight
// or diagonal by the quarter.
export function heading(dx, dy) {
  const [across, up] = [Math.abs(dx), Math.abs(dy)];
  const [less, more] = [Math.min(across, up), Math.max(across, up)];
  if (more === 0) return [0, 0];
  const diagonal = less * 2 === more ? (across > up ? dx * dy < 0 : dx * dy > 0) : less * 2 > more;
  if (diagonal) return [Math.sign(dx), Math.sign(dy)];
  return across > up ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
}

// Whether a rock stands on the line from the middle of it to a tile, the game's
// line of sight, its ends left out. OBS 11/25: the tiles the smoke's wave
// leaves out, 21 blasts (6,405 of 6,405 tiles).
export function isSheltered([tx, ty], isRock) {
  const [cx, cy] = centre;
  const dx = tx - cx, dy = ty - cy;
  const alongX = Math.abs(dx) > Math.abs(dy);
  const length = Math.max(Math.abs(dx), Math.abs(dy));
  if (length === 0) return false;
  const [major, minor] = alongX ? [dx, dy] : [dy, dx];
  const slope = Math.trunc((minor * 65536) / length); // 16.16 fixed point
  let fraction = (alongX ? cy : cx) * 65536 + 0x8000 - (minor < 0 ? 1 : 0);
  let at = alongX ? cx : cy;
  const blocked = (across, other) => {
    const [x, y] = alongX ? [across, other] : [other, across];
    return !(x === tx && y === ty) && !(x === cx && y === cy) && isRock([x, y]);
  };
  for (let n = 0; n < length; n++) {
    at += Math.sign(major);
    const other = fraction >> 16;
    if (blocked(at, other)) return true;
    fraction += slope;
    if (fraction >> 16 !== other && blocked(at, fraction >> 16)) return true;
  }
  return false;
}
