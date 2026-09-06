'use client';
import type { ReactNode } from 'react';
import { ArrowLeft, Radio } from 'lucide-react';

export default function StudioLayout({
  biomeName,
  chatLabel,
  chatState,
  actions,
  children,
}: {
  biomeName: string;
  chatLabel: string;
  chatState: '' | 'is-connected' | 'is-error';
  actions: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="studio-layout">
      <header className="studio-header">
        <a
          href="/dashboard"
          className="studio-back"
          aria-label="Voltar para Meus biomas"
        >
          <ArrowLeft size={18} />
          <span>Meus biomas</span>
        </a>
        <div className="studio-header-center">
          <Radio size={18} />
          <strong>{biomeName}</strong>
        </div>
        <div className="studio-header-actions">
          <span className={'studio-chat-pill ' + chatState}>
            <i />
            {chatLabel}
          </span>
          {actions}
        </div>
      </header>
      {children}
    </div>
  );
}
