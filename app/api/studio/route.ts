import { signedInProfile, publicProfile } from '@/lib/profiles';
import { stageState } from '@/lib/stage';
import { json,checkOrigin,encrypt,randomToken } from '@/lib/security';
import { videoId } from '@/lib/youtube';
import { money, qrImage } from '@/lib/pix';
import { resetRuntime } from '@/lib/runtime';
import { database } from '@/db';
import { history,saveHistory } from '@/lib/history';
import {isBiomeId} from '@/lib/biomes';
import {normaliseSceneComposition} from '@/lib/composition';
export async function GET() {
 const p=await signedInProfile(); if(!p)return json({detail:'Entre na sua conta.'},401);
 return json({profile:publicProfile(p),stage:await stageState(p),history:await history(p.user_id)});
}
export async function POST(request:Request) {
 try {
 checkOrigin(request);
 const p=await signedInProfile(); if(!p)return json({detail:'Entre na sua conta.'},401);
 const db=database(),body=await request.json() as any,action=body.action;
 if(action==='select_biome') {
  if(!isBiomeId(body.biome))throw new Error('Escolha um ambiente válido.');
  await db.prepare('UPDATE profiles SET biome = ? WHERE user_id = ?').bind(body.biome,p.user_id).run();
 } else if(action==='save_composition') {
  const composition=normaliseSceneComposition(body.scene_composition);
  await db.prepare('UPDATE profiles SET scene_composition = ? WHERE user_id = ?').bind(JSON.stringify(composition),p.user_id).run();
 } else if(action==='save') {
  if(typeof body.display_name!=='string'||!body.display_name.trim()||body.display_name.length>64)throw new Error('Informe o nome do canal, com até 64 caracteres.');
  const source=String(body.live_source||'').trim();
  if(source && !videoId(source))throw new Error('Informe um link válido da live do YouTube.');
  const channel=String(body.channel_url||'').trim();
  if(channel && !/^https:\/\/(www\.)?youtube\.com\//i.test(channel))throw new Error('Informe o endereço do seu canal no YouTube.');
  if(!['economy','normal','fullhd'].includes(body.quality)||!['spotlight','drop','portal','current','bounce','rise','twirl'].includes(body.entry_animation)||!['walk','float','portal','current','rocket','shrink','twirl'].includes(body.exit_animation))throw new Error('Configuração de cena inválida.');
  const biome=body.biome??p.biome??'fantasy';
  if(!isBiomeId(biome))throw new Error('Escolha um ambiente válido.');
  const orientation=body.orientation??p.orientation??'landscape';
  if(!['landscape','portrait'].includes(orientation))throw new Error('Escolha horizontal ou vertical.');
  if(source!==p.live_source)await resetRuntime(p.user_id,'chat');
  await db.prepare('UPDATE profiles SET display_name = ?, channel_url = ?, live_source = ?, quality = ?, entry_animation = ?, exit_animation = ?, biome = ?, orientation = ?, chat_active = ? WHERE user_id = ?').bind(body.display_name.trim(),channel,source,body.quality,body.entry_animation,body.exit_animation,biome,orientation,source===p.live_source?p.chat_active:0,p.user_id).run();
 } else if(action==='restore') {
  const saved=await db.prepare('SELECT config FROM live_configs WHERE id = ? AND user_id = ?').bind(String(body.id||''),p.user_id).first<{config:string}>();
  if(!saved)throw new Error('Configuração não encontrada.');
  const config=JSON.parse(saved.config);
  await resetRuntime(p.user_id,'chat');
  const restoreBiome=body.biome===undefined?(isBiomeId(config.biome)?config.biome:'fantasy'):body.biome;
  if(!isBiomeId(restoreBiome))throw new Error('Escolha um ambiente válido.');
  const restoredComposition=normaliseSceneComposition(config.scene_composition);
  await db.prepare('UPDATE profiles SET display_name = ?, channel_url = ?, live_source = ?, quality = ?, entry_animation = ?, exit_animation = ?, biome = ?, orientation = ?, scene_composition = ?, chat_active = 0, demo = ? WHERE user_id = ?').bind(config.display_name,config.channel_url,config.live_source,config.quality,config.entry_animation,config.exit_animation,restoreBiome,config.orientation==='portrait'?'portrait':'landscape',JSON.stringify(restoredComposition),'[]',p.user_id).run();
 } else if(action==='connect') {
  if(!videoId(p.live_source))throw new Error('Salve o link da live antes de conectar o chat.');
  await resetRuntime(p.user_id,'chat');
  await db.prepare('UPDATE profiles SET chat_active = 1, demo = ? WHERE user_id = ?').bind('[]',p.user_id).run();
 } else if(action==='disconnect') {
  await db.prepare('UPDATE profiles SET chat_active = 0 WHERE user_id = ?').bind(p.user_id).run(); await resetRuntime(p.user_id,'chat');
 } else if(action==='rotate') {
  await db.prepare('UPDATE profiles SET overlay_token = ? WHERE user_id = ?').bind(randomToken(),p.user_id).run();
 } else if(action==='demo') {
  const people=['Ana','Lucas','Bia','Rafael','Marina'].map((name,i)=>({id:'demo-'+i,display_name:name,role:i===0?'criador':'participante',messages:5-i,profile_image_available:false}));
  await db.prepare('UPDATE profiles SET demo = ? WHERE user_id = ?').bind(JSON.stringify(people),p.user_id).run();
 } else if(action==='clear_demo') {
  await db.prepare('UPDATE profiles SET demo = ? WHERE user_id = ?').bind('[]',p.user_id).run();
 } else if(action==='test_donation') {
  await db.prepare('INSERT INTO events (id, user_id, payload, created_at) VALUES (?, ?, ?, ?)').bind(crypto.randomUUID(),p.user_id,JSON.stringify({donor_name:'Apoiador de teste',amount:10,currency:'BRL',message:'Demonstração — nenhum pagamento realizado'}),Date.now()).run();
 } else if(action==='demo_qr') {
  await db.prepare('INSERT INTO events (id, user_id, payload, created_at) VALUES (?, ?, ?, ?)').bind(crypto.randomUUID(),p.user_id,JSON.stringify({type:'qr_demo',amount:5,currency:'BRL',qr_code_base64:await qrImage('DEMONSTRACAO LIVE GAMER 3D - NAO E UM PIX PAGAVEL')}),Date.now()).run();
 } else if(action==='pix_configure') {
  const token=typeof body.access_token==='string'?body.access_token.trim():'';
  const email=String(body.payer_email||'').trim();
  if(token.length<20||token.length>500)throw new Error('Informe um Access Token válido do Mercado Pago.');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw new Error('Informe o e-mail da cobrança.');
  const amount=money(body.amount),secret=await encrypt(token);
  await resetRuntime(p.user_id,'pix');
  await db.prepare('UPDATE profiles SET mp_secret = ?, mp_email = ?, mp_amount = ?, mp_active = 1 WHERE user_id = ?').bind(secret,email,amount,p.user_id).run();
 } else if(action==='pix_disable') {
  await db.prepare('UPDATE profiles SET mp_secret = NULL, mp_email = ?, mp_active = 0 WHERE user_id = ?').bind('',p.user_id).run();await resetRuntime(p.user_id,'pix');
 } else return json({detail:'Ação desconhecida.'},404);
 const next=await signedInProfile(); if(!next)return json({detail:'Entre na sua conta.'},401);
 if(action==='save')await saveHistory(next,typeof body.title==='string'?body.title:undefined);
 return json({profile:publicProfile(next),stage:await stageState(next),history:await history(next.user_id)});
 } catch(error) {return json({detail:error instanceof Error?error.message:'Não foi possível salvar.'},422);}
}
