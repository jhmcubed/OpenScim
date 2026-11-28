import { canNpcActAtTick } from "../../engine/npcState.js";
import {
  neutralPrayerMultipliers,
  getSingleRollHitChance,
  getNpcAttackRoll,
  getPlayerDefenceRoll,
  getPrayerMultipliers,
  getFormulaMaxHit,
  getDrainedNpcFormulaStats,
  getPlayerFormulaStats,
} from "../../engine/combatFormulas.js";
import { getDistanceFromNpcCentre } from "../shared/npcAttack.js";
import { defineNpc } from "../shared/npcDefinitions.js";
import { getProjectileSourcePosition } from "../shared/npcHelpers.js";
import { emitZukAttack, emitInfernoVisual } from "./events.js";
import { createInfernoActor } from "./actors.js";
import { emitZukHit } from "./monsterHelpers.js";
// `glyph` and `shield` are one thing in this directory: Zuk's shield.
function planZukShieldMove(glyph, config, tick) {
  if (tick < glyph.state.nextMoveTick) {
    return null;
  }
  const endpointTile = config.endpoints[glyph.state.targetEndpoint];
  const nextTile = [
    glyph.position[0] + Math.sign(endpointTile[0] - glyph.position[0]),
    glyph.position[1] + Math.sign(endpointTile[1] - glyph.position[1]),
  ];
  const reachesEndpoint = nextTile[0] === endpointTile[0] && nextTile[1] === endpointTile[1];
  return {
    movement: {
      npcId: glyph.id,
      path: [nextTile],
    },
    state: {
      targetEndpoint: reachesEndpoint
        ? glyph.state.targetEndpoint === 1
          ? 0
          : 1
        : glyph.state.targetEndpoint,
      nextMoveTick: tick + 1 + (reachesEndpoint ? config.endpointPauseTicks : 0),
    },
  };
}
var zukShieldNpcDefinition = defineNpc({
  id: "inferno-glyph",
  onDamageResolved: ({ actor: actor, damage: damage, context: context }) => {
    if (!(damage.hpAfter <= 0)) {
      emitInfernoVisual(context.tickEvents, {
        animations: [
          {
            actorId: actor.id,
            clipId: "hit",
            delayCycles: 0,
          },
        ],
        projectiles: [],
        graphics: [],
      });
    }
  },
  move: ({ actor: actor, config: config, context: context }) => {
    if (!canNpcActAtTick(actor, context.tick)) {
      return [];
    }
    const patrolStep = planZukShieldMove(actor, config, context.tick);
    if (patrolStep) {
      actor.state.targetEndpoint = patrolStep.state.targetEndpoint;
      actor.state.nextMoveTick = patrolStep.state.nextMoveTick;
      return [patrolStep.movement];
    } else {
      return [];
    }
  },
});
function createZukShield(glyphSetup) {
  return zukShieldNpcDefinition.createActor(
    {
      ...createInfernoActor("shield", glyphSetup.id, [...glyphSetup.position]),
      lockedFacing: 0,
      spawnTick: glyphSetup.spawnTick,
    },
    {
      targetEndpoint: glyphSetup.targetEndpoint,
      nextMoveTick: glyphSetup.spawnTick + 1,
    },
  );
}
var zukBlastPrayerReduction = {
  type: "bypass",
};
function rollZukBlast(rollOptions) {
  const {
    attacker: attacker,
    target: target,
    targetEquipmentStats: targetEquipmentStats,
    random: random,
  } = rollOptions;
  const targetPrayerMultipliers = rollOptions.targetPrayerMultipliers ?? neutralPrayerMultipliers;
  const accuracy = getSingleRollHitChance(
    Math.floor((getNpcAttackRoll(attacker, "ranged") + getNpcAttackRoll(attacker, "magic")) / 2),
    Math.floor(
      (getPlayerDefenceRoll(target, "ranged", targetEquipmentStats, targetPrayerMultipliers) +
        getPlayerDefenceRoll(target, "magic", targetEquipmentStats, targetPrayerMultipliers)) /
        2,
    ),
  );
  const maxHit = Math.floor(
    (getFormulaMaxHit(attacker, "ranged", targetEquipmentStats) +
      getFormulaMaxHit(attacker, "magic", targetEquipmentStats)) /
      2,
  );
  return {
    accuracy: accuracy,
    accuracySucceeded: random() < accuracy,
    maxHit: maxHit,
    rolledDamage: Math.floor(random() * (maxHit + 1)),
  };
}
var zukNpcDefinition = defineNpc({
  id: "inferno-zuk",
  move: false,
  onDeathStarted: ({ actor: actor, context: context }) =>
    context.world.removePendingHitsFromSource(actor.id),
  onDamageResolved: ({
    actor: actor,
    damage: damage,
    config: config,
    context: context,
  }) => {
    emitZukHit({
      actor: actor,
      damage: damage,
      context: context,
    });
    if (
      damage.sourceId === "player" &&
      !(damage.effectiveDamage <= 0) &&
      !(damage.hpAfter <= 0)
    ) {
      if (!actor.state.jadSpawned && damage.hpAfter < zukJadHpThreshold) {
        actor.state.jadSpawned = true;
        config.spawnJad(actor.id, context);
      }
      if (!actor.state.healersSpawned && damage.hpAfter < zukHealersHpThreshold) {
        actor.state.healersSpawned = true;
        actor.state.enragedAt ??= damage.tick;
        config.spawnHealers(actor.id, context);
      }
    }
  },
  tick: ({ actor: actor, config: config, context: context }) => {
    const noAttack = {
      environmentalDamages: [],
    };
    if (!actor.alive || !config.attacksEnabled()) {
      return noAttack;
    }
    const glyph = context.world.getNpc(actor.state.glyphId);
    const liveGlyph = glyph?.alive ? glyph : null;
    const player = context.world.getPlayer();
    if (!player?.alive) {
      return noAttack;
    }
    if (context.tick < getNextZukCastTick(actor.state, context.tick)) {
      return noAttack;
    }
    actor.state.lastCastTick = context.tick;
    const targetsPlayer = !liveGlyph || config.targetsPlayer(liveGlyph.position[0], player.position);
    const blastTarget = !liveGlyph || targetsPlayer ? player : liveGlyph;
    actor.combat.targetId = blastTarget.id;
    const projectileArrivalCycles = 16 + getDistanceFromNpcCentre(actor, player) * 10;
    const impactDelayTicks = Math.floor(projectileArrivalCycles / 30);
    emitInfernoVisual(context.tickEvents, {
      animations: [
        {
          actorId: actor.id,
          clipId: "attack",
          delayCycles: 0,
        },
        ...(targetsPlayer
          ? []
          : [
              {
                actorId: blastTarget.id,
                clipId: "hit",
                delayCycles: projectileArrivalCycles,
              },
            ]),
      ],
      projectiles: [
        {
          spotAnimId: 1375,
          sourcePosition: getProjectileSourcePosition(actor),
          target: {
            kind: "actor",
            actorId: blastTarget.id,
            size: blastTarget.size,
            position: [...blastTarget.position],
          },
          startDelayCycles: Math.min(50, projectileArrivalCycles),
          endDelayCycles: projectileArrivalCycles,
          slope: 0,
          startOffset: targetsPlayer ? 128 : 64,
          startHeight: 390,
          endHeight: 124,
        },
      ],
      graphics: targetsPlayer
        ? [
            {
              spotAnimId: 131,
              target: {
                kind: "actor",
                actorId: blastTarget.id,
                size: blastTarget.size,
                position: [...blastTarget.position],
              },
              delayCycles: projectileArrivalCycles,
              height: 124,
            },
          ]
        : [],
    });
    emitZukAttack(context, {
      attack: "zuk_blast",
      sourceId: actor.id,
      targetId: blastTarget.id,
      sourcePosition: [
        actor.position[0] + Math.floor(actor.size / 2),
        actor.position[1] + Math.floor(actor.size / 2),
      ],
      targetPosition: blastTarget.position,
      launchTick: context.tick,
      impactTick: context.tick + impactDelayTicks,
      projectileArrivalCycles: projectileArrivalCycles,
    });
    if (!targetsPlayer) {
      return noAttack;
    }
    const formulaStats = getDrainedNpcFormulaStats(actor);
    if (!formulaStats) {
      throw new TypeError("Zuk requires formula stats");
    }
    const blastRoll = rollZukBlast({
      attacker: formulaStats,
      target: getPlayerFormulaStats(player),
      targetEquipmentStats: player.equipmentStats,
      targetPrayerMultipliers: getPrayerMultipliers(player.activePrayer, player.offensivePrayer, player.independentPrayers),
      random: context.random,
    });
    return {
      environmentalDamages: [],
      npcAttacks: [
        {
          attackerId: actor.id,
          targetId: player.id,
          style: "typeless",
          attackKind: "typeless",
          rolledDamage: blastRoll.rolledDamage,
          damageCap: "none",
          accuracySucceeded: blastRoll.accuracySucceeded,
          impactDelayTicks: impactDelayTicks,
          prayerReduction: zukBlastPrayerReduction,
          sourceDeathPolicy: "persist",
        },
      ],
    };
  },
  attackTimer: ({ actor: actor, config: config, context: context }) =>
    config.attacksEnabled()
      ? {
          nextAttackTick: getNextZukCastTick(actor.state, context.tick),
          attackSpeed: getZukCastIntervalTicks(actor.state, context.tick),
        }
      : null,
});
function getNextZukCastTick(state, tick) {
  if (state.lastCastTick === null) {
    return state.firstCastTick;
  } else {
    return state.lastCastTick + getZukCastIntervalTicks(state, tick);
  }
}
// Under 480 hitpoints Zuk calls Jad, under 240 his healers (and is enraged).
var zukJadHpThreshold = 480;
var zukHealersHpThreshold = 240;
var zukCastIntervalTicks = 10;
var enragedZukCastIntervalTicks = 7;
function getZukCastIntervalTicks(state, tick) {
  if (state.enragedAt !== null && tick > state.enragedAt) {
    return enragedZukCastIntervalTicks;
  } else {
    return zukCastIntervalTicks;
  }
}
export { planZukShieldMove, zukShieldNpcDefinition, createZukShield, zukNpcDefinition, zukJadHpThreshold, zukHealersHpThreshold, zukCastIntervalTicks };
