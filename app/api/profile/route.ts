import {account} from '@/lib/auth';
import {signedInProfile} from '@/lib/profiles';
import {database} from '@/db';
import {json,checkOrigin} from '@/lib/security';
export async function POST(request:Request){
 try{
  checkOrigin(request);const user=await account();if(!user)return json({detail:'Entre na sua conta.'},401);
  await signedInProfile();const body=await request.json() as {name?:unknown,display_name?:unknown,channel_url?:unknown};
  if(typeof body.name!=='string'||body.name.trim().length<2||body.name.trim().length>64)throw new Error('Informe seu nome, com 2 a 64 caracteres.');
  if(typeof body.display_name!=='string'||!body.display_name.trim()||body.display_name.trim().length>64)throw new Error('Informe o nome do canal, com até 64 caracteres.');
  const url=typeof body.channel_url==='string'?body.channel_url.trim():'';
  if(url&&(!/^https:\/\/(www\.)?youtube\.com\//i.test(url)||url.length>500))throw new Error('Informe um endereço válido do seu canal no YouTube.');
  const db=database();await db.batch([db.prepare('UPDATE accounts SET name = ? WHERE id = ?').bind(body.name.trim(),user.id),db.prepare('UPDATE profiles SET display_name = ?, channel_url = ? WHERE user_id = ?').bind(body.display_name.trim(),url,user.id)]);
  return json({success:true});
 }catch(error){return json({detail:error instanceof Error?error.message:'Não foi possível salvar seu perfil.'},422);}
}
