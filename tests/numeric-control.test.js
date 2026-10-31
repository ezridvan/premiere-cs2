const {test}=require('node:test');
const assert=require('node:assert/strict');
const {bindNumericControl}=require('../numeric-control');
class Element {
  constructor(){this.textContent='100';this.attrs={};this.listeners={};this.classes=new Set();this.classList={add:k=>this.classes.add(k),remove:k=>this.classes.delete(k)}}
  setAttribute(k,v){this.attrs[k]=v}
  getAttribute(k){return this.attrs[k]}
  addEventListener(k,f){(this.listeners[k]||=new Set()).add(f)}
  removeEventListener(k,f){this.listeners[k]?.delete(f)}
  focus(){this.focused=true}
  blur(){this.focused=false;this.fire('blur')}
  fire(type,data={}){const e={button:0,clientX:0,preventDefault(){this.prevented=true},...data};for(const f of [...(this.listeners[type]||[])])f(e);return e}
}
function setup(){const field=new Element(),label=new Element(),doc=new Element();const control=bindNumericControl(field,label,doc,{min:-2000,max:4000,fallback:100,step:1,label:'Position X'});return {field,label,doc,control}}
function click(f){f.field.fire('mousedown',{clientX:20});f.doc.fire('mouseup',{clientX:20})}
test('click enters ordinary text editing, decimal comma commits on Enter',()=>{
 const f=setup();click(f);assert.equal(f.field.getAttribute('contenteditable'),'true');
 f.field.textContent='123,5';f.field.fire('keydown',{key:'Enter'});
 assert.equal(f.field.textContent,'123.5');assert.equal(f.field.getAttribute('contenteditable'),'false');
});
test('dragging a value changes it without entering text mode and releases outside the field',()=>{
 const f=setup();f.field.fire('mousedown',{clientX:100});f.doc.fire('mousemove',{clientX:135});f.doc.fire('mouseup',{clientX:135});
 assert.equal(f.field.textContent,'135');assert.equal(f.field.getAttribute('contenteditable'),'false');
 f.doc.fire('mousemove',{clientX:200});assert.equal(f.field.textContent,'135');assert.equal(f.doc.listeners.mousemove.size,0);
});
test('label scrubbing works during text edit; Shift is fast and Alt is precise',()=>{
 const f=setup();click(f);f.field.textContent='250';
 f.label.fire('mousedown',{clientX:0});f.doc.fire('mousemove',{clientX:10,shiftKey:true});
 assert.equal(f.field.textContent,'350');
 f.doc.fire('mousemove',{clientX:20,altKey:true});assert.equal(f.field.textContent,'351');
 f.doc.fire('mouseup',{clientX:20});
});
test('Escape restores the value at edit start; empty or invalid text reverts on blur',()=>{
 const f=setup();click(f);f.field.textContent='999';f.field.fire('keydown',{key:'Escape'});assert.equal(f.field.textContent,'100');
 for(const bad of ['','abc','Infinity']){click(f);f.field.textContent=bad;f.field.blur();assert.equal(f.field.textContent,'100')}
});
test('typing and scrubbing respect limits and dragging reverses immediately at a bound',()=>{
 const f=setup();click(f);f.field.textContent='99999';f.control.commit();assert.equal(f.field.textContent,'4000');
 f.label.fire('mousedown',{clientX:0});f.doc.fire('mousemove',{clientX:100});f.doc.fire('mousemove',{clientX:99});
 assert.equal(f.field.textContent,'3999');f.doc.fire('mouseleave');assert.equal(f.doc.listeners.mouseup.size,0);
});
test('keyboard-only entry and arrows work without swallowing normal editing keys',()=>{
 const f=setup();f.field.fire('keydown',{key:'ArrowDown',shiftKey:true});assert.equal(f.field.textContent,'90');
 f.field.fire('keydown',{key:'2'});assert.equal(f.field.textContent,'2');assert.equal(f.field.getAttribute('contenteditable'),'true');
 assert.equal(f.field.fire('keydown',{key:'3'}).prevented,undefined);
});
