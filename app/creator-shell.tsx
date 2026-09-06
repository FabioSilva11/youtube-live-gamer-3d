'use client';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import {
  Radio,
  LayoutGrid,
  UserRound,
  Settings,
  LogOut,
  ArrowUpRight,
} from 'lucide-react';

const navigation = [
  ['/dashboard', 'Meus biomas', LayoutGrid],
  ['/perfil', 'Meu perfil', UserRound],
  ['/configuracoes', 'Configurações', Settings],
] as const;

export default function CreatorShell({
  user,
  children,
}: {
  user: { name: string; email: string };
  children: ReactNode;
}) {
  const path = usePathname();
  async function logout() {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (response.ok) location.href = '/entrar';
  }
  return (
    <div className="creator-dashboard">
      <header className="dash-topnav">
        <div className="dash-nav-inner">
          <a className="dash-brand" href="/dashboard">
            <Radio size={25} />
            <span>
              LIVE GAMER <b>3D</b>
            </span>
          </a>
          <nav className="dash-nav" aria-label="Navegação do criador">
            {navigation.map(([href, label, Icon]) => (
              <a
                key={href}
                href={href}
                aria-current={path === href ? 'page' : undefined}
              >
                <Icon size={18} />
                <span>{label}</span>
              </a>
            ))}
          </nav>
          <div className="dash-account">
            <a
              href="/perfil"
              className="dash-user-top"
              aria-label="Abrir meu perfil"
            >
              <span className="dash-avatar">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
              <span>{user.name.split(' ')[0]}</span>
            </a>
            <button
              className="dash-signout"
              onClick={() => void logout()}
              aria-label="Sair da conta"
            >
              <LogOut size={17} />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </header>
      <div className="dash-context">
        <span>Área do Criador</span>
        <span>Escolha um mundo e prepare sua live.</span>
      </div>
      <div className="dash-content">{children}</div>
      <footer className="dash-footer">
        <span>LIVE GAMER 3D</span>
        <a href="/">
          Conhecer a plataforma <ArrowUpRight size={14} />
        </a>
      </footer>
    </div>
  );
}
