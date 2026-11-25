// The lobby's gateways together: what the lobby asks of one, it asks of all.
import * as toa from "../toa/gateway.js";
import * as dt2 from "../dt2/gateway.js";
import * as sandbox from "../encounters/sandbox/gateway.js";
import * as cox from "../cox/gateway.js";
import * as tob from "../tob/gateway.js";
import { groups, stations } from "./hall.js";

const gateways = { toa, dt2, sandbox, cox, tob };
const all = Object.values(gateways);

// Tiles that open something when clicked: { position, displayName } with
// either `encounterKind`, the encounter to enter, or `open(select)`, which
// asks the player and passes `select` the fight to set up.
export const gatewayPortals = all.flatMap((gateway) => gateway.gatewayPortals);
export const gatewayCovers = (x, y) => all.some((gateway) => gateway.gatewayCovers(x, y));
// Whether the lobby should lay its own floor at a position beyond its rim.
export const gatewayFloor = (x, y) => all.some((gateway) => gateway.gatewayFloor?.(x, y));
export const extendLobbyArena = (walkable, block) => all.forEach((gateway) => gateway.extendLobbyArena(walkable, block));
export const gatewayMeshes = (context) => all.flatMap((gateway) => gateway.gatewayMeshes(context));
// Where the lobby writes each gateway's name, by the gateway's name in the
// hall (lobby/hall.js): { position: [x, y], height } in tiles above the floor.
export const gatewayAnchors = Object.fromEntries(Object.entries(gateways).map(([name, gateway]) => [name, gateway.gatewayAnchor]));

// A click on a building: the gateway the pointer's ray (`{ origin, direction }`
// in the lobby, as the client picks with it) meets first, or null.
export function gatewayAtRay(ray) {
  let nearest = null;
  for (const [name, gateway] of Object.entries(gateways)) {
    const distance = gateway.gatewayHit?.(ray);
    if (distance != null && (nearest === null || distance < nearest.distance)) nearest = { name, gateway, distance };
  }
  return nearest;
}

/** The tile whose click opens the gateway that `ray` meets, or null: the middle one of its portals. */
export function gatewayPortalAtRay(ray) {
  const hit = gatewayAtRay(ray);
  if (!hit) return null;
  const portals = hit.gateway.gatewayPortals;
  return portals[Math.floor(portals.length / 2)].position;
}

/**
 * The menu entries for the building under the pointer (the client's
 * right-click menu and the action shown as the pointer moves): "Enter" it.
 * `onTileClick(tile)` clicks the gateway's portal.
 */
export function gatewayMenuEntries(ray, onTileClick) {
  const hit = ray && gatewayAtRay(ray);
  if (!hit) return [];
  const station = stations.find((candidate) => candidate.gateway === hit.name);
  const tile = gatewayPortalAtRay(ray);
  return [
    { action: "Enter", target: hit.gateway.gatewayName, targetColor: groups[station?.group]?.css ?? "#f8c070", onClick: () => onTileClick?.(tile), clickType: "red" },
  ];
}

// Loads each gateway's objects into an object renderer of its own. A renderer
// merges its still objects into one mesh, and a mesh has one turn, so
// gateways on different spokes cannot share one. `loadMapSquare(x, y)`
// resolves to a map square's { terrain, locations }, for a gateway that lifts
// a building from one (lobby/structure.js); `terrainHeights` are the lobby's.
export async function loadGatewayObjects(ObjectRenderer, loader, terrainHeights, loadMapSquare) {
  const drawn = [];
  for (const [name, gateway] of Object.entries(gateways)) {
    const renderer = new ObjectRenderer();
    renderer.setTerrainHeights(terrainHeights);
    let locs = [];
    try {
      locs = await gateway.gatewayLocs(loader, { terrainHeights, loadMapSquare });
    } catch (error) {
      console.error("The lobby could not load the objects of the gateway " + name, error);
    }
    // No bounds: the objects are laid out before the turn, outside the lobby's
    // arena. Every level: a lifted building stands on several.
    await renderer.load(loader, locs, { bounds: null, levels: [0, 1, 2, 3] });
    // Every renderer gives its merged mesh the same name, and the graphics
    // memory is kept by name.
    for (const command of renderer.cachedLocMeshes) {
      if (!command.meshSource.id.endsWith(name)) command.meshSource.id += "-" + name;
      command.meshId += "-" + name;
    }
    drawn.push({ gateway, renderer });
  }
  return drawn;
}

// Adds the loaded objects to a frame's draw queue, turned to their spokes.
export function drawGatewayObjects(drawn, queue) {
  for (const { gateway, renderer } of drawn ?? []) {
    const first = queue.commands.length;
    renderer.renderLocs(queue);
    for (let i = first; i < queue.commands.length; i++) gateway.turnGatewayObject(queue.commands[i]);
  }
}
