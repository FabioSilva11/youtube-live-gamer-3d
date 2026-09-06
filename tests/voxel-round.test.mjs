import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BlockGrid, blockKey } from '../public/static/biomes/minecraft/BlockGrid.js';
import { StructureManager, DEFAULT_SITES } from '../public/static/biomes/minecraft/StructureManager.js';
import { BuilderAI } from '../public/static/biomes/minecraft/BuilderAI.js';
const blueprints=['house','tower','bridge'].map(id=>JSON.parse(fs.readFileSync(new URL(`../public/static/biomes/minecraft/structures/${id}.json`,import.meta.url))));
const vector=(x=0,y=0,z=0)=>({x,y,z,set(x,y,z){Object.assign(this,{x,y,z});return this;},copy(v){return this.set(v.x,v.y,v.z);}});
function setup(blueprints,origins=DEFAULT_SITES){const world=new BlockGrid();for(let x=-17;x<=17;x++)for(let z=-13;z<=13;z++)world.set({x,y:-1,z,type:'grass'});return {world,manager:new StructureManager(world,blueprints,{origins,holdSeconds:2,cooldownSeconds:1})};}

for(const count of [1,5,10]) test(`${count} builders help other sites, finish all, then clear one at a time including stairs`,()=>{
 const {world,manager}=setup(blueprints);const baseline=world.blocks.size;const ai=new BuilderAI(manager,world);
 const avatars=new Map(Array.from({length:count},(_,i)=>[String(i),{position:vector(i*.5,0,.7),lookAt(){},userData:{id:String(i),phase:'active',target:vector()}}]));
 assert.equal(world.blocks.size,baseline);let allFinished=false,sawScaffold=false,helped=false,cleared=false;const original=new Map();
 for(let t=0;t<5000&&manager.cycle<1;t+=.05){
  ai.update(avatars,.05,t);
  if(!original.size)for(const [id,index] of manager.assignments)original.set(id,index);
  if(manager.phase==='building'){
   assert(manager.sites.every(s=>s.phase!=='dismantling'));
   for(const [id,index] of manager.assignments)if(original.get(id)!==index)helped=true;
  }
  if(manager.phase==='enjoying'){allFinished=true;assert(manager.sites.every(s=>s.placed.size===s.blocks.length));}
  if(manager.phase==='dismantling'){
   assert(allFinished);assert.equal(manager.sites.filter(s=>s.phase==='dismantling').length,1);
   assert([...manager.assignments.values()].every(i=>i===manager.demolitionIndex));
   for(const s of manager.sites.slice(manager.demolitionIndex+1))assert.equal(s.placed.size,s.blocks.length);
  }
  for(const site of manager.sites){if(site.blocks.some(b=>b.scaffold&&world.has(b)))sawScaffold=true;}
  if(manager.phase==='cooldown'){cleared=true;assert.equal(world.blocks.size,baseline);}
 }
 assert.equal(manager.cycle,1,JSON.stringify(manager.sites.map(s=>({phase:s.phase,placed:s.placed.size,total:s.blocks.length}))));assert(sawScaffold&&helped&&cleared);
});

for(const count of [3,5,10])test(`global barrier also works with ${count} planned structures`,()=>{
 const tiny={id:'tiny',name:'Marco',blocks:[{x:0,y:0,z:0,type:'stone'}]};
 const origins=Array.from({length:count},(_,i)=>({x:-12+(i%5)*5,y:0,z:i<5?-5:5}));
 const {world,manager}=setup([tiny],origins);manager.syncMembers(['a']);let feet={x:0,y:0,z:0},finished=false;
 for(let tick=0;tick<200&&manager.cycle<1;tick++){
  manager.update(.5);if(manager.cycle)break;if(manager.phase==='enjoying'){finished=true;assert.equal(manager.sites.filter(s=>s.placed.size===1).length,count);}
  const task=manager.claim('a',feet);if(task){if(task.mode==='dismantling')assert(finished);feet=task.path.at(-1);assert(manager.complete('a',feet));}
 }
 assert.equal(manager.cycle,1);for(const origin of origins)assert(!world.blocks.has(blockKey(origin)));
});
