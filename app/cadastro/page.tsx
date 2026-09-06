import { account } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AuthScreen from '../auth-screen';
export const dynamic='force-dynamic';
export default async function Register(){if(await account())redirect('/dashboard');return <AuthScreen initialMode="register"/>;}
