import {account} from '@/lib/auth';
import {signedInProfile} from '@/lib/profiles';
import {redirect} from 'next/navigation';
import CreatorShell from '../creator-shell';
import ProfileForm from './profile-form';
export const dynamic='force-dynamic';
export default async function Profile(){const user=await account();if(!user)redirect('/entrar');const profile=await signedInProfile();return <CreatorShell user={user}><ProfileForm user={user} channelName={profile?.display_name||user.name} channelUrl={profile?.channel_url||''}/></CreatorShell>;}
