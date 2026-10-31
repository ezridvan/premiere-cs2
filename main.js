const {entrypoints,storage}=require('uxp');
let effectTimer=null;
entrypoints.setup({panels:{playerPanel:{show(){startEffectTracking()},destroy(){stopEffectTracking();numericControls.forEach(c=>c.stop())}}}});
const fs=storage.localFileSystem;
const ppro=require('premierepro');
const {createEffects}=require('./overlay-effects.js');
const effects=createEffects(ppro);
const {bindNumericControl}=require('./numeric-control.js');
const numericControls=[];
const {stillDurationTicks,setStillSourceDuration,verifyStillSourceDuration}=require('./still-duration.js');
const {PLAYER_COLORS,getPlayerColor,applyPlayerLabel,readSelectedLabel}=require('./player-colors.js');
let selectedColor=null;
let labelOverrides={};
let labelSettingsReady=loadLabelSettings();
let effectError='';
const $=id=>document.getElementById(id);
let players=[],selected=null,tab='favorites';
const defaults={color:'yellow',slideDistance:50,scale:100,x:960,y:540,rotation:0,opacity:100};
const specs=[['scale','Scale (%)',10,300,1],['x','Position X',-100000,100000,1],['y','Position Y',-100000,100000,1],['rotation','Rotation (°)',-180,180,1],['opacity','Opacity (%)',0,100,1],['slideDistance','Kayma mesafesi (%)',0,200,1]];
function status(s){$('status').textContent=s}
function make(tag,cls,txt){const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n}
async function loadLabelSettings(){
  try{
    const dir=await fs.getDataFolder();
    const data=JSON.parse(await (await dir.getEntry('color-labels.json')).read());
    if(Number.isInteger(data.orange)&&data.orange>=0&&data.orange<=15)labelOverrides={orange:data.orange};
  }catch(e){labelOverrides={}}
}
async function saveOrangeLabel(index){
  const dir=await fs.getDataFolder();
  const file=await dir.createFile('color-labels.json',{overwrite:true});
  await file.write(JSON.stringify({orange:index}));
  labelOverrides={orange:index};
}
async function saveDB(){const dir=await fs.getDataFolder();const f=await dir.createFile('players.json',{overwrite:true});await f.write(JSON.stringify(players));}
async function loadDB(){try{const dir=await fs.getDataFolder();const f=await dir.getEntry('players.json');const data=JSON.parse(await f.read());players=Array.isArray(data)?data:[]}catch(e){players=[]}render();status(players.length+' oyuncu hazır.')}
function render(){const grid=$('grid');while(grid.firstChild)grid.removeChild(grid.firstChild);const q=String($('search').value||'').trim().toLowerCase();const shown=players.filter(p=>(tab==='all'||p.fav)&&String(p.name||'').toLowerCase().includes(q));$('count').textContent=shown.length+' oyuncu gösteriliyor · Toplam '+players.length;$('empty').textContent=shown.length?'':'Burada henüz oyuncu yok.';shown.forEach(p=>{const card=make('div','card');const src=p.preview||p.src;if(src){const img=make('img','thumb');img.src=src;card.appendChild(img)}else card.appendChild(make('div','thumb','PNG yok'));card.appendChild(make('div','name',p.name));const color=getPlayerColor(p.color);if(color){const badge=make('div','player-color-badge',color.name);badge.style.color=color.hex;card.appendChild(badge)}const actions=make('div','cardactions');const star=make('button','',p.fav?'★':'☆');star.onclick=async e=>{e.stopPropagation();p.fav=!p.fav;await saveDB();render()};const edit=make('button','','⚙');edit.onclick=e=>{e.stopPropagation();choose(p.id)};star.title='Favori';edit.title='Ayarlar';actions.appendChild(star);actions.appendChild(edit);card.appendChild(actions);card.ondblclick=()=>insertPlayer(p);grid.appendChild(card)})}
function renderColorChoices(){
  const wrap=$('playerColors');
  while(wrap.firstChild)wrap.removeChild(wrap.firstChild);
  PLAYER_COLORS.forEach(color=>{
    const button=make('button','color-choice'+(selectedColor===color.id?' selected':''));
    button.setAttribute('aria-pressed',String(selectedColor===color.id));
    button.setAttribute('aria-label',color.name+' '+color.hex);
    const swatch=make('span','color-swatch');swatch.style.backgroundColor=color.hex;
    button.appendChild(swatch);button.appendChild(make('span','',color.name));
    if(selectedColor===color.id)button.appendChild(make('span','',' ✓'));
    button.title=color.name+' '+color.hex;
    button.onclick=()=>{selectedColor=color.id;renderColorChoices()};
    wrap.appendChild(button);
  });
  $('orangeLabelSetup').className=selectedColor==='orange'?'':'hidden';
  $('orangeLabelStatus').textContent=Number.isInteger(labelOverrides.orange)?'Orange label eşlemesi kayıtlı.':'Orange için bir kez label eşlemesi yap.';
  $('selectedColor').textContent=selectedColor?getPlayerColor(selectedColor).name+' · '+getPlayerColor(selectedColor).hex:'Henüz renk atanmadı.';
}
function makeFields(){
  const wrap=$('fields');
  specs.forEach(([key,label,min,max,step])=>{
    const row=make('div','field numeric-row');
    const caption=make('div','fieldlabel scrub-label',label);
    const value=make('div','numeric-value',String(defaults[key]));
    value.id='val-'+key;
    row.appendChild(caption);row.appendChild(value);wrap.appendChild(row);
    numericControls.push(bindNumericControl(value,caption,document,
      {label,min,max,step,fallback:defaults[key]}));
  });
}
function showSettings(on){numericControls.forEach(c=>{c.stop();c.commit()});$('library').className=on?'hidden':'';$('settings').className=on?'':'hidden';$('heading').textContent=on?'Oyuncu ayarları':'Oyuncu kütüphanesi';$('add').style.display=on?'none':'block';$('body').scrollTop=0}
function choose(id){selected=id;const p=players.find(x=>x.id===id);if(!p)return;$('playerName').textContent=p.name||'';selectedColor=getPlayerColor(p.color)?p.color:null;renderColorChoices();const src=p.preview||p.src;$('preview').style.display=src?'block':'none';if(src)$('preview').src=src;specs.forEach(([key])=>{$('val-'+key).textContent=String(p[key]===undefined?defaults[key]:p[key])});showSettings(true)}
$('back').onclick=()=>{showSettings(false);render()};$('favtab').onclick=()=>{tab='favorites';$('favtab').className='active';$('alltab').className='';render()};$('alltab').onclick=()=>{tab='all';$('alltab').className='active';$('favtab').className='';render()};$('search').oninput=render;$('search').addEventListener('input',render);$('search').addEventListener('change',render);$('clearSearch').onclick=()=>{$('search').value='';render()};
$('save').onclick=async()=>{numericControls.forEach(c=>c.commit());const p=players.find(x=>x.id===selected);if(!p)return status('Oyuncu seç.');const name=$('playerName').textContent.trim();if(!name)return status('Oyuncu adı boş olamaz.');if(players.some(x=>x!==p&&x.name.toLowerCase()===name.toLowerCase()))return status('Bu isim zaten kullanılıyor.');const values={};for(const [key,,min,max] of specs){const n=Number($('val-'+key).textContent.trim().replace(',','.'));if(!Number.isFinite(n)||n<min||n>max)return status('Geçersiz değer: '+key);values[key]=n}values.color=selectedColor;Object.assign(p,values);p.name=name;try{await saveDB();status(name+' kaydedildi.');showSettings(false);render()}catch(e){status('Kayıt hatası: '+e.message)}};
$('reset').onclick=()=>{numericControls.forEach(c=>{c.stop();c.commit()});specs.forEach(([key])=>{$('val-'+key).textContent=String(defaults[key])});status('Varsayılan değerler yüklendi. Kaydet ile onayla.')};
$('remove').onclick=async()=>{if(selected===null)return;players=players.filter(p=>p.id!==selected);selected=null;await saveDB();showSettings(false);render();status('Oyuncu silindi.')};
$('add').onclick=async()=>{try{const file=await fs.getFileForOpening({types:['png']});if(!file)return;const name=file.name.replace(/\.png$/i,'');if(players.some(p=>p.name.toLowerCase()===name.toLowerCase()))return status('Bu isim zaten var: '+name);
const bytes=await file.read({format:storage.formats.binary});const u8=new Uint8Array(bytes);let bin='';for(let i=0;i<u8.length;i+=8192)bin+=String.fromCharCode.apply(null,u8.subarray(i,i+8192));
const preview='data:image/png;base64,'+btoa(bin);
const id=Date.now()+'-'+Math.random().toString(36).slice(2);const stored=await storePNG(id,bytes);const p=Object.assign({id,name,preview,stored,fav:true},defaults);
players.push(p);await saveDB();showSettings(false);render();status(name+' eklendi.')}catch(e){console.error(e);status('PNG ekleme hatası: '+e.message)}};
makeFields();loadDB().catch(e=>status('Başlatma hatası: '+e.message));

// Timeline prototype: import PNG and reuse the highest safe video track.
// The dedicated Transform is managed by overlay-effects.js.
async function storePNG(id,bytes){
  const dir=await fs.getDataFolder();const file=await dir.createFile('player_'+id+'.png',{overwrite:true});
  await file.write(bytes,{format:storage.formats.binary});return file.name;
}
async function ensurePlayerFile(p){
  const dir=await fs.getDataFolder();const filename=p.stored||('player_'+p.id+'.png');
  try {const f=await dir.getEntry(filename);return await fs.getNativePath(f)}catch(e){
    const base64=String(p.preview||'').split(',')[1];if(!base64)throw new Error('PNG verisi yok. Oyuncuyu yeniden ekle.');
    const bin=atob(base64),bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    p.stored=await storePNG(p.id,bytes.buffer);await saveDB();
    return await fs.getNativePath(await dir.getEntry(p.stored));
  }
}
async function findImported(folder,path){
  const items=await folder.getItems();
  for(const item of items){
    try{const clip=ppro.ClipProjectItem.cast(item);if(clip&&await clip.getMediaFilePath()===path)return item}catch(e){}
    try{const child=ppro.FolderItem.cast(item);if(child){const found=await findImported(child,path);if(found)return found}}catch(e){}
  }
  return null;
}
// Choose the highest existing track that can safely accept a still image.
// Prefer empty tracks, then a gap large enough for the exact still duration.
// Never overwrite existing clips just to avoid creating a new track.
async function chooseVideoTrack(sequence,playhead,reserveSeconds){
  const count=await sequence.getVideoTrackCount();
  const tracks=[];
  for(let i=count-1;i>=0;i--){
    const track=await sequence.getVideoTrack(i);
    const clips=await track.getTrackItems(ppro.Constants.TrackItemType.CLIP,false);
    tracks.push({index:i,clips});
  }
  const empty=tracks.find(t=>t.clips.length===0);
  if(empty)return empty.index;
  const start=playhead.seconds;
  for(const t of tracks){
    let available=true;
    for(const clip of t.clips){
      const a=(await clip.getStartTime()).seconds;
      const b=(await clip.getEndTime()).seconds;
      if(a<start+reserveSeconds && b>start){available=false;break;}
    }
    if(available)return t.index;
  }
  return count;
}
let inserting=false;
async function insertPlayer(p){
  if(inserting||effects.isBusy())return status('Önceki işlem sürüyor, tekrar dene.');inserting=true;
  try{
    status(p.name+': PNG hazırlanıyor...');
    let project=await ppro.Project.getActiveProject();if(!project)throw new Error('Aktif Premiere projesi yok.');
    let sequence=await project.getActiveSequence();if(!sequence)throw new Error('Aktif sequence yok.');
    const labelSequence=sequence.guid.toString();
    const path=await ensurePlayerFile(p);let root=await project.getRootItem();
    let item=await findImported(root,path);
    if(!item){status(p.name+': Projeye import ediliyor...');const ok=await project.importFiles([path],true,root,false);if(!ok)throw new Error('PNG import başarısız.');project=await ppro.Project.getActiveProject();sequence=project&&await project.getActiveSequence();if(!sequence||sequence.guid.toString()!==labelSequence)throw new Error('Import sırasında sequence değişti.');root=await project.getRootItem();item=await findImported(root,path)}
    if(!item)throw new Error('PNG import edildi ama ProjectItem bulunamadı.');
    await labelSettingsReady;
    if(await applyPlayerLabel(ppro,project,item,p.color,labelOverrides)){
      // Label edits invalidate native handles; reacquire before insertion.
      project=await ppro.Project.getActiveProject();
      sequence=project&&await project.getActiveSequence();
      if(!sequence||sequence.guid.toString()!==labelSequence)throw new Error('Label uygulanırken sequence değişti.');
      root=await project.getRootItem();item=await findImported(root,path);
      if(!item)throw new Error('Label sonrası PNG bulunamadı.');
    }
    const durationTicks=stillDurationTicks(await sequence.getTimebase());
    setStillSourceDuration(ppro,project,item,durationTicks);
    project=await ppro.Project.getActiveProject();
    sequence=project&&await project.getActiveSequence();
    if(!sequence||sequence.guid.toString()!==labelSequence)throw new Error('Süre ayarlanırken sequence değişti.');
    root=await project.getRootItem();item=await findImported(root,path);
    if(!item)throw new Error('Süre sonrası PNG bulunamadı.');
    await verifyStillSourceDuration(ppro,item,durationTicks);
    const playhead=await sequence.getPlayerPosition();
    const trackIndex=await chooseVideoTrack(sequence,playhead,Number(durationTicks)/254016000000);
    const expectedSequence=sequence.guid.toString();
    const editor=ppro.SequenceEditor.getEditor(sequence);
    let success=false;
    project.lockedAccess(()=>{success=project.executeTransaction(compound=>{
      compound.addAction(editor.createOverwriteItemAction(item,playhead,trackIndex,0));
    },'CS2 Player PNG Ekle');});
    if(!success)throw new Error('Timeline transaction başarısız.');
    project=await ppro.Project.getActiveProject();
    sequence=project&&await project.getActiveSequence();
    if(!sequence||sequence.guid.toString()!==expectedSequence)throw new Error('PNG eklenirken aktif sequence değişti.');
    const after=await effects.clips(sequence);
    // Identify the new clip by track, start and source path, not wrapper identity.
    const candidates=[];
    for(const clip of after){
      if(await clip.getTrackIndex()!==trackIndex)continue;
      if((await clip.getStartTime()).ticks!==playhead.ticks)continue;
      const source=ppro.ClipProjectItem.cast(await clip.getProjectItem());
      if(source&&await source.getMediaFilePath()===path)candidates.push(clip);
    }
    if(candidates.length!==1)throw new Error('PNG eklendi fakat animasyon uygulanacak klip kesin olarak bulunamadı.');
    if(Number((await candidates[0].getDuration()).ticks)!==Number(durationTicks))throw new Error('PNG eklendi fakat timeline süresi hesaplanan kısa süre ile eşleşmedi.');
    try{await effects.apply(project,sequence,candidates[0],p,true)}
    catch(e){throw new Error('PNG timeline’da; efekt uygulanamadı: '+(e.message||e))}
    status('✓ '+p.name+' giriş / çıkış animasyonuyla eklendi (V'+(trackIndex+1)+').');
  }catch(e){console.error('CS2 Overlay insert',e);status('Ekleme hatası: '+(e.message||String(e)))}finally{inserting=false}
}


function stopEffectTracking(){if(effectTimer!==null)clearInterval(effectTimer);effectTimer=null}
function startEffectTracking(){
  if(effectTimer!==null)return;
  effectTimer=setInterval(async()=>{
    if(inserting)return;
    try{await effects.sync(players);effectError=''}
    catch(e){const message=e.message||String(e);if(message!==effectError){effectError=message;console.error('CS2 animation sync',e);status('Animasyon takibi: '+message)}}
  },800);
}
// The plugin must remain loaded to follow manual trims. Persisted clip tags
// allow the next active-sequence scan to repair edits made while it was closed.
startEffectTracking();
$('applyEffects').onclick=async()=>{
  if(inserting||effects.isBusy())return status('Önceki işlem sürüyor, tekrar dene.');
  inserting=true;
  let applied=0;const failures=[];
  try{
    const project=await ppro.Project.getActiveProject();
    const sequence=project&&await project.getActiveSequence();
    if(!sequence)throw new Error('Aktif sequence yok.');
    const sequenceId=sequence.guid.toString();
    const paths=new Map();
    for(const player of players){try{paths.set(await ensurePlayerFile(player),player)}catch(e){failures.push(player.name+': '+e.message)}}
    const pending=[];
    for(const clip of await effects.clips(sequence)){
      const source=ppro.ClipProjectItem.cast(await clip.getProjectItem());
      const player=source&&paths.get(await source.getMediaFilePath());
      if(!player)continue;
      pending.push({locator:await effects.describe(clip),player,name:await clip.getName()});
    }
    for(const {locator,player,name} of pending){
      try{
        const freshProject=await ppro.Project.getActiveProject();
        const freshSequence=freshProject&&await freshProject.getSequence(ppro.Guid.fromString(sequenceId));
        if(!freshSequence)throw new Error('Sequence artık açık değil.');
        await effects.apply(freshProject,freshSequence,locator,player,true);applied++
      }
      catch(e){failures.push(name+': '+e.message)}
    }
    status(applied+' klibe giriş / çıkış efekti uygulandı.'+(failures.length?' Atlanan: '+failures.join(' | '):''));
  }catch(e){status('Efekt hatası: '+e.message)}finally{inserting=false}
};

$('learnOrangeLabel').onclick=async()=>{
  try{
    await labelSettingsReady;
    const project=await ppro.Project.getActiveProject();
    if(!project)throw new Error('Aktif Premiere projesi yok.');
    const index=await readSelectedLabel(ppro,project);
    await saveOrangeLabel(index);
    renderColorChoices();status('Orange label eşlemesi kaydedildi. Yeni eklediğin Orange oyuncular bu label ile eklenecek.');
  }catch(e){status('Orange eşleme: '+e.message)}
};
labelSettingsReady.then(()=>{if(selected!==null)renderColorChoices()});
