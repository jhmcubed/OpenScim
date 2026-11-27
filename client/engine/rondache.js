// The Rondache (WIKI: Rondache), a shield of the Fractured Archive. It has "+2 flat armour and magic resistance":
// each melee and ranged hit (flat armour) and magic hit (magic resistance) that an NPC lands on the player loses up
// to 2 damage, "subtracting the flat armour value from the attack's final damage roll" (WIKI: Flat armour), "after
// other forms of damage mitigation, including Protection prayers" (WIKI: Rondache, 28 October 2026). Typeless
// damage is left as it is: the wiki names only some of it (Calvarion's area attacks) as mitigated. Its charges come
// from that mitigated damage:
// - at most 2 a hit, and charges "can only be gained once every 2 game ticks";
// - only once the player has attacked something while wearing it;
// - none for about 8 seconds (13 ticks, inferred) after Shield Slam, though damage is still mitigated then;
// - none from a hit that the protection prayer has already brought to 0;
// - at most 20, and 1 decays every 30 seconds (50 ticks), in combat too.
// Shield Slam, its special attack (specialAttackDefinitions.js, profiles.js), uses them all. Taking the shield off
// drops the charges (inferred). With a weapon that has a special of its own the game shows a second bar for the
// shield's; here the weapon's special is the one (not modelled).
//
// The state, on the player: undefined, or { charges, armed, lastChargeTick, lockedUntilTick, decayTick }.
var RONDACHE_ID = 34719;
var RONDACHE_FLAT_ARMOUR = 2;
var RONDACHE_MAX_CHARGES = 20;
var RONDACHE_MIN_SLAM_CHARGES = 10;
var RONDACHE_CHARGE_INTERVAL_TICKS = 2;
var RONDACHE_LOCK_TICKS = 13;
var RONDACHE_DECAY_TICKS = 50;

function isWearingRondache(player) {
  return player.equipment?.shield === RONDACHE_ID;
}
function getRondacheCharges(player) {
  return isWearingRondache(player) ? (player.rondache?.charges ?? 0) : 0;
}
function emptyRondacheState() {
  return { charges: 0, armed: false, lastChargeTick: undefined, lockedUntilTick: undefined, decayTick: undefined };
}
// The damage of an NPC's hit on a player wearing the Rondache, and the charges it gives.
function mitigateRondacheHit(player, damage, tick) {
  if (!isWearingRondache(player) || damage <= 0) {
    return damage;
  }
  const mitigated = Math.min(RONDACHE_FLAT_ARMOUR, damage);
  const state = player.rondache ?? emptyRondacheState();
  const canCharge =
    state.armed &&
    state.charges < RONDACHE_MAX_CHARGES &&
    (state.lastChargeTick === undefined || tick - state.lastChargeTick >= RONDACHE_CHARGE_INTERVAL_TICKS) &&
    (state.lockedUntilTick === undefined || tick >= state.lockedUntilTick);
  if (canCharge) {
    player.rondache = {
      ...state,
      charges: Math.min(RONDACHE_MAX_CHARGES, state.charges + mitigated),
      lastChargeTick: tick,
      decayTick: state.charges === 0 ? tick + RONDACHE_DECAY_TICKS : state.decayTick,
    };
  }
  return damage - mitigated;
}
// An attack of the player's: one made wearing the shield lets it charge; Shield Slam empties it.
function noteRondacheAttack(player, tick, isShieldSlam) {
  if (!isWearingRondache(player)) {
    return;
  }
  const state = player.rondache ?? emptyRondacheState();
  player.rondache = isShieldSlam
    ? { ...state, armed: true, charges: 0, decayTick: undefined, lockedUntilTick: tick + RONDACHE_LOCK_TICKS }
    : state.armed
      ? state
      : { ...state, armed: true };
}
// Each tick: a charge decays every 50 ticks; the shield taken off drops its state.
function tickRondache(player, tick) {
  if (player.rondache === undefined) {
    return;
  }
  if (!isWearingRondache(player)) {
    player.rondache = undefined;
    return;
  }
  const state = player.rondache;
  if (state.charges > 0 && state.decayTick !== undefined && tick >= state.decayTick) {
    const charges = state.charges - 1;
    player.rondache = { ...state, charges, decayTick: charges > 0 ? tick + RONDACHE_DECAY_TICKS : undefined };
  }
}

export {
  RONDACHE_ID,
  RONDACHE_MIN_SLAM_CHARGES,
  isWearingRondache,
  getRondacheCharges,
  mitigateRondacheHit,
  noteRondacheAttack,
  tickRondache,
};
