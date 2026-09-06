import { database } from '@/db';
import { cookies } from 'next/headers';
import { account, createSession, digest, passwordHash, passwordMatches, throttle } from '@/lib/auth';
import { checkOrigin, json } from '@/lib/security';
export async function POST(request:Request,{params}:{params:Promise<{action:string}>}) {
 try {
  checkOrigin(request);
  const {action}=await params;
  if(action==='logout') { const token=(await cookies()).get('lg_session')?.value; if(token)await database().prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await digest(token)).run(); return new Response(JSON.stringify({ok:true}),{headers:{'Content-Type':'application/json','Set-Cookie':'lg_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0','Cache-Control':'no-store'}}); }
  if(!['login','register'].includes(action))return json({detail:'Rota não encontrada.'},404);
  if(Number(request.headers.get('content-length')||0)>8192)return json({detail:'Formulário muito grande.'},413);
  const body=await request.json() as any;
  const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
  const password=typeof body.password==='string'?body.password:'';
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||password.length<10||new TextEncoder().encode(password).length>72)return json({detail:'Informe um e-mail válido e uma senha de 10 a 72 caracteres (até 72 bytes).'},422);
  const ip=request.headers.get('cf-connecting-ip') || 'local';
  if(!await throttle('ip:'+ip,50)||!await throttle('email:'+email,10))return json({detail:'Muitas tentativas. Aguarde 15 minutos e tente novamente.'},429);
  let user=await database().prepare('SELECT * FROM accounts WHERE email = ?').bind(email).first<any>();
  if(action==='register') {
   const name=typeof body.name==='string'?body.name.trim().slice(0,64):'';
   if(name.length<2)return json({detail:'Informe seu nome ou o nome do canal.'},422);
   if(user)return json({detail:'Não foi possível criar a conta. Se você já se cadastrou, entre com sua senha.'},409);
   user={id:crypto.randomUUID(),email,name};
   await database().prepare('INSERT INTO accounts (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)').bind(user.id,email,name,await passwordHash(password),Date.now()).run();
  } else {
   // Compare a real-cost hash even for an unknown email to reduce timing differences.
   const fallback='$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxPHszHf.YMLSiwTjHdYR.yNx9y';
   const valid=await passwordMatches(password,user?.password_hash||fallback);
   if(!user || !valid)return json({detail:'E-mail ou senha incorretos.'},401);
  }
  const sessionCookie=await createSession(user.id,request);
  return new Response(JSON.stringify({ok:true,user:{name:user.name,email:user.email}}),{headers:{'Content-Type':'application/json','Set-Cookie':sessionCookie,'Cache-Control':'no-store'}});
 } catch {return json({detail:'Não foi possível concluir. Confira os dados e tente novamente.'},400);}
}
export async function GET() { const user=await account(); return user?json(user):json({detail:'Entre na sua conta.'},401); }
