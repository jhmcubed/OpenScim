import { resolveBranchedSplatDamage, sumOutcomeWeights, projectPlayerAttack } from "./projection.js";
function withMinimumDamage(damageSpec, hitMinimumDamage) {
  return "bySelectedBranch" === damageSpec.kind
    ? {
        ...damageSpec,
        minimumWhenSelected: hitMinimumDamage,
      }
    : {
        kind: "minimum",
        base: damageSpec,
        minimumDamage: hitMinimumDamage,
      };
}
function applyGuaranteedHitOverrides(attackPlan, overrides) {
  let adjustedPlan = attackPlan;
  if (overrides.guaranteedAccuracy || overrides.guaranteedMaximum) {
    adjustedPlan = mapAttackPlanHits(adjustedPlan, (plannedHit) =>
      plannedHit.accuracy.kind === "whenDamagePositive"
        ? plannedHit
        : {
            ...plannedHit,
            accuracy: {
              kind: "guaranteed",
            },
          },
    );
    if (adjustedPlan.branchSelection !== undefined) {
      const [firstAttempt, ...remainingAttempts] = adjustedPlan.branchSelection.attempts;
      adjustedPlan = {
        ...adjustedPlan,
        branchSelection: {
          ...adjustedPlan.branchSelection,
          attempts: [
            {
              ...firstAttempt,
              chance: 1,
            },
            ...remainingAttempts,
          ],
        },
      };
    }
  }
  if (overrides.guaranteedMaximum) {
    const hits = projectPlayerAttack(adjustedPlan).hits;
    adjustedPlan = mapAttackPlanHits(adjustedPlan, (plannedHit, planIndex) => ({
      ...plannedHit,
      damage: {
        kind: "fixed",
        damage: hits[planIndex]?.maximumRolledDamage ?? 0,
      },
    }));
  }
  const minimumDamage = overrides.minimumDamage;
  if (minimumDamage !== undefined) {
    const hits = projectPlayerAttack(adjustedPlan).hits;
    adjustedPlan = mapAttackPlanHits(adjustedPlan, (plannedHit, planIndex) => {
      return {
        ...plannedHit,
        damage: withMinimumDamage(plannedHit.damage, minimumDamage(hits[planIndex]?.maximumRolledDamage ?? 0)),
      };
    });
  }
  return adjustedPlan;
}
function lowerDamageSpecMaximum(damageSpec, ratio) {
  switch (damageSpec.kind) {
    case "uniform": {
      const loweredMaximum = Math.floor(
        (damageSpec.maximumInclusive * ratio.numerator) / ratio.denominator,
      );
      return {
        ...damageSpec,
        minimumInclusive: Math.min(damageSpec.minimumInclusive, loweredMaximum),
        maximumInclusive: loweredMaximum,
      };
    }
    case "fixed":
      return {
        ...damageSpec,
        damage: Math.floor((damageSpec.damage * ratio.numerator) / ratio.denominator),
      };
    case "minimum":
      return {
        ...damageSpec,
        base: lowerDamageSpecMaximum(damageSpec.base, ratio),
      };
    case "weighted":
      return {
        ...damageSpec,
        outcomes: damageSpec.outcomes.map((outcome) => ({
          ...outcome,
          damage: Math.floor((outcome.damage * ratio.numerator) / ratio.denominator),
        })),
      };
    default:
      throw new RangeError(
        "Cannot lower the maximum of a " + damageSpec.kind + " damage roll",
      );
  }
}
function mapAttackPlanHits(attackPlan, mapHit) {
  const [firstPlannedHit, ...remainingPlannedHits] = attackPlan.hits;
  return {
    ...attackPlan,
    hits: [mapHit(firstPlannedHit, 0), ...remainingPlannedHits.map((plannedHit, index) => mapHit(plannedHit, index + 1))],
  };
}
function rollDamageSpec(damageSpec, priorDamage, random, selectedBranch = null) {
  const rollBase = (baseSpec) => rollDamageSpec(baseSpec, priorDamage, random, selectedBranch);
  switch (damageSpec.kind) {
    case "uniform":
      return (
        damageSpec.minimumInclusive +
        Math.floor(random() * (damageSpec.maximumInclusive - damageSpec.minimumInclusive + 1))
      );
    case "fixed":
      return damageSpec.damage;
    case "floorFractionOfPriorHit":
      return Math.floor(
        ((function (priorDamage, priorHitIndex) {
          const resolvedDamage = priorDamage[priorHitIndex];
          if (undefined === resolvedDamage) {
            throw new RangeError("Missing resolved damage for prior hit " + priorHitIndex);
          }
          return resolvedDamage;
        })(priorDamage, damageSpec.priorHitIndex) *
          damageSpec.numerator) /
          damageSpec.denominator,
      );
    case "minimum":
      return Math.max(damageSpec.minimumDamage, rollBase(damageSpec.base));
    case "floorScale":
      return floorScaleDamageByRatio(rollBase(damageSpec.base), damageSpec.ratio);
    case "floorScaleOnProc": {
      const baseDamage = rollBase(damageSpec.base);
      if (random() < damageSpec.chance) {
        return floorScaleDamageByRatio(baseDamage, damageSpec.ratio);
      } else {
        return baseDamage;
      }
    }
    case "addFloorScaledCopy": {
      const baseDamage = rollBase(damageSpec.base);
      let scaledCopy = baseDamage;
      for (const stageRatio of damageSpec.stages) {
        scaledCopy = floorScaleDamageByRatio(scaledCopy, stageRatio);
      }
      return baseDamage + scaledCopy;
    }
    case "weighted":
      return (function (outcomes, randomRoll) {
        const [firstOutcome, ...remainingOutcomes] = outcomes;
        if (undefined === firstOutcome) {
          throw new RangeError("Expected at least one weighted damage outcome");
        }
        let remainingWeight = randomRoll * sumOutcomeWeights(outcomes);
        let lastOutcome = firstOutcome;
        for (const outcome of [firstOutcome, ...remainingOutcomes]) {
          lastOutcome = outcome;
          remainingWeight -= outcome.weight;
          if (remainingWeight < 0) {
            return outcome.damage;
          }
        }
        return lastOutcome.damage;
      })(damageSpec.outcomes, random());
    case "bySelectedBranch":
      return resolveBranchedSplatDamage(damageSpec, selectedBranch);
    default:
      return (function (unhandledSpec) {
        throw new Error("Unhandled damage spec: " + JSON.stringify(unhandledSpec));
      })(damageSpec);
  }
}
function floorScaleDamageByRatio(damage, ratio) {
  return Math.floor((damage * ratio.numerator) / ratio.denominator);
}
function rollSelectedBranch(branchSelection, random) {
  for (const [attemptIndex, attempt] of branchSelection.attempts.entries()) {
    if (random() >= attempt.chance) {
      continue;
    }
    const {
      minimumInclusive: minimumInclusive,
      maximumInclusive: maximumInclusive,
    } = attempt.total;
    return {
      kind: "landed",
      index: attemptIndex,
      total:
        minimumInclusive +
        Math.floor(random() * (maximumInclusive - minimumInclusive + 1)),
    };
  }
  return {
    kind: "allMiss",
    outcome: pickWeightedIndex(branchSelection.allMissWeights, random()),
  };
}
function rollAttackPlan(attackPlan, random) {
  const selectedBranch =
    undefined === attackPlan.branchSelection
      ? null
      : rollSelectedBranch(attackPlan.branchSelection, random);
  const [firstPlannedHit, ...remainingPlannedHits] = attackPlan.hits;
  const resolvedHits = [
    resolvePlannedHitRoll({
      plannedHit: firstPlannedHit,
      planIndex: 0,
      priorHits: [],
      selectedBranch: selectedBranch,
      random: random,
    }),
  ];
  for (const [index, plannedHit] of remainingPlannedHits.entries()) {
    resolvedHits.push(
      resolvePlannedHitRoll({
        plannedHit: plannedHit,
        planIndex: index + 1,
        priorHits: resolvedHits,
        selectedBranch: selectedBranch,
        random: random,
      }),
    );
  }
  return {
    attackSpeedTicks: attackPlan.attackSpeedTicks,
    application: attackPlan.application,
    hits: resolvedHits,
    selectedBranch: selectedBranch,
  };
}
function pickWeightedIndex(weights, randomRoll) {
  let remainingWeight = randomRoll * weights.reduce((total, weight) => total + weight, 0);
  for (const [index, weight] of weights.entries()) {
    remainingWeight -= weight;
    if (remainingWeight < 0) {
      return index;
    }
  }
  return weights.length - 1;
}
function isHitGatePassed(gate, priorHits) {
  switch (gate.kind) {
    case "always":
      return true;
    case "ifPriorAccurate":
      return requireResolvedPriorHit(priorHits, gate.priorHitIndex).accuracySucceeded;
    case "ifPriorInaccurate":
      return !requireResolvedPriorHit(priorHits, gate.priorHitIndex).accuracySucceeded;
    default:
      return throwUnhandledAttackVariant(gate);
  }
}
function rollAccuracySpec(accuracySpec, priorHits, random) {
  switch (accuracySpec.kind) {
    case "roll":
      return random() < accuracySpec.chance;
    case "guaranteed":
      return true;
    case "rollUnlessAnyPriorAccurate":
      return (
        !!accuracySpec.priorHitIndices.some((priorHitIndex) => requireResolvedPriorHit(priorHits, priorHitIndex).accuracySucceeded) ||
        random() < accuracySpec.chance
      );
    case "whenDamagePositive":
      throw new TypeError(
        "whenDamagePositive accuracy is resolved from rolled damage, not by rolling",
      );
    default:
      return throwUnhandledAttackVariant(accuracySpec);
  }
}
function resolvePlannedHitRoll(rollContext) {
  const gatePassed = isHitGatePassed(rollContext.plannedHit.gate, rollContext.priorHits);
  const priorDamage = rollContext.priorHits.map((priorHit) => priorHit.rolledDamage);
  const resolvedHitBase = {
    planIndex: rollContext.planIndex,
    style: rollContext.plannedHit.style,
    attackKind: rollContext.plannedHit.attackKind,
    impactDelayTicks: rollContext.plannedHit.impactDelayTicks,
  };
  if ("whenDamagePositive" === rollContext.plannedHit.accuracy.kind) {
    const rolledDamage = gatePassed
      ? rollDamageSpec(rollContext.plannedHit.damage, priorDamage, rollContext.random, rollContext.selectedBranch)
      : 0;
    return {
      ...resolvedHitBase,
      gatePassed: gatePassed,
      accuracySucceeded: rolledDamage > 0,
      rolledDamage: rolledDamage,
    };
  }
  const plannedProc = gatePassed ? rollContext.plannedHit.proc : undefined;
  const rollAccuracy = () => rollAccuracySpec(rollContext.plannedHit.accuracy, rollContext.priorHits, rollContext.random);
  let procActivated;
  let accuracySucceeded;
  // Whether the hit itself was accurate, apart from the effect.
  let hitAccurate;
  if (plannedProc === undefined || plannedProc.kind === "kerisCritical") {
    procActivated = plannedProc !== undefined && rollContext.random() < plannedProc.chance;
    accuracySucceeded = gatePassed && rollAccuracy();
    hitAccurate = accuracySucceeded;
  } else if (plannedProc.guaranteed) {
    // Evoke: certain on an accurate hit; a bolt that ignores accuracy still has its chance on a miss.
    hitAccurate = rollAccuracy();
    procActivated = hitAccurate || (plannedProc.ignoresAccuracy !== false && rollContext.random() < plannedProc.chance);
    accuracySucceeded = hitAccurate || procActivated;
  } else if (plannedProc.ignoresAccuracy === false) {
    hitAccurate = rollAccuracy();
    procActivated = hitAccurate && rollContext.random() < plannedProc.chance;
    accuracySucceeded = hitAccurate;
  } else {
    procActivated = rollContext.random() < plannedProc.chance;
    // An effect that replaces the hit lands it without an accuracy roll; one that adds to it keeps the roll.
    hitAccurate = procActivated && plannedProc.kind !== "bonusDamage" ? true : rollAccuracy();
    accuracySucceeded = hitAccurate || procActivated;
  }
  const kerisCritical = procActivated && plannedProc.kind === "kerisCritical";
  function rollProcDamage(proc, random) {
    if (undefined === proc) {
      throw new TypeError("Expected an activated hit proc");
    }
    switch (proc.kind) {
      case "fixedDamage":
        return proc.damage;
      case "kerisCritical":
        return 3 * rollDamageSpec(rollContext.plannedHit.damage, priorDamage, rollContext.random, rollContext.selectedBranch);
      case "bonusDamage":
        // The bonus goes on the hit as rolled: on nothing when it missed (WIKI: Opal bolts (e), Pearl bolts (e)).
        return (
          (hitAccurate ? rollDamageSpec(rollContext.plannedHit.damage, priorDamage, rollContext.random, rollContext.selectedBranch) : 0) +
          proc.bonus
        );
      case "uniformDamage":
        return (
          proc.minimumInclusive +
          Math.floor(
            random() * (proc.maximumInclusive - proc.minimumInclusive + 1),
          )
        );
      default:
        return throwUnhandledAttackVariant(proc);
    }
  }
  const rolledDamage = accuracySucceeded
    ? procActivated
      ? rollProcDamage(rollContext.plannedHit.proc, rollContext.random)
      : rollDamageSpec(rollContext.plannedHit.damage, priorDamage, rollContext.random, rollContext.selectedBranch)
    : 0;
  return {
    ...resolvedHitBase,
    gatePassed: gatePassed,
    accuracySucceeded: accuracySucceeded,
    rolledDamage: rolledDamage,
    ...(procActivated && accuracySucceeded
      ? {
          procActivated: true,
          ...(plannedProc.spotAnimId === undefined ? {} : { procSpotAnimId: plannedProc.spotAnimId }),
          ...(plannedProc.effects === undefined ? {} : { procEffects: plannedProc.effects }),
        }
      : {}),
    ...(procActivated &&
    "fixedDamage" === rollContext.plannedHit.proc?.kind &&
    undefined !== rollContext.plannedHit.proc.selfDamageRatio
      ? {
          procSelfDamageRatio: rollContext.plannedHit.proc.selfDamageRatio,
        }
      : {}),
  };
}
function requireResolvedPriorHit(priorHits, priorHitIndex) {
  const priorHit = priorHits[priorHitIndex];
  if (undefined === priorHit) {
    throw new RangeError("Missing resolved prior hit " + priorHitIndex);
  }
  return priorHit;
}
function throwUnhandledAttackVariant(unhandledVariant) {
  throw new Error("Unhandled player attack variant: " + JSON.stringify(unhandledVariant));
}
export { applyGuaranteedHitOverrides, lowerDamageSpecMaximum, mapAttackPlanHits, rollAttackPlan };
