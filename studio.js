const $=id=>document.getElementById(id);
const pages=['Lighting','Assignments','Macros','Display','Gaming'];
const gameFields=[['winlock',40],['wasd',41],['snaptap',58]];
let link,lcd,base,factory,selected=keys[0],width,height,busy=false,recording=false,events=[],lastTime,held=new Set(),gifURL;
const message=text=>{$('status').textContent=text};
const word=(data,i)=>data[i]+256*data[i+1];
function page(name){
  for(const p of pages) $(p).hidden=p!==name;
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===name));
  $('title').textContent=name;
}
for(const b of document.querySelectorAll('nav button')) b.onclick=()=>{if(recording) stopRecording();page(b.dataset.page)};
for(const k of keys){
  const b=document.createElement('button');b.className='key';b.textContent=k.name;b.title=k.name;
  Object.assign(b.style,{left:(1+k.x*5.65)+'%',top:(3+k.y*19)+'%',width:(k.w*5.65-.45)+'%',height:(k.h*19-1.5)+'%'});
  b.onclick=()=>{document.querySelector('.chosen')?.classList.remove('chosen');b.classList.add('chosen');selected=k;$('selection').textContent='Selected key  /  '+k.name};
  $('board').append(b);
}
document.querySelector('.key').click();page('Lighting');
const names=['Spectrum','Color cycle','Breathing','Steady','Reactive','Ripple','Spin','Meteor','Wave','Fountain','Wings','Bloom','Rain','Pulse','Sweep'];
for(let i=1;i<=21;i++) $('effect').add(new Option(names[i-1]||'Effect '+i,i));
$('effect').add(new Option('Off',0));$('effect').value='4';
const targets=new Map(keys.filter(k=>k.code<165).map(k=>[k.code,k.name]));
for(let i=0;i<12;i++) targets.set(58+i,'F'+(i+1));
for(const [code,name] of targets) $('target').add(new Option(name,code));
$('color').oninput=()=>document.documentElement.style.setProperty('--keyglow',$('color').value);
function action(id,fn){$(id).onclick=async()=>{
  if(busy||recording)return;
  busy=true;
  const buttons=[...document.querySelectorAll('button,select,input')];buttons.forEach(b=>b.disabled=true);
  try{await fn()}catch(e){message(e.message)}finally{busy=false;buttons.forEach(b=>b.disabled=false)}
}}
function ready(){if(!link)throw Error('Connect the keyboard first.')}
async function pick(filters){
  const devices=await navigator.hid.requestDevice({filters});
  const device=devices.find(d=>filters.some(f=>d.vendorId===f.vendorId&&d.productId===f.productId&&d.collections.some(c=>c.usagePage===f.usagePage&&c.usage===f.usage)));
  if(!device)throw Error('Device unavailable. Close the vendor driver, check the connection and try again.');
  return device;
}
action('connect',async()=>{
  link=null;lcd=null;message('Reading keyboard…');
  const dev=await pick([0x2731,0x2736].map(productId=>({vendorId:0x3299,productId,usagePage:65376,usage:97})));
  const conn=new Link(dev);
  await conn.session(async()=>{
    base=await conn.read(18,0,47);
    if(![2,3].includes(base[8])||base[12]!==128)throw Error('Unsupported Drox firmware layout.');
    factory=await conn.read(22,0,384);
    const cfg=await conn.read(20,0,64);
    for(const [id,offset] of gameFields) $(id).checked=Boolean(cfg[offset]);
    $('brightness').max=base[16];$('brightness').value=cfg[3];
    $('effect').value=cfg[1]&&cfg[2]<=21?cfg[2]:0;
    $('color').value='#'+[...cfg.slice(7,10)].map(v=>v.toString(16).padStart(2,'0')).join('');$('color').oninput();
  });
  link=conn;$('connect').textContent='Reconnect';
  $('device').textContent=(dev.productId===0x2731?'USB wired':'2.4 GHz receiver')+'  ·  Firmware '+word(base,6).toString(16);
  message('Keyboard settings loaded.');
});
navigator.hid.addEventListener('disconnect',({device})=>{
  if(device===link?.device){link=null;lcd=null;$('device').textContent='Disconnected';message('Keyboard disconnected. Reconnect to continue.')}
  if(device===lcd?.device)lcd=null;
});
action('applyLight',async()=>{
  ready();await link.session(async()=>{
    const full=await link.read(20,0,64), cfg=full.subarray(1,10);
    const mode=Number($('effect').value);cfg[0]=Number(mode!==0);
    if(mode){cfg[1]=mode;cfg[2]=Number($('brightness').value);cfg[4]=0;cfg[5]=0;
      cfg.set($('color').value.slice(1).match(/../g).map(v=>parseInt(v,16)),6)}
    await link.verifiedWrite(20,21,0,full);
  });message('Lighting saved and verified.');
});
function keyAddress(){
  const code=selected.code,mask=code>=224&&code<=231?1<<(code-224):0;
  const found=[];
  for(let i=0;i<factory.length;i+=3)
    if(factory[i]===16&&factory[i+1]===mask&&factory[i+2]===(mask?0:code))found.push(i);
  if(found.length!==1)throw Error('This control has no unique factory key address. Choose another key.');
  return found[0];
}
async function assign(data){ready();const addr=keyAddress();const layer=Number($('layer').value);
  await link.session(async()=>{
    const binding=data||await link.read(22+layer,addr,3);
    await link.verifiedWrite(26+2*layer,27+2*layer,addr,binding);
  });message('Assignment verified for '+selected.name+'.')}
action('assign',()=>assign([16,0,Number($('target').value)]));action('restore',()=>assign());
const special={Space:44,Enter:40,Escape:41,Backspace:42,Tab:43,Minus:45,Equal:46,BracketLeft:47,BracketRight:48,Backslash:49,Semicolon:51,Quote:52,Backquote:53,Comma:54,Period:55,Slash:56,ArrowRight:79,ArrowLeft:80,ArrowDown:81,ArrowUp:82,ControlLeft:224,ShiftLeft:225,AltLeft:226,MetaLeft:227,ControlRight:228,ShiftRight:229,AltRight:230,MetaRight:231};
function usage(code){
  if(/^Key[A-Z]$/.test(code))return code.charCodeAt(3)-61;
  if(/^Digit\d$/.test(code))return code==='Digit0'?39:29+Number(code[4]);
  if(/^F([1-9]|1[012])$/.test(code))return Number(code.slice(1))+57;
  return special[code];
}
function stopRecording(){for(const code of held)events.push([10,0,code,1]);held.clear();recording=false;$('record').textContent='Record again';$('sequence').textContent=events.length+' recorded events';}
$('record').onclick=()=>{if(recording){stopRecording();return}events=[];held.clear();recording=true;lastTime=performance.now();$('record').textContent='Stop recording';$('sequence').textContent='Type your sequence, then click Stop.';};
for(const type of ['keydown','keyup'])window.addEventListener(type,e=>{
  if(!recording)return;e.preventDefault();if(e.repeat)return;
  const code=usage(e.code),down=type==='keydown';if(!code||(!down&&!held.has(code)))return;
  const now=performance.now(),delay=Math.max(10,Math.min(50000,Math.round(now-lastTime)));lastTime=now;
  events.push([delay&255,delay>>8,code,down?129:1]);down?held.add(code):held.delete(code);
  $('sequence').textContent=events.length+' events · '+e.code;
  if(events.length>=160)stopRecording();
});
window.addEventListener('blur',()=>{if(recording)stopRecording()});
action('saveMacro',async()=>{
  ready();const addr=keyAddress();if(!events.length)throw Error('Record a macro first.');
  await link.session(async()=>{
    const header=await link.read(44,0,8),oldLen=word(header,2),count=word(header,4);
    const empty=header.every(v=>v===255)||header.every(v=>v===0);
    if(!empty&&(header[0]!==170||header[1]!==85||oldLen<8+count*2||oldLen>1096))throw Error('Unrecognized macro table. Existing macros were preserved.');
    const old=empty?Uint8Array.of(170,85,8,0,0,0,0,0):await link.read(44,0,oldLen);
    const slots=empty?0:count, data=Uint8Array.from([events.length&255,events.length>>8,0,0,...events.flat()]);
    if(slots>=base[13]||old.length+2+data.length>1096)throw Error('Not enough free macro storage.');
    const next=new Uint8Array(old.length+2+data.length);next.set(old.slice(0,8));
    next[2]=next.length&255;next[3]=next.length>>8;next[4]=slots+1;
    for(let i=0;i<slots;i++){const ptr=word(old,8+i*2);if(ptr){next[8+i*2]=(ptr+2)&255;next[9+i*2]=(ptr+2)>>8}}
    const at=old.length+2;next[8+slots*2]=at&255;next[9+slots*2]=at>>8;
    next.set(old.slice(8+slots*2),10+slots*2);next.set(data,at);
    const previous=await link.read(26,addr,3);
    try{await link.verifiedWrite(44,45,0,next,true);await link.verifiedWrite(26,27,addr,[96,slots,0])}
    catch(e){await link.verifiedWrite(26,27,addr,previous);await link.verifiedWrite(44,45,0,old,true);throw e}
  });message('Macro stored and bound to '+selected.name+'.');
});
action('screen',async()=>{
  ready();if(link.device.productId!==0x2731)throw Error('Plug in the cable and switch the Drox to USB mode.');
  await link.session(()=>link.command(224));await new Promise(r=>setTimeout(r,1200));
  let displayDevice;
  for(let attempt=0;attempt<6;attempt++){
    try{displayDevice=await pick([{vendorId:0x1919,productId:0x1919,usagePage:255,usage:1}]);break}
    catch(e){if(attempt===5)throw e;await new Promise(r=>setTimeout(r,600))}
  }
  const conn=new Link(displayDevice,true);
  const info=await conn.session(()=>conn.command(18,0,56));
  width=word(info,20);height=word(info,22);
  if(width!==200||height!==480)throw Error('Unrecognized display dimensions.');lcd=conn;
  message('LCD connected · '+width+' × '+height);
});
$('gif').onchange=()=>{if(gifURL)URL.revokeObjectURL(gifURL);const f=$('gif').files[0];$('preview').hidden=!f;if(f){gifURL=URL.createObjectURL(f);$('preview').src=gifURL}};
function progress(value,label){$('progress').value=value;message(label+' · '+value+'%')}
function encode(file){return new Promise((resolve,reject)=>{
  const worker=new Worker('encode.js');
  worker.onmessage=({data})=>{if(data.bytes||data.error){worker.terminate();data.error?reject(Error(data.error)):resolve(data.bytes)}else progress(data.progress,'Preparing frames')};
  worker.onerror=e=>{worker.terminate();reject(Error(e.message))};worker.postMessage({file,width,height,fps:Number($('fps').value)});
})}
action('upload',async()=>{
  if(!lcd)throw Error('Connect the LCD first.');const file=$('gif').files[0];
  if(!file||file.size>16*1024*1024)throw Error('Choose a GIF under 16 MiB.');
  const bytes=await encode(file);
  if(!confirm('Replace all existing LCD animations with '+file.name+'?')){message('Upload cancelled.');return}
  await uploadAnimation(lcd,bytes,progress);progress(100,'LCD animation saved');
});


action('applyGame',async()=>{
  ready();
  await link.session(async()=>{
    const cfg=await link.read(20,0,64);
    for(const [id,offset] of gameFields) cfg[offset]=Number($(id).checked);
    await link.verifiedWrite(20,21,0,cfg);
  });
  message('Gaming settings saved and verified.');
});



action('clock',async()=>{
  if(!lcd)throw Error('Connect the LCD first.');
  const now=new Date(), digits=n=>String(n).padStart(2,'0').split('').map(Number);
  const stamp=[...digits(now.getFullYear()),...digits(now.getMonth()+1),now.getDay(),
    ...digits(now.getDate()),...digits(now.getHours()),...digits(now.getMinutes()),...digits(now.getSeconds())];
  await lcd.session(()=>lcd.command(23,0,56,stamp));message('LCD clock synchronized.');
});
