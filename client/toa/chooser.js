// The pyramid's list of fights: the bosses behind the nexus's doors, each of
// whose button opens that boss's setup window (lobby/chooser.js). A boss whose
// fight is not built yet opens its window as "Coming Soon", as its door does.
import { nexusDoors } from "./nexus.js";
import { chooseFight } from "../lobby/chooser.js";

export function chooseToaBoss(select) {
  chooseFight(
    {
      title: "Tombs of Amascut",
      subtitle: "The bosses of the Tombs. Choose one.",
      rows: nexusDoors
        .filter((door) => !door.exit)
        .map((door) => ({
          name: door.boss,
          note: door.name,
          colour: "#f2c45a",
          fights: [{ label: "Fight", encounterKind: door.encounterKind, displayName: door.boss, description: door.name + ", in the Tombs of Amascut." }],
        })),
    },
    select,
  );
}
