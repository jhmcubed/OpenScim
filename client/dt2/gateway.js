// The Desert Treasure II gateway in the lobby: the Ancient Vault, lifted whole
// from its map square and turned so that the steps up to its door come down
// towards the platform (lobby/buildingGateway.js). The four ancient elements
// run along the causeway to the foot of the steps. A click on the vault asks
// which of the Forgotten Four to fight (chooser.js).
import { awakenedColour, bosses } from "./bosses.js";
import { chooseBoss } from "./chooser.js";
import { dt2Mesh, dt2ShaderModes } from "./shader.js";
import { buildingGateway } from "../lobby/buildingGateway.js";

// The vault: map square 54,46, whose objects 46720 to 46772, with the walls,
// door frame and floor marks about them, are the vault. It stands on a raised
// floor (level 1) that its steps climb from the west; its door (46743) is at
// the square's tile (55, 26). The foot of the steps is (43, 27.5).
const vaultIds = new Set([85, 2745, 44066, 44235, 44236, 44237, 44238, 44239, 44240, 44772, 46763, 46866, 47353]);
const middle = [53, 27.5];
// How high the vault's roof stands over the floor, in tiles, at its scale (OBS, from the lobby).
const roofHeight = 6;

const gateway = buildingGateway({
  station: "dt2",
  name: "Desert Treasure II",
  open: chooseBoss,
  building: {
    mapSquare: [54, 46],
    area: { minX: 42, minY: 19, maxX: 62, maxY: 36 },
    keep: (location) => (location.id >= 46720 && location.id <= 46772 && location.id !== 46750) || vaultIds.has(location.id),
    ground: [43, 27],
    entrance: [43, 27.5],
    facing: 90,
    scale: 0.6,
    distance: 4,
  },
  causeway: { halfWidth: 2.1, landingHalfWidth: 3.6, landingDepth: 3 },
  hits: [{ rect: [43, 20, 62, 35], top: roofHeight + 0.5 }],
  beams: [{ at: middle, z: roofHeight - 0.8, height: 20, width: 1.4, colour: awakenedColour, alpha: 0.5 }],
  label: { at: middle, height: roofHeight + 1.4 },
  // Each boss's element runs along the floor to the steps, in a lane of its own.
  meshes({ baseZ, hsl, foot, rimY, centerX, turnMatrix }) {
    const surface = baseZ + 0.03;
    const streamStart = rimY, streamEnd = foot[1] + 0.2, halfWidth = 0.26;
    const streams = dt2Mesh("dt2-gateway-streams", 3, "read", [dt2ShaderModes.stream, streamEnd - streamStart, halfWidth, 0], turnMatrix);
    bosses.forEach((boss, index) => {
      const x = centerX + (index - 1.5) * 0.75, colour = hsl(...boss.colour);
      streams.quad(
        streams.vertex(x - halfWidth, streamStart, surface, colour, 0, -1, 0),
        streams.vertex(x + halfWidth, streamStart, surface, colour, 0, 1, 0),
        streams.vertex(x + halfWidth, streamEnd, surface, colour, 1, 1, 1),
        streams.vertex(x - halfWidth, streamEnd, surface, colour, 1, -1, 1),
      );
    });
    return [streams.command()];
  },
});

export const {
  gatewayLocs, turnGatewayObject, gatewayPortals, extendLobbyArena, gatewayFloor, gatewayCovers, gatewayMeshes, gatewayHit, gatewayAnchor,
} = gateway;
export const gatewayName = gateway.name;
