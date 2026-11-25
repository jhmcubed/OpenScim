// The lobby's hall: where every fight stands. One list, read by the lobby's
// encounter (its spawn and collision), by the renderer (the stations, their
// pedestals and labels) and by the gateways (the direction of their spokes).
// To add a fight to the lobby, add a station here: it takes the next place in
// its group's wing.
//
// The hall is a round platform floating under the moon of Zanaris. The
// player arrives just south of its middle, looking north at the raids:
//
//   - its head holds the gateways: buildings of the game beyond the rim, at
//     the end of causeways. The raids stand together in the middle (Chambers
//     of Xeric, Tombs of Amascut, Theatre of Blood), the Desert Treasure II
//     vault to their left and the sandbox's ring to their right;
//   - its two wings hold the bosses who stand in the lobby themselves, on
//     pedestals: the bosses' own fights on the left (west), the fights of
//     waves on the right (east). A wing starts beside the head and grows
//     round the platform towards the south, one place per boss, a fixed
//     distance apart, so a new boss never crowds the others. Its `limit` is
//     the last angle it may reach. Seen from the spawn, a wing faces the
//     player as they turn to it, so no boss stands behind another.
//
// Angles are in degrees anticlockwise from east, about the platform's centre:
// 90 is north, 180 west.
//
// When a wing's first row is full (four bosses), its next three stand in a
// second row behind it, on taller pedestals (wingPlaces). When both rows are
// full, the group takes a gateway of its own whose list (lobby/chooser.js)
// holds its fights, as the Forgotten Four and the Tombs' bosses already are.
import { platform } from "./gateway.js";

export { platform };

// Hue, saturation and lightness, each 0 to 255, as the renderer's colour
// packer takes them; `css` is the same colour for the labels.
// `wing` places a group's bosses: { from, step, limit } in degrees.
export const groups = {
  bosses: { name: "Bosses", colour: [244, 150, 160], css: "#ff8fa3", wing: { from: 176, step: 1, limit: 258 } },
  dt2: { name: "Desert Treasure II", colour: [190, 140, 180], css: "#c7a6ff" },
  raids: { name: "Raids", colour: [32, 190, 160], css: "#f5d27a" },
  waves: { name: "Waves", colour: [18, 210, 150], css: "#ffb066", wing: { from: -6, step: -1, limit: -88 } },
  sandbox: { name: "Sandbox", colour: [128, 170, 190], css: "#86f0ff" },
};

// The pedestal a boss stands on: the player walks around it, and the boss
// stands on its top.
export const plinthRadius = 1.8;
export const plinthHeight = 0.4;

// The ring the bosses stand on, how far apart neighbours stand along it
// (tiles, centre to centre), and the tile the player arrives on.
export const stationRadius = 15;
export const stationSpacing = 7;
export const spawn = { tile: [31, 22], facingAngle: 1024 };
// The middle of the spawn tile.
export const spawnPoint = [spawn.tile[0] + 0.5, spawn.tile[1] + 0.5];

// A station is a boss on a pedestal (`npcTypeId`) or a gateway (`gateway`, the
// name of a module in gateways.js, at `angle`). A boss's station opens the
// setup window of `encounterKind`; a gateway opens what its own module says.
// `displaySize` is how many tiles the boss is drawn across (3 when not given),
// `labelHeight` how high above its pedestal its name is written (labels.js).
// `soon` marks a gateway whose fights are not built yet.
const layout = [
  { id: "dt2", group: "dt2", gateway: "dt2", angle: 156, name: "Desert Treasure II" },
  { id: "cox", group: "raids", gateway: "cox", angle: 125, name: "Chambers of Xeric", soon: true },
  { id: "toa", group: "raids", gateway: "toa", angle: 90, name: "Tombs of Amascut" },
  { id: "tob", group: "raids", gateway: "tob", angle: 55, name: "Theatre of Blood", soon: true },
  { id: "sandbox", group: "sandbox", gateway: "sandbox", angle: 13, name: "Sandbox" },

  // The bosses' wing, from the head towards the spawn.
  { id: "yama", group: "bosses", npcTypeId: 14176, encounterKind: "yama_p3", name: "Yama", labelHeight: 3.8,
    description: "The third and final phase of the Yama fight." },
  { id: "hunllef", group: "bosses", npcTypeId: 9035, encounterKind: "corrupted_hunllef", name: "Corrupted Hunllef",
    description: "Prepare in the Corrupted Gauntlet boss room." },
  { id: "maggot-king", group: "bosses", npcTypeId: 15742, encounterKind: "maggot_king", name: "Maggot King",
    description: "Spits, screeches, bile and carrion, larvae that eat it, and head slams up close." },
  { id: "araxxor", group: "bosses", npcTypeId: 13668, encounterKind: "araxxor", name: "Araxxor",
    description: "His three attack styles, the acid of his specials, nine eggs and the cleave of his enrage." },

  // The waves' wing, from the head towards the spawn.
  { id: "inferno", group: "waves", npcTypeId: 7706, encounterKind: "zuk", name: "The Inferno",
    description: "Start from any wave. Each cleared wave leads straight into the next, through to TzKal-Zuk at wave 69." },
  { id: "colosseum", group: "waves", npcTypeId: 12821, encounterKind: "sol_heredit", name: "Fortis Colosseum", labelHeight: 4,
    description: "The final wave of the Fortis Colosseum." },
  // Drawn at its own size: squeezed into 3 tiles like the others, its low
  // 5 x 5 body stands a third of their height.
  { id: "doom", group: "waves", npcTypeId: 14707, displaySize: 5, labelHeight: 2.6, encounterKind: "doom_of_mokhaiotl", name: "Doom of Mokhaiotl",
    description: "The delve boss beneath the Ruins of Mokhaiotl, delves 1 to 8." },
];

const radians = (degrees) => (degrees * Math.PI) / 180;
// The direction a boss faces to look from (x, y) at (tx, ty), in 2048ths of a
// turn: 0 south, 512 west, 1024 north.
export function facingTowards(x, y, tx, ty) {
  const angle = Math.atan2(-(tx - x), -(ty - y));
  return Math.round(((angle + Math.PI * 2) % (Math.PI * 2)) * (2048 / (Math.PI * 2))) % 2048;
}

// The angle between neighbours of a wing, for their spacing on its ring.
export const wingStep = (2 * Math.asin(stationSpacing / 2 / stationRadius) * 180) / Math.PI;
// A wing's second row stands behind its first, nearer the rim, one place
// between each two of the first row so it shows between them, on pedestals
// `backRowRise` tiles taller so it shows over them too.
export const backRowRadius = 17.5;
export const backRowRise = 1.1;

/**
 * The places of a wing for `count` bosses: { angle, radius, row }. The first
 * row fills from `from` towards `limit`, then the second row. A wing with no
 * place left for a boss is a mistake in this list: the error says so.
 */
export function wingPlaces(count, { from, step, limit }, group = "wing") {
  const front = Math.floor((Math.abs(limit - from) + 0.001) / wingStep) + 1;
  const back = front - 1;
  if (count > front + back) throw new Error("The " + group + " wing is full (" + (front + back) + " bosses): give the group a gateway of its own");
  return Array.from({ length: count }, (_, index) =>
    index < front
      ? { angle: from + step * index * wingStep, radius: stationRadius, row: 0 }
      : { angle: from + step * (index - front + 0.5) * wingStep, radius: backRowRadius, row: 1 },
  );
}

// Each boss's place: the next of its group's wing.
function wingAngles() {
  const placed = new Map();
  for (const [group, { wing }] of Object.entries(groups)) {
    if (!wing) continue;
    const members = layout.filter((station) => station.group === group && !station.gateway);
    wingPlaces(members.length, wing, group).forEach((place, index) => placed.set(members[index].id, place));
  }
  return placed;
}
const places = wingAngles();

export const stations = layout.map((station) => {
  const { colour, css } = groups[station.group];
  if (station.gateway) return { ...station, kind: "gateway", colour, css };
  const { angle, radius, row } = places.get(station.id);
  const direction = radians(angle);
  // `centre` is where the boss and its pedestal stand; `position` is the
  // south-west tile of the 3 x 3 square nearest it, for what goes by tiles.
  const centre = [platform.x + Math.cos(direction) * radius, platform.y + Math.sin(direction) * radius];
  const position = [Math.round(centre[0] - 1.5), Math.round(centre[1] - 1.5)];
  return {
    ...station,
    angle,
    row,
    kind: "boss",
    actorId: "lobby-" + station.id,
    position,
    centre,
    // How high the top of its pedestal stands, where the boss stands.
    standHeight: plinthHeight + row * backRowRise,
    // Each boss looks towards the middle of the hall.
    facingAngle: facingTowards(centre[0], centre[1], platform.x, platform.y - 4),
    colour,
    css,
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

