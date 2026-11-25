// The Theatre of Blood gateway in the lobby: the theatre of Ver Sinhaza,
// lifted whole from its map square and turned so that its doors face the
// platform (lobby/buildingGateway.js). The raid has no fight yet: a click on
// the theatre lists its bosses as coming.
import { buildingGateway } from "../lobby/buildingGateway.js";
import { chooseFight } from "../lobby/chooser.js";

// The raid's bosses, in the order the Theatre stages them (WIKI, Theatre of Blood).
export const tobBosses = ["The Maiden of Sugadinti", "Pestilent Bloat", "Nylocas Vasilias", "Sotetseg", "Xarpus", "Verzik Vitur"];

const open = (select) =>
  chooseFight(
    {
      title: "Theatre of Blood",
      subtitle: "Ver Sinhaza. The Theatre's bosses are on their way.",
      rows: tobBosses.map((name) => ({ name, colour: "#e0566a", fights: [] })),
    },
    select,
  );

// The theatre: map square 57,50, whose objects between its tiles (25, 7) and
// (52, 31) are the theatre and its walls. Its doors (32653) face west at the
// square's tiles (30, 16) to (31, 22); the way in is (29, 19). Turned 90
// degrees, the doors face the platform.
const middle = [39, 19];
// How high the theatre's towers stand over the floor, in tiles, at its scale (OBS, from the lobby).
const towerHeight = 7;

const gateway = buildingGateway({
  station: "tob",
  name: "Theatre of Blood",
  open,
  building: {
    mapSquare: [57, 50],
    area: { minX: 25, minY: 7, maxX: 52, maxY: 31 },
    ground: [28, 19],
    entrance: [29, 19],
    facing: 90,
    scale: 0.5,
    distance: 3.5,
  },
  hits: [{ rect: [26, 8, 51, 30], top: towerHeight }],
  beams: [{ at: middle, z: towerHeight - 1, height: 20, width: 1.4, colour: [0, 200, 120], alpha: 0.5 }],
  label: { at: middle, height: towerHeight + 1.2 },
});

export const {
  gatewayLocs, turnGatewayObject, gatewayPortals, extendLobbyArena, gatewayFloor, gatewayCovers, gatewayMeshes, gatewayHit, gatewayAnchor,
} = gateway;
export const gatewayName = gateway.name;
