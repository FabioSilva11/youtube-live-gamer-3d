# Live Gamer 3D

Painel local em **Python/FastAPI + Three.js** para uma live no YouTube: cada pessoa que envia uma mensagem ao chat ao vivo aparece como um pequeno avatar 3D identificado pelo seu **nome público**.

![Prévia do Live Gamer 3D](assets/live-gamer-3d-thumbnail.png)

> O YouTube não disponibiliza pela API de Live Chat a lista de espectadores que só assistem. Por isso este projeto não tenta identificar, rastrear ou armazenar visitantes silenciosos, IPs, mensagens ou dados privados. Ele trabalha apenas com autores públicos que efetivamente participam do chat.

## O que está pronto

- Palco Three.js responsivo em um mundo de primavera com relevo suave, lago animado, nuvens, caminho, pedras, arbustos, flores coloridas e árvores amareladas. Ele usa 18 modelos 3D CC0 do pacote Kenney já presente neste computador e mantém um avatar geométrico de reserva.
- Atualização em tempo real por WebSocket; um autor tem um só avatar, mesmo mandando várias mensagens.
- Caminhada esquelética real dos GLBs, exploração da ilha e interações em pares: os personagens percorrem pontos variados do mapa, aproximam-se, preservam espaço pessoal, encaram-se e alternam gestos sociais.
- Entradas configuráveis: apresentação individual, queda suave, portal giratório ou chegada direta. Saídas: caminhada, subida, portal ou desaparecimento imediato.
- Ranking dos cinco autores mais ativos dentro do próprio canvas transmitido, com a foto pública do perfil quando disponível e a inicial como reserva.
- Leitura local do chat público a partir do link da live, sem chave de API, cookies ou login. O leitor usa a continuação pública do próprio chat e respeita o intervalo indicado pelo YouTube.
- Modo de demonstração com botões separados para testar a entrada e a saída de um avatar sem limpar os demais.
- Captura ao vivo do canvas Three.js via `canvas.captureStream()` + FFmpeg + RTMPS. A imagem transmitida é o próprio palco onde os avatares aparecem; não há arquivo de vídeo de origem.
- Saída única para **PC 16:9 (1280 × 720)**, com câmera de captura independente da prévia para manter mapa e ranking completos, legíveis e sem compressão.
- Monitor de entrega que informa no painel quando o FFmpeg ou a conexão com o YouTube apresentam erro.

## Requisitos

- Python 3.11 ou superior.
- FFmpeg instalado e disponível no `PATH` para transmitir ao YouTube.
- Navegador com WebGL, `canvas.captureStream()` e `MediaRecorder`.

## Rodar localmente

No PowerShell, dentro desta pasta:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Abra [http://127.0.0.1:8000](http://127.0.0.1:8000). Sem configurar nada, use **Teste visual** para adicionar participantes fictícios.

## Ligar o chat real

1. Cole no painel o link público da live, por exemplo `https://www.youtube.com/live/mlKXjGTENNw`.
2. Opcionalmente, defina `YOUTUBE_LIVE_URL` no `.env` para conectar esse chat na inicialização.
3. Quando alguém escrever no chat público, o nome de exibição, a foto pública e o papel público (criador, moderador, membro ou participante) aparecerão no palco. A mensagem em si é descartada imediatamente.
4. Um participante permanece por 1 minuto após sua última mensagem e então caminha para fora. Nenhuma foto ou participante expirado é mantido no cache do navegador.

O leitor não acessa uma conta, não usa cookies e não consegue ler chat privado, bloqueado ou indisponível publicamente. Como a estrutura pública do YouTube pode mudar, o painel mostra um erro claro caso a leitura deixe de estar disponível.

## Enviar o palco 3D para o YouTube

1. Instale o [FFmpeg](https://ffmpeg.org/download.html) e deixe `ffmpeg` no `PATH`.
2. No YouTube Live Control Room, copie a URL **RTMPS** e gere/copIe uma chave de transmissão. Trate essa chave como senha: se vazar, redefina-a no YouTube Studio.
3. No `.env`, preencha `YOUTUBE_RTMPS_URL` e `YOUTUBE_STREAM_KEY`, ou cole somente a chave no formulário **Transmissão**. Nesse segundo caso, ela fica somente na memória do servidor e se perde quando ele é fechado.
4. Com o painel aberto, clique em **Iniciar transmissão**. O navegador captura em tempo real apenas o canvas Three.js do palco, envia os quadros ao servidor local e o FFmpeg os retransmite por RTMPS. Confirme a prévia no YouTube Studio antes de clicar em “Transmitir ao vivo”.
5. A saída é sempre **PC 16:9 em 1280 × 720**. O ranking e o mapa são renderizados dentro da área segura desse quadro.

Mantenha esta aba aberta durante a live: ela é o encoder da cena 3D. Os controles e o painel lateral não entram na imagem transmitida.

Os campos permanecem preenchidos depois de enviar os formulários, para facilitar novos testes e ajustes na mesma sessão.

## Limites de segurança e privacidade

- Não há lista de viewers silenciosos: isso não é um dado exposto pelo endpoint de chat.
- O app não persiste participantes, mensagens, IPs, cookies, imagens de perfil nem chaves de API; tudo some quando o servidor é parado ou o palco é limpo.
- Não publique esta interface em uma URL pública sem autenticação, HTTPS e uma revisão de segurança. Ela foi pensada para operar em `127.0.0.1`.
- Se a chave de transmissão foi mostrada ou enviada a alguém, redefina-a no Live Control Room imediatamente.

## Verificação

```powershell
python -m pytest -q
node --test tests/*.test.mjs
python -m compileall -q app
```

## Recursos de terceiros

Os 18 personagens são do pacote **Blocky Characters**, de [Kenney](https://kenney.nl/), distribuído sob **CC0 1.0**. A licença original está em `kenney_blocky-characters_20/License.txt`.

Referências: [embed de chat ao vivo do YouTube](https://support.google.com/youtube/answer/2474026) e [RTMPS no YouTube](https://support.google.com/youtube/answer/10364924).
