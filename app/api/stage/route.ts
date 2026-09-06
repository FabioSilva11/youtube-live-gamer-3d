import { tokenProfile } from '@/lib/profiles';
import { stageState } from '@/lib/stage';
import { json } from '@/lib/security';
export async function GET(request:Request) {
 const p=await tokenProfile(new URL(request.url).searchParams.get('token')||'');
 if(!p)return json({detail:'Link de palco inválido ou revogado.'},404);
 return json(await stageState(p));
}
