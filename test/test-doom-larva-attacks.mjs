// A larva of the Doom of Mokhaiotl hit with a demonbane weapon costs the
// weapon no time (client/encounters/doom-of-mokhaiotl/encounter.js,
// attackOnCooldown): with the weapon ready, he is shot the tick after the
// larva; cooling down, the timer is kept. A larva the arrow in the air will
// kill is not shot again. Any other weapon starts its delay again. Plain Node
// with the harness's module hooks and the trimmed cache.
import assert from "node:assert/strict";
import { loadEnvironment } from "../tools/determinism/harness.mjs";

const { prepareArena, engineModule, objTypeLoader } = await loadEnvironment();
await prepareArena("doom_of_mokhaiotl");

const scorchingBow = 29591; // demonbane (formula.js)
const twistedBow = 20997;
const dragonArrow = 11212;
const boss = "doom";

function startFight(weapon) {
  const engine = engineModule.createSimulationEngine({
    encounterConfig: { kind: "doom_of_mokhaiotl", mechanics: { doomDelve: "1", infiniteHealth: true } },
    objTypeLoader,
    combatSeed: 3,
    inventory: new Array(28).fill(null),
    equipment: { weapon },
    combatSupplies: { ...engineModule.createEmptyCombatSupplies(), equippedAmmo: { id: dragonArrow } },
    attackStylePerCategory: {},
    startPosition: [31, 28],
  });
  // Every attack the player starts, by tick and target.
  const attacks = [];
  const started = engine.encounter.onPlayerAttackStarted.bind(engine.encounter);
  engine.encounter.onPlayerAttackStarted = (attack, context) => {
    attacks.push([attack.tick, attack.targetId]);
    return started(attack, context);
  };
  return { engine, attacks };
}
// Ticks, the player standing still, until `until` is true; at most 30.
function tickUntil(engine, until) {
  for (let ticks = 0; ticks < 30; ticks++) {
    if (until()) return;
    step(engine);
  }
  assert.fail("waited 30 ticks");
}
// The input the application gives when no tile is clicked.
const step = (engine) => engine.advanceTick(engine.getState().playerPosition);
const click = (engine, targetId) => engine.injectAction({ type: "attackTarget", targetId });
// A plain larva (2 hitpoints, no prayer) south of the player, out of his way.
function dropLarva(engine) {
  const doom = engine.encounter;
  const id = "doom-larva-" + doom.larvae.count;
  doom.later(0, (context) => doom.larvae.spawnOne(context, [31, 25], { npcTypeId: 14710 }));
  step(engine);
  assert.ok(engine.worldState.getNpc(id)?.alive, "the larva is there");
  return id;
}
const ready = (engine) => engine.currentTick >= (engine.combatSystem.getNextAttackTick("player") ?? 0);
const attacksAfter = (attacks, tick) => attacks.filter(([at]) => at > tick);

// Scorching bow, ready: the larva, then him the tick after.
{
  const { engine, attacks } = startFight(scorchingBow);
  click(engine, boss);
  tickUntil(engine, () => attacks.length === 1);
  click(engine, null);
  const larva = dropLarva(engine);
  tickUntil(engine, () => ready(engine));
  click(engine, larva);
  step(engine);
  const [[shot, target]] = attacksAfter(attacks, attacks[0][0]);
  assert.equal(target, larva);
  assert.ok(engine.encounter.doomed.includes(larva), "the arrow in the air kills it");
  // Staying on it: not shot again, the attack on it ends.
  step(engine);
  assert.deepEqual(attacksAfter(attacks, shot), [], "a larva about to die is not shot again");
  assert.notEqual(engine.player().attackTarget, larva);
  click(engine, boss);
  step(engine);
  assert.deepEqual(attacksAfter(attacks, shot), [[shot + 2, boss]], "him the tick he is clicked: the larva started no delay");
}

// Scorching bow, cooling down: the larva at once, and him on the beat of his last.
{
  const { engine, attacks } = startFight(scorchingBow);
  const larva = dropLarva(engine);
  click(engine, boss);
  tickUntil(engine, () => attacks.length === 1);
  const [[first]] = attacks;
  const beat = engine.combatSystem.getNextAttackTick("player");
  click(engine, larva);
  step(engine);
  click(engine, boss);
  tickUntil(engine, () => attacks.length === 3);
  assert.deepEqual(attacks, [[first, boss], [first + 1, larva], [beat, boss]]);
}

// Twisted bow (not demonbane), ready: the larva starts the bow's delay.
{
  const { engine, attacks } = startFight(twistedBow);
  click(engine, boss);
  tickUntil(engine, () => attacks.length === 1);
  click(engine, null);
  const larva = dropLarva(engine);
  tickUntil(engine, () => ready(engine));
  click(engine, larva);
  step(engine);
  const [, [shot, target]] = attacks;
  assert.equal(target, larva);
  const delay = engine.combatSystem.getNextAttackTick("player") - shot;
  assert.ok(delay > 1);
  click(engine, boss);
  tickUntil(engine, () => attacks.length === 3);
  assert.deepEqual(attacks[2], [shot + delay, boss]);
}

// Twisted bow, cooling down: the larva at once, and its delay starts again.
{
  const { engine, attacks } = startFight(twistedBow);
  const larva = dropLarva(engine);
  click(engine, boss);
  tickUntil(engine, () => attacks.length === 1);
  const [[first]] = attacks;
  const speed = engine.combatSystem.getNextAttackTick("player") - first;
  click(engine, larva);
  step(engine);
  click(engine, boss);
  tickUntil(engine, () => attacks.length === 3);
  assert.deepEqual(attacks, [[first, boss], [first + 1, larva], [first + 1 + speed, boss]]);
}
console.log("A demonbane hit on a Doom larva costs the weapon no time, a dying larva is not shot again, other weapons wait");
process.exit(0);
