import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';

class Vector {
 constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}
 set(x,y,z){Object.assign(this,{x,y,z});return this;}
 copy(v){return this.set(v.x,v.y,v.z);}
 distanceTo(v){return Math.hypot(this.x-v.x,this.y-v.y,this.z-v.z);}
}
for(const directory of ['../public/static']){
 const base=new URL(directory+'/',import.meta.url);
 const source=readFileSync(new URL('app.js',base),'utf8').replace(/\r\n/g,'\n');
 const motion=await import('data:text/javascript;base64,'+Buffer.from(readFileSync(new URL('animation.js',base))).toString('base64'));
 const social=await import('data:text/javascript;base64,'+Buffer.from(readFileSync(new URL('social.js',base))).toString('base64'));
 test(directory+': all ten batch entrants finish and explore',()=>{
  const avatars=new Map(),arrivalQueue=new motion.ArrivalQueue();
  for(let i=0;i<10;i++){
   const id=String(i);
   avatars.set(id,{visible:false,position:new Vector(),rotation:{y:0},scale:{setScalar(){}},lookAt(){},userData:{phase:'queued',entryMode:['spotlight','drop','portal','bounce','rise','twirl'][i%6],layoutTarget:new Vector(i/2,0,i/4),layoutScale:1,target:new Vector(),socialIndex:i}});
   arrivalQueue.enqueue(id);
  }
  const context=vm.createContext({avatars,arrivalQueue,THREE:{Vector3:Vector},terrainHeightAt:()=>0,sceneStartedAt:0,socialAvatarIds:[...avatars.keys()],...social});
  const start=source.includes('function getSpawnPosition(')?source.indexOf('function getSpawnPosition('):source.indexOf('function updateArrivalAnimation(');
  vm.runInContext(source.slice(start,source.indexOf('\nlet previewWidth',start)),context);
  const socialStart=source.indexOf('function updateSocialTargets(');
  vm.runInContext(source.slice(socialStart,source.indexOf('\n}\n',socialStart)+3),context);
  for(let now=0;now<=6500;now+=50)context.updateArrivalAnimation(now);
  assert.equal(arrivalQueue.active,null);
  assert.equal(arrivalQueue.pending.length,0);
  for(const avatar of avatars.values())assert.equal(avatar.userData.phase,'active');
  const explored=new Set();
  for(let now=6500;now<=30000;now+=250){context.updateSocialTargets(now);for(const [id,a] of avatars)if(a.userData.socialPhase==='explore'&&a.userData.target.distanceTo(a.userData.layoutTarget)>.1)explored.add(id);}
  assert.equal(explored.size,10);
 });
 test(directory+': new motions are finite and finish at expected size',()=>{
  for(const mode of ['bounce','rise','twirl']){assert.equal(motion.normaliseEntryMode(mode),mode);for(let p=0;p<=1;p+=.05)assert(Object.values(motion.entryMotion(mode,p)).every(Number.isFinite));assert.equal(motion.entryMotion(mode,1).scaleMultiplier,1);}
  for(const mode of ['rocket','shrink','twirl']){assert.equal(motion.normaliseExitMode(mode),mode);for(let p=0;p<=1;p+=.05)assert(Object.values(motion.exitMotion(mode,p)).every(Number.isFinite));assert(motion.exitMotion(mode,1).scaleMultiplier<.21);}
 });
}
