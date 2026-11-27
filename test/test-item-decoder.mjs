// The client's item decoder (ObjType, client/assets/rendering.js) reads the
// opcodes the game cache has that it skipped before (#140): 15, 160 and 251, flags
// with no operands, and 161, a u16 count and that many u16 (RuneLite's
// ItemLoader). Skipped, 161's operands were read as opcodes and cut the item
// short; anything after it was lost.
import assert from "node:assert/strict";
import { loadEnvironment } from "../tools/determinism/harness.mjs";

const { objTypeLoader } = await loadEnvironment();

// The Obligator (CACHE 34715): its 161 is fourteen animation ids, from 15118.
const obligator = objTypeLoader.load(34715);
assert.equal(obligator.name, "Obligator");
assert.equal(obligator.holdingWhitelist.length, 14);
assert.equal(obligator.holdingWhitelist[0], 15118);

// An item written by hand, with 161 before its params: the params after it are read now (before, they were lost).
// A buffer as the decoder reads one (ByteBuffer): its bytes, an offset, and the reads it makes.
function buffer(bytes) {
  const data = Uint8Array.from(bytes);
  return {
    offset: 0,
    length: data.length,
    readUnsignedByte() { return data[this.offset++]; },
    readByte() { return (data[this.offset++] << 24) >> 24; },
    readUnsignedShort() { const v = (data[this.offset] << 8) | data[this.offset + 1]; this.offset += 2; return v; },
    readShort() { return (this.readUnsignedShort() << 16) >> 16; },
    readMedium() { const v = (data[this.offset] << 16) | (data[this.offset + 1] << 8) | data[this.offset + 2]; this.offset += 3; return v; },
    readInt() { const v = (data[this.offset] << 24) | (data[this.offset + 1] << 16) | (data[this.offset + 2] << 8) | data[this.offset + 3]; this.offset += 4; return v; },
    readString() { let text = ""; while (data[this.offset] !== 0) text += String.fromCharCode(data[this.offset++]); this.offset++; return text; },
  };
}
const name = [..."Test"].map((c) => c.charCodeAt(0));
const ObjType = obligator.constructor;
const item = new ObjType(99999, obligator.cacheInfo);
item.decode(buffer([
  2, ...name, 0, // its name
  15, 160, 251, // the three flags
  161, 0, 2, 0, 10, 0, 20, // two ids: 10 and 20
  249, 1, 0, 0x00, 0x04, 0xd2, 0, 0, 0, 7, // params: one int, key 1234, 7
  0,
]));
assert.equal(item.name, "Test");
assert.deepEqual(item.holdingWhitelist, [10, 20]);
assert.equal(item.params.get(1234), 7);

console.log("The item decoder reads opcodes 15, 160, 161 and 251: nothing after them is lost.");
