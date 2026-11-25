// The Desert Treasure II gateway in the lobby: the platform's own floor
// reaches out to the Ancient Vault, the game's own, lifted whole from its map
// square (lobby/structure.js) and turned so that the steps up to its door come
// down towards the platform. The four ancient elements run along the floor
// to the foot of the steps.
import { awakenedColour, bosses } from "./bosses.js";
import { chooseBoss } from "./chooser.js";
import { dt2Mesh, dt2ShaderModes } from "./shader.js";
import { centerX, lobbyGateway, rimY } from "../lobby/gateway.js";
import { spokeDegreesOf } from "../lobby/hall.js";
import { lobbyStructure } from "../lobby/structure.js";

// Where the gateway stands: the direction of its spoke, in degrees
// anticlockwise from east. The hall (lobby/hall.js) says which: at the head of
// its horseshoe, left of the raids.
const spokeDegrees = spokeDegreesOf("dt2");

// Laid out as if the spoke pointed north (see lobby/gateway.js). `door` is the
// foot of the vault's steps: a click there, or on the row in front of it,
// opens the boss chooser.
const door = { x: 30, y: 47, width: 3, depth: 1 };
const walkway = { minX: 30, maxX: 32, minY: 39 };

// The vault: map square 54,46, whose objects 46720 to 46772, with the walls,
// door frame and floor marks about them, are the vault. It stands on a raised
// floor (level 1) that its steps climb from the west; its door (46743) is at
// the square's tile (55, 26). The foot of the steps is (43, 27.5). Turned 90
// degrees, the steps point down the spoke.
const vaultScale = 0.55;
const stepsFoot = [43, 27.5];
const vaultMiddle = [53, 27.5];
const vaultTurn = 90;
const vaultIds = new Set([85, 2745, 44066, 44235, 44236, 44237, 44238, 44239, 44240, 44772, 46763, 46866, 47353]);
const vault = lobbyStructure({
  mapSquare: [54, 46],
  area: { minX: 42, minY: 19, maxX: 62, maxY: 36 },
  keep: (location) => (location.id >= 46720 && location.id <= 46772 && location.id !== 46750) || vaultIds.has(location.id),
  ground: [43, 27],
  from: stepsFoot,
  to: [centerX, door.y - 0.5],
  scale: vaultScale,
  degrees: vaultTurn,
});

const { fromLayout, toLayout, turnMatrix, tilesIn, turnGatewayObject, structureLocs } = lobbyGateway(spokeDegrees, []);
export { turnGatewayObject };
export const gatewayLocs = (loader, context) => structureLocs(vault, context);

// Where a point of the vault's square lies in the layout.
const vaultPoint = ([x, y]) => {
  const turn = (vaultTurn * Math.PI) / 180, dx = (x - stepsFoot[0]) * vaultScale, dy = (y - stepsFoot[1]) * vaultScale;
  return [centerX + dx * Math.cos(turn) - dy * Math.sin(turn), door.y - 0.5 + dx * Math.sin(turn) + dy * Math.cos(turn)];
};
const vaultCentre = vaultPoint(vaultMiddle);
// How high the vault's roof stands over the floor, in tiles, at its scale (OBS, from the lobby).
const roofHeight = 6;

// Where the lobby writes the gateway's name: above the vault.
export const gatewayAnchor = { position: fromLayout(...vaultCentre), height: roofHeight + 1 };

// A click on the door or on the row in front of it opens the boss chooser.
export const gatewayPortals = tilesIn(door.x, door.y - 1, door.x + door.width, door.y + door.depth).map(
  (position) => ({ position, displayName: "Desert Treasure II", open: chooseBoss }),
);

// Adds the walkway to the lobby's walkable tiles and blocks the door.
export function extendLobbyArena(walkable, block) {
  for (const [x, y] of tilesIn(walkway.minX, walkway.minY, walkway.maxX + 1, door.y)) walkable.add(x + "," + y);
  for (const [x, y] of tilesIn(door.x, door.y, door.x + door.width, door.y + door.depth)) block(x + 0.5, y + 0.5);
}

// The floor: a strip from the rim to the foot of the vault's steps and a
// round dais there. The lobby builds it with its own floor, tile by tile on
// its own grid, so the platform has no seam. Takes a lobby position.
const stripHalfWidth = 2.1, daisRadius = 3.4;
export function gatewayFloor(lobbyX, lobbyY) {
  const [x, y] = toLayout(lobbyX, lobbyY);
  const onStrip = Math.abs(x - centerX) <= stripHalfWidth && y >= rimY - 1 && y <= door.y + door.depth;
  return onStrip || Math.hypot(x - centerX, y - (door.y + door.depth / 2)) <= daisRadius;
}

// The lobby leaves its fallen columns off the gateway's floor.
export const gatewayCovers = gatewayFloor;

// `hsl(h, s, l)` packs a colour the way the renderer expects; `baseZ` is the
// height of the lobby floor.
export function gatewayMeshes({ baseZ, hsl }) {
  const violet = hsl(...awakenedColour);
  const part = (name, zIndex, depth, animParams) =>
    dt2Mesh("dt2-gateway-" + name, zIndex, depth, animParams, turnMatrix);

  // Each boss's element runs along the floor into the door, in a lane of its
  // own. A stream is a flat sheet that fades in at its start.
  const surface = baseZ + 0.03;
  const streamStart = rimY, streamEnd = door.y + 0.2, halfWidth = 0.26;
  const streams = part("streams", 3, "read", [dt2ShaderModes.stream, streamEnd - streamStart, halfWidth, 0]);
  bosses.forEach((boss, index) => {
    const x = centerX + (index - 1.5) * 0.75, colour = hsl(...boss.colour);
    streams.quad(
      streams.vertex(x - halfWidth, streamStart, surface, colour, 0, -1, 0),
      streams.vertex(x + halfWidth, streamStart, surface, colour, 0, 1, 0),
      streams.vertex(x + halfWidth, streamEnd, surface, colour, 1, 1, 1),
      streams.vertex(x - halfWidth, streamEnd, surface, colour, 1, -1, 1),
    );
  });

  // A beam of light from the vault's roof, like the ones over the lobby's
  // other gateways.
  const radius = 1.5;
  const shaft = part("shaft", 8, "read", [dt2ShaderModes.shaft, 0, 0, 0]);
  shaft.sheet([vaultCentre[0] - radius, vaultCentre[1]], [vaultCentre[0] + radius, vaultCentre[1]], baseZ + roofHeight, 20, violet, 0.55, 0);
  shaft.sheet([vaultCentre[0], vaultCentre[1] - radius], [vaultCentre[0], vaultCentre[1] + radius], baseZ + roofHeight, 20, violet, 0.55, 0);

  return [streams, shaft].map((mesh) => mesh.command());
}
