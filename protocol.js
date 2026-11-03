// All offsets here are offsets in the HID payload, excluding the report ID.
class Link {
  constructor(device, display = false) {
    this.device = device;
    this.display = display;
    this.size = device.productId === 0x2736 && !display ? 32 : 64;
    this.chunk = this.size - 8;
  }
  async command(cmd, offset = 0, length = 0, data = [], checksum = 0) {
    const packet = new Uint8Array(this.size);
    packet.set([0xaa, cmd, offset & 255, (offset >> 8) & 255,
      this.display ? (offset >> 16) & 255 : length, this.display ? length : checksum, 0, 0]);
    packet.set(data, 8);
    const dev = this.device;
    if (!dev.opened) await dev.open();
    return new Promise((resolve, reject) => {
      const finish = (err, value) => {
        clearTimeout(timer);
        dev.removeEventListener('inputreport', receive);
        err ? reject(err) : resolve(value);
      };
      const receive = event => {
        const r = new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength);
        if (r[0] !== 0xaa || r[1] !== cmd) return;
        if (!this.display && (r[2] !== packet[2] || r[3] !== packet[3])) return;
        if (!this.display && r[7] !== 0x55) return finish(new Error('Keyboard rejected command ' + cmd));
        finish(null, r.slice());
      };
      const timer = setTimeout(() => finish(new Error('No reply to command ' + cmd + '. Check the cable or wake the keyboard.')), 2500);
      dev.addEventListener('inputreport', receive);
      dev.sendReport(0, packet).catch(e => finish(e));
    });
  }
  async session(fn) {
    await this.command(16);
    try { return await fn(); } finally { await this.command(17); }
  }
  async read(cmd, start, size) {
    const result = new Uint8Array(size);
    for (let i = 0; i < size; i += this.chunk) {
      const count = Math.min(this.chunk, size-i);
      const reply = await this.command(cmd, start+i, count);
      if (reply.length < count+8) throw Error('Incomplete keyboard reply');
      result.set(reply.slice(8,8+count),i);
    }
    return result;
  }
  async verifiedWrite(readCmd, writeCmd, offset, bytes, sum = false) {
    for (let i=0;i<bytes.length;i+=this.chunk) {
      const part = bytes.slice(i,i+this.chunk);
      await this.command(writeCmd, offset+i, part.length, part, sum ? part.reduce((a,b)=>a+b,0)&255 : 0);
    }
    if (writeCmd === 21) { await this.command(17); await this.command(16); }
    let actual;
    for(let attempt=0;attempt<5;attempt++){
      actual=await this.read(readCmd,offset,bytes.length);
      if(bytes.every((b,i)=>actual[i]===b))return;
      if(attempt<4)await new Promise(resolve=>setTimeout(resolve,80));
    }
    if (!bytes.every((b,i)=>actual[i]===b)) throw Error('Read-back differs at byte ' + (offset + bytes.findIndex((b,i)=>actual[i]!==b)) + '. Reconnect before retrying.');
  }
}
if (typeof module !== 'undefined') module.exports = {Link};



