// The lobby's hall: where every fight stands. One list, read by the lobby's
// encounter (its spawn and collision), by the renderer (the stations, their
// plinths, lanes and labels) and by the gateways (the direction of their
// spokes). To add a fight to the lobby, add a station here.
//
// The stations stand in a horseshoe that opens to the south, where the player
// arrives looking north, so that every one of them is in the first view and
// none stands behind the camera. The three gateways stand together at its
// head, beyond the rim; the bosses stand in its two wings, the bosses' own
// fights on the left and the fights of waves on the right. A wing seen from
// the spawn runs away from the camera, so its stations stand closer together
// towards the back, where they look smaller, and the lowest bosses stand
// nearest: none hides another, and none hides a gateway.
//
// Angles are in degrees anticlockwise from east, about the platform's centre:
// 90 is north, 180 west. Left to right as the player sees them, the angles fall.
import { platform } from "./gateway.js";

export { platform };

// Hue, saturation and lightness, each 0 to 255, as the renderer's colour
// packer takes them; `css` is the same colour for the labels.
export const groups = {
  bosses: { name: "Bosses", colour: [250, 190, 132], css: "#ff6f78" },
  dt2: { name: "Desert Treasure II", colour: [196, 150, 176], css: "#c29bff" },
  raids: { name: "Raids", colour: [30, 210, 150], css: "#f2c45a" },
  waves: { name: "Waves", colour: [14, 230, 138], css: "#ff9a4a" },
  sandbox: { name: "Sandbox", colour: [140, 120, 190], css: "#9fe6ff" },
};

// The ring the boss stations stand on, and the tile the player arrives on.
export const stationRadius = 12;
export const spawn = { tile: [31, 16], facingAngle: 1024 };
// The middle of the spawn tile: the lanes on the floor start here.
export const spawnPoint = [spawn.tile[0] + 0.5, spawn.tile[1] + 0.5];

// A station is a boss on a plinth (`npcTypeId`) or a gateway (`gateway`, the
// name of a module in gateways.js). A boss's station opens the setup window of
// `encounterKind`; a gateway opens what its own module says. `displaySize` is
// how many tiles the boss is drawn across (3 when not given), `labelHeight`
// how high above its plinth its name is written (labels.js): neighbours whose
// names would touch in the first view are written at different heights.
const layout = [
  { id: "araxxor", group: "bosses", angle: 196, npcTypeId: 13668, encounterKind: "araxxor", name: "Araxxor",
    description: "His three attack styles, the acid of his specials, nine eggs and the cleave of his enrage." },
  { id: "maggot-king", group: "bosses", angle: 176, npcTypeId: 15742, encounterKind: "maggot_king", name: "Maggot King",
    description: "Spits, screeches, bile and carrion, larvae that eat it, and head slams up close." },
  { id: "hunllef", group: "bosses", angle: 158, npcTypeId: 9035, encounterKind: "corrupted_hunllef", name: "Corrupted Hunllef", labelHeight: 3.9,
    description: "Prepare in the Corrupted Gauntlet boss room." },
  { id: "yama", group: "bosses", angle: 141, npcTypeId: 14176, encounterKind: "yama_p3", name: "Yama", labelHeight: 3.8,
    description: "The third and final phase of the Yama fight." },
  { id: "dt2", group: "dt2", angle: 114, gateway: "dt2", name: "Desert Treasure II" },
  { id: "toa", group: "raids", angle: 90, gateway: "toa", name: "Tombs of Amascut" },
  { id: "sandbox", group: "sandbox", angle: 66, gateway: "sandbox", name: "Sandbox" },
  { id: "inferno", group: "waves", angle: 37, npcTypeId: 7706, encounterKind: "zuk", name: "The Inferno",
    description: "Start from any wave. Each cleared wave leads straight into the next, through to TzKal-Zuk at wave 69." },
  { id: "colosseum", group: "waves", angle: 19, npcTypeId: 12821, encounterKind: "sol_heredit", name: "Fortis Colosseum", labelHeight: 4.3,
    description: "The final wave of the Fortis Colosseum." },
  // Drawn at its own size: squeezed into 3 tiles like the others, its low
  // 5 x 5 body stands a third of their height.
  { id: "doom", group: "waves", angle: 0, npcTypeId: 14707, displaySize: 5, labelHeight: 2.4, encounterKind: "doom_of_mokhaiotl", name: "Doom of Mokhaiotl",
    description: "The delve boss beneath the Ruins of Mokhaiotl, delves 1 to 8." },
];

const radians = (degrees) => (degrees * Math.PI) / 180;
// The direction a boss faces to look from (x, y) at (tx, ty), in 2048ths of a
// turn: 0 south, 512 west, 1024 north.
export function facingTowards(x, y, tx, ty) {
  const angle = Math.atan2(-(tx - x), -(ty - y));
  return Math.round(((angle + Math.PI * 2) % (Math.PI * 2)) * (2048 / (Math.PI * 2))) % 2048;
}

export const stations = layout.map((station) => {
  const direction = radians(station.angle);
  if (station.gateway) {
    return { ...station, kind: "gateway", colour: groups[station.group].colour, css: groups[station.group].css };
  }
  // A boss stands on whole tiles: `position` is the south-west tile of its
  // 3 x 3 square, `centre` the middle of that square.
  const x = platform.x + Math.cos(direction) * stationRadius;
  const y = platform.y + Math.sin(direction) * stationRadius;
  const position = [Math.round(x - 1.5), Math.round(y - 1.5)];
  const centre = [position[0] + 1.5, position[1] + 1.5];
  return {
    ...station,
    kind: "boss",
    actorId: "lobby-" + station.id,
    position,
    centre,
    // Each boss looks at the tile the player arrives on.
    facingAngle: facingTowards(centre[0], centre[1], ...spawnPoint),
    colour: groups[station.group].colour,
    css: groups[station.group].css,
  };
});

export const bossStations = stations.filter((station) => station.kind === "boss");
export const gatewayStations = stations.filter((station) => station.kind === "gateway");

// The direction of a gateway's spoke: its module asks here.
export function spokeDegreesOf(gateway) {
  const station = gatewayStations.find((candidate) => candidate.gateway === gateway);
  if (!station) throw new Error("The hall has no station for the gateway " + gateway);
  return station.angle;
}

// What a click on a boss opens, by the boss's actor id: the setup window of
// its fight (application.js, the lobby's encounter popup).
export const lobbyEncounterByActorId = Object.fromEntries(
  bossStations.map((station) => [
    station.actorId,
    { encounterKind: station.encounterKind, displayName: station.name, description: station.description },
  ]),
);

// The plinth a boss stands on: the player walks around it, and the boss
// stands on its top.
export const plinthRadius = 2.1;
export const plinthHeight = 0.32;
