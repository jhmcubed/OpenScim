// The bosses that stand in the lobby, one on each boss station of the hall
// (lobby/hall.js says where, and which fight each opens). They are scenery:
// the renderer draws them and a click on one opens its fight's setup window,
// but the simulation has no NPC of them.
import { bossStations } from "../../lobby/hall.js";

var lobbyNpcs = bossStations.map((station) => ({
  actorId: station.actorId,
  npcTypeId: station.npcTypeId,
  position: station.position,
  facingAngle: station.facingAngle,
  ...(station.displaySize ? { displaySize: station.displaySize } : {}),
  available: true,
}));
export { lobbyNpcs };
