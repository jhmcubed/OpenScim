import { prayerSlotByPrayer, prayersConflict } from "./prayerTables.js";
// Removes, in place, every prayer in the list that the given one turns off.
function removeConflicting(prayers, prayer) {
  for (let index = prayers.length - 1; index >= 0; index--) {
    if (prayersConflict(prayers[index], prayer)) {
      prayers.splice(index, 1);
    }
  }
}
function groupPrayersBySlot(prayers) {
  let protectionPrayer = null;
  let offensivePrayer = null;
  const independentPrayers = [];
  for (const prayer of prayers) {
    const prayerSlot = prayerSlotByPrayer[prayer];
    if ("protection" === prayerSlot) {
      protectionPrayer = prayer;
    } else if (prayerSlot === "offensive") {
      offensivePrayer = prayer;
      removeConflicting(independentPrayers, prayer);
    } else if ("independent" === prayerSlot && !independentPrayers.includes(prayer)) {
      removeConflicting(independentPrayers, prayer);
      if (offensivePrayer !== null && prayersConflict(offensivePrayer, prayer)) {
        offensivePrayer = null;
      }
      independentPrayers.push(prayer);
    }
  }
  return {
    protection: protectionPrayer,
    offensive: offensivePrayer,
    independent: independentPrayers,
  };
}
function applyPrayerActionEntries(startingPrayers, actionEntries) {
  let protectionPrayer = startingPrayers.protection;
  let offensivePrayer = startingPrayers.offensive;
  let independentPrayers = startingPrayers.independent;
  let quickPrayersActive = startingPrayers.quickPrayersActive;
  let protectionTouched = false;
  let offensiveTouched = false;
  let independentTouched = false;
  const activatedPrayers = new Set();
  const rejectedPrayers = [];
  const transitions = [];
  const markActivated = (currentPrayer, nextPrayer) => {
    if (nextPrayer !== null && nextPrayer !== currentPrayer) {
      activatedPrayers.add(nextPrayer);
    }
  };
  const setProtectionPrayer = (nextPrayer) => {
    if (protectionPrayer !== nextPrayer) {
      transitions.push({
        slot: "protection",
        from: protectionPrayer,
        to: nextPrayer,
      });
      protectionPrayer = nextPrayer;
    }
  };
  const setOffensivePrayer = (nextPrayer) => {
    if (offensivePrayer !== nextPrayer) {
      transitions.push({
        slot: "offensive",
        from: offensivePrayer,
        to: nextPrayer,
      });
      offensivePrayer = nextPrayer;
    }
  };
  const setIndependentPrayers = (nextPrayers) => {
    for (const currentPrayer of independentPrayers) {
      if (!nextPrayers.includes(currentPrayer)) {
        transitions.push({
          slot: "independent",
          from: currentPrayer,
          to: null,
        });
      }
    }
    for (const nextPrayer of nextPrayers) {
      if (!independentPrayers.includes(nextPrayer)) {
        transitions.push({
          slot: "independent",
          from: null,
          to: nextPrayer,
        });
      }
    }
    independentPrayers = [...nextPrayers];
  };
  for (const { action: action, hasPrayerPoints: hasPrayerPoints } of actionEntries) {
    if (action.type === "protection") {
      protectionTouched = true;
      quickPrayersActive = false;
      if (null === action.prayer || action.prayer === protectionPrayer) {
        setProtectionPrayer(null);
      } else if (hasPrayerPoints) {
        markActivated(protectionPrayer, action.prayer);
        setProtectionPrayer(action.prayer);
      } else {
        rejectedPrayers.push(action.prayer);
      }
      continue;
    }
    if ("offensive" === action.type) {
      offensiveTouched = true;
      quickPrayersActive = false;
      if (action.prayer === null || action.prayer === offensivePrayer) {
        setOffensivePrayer(null);
      } else if (hasPrayerPoints) {
        markActivated(offensivePrayer, action.prayer);
        setOffensivePrayer(action.prayer);
        if (independentPrayers.some((prayer) => prayersConflict(prayer, action.prayer))) {
          independentTouched = true;
          setIndependentPrayers(independentPrayers.filter((prayer) => !prayersConflict(prayer, action.prayer)));
        }
      } else {
        rejectedPrayers.push(action.prayer);
      }
      continue;
    }
    if ("independent" === action.type) {
      independentTouched = true;
      quickPrayersActive = false;
      if (independentPrayers.includes(action.prayer)) {
        setIndependentPrayers(independentPrayers.filter((prayer) => prayer !== action.prayer));
      } else if (hasPrayerPoints) {
        activatedPrayers.add(action.prayer);
        if (offensivePrayer !== null && prayersConflict(offensivePrayer, action.prayer)) {
          offensiveTouched = true;
          setOffensivePrayer(null);
        }
        setIndependentPrayers([
          ...independentPrayers.filter((prayer) => !prayersConflict(prayer, action.prayer)),
          action.prayer,
        ]);
      } else {
        rejectedPrayers.push(action.prayer);
      }
      continue;
    }
    if (quickPrayersActive) {
      protectionTouched = true;
      offensiveTouched = true;
      independentTouched = true;
      quickPrayersActive = false;
      setProtectionPrayer(null);
      setOffensivePrayer(null);
      setIndependentPrayers([]);
      continue;
    }
    const quickPrayers = groupPrayersBySlot(action.selections);
    if (
      quickPrayers.protection !== null ||
      quickPrayers.offensive !== null ||
      quickPrayers.independent.length !== 0
    ) {
      if (hasPrayerPoints) {
        protectionTouched = true;
        offensiveTouched = true;
        independentTouched = true;
        quickPrayersActive = true;
        markActivated(protectionPrayer, quickPrayers.protection);
        markActivated(offensivePrayer, quickPrayers.offensive);
        for (const prayer of quickPrayers.independent) {
          if (!independentPrayers.includes(prayer)) {
            activatedPrayers.add(prayer);
          }
        }
        setProtectionPrayer(quickPrayers.protection);
        setOffensivePrayer(quickPrayers.offensive);
        setIndependentPrayers(quickPrayers.independent);
      } else {
        rejectedPrayers.push(quickPrayers.protection ?? quickPrayers.offensive ?? quickPrayers.independent[0]);
      }
    }
  }
  return {
    protection: protectionPrayer,
    offensive: offensivePrayer,
    independent: independentPrayers,
    quickPrayersActive: quickPrayersActive,
    protectionTouched: protectionTouched,
    offensiveTouched: offensiveTouched,
    independentTouched: independentTouched,
    activated: [...activatedPrayers].filter(
      (prayer) => prayer === protectionPrayer || prayer === offensivePrayer || independentPrayers.includes(prayer),
    ),
    rejected: rejectedPrayers,
    transitions: transitions,
  };
}
function applyPrayerActions(startingPrayers, actions, hasPrayerPoints) {
  return applyPrayerActionEntries(
    startingPrayers,
    actions.map((action) => ({
      action: action,
      hasPrayerPoints: hasPrayerPoints,
    })),
  );
}
var RING_OF_THE_GODS_IMBUED_IDS = [13202, 25252, 26764];
var PRAYER_RESTORE_CAPE_IDS = [9759, 9760, 13280, 13342];
var PRAYER_RESTORE_FORMULAS = {
  super_restore: {
    basePercent: 0.25,
    enhancedPercent: 0.27,
    flat: 8,
  },
  sanfew: {
    basePercent: 0.3,
    enhancedPercent: 0.32,
    flat: 4,
  },
  prayer_potion: {
    basePercent: 0.25,
    enhancedPercent: 0.27,
    flat: 7,
  },
  forgotten_brew: {
    basePercent: 0.1,
    enhancedPercent: 0.1,
    flat: 2,
  },
};
function isPrayerRestoreCape(itemId) {
  return itemId !== undefined && PRAYER_RESTORE_CAPE_IDS.some((capeId) => capeId === itemId);
}
function hasEnhancedPrayerRestoration({ equipment: equipment, inventory: inventory }) {
  return (
    !!RING_OF_THE_GODS_IMBUED_IDS.some((ringId) => ringId === equipment.ring) ||
    !!isPrayerRestoreCape(equipment.cape) ||
    inventory.some((itemRef) => itemRef !== null && (itemRef.id === 6714 || isPrayerRestoreCape(itemRef.id))) // Holy wrench
  );
}
function computePrayerRestoreAmount(formula, prayerLevel, enhancedPrayerRestoration) {
  const restoreCoefficients = PRAYER_RESTORE_FORMULAS[formula];
  const restorePercent = enhancedPrayerRestoration ? restoreCoefficients.enhancedPercent : restoreCoefficients.basePercent;
  return Math.floor(prayerLevel * restorePercent) + restoreCoefficients.flat;
}
export {
  applyPrayerActionEntries,
  applyPrayerActions,
  hasEnhancedPrayerRestoration,
  computePrayerRestoreAmount,
};
