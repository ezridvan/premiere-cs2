const {test}=require('node:test');
const assert=require('node:assert/strict');
const {PLAYER_COLORS,getPlayerColor,applyPlayerLabel}=require('../player-colors');
function fixture(){
 const state={label:1,locked:false,transactions:0};
 const ppro={Constants:{ProjectItemColorLabel:{YELLOW:15,BLUE:9,GREEN:13,PURPLE:8,MANGO:7}}};
 const item={getColorLabelIndex:async()=>state.label,createSetColorLabelAction:index=>{assert.ok(state.locked);return ()=>state.label=index}};
 const project={lockedAccess:fn=>{state.locked=true;try{fn()}finally{state.locked=false}},executeTransaction:fn=>{state.transactions++;const actions=[];fn({addAction:a=>actions.push(a)});actions.forEach(a=>a());return true}};
 return {state,ppro,item,project};
}
test('the five exact swatches are preserved and Orange uses the Mango label slot',()=>{
 assert.deepEqual(PLAYER_COLORS.map(c=>[c.name,c.hex]),[['Yellow','#fcff00'],['Blue','#8bcef2'],['Green','#169f82'],['Purple','#ba3094'],['Orange','#e18230']]);
 assert.equal(getPlayerColor('orange').label,'MANGO');assert.equal(getPlayerColor(undefined),null);
});
test('each selected color is applied through the documented enum and undoable action',async()=>{
 for(const color of PLAYER_COLORS){const f=fixture();assert.equal(await applyPlayerLabel(f.ppro,f.project,f.item,color.id),true);assert.equal(f.state.label,f.ppro.Constants.ProjectItemColorLabel[color.label]);assert.equal(f.state.transactions,1)}
});
test('unassigned old players and already matching source labels cause no edits',async()=>{
 const f=fixture();assert.equal(await applyPlayerLabel(f.ppro,f.project,f.item,null),false);
 f.state.label=13;assert.equal(await applyPlayerLabel(f.ppro,f.project,f.item,'green'),false);assert.equal(f.state.transactions,0);
});
test('missing native label support and failed transactions are reported, not treated as success',async()=>{
 const f=fixture();delete f.ppro.Constants.ProjectItemColorLabel.GREEN;
 await assert.rejects(applyPlayerLabel(f.ppro,f.project,f.item,'green'),/bulunamadı/);assert.equal(f.state.transactions,0);
 f.project.executeTransaction=()=>false;
 await assert.rejects(applyPlayerLabel(f.ppro,f.project,f.item,'yellow'),/uygulanamadı/);
 await assert.rejects(applyPlayerLabel(f.ppro,f.project,f.item,'invalid'),/Geçersiz/);
});
