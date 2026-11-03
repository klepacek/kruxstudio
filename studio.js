const $ = (id) => document.getElementById(id);
const pages = [
  "Lighting",
  "Assignments",
  "Macros",
  "Display",
  "Gaming",
  "Presets",
];
const gameFields = [
  ["winlock", 40],
  ["wasd", 41],
  ["snaptap", 58],
  ["mac", 39],
  ["frow", 44],
  ["knob", 45],
  ["nkro", 38],
];
let settings,
  lightMap,
  wheel,
  layerMaps = [];
let link,
  lcd,
  base,
  factory,
  selected = keys[0],
  width,
  height,
  busy = false,
  recording = false,
  events = [],
  lastTime,
  held = new Set(),
  gifURL;
const message = (text) => {
  $("status").textContent = text;
};
const word = (data, i) => data[i] + 256 * data[i + 1];
function page(name) {
  for (const p of pages) $(p).hidden = p !== name;
  document
    .querySelectorAll("nav button")
    .forEach((b) => b.classList.toggle("active", b.dataset.page === name));
  $("title").textContent = name;
  document.body.dataset.page = name;
}
for (const b of document.querySelectorAll("nav button"))
  b.onclick = () => {
    if (recording) stopRecording();
    page(b.dataset.page);
  };
for (const k of keys) {
  const b = document.createElement("button");
  b.className = k.name === "Mute" ? "key knob" : "key";
  b.textContent = k.name === "Mute" ? "" : k.name;
  b.title = k.name;
  Object.assign(b.style, {
    left: 1 + k.x * 5.65 + "%",
    top: 3 + k.y * 19 + "%",
    width: k.w * 5.65 - 0.45 + "%",
    height: k.h * 19 - 1.5 + "%",
  });
  b.onclick = () => {
    document.querySelector(".chosen")?.classList.remove("chosen");
    b.classList.add("chosen");
    selected = k;
    $("control").value = "key";
    if (link) showBinding();
    $("selection").textContent = "Selected key  /  " + k.name;
  };
  $("board").append(b);
}
document.querySelector(".key").click();
page("Lighting");
const names = [
  "Spectrum",
  "Color cycle",
  "Breathing",
  "Steady",
  "Reactive",
  "Ripple",
  "Spin",
  "Meteor",
  "Wave",
  "Fountain",
  "Wings",
  "Bloom",
  "Rain",
  "Pulse",
  "Sweep",
];
function renderLighting() {
  const z = Number($("zone").value),
    side = z === 11;
  $("effect").replaceChildren(new Option("Off", 0));
  for (let i = 1; i <= (side ? 4 : 20); i++)
    $("effect").add(
      new Option(side ? "Side effect " + i : names[i - 1] || "Effect " + i, i),
    );
  if (!side)
    for (let i = 0; i < 5; i++)
      $("effect").add(new Option("Custom palette " + (i + 1), 253 + i));
  if (!settings) {
    $("effect").value = 4;
    return;
  }
  const switchIndex = side ? 11 : 1,
    mode = settings[switchIndex + 1];
  $("effect").value =
    settings[switchIndex] === 0
      ? mode === 253
        ? 253 + settings[10]
        : mode
      : 0;
  $("brightness").max = side ? base[22] : base[16];
  $("brightness").value = settings[switchIndex + 2];
  $("speed").max = side ? base[23] : base[17];
  $("speed").value = Math.max(0, $("speed").max - settings[switchIndex + 3]);
  $("mixed").checked = settings[switchIndex + 4] === 0;
  $("color").value =
    "#" +
    [...settings.slice(switchIndex + 6, switchIndex + 9)]
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
}
$("zone").onchange = renderLighting;
renderLighting();
const targets = new Map(
  keys.filter((k) => k.code < 165).map((k) => [k.code, k.name]),
);
for (let i = 0; i < 12; i++) targets.set(58 + i, "F" + (i + 1));
for (const [code, name] of targets) $("target").add(new Option(name, code));
$("color").oninput = () =>
  document.documentElement.style.setProperty("--keyglow", $("color").value);
function action(id, fn) {
  $(id).onclick = async () => {
    if (busy || recording) return;
    busy = true;
    const buttons = [...document.querySelectorAll("button,select,input")];
    buttons.forEach((b) => (b.disabled = true));
    try {
      if (waking) await waking;
      await fn();
    } catch (e) {
      message(e.message);
    } finally {
      busy = false;
      buttons.forEach((b) => (b.disabled = false));
    }
  };
}
function ready() {
  if (!link) throw Error("Connect the keyboard first.");
}
async function pick(filters) {
  const matches = (d) =>
    filters.some(
      (f) =>
        d.vendorId === f.vendorId &&
        d.productId === f.productId &&
        d.collections.some(
          (c) => c.usagePage === f.usagePage && c.usage === f.usage,
        ),
    );
  const permitted = (await navigator.hid.getDevices()).filter(matches);
  permitted.sort(
    (a, b) => Number(b.productId === 0x2731) - Number(a.productId === 0x2731),
  );
  const device =
    permitted[0] ||
    (navigator.userActivation.isActive
      ? (await navigator.hid.requestDevice({ filters })).find(matches)
      : null);
  if (!device)
    throw Error(
      "Device unavailable. Close the vendor driver, check the connection and try again.",
    );
  return device;
}
action("connect", async () => {
  link = null;
  lcd = null;
  message("Reading keyboard…");
  const dev = await pick(
    [0x2731, 0x2736].map((productId) => ({
      vendorId: 0x3299,
      productId,
      usagePage: 65376,
      usage: 97,
    })),
  );
  const conn = new Link(dev);
  await conn.session(async () => {
    base = await conn.read(18, 0, 47);
    if (![2, 3].includes(base[8]) || base[12] !== 128)
      throw Error("Unsupported Drox firmware layout.");
    factory = await conn.read(22, 0, 384);
    const cfg = await conn.read(20, 0, 64);
    for (const [id, offset] of gameFields) $(id).checked = Boolean(cfg[offset]);
    settings = cfg;
    renderLighting();
    $("keyDelay").value = cfg[42];
    for (const [id, off] of [
      ["sleep", 46],
      ["deep", 49],
    ])
      $(id).value = Math.round(
        (cfg[off] + 256 * cfg[off + 1] + 65536 * cfg[off + 2]) / 60,
      );
    wheel = (await conn.command(62)).slice(8, 11);
    layerMaps = [];
    for (let layer = 0; layer < 4; layer++)
      layerMaps.push(await conn.read(26 + 2 * layer, 0, 384));
    lightMap = await conn.read(50, 0, 128);
    await loadSlots(conn);
    await updatePalette(conn);
  });
  link = conn;
  renderBoard();
  showBinding();
  $("connect").textContent = "Reconnect";
  $("device").textContent =
    (dev.productId === 0x2731 ? "USB wired" : "2.4 GHz receiver") +
    "  ·  Firmware " +
    word(base, 6).toString(16);
  message("Keyboard settings loaded.");
});
navigator.hid.addEventListener("disconnect", ({ device }) => {
  if (device === link?.device) {
    link = null;
    lcd = null;
    $("device").textContent = "Disconnected";
    message("Keyboard disconnected. Reconnect to continue.");
  }
  if (device === lcd?.device) lcd = null;
});
action("applyLight", async () => {
  ready();
  await link.session(async () => {
    const full = await link.read(20, 0, 64),
      side = Number($("zone").value) === 11,
      i = side ? 11 : 1;
    const mode = Number($("effect").value);
    full[i] = Number(mode === 0);
    if (mode) {
      full[i + 1] = Math.min(mode, 253);
      full[i + 2] = Number($("brightness").value);
      full[i + 3] = Number($("speed").max) - Number($("speed").value);
      full[i + 4] = Number(!$("mixed").checked);
      if (!side) full[10] = Math.max(0, mode - 253);
      full.set(rgb(), i + 6);
    }
    await link.verifiedWrite(20, 21, 0, full);
    settings = full;
    await updatePalette();
    renderBoard();
  });
  message("Lighting saved and verified.");
});
function keyAddress(key = selected) {
  if (!factory) throw Error("Connect the keyboard first.");
  if (key.name === "Mute" && wheel) return wheel[1] * 3;
  const code = key.code,
    mask = code >= 224 && code <= 231 ? 1 << (code - 224) : 0;
  const found = [];
  for (let i = 0; i < factory.length; i += 3)
    if (
      (code === 175 && factory[i] === 80 && factory[i + 1] === 2) ||
      (factory[i] === 16 &&
        factory[i + 1] === mask &&
        factory[i + 2] === (mask ? 0 : code))
    )
      found.push(i);
  if (found.length !== 1)
    throw Error(
      "This control has no unique factory key address. Choose another key.",
    );
  return found[0];
}
async function assign(data) {
  ready();
  const addr = assignmentAddress();
  const layer = Number($("layer").value);
  await link.session(async () => {
    const binding = data || (await link.read(22 + layer, addr, 3));
    await link.verifiedWrite(26 + 2 * layer, 27 + 2 * layer, addr, binding);
    layerMaps[layer].set(binding, addr);
    showBinding();
  });
  message(
    "Assignment verified for " +
      ($("control").value === "key"
        ? selected.name
        : $("control").selectedOptions[0].text) +
      ".",
  );
}
action("assign", () => {
  const v = $("target").value;
  if (v.startsWith("media-")) return assign([48, Number(v.slice(6)), 0]);
  const k = Number(v),
    mods = [...document.querySelectorAll("#mods input:checked")].reduce(
      (n, e) => n | Number(e.value),
      0,
    );
  return assign(
    k >= 224 && k <= 231 ? [16, mods | (1 << (k - 224)), 0] : [16, mods, k],
  );
});
action("restore", () => assign());
const special = {
  Space: 44,
  Enter: 40,
  Escape: 41,
  Backspace: 42,
  Tab: 43,
  Minus: 45,
  Equal: 46,
  BracketLeft: 47,
  BracketRight: 48,
  Backslash: 49,
  Semicolon: 51,
  Quote: 52,
  Backquote: 53,
  Comma: 54,
  Period: 55,
  Slash: 56,
  ArrowRight: 79,
  ArrowLeft: 80,
  ArrowDown: 81,
  ArrowUp: 82,
  ControlLeft: 224,
  ShiftLeft: 225,
  AltLeft: 226,
  MetaLeft: 227,
  ControlRight: 228,
  ShiftRight: 229,
  AltRight: 230,
  MetaRight: 231,
};
function usage(code) {
  if (/^Key[A-Z]$/.test(code)) return code.charCodeAt(3) - 61;
  if (/^Digit\d$/.test(code))
    return code === "Digit0" ? 39 : 29 + Number(code[4]);
  if (/^F([1-9]|1[012])$/.test(code)) return Number(code.slice(1)) + 57;
  return special[code];
}
function stopRecording() {
  for (const code of held) events.push([10, 0, code, 1]);
  held.clear();
  recording = false;
  $("record").textContent = "Record again";
  $("sequence").textContent = events.length + " recorded events";
  renderSteps();
}
$("record").onclick = () => {
  if (recording) {
    stopRecording();
    return;
  }
  events = [];
  renderSteps();
  held.clear();
  recording = true;
  lastTime = performance.now();
  $("record").textContent = "Stop recording";
  $("sequence").textContent = "Type your sequence, then click Stop.";
};
for (const type of ["keydown", "keyup"])
  window.addEventListener(type, (e) => {
    if (!recording) return;
    e.preventDefault();
    if (e.repeat) return;
    const code = usage(e.code),
      down = type === "keydown";
    if (!code || (!down && !held.has(code))) return;
    const now = performance.now(),
      delay = Math.max(10, Math.min(50000, Math.round(now - lastTime)));
    lastTime = now;
    events.push([delay & 255, delay >> 8, code, down ? 129 : 1]);
    down ? held.add(code) : held.delete(code);
    $("sequence").textContent = events.length + " events · " + e.code;
    if (events.length >= 160) stopRecording();
  });
window.addEventListener("blur", () => {
  if (recording) stopRecording();
});
action("saveMacro", async () => {
  ready();
  const addr = keyAddress();
  if (!events.length) throw Error("Record a macro first.");
  await link.session(async () => {
    const header = await link.read(44, 0, 8),
      oldLen = word(header, 2),
      count = word(header, 4);
    const empty =
      header.every((v) => v === 255) || header.every((v) => v === 0);
    if (
      !empty &&
      (header[0] !== 170 ||
        header[1] !== 85 ||
        oldLen < 8 + count * 2 ||
        oldLen > 1096)
    )
      throw Error("Unrecognized macro table. Existing macros were preserved.");
    const old = empty
      ? Uint8Array.of(170, 85, 8, 0, 0, 0, 0, 0)
      : await link.read(44, 0, oldLen);
    const slots = empty ? 0 : count,
      data = Uint8Array.from([
        events.length & 255,
        events.length >> 8,
        0,
        0,
        ...events.flat(),
      ]);
    if (slots >= base[13] || old.length + 2 + data.length > 1096)
      throw Error("Not enough free macro storage.");
    const next = new Uint8Array(old.length + 2 + data.length);
    next.set(old.slice(0, 8));
    next[2] = next.length & 255;
    next[3] = next.length >> 8;
    next[4] = slots + 1;
    for (let i = 0; i < slots; i++) {
      const ptr = word(old, 8 + i * 2);
      if (ptr) {
        next[8 + i * 2] = (ptr + 2) & 255;
        next[9 + i * 2] = (ptr + 2) >> 8;
      }
    }
    const at = old.length + 2;
    next[8 + slots * 2] = at & 255;
    next[9 + slots * 2] = at >> 8;
    next.set(old.slice(8 + slots * 2), 10 + slots * 2);
    next.set(data, at);
    const previous = await link.read(26, addr, 3);
    try {
      await link.verifiedWrite(44, 45, 0, next, true);
      await link.verifiedWrite(26, 27, addr, [96, slots, 0]);
    } catch (e) {
      await link.verifiedWrite(26, 27, addr, previous);
      await link.verifiedWrite(44, 45, 0, old, true);
      throw e;
    }
    await loadSlots(link);
  });
  message("Macro stored and bound to " + selected.name + ".");
});
action("screen", async () => {
  ready();
  if (link.device.productId !== 0x2731)
    throw Error("Plug in the cable and switch the Drox to USB mode.");
  await wakeLCD(true);
  await new Promise((r) => setTimeout(r, 750));
  let displayDevice;
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      displayDevice = await pick([
        { vendorId: 0x1919, productId: 0x1919, usagePage: 255, usage: 1 },
      ]);
      break;
    } catch (e) {
      if (attempt === 11) throw e;
      await wakeLCD(true);
      await new Promise((r) => setTimeout(r, 600));
    }
  }
  const conn = new Link(displayDevice, true);
  const info = await conn.session(() => conn.command(18, 0, 56));
  width = word(info, 20);
  height = word(info, 22);
  if (width !== 200 || height !== 480)
    throw Error("Unrecognized display dimensions.");
  lcd = conn;
  message("LCD connected · " + width + " × " + height);
});
$("gif").onchange = () => {
  if (gifURL) URL.revokeObjectURL(gifURL);
  const f = $("gif").files[0];
  $("preview").hidden = !f;
  $("clipInfo").textContent = f
    ? f.name + " · " + Math.ceil(f.size / 1024) + " KB"
    : "Choose a GIF to preview it here.";
  if (f) {
    gifURL = URL.createObjectURL(f);
    $("preview").src = gifURL;
  }
};
function progress(value, label) {
  $("progress").value = value;
  message(label + " · " + value + "%");
}
function encode(file) {
  return new Promise((resolve, reject) => {
    const worker = new Worker("encode.js");
    worker.onmessage = ({ data }) => {
      if (data.bytes || data.error) {
        worker.terminate();
        data.error ? reject(Error(data.error)) : resolve(data.bytes);
      } else progress(data.progress, "Preparing frames");
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(Error(e.message));
    };
    worker.postMessage({
      file,
      width,
      height,
      fit: $("fit").value,
      start: Number($("trimStart").value),
      end: $("trimEnd").value === "" ? null : Number($("trimEnd").value),
      rotation: Number($("rotation").value),
      mirror: $("mirror").checked,
      fps: Number($("fps").value),
    });
  });
}
action("upload", async () => {
  if (!lcd) throw Error("Connect the LCD first.");
  const file = $("gif").files[0];
  if (!file || file.size > 16 * 1024 * 1024)
    throw Error("Choose a GIF under 16 MiB.");
  uploading = true;
  try {
    const files = [file, ...$("gif2").files];
    if (files.some((f) => f.size > 16 * 1024 * 1024))
      throw Error("Each GIF must be under 16 MiB.");
    const bytes = [];
    for (const clip of files) bytes.push(await encode(clip));
    if (
      !confirm(
        "Replace all existing LCD animations with " +
          files.map((f) => f.name).join(" and ") +
          "?",
      )
    ) {
      message("Upload cancelled.");
      return;
    }
    await uploadAnimation(lcd, bytes, progress);
    progress(100, "LCD animation saved");
  } finally {
    uploading = false;
  }
});

action("applyGame", async () => {
  ready();
  await link.session(async () => {
    const cfg = await link.read(20, 0, 64);
    for (const [id, off] of [
      ["sleep", 46],
      ["deep", 49],
    ]) {
      const n = Number($(id).value);
      if (!Number.isInteger(n) || n < 1 || n > 60)
        throw Error("Choose sleep times from 1 to 60 minutes.");
      cfg.set([(n * 60) & 255, (n * 60) >> 8, 0], off);
    }
    cfg[42] = Number($("keyDelay").value);
    for (const [id, offset] of gameFields) cfg[offset] = Number($(id).checked);
    await link.verifiedWrite(20, 21, 0, cfg);
  });
  message("Gaming settings saved and verified.");
});

action("clock", async () => {
  if (!lcd) throw Error("Connect the LCD first.");
  const now = new Date(),
    digits = (n) => String(n).padStart(2, "0").split("").map(Number);
  const stamp = [
    ...digits(now.getFullYear()),
    ...digits(now.getMonth() + 1),
    now.getDay(),
    ...digits(now.getDate()),
    ...digits(now.getHours()),
    ...digits(now.getMinutes()),
    ...digits(now.getSeconds()),
  ];
  await lcd.session(() => lcd.command(23, 0, 56, stamp));
  message("LCD clock synchronized.");
});

let waking = null,
  uploading = false;
function wakeLCD(force = false) {
  if (!waking)
    waking = (async () => {
      await link.session(async () => {
        if (force || !(await link.command(226))[8]) await link.command(224);
      });
    })().finally(() => {
      waking = null;
    });
  return waking;
}
setInterval(() => {
  if (link && lcd && !$("Display").hidden && (!busy || uploading))
    wakeLCD().catch(() => {});
}, 1000);

function rgb() {
  return $("color")
    .value.slice(1)
    .match(/../g)
    .map((x) => parseInt(x, 16));
}
async function loadSlots(conn) {
  const header = await conn.read(44, 0, 8),
    n = header[0] === 170 && header[1] === 85 ? word(header, 4) : 0;
  $("slots").replaceChildren();
  for (let i = 0; i < Math.min(n, base[13]); i++)
    $("slots").add(new Option("Onboard macro " + (i + 1), i));
}
action("bindStored", async () => {
  ready();
  if (!$("slots").options.length) throw Error("Record your first macro.");
  const addr = keyAddress();
  await link.session(() =>
    link.verifiedWrite(26, 27, addr, [96, Number($("slots").value), 0]),
  );
  message("Stored macro bound to " + selected.name + " on layer 1.");
});
action("paint", async () => {
  ready();
  const mode = Number($("effect").value);
  if (Number($("zone").value) !== 0 || mode < 253)
    throw Error("Select a custom key backlight palette first.");
  const led = lightMap[keyAddress() / 3];
  if (led === 255) throw Error("This key has no mapped LED.");
  await link.session(async () => {
    const full = await link.read(20, 0, 64);
    full[1] = 0;
    full[2] = 253;
    full[10] = mode - 253;
    const read = 34 + 2 * (mode - 253);
    await link.verifiedWrite(read, read + 1, 3 * led, rgb());
    await link.verifiedWrite(20, 21, 0, full);
    settings = full;
    await updatePalette();
  });
  palette.set(rgb(), 3 * led);
  renderBoard();
  message(selected.name + " color saved to palette " + (mode - 252) + ".");
});

function renderSteps() {
  const view = $("steps");
  view.replaceChildren();
  for (const [i, step] of events.entries()) {
    const row = document.createElement("div");
    row.className = "step";
    const label = document.createElement("span");
    const keyboard = (step[3] & 127) === 1;
    label.textContent =
      (step[3] & 128 ? "↓ " : "↑ ") +
      (keyboard
        ? targets.get(step[2]) ||
          Object.keys(special).find((k) => special[k] === step[2]) ||
          "HID " + step[2]
        : "Mouse " + step[2]);
    const delay = document.createElement("input");
    delay.type = "number";
    delay.min = 10;
    delay.max = 50000;
    delay.value = word(step, 0);
    delay.title = "Delay before event in milliseconds";
    delay.onchange = () => {
      const n = Math.max(
        10,
        Math.min(50000, Math.round(Number(delay.value) || 10)),
      );
      step[0] = n & 255;
      step[1] = n >> 8;
      delay.value = n;
    };
    row.append(label, delay, document.createTextNode("ms"));
    view.append(row);
  }
}
async function macroTable() {
  const h = await link.read(44, 0, 8),
    len = word(h, 2),
    count = word(h, 4);
  if (
    h[0] !== 170 ||
    h[1] !== 85 ||
    len > 1096 ||
    len < 8 + 2 * count ||
    count > base[13]
  )
    throw Error("No readable macro table.");
  const bytes = await link.read(44, 0, len),
    parts = [];
  for (let i = 0; i < count; i++) {
    const at = word(bytes, 8 + i * 2);
    if (!at) {
      parts.push(null);
      continue;
    }
    const end = at + 4 + 4 * word(bytes, at);
    if (at < 8 + 2 * count || end > len) throw Error("Invalid macro record.");
    parts.push(bytes.slice(at, end));
  }
  return { bytes, parts };
}
action("inspectMacro", async () => {
  ready();
  const { parts } = await link.session(macroTable),
    part = parts[Number($("slots").value)];
  if (!part) throw Error("Select an occupied macro slot.");
  events = [];
  for (let i = 4; i < part.length; i += 4)
    events.push(Array.from(part.slice(i, i + 4)));
  renderSteps();
  $("sequence").textContent = events.length + " events · edit the delays below";
  message("Sequence loaded from keyboard.");
});
action("replaceMacro", async () => {
  ready();
  if (!events.length || !$("slots").options.length)
    throw Error("Select a slot and record or open a sequence.");
  if (
    !confirm(
      "Replace the selected onboard macro? Keys bound to this slot will use the edited sequence.",
    )
  )
    return;
  await link.session(async () => {
    const { bytes, parts } = await macroTable(),
      slot = Number($("slots").value);
    parts[slot] = Uint8Array.from([
      events.length & 255,
      events.length >> 8,
      0,
      0,
      ...events.flat(),
    ]);
    let offset = 8 + 2 * parts.length;
    const size = parts.reduce((sum, part) => sum + (part?.length || 0), offset);
    if (size > 1096) throw Error("The edited sequence exceeds macro storage.");
    const next = new Uint8Array(size);
    next.set(bytes.slice(0, 8));
    next[2] = size & 255;
    next[3] = size >> 8;
    parts.forEach((part, i) => {
      if (part) {
        next[8 + i * 2] = offset & 255;
        next[9 + i * 2] = offset >> 8;
        next.set(part, offset);
        offset += part.length;
      }
    });
    try {
      await link.verifiedWrite(44, 45, 0, next, true);
    } catch (e) {
      await link.verifiedWrite(44, 45, 0, bytes, true);
      throw e;
    }
  });
  message("Edited macro saved to its original slot.");
});
const presetKey = "drox-presets-v1";
function presets() {
  return new Map(JSON.parse(localStorage.getItem(presetKey) || "[]"));
}
function listPresets(items) {
  $("presetList").replaceChildren(
    ...[...items.keys()].map((n) => new Option(n, n)),
  );
}
listPresets(presets());
const presetOffsets = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 38, 39, 40,
  41, 42, 44, 45, 46, 47, 48, 49, 50, 51, 58,
];
action("capturePreset", async () => {
  ready();
  const name = $("presetName").value.trim();
  if (!name) throw Error("Name the preset first.");
  const items = presets(),
    cfg = await link.session(() => link.read(20, 0, 64));
  items.set(
    name,
    presetOffsets.map((i) => cfg[i]),
  );
  localStorage.setItem(presetKey, JSON.stringify([...items]));
  listPresets(items);
  $("presetList").value = name;
  message("Preset saved on this PC.");
});
action("deletePreset", async () => {
  const items = presets();
  items.delete($("presetList").value);
  localStorage.setItem(presetKey, JSON.stringify([...items]));
  listPresets(items);
  message("Preset removed.");
});
action("applyPreset", async () => {
  ready();
  const values = presets().get($("presetList").value);
  if (!values || values.length !== presetOffsets.length)
    throw Error("Select a saved preset.");
  await link.session(async () => {
    const cfg = await link.read(20, 0, 64);
    presetOffsets.forEach((offset, i) => (cfg[offset] = values[i]));
    await link.verifiedWrite(20, 21, 0, cfg);
    settings = cfg;
    await updatePalette();
  });
  renderBoard();
  renderLighting();
  $("keyDelay").value = settings[42];
  for (const [id, i] of gameFields) $(id).checked = Boolean(settings[i]);
  for (const [id, i] of [
    ["sleep", 46],
    ["deep", 49],
  ])
    $(id).value = Math.round(
      (word(settings, i) + 65536 * settings[i + 2]) / 60,
    );
  message("Preset applied and verified.");
});

$("fit").onchange = () => {
  $("preview").style.objectFit = $("fit").value;
};

const media = new Map([
  [233, "Volume up"],
  [234, "Volume down"],
  [226, "Mute audio"],
  [205, "Play / pause"],
  [182, "Previous track"],
  [181, "Next track"],
  [183, "Stop playback"],
]);
for (const [n, label] of media)
  $("target").add(new Option(label, "media-" + n));
for (const [i, n] of [
  "Left Ctrl",
  "Left Shift",
  "Left Alt",
  "Left Win",
  "Right Ctrl",
  "Right Shift",
  "Right Alt",
  "Right Win",
].entries())
  $("target").add(new Option(n, i + 224));
function assignmentAddress() {
  return $("control").value === "key"
    ? keyAddress()
    : wheel[Number($("control").value)] * 3;
}
function showBinding() {
  if (!link) return;
  try {
    const at = assignmentAddress(),
      [type, a, b] = layerMaps[Number($("layer").value)].slice(at, at + 3);
    let label;
    if (type === 16)
      label = [
        ...[
          "Ctrl",
          "Shift",
          "Alt",
          "Win",
          "Right Ctrl",
          "Right Shift",
          "Right Alt",
          "Right Win",
        ].filter((_, i) => a & (1 << i)),
        ...(b ? [targets.get(b) || "Key " + b] : []),
      ].join(" + ");
    if (type === 48) label = media.get(a);
    if (type === 96 || type === 97) label = "Onboard macro " + (a + 1);
    $("currentBinding").textContent =
      "Currently assigned · " + (label || "Device action " + a);
  } catch (e) {
    $("currentBinding").textContent = e.message;
  }
}
$("control").onchange = showBinding;
$("layer").onchange = showBinding;

let palette;
async function updatePalette(conn = link) {
  palette =
    settings[2] === 253 && settings[10] < 5
      ? await conn.read(34 + settings[10] * 2, 0, 384)
      : null;
}
function renderBoard() {
  const buttons = document.querySelectorAll(".key");
  keys.forEach((key, i) => {
    let color = null;
    if (settings[1] === 0) {
      if (palette) {
        try {
          const led = lightMap[keyAddress(key) / 3];
          if (led < 128) color = palette.slice(3 * led, 3 * led + 3);
        } catch {}
      } else if (settings[2] === 4 && settings[5] !== 0)
        color = settings.slice(7, 10);
    }
    buttons[i].style.setProperty(
      "--led",
      color ? "rgb(" + Array.from(color).join(",") + ")" : "transparent",
    );
  });
}
