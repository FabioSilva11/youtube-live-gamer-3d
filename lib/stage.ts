import { database } from '@/db';
import type { Profile } from './profiles';
import { runtime } from './runtime';
import { pollChat, publicParticipants } from './youtube';
import { pollPix, publicPix } from './pix';
import {normaliseSceneComposition} from './composition';
export async function stageState(p:Profile) {
 const [chat,pix]=await Promise.all([
  p.chat_active?runtime(p.user_id,'chat',s=>pollChat(s,p.live_source)):Promise.resolve({}),
  p.mp_active?runtime(p.user_id,'pix',(s,persist)=>pollPix(s,p,persist)):Promise.resolve({}),
 ]);
 const eventRows=await database().prepare('SELECT id, payload, created_at FROM events WHERE user_id = ? AND created_at > ? ORDER BY created_at DESC LIMIT 20').bind(p.user_id,Date.now()-60000).all<any>();
 const demo=JSON.parse(p.demo);
 const events=eventRows.results.reverse().map(e=>({id:e.id,...JSON.parse(e.payload),created_at:e.created_at}));
 const demoQr=events.filter(e=>e.type==='qr_demo').at(-1);
 const publicPayment=publicPix(pix,!!p.mp_active);
 return {active:!!p.chat_active,error:chat.error||null,updated_at:chat.updated_at||null,participants:[...publicParticipants(chat.people||[]),...demo].slice(-10),quality:p.quality,biome:p.biome||'fantasy',orientation:p.orientation||'landscape',scene_composition:normaliseSceneComposition(p.scene_composition),entry_animation:p.entry_animation,exit_animation:p.exit_animation,pix:!p.mp_active&&demoQr?{...demoQr,enabled:true,charge_id:demoQr.id,demo:true}:publicPayment,events:events.filter(e=>e.type!=='qr_demo')};
}
