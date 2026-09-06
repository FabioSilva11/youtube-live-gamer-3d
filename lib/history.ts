import { database } from '@/db';
import type { Profile } from './profiles';
export async function saveHistory(p:Profile,title?:string) {
 const config={display_name:p.display_name,channel_url:p.channel_url,live_source:p.live_source,quality:p.quality,biome:p.biome||'fantasy',orientation:p.orientation||'landscape',scene_composition:p.scene_composition,entry_animation:p.entry_animation,exit_animation:p.exit_animation};
 await database().prepare('INSERT INTO live_configs (id, user_id, title, config, created_at) VALUES (?, ?, ?, ?, ?)').bind(crypto.randomUUID(),p.user_id,title?.trim().slice(0,100)||p.display_name,JSON.stringify(config),Date.now()).run();
}
export async function history(userId:string) {
 const rows=await database().prepare('SELECT id, title, config, created_at FROM live_configs WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').bind(userId).all<any>();
 return rows.results.map(r=>({...r,config:JSON.parse(r.config)}));
}
