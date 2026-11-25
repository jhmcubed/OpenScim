// The lobby's gateways together: what the lobby asks of one, it asks of all.
import * as toa from "../toa/gateway.js";
import * as dt2 from "../dt2/gateway.js";
import * as sandbox from "../encounters/sandbox/gateway.js";

const gateways = { toa, dt2, sandbox };
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
