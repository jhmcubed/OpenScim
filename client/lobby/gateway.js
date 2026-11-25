// What the lobby's gateways share. A gateway is scenery on a causeway that
// leaves the platform along one of its spokes. It is laid out as if the spoke
// pointed north, on whole tiles, and is then turned about the platform's
// centre to the spoke: game objects only rotate in quarter turns, so the turn
// is applied to their meshes when they are drawn.

import { multiply } from "./structure.js";

// The lobby floor is a disc of this radius around this point.
export const platform = { x: 31.5, y: 25.5, radius: 16.5 };
// In a layout the spoke runs up the line x = centerX and leaves the platform at y = rimY.
export const centerX = platform.x;
export const rimY = platform.y + platform.radius;

// Distance to a box with centre (cx, cy) and half sizes (hx, hy); negative inside.
export const box = (x, y, cx, cy, hx, hy) => {
  const dx = Math.abs(x - cx) - hx, dy = Math.abs(y - cy) - hy;
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0);
};

// `spokeDegrees` is the direction of the spoke, anticlockwise from east: 90 is
// north, behind Yama; Yama's neighbours stand at 31 and 149.
// `placements` lists the objects: [object id, x, y, rotation, type]. Type 10
// is a scenery object (the default), 22 a floor decoration.
export function lobbyGateway(spokeDegrees, placements) {
  const turn = ((spokeDegrees - 90) * Math.PI) / 180;
  const cos = Math.cos(turn), sin = Math.sin(turn);
  // The lobby tile position of a laid-out point, and the reverse.
  const fromLayout = (x, y) => [
    platform.x + (x - platform.x) * cos - (y - platform.y) * sin,
    platform.y + (x - platform.x) * sin + (y - platform.y) * cos,
  ];
  const toLayout = (x, y) => [
    platform.x + (x - platform.x) * cos + (y - platform.y) * sin,
    platform.y - (x - platform.x) * sin + (y - platform.y) * cos,
  ];
  // The same turn as a model matrix (column-major, like the renderer's own).
  const [originX, originY] = fromLayout(0, 0);
  const turnMatrix = new Float32Array([cos, sin, 0, 0, -sin, cos, 0, 0, 0, 0, 1, 0, originX, originY, 0, 1]);

  // Lobby tiles whose centre lies in a laid-out rectangle.
  function tilesIn(minX, minY, maxX, maxY) {
    const tiles = [];
    for (let x = 0; x < 64; x++)
      for (let y = 0; y < 64; y++) {
        const [u, v] = toLayout(x + 0.5, y + 0.5);
        if (u >= minX && u < maxX && v >= minY && v < maxY) tiles.push([x, y]);
      }
    return tiles;
  }

  // The height of the lobby's floor, in the game's units (128 to a tile,
  // upward negative), as the lobby itself takes it: the mean of the corners of
  // the platform's middle.
  const floorHeight = (terrainHeights) => {
    const at = (x, y) => terrainHeights?.[x]?.[y] ?? 0;
    return (at(31, 25) + at(33, 25) + at(33, 27) + at(31, 27)) / 4;
  };

  const gatewayLocs = (loader) =>
    placements.flatMap(([id, localX, localY, rotation, type = 10]) => {
      const locType = loader.loadLocType(id);
      if (!locType) return [];
      return [{
        location: { id, localX, localY, level: 0, type, rotation },
        locType,
        mapSquareOffset: { x: 0, y: 0 },
        terrainContextOrigin: { x: 0, y: 0 },
        // No heights by level: the lobby is flat. Objects that share their
        // lighting with their neighbours look this up.
        terrainHeightPlanes: [],
      }];
    });

  // Turns one of the gateway's object meshes from the layout to the spoke.
  // A gateway whose objects are a building lifted from another map square
  // (lobby/structure.js) first carries them into the layout: `placeObjects`
  // takes the matrix that does.
  let objectMatrix = turnMatrix;
  const placeObjects = (layoutMatrix) => {
    objectMatrix = multiply(turnMatrix, layoutMatrix);
  };
  const turned = new WeakSet();
  function turnGatewayObject(command) {
    if (turned.has(command)) return;
    turned.add(command);
    const m = command.modelMatrix;
    if (!m) {
      command.modelMatrix = objectMatrix;
      return;
    }
    command.modelMatrix = multiply(objectMatrix, m);
  }

  // The objects of a building lifted from a map square (lobby/structure.js),
  // carried into the layout. `context` is what the lobby hands every gateway
  // (gateways.js, loadGatewayObjects).
  async function structureLocs(structure, { terrainHeights, loadMapSquare }) {
    if (!loadMapSquare) return [];
    const height = floorHeight(terrainHeights);
    placeObjects(structure.matrix(-height / 128));
    return structure.locs(loadMapSquare, height);
  }

  return { fromLayout, toLayout, turnMatrix, tilesIn, gatewayLocs, turnGatewayObject, structureLocs };
}
