// The sounds of Yama's whole fight (client/encounters/yama/fullFightData.js,
// `sounds` and `yamaFullAudio`): the rules answer the fight's events with the
// recorded ids and delays, pass on what is not theirs, and every sound they
// name is in the trimmed cache's list (a sound that is not in it is silent).
import assert from "node:assert/strict";
import { yamaFullAudio, sounds, soundIds } from "../client/encounters/yama/fullFightData.js";
import { readCacheGroups } from "../tools/assets/cache-groups.mjs";

const rules = yamaFullAudio.rules;
const pass = { kind: "pass" };
const heard = (result) => (result.kind === "play" ? result.sound.map(({ id, delayCycles, channel }) => [id, delayCycles, channel]) : result.kind);

// A glyph taken: what its visual event carries, played as it is.
assert.deepEqual(heard(rules.colosseum_visual.resolve({ type: "colosseum_visual", animations: [], graphics: [{ spotAnimId: 3280 }], sounds: sounds.glyphTaken })), [[99, 0, "sfx"]]);
assert.deepEqual(rules.colosseum_visual.resolve({ type: "colosseum_visual", animations: [], graphics: [{ spotAnimId: 3267 }] }), pass);

// His autos and the flares have no rule: their sounds are in the frames of what the scene draws (12144, spots
// 3243/3244/3246/3247, 12134..12136), and the scene plays those itself. Playing them here too heard each twice.
for (const type of ["attack_started", "voidflare_spawned", "voidflare_destroyed", "voidflare_exploded"]) assert.equal(rules[type], undefined, type);
assert.deepEqual([...sounds.magicAuto, ...sounds.rangedAuto, ...sounds.flareBlast, ...sounds.yamaDies], []);

// OBS: a fireball of phase 3, at its launch.
assert.deepEqual(heard(rules.fireball_spawned.resolve({ type: "fireball_spawned", sourceId: "yama", targetPosition: [32, 38], fireballIndex: 0 })), [[9335, 3, "sfx"], [10255, 100, "sfx"], [10268, 105, "sfx"]]);

// The waves: one sound for each wave near the player, none for those further off (silent, so that phase 3's rule of
// rendering.js does not play its own); the stand-alone phase 3's event, without `nearWaves`, is left to that rule.
const wave = { type: "wave_activated", position: [30, 30], wavePositions: [[30, 30]] };
assert.deepEqual(heard(rules.wave_activated.resolve({ ...wave, nearWaves: 2 })), [[10238, 0, "sfx"], [10238, 0, "sfx"]]);
assert.deepEqual(heard(rules.wave_activated.resolve({ ...wave, nearWaves: 0 })), "silent");
assert.deepEqual(rules.wave_activated.resolve(wave), pass);

// Every sound of the table and of the rules is in a list of the trimmed cache.
const listed = new Set(readCacheGroups()[4]);
const ruleIds = Object.values(rules).flatMap((rule) => rule.preloadIds);
for (const id of [...soundIds, ...ruleIds]) assert.ok(listed.has(id), `sound ${id} is not under "4" in a list of tools/assets/cache-groups.mjs`);
assert.deepEqual(new Set(ruleIds), new Set(soundIds));
