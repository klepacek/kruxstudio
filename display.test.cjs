const { test } = require("node:test");
const assert = require("node:assert/strict");
const { uploadAnimation } = require("./display.js");

function simulatedLCD(failAt) {
  const writes = [];
  return {
    writes,
    async session(fn) {
      return fn();
    },
    async command(cmd, offset, length, data) {
      if (cmd === 25 && offset === failAt) throw Error("Unplugged");
      writes.push({ cmd, offset, length, data });
      const reply = new Uint8Array(64);
      reply[9] = 2;
      return reply;
    },
  };
}
test("preserves a partial final report and crosses a flash block boundary", async () => {
  const lcd = simulatedLCD(),
    bytes = Uint8Array.from({ length: 65537 }, (_, i) => i % 251);
  await uploadAnimation(lcd, bytes, () => {});
  const chunks = lcd.writes.filter((w) => w.cmd === 25);
  assert.deepEqual(
    Uint8Array.from(chunks.flatMap((w) => Array.from(w.data))),
    bytes,
  );
  assert.equal(chunks.at(-1).offset + chunks.at(-1).length, bytes.length);
  assert.equal(lcd.writes.at(-1).cmd, 26);
  assert.deepEqual(
    lcd.writes.find((w) => w.cmd === 21).data,
    [0, 1, 2, 0, 0, 1, 0, 1],
  );
});
test("transfer failure stops before finalization", async () => {
  const lcd = simulatedLCD(56);
  await assert.rejects(
    uploadAnimation(lcd, new Uint8Array(100), () => {}),
    /Unplugged/,
  );
  assert.equal(
    lcd.writes.some((w) => w.cmd === 26),
    false,
  );
});

test("the second LCD slot starts on the next flash block", async () => {
  const lcd = simulatedLCD(),
    first = Uint8Array.of(1, 2),
    second = Uint8Array.of(3, 4, 5);
  await uploadAnimation(lcd, [first, second], () => {});
  assert.deepEqual(
    lcd.writes.find((w) => w.cmd === 21).data,
    [0, 2, 2, 0, 0, 2, 0, 0, 1, 0, 3, 0, 0],
  );
  assert.deepEqual(
    lcd.writes.filter((w) => w.cmd === 25).map((w) => w.offset),
    [0, 65536],
  );
});
