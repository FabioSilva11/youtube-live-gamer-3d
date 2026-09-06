import {test} from 'node:test';
import assert from 'node:assert/strict';
import {outputDimensions,rankingOverlayLayout,pixOverlayLayout,orientedCameraPreset,outputCameraPreset,compositionKey,defaultSceneView,normaliseSceneBox,normaliseSceneView} from '../public/static/output.js';
for(const quality of ['economy','normal','fullhd'])test(`${quality}: portrait output and overlays fit without crowding`,()=>{
 const landscape=outputDimensions(quality),portrait=outputDimensions(quality,'portrait');
 assert.deepEqual(portrait,{width:landscape.height,height:landscape.width});
 for(const count of [0,1,3,5,10]){
  const ranking=rankingOverlayLayout(portrait.width,portrait.height,count),pix=pixOverlayLayout(portrait.width,portrait.height);
  for(const r of [ranking,pix]){
   assert(r.x-r.width/2>=0&&r.x+r.width/2<=portrait.width);
   assert(r.y-r.height/2>=0&&r.y+r.height/2<=portrait.height);
  }
  assert(ranking.height<portrait.height*.16);
  assert(pix.height<portrait.height*.2);
  assert(ranking.y-ranking.height/2>pix.y+pix.height/2);
 }
});
test('portrait camera widens the scene and returning to landscape restores the original preset',()=>{
 const original=outputCameraPreset(),copy=structuredClone(original),vertical=orientedCameraPreset(original,'portrait');
 assert.deepEqual(original,copy);
 assert(vertical.position.z>original.position.z);
 assert.deepEqual(orientedCameraPreset(original,'landscape'),copy);
});
test('manual scene composition remains inside the OBS frame',()=>{
 assert.equal(compositionKey('minecraft','portrait'),'minecraft:portrait');
 for(const orientation of ['landscape','portrait']){
  const view=defaultSceneView(orientation);
  for(const box of [view.ranking,view.pix])assert(box.x>=0&&box.y>=0&&box.x+box.width<=1&&box.y+box.height<=1);
  const clamped=normaliseSceneBox({x:2,y:-1,width:4,height:.01},view.ranking);
  assert(clamped.x+clamped.width<=1&&clamped.y>=0&&clamped.height>=.08);
  const custom=normaliseSceneView({ranking:view.ranking,pix:view.pix,camera:{position:{x:1,y:2,z:3},target:{x:0,y:0,z:0},fov:45}},orientation);
  assert.deepEqual(custom.camera.position,{x:1,y:2,z:3});
 }
});
