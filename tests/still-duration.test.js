const {test}=require('node:test');
const assert=require('node:assert/strict');
const {stillDurationTicks,setStillSourceDuration,verifyStillSourceDuration}=require('../still-duration');
const TICKS=254016000000;
test('still duration fits both animations at whole-frame sequence boundaries',()=>{
 for(const [fps,frames] of [[24,37],[25,39],[30,46],[50,76],[60,91]]){
  const frame=TICKS/fps;assert.equal(Number(stillDurationTicks(String(frame))),frame*frames);
 }
});
test('fractional frame rates preserve exact whole-frame timecodes',()=>{
 for(const [numerator,denominator,frames] of [[24000,1001,37],[30000,1001,46],[60000,1001,91]]){
  const frame=TICKS*denominator/numerator;
  assert.equal(Number(stillDurationTicks(String(frame))),frame*frames);
 }
});
test('invalid timebases fail instead of silently inserting a long still',()=>{
 for(const bad of ['0','bad','-1','1.5',String(TICKS*2)])assert.throws(()=>stillDurationTicks(bad));
});
function fixture(){
 const state={input:'0',output:String(TICKS*180),locked:false};
 const source={createSetInOutPointsAction:(input,output)=>{assert.ok(state.locked);return ()=>{state.input=input.ticks;state.output=output.ticks}},getInPoint:async()=>({ticks:state.input}),getOutPoint:async()=>({ticks:state.output})};
 const ppro={TickTime:{createWithTicks:ticks=>({ticks})},ClipProjectItem:{cast:()=>source},Constants:{MediaType:{VIDEO:1}}};
 const project={lockedAccess:fn=>{state.locked=true;try{fn()}finally{state.locked=false}},executeTransaction:fn=>{const actions=[];fn({addAction:a=>actions.push(a)});actions.forEach(a=>a());return true}};
 return {state,source,ppro,project};
}
test('three-minute default is replaced before insertion and source markers are verified',async()=>{
 const f=fixture(),ticks=stillDurationTicks(String(TICKS/25));
 setStillSourceDuration(f.ppro,f.project,{},ticks);
 await verifyStillSourceDuration(f.ppro,{},ticks);
 assert.equal(f.state.input,'0');assert.equal(Number(f.state.output)/TICKS,39/25);
});
test('failed or ignored source range edits do not pass readiness verification',async()=>{
 const f=fixture(),ticks=stillDurationTicks(String(TICKS/25));
 f.project.executeTransaction=()=>false;
 assert.throws(()=>setStillSourceDuration(f.ppro,f.project,{},ticks),/ayarlanamadı/);
 await assert.rejects(verifyStillSourceDuration(f.ppro,{},ticks),/doğrulanamadı/);
});


test('60 fps default is 00:00:01:31 and does not compress entrance or exit speed',()=>{
 const {animationKeys,IN_SECONDS,OUT_SECONDS}=require('../overlay-effects');
 const duration=Number(stillDurationTicks(String(TICKS/60)))/TICKS;
 assert.equal(duration,91/60);assert.equal(OUT_SECONDS,45/60);
 const keys=animationKeys(0,duration,1/60,{x:960,y:540},{width:1920,height:1080});
 const hold=keys.filter(k=>Math.abs(k.x-.5)<1e-8);
 assert.ok(Math.abs(hold[0].time-IN_SECONDS)<1e-8);
 assert.ok(Math.abs(hold.at(-1).time-(duration-1/60-OUT_SECONDS))<1e-8);
});
