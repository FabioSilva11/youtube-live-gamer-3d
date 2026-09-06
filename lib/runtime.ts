import { database } from '@/db';
export async function resetRuntime(userId:string,kind:string) {
 await database().prepare('DELETE FROM runtimes WHERE user_id = ? AND kind = ?').bind(userId,kind).run();
}
/** A D1 lease keeps simultaneous OBS/dashboard polls from duplicating upstream work. */
export async function runtime(userId:string,kind:string,work:(state:any,persist:(next:any)=>Promise<void>)=>Promise<any>) {
 const db=database(), now=Date.now(), lease=crypto.randomUUID();
 await db.prepare('INSERT OR IGNORE INTO runtimes (user_id, kind) VALUES (?, ?)').bind(userId,kind).run();
 const locked=await db.prepare('UPDATE runtimes SET lock_until = ?, lease = ? WHERE user_id = ? AND kind = ? AND lock_until <= ? AND next_poll <= ?').bind(now+45000,lease,userId,kind,now,now).run();
 const row=await db.prepare('SELECT state FROM runtimes WHERE user_id = ? AND kind = ?').bind(userId,kind).first<{state:string}>();
 const state=JSON.parse(row?.state || '{}');
 if (!locked.meta.changes) return state;
 try {
  const next=await work(state,async(next)=>{const saved=await db.prepare('UPDATE runtimes SET state = ? WHERE user_id = ? AND kind = ? AND lease = ?').bind(JSON.stringify(next),userId,kind,lease).run();if(!saved.meta.changes)throw new Error('A configuração foi alterada. Atualize o palco.');Object.assign(state,next);});
  await db.prepare('UPDATE runtimes SET state = ?, next_poll = ?, lock_until = 0 WHERE user_id = ? AND kind = ? AND lease = ?').bind(JSON.stringify(next),Date.now()+Math.max(1500, Math.min(next.wait_ms || 5000,15000)),userId,kind,lease).run();
  return next;
 } catch(error) {
  // Upstream error text is generated locally and never contains API credentials.
  const next={...state,error:error instanceof Error ? error.message : 'Não foi possível atualizar agora.'};
  await db.prepare('UPDATE runtimes SET state = ?, next_poll = ?, lock_until = 0 WHERE user_id = ? AND kind = ? AND lease = ?').bind(JSON.stringify(next),Date.now()+10000,userId,kind,lease).run();
  return next;
 }
}
