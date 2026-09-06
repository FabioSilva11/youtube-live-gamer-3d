import { cookies } from 'next/headers';
import { database } from '@/db';
import { randomToken } from './security';
import bcrypt from 'bcryptjs';
export type Account={id:string,email:string,name:string};
export async function digest(value:string) {return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,'0')).join('');}
export async function account():Promise<Account|null> {
 const token=(await cookies()).get('lg_session')?.value;
 if(!token || !/^[a-f0-9]{64}$/.test(token))return null;
 return database().prepare('SELECT a.id, a.email, a.name FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token_hash = ? AND s.expires_at > ?').bind(await digest(token),Date.now()).first<Account>();
}
export async function createSession(id:string,request:Request) {
 const token=randomToken();
 await database().prepare('INSERT INTO sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)').bind(await digest(token),id,Date.now()+14*86400000).run();
 return 'lg_session='+token+'; HttpOnly; SameSite=Lax; Path=/; Max-Age=1209600'+(new URL(request.url).protocol==='https:'?'; Secure':'');
}
export async function passwordHash(password:string) {return bcrypt.hash(password,12);}
export async function passwordMatches(password:string,hash:string) {return bcrypt.compare(password,hash);}
export async function throttle(key:string,max=10) {
 const db=database(), hash=await digest(key), now=Date.now();
 await db.prepare('INSERT INTO login_limits (key, attempts, reset_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET attempts = CASE WHEN reset_at < ? THEN 1 ELSE attempts + 1 END, reset_at = CASE WHEN reset_at < ? THEN ? ELSE reset_at END').bind(hash,now+900000,now,now,now+900000).run();
 const row=await db.prepare('SELECT attempts FROM login_limits WHERE key = ?').bind(hash).first<{attempts:number}>();
 return (row?.attempts || 0)<=max;
}
