const {test} = require('node:test');
const assert = require('node:assert/strict');
const {animationKeys, createEffects, playerId, clipName, IN_SECONDS, OUT_SECONDS} = require('../overlay-effects');
const player = {id:'a', name:'Player', x:960, y:540, scale:80, rotation:10, opacity:90};
const size = {width:1920, height:1080};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8, `${a} != ${b}`);

test('source anchors and hold keep original timing while default travel is halved',()=>{
  const keys=animationKeys(17,27,1/25,player,size);
  near(keys[0].time,17);near(keys.at(-1).time,26.96);
  near(keys[0].x,.5+(1.5104166269302368-.5)/2);near(keys.at(-1).x,keys[0].x);
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

function fixture({existing=false, tagged=true, invalidate=false}={}) {
  let revision=0;
  function native(object) {
    if(!invalidate)return object;
    const born=revision;
    return new Proxy(object,{get(target,key){
      if(born!==revision)throw new Error('The script object is no longer valid');
      const value=target[key];
      if(typeof value!=='function')return value;
      return (...args)=>{
        if(born!==revision)throw new Error('The script object is no longer valid');
        const result=value.apply(target,args);
        if(['getComponentChain','getComponentAtIndex','getParam'].includes(key)){
          return result&&typeof result.then==='function'?result.then(native):native(result);
        }
        return result;
      };
    }});
  }
  const time=s=>({seconds:s,ticks:String(Math.round(s*254016000000))});
  const state={input:10,output:15,start:100,end:105,name:tagged?clipName(player):'ordinary',transactions:[],components:[]};
  function param(){
    const p={keys:new Map(),constant:null,varying:false};
    p.createKeyframe=value=>({value});
    p.areKeyframesSupported=async()=>true;
    p.getKeyframeListAsTickTimes=()=>[...p.keys.keys()].map(time);
    p.createRemoveKeyframeAction=t=>()=>p.keys.delete(t.seconds);
    p.createSetTimeVaryingAction=v=>()=>p.varying=v;
    p.createSetValueAction=k=>{assert.equal(p.varying,false,'static value action requires a committed non-varying stream');return ()=>p.constant=k.value};
    p.createAddKeyframeAction=k=>{assert.equal(p.varying,true,'keyframe action requires a committed time-varying stream');return ()=>p.keys.set(k.position.seconds,k.value)};
    p.createSetInterpolationAtKeyframeAction=t=>{assert.ok(p.keys.has(t.seconds),'interpolation action requires a committed keyframe');return ()=>{}};
    return p;
  }
  const component=()=>{
    const params=Array.from({length:12},param);
    return {getMatchName:async()=> 'AE.ADBE Geometry2',getParam:i=>params[i],getParamCount:()=>params.length};
  };
  if(existing)state.components.push(component());
  const chain={getComponentCount:()=>state.components.length,getComponentAtIndex:i=>state.components[i],createRemoveComponentAction:c=>()=>state.components.splice(state.components.indexOf(c),1),createAppendComponentAction:c=>()=>state.components.push(c)};
  const clip={getTrackIndex:async()=>0,getComponentChain:async()=>chain,getName:async()=>state.name,
    createSetNameAction:n=>()=>state.name=n,
    getInPoint:async()=>time(state.input),getOutPoint:async()=>time(state.output),
    getStartTime:async()=>time(state.start),getEndTime:async()=>time(state.end)};
  const sequence={guid:'sequence-id',getFrameSize:async()=>size,getTimebase:async()=>String(254016000000/25),getVideoTrackCount:async()=>1,getVideoTrack:async()=>({getTrackItems:async()=>[native(clip)]})};
  const project={guid:'project-id',getSequence:async()=>sequence,path:'/project.prproj',getActiveSequence:async()=>sequence,
    lockedAccess:fn=>fn(),executeTransaction:(fn,title)=>{
      const actions=[];fn({addAction:a=>actions.push(a)});actions.forEach(a=>a());state.transactions.push(title);revision++;return true;
    }};
  const ppro={Guid:{fromString:s=>s},PointF:class {constructor(x,y){this.x=x;this.y=y}},TickTime:{createWithSeconds:time},
    Constants:{TrackItemType:{CLIP:1},InterpolationMode:{LINEAR:0}},
    VideoFilterFactory:{createComponent:async()=>component()},Project:{getActiveProject:async()=>project}};
  return {state,clip:native(clip),sequence,project,effects:createEffects(ppro)};
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


test('failed native setup removes its own partial Transform so retry remains possible',async()=>{
  const f=fixture({tagged:false});
  const original=f.project.executeTransaction;
  f.project.executeTransaction=(fn,title)=>title==='CS2 giriş / çıkış keyframe ekle'?false:original(fn,title);
  await assert.rejects(f.effects.apply(f.project,f.sequence,f.clip,player,true),/keyframe ekle/);
  assert.equal(f.state.components.length,0);
  assert.equal(f.state.name,'ordinary');
  f.project.executeTransaction=original;
  await f.effects.apply(f.project,f.sequence,f.clip,player,true);
  assert.equal(f.state.components.length,1);
});


test('native objects invalidated after every commit are reacquired for each animation phase',async()=>{
  const f=fixture({tagged:false,invalidate:true});
  await f.effects.apply(f.project,f.sequence,f.clip,player,true);
  assert.equal(f.state.components.length,1);
  assert.ok(f.state.components[0].getParam(1).keys.size>4);
  f.state.input=11;f.state.start=101;
  await f.effects.sync([player]);await f.effects.sync([player]);
  near(Math.min(...f.state.components[0].getParam(1).keys.keys()),11);
});


test('changing travel distance preserves the destination, keyframe times and duration',()=>{
  for(const fps of [24,25,30,60]){
    const frame=1/fps;
    const full=animationKeys(0,10,frame,{...player,slideDistance:100},size);
    const half=animationKeys(0,10,frame,{...player,slideDistance:50},size);
    const quarter=animationKeys(0,10,frame,{...player,slideDistance:25},size);
    assert.deepEqual(full.map(k=>k.time),half.map(k=>k.time));
    assert.deepEqual(full.map(k=>k.time),quarter.map(k=>k.time));
    near(half[0].x-.5,(full[0].x-.5)/2);
    near(quarter.at(-1).x-.5,(full.at(-1).x-.5)/4);
    const centered=half.filter(k=>Math.abs(k.x-.5)<1e-8);
    near(centered[0].time,IN_SECONDS);
    near(centered.at(-1).time,10-frame-OUT_SECONDS);
  }
});
test('zero travel remains stationary and invalid distances are rejected',()=>{
  const keys=animationKeys(0,5,.04,{...player,slideDistance:0},size);
  assert.ok(keys.every(k=>k.x===.5&&k.y===.5));
  for(const slideDistance of [-1,201,NaN])assert.throws(()=>animationKeys(0,5,.04,{...player,slideDistance},size),/Kayma mesafesi/);
});
