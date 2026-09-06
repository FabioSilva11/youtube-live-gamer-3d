import {account} from '@/lib/auth';
import {signedInProfile} from '@/lib/profiles';
import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function StudioRedirect(){
 const user=await account();
 if(!user)redirect('/entrar');
 const profile=await signedInProfile();
 const biome=profile?.biome||'fantasy';
 redirect('/studio/'+biome);
}
