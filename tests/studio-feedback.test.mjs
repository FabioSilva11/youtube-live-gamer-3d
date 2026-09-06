import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';

for(const directory of ['../public/static']) {
 const source=readFileSync(new URL(directory+'/shared/PixAnimation.js',import.meta.url),'utf8');
 test(directory+': consecutive donation alerts finish and switch the light off',()=>{
  const object=()=>({rotation:{x:0,y:0,z:0},position:{y:0,set(){}},scale:{setScalar(){}},material:{}});
  const context=vm.createContext({donationRoot:{visible:false},donationCrystal:object(),donationBeamMaterial:{},donationHalo:object(),donationWave:object(),donationWaveMaterial:{},donationLight:{intensity:0},donationBannerMaterial:{},donationBanner:object(),donationParticles:[],drawDonationBanner(){}});
  vm.runInContext(source.slice(source.indexOf('const donationQueue ='),source.indexOf('return { root: donationRoot')),context);
  for(let i=0;i<3;i++) {
   vm.runInContext('triggerDonationAlert({amount:10,currency:"BRL"});animateDonationAlert(0,0,.016);animateDonationAlert(1000,1,.016)',context);
   assert.equal(context.donationRoot.visible,true);
   assert.ok(context.donationLight.intensity>0);
   vm.runInContext('animateDonationAlert(7000,7,.016)',context);
   assert.equal(context.donationRoot.visible,false);
   assert.equal(context.donationLight.intensity,0);
  }
  assert.match(source,/scene\.add\(donationLight\)/);
  assert.doesNotMatch(source,/donationRoot\.add\(donationLight\)/);
 });
}
test('Full HD uses a real 1920 × 1080 output',async()=>{
 const {outputDimensions,outputProfile}=await import('../public/static/output.js');
 assert.deepEqual(outputDimensions('fullhd'),{width:1920,height:1080});
 assert.equal(outputProfile('fullhd').fps,60);
 assert.deepEqual(outputDimensions('normal'),{width:1280,height:720});
 assert.deepEqual(outputDimensions('economy'),{width:854,height:480});
});
