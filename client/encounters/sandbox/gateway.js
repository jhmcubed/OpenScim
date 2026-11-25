// The sandbox's gateway in the lobby: a round dais beyond the rim with a
// combat ring on it, the game's own, lifted whole from its map square and
// drawn large (lobby/buildingGateway.js): a fight of your own making. Beams of
// light in the colours of the fights whose monsters the sandbox borrows stand
// round it. A click on the ring enters the sandbox, as the menus do, with its
// editor at its start screen (menuImport.js, sandboxEntryKind).
import { buildingGateway } from "../../lobby/buildingGateway.js";

// The sandbox's kind (arenas.js). Not imported: the lobby's gateways load
// in plain Node in a test, and arenas.js reaches the engine's modules.
const sandboxKind = "sandbox";

export const sandboxGatewayLabel = "Sandbox";
const select = (open) =>
  open({ encounterKind: sandboxKind, displayName: "Sandbox", description: "Build a fight of your own: an arena, monsters of the other fights, and their bosses." });

// The combat ring: map square 27,85, whose objects 46243 (the ropes and their
// posts) and 46244 to 46246 (the mats) make a ring of 6 x 6 tiles at its
// tiles (17, 41) to (22, 46). Its middle is (20, 44); its south side, where
// the causeway meets it, is y = 41.
const middle = [20, 44];
const scale = 2.3;

// Hue, saturation and lightness (0 to 255) of each beam: the Inferno's fire,
// the Colosseum's gold, the Stranglewood's blood, the Doom's green, ToA's
// blue, round the ring.
const beamColours = [[8, 230, 120], [32, 224, 150], [0, 224, 96], [64, 200, 110], [150, 200, 140]];
const beamRing = 4.3; // in the ring's own tiles, from its middle

const gateway = buildingGateway({
  station: "sandbox",
  name: sandboxGatewayLabel,
  open: select,
  building: {
    mapSquare: [27, 85],
    area: { minX: 17, minY: 41, maxX: 22, maxY: 46 },
    keep: (location) => location.id >= 46243 && location.id <= 46246,
    ground: [19, 43],
    entrance: [20, 40.6],
    facing: 0,
    scale,
    distance: 2.5,
  },
  causeway: { halfWidth: 2.4, landingHalfWidth: 3, landingDepth: 2, dais: { offset: 7.4, radius: 9.9 } },
  hits: [{ rect: [16.6, 40.6, 23.4, 47.4], top: 2.8 }],
  beams: [
    ...beamColours.map((colour, index) => {
      const angle = (index / beamColours.length) * Math.PI * 2 + Math.PI / 2;
      return { at: [middle[0] + Math.cos(angle) * beamRing, middle[1] + Math.sin(angle) * beamRing], z: 0, height: 12, width: 0.9, colour, alpha: 0.45 };
    }),
    { at: middle, z: 2, height: 22, width: 1.6, colour: [130, 60, 230], alpha: 0.4 },
  ],
  label: { at: middle, height: 5 },
});

export const {
  gatewayLocs, turnGatewayObject, gatewayPortals, extendLobbyArena, gatewayFloor, gatewayCovers, gatewayMeshes, gatewayHit, gatewayAnchor,
} = gateway;
export const gatewayName = gateway.name;
