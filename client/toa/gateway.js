// The Tombs of Amascut gateway in the lobby: a stone causeway, drifted with
// sand, that leaves the platform along one of its spokes and runs to the foot
// of the pyramid of
// Necropolis, where the raid is entered. The pyramid is the game's own, lifted
// whole from its map square (lobby/structure.js), drawn at half its size and
// turned so that the ramp up its north-west corner, which leads to its
// doorway, comes down towards the platform.
import { nexusKind } from "./nexus.js";
import { toaMesh, toaShaderModes } from "./shader.js";
import { box, centerX, lobbyGateway, rimY } from "../lobby/gateway.js";
import { spokeDegreesOf } from "../lobby/hall.js";
import { lobbyStructure } from "../lobby/structure.js";

// Where the gateway stands: the direction of its spoke, in degrees
// anticlockwise from east. The hall (lobby/hall.js) says which: the raids
// stand at the head of its horseshoe, due north.
const spokeDegrees = spokeDegreesOf("toa");

// Laid out as if the spoke pointed north (see lobby/gateway.js). `door` is the
// foot of the pyramid's ramp: a click there, or on the row in front of it,
// enters the raid.
const door = { x: 28, y: 46, width: 7, depth: 3 };
const walkway = { minX: 29, maxX: 33, minY: 39 };

// The pyramid: map square 52,42 (Necropolis), whose objects 44283 to 44459
// and 44474 to 44544 above them are the pyramid, its base and its ramp; the
// square's own town is left out.
// The foot of the ramp is the square's tile (19, 34); the pyramid's middle
// is (36.5, 17.5). Turned 135 degrees, the ramp points down the spoke.
const pyramidScale = 0.5;
const rampFoot = [19.5, 34.5];
const pyramidMiddle = [36.5, 17.5];
const pyramidTurn = 135;
const pyramid = lobbyStructure({
  mapSquare: [52, 42],
  area: { minX: 16, minY: 0, maxX: 57, maxY: 36 },
  keep: (location) => location.id >= 44283 && location.id <= 44544,
  ground: [37, 38],
  from: rampFoot,
  to: [centerX, door.y + 0.5],
  scale: pyramidScale,
  degrees: pyramidTurn,
});

const { fromLayout, toLayout, turnMatrix, tilesIn, turnGatewayObject, structureLocs } = lobbyGateway(spokeDegrees, []);
export { turnGatewayObject };
export const gatewayLocs = (loader, context) => structureLocs(pyramid, context);

// Where a point of the pyramid's square lies in the layout.
const pyramidPoint = ([x, y]) => {
  const turn = (pyramidTurn * Math.PI) / 180, dx = (x - rampFoot[0]) * pyramidScale, dy = (y - rampFoot[1]) * pyramidScale;
  return [centerX + dx * Math.cos(turn) - dy * Math.sin(turn), door.y + 0.5 + dx * Math.sin(turn) + dy * Math.cos(turn)];
};
const apex = pyramidPoint(pyramidMiddle);
// How high the apex stands over the floor, in tiles, at the pyramid's scale (OBS, from the lobby).
const apexHeight = 8;

// Where the lobby writes the gateway's name: above the middle of the door.
export const gatewayAnchor = { position: fromLayout(...apex), height: apexHeight + 1 };
const doorTiles = tilesIn(door.x, door.y, door.x + door.width, door.y + door.depth);

// A click on the door or on the row in front of it enters the nexus.
export const gatewayPortals = tilesIn(door.x, door.y - 1, door.x + door.width, door.y + door.depth).map(
  (position) => ({ position, encounterKind: nexusKind, displayName: "Tombs of Amascut" }),
);

// Adds the walkway to the lobby's walkable tiles and blocks the door.
export function extendLobbyArena(walkable, block) {
  for (const [x, y] of tilesIn(walkway.minX, walkway.minY, walkway.maxX + 1, door.y)) walkable.add(x + "," + y);
  for (const [x, y] of doorTiles) block(x + 0.5, y + 0.5);
}

// The floor: a stone causeway from the rim to the foot of the pyramid's ramp,
// widening into a landing there. The lobby lays it with its own floor, as it
// does the other gateways' (lobby/hallScene.js), with walls down its sides.
const causewayHalfWidth = 2.6, landingHalfWidth = 4.6;
const landingStart = door.y - 1.6, landingEnd = door.y + door.depth + 0.6;
export function gatewayFloor(lobbyX, lobbyY) {
  const [x, y] = toLayout(lobbyX, lobbyY);
  const onCauseway = Math.abs(x - centerX) <= causewayHalfWidth && y >= rimY - 1 && y <= landingEnd;
  const onLanding = Math.abs(x - centerX) <= landingHalfWidth && y >= landingStart && y <= landingEnd;
  return onCauseway || onLanding;
}

// The sand: blown along the middle of the causeway and drifted against the
// foot of the pyramid, with a little carried onto the platform. It thins out
// towards its edges, where the stone shows through.
const side = 0.9, apron = 2.6, apronStart = door.y - 1.2, apronEnd = door.y + door.depth + 0.4;

// How much sand lies at a laid-out point, 0 to 1. Ripples across the
// causeway break its edges into drifts.
function sandAt(x, y) {
  const distance = Math.min(
    box(x, y, centerX, (rimY + apronStart) / 2, side, (apronStart - rimY) / 2 + 0.3),
    box(x, y, centerX, (apronStart + apronEnd) / 2, apron, (apronEnd - apronStart) / 2 - 0.2),
    Math.hypot(x - centerX, (y - rimY) * 1.5) - 1.4,
  );
  const ripple = 0.8 + 0.2 * Math.sin(x * 2.3 + y * 0.9) * Math.sin(y * 1.3 - x * 0.4);
  return Math.min(0.7, Math.max(0, (0.4 - distance / 1.5) * ripple));
}

// The lobby leaves its fallen columns off the sand. Takes a lobby position.
export const gatewayCovers = (x, y) => gatewayFloor(x, y) || sandAt(...toLayout(x, y)) > 0.15;

// `hsl(h, s, l)` packs a colour the way the renderer expects; `baseZ` is the
// height of the lobby floor.
export function gatewayMeshes({ baseZ, hsl }) {
  const surface = baseZ + 0.065;
  // The pale sand of the pyramid's own base, under the moon.
  const sandColour = hsl(30, 96, 150);
  const gold = hsl(32, 224, 150);
  const part = (name, zIndex, depth, animParams) =>
    toaMesh("toa-gateway-" + name, zIndex, depth, animParams, turnMatrix);

  const step = 0.5;
  const sand = part("sand", 2, "readwrite", [toaShaderModes.sand, centerX, door.y, 8]);
  const minX = centerX - 6.5, maxX = centerX + 6.5, minY = rimY - 4.5, maxY = apronEnd + 1.5;
  const columns = Math.round((maxX - minX) / step), rows = Math.round((maxY - minY) / step);
  const at = [];
  for (let row = 0; row <= rows; row++)
    for (let column = 0; column <= columns; column++) {
      const x = minX + column * step, y = minY + row * step;
      at.push(sand.vertex(x, y, surface, sandColour, sandAt(x, y)));
    }
  for (let row = 0; row < rows; row++)
    for (let column = 0; column < columns; column++) {
      const a = row * (columns + 1) + column, b = a + columns + 1;
      if (sandAt(minX + (column + 0.5) * step, minY + (row + 0.5) * step) > 0)
        sand.quad(at[a], at[a + 1], at[b + 1], at[b]);
    }

  // A beam of light from the pyramid's apex, like the ones over the lobby's
  // other gateways.
  const radius = 1.2;
  const shaft = part("shaft", 8, "read", [toaShaderModes.shaft, 0, 0, 0]);
  shaft.sheet([apex[0] - radius, apex[1]], [apex[0] + radius, apex[1]], baseZ + apexHeight, 20, gold, 0.6, 0);
  shaft.sheet([apex[0], apex[1] - radius], [apex[0], apex[1] + radius], baseZ + apexHeight, 20, gold, 0.6, 0);

  return [sand, shaft].map((mesh) => mesh.command());
}
