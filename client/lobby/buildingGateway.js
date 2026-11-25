// A gateway that is a building of the game: its causeway leaves the lobby's
// rim along a spoke and ends at the building's way in, which faces the
// platform. The building is lifted whole from its map square
// (lobby/structure.js). A click anywhere on it, or on the foot of its way in,
// opens what the gateway offers, usually a list of its fights (lobby/chooser.js).
//
// Laid out as if the spoke pointed north (lobby/gateway.js): the causeway runs
// up the line x = centerX from the rim to `foot`, the point of the way in.
import { beamMesh } from "./beams.js";
import { centerX, lobbyGateway, rimY } from "./gateway.js";
import { spokeDegreesOf } from "./hall.js";
import { lobbyStructure } from "./structure.js";

/**
 * `station`   the gateway's station in the hall (lobby/hall.js): its spoke
 * `name`      what the lobby calls it, in its label and its menu
 * `open(select)`  what a click opens; `select` opens a fight's setup window
 * `building`  { mapSquare, area, keep, ground, entrance, facing, scale, distance }:
 *             the square and area of the building (structure.js), the point of
 *             the square where its way in begins, how far it is turned
 *             (degrees) to face the platform, its scale, and how far beyond the
 *             rim (tiles) the way in stands
 * `causeway`  { halfWidth, landingHalfWidth, landingDepth, dais } of the floor to
 *             it; `dais` { offset, radius }: a round floor beyond the foot, under
 *             a building that stands on it
 * `hits`      [{ rect: [minX, minY, maxX, maxY], top }]: boxes, in the square's
 *             tiles, that a click on the building lands in; `top` in lobby tiles
 * `beams`     [{ at: [x, y], z, height, width, colour, alpha }]: light rising
 *             from the building; `at` in the square's tiles, the rest in lobby tiles
 * `label`     { at: [x, y], height }: where its name is written
 * `meshes(context)`  more of its own, in the layout: context has baseZ, hsl,
 *             foot, rimY, centerX and layoutPoint
 */
export function buildingGateway({ station, name, open, building, causeway = {}, hits = [], beams = [], label, meshes }) {
  const { halfWidth = 2.4, landingHalfWidth = 4.4, landingDepth = 3, dais } = causeway;
  const foot = [centerX, rimY + building.distance];
  const structure = lobbyStructure({
    mapSquare: building.mapSquare,
    area: building.area,
    keep: building.keep,
    ground: building.ground,
    from: building.entrance,
    to: foot,
    scale: building.scale,
    degrees: building.facing,
  });
  const { fromLayout, toLayout, turnMatrix, tilesIn, turnGatewayObject, structureLocs } = lobbyGateway(spokeDegreesOf(station), []);
  const layoutPoint = structure.point;

  const gatewayLocs = (loader, context) => structureLocs(structure, context);

  // A click on the foot of the way in, or on the row in front of it, opens it.
  const gatewayPortals = tilesIn(centerX - 2, foot[1] - 1.5, centerX + 2, foot[1] + 1).map((position) => ({ position, displayName: name, open }));

  // The causeway is walkable up to the foot of the way in.
  function extendLobbyArena(walkable) {
    for (const [x, y] of tilesIn(centerX - halfWidth + 0.5, rimY - 3, centerX + halfWidth - 0.5, foot[1] + 1)) walkable.add(x + "," + y);
  }

  // The floor: the causeway and a landing at its end. The lobby lays it with
  // its own floor (hallScene.js). Takes a lobby position.
  function gatewayFloor(lobbyX, lobbyY) {
    const [x, y] = toLayout(lobbyX, lobbyY);
    const onCauseway = Math.abs(x - centerX) <= halfWidth && y >= rimY - 1 && y <= foot[1];
    const onLanding = Math.abs(x - centerX) <= landingHalfWidth && Math.abs(y - foot[1]) <= landingDepth / 2;
    const onDais = !!dais && Math.hypot(x - centerX, y - foot[1] - dais.offset) <= dais.radius;
    return onCauseway || onLanding || onDais;
  }

  let floorZ = 0;
  function gatewayMeshes({ baseZ, hsl }) {
    floorZ = baseZ;
    const lights = beams.map(({ at, z, height, width, colour, alpha }) => {
      const [x, y] = layoutPoint(at);
      return { x, y, z: baseZ + z, height, width, colour: hsl(...colour), alpha };
    });
    return [
      ...(lights.length ? [beamMesh("gateway-" + station, lights, turnMatrix)] : []),
      ...(meshes ? meshes({ baseZ, hsl, foot, rimY, centerX, layoutPoint, turnMatrix }) : []),
    ];
  }

  // The boxes a click lands in, in the layout: a middle, half sizes and a turn.
  const boxes = hits.map(({ rect: [minX, minY, maxX, maxY], top }) => ({
    centre: layoutPoint([(minX + maxX) / 2, (minY + maxY) / 2]),
    half: [((maxX - minX) / 2) * building.scale, ((maxY - minY) / 2) * building.scale],
    turn: (building.facing * Math.PI) / 180,
    top,
  }));

  /** How far along `ray` ({ origin, direction } in the lobby) it meets the building, or null. */
  function gatewayHit({ origin, direction }) {
    const [ox, oy] = toLayout(origin.x, origin.y);
    const [tx, ty] = toLayout(origin.x + direction.x, origin.y + direction.y);
    const dx = tx - ox, dy = ty - oy, dz = direction.z;
    let nearest = null;
    for (const { centre, half, turn, top } of boxes) {
      // Into the box's own frame, where it is axis-aligned.
      const cos = Math.cos(-turn), sin = Math.sin(-turn);
      const px = (ox - centre[0]) * cos - (oy - centre[1]) * sin, py = (ox - centre[0]) * sin + (oy - centre[1]) * cos;
      const vx = dx * cos - dy * sin, vy = dx * sin + dy * cos;
      let near = 0, far = Infinity, missed = false;
      for (const [p, v, min, max] of [[px, vx, -half[0], half[0]], [py, vy, -half[1], half[1]], [origin.z, dz, floorZ, floorZ + top]]) {
        if (Math.abs(v) < 1e-9) {
          // Parallel to this pair of faces: in between them, or a miss.
          missed ||= p < min || p > max;
          continue;
        }
        const t1 = (min - p) / v, t2 = (max - p) / v;
        near = Math.max(near, Math.min(t1, t2));
        far = Math.min(far, Math.max(t1, t2));
      }
      if (!missed && near <= far && (nearest === null || near < nearest)) nearest = near;
    }
    return nearest;
  }

  const gatewayAnchor = { position: fromLayout(...layoutPoint(label.at)), height: label.height };

  return {
    name, open, foot, layoutPoint, fromLayout, toLayout, turnMatrix,
    gatewayLocs, turnGatewayObject, gatewayPortals, extendLobbyArena, gatewayFloor,
    gatewayCovers: gatewayFloor, gatewayMeshes, gatewayHit, gatewayAnchor,
  };
}
