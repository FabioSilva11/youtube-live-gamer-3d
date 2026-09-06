import { database } from '@/db';
import { account } from './auth';
import { randomToken } from './security';
import type {BiomeId} from './biomes';
import {normaliseSceneComposition} from './composition';
export type Profile = {user_id:string,display_name:string,channel_url:string,live_source:string,overlay_token:string,quality:string,biome:string,orientation:string,scene_composition:string,entry_animation:string,exit_animation:string,chat_active:number,mp_secret:string|null,mp_amount:string,mp_email:string,mp_active:number,demo:string,created_at:number};
export async function signedInProfile() {
 const user = await account();
 if (!user) return null;
 const db = database();
 await db.prepare('INSERT OR IGNORE INTO profiles (user_id, display_name, overlay_token, created_at) VALUES (?, ?, ?, ?)').bind(user.id,user.name, randomToken(), Date.now()).run();
 return db.prepare('SELECT * FROM profiles WHERE user_id = ?').bind(user.id).first<Profile>();
}
export function publicProfile(p:Profile) {
 return {display_name:p.display_name,channel_url:p.channel_url,live_source:p.live_source,overlay_token:p.overlay_token,quality:p.quality,biome:p.biome||'fantasy',orientation:p.orientation||'landscape',scene_composition:normaliseSceneComposition(p.scene_composition),entry_animation:p.entry_animation,exit_animation:p.exit_animation,chat_active:!!p.chat_active,mp_configured:!!p.mp_secret,mp_active:!!p.mp_active,mp_amount:Number(p.mp_amount),mp_email:p.mp_email};
}
export async function selectProfileBiome(userId:string, biomeId:BiomeId) {
 await database().prepare('UPDATE profiles SET biome = ? WHERE user_id = ?').bind(biomeId,userId).run();
}
export async function tokenProfile(token:string) {
 if (!/^[a-f0-9]{64}$/.test(token)) return null;
 return database().prepare('SELECT * FROM profiles WHERE overlay_token = ?').bind(token).first<Profile>();
}
