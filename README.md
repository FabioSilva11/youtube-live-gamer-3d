# Live Gamer 3D — plataforma web

Página de apresentação estática, cadastro e login por e-mail/senha, estúdio individual, histórico reutilizável e palco 3D para fonte Navegador do OBS.

## Biomas independentes

Após entrar, **/dashboard** apresenta a Área do Criador e sua galeria de biomas. Cada card abre diretamente o estúdio do mundo em **/studio/fantasy** ou **/studio/minecraft**. A rota mantém o bioma como fonte de verdade, inclusive após atualizar a página; um identificador inválido volta para a biblioteca. O endereço antigo **/estudio** também retorna para a biblioteca, enquanto **/studio** recupera o último bioma válido salvo na conta. **/perfil** permite editar nome e identidade do canal e **/configuracoes** reúne os dados da conta. Todas essas páginas exigem sessão.

O Dashboard e o Estúdio usam layouts independentes. O menu administrativo contém Meus biomas, Meu perfil e Configurações; dentro do Estúdio, o mundo Three.js ocupa a viewport disponível e as ferramentas ficam em um inspector recolhível. Em **Estúdio → Cena**, escolha **Horizontal (16:9)** ou **Vertical (9:16)** e salve. A orientação define a saída OBS e sua moldura de referência, sem limitar o tamanho do editor. A câmera vertical recua, o ranking mostra somente os três primeiros e o Pix ocupa um canto compacto. Contas e configurações antigas usam Fantasia e horizontal.

O palco usa módulos ES em `public/static/biomes/`, mantendo a estrutura de distribuição existente. `fantasy/FantasyBiome.js` contém a ilha original e sua animação ambiental. `minecraft/` contém o mundo voxel, catálogo de blocos, personagens cúbicos, navegação e construção. `shared/` contém a identidade dos participantes, os efeitos Pix e a entrada/saída. Só o bioma ativo atualiza sua simulação; trocar de ambiente conserva a construção em memória. Recarregar o palco reinicia a simulação, e cada instância do OBS/prévia tem seu próprio andamento.

Até 10 participantes se distribuem inicialmente em equipes de até quatro. Quem termina ajuda nos outros canteiros, podendo reunir todos na última obra. Os personagens montam os andaimes, constroem por camadas e caminham em uma grade com obstáculos. Uma barreira global espera todas as obras da rodada ficarem prontas antes da interação e da desmontagem, feita em um canteiro por vez. Os andaimes também são removidos bloco por bloco; só depois todos iniciam a próxima rodada. Reservas evitam duplicação e saídas liberam as tarefas. A desmontagem preserva o caminho de descida.

Os blueprints editáveis ficam em `public/static/biomes/minecraft/structures/*.json`: `{id, name, version, blocks: [{x, y, z, type}]}`. As coordenadas são inteiras e locais; o gerenciador soma a origem do canteiro. Uma unidade equivale a 0,7 unidade Three.js. Os modelos iniciais ocupam 5 × 5 blocos e até 8 camadas. Modelos maiores exigem rever os canteiros e os acessos de trabalho. Não há geração aleatória de estruturas nem dependência de assets do Minecraft.

Valide a simulação com `node --test tests/voxel.test.mjs tests/voxel-round.test.mjs tests/orientation.test.mjs` e a integração com `node tests/dashboard-api.mjs` (servidor local ativo e migrações até `0004` aplicadas). Os testes cobrem caminhada, equipes de 1/5/10 personagens, rodadas com 3/5/10 canteiros, andaimes, reservas, saída, orientação, perfil e histórico. A biblioteca inicial inclui grass, dirt, stone, wood, oak_planks/planks, glass, leaves, water, sand, brick e cobblestone.

## Desenvolvimento

Node.js 22.13+ e npm. Instale com `npm ci`. Use `npm run dev` e abra http://localhost:3000.

O backend JavaScript/TypeScript é executado no ambiente Workers do Sites. A aplicação não roda FFmpeg na hospedagem: o OBS no computador do criador transmite para o YouTube.

## Dados e segurança

D1 guarda contas, sessões com token hash, configurações e estados de polling. Senhas usam bcrypt (custo 12). Cookies são HttpOnly/SameSite=Lax e Secure em HTTPS. Consultas são parametrizadas e vinculadas ao dono da conta. O link aleatório do palco permite apenas sua visualização; trate-o como um link privado compartilhável.

`APP_ENCRYPTION_KEY` deve ser um segredo base64 de 32 bytes configurado no Sites. Não rotacione sem migrar os tokens Mercado Pago já criptografados. Nunca coloque credenciais no código ou no link OBS.

O histórico salva cada configuração sem sobrescrever versões anteriores. Guarda nome, canal, live, qualidade e animações; não copia credenciais, cobranças ou participantes. Restaurar não conecta o chat automaticamente. A interface mostra as 100 versões mais recentes.

## Banco e publicação

As migrações ficam em `drizzle/`. Após `npm run build`, no desenvolvimento aplique cada SQL novo com `npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/ARQUIVO.sql`. O empacotamento Sites inclui as migrações para produção. Não publique `.wrangler`, bancos locais ou arquivos `.env`.

## Testes

`npx tsc --noEmit`; `node tests/pix.test.mjs`; `node tests/smoke.mjs` com servidor local ativo. Smoke cria contas QA isoladas e testa sessão, histórico, isolamento, demonstração e a tentativa de leitura do chat público. Não realiza pagamentos nem transmite vídeo. `TEST_ORIGIN` permite testar a publicação.

O leitor de chat público não usa chave oficial do YouTube e depende do HTML/API interna: poderá falhar se o YouTube alterar o formato, desativar o chat ou restringir acesso do datacenter. Não contorna login ou restrições. Somente autores públicos são exibidos; não são identificados espectadores silenciosos nem armazenadas mensagens completas.

O QR demonstração é não pagável. O Pix real exige credenciais válidas da conta do criador e homologação com uma cobrança real. Consulte a [documentação oficial Pix/Orders](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-integration/pix). Polling e renovação acontecem enquanto estúdio ou palco estiver aberto, não em segundo plano sem espectadores. Recuperação de senha e verificação de e-mail ainda não estão implementadas.

## OBS

No estúdio copie o link, adicione fonte **Navegador**, largura 1280 e altura 720, 30 FPS (ou perfil econômico 854×480/24 FPS). Use Testes para avatares, alerta e QR não pagável. Iniciar transmissão é uma ação separada no OBS.

As imagens da página de vendas e da galeria são capturas reais dos biomas Three.js. `minecraft-real.png` registra uma rodada construída pela própria IA; `fantasy-real.png` registra a ilha original. O palco usa vegetação instanciada, vento e shaders de água animados. Personagens Kenney sob CC0; licenças acompanham os assets.
