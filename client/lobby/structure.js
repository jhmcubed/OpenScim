// A building lifted whole out of a map square of the game and set down in
// the lobby: every object of an area of that square, on every level, standing
// on that square's own ground, then scaled and turned into place. The objects
// are read from the cache when the lobby loads (the renderer hands over its
// loader of map squares), so nothing of the game is written here but where to
// look.
//
// `mapSquare`   [x, y] of the square, as the cache names it
// `area`        { minX, minY, maxX, maxY } in that square's own tiles, inclusive
// `keep(loc)`   which of the objects there belong to the building (by default all)
// `ground`      [x, y] of a tile of the square whose height becomes the lobby's floor
// `from`        [x, y] the point of the square that is set down on `to`
// `to`          [x, y] where it goes, in the gateway's layout (lobby/gateway.js)
// `scale`       how large it is drawn: 1 is the game's own size
// `degrees`     how far it is turned anticlockwise, after the gateway's own turn
export function lobbyStructure({ mapSquare, area, keep = () => true, ground, from, to, scale = 1, degrees = 0 }) {
  // The ground of the square, raised or lowered so that `ground` lies at the
  // height of the lobby's floor: heights are the game's (128 to a tile, upward
  // negative).
  function planesOf(terrain, lobbyHeight) {
    const heights = terrain?.tileHeights;
    if (!heights) return null;
    const base = heights[0]?.[ground[0]]?.[ground[1]] ?? 0;
    return heights.map((plane) => plane.map((column) => column.map((height) => height - base + lobbyHeight)));
  }

  /**
   * The objects, ready for the renderer's object loader, or [] when the
   * square cannot be read. `loadMapSquare(x, y)` resolves to { terrain,
   * locations } (the cache manager's own); `lobbyHeight` is the height of the
   * lobby's floor, in the game's units.
   */
  async function locs(loadMapSquare, lobbyHeight) {
    const square = await loadMapSquare(...mapSquare);
    const planes = planesOf(square?.terrain, lobbyHeight);
    if (!square?.locations || !planes) return [];
    return square.locations
      .filter(({ location, locType }) =>
        locType && location.localX >= area.minX && location.localX <= area.maxX &&
        location.localY >= area.minY && location.localY <= area.maxY && keep(location, locType))
      .map(({ location, locType }) => ({
        location: { ...location },
        locType,
        mapSquareOffset: { x: 0, y: 0 },
        terrainContextOrigin: { x: 0, y: 0 },
        terrainHeightPlanes: planes,
      }));
  }

  /**
   * The matrix that carries the building from its square to its place in the
   * layout: column-major, like the renderer's. `floorZ` is the height of the
   * lobby's floor in tiles, about which it is scaled.
   */
  function matrix(floorZ) {
    const turn = (degrees * Math.PI) / 180;
    const cos = Math.cos(turn) * scale, sin = Math.sin(turn) * scale;
    // x' = to + R S (x - from); z' = floor + S (z - floor)
    const tx = to[0] - (cos * from[0] - sin * from[1]);
    const ty = to[1] - (sin * from[0] + cos * from[1]);
    const tz = floorZ - scale * floorZ;
    return new Float32Array([cos, sin, 0, 0, -sin, cos, 0, 0, 0, 0, scale, 0, tx, ty, tz, 1]);
  }

  return { locs, matrix, scale };
}

// The product of two column-major 4 x 4 matrices, a times b.
export function multiply(a, b) {
  const out = new Float32Array(16);
  for (let column = 0; column < 4; column++)
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[column * 4 + k];
      out[column * 4 + row] = sum;
    }
  return out;
}
