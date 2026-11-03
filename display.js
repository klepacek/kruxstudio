async function uploadAnimation(lcd, bytes, progress) {
  const clips = Array.isArray(bytes) ? bytes : [bytes];
  if (!clips.length || clips.length > 2 || clips.some((c) => !c.length))
    throw Error("Select one or two non-empty animations.");
  const blocks = clips.reduce((sum, c) => sum + Math.ceil(c.length / 65536), 0);
  const total = clips.reduce((sum, c) => sum + c.length, 0);
  if (!blocks || blocks > 16)
    throw Error(
      "Encoded animation exceeds the 1 MiB Studio limit. Lower the frame rate or shorten the GIF.",
    );
  await lcd.session(async () => {
    if ((await lcd.command(28))[9] !== 2)
      throw Error("Switch the keyboard to wired mode.");
    await lcd.command(27, 0, 56);
    await lcd.command(20, 0, 56);
    const directory = [0, clips.length, blocks];
    let block = 0;
    for (const clip of clips) {
      directory.push(
        block,
        0,
        clip.length & 255,
        (clip.length >> 8) & 255,
        (clip.length >> 16) & 255,
      );
      block += Math.ceil(clip.length / 65536);
    }
    await lcd.command(21, 0, 56, directory);
    await lcd.command(21, 56, 56);
    await lcd.command(21, 112, 16);
    await lcd.command(22, 0, 56);
    progress(0, "Erasing animation storage");
    await lcd.command(24, 0, 1, [blocks]);
    await new Promise((resolve) => setTimeout(resolve, 500 * blocks));
    let last = -1,
      base = 0,
      written = 0;
    for (const clip of clips) {
      for (let offset = 0; offset < clip.length; offset += 56) {
        const part = clip.subarray(offset, offset + 56);
        await lcd.command(25, base + offset, part.length, part);
        written += part.length;
        const pct = Math.floor((100 * written) / total);
        if (pct !== last) {
          progress(pct, "Writing animation");
          last = pct;
        }
      }
      base += 65536 * Math.ceil(clip.length / 65536);
    }
    await lcd.command(26);
  });
}
if (typeof module !== "undefined") module.exports = { uploadAnimation };
