// The boss chooser. The four fights share no room in the game, so the vault
// does not lead to one: it asks which boss, and the choice opens that boss's
// setup window. The window is the lobby's (lobby/chooser.js).
import { awakenedKind, bosses } from "./bosses.js";
import { chooseFight } from "../lobby/chooser.js";

// Hue, saturation and lightness of 0 to 255 as a CSS colour.
const css = ([h, s, l]) => `hsl(${(h * 360) / 255} ${(s * 100) / 255}% ${(l * 100) / 255}%)`;

// Shows the chooser. `select({ encounterKind, displayName, description })`
// opens the setup window of the chosen fight.
export function chooseBoss(select) {
  const description = (boss) => boss.place + ". Drops " + boss.element + " quartz.";
  chooseFight(
    {
      title: "The Forgotten Four",
      subtitle: "Desert Treasure II. Choose a boss.",
      rows: bosses.map((boss) => ({
        name: boss.name,
        note: boss.place,
        colour: css(boss.colour),
        fights: [
          { label: "Fight", encounterKind: boss.kind, displayName: boss.name, description: description(boss) },
          { label: "Awakened", encounterKind: awakenedKind(boss.kind), displayName: boss.name + " (Awakened)", description: description(boss) },
        ],
      })),
    },
    select,
  );
}
