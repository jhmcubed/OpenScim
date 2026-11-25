// The Chambers of Xeric gateway in the lobby: the ruined arches on Mount
// Quidamortem where the raid is entered, lifted whole from their map square
// (lobby/buildingGateway.js). The raid has no fight yet: a click on the ruins
// lists its bosses as coming.
import { buildingGateway } from "../lobby/buildingGateway.js";
import { chooseFight } from "../lobby/chooser.js";

// The raid's bosses, in the order the Chambers meet them (WIKI, Chambers of Xeric).
export const coxBosses = [
  "Tekton", "Ice demon", "Lizardman shamans", "Vanguards", "Vespula", "Muttadiles",
  "Skeletal Mystics", "Vasa Nistirio", "Guardians", "Great Olm",
];

const open = (select) =>
  chooseFight(
    {
      title: "Chambers of Xeric",
      subtitle: "Mount Quidamortem. The raid's bosses are on their way.",
      rows: coxBosses.map((name) => ({ name, colour: "#6fd3b8", fights: [] })),
    },
    select,
  );

// The ruins: map square 19,55, whose objects about the raid's entrance (29777,
// at the square's tile (16, 53), facing south) are its arches, columns,
// crystal and floor; the square's trees, bushes and loose stones are left
// out. The way in is in front of the entrance, (17.5, 52).
const ruinIds = new Set([2745, 6496, 29777, 29923, 29928, 29929, 29942, 29943, 29947, 29951, 29954, 29955, 29960, 29963, 29973]);
const gateway = buildingGateway({
  station: "cox",
  name: "Chambers of Xeric",
  open,
  building: {
    mapSquare: [19, 55],
    area: { minX: 8, minY: 46, maxX: 27, maxY: 61 },
    keep: (location) => ruinIds.has(location.id),
    ground: [17, 51],
    entrance: [17.5, 51.5],
    facing: 0,
    scale: 0.7,
    distance: 3.5,
  },
  hits: [{ rect: [11, 45, 24, 60], top: 5.5 }],
  beams: [{ at: [17.5, 55], z: 4, height: 20, width: 1.4, colour: [110, 150, 170], alpha: 0.5 }],
  label: { at: [17.5, 55], height: 6.4 },
});

export const {
  gatewayLocs, turnGatewayObject, gatewayPortals, extendLobbyArena, gatewayFloor, gatewayCovers, gatewayMeshes, gatewayHit, gatewayAnchor,
} = gateway;
export const gatewayName = gateway.name;
