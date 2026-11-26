// The Maggot King's rules a player practises: larvae shot in the air a tick
// apart, the King after the last one's attack delay; and hitpoints set before
// his first turn (the practice panel, during the countdown) open the run in
// the phase they call for. A fight of the harness, no browser.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { cacheZip, runScenario } from "../tools/determinism/harness.mjs";
import { attack, rangedGear, setBossHp } from "../tools/determinism/scenarios/common.mjs";

const skip = !existsSync(cacheZip) && `${cacheZip} is missing (npm run assets)`;
const BOSS = "maggot-king";
const LARVA = 15743;

// Runs the fight from `hp` set on tick 1; `script` plays the player. Gives each tick: his phase, tile, clips, the
// player's attacks (target ids) and the larvae in the air.
async function ticksOf({ hp, ticks = 80, script }) {
  const seen = [];
  await runScenario(
    {
      name: "maggot-king-practice",
      kind: "maggot_king",
      seed: 9,
      ticks,
      mechanics: { infiniteHealth: true, infinitePrayer: true },
      ...rangedGear,
      script(tick, api) {
        if (tick === 1) setBossHp(api, hp);
        script?.(tick, api);
      },
    },
    {
      onTick(tick, engine) {
        const events = engine.getLastTickEvents();
        const { state } = engine.getEncounterSnapshot();
        seen[tick] = {
          phase: state.phase, style: state.style, final: state.final, y: engine.worldState.getNpc(BOSS).position[1],
          clips: events.filter((event) => event.type === "inferno_visual").flatMap((event) => event.animations.filter(({ actorId }) => actorId === BOSS).map(({ clipId }) => clipId)),
          attacks: events.filter((event) => event.type === "attack_started" && event.sourceId === "player").map((event) => event.targetId),
        };
      },
    },
  );
  return seen;
}
const firstClip = (ticks, clips) => ticks.findIndex((tick) => tick?.clips.some((clip) => clips.includes(clip)));

test("Maggot King: larvae shot a tick apart, then the King after the last one's delay", { skip }, async () => {
  // Below a fifth the first screech fills the room with four larvae. The player shoots the King, then each larva
  // in the air once, one a tick, then the King again.
  const shot = new Set();
  const ticks = await ticksOf({
    hp: 290,
    ticks: 60,
    script(tick, api) {
      const flying = api.npcs().filter((npc) => npc.npcTypeId === LARVA && npc.state?.landsAt > tick + 1 && !shot.has(npc.id));
      const target = flying.length && shot.size < 3 ? flying[0].id : BOSS;
      if (target !== BOSS) shot.add(target);
      if (api.player().attackTarget !== target) attack(api, target);
    },
  });
  const attacks = ticks.flatMap((tick, n) => (tick?.attacks ?? []).map((target) => ({ tick: n, larva: target !== BOSS })));
  const first = attacks.findIndex((entry) => entry.larva);
  const larvae = attacks.slice(first).filter((entry) => entry.larva).map((entry) => entry.tick);
  // The bow's delay: the shortest gap between the King's own attacks before the larvae.
  const speed = Math.min(...attacks.slice(1, first).map((entry, n) => entry.tick - attacks[n].tick));
  assert.ok(speed >= 3, JSON.stringify(attacks));
  // The second larva was shot while the bow cooled down from the first, the third from the second.
  assert.equal(larvae.length, 3, JSON.stringify(attacks));
  assert.deepEqual(larvae, [larvae[0], larvae[0] + 1, larvae[0] + 2]);
  // Each shot started the delay again: the King comes the bow's delay after the last larva, not after the first.
  const king = attacks.find((entry) => entry.tick > larvae[2] && !entry.larva);
  assert.equal(king?.tick, larvae[2] + speed, JSON.stringify(attacks));
});

test("Maggot King: hitpoints set before his first turn open the run in their phase", { skip }, async () => {
  // Below meleeHp: near at once, his first slam on his first turn, no spit before it.
  const near = await ticksOf({ hp: 900 });
  assert.deepEqual([near[1].phase, near[2].y], ["melee", 37]);
  assert.equal(firstClip(near, ["slam"]), 4);
  assert.equal(firstClip(near, ["range", "magic"]) > firstClip(near, ["screech"]), true);
  // After that rotation's screech, the first far one: ranged, as a fight's first is.
  const far = near.findIndex((tick, n) => n > 4 && tick?.phase === "distant");
  assert.equal(near[far].style, "range");
  assert.equal(near[firstClip(near, ["range", "magic"])].clips.includes("range"), true);

  // Below finalHp: near for good.
  const final = await ticksOf({ hp: 250 });
  assert.deepEqual([final[1].phase, final[1].final, firstClip(final, ["slam"])], ["melee", true, 4]);

  // Above meleeHp: far, as at full hitpoints.
  const high = await ticksOf({ hp: 1200, ticks: 10 });
  assert.deepEqual([high[1].phase, firstClip(high, ["range"]), firstClip(high, ["slam"])], ["distant", 4, -1]);
});
