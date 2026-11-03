const fs = require('node:fs/promises');
const { createHash } = require('node:crypto');
(async () => {
  await fs.mkdir('codec',{recursive:true});
  for (const [file, hash] of Object.entries({
    'qgif.js':'51b6403c064b7bce7e96db443422442d65d2a2299536c71232860aeaec734d0a',
    'qgif.wasm':'6ba0d26de45d0f50d92b3db5156df809d25b56eb77087d427cba70c7ebb4d8b7'
  })) {
    const response = await fetch('https://www.krux.tech/drox-soft/'+file);
    if (!response.ok) throw Error('Codec download failed');
    const data = Buffer.from(await response.arrayBuffer());
    if (createHash('sha256').update(data).digest('hex') !== hash) throw Error('Unexpected codec version');
    await fs.writeFile('codec/'+file,data);
  }
})().catch(e=>{console.error(e);process.exitCode=1});
