// The window a gateway opens: a list of the fights behind it, one row each.
// A row's buttons open that fight's setup window; a fight not built yet shows
// "Coming soon" and no button. The Desert Treasure II vault, the pyramid of
// Necropolis and the raids' other doors all open one.

// Colours and fonts come from the application's stylesheet.
const style = `
.lobby-chooser { width: min(440px, 92vw); padding: 16px; color: inherit; background: var(--color-bg-solid, #1e1812);
  border: 1px solid var(--modal-card-border, #5d5245); border-radius: var(--modal-radius, 6px);
  font-family: "RuneScape Bold 12", sans-serif; }
.lobby-chooser::backdrop { background: var(--modal-backdrop, rgb(0 0 0 / 0.6)); }
.lobby-chooser h2 { margin: 0 0 2px; }
.lobby-chooser p { margin: 0 0 12px; opacity: 0.7; }
.lobby-chooser li { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.lobby-chooser ul { margin: 0 0 14px; padding: 0; max-height: 60vh; overflow-y: auto; }
.lobby-chooser i { width: 10px; height: 28px; border-radius: 2px; flex: none; }
.lobby-chooser span { flex: 1; }
.lobby-chooser small { display: block; opacity: 0.6; }
.lobby-chooser em { font-style: normal; opacity: 0.55; }
`;

const escape = (text) => String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/**
 * Shows the list. `rows` are { name, note?, colour? (CSS), fights: [{ label,
 * encounterKind, displayName, description }] }; a row with no fights is not
 * built yet. `select({ encounterKind, displayName, description })` opens the
 * setup window of the chosen fight.
 */
export function chooseFight({ title, subtitle, rows }, select) {
  const fights = new Map();
  const button = (fight) => {
    fights.set(fight.encounterKind, fight);
    return `<button class="osrs-btn osrs-btn--default" value="${escape(fight.encounterKind)}">${escape(fight.label)}</button>`;
  };
  const dialog = document.createElement("dialog");
  dialog.className = "lobby-chooser";
  dialog.innerHTML = `<style>${style}</style>
    <form method="dialog">
      <h2>${escape(title)}</h2>
      <p>${escape(subtitle)}</p>
      <ul>${rows.map((row) => `
        <li>
          <i style="background: ${row.colour ?? "var(--modal-card-border, #5d5245)"}"></i>
          <span>${escape(row.name)}${row.note ? `<small>${escape(row.note)}</small>` : ""}</span>
          ${row.fights?.length ? row.fights.map(button).join("") : "<em>Coming soon</em>"}
        </li>`).join("")}
      </ul>
      <button class="osrs-btn osrs-btn--ghost" value="">Close</button>
    </form>`;
  // A button closes the dialog with its value; Escape closes it with none.
  dialog.addEventListener("close", () => {
    dialog.remove();
    const fight = fights.get(dialog.returnValue);
    if (fight) select({ encounterKind: fight.encounterKind, displayName: fight.displayName, description: fight.description });
  });
  document.body.append(dialog);
  dialog.showModal();
}
