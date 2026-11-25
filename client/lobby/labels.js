// The names the lobby writes over its stations: every station's name in its
// group's colour, and over a group of several, the group's name. The
// renderer places them on the screen each frame, as it does overhead text.
import { gatewayAnchors } from "./gateways.js";
import { groups, plinthHeight, stations } from "./hall.js";

// How high over the floor a boss's name stands, in tiles: above its head.
const nameHeight = (station) => plinthHeight + (station.labelHeight ?? 3.2);

const stationLabels = stations.map((station) => {
  const anchor =
    station.kind === "boss"
      ? { position: station.centre, height: nameHeight(station) }
      : gatewayAnchors[station.gateway];
  return { station, x: anchor.position[0], y: anchor.position[1], height: anchor.height };
});

const groupLabels = Object.entries(groups).flatMap(([group, { name, css }]) => {
  const members = stationLabels.filter((label) => label.station.group === group);
  if (members.length < 2) return [];
  const mean = (pick) => members.reduce((sum, label) => sum + pick(label), 0) / members.length;
  return [{ x: mean((label) => label.x), y: mean((label) => label.y), height: Math.max(...members.map((label) => label.height)) + 1.7, text: name.toUpperCase(), color: css, fontSize: 13, key: "lobby-group-" + group }];
});

/** The labels for a floor at height `baseZ`: { x, y, z, text, color, fontSize, key }. */
export function hallLabels(baseZ) {
  return [
    ...stationLabels.map(({ station, x, y, height }) => ({ x, y, z: baseZ + height, text: station.name, color: station.css, fontSize: 16, key: "lobby-station-" + station.id })),
    ...groupLabels.map(({ height, ...label }) => ({ ...label, z: baseZ + height })),
  ];
}
