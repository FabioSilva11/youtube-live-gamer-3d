import {account} from '@/lib/auth';
import {signedInProfile} from '@/lib/profiles';
import {redirect} from 'next/navigation';
import CreatorShell from '../creator-shell';
import BiomeGallery from './gallery';
export const dynamic='force-dynamic';
export default async function Dashboard(){const user=await account();if(!user)redirect('/entrar');const profile=await signedInProfile();return <CreatorShell user={user}><BiomeGallery name={user.name} selected={profile?.biome||'fantasy'}/></CreatorShell>;}
