// Araxxor (client/encounters/araxxor/). He comes up at 47,22 (7 x 7) with
// nine eggs around him; the player stands on 53,29, beside his north-east
// corner, where BigSneezi fought him in the recorded kills.
import { attack, boss, meleeGear, protect, rangedGear, setBossHp } from "./common.mjs";

const KIND = "araxxor";
const BOSS = "araxxor";
const besideHim = [53, 29];

// Fights him with melee from beside him, praying against it: his legs, a
// special every seventh attack and an egg every 42 ticks.
const meleeFight = (name, eggs, ticks) => ({
  name,
  kind: KIND,
  seed: 3,
  ticks,
  // He would kill a player who stands still in his acid.
  mechanics: { araxxorEggs: eggs, infiniteHealth: true },
  start: besideHim,
  ...meleeGear,
  script(tick, api) {
    if (tick === 1) {
      protect(api, "ProtectMelee");
      attack(api, BOSS);
    }
  },
});

export const scenarios = [
  // Red eggs first: the acid drip, and a Ruptura first out.
  meleeFight("araxxor/red-eggs", "red", 130),
  // Green eggs first: the rolling acid ball, and an Acidic first out.
  meleeFight("araxxor/green-eggs", "green", 130),
  // White eggs first: the acid spray, and a Mirrorback first out.
  meleeFight("araxxor/white-eggs", "white", 130),
  {
    // From the tunnel with a bow, praying against missiles: he walks up and
    // shoots or casts, and drains Defence or Prayer when it hurts.
    name: "araxxor/from-range",
    kind: KIND,
    seed: 5,
    ticks: 60,
    mechanics: { araxxorEggs: "green" },
    ...rangedGear,
    script(tick, api) {
      if (tick === 1) {
        protect(api, "ProtectRange");
        attack(api, BOSS);
      }
    },
  },
  {
    // Brought to 300 hitpoints and fought down past 255: the enrage and the
    // cleaves every 4 ticks. Every 8 ticks the player steps under him, so
    // that a cleave cuts him; then his death with the eggs and araxytes.
    name: "araxxor/enrage-and-kill",
    kind: KIND,
    seed: 11,
    ticks: 140,
    mechanics: { araxxorEggs: "red", infiniteHealth: true },
    start: besideHim,
    ...meleeGear,
    script(tick, api) {
      if (tick === 1) {
        protect(api, "ProtectMelee");
        attack(api, BOSS);
      }
      if (tick === 25) setBossHp(api, 300);
      const araxxor = boss(api);
      if (tick <= 25 || !araxxor) return;
      const { enraged } = api.engine.getEncounterSnapshot().state;
      if (enraged && tick % 8 === 0) {
        api.act({ type: "attackTarget", targetId: null }); // a click on the ground
        api.moveTo(araxxor.position[0] + 3, araxxor.position[1] + 5);
      } else if (tick % 8 > 1 && api.player().attackTarget !== BOSS) attack(api, BOSS);
    },
  },
];
