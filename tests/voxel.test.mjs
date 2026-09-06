import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BlockGrid, blockKey } from '../public/static/biomes/minecraft/BlockGrid.js';
import { StructureManager, worldBlocks, DEFAULT_SITES } from '../public/static/biomes/minecraft/StructureManager.js';
import { BuilderAI } from '../public/static/biomes/minecraft/BuilderAI.js';
const blueprints = ['house','tower','bridge','farm','monument'].map(id => JSON.parse(fs.readFileSync(new URL(`../public/static/biomes/minecraft/structures/${id}.json`,import.meta.url))));
function setup(blueprints, options) {
 const world=new BlockGrid();
 for(let x=-17;x<=17;x++)for(let z=-13;z<=13;z++)world.set({x,y:-1,z,type:'grass'});
 const manager=new StructureManager(world,blueprints,{origins:DEFAULT_SITES.slice(0,1),...options});
 return {world,manager};
}
test('blueprints translate without duplicates or changing their source',()=>{
 for(const blueprint of blueprints){const before=JSON.stringify(blueprint);const blocks=worldBlocks(blueprint,{x:40,y:5,z:20});assert.equal(new Set(blocks.map(blockKey)).size,blocks.length);assert.equal(JSON.stringify(blueprint),before);assert.equal(Math.min(...blocks.map(b=>b.y)),5);}
});
for(const blueprint of blueprints) for(const count of [1,4]) test(`${blueprint.id}: ${count} builders finish, preserve, dismantle and restart`,()=>{
 const {world,manager}=setup([blueprint],{holdSeconds:3,cooldownSeconds:1});
 const ids=Array.from({length:count},(_,i)=>'p'+i), positions=new Map(ids.map((id,i)=>[id,{x:i,y:0,z:1}]));manager.syncMembers(ids);
 const site=manager.sites[0]; let held=false,removed=false;
 for(let tick=0;tick<3000&&site.cycle<1;tick++){
  manager.update(.25);
  if(site.phase==='enjoying'){held=true;assert.equal(site.placed.size,site.blocks.length);}
  if(site.phase==='cooldown'){removed=true;assert.equal(site.placed.size,0);assert(site.blocks.every(b=>!world.has(b)));}
  for(const id of ids){const task=manager.claim(id,positions.get(id));if(!task)continue;const end=task.path.at(-1);positions.set(id,end);assert(manager.complete(id,end));}
 }
 assert.equal(site.cycle,1,`${site.phase} stalled with ${site.placed.size}/${site.blocks.length}`);assert(held&&removed);
});
test('claims are exclusive, unreachable completion is refused, and departures release work',()=>{
 const {manager}=setup(blueprints);manager.syncMembers(['a','b']);manager.update(0);
 const a=manager.claim('a',{x:0,z:1}),b=manager.claim('b',{x:0,z:1});assert(a&&b);assert.notEqual(blockKey(a.block),blockKey(b.block));
 assert.equal(manager.complete('a',{x:100,y:0,z:100}),false);
 manager.syncMembers(['b']);assert.equal(manager.sites[0].claims.has('a'),false);
 manager.syncMembers([]);const phase=manager.sites[0].phase;manager.update(100);assert.equal(manager.sites[0].phase,phase);
 manager.syncMembers(['c']);assert(manager.claim('c',{x:0,z:1}));
});
test('ten participants form stable crews of four, four and two',()=>{
 const {manager}=setup(blueprints,{origins:DEFAULT_SITES});const ids=Array.from({length:10},(_,i)=>String(i));manager.syncMembers(ids);assert.deepEqual(manager.sites.map(s=>s.members.length),[4,4,2]);
 manager.syncMembers(ids.slice(1));assert.equal(manager.assignments.get('5'),1);manager.syncMembers([...ids.slice(1),'replacement']);assert.equal(manager.assignments.get('replacement'),0);
});
test('navigation respects solid obstacles and single-block climbs',()=>{
 const {world}=setup(blueprints);for(let y=0;y<4;y++)world.set({x:1,y,z:1,type:'stone'});
 const path=world.pathTo({x:0,z:1},p=>p.x===2&&p.z===1);assert(path);assert(!path.some(p=>p.x===1&&p.z===1));
 for(let i=1;i<path.length;i++)assert(Math.abs(path[i].y-path[i-1].y)<=1);
});
for (const blueprint of blueprints) for (const count of [1,4]) test(`${blueprint.id}: actual walking AI with ${count} builders completes without teleporting`,()=>{
 const {world,manager}=setup([blueprint],{holdSeconds:1,cooldownSeconds:1});const ai=new BuilderAI(manager,world);
 const vector=(x=0,y=0,z=0)=>({x,y,z,set(x,y,z){Object.assign(this,{x,y,z});return this;},copy(v){return this.set(v.x,v.y,v.z);}});
 const avatars=new Map(Array.from({length:count},(_,i)=>[String(i),{position:vector(i*.7,0,.7),lookAt(){},userData:{id:String(i),phase:'active',target:vector()}}]));
 for(let t=0;t<2400&&manager.sites[0].cycle<1;t+=.05){
  const before=[...avatars.values()].map(a=>({...a.position}));ai.update(avatars,.05,t);
  [...avatars.values()].forEach((a,i)=>assert(Math.hypot(a.position.x-before[i].x,a.position.z-before[i].z)<=.091));
 }
 assert.equal(manager.sites[0].cycle,1,JSON.stringify({phase:manager.sites[0].phase,placed:manager.sites[0].placed.size}));
});
