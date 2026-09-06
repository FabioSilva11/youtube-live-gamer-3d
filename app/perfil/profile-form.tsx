'use client';
import { useState } from 'react';
import {
  UserRound,
  Radio,
  Save,
  LoaderCircle,
  Mail,
  ArrowUpRight,
} from 'lucide-react';

export default function ProfileForm({
  user,
  channelName,
  channelUrl,
}: {
  user: { name: string; email: string };
  channelName: string;
  channelUrl: string;
}) {
  const [name, setName] = useState(user.name),
    [displayName, setDisplayName] = useState(channelName),
    [url, setUrl] = useState(channelUrl),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false);
  async function save(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const r = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          display_name: displayName,
          channel_url: url,
        }),
      });
      const data = (await r.json()) as { detail?: string };
      if (!r.ok)
        throw new Error(data.detail || 'Não foi possível salvar o perfil.');
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="dash-main profile-main">
      <span className="dash-eyebrow">MINHA CONTA</span>
      <h1>Meu perfil</h1>
      <p className="dash-lead">
        Seus dados e a identidade do seu canal, em um só lugar.
      </p>
      <div className="profile-layout">
        <aside className="profile-summary">
          <span className="profile-avatar">
            {name.slice(0, 1).toUpperCase() || <UserRound />}
          </span>
          <h2>{name || 'Seu nome'}</h2>
          <p>
            <Mail size={16} />
            {user.email}
          </p>
          <span className="profile-label">Criador de conteúdo</span>
          <a href="/dashboard">
            Ir para meus biomas <ArrowUpRight size={16} />
          </a>
        </aside>
        <form className="profile-editor" onSubmit={save}>
          <section>
            <h2>
              <UserRound size={20} />
              Dados da conta
            </h2>
            <label className="form-field">
              Seu nome
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSaved(false);
                }}
                minLength={2}
                maxLength={64}
                autoComplete="name"
                required
              />
            </label>
            <label className="form-field">
              E-mail de acesso
              <input
                value={user.email}
                readOnly
                type="email"
                aria-describedby="email-help"
              />
            </label>
            <p id="email-help" className="small-note">
              Este é o e-mail usado para entrar na sua conta.
            </p>
          </section>
          <section>
            <h2>
              <Radio size={20} />
              Seu canal
            </h2>
            <label className="form-field">
              Nome do canal
              <input
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  setSaved(false);
                }}
                maxLength={64}
                required
              />
            </label>
            <label className="form-field">
              Canal no YouTube
              <input
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setSaved(false);
                }}
                type="url"
                placeholder="https://www.youtube.com/@seucanal"
              />
            </label>
            <p className="small-note">
              O link de cada transmissão é configurado separadamente no estúdio.
            </p>
          </section>
          {error && (
            <p role="alert" className="notice error">
              {error}
            </p>
          )}
          {saved && (
            <p role="status" className="profile-success">
              Perfil atualizado.
            </p>
          )}
          <button className="dash-primary" disabled={busy}>
            {busy ? (
              <LoaderCircle className="loading-spinner" size={18} />
            ) : (
              <Save size={18} />
            )}{' '}
            {busy ? 'Salvando…' : 'Salvar perfil'}
          </button>
        </form>
      </div>
    </main>
  );
}
