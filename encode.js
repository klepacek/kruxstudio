importScripts('codec/qgif.js');
onmessage = async ({data:{file,width,height,fps}}) => {
  try {
    const decoder = new ImageDecoder({type:'image/gif',data:await file.arrayBuffer()});
    await decoder.tracks.ready;
    const count = decoder.tracks.selectedTrack.frameCount;
    if (!count || count>1200) throw Error('Choose a GIF with 1 to 1,200 frames.');
    const canvas = new OffscreenCanvas(width,height), ctx=canvas.getContext('2d');
    const mod = await createModule({locateFile:()=>new URL('codec/qgif.wasm',self.location.href).href});
    let elapsed=0, written=0;
    for(let i=0;i<count;i++){
      const {image}=await decoder.decode({frameIndex:i});
      elapsed+=Math.max(10000,image.duration||100000);
      const target=Math.max(1,Math.round(elapsed*fps/1e6));
      if(target>600) throw Error('Animation too long. Lower the frame rate or trim the GIF.');
      if(target>written){
        const scale=Math.min(width/image.displayWidth,height/image.displayHeight);
        const w=image.displayWidth*scale,h=image.displayHeight*scale;
        ctx.fillStyle='black';ctx.fillRect(0,0,width,height);
        ctx.drawImage(image,(width-w)/2,(height-h)/2,w,h);
        const blob=await canvas.convertToBlob({type:'image/png'});
        const png=new Uint8Array(await blob.arrayBuffer());
        while(written<target) {
          mod.FS.writeFile('input_'+written+'.png',png);
          written++;
        }
      }
      image.close();postMessage({progress:Math.round(100*(i+1)/count)});
    }
    decoder.close();
    mod.cwrap('compress_video_wasm','number',['string','string','number','number'])('input_X.png','output.qgif',0,fps);
    const bytes=mod.FS.readFile('output.qgif');
    if(!bytes.length) throw Error('Encoder produced an empty animation.');
    postMessage({bytes},[bytes.buffer]);
  }catch(e){postMessage({error:e.message})}
};

