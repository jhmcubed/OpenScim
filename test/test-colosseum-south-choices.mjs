// The south spawn switches of the Colosseum's practice list only the monsters
// the start wave has, and a monster it does not have counts as "random".
import assert from "node:assert/strict";
import test from "node:test";
import { buildColosseumControls, colosseumStartWaveKey, colosseumSouthKeys, getSouthSpawnSetting } from "../client/encounters/colosseum/controls.js";

// WIKI (Fortis Colosseum/Strategies): the monsters each wave starts with,
// without the warband and the reinforcements.
const monstersOfWave = {
  1: ["shaman"],
  2: ["shaman", "javelin"],
  3: ["shaman", "javelin"],
  4: ["shaman", "manticore"],
  5: ["shaman", "javelin", "manticore"],
  6: ["shaman", "javelin", "manticore"],
  7: ["javelin", "manticore", "shockwave"],
  8: ["javelin", "manticore", "shockwave"],
  9: ["javelin", "manticore"],
  10: ["javelin", "manticore"],
  11: ["javelin", "manticore", "shockwave"],
};
const { mechanicsToggles, defaultMechanicsConfig } = buildColosseumControls();

for (const [wave, monsters] of Object.entries(monstersOfWave)) {
  test(`wave ${wave} offers its own monsters on the south spawns`, () => {
    const config = { ...defaultMechanicsConfig, [colosseumStartWaveKey]: wave };
    for (const [slot, key] of Object.entries(colosseumSouthKeys)) {
      const { choices } = mechanicsToggles.find((toggle) => toggle.key === key);
      const offered = choices.filter((choice) => choice.isOffered({ config })).map((choice) => choice.value);
      assert.deepEqual(offered, ["random", "any", ...monsters]);
      for (const { value } of choices) {
        assert.equal(getSouthSpawnSetting({ ...config, [key]: value }, slot), offered.includes(value) ? value : "random");
      }
    }
  });
}
