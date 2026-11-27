// Zorya's flow, the special attack of Zorya's tome (WIKI: Zorya's tome). A Flow that hits "buffs the next three
// tome attacks": each of them has the Flow's own 150% more accuracy and 60% more damage, and attacks "every 2 ticks
// instead of 3". A Flow while buffs remain "will increase the number of buffed attacks by up to 3, with a maximum
// stored limit of 5" (it uses none of them), so two Flows in a row that both hit leave five. The buffs last 30
// seconds (50 ticks), each buffed attack starting them again; they stay through weapon switches and only the tome's
// attacks use them. Teleporting clears them: the player does not teleport in a fight here (not modelled).
//
// The state, on the player: undefined, or { attacks, expiresTick }.
import { getBaseItemId } from "../data/itemVariants.js";

var ZORYAS_TOME_ID = 34725;
var ZORYAS_FLOW_ADDED_ATTACKS = 3;
var ZORYAS_FLOW_MAX_ATTACKS = 5;
var ZORYAS_FLOW_DURATION_TICKS = 50;
var ZORYAS_FLOW_ATTACK_SPEED = 2;

function isZoryasTome(weaponId) {
  return weaponId !== undefined && getBaseItemId(weaponId) === ZORYAS_TOME_ID;
}
function getZoryasFlowAttacks(zoryasFlow) {
  return zoryasFlow?.attacks ?? 0;
}
// The state after an attack of the tome: a buffed attack uses a buff; a Flow that hits adds three, one that misses
// leaves them as they were.
function getZoryasFlowAfterAttack(zoryasFlow, { tick, isSpecialAttack, landed }) {
  const stored = getZoryasFlowAttacks(zoryasFlow);
  const attacks = isSpecialAttack
    ? Math.min(ZORYAS_FLOW_MAX_ATTACKS, stored + (landed ? ZORYAS_FLOW_ADDED_ATTACKS : 0))
    : Math.max(0, stored - 1);
  if (attacks === 0) {
    return undefined;
  }
  return { attacks, expiresTick: tick + ZORYAS_FLOW_DURATION_TICKS };
}
function expireZoryasFlow(zoryasFlow, tick) {
  return zoryasFlow !== undefined && tick >= zoryasFlow.expiresTick ? undefined : zoryasFlow;
}

export { ZORYAS_FLOW_ATTACK_SPEED, isZoryasTome, getZoryasFlowAttacks, getZoryasFlowAfterAttack, expireZoryasFlow };
