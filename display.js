async function uploadAnimation(lcd, bytes, progress) {
  const blocks=Math.ceil(bytes.length/65536);
  if(!blocks || blocks>16) throw Error('Encoded animation exceeds the 1 MiB Studio limit. Lower the frame rate or shorten the GIF.');
  await lcd.session(async()=>{
    if((await lcd.command(28))[9]!==2) throw Error('Switch the keyboard to wired mode.');
    await lcd.command(27,0,56);
    await lcd.command(20,0,56);
    const n=bytes.length;
    await lcd.command(21,0,56,[0,1,blocks,0,0,n&255,(n>>8)&255,(n>>16)&255]);
    await lcd.command(21,56,56);
    await lcd.command(21,112,16);
    await lcd.command(22,0,56);
    progress(0,'Erasing animation storage');
    await lcd.command(24,0,1,[blocks]);
    await new Promise(resolve=>setTimeout(resolve,500*blocks));
    let last=-1;
    for(let offset=0;offset<n;offset+=56){
      const part=bytes.subarray(offset,offset+56);
      await lcd.command(25,offset,part.length,part);
      const pct=Math.floor(100*(offset+part.length)/n);
      if(pct!==last){progress(pct,'Writing animation');last=pct}
    }
    await lcd.command(26);
  });
}
if(typeof module!=='undefined') module.exports={uploadAnimation};
