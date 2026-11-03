importScripts("codec/qgif.js");
onmessage = async ({
  data: {
    file,
    width,
    height,
    fps,
    fit,
    start = 0,
    end = null,
    rotation = 0,
    mirror = false,
  },
}) => {
  try {
    if (start < 0 || (end !== null && end <= start))
      throw Error("The end time must follow the start time.");
    const decoder = new ImageDecoder({
      type: "image/gif",
      data: await file.arrayBuffer(),
    });
    await decoder.tracks.ready;
    const count = decoder.tracks.selectedTrack.frameCount;
    if (!count || count > 1200)
      throw Error("Choose a GIF with 1 to 1,200 frames.");
    const canvas = new OffscreenCanvas(width, height),
      ctx = canvas.getContext("2d");
    const mod = await createModule({
      locateFile: () => new URL("codec/qgif.wasm", self.location.href).href,
    });
    let elapsed = 0,
      written = 0,
      kept = 0;
    for (let i = 0; i < count; i++) {
      const { image } = await decoder.decode({ frameIndex: i });
      const previous = elapsed;
      elapsed += Math.max(10000, image.duration || 100000);
      const duration = Math.max(
        0,
        Math.min(elapsed, end === null ? Infinity : end * 1e6) -
          Math.max(previous, start * 1e6),
      );
      if (!duration) {
        image.close();
        continue;
      }
      kept += duration;
      const target = Math.max(1, Math.round((kept * fps) / 1e6));
      if (target > 600)
        throw Error(
          "Animation too long. Lower the frame rate or trim the GIF.",
        );
      if (target > written) {
        const quarter = rotation === 90 || rotation === 270;
        const frameW = quarter ? image.displayHeight : image.displayWidth,
          frameH = quarter ? image.displayWidth : image.displayHeight;
        const scale = (fit === "cover" ? Math.max : Math.min)(
          width / frameW,
          height / frameH,
        );
        const w = image.displayWidth * scale,
          h = image.displayHeight * scale;
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, width, height);
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.scale(mirror ? -1 : 1, 1);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.drawImage(image, -w / 2, -h / 2, w, h);
        ctx.restore();
        const blob = await canvas.convertToBlob({ type: "image/png" });
        const png = new Uint8Array(await blob.arrayBuffer());
        while (written < target) {
          mod.FS.writeFile("input_" + written + ".png", png);
          written++;
        }
      }
      image.close();
      postMessage({ progress: Math.round((100 * (i + 1)) / count) });
    }
    decoder.close();
    if (!written) throw Error("The selected trim range contains no frames.");
    mod.cwrap("compress_video_wasm", "number", [
      "string",
      "string",
      "number",
      "number",
    ])("input_X.png", "output.qgif", 0, fps);
    const bytes = mod.FS.readFile("output.qgif");
    if (!bytes.length) throw Error("Encoder produced an empty animation.");
    postMessage({ bytes }, [bytes.buffer]);
  } catch (e) {
    postMessage({ error: e.message });
  }
};
