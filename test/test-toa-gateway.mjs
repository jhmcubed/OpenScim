import assert from "node:assert/strict";
import { doorAt, nexusDoors } from "../client/toa/nexus.js";
import { extendLobbyArena, gatewayCovers, gatewayHit, gatewayPortals } from "../client/toa/gateway.js";
import { platform } from "../client/lobby/gateway.js";
import { spawn } from "../client/lobby/hall.js";

// Nexus doors: a click on a door or next to it finds it; the middle of the room finds none.
assert.equal(doorAt([22, 36]).encounterKind, "zebak");
assert.equal(doorAt([24, 34]).name, "Path of Crondis");
assert.equal(doorAt([31, 43]).exit, true);
assert.equal(doorAt([31, 26]), undefined);
for (const door of nexusDoors) {
  const [left, bottom, width, height] = door.tiles;
  const others = nexusDoors.filter((other) => other !== door);
  for (let x = left - 1; x <= left + width; x++)
    for (let y = bottom - 1; y <= bottom + height; y++)
      assert.equal(doorAt([x, y]), door, door.name + " shares a tile with " + others.find((other) => doorAt([x, y]) === other)?.name);
}
// Only a path whose boss exists stands open.
assert.deepEqual(nexusDoors.filter((door) => door.open).map((door) => door.encounterKind), ["zebak"]);

// Lobby gateway: build the lobby's walkable disc the way the lobby does, add
// the gateway, and walk from the spawn tile to the foot of the pyramid's ramp.
const walkable = new Set();
for (let x = 0; x < 64; x++)
  for (let y = 0; y < 64; y++)
    if (Math.hypot(x + 0.5 - platform.x, y + 0.5 - platform.y) <= platform.radius - 0.5) walkable.add(x + "," + y);
const onPlatform = walkable.size;
extendLobbyArena(walkable, (x, y) => walkable.delete(Math.floor(x) + "," + Math.floor(y)));
assert.ok(walkable.size > onPlatform, "the walkway adds tiles beyond the platform");

assert.ok(gatewayPortals.length >= 4 * 2, "the foot of the ramp and the row in front of it are portals");
// A click there lists the Tombs' bosses (toa/chooser.js) rather than entering the nexus.
for (const { position: [x, y], open, encounterKind } of gatewayPortals) {
  assert.equal(typeof open, "function");
  assert.equal(encounterKind, undefined);
  assert.ok(x >= 0 && x < 64 && y >= 0 && y < 64, "portal tile " + x + "," + y + " lies on the lobby map");
}
const portals = new Set(gatewayPortals.map(({ position }) => position.join(",")));
const seen = new Set([spawn.tile.join(",")]);
const queue = [[...spawn.tile]];
let reached = false;
while (queue.length && !reached) {
  const [x, y] = queue.shift();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const key = x + dx + "," + (y + dy);
    if (seen.has(key) || !walkable.has(key)) continue;
    if (portals.has(key)) reached = true;
    seen.add(key);
    queue.push([x + dx, y + dy]);
  }
}
assert.ok(reached, "the player can walk from the spawn tile to the foot of the ramp");

// A click on the pyramid itself lands on it: a ray from above its middle
// downward meets it, one beside the causeway on the platform does not.
const [portalX, portalY] = gatewayPortals[Math.floor(gatewayPortals.length / 2)].position;
const outward = [portalX + 0.5 - platform.x, portalY + 0.5 - platform.y].map((value) => value / Math.hypot(portalX + 0.5 - platform.x, portalY + 0.5 - platform.y));
const above = (distance) => ({ origin: { x: portalX + 0.5 + outward[0] * distance, y: portalY + 0.5 + outward[1] * distance, z: 40 }, direction: { x: 0, y: 0, z: -1 } });
assert.ok(gatewayHit(above(12)) !== null, "a click on the middle of the pyramid lands on it");
assert.equal(gatewayHit({ origin: { x: platform.x, y: platform.y, z: 40 }, direction: { x: 0, y: 0, z: -1 } }), null, "a click on the middle of the platform does not");

// The sand lies at the door, not on the middle of the platform.
const [doorX, doorY] = gatewayPortals[0].position;
assert.ok(gatewayCovers(doorX + 0.5, doorY + 0.5));
assert.ok(!gatewayCovers(31.5, 25.5));
console.log("TOA gateway and nexus doors passed");
