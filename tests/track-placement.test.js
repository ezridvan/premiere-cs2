const {test}=require('node:test');
const assert=require('node:assert/strict');
const {hasRoom,chooseVideoTrack,isLogoName}=require('../track-placement');
function sequence(tracks){return {
 getVideoTrackCount:async()=>tracks.length,
 getVideoTrack:async i=>({getTrackItems:async()=>tracks[i].map(entry=>{
  const [start,end]=Array.isArray(entry)?entry:[entry.start,entry.end];
  return {getStartTime:async()=>({ticks:String(start)}),getEndTime:async()=>({ticks:String(end)}),
   getName:async()=>entry.name||'',getProjectItem:async()=>({name:entry.itemName||entry.name||''}),sourcePath:entry.path||''};
 })})
}}
test('a lower populated track gap is reused when upper tracks are occupied',async()=>{
 assert.equal(await chooseVideoTrack(sequence([[[0,100],[191,300]],[[0,400]]]),1,'100','91'),0);
});
test('populated track gaps take priority over an existing empty upper track',async()=>{
 assert.equal(await chooseVideoTrack(sequence([[[0,100],[200,300]],[]]),1,'100','91'),0);
});
test('the lowest suitable populated track is used',async()=>{
 assert.equal(await chooseVideoTrack(sequence([[[0,100],[300,400]],[[0,100],[200,300]]]),1,'100','91'),0);
});
test('an empty existing track is used before creating a new track',async()=>{
 assert.equal(await chooseVideoTrack(sequence([[],[[0,400]]]),1,'100','91'),0);
});
test('new track is needed only when all tracks overlap the complete still duration',async()=>{
 assert.equal(await chooseVideoTrack(sequence([[[0,400]],[[0,150],[200,300]]]),1,'150','91'),2);
 assert.equal(await chooseVideoTrack(sequence([]),1,'0','91'),0);
});
test('exactly fitting gaps are accepted; gaps one tick too short are rejected',()=>{
 assert.equal(hasRoom([{start:0,end:100},{start:191,end:300}],100,91),true);
 assert.equal(hasRoom([{start:0,end:100},{start:190,end:300}],100,91),false);
 assert.equal(hasRoom([{start:100,end:101}],100,91),false);
});
test('selection checks the actual 60 fps still duration at a nonzero playhead',async()=>{
 const {stillDurationTicks}=require('../still-duration');const frame=254016000000/60;
 const start=100*frame,duration=Number(stillDurationTicks(String(frame)));
 assert.equal(duration,91*frame);
 assert.equal(await chooseVideoTrack(sequence([[[0,start],[start+duration,start+duration+frame]],[[0,start+duration+frame]]]),1,String(start),String(duration)),0);
});
test('invalid timeline bounds fail instead of being treated as free space',async()=>{
 assert.throws(()=>hasRoom([{start:NaN,end:10}],0,91));
 await assert.rejects(chooseVideoTrack(sequence([]),1,'0','0'));
});

test('an empty V1 is preferred even if a populated upper track has a suitable gap',async()=>{
 assert.equal(await chooseVideoTrack(sequence([[],[[0,100],[200,300]]]),1,'100','91'),0);
});
test('occupied V1 is skipped for the first suitable track above it, not the highest',async()=>{
 assert.equal(await chooseVideoTrack(sequence([[[0,400]],[],[],[]]),1,'100','91'),1);
});

test('Logo.png is a boundary even if every track below it is empty',async()=>{
 const tracks=[[],[],[],[],[{start:0,end:500,name:'Logo.png'}],[],[]];
 assert.equal(await chooseVideoTrack(sequence(tracks),1,'100','91'),5);
});
test('the first fitting gap above the logo wins over higher tracks',async()=>{
 const tracks=[[],[{start:0,end:500,name:'Logo.png'}],[[0,400]],[[0,100],[191,300]],[]];
 assert.equal(await chooseVideoTrack(sequence(tracks),1,'100','91'),3);
});
test('a new track is created instead of falling back to free space below the logo',async()=>{
 assert.equal(await chooseVideoTrack(sequence([[],[{start:0,end:500,name:'Logo.png'}],[[0,400]]]),1,'100','91'),3);
});
test('the highest logo defines the boundary if several copies exist',async()=>{
 const tracks=[[{start:0,end:500,name:'Logo.png'}],[],[{start:0,end:500,name:'LOGO.PNG'}],[]];
 assert.equal(await chooseVideoTrack(sequence(tracks),1,'100','91'),3);
});
test('a renamed timeline clip is recognized by its original Windows source path',async()=>{
 const tracks=[[],[{start:0,end:500,name:'Branding',path:'C:/Brand/Logo.png'}],[]];
 assert.equal(await chooseVideoTrack(sequence(tracks),1,'100','91',async clip=>clip.sourcePath),2);
 assert.equal(isLogoName('C:\\Brand\\LOGO.PNG'),true);
});
test('unrelated filenames do not become a logo boundary',async()=>{
 assert.equal(isLogoName('OtherLogo.png'),false);assert.equal(isLogoName('Logo.png.bak'),false);
 assert.equal(await chooseVideoTrack(sequence([[],[{start:0,end:500,name:'OtherLogo.png'}]]),1,'100','91'),0);
});
