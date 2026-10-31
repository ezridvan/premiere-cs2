const {test} = require('node:test');
const assert = require('node:assert/strict');
const {animationKeys, createEffects, playerId, clipName, IN_SECONDS, OUT_SECONDS} = require('../overlay-effects');
const player = {id:'a', name:'Player', x:960, y:540, scale:80, rotation:10, opacity:90};
const size = {width:1920, height:1080};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8, `${a} != ${b}`);

test('source in/out anchors, hold and last visible frame match the preset durations',()=>{
  const keys=animationKeys(17,27,1/25,player,size);
  near(keys[0].time,17);near(keys.at(-1).time,26.96);
  near(keys[0].x,1.5104166269302368);near(keys.at(-1).x,keys[0].x);
  near(keys.find(k=>Math.abs(k.time-(17+IN_SECONDS))<1e-8).x,.5);
  near(keys.find(k=>Math.abs(k.time-(26.96-OUT_SECONDS))<1e-8).x,.5);
});
test('left/right trims, extensions and short clips retain both boundary animations',()=>{
  for(const [start,end] of [[0,5],[1,5],[0,3],[0,30],[-3,5],[2,2.4],[0,.08]]){
    const keys=animationKeys(start,end,.04,player,size);
    near(keys[0].time,start);near(keys.at(-1).time,end-.04);
    assert.ok(keys.some(k=>Math.abs(k.x-.5)<1e-8));
    for(let i=1;i<keys.length;i++)assert.ok(keys[i].time>keys[i-1].time);
    assert.ok(keys.every(k=>k.time>=start-1e-8&&k.time<=end-.04+1e-8));
  }
});
test('two-frame minimum and player position in other sequence resolutions',()=>{
  assert.throws(()=>animationKeys(0,.04,.04,player,size),/iki kare/);
  const keys=animationKeys(0,5,.04,{...player,x:640,y:360},{width:1280,height:720});
  near(keys.find(k=>Math.abs(k.x-.5)<1e-8).y,.5);
});
test('persistent tag identifies only managed clips',()=>{
  assert.equal(playerId(clipName(player)),'a');
  assert.equal(playerId('ordinary clip'),undefined);
});

function fixture({existing=false, tagged=true}={}) {
  const time=s=>({seconds:s,ticks:String(Math.round(s*254016000000))});
  const state={input:10,output:15,start:100,end:105,name:tagged?clipName(player):'ordinary',transactions:[],components:[]};
  function param(){
    const p={keys:new Map(),constant:null,varying:false};
    p.createKeyframe=value=>({value});
    p.areKeyframesSupported=async()=>true;
    p.getKeyframeListAsTickTimes=()=>[...p.keys.keys()].map(time);
    p.createRemoveKeyframeAction=t=>()=>p.keys.delete(t.seconds);
    p.createSetTimeVaryingAction=v=>()=>p.varying=v;
    p.createSetValueAction=k=>()=>p.constant=k.value;
    p.createAddKeyframeAction=k=>()=>p.keys.set(k.position.seconds,k.value);
    p.createSetInterpolationAtKeyframeAction=()=>()=>{};
    return p;
  }
  const component=()=>{
    const params=Array.from({length:12},param);
    return {getMatchName:async()=> 'AE.ADBE Geometry2',getParam:i=>params[i],getParamCount:()=>params.length};
  };
  if(existing)state.components.push(component());
  const chain={getComponentCount:()=>state.components.length,getComponentAtIndex:i=>state.components[i],createAppendComponentAction:c=>()=>state.components.push(c)};
  const clip={getComponentChain:async()=>chain,getName:async()=>state.name,
    createSetNameAction:n=>()=>state.name=n,
    getInPoint:async()=>time(state.input),getOutPoint:async()=>time(state.output),
    getStartTime:async()=>time(state.start),getEndTime:async()=>time(state.end)};
  const sequence={guid:'sequence-id',getFrameSize:async()=>size,getTimebase:async()=>String(254016000000/25),getVideoTrackCount:async()=>1,getVideoTrack:async()=>({getTrackItems:async()=>[clip]})};
  const project={guid:'project-id',path:'/project.prproj',getActiveSequence:async()=>sequence,
    lockedAccess:fn=>fn(),executeTransaction:(fn,title)=>{
      const actions=[];fn({addAction:a=>actions.push(a)});actions.forEach(a=>a());state.transactions.push(title);return true;
    }};
  const ppro={PointF:class {constructor(x,y){this.x=x;this.y=y}},TickTime:{createWithSeconds:time},
    Constants:{TrackItemType:{CLIP:1},InterpolationMode:{LINEAR:0}},
    VideoFilterFactory:{createComponent:async()=>component()},Project:{getActiveProject:async()=>project}};
  return {state,clip,sequence,project,effects:createEffects(ppro)};
}

test('real action sequence creates Transform, configures player values and motion blur',async()=>{
  const f=fixture({tagged:false});
  await f.effects.apply(f.project,f.sequence,f.clip,player,true);
  assert.equal(f.state.components.length,1);
  const effect=f.state.components[0];
  assert.equal(effect.getParam(3).constant,80);
  assert.equal(effect.getParam(7).constant,10);
  assert.equal(effect.getParam(8).constant,90);
  assert.equal(effect.getParam(9).constant,false);
  assert.equal(effect.getParam(10).constant,360);
  near(Math.min(...effect.getParam(1).keys.keys()),10);
  near(Math.max(...effect.getParam(1).keys.keys()),14.96);
  assert.equal(f.state.name,clipName(player));
});
test('re-trimming replaces stale out-of-range keys without stacking effects',async()=>{
  const f=fixture();await f.effects.apply(f.project,f.sequence,f.clip,player);
  f.state.input=12;f.state.output=14;
  await f.effects.apply(f.project,f.sequence,f.clip,player);
  assert.equal(f.state.components.length,1);
  const times=[...f.state.components[0].getParam(1).keys.keys()];
  near(Math.min(...times),12);near(Math.max(...times),13.96);
  assert.ok(times.every(t=>t>=12&&t<=13.96+1e-8));
});
test('adopting an existing user Transform refuses to overwrite it',async()=>{
  const f=fixture({existing:true,tagged:false});
  await assert.rejects(f.effects.apply(f.project,f.sequence,f.clip,player,true),/zaten Transform/);
  assert.equal(f.state.transactions.length,0);
});
test('monitor waits for stable edges, repairs reopened clips, and is idle when unchanged',async()=>{
  const f=fixture();
  await f.effects.sync([player]);assert.equal(f.state.transactions.length,0);
  await f.effects.sync([player]);const count=f.state.transactions.length;assert.ok(count>0);
  await f.effects.sync([player]);assert.equal(f.state.transactions.length,count);
  f.state.input=11;f.state.start=101;
  await f.effects.sync([player]);assert.equal(f.state.transactions.length,count);
  await f.effects.sync([player]);assert.ok(f.state.transactions.length>count);
  near(Math.min(...f.state.components[0].getParam(1).keys.keys()),11);
});
test('monitor leaves unrelated timeline clips alone',async()=>{
  const f=fixture({tagged:false});await f.effects.sync([player]);await f.effects.sync([player]);
  assert.equal(f.state.transactions.length,0);
});
