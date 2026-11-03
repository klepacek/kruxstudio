# Drox Studio

A portable Windows x64 control center for the KRUX Drox KRXA001. The desktop app runs locally and communicates with the keyboard over HID. It prefers a wired keyboard when the receiver is also plugged in.

## Run

Extract the entire Windows build and launch **Drox Studio.exe**. Click **Connect keyboard**. Close the vendor configurator if a connection is busy. Windows builds are available as artifacts on successful runs of the **Windows portable app** GitHub Actions workflow.

- **Lighting** sets the onboard backlight effect, brightness and color.
- **Keys** assigns a key on any of four layers and restores individual factory assignments. The diagram resolves physical keys against the firmware's factory map. Controls without a unique address are unavailable.
- **Macros** records keyboard press and release events with timing. Choose a trigger key, start recording, type the sequence, stop and bind it. Each bind appends a slot to the onboard table and assigns the trigger on layer 1. The existing slots are preserved.
- **Display** connects to the wired LCD, syncs the clock, and replaces its animation collection with a selected GIF. The encoder fits the image into 200 × 480, preserves aspect ratio and samples original frame timing at 8, 12 or 20 fps. Conversion runs in a worker. Studio waits for each 56-byte transfer reply. Upload progress measures acknowledged bytes. A failed transfer after erase requires uploading again. Keep the cable connected through completion.
- **Gaming** controls Windows-key lock, WASD arrow mode and Snap Tap for the active profile.

## Build from source

Use Windows x64 and Node.js 24. From the repository directory run:

```sh
npm ci
npm run codec
npm test
npm start
```

Run `npm run package` to build the portable directory under `dist/`. The codec setup downloads and verifies the KRUX QGIF encoder and WebAssembly binary from the [official driver](https://www.krux.tech/drox-soft/). The packaged app includes those files for offline use.

## Hardware coverage

Tested on a wired Drox reporting firmware 112 and protocol 3. Physical checks covered device configuration reads, lighting write/read-back, key remapping, recording-table writes, restoration of previous settings and LCD identification. GIF encoding ran in Electron. Upload framing and failure handling were tested with a simulated LCD so the existing hardware animation collection could be preserved. No physical upload speed measurement is available. Receiver discovery was checked separately. Bluetooth configuration, firmware flashing and complete parity with the vendor editor are outside this version.

The layout coordinates and HID commands were derived from the public KRUX control center and wired-device responses. This is an independent utility.
