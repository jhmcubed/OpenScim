import { voidFlareImpactSpotAnimId } from "./voidFlareSpotAnim.js";
import { getMonsterHitpoints, getMonsterFormulaStats } from "../../engine/monsterStats.js";
import { detonatedDeathCause } from "./sceneConstants.js";
import { startScriptedNpcDeath } from "../../engine/npcState.js";
import { defineNpc } from "../shared/npcDefinitions.js";
import { healNpc } from "../shared/npcHelpers.js";
import { voidFlareNpcTypeId, mixSeed, voidFlareSpawnTiles } from "./constants.js";
function getExplosionDamageRange(explosionDamage, remainingHp) {
  if (Array.isArray(explosionDamage)) {
    return [explosionDamage[0], explosionDamage[1]];
  }
  const remainingHpDamage = Math.floor(Math.max(0, remainingHp) * explosionDamage.perRemainingHp);
  return [explosionDamage.atZeroHp[0] + remainingHpDamage, explosionDamage.atZeroHp[1] + remainingHpDamage];
}
function getExplosionHeal(damage) {
  return Math.floor((damage * 8) / 3);
}
var voidFlareNpcDefinition = defineNpc({
  id: "yama-void-flare",
  deathPolicy: "queued", // a kill is processed one tick later (client/engine/npcState.js)
  spawnUntargetableTicks: 3,
  move: false,
  onDefeated: ({ actor: actor, defeat: defeat }) => {
    actor.despawnTick = defeat.tick;
  },
  resolveLocalEffects: ({ actor: actor, config: config, context: context }) => {
    if (actor.state.lifecycle !== "charging") {
      return [];
    }
    if (!actor.alive) {
      actor.state.lifecycle = "destroyed";
      context.tickEvents.emit({
        type: "voidflare_destroyed",
        flareId: actor.id,
        position: actor.position,
        variant: actor.state.variant,
      });
      return [];
    }
    if (context.tick < actor.state.explodeTick) {
      return [];
    }
    startScriptedNpcDeath(actor, context.tick);
    actor.deathCause = detonatedDeathCause;
    actor.state.lifecycle = "detonated";
    const [minDamage, maxDamage] =
      config.explosionDamage === "lethal"
        ? [999, 999]
        : getExplosionDamageRange(config.explosionDamage, actor.vitals.hp);
    const damage =
      minDamage +
      (mixSeed(config.damageSeed, context.tick * 100 + actor.state.damageRollIndex) %
        (maxDamage - minDamage + 1));
    config.scheduleImpact({
      impactTick: context.tick + 1,
      damage: damage,
    });
    const boss = config.getBoss(context);
    // `healsOnImpact()` true: the encounter heals him as the blast lands, if it
    // does (the whole fight's glyphs take blasts).
    const heal =
      config.explosionDamage === "lethal" || config.healsOnImpact?.()
        ? 0
        : healNpc(
            boss,
            getExplosionHeal(damage),
            context.tickEvents,
          );
    context.tickEvents.emit({
      type: "voidflare_exploded",
      flareId: actor.id,
      position: actor.position,
      variant: actor.state.variant,
      damage: damage,
      heal: heal,
    });
    return [];
  },
});
function destroyVoidFlare(flare, context) {
  const state = voidFlareNpcDefinition.getState(flare);
  if (state && flare.alive && state.lifecycle === "charging") {
    startScriptedNpcDeath(flare, context.tick);
    flare.despawnTick = context.tick;
    state.lifecycle = "destroyed";
    context.tickEvents.emit({
      type: "voidflare_destroyed",
      flareId: flare.id,
      position: flare.position,
      variant: state.variant,
    });
  }
}
function createVoidFlareActor(flareOptions) {
  const currentHp = flareOptions.currentHp ?? 71;
  const maxHp = getMonsterHitpoints(14179) ?? currentHp;
  const formulaStats = getMonsterFormulaStats(voidFlareNpcTypeId);
  if (formulaStats === undefined) {
    throw new TypeError("Missing monster formula stats for NPC 14179");
  }
  const baseActor = {
    id: flareOptions.id,
    kind: "npc",
    role: "minion",
    alive: true,
    position: flareOptions.position,
    previousPosition: flareOptions.position,
    facing: 0,
    size: 2,
    vitals: {
      hp: currentHp,
      maxHp: maxHp,
    },
    npcTypeId: voidFlareNpcTypeId,
    archetypeId: "voidflare",
    history: new Map(),
    spawnTick: flareOptions.spawnTick,
    despawnTick: flareOptions.spawnTick + flareOptions.chargeTicks,
    despawnTimerLeadTicks: 2, // the timer over the flare ends 2 ticks before the despawn tick
    alwaysShowHealthBar: true,
    combat: {
      attackSpeed: 0,
      attackRange: 0,
      attackStyle: "typeless",
      nextActionTick: 0,
      targetId: null,
      lastAttackTick: null,
      animations: {
        idle: 12133,
        walk: null,
        run: null,
        attack: null,
        death: 12134,
      },
    },
    formulaStats: {
      ...formulaStats,
      alwaysMaximumPlayerHit: flareOptions.guaranteedPlayerMaximum ?? true,
      alwaysAccuratePlayerHit: true,
      demonbaneVulnerability: 2,
    },
  };
  return voidFlareNpcDefinition.createActor(baseActor, {
    damageRollIndex: flareOptions.damageRollIndex,
    explodeTick: flareOptions.spawnTick + flareOptions.chargeTicks,
    variant: flareOptions.variant ?? "shadow",
    lifecycle: "charging",
  });
}
var VoidFlareCoordinator = class {
  config;
  constructor(config) {
    this.config = config;
  }
  spawnPendingFlares(voidFlares, context, enabled) {
    const pendingSpawnCount = voidFlares.pendingSpawnCount;
    voidFlares.pendingSpawnCount = 0;
    if (enabled && pendingSpawnCount > 0) {
      this.spawnFlares(voidFlares, context, {
        count: pendingSpawnCount,
        hp: this.config.hp,
      });
    }
  }
  processPostTick(voidFlares, context, tickInfo) {
    if (tickInfo.enabled) {
      if (
        this.config.continuous &&
        context.tick > 0 &&
        context.tick % this.config.continuousIntervalTicks === 0
      ) {
        this.spawnFlares(voidFlares, context, {
          count: 1,
          hp: this.config.continuousHp,
        });
      }
      if (tickInfo.didPlanMelee) {
        voidFlares.pendingSpawnCount += 1;
      }
      if (tickInfo.beatInfo.isBeat && tickInfo.beatInfo.isVoidFlareBeat) {
        voidFlares.pendingSpawnCount += this.config.spawnCount;
      }
    }
  }
  resolvePendingImpacts(voidFlares, context, damages) {
    const player = context.world.getPlayer();
    if (player && player.alive) {
      voidFlares.pendingImpacts = voidFlares.pendingImpacts.filter((impact) => {
        if (impact.impactTick > context.tick) {
          return true;
        }
        context.tickEvents.emit({
          type: "player_graphic_applied",
          spotAnimId: voidFlareImpactSpotAnimId,
        });
        damages.push({
          baseDamage: impact.damage,
          attackType: "typeless",
          source: "VoidFlare",
          playerPosition: [player.position[0], player.position[1]],
        });
        return false;
      });
    }
  }
  spawnManualFlare(voidFlares, context) {
    const activeFlares = this.getActiveFlares(context.world);
    if (activeFlares.length >= this.config.maxActive) {
      return;
    }
    const spawnTile = this.pickSpawnTile(
      voidFlares,
      context.playerPos,
      activeFlares.map((flare) => flare.position),
    );
    if (spawnTile) {
      return this.spawnFlareAt(voidFlares, context, {
        position: spawnTile,
        hp: this.config.hp,
      });
    } else {
      return undefined;
    }
  }
  clearFlares(voidFlares, context, defeatTick) {
    voidFlares.pendingSpawnCount = 0;
    voidFlares.pendingImpacts = [];
    voidFlares.spawnIndex = voidFlares.seed % voidFlareSpawnTiles.length;
    voidFlares.nextId = 0;
    for (const npc of context.world.getNpcs()) {
      if (voidFlareNpcDefinition.isActor(npc)) {
        destroyVoidFlare(npc, {
          tick: defeatTick,
          tickEvents: context.tickEvents,
        });
      }
    }
  }
  spawnFlares(voidFlares, context, spawnBatch) {
    const activeFlares = this.getActiveFlares(context.world);
    const spawnCount = Math.min(spawnBatch.count, this.config.maxActive - activeFlares.length);
    if (spawnCount <= 0) {
      return;
    }
    const flareTiles = activeFlares.map((flare) => flare.position);
    for (let i = 0; i < spawnCount; i++) {
      const spawnTile = this.pickSpawnTile(voidFlares, context.playerPos, flareTiles);
      if (spawnTile) {
        flareTiles.push(spawnTile);
        context.tickEvents.emit(
          this.spawnFlareAt(voidFlares, context, {
            position: spawnTile,
            hp: spawnBatch.hp,
          }),
        );
      }
    }
  }
  spawnFlareAt(voidFlares, context, spawn) {
    const flareIndex = voidFlares.nextId++;
    const flareId = `vf-${flareIndex}`;
    const flare = createVoidFlareActor({
      id: flareId,
      damageRollIndex: flareIndex,
      position: spawn.position,
      spawnTick: context.tick,
      chargeTicks: this.config.chargeTicks,
      currentHp: spawn.hp,
      guaranteedPlayerMaximum: this.config.guaranteedPlayerMaximum,
      variant: spawn.variant,
    });
    context.spawnNpc(flare);
    return {
      type: "voidflare_spawned",
      flareId: flareId,
      position: spawn.position,
      variant: spawn.variant ?? "shadow",
    };
  }
  pickSpawnTile(voidFlares, playerPos, flareTiles) {
    const spawnIndex = voidFlares.spawnIndex;
    for (let offset = 0; offset < voidFlareSpawnTiles.length; offset++) {
      const candidateTile = voidFlareSpawnTiles[(spawnIndex + offset) % voidFlareSpawnTiles.length];
      if (!this.isOverlappingFlare(candidateTile, flareTiles) && (candidateTile[0] !== playerPos[0] || candidateTile[1] !== playerPos[1])) {
        voidFlares.spawnIndex = (spawnIndex + 1) % voidFlareSpawnTiles.length;
        return [candidateTile[0], candidateTile[1]];
      }
    }
  }
  getActiveFlares(world) {
    return world.getNpcs().filter((npc) => voidFlareNpcDefinition.isActor(npc) && npc.alive);
  }
  isOverlappingFlare(candidateTile, flareTiles) {
    return flareTiles.some(
      (flareTile) =>
        candidateTile[0] + 2 > flareTile[0] &&
        candidateTile[0] < flareTile[0] + 2 &&
        candidateTile[1] + 2 > flareTile[1] &&
        candidateTile[1] < flareTile[1] + 2,
    );
  }
};
export { voidFlareNpcDefinition, VoidFlareCoordinator, destroyVoidFlare, getExplosionHeal };
