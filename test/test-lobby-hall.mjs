// The lobby's hall (client/lobby/hall.js): every boss's pedestal stands clear
// of every other, of the seal in the middle, of the gateways' causeways and of
// the rim, and so would every place a wing has room for, when it fills. Every
// boss opens a fight the client has, and every station has a name and a label.
import assert from "node:assert/strict";
import { register } from "node:module";
import { gatewayFloor, gatewayPortals } from "../client/lobby/gateways.js";
import { hallLabels } from "../client/lobby/labels.js";
import { bossStations, groups, plinthRadius, platform, spawn, stations, wingPlaces } from "../client/lobby/hall.js";

const sealRadius = 6;
const gap = 0.4; // tiles between two pedestals, at the least

// Where a boss stands in a place.
const centreOf = ({ angle, radius }) => [platform.x + Math.cos((angle * Math.PI) / 180) * radius, platform.y + Math.sin((angle * Math.PI) / 180) * radius];

function assertClear(centres, what) {
  centres.forEach(([x, y], index) => {
    const fromMiddle = Math.hypot(x - platform.x, y - platform.y);
    assert.ok(fromMiddle - plinthRadius >= sealRadius, what + " " + index + " stands on the seal");
    assert.ok(fromMiddle + plinthRadius <= platform.radius - 0.3, what + " " + index + " leaves the platform");
    for (let around = 0; around < 16; around++) {
      const angle = (around / 16) * Math.PI * 2;
      const px = x + Math.cos(angle) * plinthRadius, py = y + Math.sin(angle) * plinthRadius;
      assert.ok(!gatewayFloor(px, py) || Math.hypot(px - platform.x, py - platform.y) < platform.radius - 0.3, what + " " + index + " stands on a causeway");
    }
    assert.ok(Math.hypot(x - spawn.tile[0] - 0.5, y - spawn.tile[1] - 0.5) > plinthRadius + 1, what + " " + index + " stands on the spawn");
    centres.slice(index + 1).forEach(([ox, oy], other) =>
      assert.ok(Math.hypot(x - ox, y - oy) >= 2 * plinthRadius + gap, what + " " + index + " and " + (index + 1 + other) + " overlap"),
    );
  });
}

// The hall as it is.
assertClear(bossStations.map((station) => station.centre), "boss");
assert.equal(new Set(stations.map((station) => station.id)).size, stations.length, "every station has an id of its own");

// Every wing, filled to the last place it has: first row, then second.
for (const [group, { wing }] of Object.entries(groups)) {
  if (!wing) continue;
  let count = 1;
  while (true) {
    try {
      wingPlaces(count + 1, wing);
      count++;
    } catch {
      break;
    }
  }
  assert.ok(count >= 7, group + " has room for seven bosses: four in front, three behind");
  const places = wingPlaces(count, wing);
  assert.ok(places.some((place) => place.row === 1), group + " fills a second row");
  assertClear(places.map(centreOf), group + " place");
  assert.throws(() => wingPlaces(count + 1, wing), /full/, "a boss past the last place is refused");
}

// Every boss opens a fight the client has. The registry is read through the
// determinism harness's hooks, as the DT2 gateway's test does.
register("../tools/determinism/node-hooks.mjs", import.meta.url);
globalThis.self ??= globalThis;
// A kind may be a retired one ("zuk", the Inferno at wave 69), which the
// registry resolves to the fight it stands for.
const { encounterRegistry, resolveKindOrRetiredEntry } = await import("../client/encounters/registry.js");
for (const station of bossStations) {
  const resolved = resolveKindOrRetiredEntry(station.encounterKind);
  assert.ok(resolved && encounterRegistry.isRegistered(resolved.kind), station.id + " opens " + station.encounterKind + ", which the client has");
}

// No two gateways share a portal tile, and every station has a label.
assert.equal(new Set(gatewayPortals.map(({ position }) => position.join(","))).size, gatewayPortals.length);
const labels = hallLabels(0);
for (const station of stations) assert.ok(labels.some((label) => label.text === station.name), station.id + " has a label");
console.log("Lobby hall passed");
