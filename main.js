const {entrypoints,storage}=require('uxp');
entrypoints.setup({panels:{playerPanel:{show(){}}}});
const fs=storage.localFileSystem;
const ppro=require('premierepro');
const $=id=>document.getElementById(id);
let players=[],selected=null,tab='favorites';
const defaults={scale:100,x:960,y:540,rotation:0,opacity:100};
const specs=[['scale','Scale (%)',10,300,1],['x','Position X',-2000,4000,1],['y','Position Y',-2000,4000,1],['rotation','Rotation (°)',-180,180,1],['opacity','Opacity (%)',0,100,1]];
function status(s){$('status').textContent=s}
function make(tag,cls,txt){const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n}
async function saveDB(){const dir=await fs.getDataFolder();const f=await dir.createFile('players.json',{overwrite:true});await f.write(JSON.stringify(players));}
async function loadDB(){try{const dir=await fs.getDataFolder();const f=await dir.getEntry('players.json');const data=JSON.parse(await f.read());players=Array.isArray(data)?data:[]}catch(e){players=[]}render();status(players.length+' oyuncu hazır.')}
function render(){const grid=$('grid');while(grid.firstChild)grid.removeChild(grid.firstChild);const q=String($('search').value||'').trim().toLowerCase();const shown=players.filter(p=>(tab==='all'||p.fav)&&String(p.name||'').toLowerCase().includes(q));$('count').textContent=shown.length+' oyuncu gösteriliyor · Toplam '+players.length;$('empty').textContent=shown.length?'':'Burada henüz oyuncu yok.';shown.forEach(p=>{const card=make('div','card');const src=p.preview||p.src;if(src){const img=make('img','thumb');img.src=src;card.appendChild(img)}else card.appendChild(make('div','thumb','PNG yok'));card.appendChild(make('div','name',p.name));const actions=make('div','cardactions');const star=make('button','',p.fav?'★':'☆');star.onclick=async e=>{e.stopPropagation();p.fav=!p.fav;await saveDB();render()};const edit=make('button','','⚙');edit.onclick=e=>{e.stopPropagation();choose(p.id)};star.title='Favori';edit.title='Ayarlar';actions.appendChild(star);actions.appendChild(edit);card.appendChild(actions);card.ondblclick=()=>insertPlayer(p);grid.appendChild(card)})}
function makeFields(){const wrap=$('fields');specs.forEach(([key,label,min,max])=>{const f=make('div','field'),l=make('div','fieldlabel',label),actions=make('div','stepper'),v=make('div','editable num'),minus=make('button','','−'),plus=make('button','','+');v.id='val-'+key;v.setAttribute('contenteditable','true');v.setAttribute('spellcheck','false');const increment=key==='scale'?5:key==='x'||key==='y'?20:key==='rotation'?1:5;function adjust(d){let n=Number(v.textContent.trim().replace(',','.'));if(!Number.isFinite(n))n=defaults[key];v.textContent=String(Math.max(min,Math.min(max,n+d)))}minus.onclick=()=>adjust(-increment);plus.onclick=()=>adjust(increment);actions.appendChild(minus);actions.appendChild(v);actions.appendChild(plus);f.appendChild(l);f.appendChild(actions);wrap.appendChild(f)})}
function showSettings(on){$('library').className=on?'hidden':'';$('settings').className=on?'':'hidden';$('heading').textContent=on?'Oyuncu ayarları':'Oyuncu kütüphanesi';$('add').style.display=on?'none':'block';$('body').scrollTop=0}
function choose(id){selected=id;const p=players.find(x=>x.id===id);if(!p)return;$('playerName').textContent=p.name||'';const src=p.preview||p.src;$('preview').style.display=src?'block':'none';if(src)$('preview').src=src;specs.forEach(([key])=>{$('val-'+key).textContent=String(p[key]===undefined?defaults[key]:p[key])});showSettings(true)}
$('back').onclick=()=>{showSettings(false);render()};$('favtab').onclick=()=>{tab='favorites';$('favtab').className='active';$('alltab').className='';render()};$('alltab').onclick=()=>{tab='all';$('alltab').className='active';$('favtab').className='';render()};$('search').oninput=render;$('search').addEventListener('input',render);$('search').addEventListener('change',render);$('clearSearch').onclick=()=>{$('search').value='';render()};
$('save').onclick=async()=>{const p=players.find(x=>x.id===selected);if(!p)return status('Oyuncu seç.');const name=$('playerName').textContent.trim();if(!name)return status('Oyuncu adı boş olamaz.');if(players.some(x=>x!==p&&x.name.toLowerCase()===name.toLowerCase()))return status('Bu isim zaten kullanılıyor.');const values={};for(const [key,,min,max] of specs){const n=Number($('val-'+key).textContent.trim().replace(',','.'));if(!Number.isFinite(n)||n<min||n>max)return status('Geçersiz değer: '+key);values[key]=n}Object.assign(p,values);p.name=name;try{await saveDB();status(name+' kaydedildi.');showSettings(false);render()}catch(e){status('Kayıt hatası: '+e.message)}};
$('reset').onclick=()=>{specs.forEach(([key])=>{$('val-'+key).textContent=String(defaults[key])});status('Varsayılan değerler yüklendi. Kaydet ile onayla.')};
$('remove').onclick=async()=>{if(selected===null)return;players=players.filter(p=>p.id!==selected);selected=null;await saveDB();showSettings(false);render();status('Oyuncu silindi.')};
$('add').onclick=async()=>{try{const file=await fs.getFileForOpening({types:['png']});if(!file)return;const name=file.name.replace(/\.png$/i,'');if(players.some(p=>p.name.toLowerCase()===name.toLowerCase()))return status('Bu isim zaten var: '+name);
const bytes=await file.read({format:storage.formats.binary});const u8=new Uint8Array(bytes);let bin='';for(let i=0;i<u8.length;i+=8192)bin+=String.fromCharCode.apply(null,u8.subarray(i,i+8192));
const preview='data:image/png;base64,'+btoa(bin);
const id=Date.now()+'-'+Math.random().toString(36).slice(2);const stored=await storePNG(id,bytes);const p=Object.assign({id,name,preview,stored,fav:true},defaults);
players.push(p);await saveDB();showSettings(false);render();status(name+' eklendi.')}catch(e){console.error(e);status('PNG ekleme hatası: '+e.message)}};
makeFields();loadDB().catch(e=>status('Başlatma hatası: '+e.message));

// Timeline prototype: import PNG and reuse the highest safe video track.
// Effects are intentionally NOT claimed to work in this build.
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
// Prefer completely empty tracks, then a gap of at least 5 seconds.
// Never overwrite existing clips just to avoid creating a new track.
async function chooseVideoTrack(sequence,playhead){
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
  const reserveSeconds=5;
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
  if(inserting)return status('Önceki ekleme sürüyor...');inserting=true;
  try{
    status(p.name+': PNG hazırlanıyor...');
    const project=await ppro.Project.getActiveProject();if(!project)throw new Error('Aktif Premiere projesi yok.');
    const sequence=await project.getActiveSequence();if(!sequence)throw new Error('Aktif sequence yok.');
    const path=await ensurePlayerFile(p);const root=await project.getRootItem();
    let item=await findImported(root,path);
    if(!item){status(p.name+': Projeye import ediliyor...');const ok=await project.importFiles([path],true,root,false);if(!ok)throw new Error('PNG import başarısız.');item=await findImported(root,path)}
    if(!item)throw new Error('PNG import edildi ama ProjectItem bulunamadı.');
    const playhead=await sequence.getPlayerPosition();const trackIndex=await chooseVideoTrack(sequence,playhead);
    const editor=ppro.SequenceEditor.getEditor(sequence);
    let success=false;
    project.lockedAccess(()=>{success=project.executeTransaction(compound=>{
      compound.addAction(editor.createOverwriteItemAction(item,playhead,trackIndex,0));
    },'CS2 Player PNG Ekle');});
    if(!success)throw new Error('Timeline transaction başarısız.');
    status('✓ '+p.name+' timeline’a eklendi (V'+(trackIndex+1)+'). Efektler henüz uygulanmadı.');
  }catch(e){console.error('CS2 Overlay insert',e);status('Ekleme hatası: '+(e.message||String(e)))}finally{inserting=false}
}
