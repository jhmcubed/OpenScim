import { extendLobbyArena } from "/lobby/gateways.js";
import { lobbyNpcs } from "./lobbyNpcs.js";
import { platform, plinthRadius, spawn } from "../../lobby/hall.js";
import { CollisionFlag } from "../../engine/collision.js";
import { activeOutcome } from "../shared/npcHelpers.js";
var LobbyEncounter = class {
  kind = "lobby";
  getDefaultPlayerStart() {
    return [...spawn.tile];
  }
  getIntroConfig() {
    return {
      facingAngle: spawn.facingAngle,
      animationSeqId: 12152,
    };
  }
  createNpcs(startPosition) {
    return [];
  }
  reset(seeds) {}
  getSeeds() {
    return {};
  }
  resolveHazards(context, mechanics) {
    return [];
  }
  processPostTick(context, mechanics) {
    return [];
  }
  getSnapshot() {
    return {
      kind: "lobby",
      state: {},
      visuals: {},
    };
  }
  getOutcome() {
    return activeOutcome;
  }
  getDefaultMechanicsConfig() {
    return {
      infiniteHealth: false,
    };
  }
  getNpcDamageSourceLabel() {
    return "NpcAttack";
  }
  getArenaConfig() {
    if (lobbyArenaCache) {
      return lobbyArenaCache;
    }
    const walkableTiles = new Set();
    const flags = new Int32Array(4096);
    for (let x = 0; x < lobbyGridSize; x++) {
      for (let y = 0; y < lobbyGridSize; y++) {
        const dx = x + 0.5 - lobbyCenterX;
        const dy = y + 0.5 - lobbyCenterY;
        if (Math.sqrt(dx * dx + dy * dy) <= lobbyRadius) {
          walkableTiles.add(`${x},${y}`);
        }
      }
    }
    const blockTile = (x, y) => {
      const tileX = Math.floor(x);
      const tileY = Math.floor(y);
      if (tileX >= 0 && tileX < lobbyGridSize && tileY >= 0 && tileY < lobbyGridSize) {
        flags[tileX + tileY * lobbyGridSize] |= CollisionFlag.OBJECT;
        walkableTiles.delete(`${tileX},${tileY}`);
      }
    };
    const blockDisc = (centerX, centerY, radius) => {
      const fromX = Math.floor(centerX - radius);
      const toX = Math.floor(centerX + radius);
      const fromY = Math.floor(centerY - radius);
      const toY = Math.floor(centerY + radius);
      for (let x = fromX; x <= toX; x++) {
        for (let y = fromY; y <= toY; y++) {
          const dx = x + 0.5 - centerX;
          const dy = y + 0.5 - centerY;
          if (dx * dx + dy * dy <= radius * radius) {
            blockTile(x, y);
          }
        }
      }
    };
    // Each boss stands on a plinth (lobby/hall.js): the player walks around it.
    for (const lobbyNpc of lobbyNpcs) {
      blockDisc(lobbyNpc.centre[0], lobbyNpc.centre[1], plinthRadius);
    }
    extendLobbyArena(walkableTiles, blockTile);
    const collisionMap = {
      sizeX: lobbyGridSize,
      sizeY: lobbyGridSize,
      flags: flags,
      getFlag: (x, y) =>
        x < 0 || x >= lobbyGridSize || y < 0 || y >= lobbyGridSize ? -1 : flags[x + y * lobbyGridSize],
      hasFlag(x, y, mask) {
        const flag = this.getFlag(x, y);
        return flag !== -1 && (flag & mask) !== 0;
      },
      flag(x, y, mask) {
        if (x >= 0 && x < lobbyGridSize && y >= 0 && y < lobbyGridSize) {
          flags[x + y * lobbyGridSize] |= mask;
        }
      },
      unflag(x, y, mask) {
        if (x >= 0 && x < lobbyGridSize && y >= 0 && y < lobbyGridSize) {
          flags[x + y * lobbyGridSize] &= ~mask;
        }
      },
    };
    let minX = lobbyGridSize;
    let maxX = 0;
    let minY = lobbyGridSize;
    let maxY = 0;
    for (const tileKey of walkableTiles) {
      const [x, y] = tileKey.split(",").map(Number);
      if (x < minX) {
        minX = x;
      }
      if (x > maxX) {
        maxX = x;
      }
      if (y < minY) {
        minY = y;
      }
      if (y > maxY) {
        maxY = y;
      }
    }
    return (lobbyArenaCache = {
      bounds: {
        minX: minX,
        maxX: maxX,
        minY: minY,
        maxY: maxY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
      },
      walkableTiles: walkableTiles,
      collisionMap: collisionMap,
    });
  }
};
// The platform (lobby/gateway.js): the player walks to half a tile from its rim.
var lobbyCenterX = platform.x;
var lobbyCenterY = platform.y;
var lobbyRadius = platform.radius - 0.5;
var lobbyGridSize = 64;
var lobbyArenaCache = null;
export { LobbyEncounter };
