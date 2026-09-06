import {account} from '@/lib/auth';
import {redirect} from 'next/navigation';
import CreatorShell from '../creator-shell';
import AccountSettings from './settings';
export const dynamic='force-dynamic';
export default async function SettingsPage(){const user=await account();if(!user)redirect('/entrar');return <CreatorShell user={user}><AccountSettings user={user}/></CreatorShell>}
