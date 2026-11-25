// The lobby: what the registry has of it (encounters/registry.js says what a
// definition holds). It has no route (`slug: null`) and makes its own arena.
import { LobbyEncounter } from "./LobbyEncounter.js";
import { spawn } from "../../lobby/hall.js";

export const definition = {
  kind: "lobby",
  slug: null,
  factory: () => new LobbyEncounter(),
  descriptor: {
    kind: "lobby",
    displayName: "Lobby",
    description: "Prifddinas lobby area",
    mapSquare: {
      x: 25,
      y: 73,
    },
    playerStart: [...spawn.tile],
    collision: {
      mode: "custom",
    },
  },
  controls: {
    defaultMechanicsConfig: {
      infiniteHealth: false,
    },
    mechanicsToggles: [],
    debugActions: [],
  },
};
export const order = 40;
