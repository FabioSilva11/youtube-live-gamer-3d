import type { Metadata } from 'next';
import './globals.css';
import './studio.css';
import './details.css';
import './sales.css';
import './light.css';
import './creator.css';
import './dashboard.css';


export const metadata: Metadata = {
  title: 'Live Gamer 3D — Estúdio do criador',
  description: 'Seu estúdio pessoal com palco 3D, participantes do chat público do YouTube e configuração de live.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className="antialiased"
      >
        {children}
      </body>
    </html>
  );
}
