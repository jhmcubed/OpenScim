// Yama, the whole fight (kind "yama_full"): the challenge, phases 1 and 2 with
// the Judge after each, then phase 3 (client/encounters/yama/YamaFullEncounter.js).
import { attack, boss, command, equip, item, magicGear, protect, setBossHp, use } from "./common.mjs";

const challenge = (api) => command(api, { encounter: "yama_full", type: "challenge" });
const snapshot = (api) => api.engine.getEncounterSnapshot();
const phase = (api) => snapshot(api).state.phase;
const PROTECTION = { magic: "ProtectMagic", range: "ProtectRange", melee: "ProtectMelee" };
function protectFrom(api, style) {
  if (api.player().activePrayer !== PROTECTION[style]) protect(api, PROTECTION[style]);
}
function target(api, npc) {
  if (!npc || npc.untargetable || api.player().attackTarget === npc.id) return;
  attack(api, npc.id);
}
function walkTo(api, [x, y]) {
  api.act({ type: "attackTarget", targetId: null });
  api.moveTo(x, y);
}
const judge = (api) => api.npcs().find((npc) => npc.id === "yama-judge");
function wield(api, itemId) {
  const slot = api.player().inventory.findIndex((held) => held?.id === itemId);
  if (slot >= 0) equip(api, slot, "weapon");
}
// The Judge prays against magic after a magic hit and against melee after a melee one: the weapons in turn.
function fightJudge(api) {
  const npc = judge(api);
  if (!npc?.alive) return;
  const magicProtected = npc.overheadPrayers?.includes("magic");
  wield(api, magicProtected ? item.osmumtensFang : item.tumekensShadow);
  target(api, npc);
}

const mage = { ...magicGear, inventory: [item.osmumtensFang, item.superRestore, item.superRestore, item.anglerfish, item.anglerfish] };
const sanfewSerum = 10925; // its cure gives 600 ticks of immunity to poison (client/engine/consumables.js)
// The style of the attack Yama began last tick (phases 1 and 2 keep his windup to themselves).
const yamaStyle = (api) => api.engine.getLastTickEvents().find((event) => event.type === "attack_started" && event.sourceId === "yama")?.style;
// The Judge's side, then the fight on: a click on each stone up to him (a click on the lava does nothing), off the
// last one onto his platform, then the Judge. `lastY`: the row of stones to stop on.
const stones = [[7, 31], [6, 34], [7, 37], [7, 40], [6, 43], [7, 46]];
function judgeVisit(api, lastY = 46) {
  const y = api.player().position[1];
  const stone = stones.find((tile) => tile[1] > y && tile[1] <= lastY);
  if (stone) api.moveTo(...stone);
  else if (y < 47 && lastY === 46) api.moveTo(7, 48);
  else if (y >= 47) fightJudge(api);
}

export const scenarios = [
  // Never challenged: Yama stays on his throne and nothing happens.
  {
    name: "yama-full/unchallenged",
    kind: "yama_full",
    seed: 1,
    ticks: 30,
    ...mage,
    script() {},
  },

  // Challenged on tick 1 and fought with every hazard taken and no glyph: infinite health carries the player through
  // phase 1, the first crossing to the Judge, phase 2, the second crossing and into phase 3. A sanfew serum before
  // the challenge keeps his autos' poison off for 600 ticks; in phase 3 they poison him again.
  {
    name: "yama-full/stands-in-everything",
    kind: "yama_full",
    seed: 7,
    ticks: 700,
    mechanics: { infiniteHealth: true },
    ...mage,
    inventory: [...mage.inventory, sanfewSerum],
    script(tick, api) {
      if (tick === 1) use(api, mage.inventory.length);
      if (tick === 2) challenge(api);
      const now = phase(api);
      if (now.startsWith("judge")) return judgeVisit(api);
      wield(api, item.tumekensShadow);
      target(api, boss(api));
    },
  },

  // The same fight played: prays against each attack, takes a glyph of its element for each special.
  {
    name: "yama-full/glyphs-and-prayers",
    kind: "yama_full",
    seed: 21,
    ticks: 700,
    mechanics: { infiniteHealth: true },
    ...mage,
    script(tick, api) {
      if (tick === 1) challenge(api);
      const now = phase(api);
      if (now.startsWith("judge")) return judgeVisit(api);
      const yama = boss(api);
      if (!yama) return;
      const style = now === "p3" ? yama.state.windup?.style : yamaStyle(api);
      if (style) protectFrom(api, style);
      // On each special's slot, walk onto the centre of a lit glyph of the majority's colour.
      const lit = snapshot(api).state.glyphs.find((glyph) => glyph.state === "lit");
      if ((now === "p1" || now === "p2") && lit && tick % 40 === 0) walkTo(api, [lit.tile[0] + 1, lit.tile[1] + 1]);
      else {
        wield(api, item.tumekensShadow);
        target(api, yama);
      }
    },
  },

  // Protect from Magic on through phase 1, clicked again whenever it is off: the first shadow wave turns it off,
  // and the clicks of the next 2 ticks are refused.
  {
    name: "yama-full/wave-drops-prayer",
    kind: "yama_full",
    seed: 7,
    ticks: 100,
    mechanics: { infiniteHealth: true },
    ...mage,
    script(tick, api) {
      if (tick === 1) challenge(api);
      if (phase(api) !== "p1") return;
      protectFrom(api, "magic");
      wield(api, item.tumekensShadow);
      target(api, boss(api));
    },
  },

  // No glyph and no prayer: the phase-1 fire special lands and sets him alight, a kept-down Yama goes to his Judge
  // with the burn cut short, and in phase 2 a shadow stomp lands and binds him.
  {
    name: "yama-full/specials-land",
    kind: "yama_full",
    seed: 21,
    ticks: 230,
    mechanics: { infiniteHealth: true },
    ...mage,
    script(tick, api) {
      if (tick === 1) challenge(api);
      const now = phase(api);
      if (now.startsWith("judge")) return judgeVisit(api);
      const yama = boss(api);
      if (!yama) return;
      if (now === "p1" && tick > 28 && yama.vitals.hp > 1660) setBossHp(api, 1660);
      wield(api, item.tumekensShadow);
      target(api, yama);
    },
  },

  // Protect from Magic on at prayer level 2, then onto a lit Glyph of Shadow: its drain (2 or more) empties them and
  // switches every prayer off; Yama's magic is then unprotected.
  {
    name: "yama-full/glyph-empties-prayer",
    kind: "yama_full",
    seed: 7,
    ticks: 60,
    mechanics: { infiniteHealth: true },
    ...mage,
    stats: { ...Object.fromEntries(["attack", "strength", "defence", "ranged", "magic", "hitpoints", "agility"].map((skill) => [skill, { current: 99, max: 99 }])), prayer: { current: 2, max: 2 } },
    script(tick, api) {
      if (tick === 1) challenge(api);
      const glyph = snapshot(api).state.glyphs.find((candidate) => candidate.element === "shadow" && candidate.state === "lit");
      if (phase(api) !== "p1" || !glyph) return;
      if (api.player().prayerState.points > 0 && api.player().activePrayer !== "ProtectMagic") return protect(api, "ProtectMagic");
      walkTo(api, [glyph.tile[0] + 1, glyph.tile[1] + 1]);
    },
  },

  // Kept down to his first Judge, the player waits on the stones of y 43 until the Judge's 6th attack: every attack
  // until then sends spells, and his fireballs begin once the player is on the platform. One spell walks over him.
  {
    name: "yama-full/waits-on-the-stones",
    kind: "yama_full",
    seed: 21,
    ticks: 170,
    mechanics: { infiniteHealth: true },
    ...mage,
    script(tick, api) {
      if (tick === 1) challenge(api);
      const now = phase(api);
      if (tick === 1 || now !== "judge1") this.arrival = undefined;
      else this.arrival ??= tick;
      if (now === "judge1" && tick < this.arrival + 21) return judgeVisit(api, 43); // his attacks: arrival + 1, 5, 9, 13, 17, 21
      if (now.startsWith("judge")) return judgeVisit(api);
      const yama = boss(api);
      if (!yama) return;
      if (now === "p1" && tick > 28 && yama.vitals.hp > 1660) setBossHp(api, 1660);
      wield(api, item.tumekensShadow);
      target(api, yama);
    },
  },

  // Yama put at 1 hitpoint in phase 1 and hit on: he cannot die before phase 3, so he goes through both phases and
  // both Judges at 1, and dies in phase 3. The throne NPC is back 5 ticks after his death and speaks after 9; the run
  // is won after 11.
  {
    name: "yama-full/no-kill-before-phase-3",
    kind: "yama_full",
    seed: 7,
    ticks: 400,
    mechanics: { infiniteHealth: true },
    ...mage,
    script(tick, api) {
      if (tick === 1) challenge(api);
      const now = phase(api);
      if (now.startsWith("judge")) return judgeVisit(api);
      const yama = boss(api);
      if (!yama) return;
      if (now === "p1" && tick === 30) setBossHp(api, 1);
      wield(api, item.tumekensShadow);
      target(api, yama);
    },
  },
];
