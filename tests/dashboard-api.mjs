import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const origin=process.env.TEST_ORIGIN||'http://localhost:3000';
let cookie;
async function call(path,body){
 for(let attempt=0;attempt<3;attempt++){
  const r=await fetch(origin+path,{method:body?'POST':'GET',headers:{origin,'content-type':'application/json',...(cookie?{cookie}:{})},body:body?JSON.stringify(body):undefined});
  const text=await r.text();
  if(r.status===503&&text.includes('restarted mid-request')){await new Promise(resolve=>setTimeout(resolve,250));continue;}
  return {status:r.status,data:JSON.parse(text),cookie:r.headers.get('set-cookie')?.split(';')[0]};
 }
 throw new Error('O servidor local reiniciou repetidamente.');
}
assert.equal((await call('/api/profile',{name:'QA',display_name:'QA'})).status,401);
const credentials={name:'Criador de teste',email:`gallery-${Date.now()}@example.test`,password:`Gallery!${crypto.randomUUID()}`};
const registered=await call('/api/auth/register',credentials);assert.equal(registered.status,200);cookie=registered.cookie;
const initial=(await call('/api/studio')).data.profile;assert.equal(initial.orientation,'landscape');
assert.ok(initial.scene_composition?.views?.['fantasy:landscape']);
const customComposition=structuredClone(initial.scene_composition);customComposition.views['minecraft:portrait'].ranking={x:.1,y:.12,width:.42,height:.2};customComposition.views['minecraft:portrait'].pix={x:.62,y:.55,width:.28,height:.32};customComposition.views['minecraft:portrait'].camera={position:{x:3,y:8,z:20},target:{x:1,y:0,z:-2},fov:48};
const composed=await call('/api/studio',{action:'save_composition',scene_composition:customComposition});assert.equal(composed.status,200);assert.equal(composed.data.stage.scene_composition.views['minecraft:portrait'].ranking.x,.1);
for(const biome of ['fantasy','minecraft']){
 const chosen=await call('/api/studio',{action:'select_biome',biome});assert.equal(chosen.data.profile.biome,biome);
 for(const orientation of ['portrait','landscape']){
  const saved=await call('/api/studio',{...initial,action:'save',biome,orientation});assert.equal(saved.status,200);
  assert.equal(saved.data.stage.orientation,orientation);assert.equal(saved.data.history[0].config.orientation,orientation);
  const obs=await call('/api/stage?token='+initial.overlay_token);assert.equal(obs.data.orientation,orientation);assert.equal(obs.data.biome,biome);assert.equal(obs.data.scene_composition.views['minecraft:portrait'].camera.target.z,-2);
 }
}
assert.equal((await call('/api/studio',{...initial,action:'save',orientation:'bad'})).status,422);
assert.equal((await call('/api/studio',{action:'select_biome',biome:'bad'})).status,422);
const profile=await call('/api/profile',{name:'Criador QA',display_name:'Canal QA',channel_url:'https://www.youtube.com/@canalqa'});assert.equal(profile.status,200);
assert.equal((await call('/api/studio')).data.profile.display_name,'Canal QA');
assert.equal((await call('/api/profile',{name:'A',display_name:'QA'})).status,422);
assert.equal((await call('/api/profile',{name:'QA',display_name:'QA',channel_url:'https://evil.test/'})).status,422);
await call('/api/studio',{action:'demo'});
await call('/api/auth/logout',{});
assert.equal((await call('/api/studio')).status,401);
const login=await call('/api/auth/login',credentials);assert.equal(login.status,200);cookie=login.cookie;
assert.equal((await call('/api/studio')).data.profile.biome,'minecraft');
for(const route of ['/dashboard','/studio','/perfil','/configuracoes']){
 const r=await fetch(origin+route,{headers:{cookie}});assert.equal(r.status,200);const html=await r.text();assert(!html.includes('Internal Server Error'));
}
let route=await fetch(origin+'/studio/fantasy',{headers:{cookie}});assert.equal(route.status,200);assert.match(route.url,/\/studio\/fantasy$/);
assert.equal((await call('/api/studio')).data.profile.biome,'fantasy');
route=await fetch(origin+'/studio/minecraft',{headers:{cookie}});assert.equal(route.status,200);assert.match(route.url,/\/studio\/minecraft$/);
assert.equal((await call('/api/studio')).data.profile.biome,'minecraft');
route=await fetch(origin+'/studio/unknown-world',{headers:{cookie}});assert.equal(route.status,200);assert.match(route.url,/\/dashboard$/);
route=await fetch(origin+'/studio',{headers:{cookie}});assert.equal(route.status,200);assert.match(route.url,/\/studio\/minecraft$/);
if(origin==='http://localhost:3000')writeFileSync('work/gallery-qa.json',JSON.stringify(credentials));
console.log('PASS gallery selection, orientation for both biomes, OBS state, history, profile validation, session persistence and protected routes');
