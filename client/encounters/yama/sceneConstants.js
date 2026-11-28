var detonatedDeathCause = "detonated";
var yamaBasePosition = [29, 28];
function isYamaSealedRow(y) {
  return y <= 19;
}
// The kinds whose snapshot Yama's scene reads (client/assets/rendering.js):
// the third phase, its contracts and the whole fight.
var yamaSceneKinds = ["yama_p3", "yama_p3_divine", "yama_p3_forfeit_breath", "yama_p3_sensory", "yama_p3_bloodied", "yama_p3_glyphic", "yama_full"];
var yamaSpawnFireballCommand = {
  encounter: "yama_p3",
  type: "spawn-fireball",
};
var yamaSpawnVoidFlareCommand = {
  encounter: "yama_p3",
  type: "spawn-void-flare",
};
export {
  detonatedDeathCause,
  yamaBasePosition,
  isYamaSealedRow,
  yamaSpawnFireballCommand,
  yamaSpawnVoidFlareCommand,
  yamaSceneKinds,
};
