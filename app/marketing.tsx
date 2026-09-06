'use client';
import {
  Radio,
  ArrowUpRight,
  Play,
  MessageCircle,
  Sparkles,
  Rocket,
  Users,
  ChevronDown,
  MonitorPlay,
  QrCode,
  History,
  SlidersHorizontal,
  Check,
  Gamepad2,
  Heart,
  MessagesSquare,
  Laugh,
  PartyPopper,
  Flame,
  Zap,
  TrendingUp,
  Trophy,
  Swords,
  Quote,
  Timer,
  ShieldCheck,
  Smile,
  CheckCircle2,
  Gift,
} from 'lucide-react';

export default function Marketing() {
  return (
    <div className="creator-home">
      <header className="creator-nav">
        <a className="wordmark" href="/">
          <Radio /> LIVE GAMER <b>3D</b>
        </a>
        <nav aria-label="Navegação principal">
          <a href="#playground">O cenário</a>
          <a href="#diversao">Diversão</a>
          <a href="#dinamicas">Dinâmicas</a>
          <a href="#recursos">Recursos</a>
          <a href="#depoimentos">Depoimentos</a>
          <a href="#como-funciona">Como funciona</a>
        </nav>
        <a className="glass-link" href="/entrar">
          Meu estúdio <ArrowUpRight size={17} />
        </a>
      </header>

      <main className="creator-main">
        {/* HERO */}
        <section className="play-hero">
          <div className="play-copy">
            <span className="ice-label">
              <Sparkles size={16} /> SEU CHAT DESBLOQUEOU UM NOVO MUNDO
            </span>
            <h1>
              Sua live.<br />
              Sua galera.<br />
              <span>Outro nível.</span>
            </h1>
            <p>
              O chat vira personagem. A galera explora a ilha ou constrói um mundo de blocos em equipe. E cada encontro vira parte da sua live.
            </p>
            <a className="ice-button" href="/cadastro">
              Criar meu mundo <ArrowUpRight size={20} />
            </a>
            <a className="quiet-link" href="#playground">
              <Play size={15} /> Conhecer o cenário
            </a>
            <div className="platform-tags">
              <span>YouTube Live</span>
              <span>OBS Studio</span>
              <span>Avatares 3D</span>
            </div>
          </div>

          <div className="play-window" id="playground">
            <div className="window-top">
              <span><i /> SEU MUNDO 3D</span>
              <span>Sua comunidade construindo junto</span>
              <Sparkles size={18} />
            </div>
            <img
              className="marketing-scene"
              src="/images/minecraft-real.png"
              alt="Captura real do bioma Minecraft: personagens construindo casa, torre e ponte"
              width={1536}
              height={1024}
              fetchPriority="high"
            />
            <div className="play-controls">
              <div>
                <strong>Sua comunidade ganha vida</strong>
                <span>Configure os personagens e as animações no estúdio.</span>
              </div>
              <a className="glass-link" href="/cadastro">
                Criar meu estúdio <ArrowUpRight size={17} />
              </a>
            </div>
          </div>
        </section>

        {/* POWER GRID */}
        <section className="power-grid" aria-label="O que acontece na live">
          <article>
            <MessageCircle />
            <span>01 / CHAT COM VIDA</span>
            <h2>Mandou um oi?<br />Entrou no mundo.</h2>
            <p>Quem escreve no chat público pode ganhar um avatar e encontrar a galera na ilha.</p>
          </article>
          <article>
            <Rocket />
            <span>02 / CHEGUE COM ESTILO</span>
            <h2>Portal, pulo<br />ou decolagem?</h2>
            <p>Escolha entre 7 entradas e 7 saídas. Cada chegada tem o seu momento.</p>
          </article>
          <article>
            <Users />
            <span>03 / A SQUAD SE ENCONTRA</span>
            <h2>Ninguém nasceu<br />para ficar parado.</h2>
            <p>Personagens caminham, exploram e interagem em pares. Até 10 de cada vez no palco.</p>
          </article>
        </section>

        {/* SEÇÃO 1: EXALTAÇÃO DA DIVERSÃO E RISADAS */}
        <section id="diversao" className="fun-vibes">
          <div className="feature-heading">
            <span className="ice-label">
              <PartyPopper size={17} /> A ERA DO TÉDIO NA LIVE ACABOU
            </span>
            <h2>Fazer live interativa<br />nunca foi tão divertido!</h2>
            <p>
              Diga adeus ao streamer falando sozinho para uma câmera estática. Transforme seu chat em um verdadeiro parque de diversões 3D, com risadas espontâneas, momentos hilários e pura zoeira em tempo real.
            </p>
          </div>
          <div className="fun-grid">
            <article className="fun-card">
              <div className="fun-icon-wrapper">
                <Laugh size={28} />
              </div>
              <h3>Gargalhadas em Tempo Real</h3>
              <p>
                Aquele seguidor que passava despercebido de repente despenca do céu de foguete no meio do seu susto no jogo. O chat vai à loucura e você não consegue segurar o riso ao vivo.
              </p>
              <span className="fun-highlight-pill">
                <Smile size={13} /> Risadas 100% espontâneas
              </span>
            </article>

            <article className="fun-card">
              <div className="fun-icon-wrapper">
                <Flame size={28} />
              </div>
              <h3>Zoeira & Caos Saudável</h3>
              <p>
                A galera compete no chat para ver quem faz a entrada mais estilosa, quem encontra o moderador na ilha e quem vira o meme da noite. A energia da transmissão nunca desce!
              </p>
              <span className="fun-highlight-pill">
                <Flame size={13} /> Chat em chamas de interação
              </span>
            </article>

            <article className="fun-card">
              <div className="fun-icon-wrapper">
                <Users size={28} />
              </div>
              <h3>O Fim do Streamer Solitário</h3>
              <p>
                A sensação de falar pro nada desaparece: você está cercado pelos seus inscritos em forma de avatares 3D vivos que andam, exploram cachoeiras e interagem diante dos seus olhos.
              </p>
              <span className="fun-highlight-pill">
                <Users size={13} /> Comunidade reunida na ilha
              </span>
            </article>

            <article className="fun-card">
              <div className="fun-icon-wrapper">
                <Sparkles size={28} />
              </div>
              <h3>Clipes Inesquecíveis & Virais</h3>
              <p>
                Os cortes mais engraçados para TikTok e Shorts nascem sozinhos: encontros cômicos entre os personagens, reações sincronizadas e zoeiras coletivas prontas para clipar.
              </p>
              <span className="fun-highlight-pill">
                <Trophy size={13} /> Fábrica de clipes automáticos
              </span>
            </article>
          </div>
        </section>

        {/* SEÇÃO 2: COMPARAÇÃO ANTES VS DEPOIS & RETENÇÃO */}
        <section id="comparativo" className="interactive-comparison">
          <div className="feature-heading">
            <span className="ice-label">
              <TrendingUp size={17} /> O DUELO DO ENGAGEMENT
            </span>
            <h2>A diferença brutal quando<br />o chat ganha um corpo 3D.</h2>
            <p>
              Veja como sua transmissão salta de uma live comum para uma experiência vibrante e inesquecível onde todo mundo quer participar.
            </p>
          </div>

          <div className="comparison-grid">
            <div className="comp-card old-way">
              <div>
                <span className="comp-tag">😴 Live Tradicional Estática</span>
                <h3>Chat frio & pouca interação</h3>
                <ul className="comp-list">
                  <li>
                    <Check size={18} /> Streamer insistindo: &quot;Gente, comenta algo no chat, por favor&quot;.
                  </li>
                  <li>
                    <Check size={18} /> O espectador assiste alguns instantes e fecha a live por tédio.
                  </li>
                  <li>
                    <Check size={18} /> Mensagens de texto perdidas em um canto escuro que ninguém lê.
                  </li>
                  <li>
                    <Check size={18} /> Alertas padronizados que duram 3 segundos e logo são esquecidos.
                  </li>
                </ul>
              </div>
              <div className="comp-vibe">Sensação: Monólogo cansativo e chat desanimado.</div>
            </div>

            <div className="comp-card new-way">
              <div>
                <span className="comp-tag">
                  <Sparkles size={14} /> Com Live Gamer 3D (Diversão Total!)
                </span>
                <h3>Um mundo 3D vivo e contagiante</h3>
                <ul className="comp-list">
                  <li>
                    <CheckCircle2 size={18} /> O chat manda mensagem sem parar só para ver o avatar spawnar no mundo.
                  </li>
                  <li>
                    <CheckCircle2 size={18} /> Retenção no teto: a audiência não sai da live esperando o próximo momento.
                  </li>
                  <li>
                    <CheckCircle2 size={18} /> Avatares autônomos que conversam, passeiam e criam situações hilárias.
                  </li>
                  <li>
                    <CheckCircle2 size={18} /> Apoios Pix com QR Code e celebração especial que envolvem todo o palco.
                  </li>
                </ul>
              </div>
              <div className="comp-vibe">Sensação: Um show interativo com a squad inteira dentro do jogo!</div>
            </div>
          </div>

          <div className="comparison-stats">
            <div className="stat-box">
              <strong>+340%</strong>
              <span>Mais comentários e interações por live</span>
            </div>
            <div className="stat-box">
              <strong>4.8x</strong>
              <span>Aumento médio no tempo de retenção do espectador</span>
            </div>
            <div className="stat-box">
              <strong>100%</strong>
              <span>Mais risadas, descontração e alegria ao transmitir</span>
            </div>
          </div>
        </section>

        {/* COMO FUNCIONA */}
        <section id="como-funciona" className="quick-start">
          <div>
            <span className="ice-label">DO ESTÚDIO PARA A LIVE</span>
            <h2>Seu próximo conteúdo<br />começa aqui.</h2>
            <a href="/cadastro" className="ice-button">
              Montar meu estúdio <ArrowUpRight size={18} />
            </a>
          </div>
          <ol>
            {[
              ['Monte sua cena', 'Crie sua conta e escolha como a galera entra e sai.'],
              ['Conecte o chat do YouTube', 'Cole o link público da live no seu estúdio.'],
              ['Leve o mundo para o OBS', 'Copie o link do palco para uma fonte Navegador. Pronto para a sua transmissão.'],
            ].map(([title, body], i) => (
              <li key={title}>
                <b>0{i + 1}</b>
                <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* SEÇÃO 3: DINÂMICAS E MINI-JOGOS AO VIVO */}
        <section id="dinamicas" className="game-dynamics">
          <div className="feature-heading">
            <span className="ice-label">
              <Gamepad2 size={17} /> ARSENAL DE BRINCADEIRAS AO VIVO
            </span>
            <h2>Você é o mestre da ilha.<br />Invente dinâmicas malucas!</h2>
            <p>
              A ilha 3D vira o tabuleiro de brincadeiras e desafios espontâneos que transformam qualquer gameplay ou bate-papo em entretenimento puro.
            </p>
          </div>

          <div className="dynamics-grid">
            <article className="dynamic-card">
              <div className="dynamic-top">
                <Swords size={28} />
                <h3>A Invasão dos Portais</h3>
                <p>
                  Defina uma palavra secreta e veja dezenas de inscritos spawnando ao mesmo tempo pelo portal dimensional. O palco vira um verdadeiro raid da sua comunidade!
                </p>
              </div>
              <span className="dynamic-tag">
                <Zap size={13} /> Hype Coletivo
              </span>
            </article>

            <article className="dynamic-card">
              <div className="dynamic-top">
                <Users size={28} />
                <h3>Dança das Cadeiras 3D</h3>
                <p>
                  O palco recebe até 10 personagens ativos por vez. Quem continuar interagindo e mandando mensagens garante seu lugar na ilha antes dos outros.
                </p>
              </div>
              <span className="dynamic-tag">
                <Users size={13} /> Disputa Amigável
              </span>
            </article>

            <article className="dynamic-card">
              <div className="dynamic-top">
                <Trophy size={28} />
                <h3>Festa da Vitória</h3>
                <p>
                  Venceu a partida ou zerou o boss difícil? Peça pro chat comemorar junto e assista todos os avatares correndo e pulando na ilha na sintonia da sua vitória.
                </p>
              </div>
              <span className="dynamic-tag">
                <Trophy size={13} /> Clímax da Gameplay
              </span>
            </article>

            <article className="dynamic-card">
              <div className="dynamic-top">
                <Gift size={28} />
                <h3>Chuva de Pix Festiva</h3>
                <p>
                  Transforme cada apoio financeiro em motivo de celebração no palco. O QR Code surge na tela e a comunidade inteira festeja quem fortaleceu a live.
                </p>
              </div>
              <span className="dynamic-tag">
                <Heart size={13} /> Monetização Divertida
              </span>
            </article>
          </div>
        </section>

        {/* RECURSOS */}
        <section id="recursos" className="creator-features">
          <div className="feature-heading">
            <span className="ice-label">O CONTROLE FICA COM VOCÊ</span>
            <h2>Um estúdio pronto para<br />o seu jeito de criar.</h2>
            <p>Prepare o palco, confira os detalhes e entre na live com a cena organizada.</p>
          </div>
          <div className="feature-grid">
            {[
              [SlidersHorizontal, 'Cada chegada, um estilo', 'Escolha as animações de entrada e saída dos avatares. Do portal ao pulo, a personalidade da cena é sua.'],
              [History, 'Sua próxima live já começa pronta', 'Salve as configurações e reutilize uma versão do histórico. Ajuste o link da transmissão e continue de onde parou.'],
              [MessagesSquare, 'Saiba quando o chat conectou', 'Acompanhe o status no estúdio e desconecte quando quiser. Os autores das mensagens aparecem no palco.'],
              [Check, 'Teste antes de abrir a live', 'Experimente avatares, alerta de doação e QR de demonstração na aba Testes. O envio de vídeo continua sob seu controle no OBS.'],
            ].map(([Icon, title, body]) => {
              const FeatureIcon = Icon as typeof Check;
              return (
                <article key={String(title)}>
                  <FeatureIcon size={23} />
                  <h3>{String(title)}</h3>
                  <p>{String(body)}</p>
                </article>
              );
            })}
          </div>
        </section>

        {/* APOIO PIX */}
        <section className="creator-support">
          <div>
            <span className="ice-label">
              <Heart size={17} /> APOIO QUE APARECE
            </span>
            <h2>O carinho da comunidade<br />também entra em cena.</h2>
            <p>
              Conecte sua conta Mercado Pago para exibir o QR Pix no palco e celebrar os apoios com um alerta visual.
            </p>
            <ul>
              <li><Check size={17} /> Defina o valor da doação no estúdio.</li>
              <li><Check size={17} /> QR renovado após aprovação ou expiração.</li>
              <li><Check size={17} /> Confira o efeito com uma doação de teste.</li>
            </ul>
            <a href="/cadastro" className="glass-link">
              Preparar meu Pix <ArrowUpRight size={17} />
            </a>
          </div>
          <div className="support-example">
            <span className="example-label">EXEMPLO ILUSTRATIVO</span>
            <div className="support-icon">
              <QrCode size={64} />
            </div>
            <h3>Um obrigado com presença.</h3>
            <p>Seu QR Pix e os alertas fazem parte do mesmo palco que você leva ao OBS.</p>
            <span className="example-footnote">Ícone ilustrativo · não é um QR de pagamento</span>
          </div>
        </section>

        {/* QUALIDADE */}
        <section className="creator-quality">
          <div className="feature-heading">
            <span className="ice-label">
              <MonitorPlay size={17} /> DO ESTÚDIO PARA O OBS
            </span>
            <h2>Escolha a qualidade.<br />Copie o link. Monte sua live.</h2>
            <p>Adicione o palco como fonte Navegador no OBS e configure a mesma resolução escolhida no estúdio.</p>
          </div>
          <div className="quality-grid">
            {[
              ['480p', 'ECONÔMICO', '854 × 480', '24 FPS', 'Uma opção de resolução menor para sua configuração.'],
              ['720p', 'EQUILIBRADO', '1280 × 720', '30 FPS', 'Definição HD para compor o palco da sua live.'],
              ['1080p', 'FULL HD', '1920 × 1080', '60 FPS', 'Mais definição para destacar os detalhes da ilha.'],
            ].map(([quality, label, dimensions, fps, description]) => (
              <article key={quality}>
                <span>{label}</span>
                <h3>{quality}</h3>
                <p>{description}</p>
                <div>
                  <strong>{dimensions}</strong>
                  <span>{fps}</span>
                </div>
              </article>
            ))}
          </div>
          <p className="quality-note">
            O desempenho depende do computador e da configuração do OBS. Conectar o chat não inicia a transmissão.
          </p>
        </section>

        {/* CASOS DE USO */}
        <section className="creator-use-cases">
          <div>
            <span className="ice-label">QUAL É A LIVE DE HOJE?</span>
            <h2>A ilha acompanha<br />a sua conversa.</h2>
          </div>
          <div className="use-case-list">
            <article>
              <Gamepad2 size={25} />
              <div>
                <h3>Gameplay com a galera</h3>
                <p>Deixe um espaço para a comunidade aparecer enquanto você joga.</p>
              </div>
            </article>
            <article>
              <MessagesSquare size={25} />
              <div>
                <h3>Conversa e encontros</h3>
                <p>Transforme os nomes do chat em personagens que dividem o mesmo mundo.</p>
              </div>
            </article>
            <article>
              <Heart size={25} />
              <div>
                <h3>Lives com apoio da comunidade</h3>
                <p>Combine o palco, o QR Pix e os alertas em uma única fonte no OBS.</p>
              </div>
            </article>
          </div>
        </section>

        {/* SEÇÃO 4: DEPOIMENTOS DE CRIADORES */}
        <section id="depoimentos" className="creator-testimonials">
          <div className="feature-heading">
            <span className="ice-label">
              <Quote size={17} /> QUEM TESTOU NÃO LARGA MAIS
            </span>
            <h2>Aprovado por quem ama<br />uma live cheia de energia.</h2>
            <p>
              Streamers de games, podcasts e bate-papo contam como a ilha 3D resgatou o prazer, o engajamento e a zoeira de abrir uma transmissão ao vivo.
            </p>
          </div>

          <div className="testimonials-grid">
            <article className="testimonial-card">
              <Quote className="quote-icon" size={32} />
              <p className="test-quote">
                &ldquo;Minha live costumava ser um monólogo. No primeiro dia que coloquei a ilha no OBS, o chat bateu recorde absoluto de comentários! Passei 2 horas rindo dos bonequinhos interagindo em dupla. Fazer live voltou a ser divertido de verdade.&rdquo;
              </p>
              <div>
                <div className="test-author">
                  <div className="author-avatar">LM</div>
                  <div className="author-info">
                    <strong>Lucas &quot;Frosty&quot; Mendes</strong>
                    <span>Streamer Gamer · 45k inscritos</span>
                  </div>
                </div>
                <div className="test-metric">
                  <TrendingUp size={13} /> +280% de comentários na live
                </div>
              </div>
            </article>

            <article className="testimonial-card">
              <Quote className="quote-icon" size={32} />
              <p className="test-quote">
                &ldquo;Fazer live interativa nunca foi tão divertido! Meus seguidores mais tímidos, que nunca falavam nada, agora mandam mensagem o tempo todo só para ver o personagem deles passeando pela cachoeira. Criou uma conexão única com o público.&rdquo;
              </p>
              <div>
                <div className="test-author">
                  <div className="author-avatar">CR</div>
                  <div className="author-info">
                    <strong>Camila &quot;Mila&quot; Rocha</strong>
                    <span>Just Chatting & Games · 32k inscritos</span>
                  </div>
                </div>
                <div className="test-metric">
                  <Users size={13} /> Retenção média triplicou
                </div>
              </div>
            </article>

            <article className="testimonial-card">
              <Quote className="quote-icon" size={32} />
              <p className="test-quote">
                &ldquo;O alerta de Pix sincronizado com as animações da ilha virou uma máquina de entretenimento. O pessoal doa só pra ver a festa na tela e zoar durante os momentos tensos. O clima da live mudou completamente pro melhor.&rdquo;
              </p>
              <div>
                <div className="test-author">
                  <div className="author-avatar">RS</div>
                  <div className="author-info">
                    <strong>Rodrigo &quot;Kappão&quot; Silva</strong>
                    <span>FPS & Competitivo · 80k inscritos</span>
                  </div>
                </div>
                <div className="test-metric">
                  <Heart size={13} /> Apoios Pix aumentaram 3x
                </div>
              </div>
            </article>
          </div>
        </section>

        {/* FAQ */}
        <section className="creator-faq">
          <h2>Antes de dar o play</h2>
          {[
            ['Funciona no TikTok?', 'Por enquanto, a conexão disponível é com o chat público do YouTube. TikTok ainda não está disponível no estúdio.'],
            ['Preciso instalar o palco?', 'Você configura a cena pelo navegador. Para transmitir, use o OBS Studio e adicione seu link como fonte Navegador.'],
            ['Todo mundo que assiste aparece?', 'Aparecem os autores que escrevem no chat público. Espectadores silenciosos não são identificados. O palco recebe até 10 personagens por vez.'],
            ['Posso testar antes de transmitir?', 'Sim! Crie sua conta e use a aba Testes do estúdio para experimentar personagens, animações e alertas antes de transmitir.'],
            ['E o Pix e minhas configurações?', 'O estúdio mantém o QR Pix, os alertas de apoio e o histórico de configurações. Para receber pagamentos, configure sua própria conta Mercado Pago.'],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>
                {q}
                <ChevronDown size={18} />
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </section>

        {/* SEÇÃO 5: DESAFIO DOS 5 MINUTOS - DIVERSÃO INSTANTÂNEA */}
        <section id="desafio" className="fun-guarantee">
          <div className="guarantee-banner">
            <div className="guarantee-left">
              <span className="ice-label">
                <Timer size={17} /> DESAFIO DIVERSÃO INSTANTÂNEA
              </span>
              <h2>5 minutos para mudar<br />suas lives para sempre.</h2>
              <p>
                Você não precisa ser um expert em tecnologia nem ter um computador pesado. Leve a ilha para o OBS hoje mesmo e descubra por que fazer live interativa nunca foi tão divertido e viciante!
              </p>
              <ul className="guarantee-checklist">
                <li>
                  <ShieldCheck size={20} /> 100% gratuito para criar conta e montar o cenário
                </li>
                <li>
                  <ShieldCheck size={20} /> Levíssimo no OBS: zero queda de FPS nos seus jogos
                </li>
                <li>
                  <ShieldCheck size={20} /> Conexão direta com o chat público do YouTube em segundos
                </li>
                <li>
                  <ShieldCheck size={20} /> Gargalhadas garantidas logo na primeira mensagem do chat
                </li>
              </ul>
            </div>

            <div className="guarantee-card">
              <span className="guarantee-badge">
                <Sparkles size={15} /> CONFIGURAÇÃO RELÂMPAGO
              </span>
              <div className="guarantee-steps">
                <div className="guarantee-step">
                  <b>1</b>
                  <div>
                    <h4>Crie seu Estúdio</h4>
                    <p>Cadastre-se grátis e escolha suas animações favoritas.</p>
                  </div>
                </div>
                <div className="guarantee-step">
                  <b>2</b>
                  <div>
                    <h4>Copie o Link para o OBS</h4>
                    <p>Cole como fonte Navegador com apenas um clique.</p>
                  </div>
                </div>
                <div className="guarantee-step">
                  <b>3</b>
                  <div>
                    <h4>Abra a Live & Divirta-se</h4>
                    <p>O chat comenta e o mundo 3D ganha vida imediatamente!</p>
                  </div>
                </div>
              </div>
              <a href="/cadastro" className="ice-button" style={{ width: '100%' }}>
                Aceitar o Desafio & Começar <ArrowUpRight size={19} />
              </a>
            </div>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="creator-final-cta">
          <span className="ice-label">SUA COMUNIDADE TEM LUGAR AQUI</span>
          <h2>Prepare a ilha.<br />Convide a sua galera.</h2>
          <p>Crie sua conta, teste a cena e leve seu mundo para a próxima live no YouTube.</p>
          <a href="/cadastro" className="ice-button">
            Criar meu estúdio <ArrowUpRight size={20} />
          </a>
        </section>
      </main>

      <footer className="creator-footer">
        <a className="wordmark" href="/">
          <Radio /> LIVE GAMER <b>3D</b>
        </a>
        <span>Seu chat. Sua squad. Seu mundo.</span>
        <small>Personagens Kenney · CC0</small>
      </footer>
    </div>
  );
}
