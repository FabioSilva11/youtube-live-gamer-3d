'use client';
import {LogOut,Mail,ShieldCheck} from 'lucide-react';
export default function AccountSettings({user}:{user:{name:string,email:string}}){
 async function logout(){const response=await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(response.ok)location.href='/entrar'}
 return <main className="dash-main account-settings"><span className="dash-eyebrow">CONTA</span><h1>Configurações</h1><p className="dash-lead">Acesso e sessão da sua Área do Criador.</p><section className="account-settings-card"><h2><ShieldCheck size={21}/>Acesso à conta</h2><div className="account-setting-row"><span><Mail size={18}/><span><strong>E-mail de acesso</strong><small>Usado para entrar no LIVE GAMER 3D</small></span></span><b>{user.email}</b></div><div className="account-setting-row"><span><LogOut size={18}/><span><strong>Sessão atual</strong><small>Encerra o acesso neste navegador</small></span></span><button className="settings-signout" onClick={()=>void logout()}>Sair da conta</button></div></section></main>;
}
