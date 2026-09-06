import {account} from '@/lib/auth';
import {redirect} from 'next/navigation';
import Studio from '../../studio';
import {isBiomeId,biomeDefinition} from '@/lib/biomes';
import {signedInProfile,selectProfileBiome} from '@/lib/profiles';
export const dynamic='force-dynamic';
export default async function StudioBiomePage({params}:{params:Promise<{biomeId:string}>}){
 const user=await account();
 if(!user)redirect('/entrar');
 const {biomeId}=await params;
 if(!isBiomeId(biomeId))redirect('/dashboard');
 const profile=await signedInProfile();
 if(profile?.biome!==biomeId)await selectProfileBiome(user.id,biomeId);
 return <Studio user={user} biome={biomeDefinition(biomeId)}/>;
}
