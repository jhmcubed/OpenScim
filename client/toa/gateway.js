// The Tombs of Amascut gateway in the lobby: the pyramid of Necropolis, where
// the raid is entered, lifted whole from its map square and turned so that the
// ramp up its north-west corner, which leads to its doorway, comes down
// towards the platform (lobby/buildingGateway.js). A stone causeway drifted
// with sand runs to the foot of the ramp. A click on the pyramid lists the
// Tombs' bosses (chooser.js).
import { chooseToaBoss } from "./chooser.js";
import { toaMesh, toaShaderModes } from "./shader.js";
import { box } from "../lobby/gateway.js";
import { buildingGateway } from "../lobby/buildingGateway.js";

// The pyramid: map square 52,42 (Necropolis), whose objects 44283 to 44459
// and 44474 to 44544 above them are the pyramid, its base and its ramp; the
// square's own town is left out. The foot of the ramp is the square's tile
// (19, 34); the pyramid's middle is (36.5, 17.5).
const apex = [36.5, 17.5];
// How high the apex stands over the floor, in tiles, at the pyramid's scale (OBS, from the lobby).
const apexHeight = 8;

const gateway = buildingGateway({
  station: "toa",
  name: "Tombs of Amascut",
  open: chooseToaBoss,
  building: {
    mapSquare: [52, 42],
    area: { minX: 16, minY: 0, maxX: 57, maxY: 36 },
    keep: (location) => location.id >= 44283 && location.id <= 44544,
    ground: [37, 38],
    entrance: [19.5, 34.5],
    facing: 135,
    scale: 0.5,
    distance: 4.5,
  },
  causeway: { halfWidth: 2.6, landingHalfWidth: 4.6, landingDepth: 3.4 },
  // The pyramid in steps, narrowing as it rises.
  hits: [
    { rect: [18, 1, 56, 35], top: 2.5 },
    { rect: [23, 6, 51, 30], top: 5 },
    { rect: [28, 11, 46, 25], top: 7.5 },
    { rect: [33, 14, 40, 21], top: apexHeight + 0.5 },
  ],
  beams: [{ at: apex, z: apexHeight - 0.6, height: 22, width: 1.5, colour: [34, 200, 175], alpha: 0.55 }],
  label: { at: apex, height: apexHeight + 1.6 },
  meshes: sandMeshes,
});

export const {
  gatewayLocs, turnGatewayObject, gatewayPortals, extendLobbyArena, gatewayFloor, gatewayCovers, gatewayMeshes, gatewayHit, gatewayAnchor,
} = gateway;
export const gatewayName = gateway.name;

// The sand: blown along the middle of the causeway and drifted against the
// foot of the pyramid, with a little carried onto the platform. It thins out
// towards its edges, where the stone shows through. Ripples across the
// causeway break its edges into drifts. Takes a laid-out point; 0 to 1.
function sandAt(x, y, { foot, rimY, centerX }) {
  const side = 0.9, apron = 2.6, apronStart = foot[1] - 1.2, apronEnd = foot[1] + 1.6;
  const distance = Math.min(
    box(x, y, centerX, (rimY + apronStart) / 2, side, (apronStart - rimY) / 2 + 0.3),
    box(x, y, centerX, (apronStart + apronEnd) / 2, apron, (apronEnd - apronStart) / 2 - 0.2),
    Math.hypot(x - centerX, (y - rimY) * 1.5) - 1.4,
  );
  const ripple = 0.8 + 0.2 * Math.sin(x * 2.3 + y * 0.9) * Math.sin(y * 1.3 - x * 0.4);
  return Math.min(0.7, Math.max(0, (0.4 - distance / 1.5) * ripple));
}

function sandMeshes(context) {
  const { baseZ, hsl, foot, rimY, centerX, turnMatrix } = context;
  // The pale sand of the pyramid's own base, under the moon.
  const sandColour = hsl(30, 96, 150);
  const sand = toaMesh("toa-gateway-sand", 2, "readwrite", [toaShaderModes.sand, centerX, foot[1], 8], turnMatrix);
  const step = 0.5, surface = baseZ + 0.065;
  const minX = centerX - 6.5, maxX = centerX + 6.5, minY = rimY - 4.5, maxY = foot[1] + 3;
  const columns = Math.round((maxX - minX) / step), rows = Math.round((maxY - minY) / step);
  const amount = (x, y) => sandAt(x, y, context);
  const at = [];
  for (let row = 0; row <= rows; row++)
    for (let column = 0; column <= columns; column++) {
      const x = minX + column * step, y = minY + row * step;
      at.push(sand.vertex(x, y, surface, sandColour, amount(x, y)));
    }
  for (let row = 0; row < rows; row++)
    for (let column = 0; column < columns; column++) {
      const a = row * (columns + 1) + column, b = a + columns + 1;
      if (amount(minX + (column + 0.5) * step, minY + (row + 0.5) * step) > 0) sand.quad(at[a], at[a + 1], at[b + 1], at[b]);
    }
  return [sand.command()];
}
