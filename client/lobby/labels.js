// The names the lobby writes over its stations: every station's name in its
// group's colour, "Coming soon" under a gateway whose fights are not built
// yet, and over each group of several, its name. The renderer places them on the screen each
// frame, as it does overhead text.
import { gatewayAnchors } from "./gateways.js";
import { groups, stations } from "./hall.js";

const stationLabels = stations.map((station) => {
  const anchor = station.kind === "boss" ? { position: station.centre, height: null } : gatewayAnchors[station.gateway];
  return { station, x: anchor.position[0], y: anchor.position[1], height: anchor.height };
});

// A group's name, over the middle of its stations: above the tallest of a
// group of gateways, or a little above the heads of a wing of bosses.
const groupMembers = Object.entries(groups)
  .map(([group, { name, css }]) => ({ group, name, css, members: stationLabels.filter((label) => label.station.group === group) }))
  .filter(({ members }) => members.length > 1);

/**
 * The labels for a floor at height `baseZ`: { x, y, z, text, color, fontSize,
 * key, below? }. `heightOf(actorId)` is how tall a boss stands as drawn, when
 * the renderer knows it; its name is written just above its head.
 */
export function hallLabels(baseZ, heightOf = () => undefined) {
  return [
    ...stationLabels.flatMap(({ station, x, y, height }) => {
      const over = height ?? station.standHeight + (heightOf(station.actorId) ?? station.labelHeight ?? 3.2) + 0.45;
      return [
        { x, y, z: baseZ + over, text: station.name, color: station.css, fontSize: 16, key: "lobby-station-" + station.id },
        // Written under the name: `below` is how many pixels lower.
        ...(station.soon ? [{ x, y, z: baseZ + over, below: 15, text: "Coming soon", color: "#9fc4cf", fontSize: 12, key: "lobby-soon-" + station.id }] : []),
      ];
    }),
    ...groupMembers.map(({ group, name, css, members }) => {
      const mean = (pick) => members.reduce((sum, member) => sum + pick(member), 0) / members.length;
      const top = Math.max(...members.map(({ station, height }) => height ?? station.standHeight + (heightOf(station.actorId) ?? station.labelHeight ?? 3.2)));
      return { x: mean((member) => member.x), y: mean((member) => member.y), z: baseZ + top + 2.2, text: name.toUpperCase(), color: css, fontSize: 13, key: "lobby-group-" + group };
    }),
  ];
}
