// The NPC decoders read the opcodes the game cache has that they skipped
// before (#148): the client's (NpcType, client/assets/rendering.js) and the
// cache tool's (decodeNpc, tools/cache-objects.mjs). 251, 252 and 253 are menu
// options (RuneLite's EntityOpsLoader); 130 and 147 flags with no operands.
// Skipped, 252's operands were read as opcodes and cut 9 NPCs short (their
// names came out as garbage); 251's were read as a name.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { loadEnvironment } from "../tools/determinism/harness.mjs";

const { npcTypeLoader } = await loadEnvironment();

// CACHE: the Mad Angel asleep (16306), whose "Wake" a 252 hides while varbit 15759 is 0 to 19; Hans (3105), whose "Age"
// is conditional too; Zahur (4753), whose two 251s are the sub-options of his "Decant".
const madAngel = npcTypeLoader.load(16306);
assert.equal(madAngel.name, "Mad Angel");
assert.equal(madAngel.actions[0], "Wake");
assert.deepEqual(madAngel.extraOps, [{ opcode: 252, index: 0, varp: 65535, varbit: 15759, min: 0, max: 19, text: "" }]);
assert.equal(npcTypeLoader.load(3105).name, "Hans");
const zahur = npcTypeLoader.load(4753);
assert.equal(zahur.name, "Zahur");
assert.deepEqual(zahur.extraOps.map((op) => [op.opcode, op.index, op.subId, op.text]), [
  [251, 2, 1, "Decant-potions"],
  [251, 2, 2, "Decant-coconut-milk"],
]);

// An NPC written by hand, with a 253 and the two flags before its name: the name after them is read.
function buffer(bytes) {
  const data = Uint8Array.from(bytes);
  return {
    offset: 0,
    length: data.length,
    readUnsignedByte() { return data[this.offset++]; },
    readByte() { return (data[this.offset++] << 24) >> 24; },
    readUnsignedShort() { const v = (data[this.offset] << 8) | data[this.offset + 1]; this.offset += 2; return v; },
    readShort() { return (this.readUnsignedShort() << 16) >> 16; },
    readInt() { const v = (data[this.offset] << 24) | (data[this.offset + 1] << 16) | (data[this.offset + 2] << 8) | data[this.offset + 3]; this.offset += 4; return v; },
    readString() { let text = ""; while (data[this.offset] !== 0) text += String.fromCharCode(data[this.offset++]); this.offset++; return text; },
  };
}
const ascii = (text) => [...text].map((c) => c.charCodeAt(0));
const NpcType = madAngel.constructor;
const npc = new NpcType(99999, madAngel.cacheInfo);
npc.decode(buffer([
  130, 147, // the flags
  253, 1, 0, 3, 0xff, 0xff, 0x01, 0x00, 0, 0, 0, 2, 0, 0, 0, 5, ...ascii("Poke"), 0, // a conditional sub-option
  2, ...ascii("Test"), 0, // its name
  0,
]));
assert.equal(npc.name, "Test");
assert.deepEqual(npc.extraOps, [{ opcode: 253, index: 1, subId: 3, varp: 65535, varbit: 256, min: 2, max: 5, text: "Poke" }]);

// The cache tool decodes them too (it threw "unknown NPC opcode 252" before).
const printed = execFileSync(process.execPath, ["tools/cache-objects.mjs", "npc", "16306", "3105"], { encoding: "utf8" });
assert.match(printed, /16306 \{"name":"Mad Angel"/);
assert.match(printed, /3105 \{"name":"Hans"/);

console.log("The NPC decoders read opcodes 130, 147 and 251 to 253: nothing after them is lost.");
