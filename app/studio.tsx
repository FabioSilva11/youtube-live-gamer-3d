'use client';
import {useState,useEffect,useRef} from 'react';
import {MessageCircle,MonitorPlay,Copy,Check,Settings2,Play,Square,QrCode,ExternalLink,LoaderCircle,PanelRightClose,PanelRightOpen,Move3D,Rotate3D,Focus} from 'lucide-react';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import StudioLayout from './studio-layout';
import type {BiomeDefinition} from '@/lib/biomes';
import {compositionKey,defaultSceneView,normaliseSceneComposition,type SceneComposition,type SceneView} from '@/lib/composition';
import SceneOverlayEditor from './scene-overlay-editor';
type User={name:string,email:string};
type Form={display_name:string,channel_url:string,live_source:string,quality:string,entry_animation:string,exit_animation:string,biome:string,orientation:string};
const defaults:Form={display_name:'',channel_url:'',live_source:'',quality:'normal',entry_animation:'spotlight',exit_animation:'walk',biome:'fantasy',orientation:'landscape'};
async function api(url:string,body?:unknown):Promise<any> {const r=await fetch(url,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});const data:any=await r.json();if(!r.ok)throw new Error(data.detail||'Não foi possível concluir.');return data;}
function Choice({label,value,onChange,options}:{label:string,value:string,onChange:(s:string)=>void,options:[string,string][]}) {return <div className="form-field"><span>{label}</span><Select value={value} onValueChange={v=>v&&onChange(String(v))}><SelectTrigger aria-label={label} className="full-width choice-trigger"><SelectValue>{options.find(x=>x[0]===value)?.[1]}</SelectValue></SelectTrigger><SelectContent>{options.map(([v,text])=><SelectItem key={v} value={v}>{text}</SelectItem>)}</SelectContent></Select></div>}
export default function Studio({user,biome}:{user:User,biome:BiomeDefinition}) {
 const biomeId=biome.id;
 const [profile,setProfile]=useState<any>(null),[stage,setStage]=useState<any>(null),[form,setForm]=useState<Form>({...defaults,biome:biomeId});
 const [notice,setNotice]=useState(''),[error,setError]=useState(''),[tab,setTab]=useState('live'),[copied,setCopied]=useState(false),[savedLives,setSavedLives]=useState<any[]>([]),[liveTitle,setLiveTitle]=useState('');
 const [payerEmail,setPayerEmail]=useState(''),[amount,setAmount]=useState('5.00');
 const [busy,setBusy]=useState(false);
 const pollBusy=useRef(false),frame=useRef<HTMLIFrameElement>(null);
 const [pendingAction,setPendingAction]=useState(''),[readyToken,setReadyToken]=useState<string|null>(null),[sceneFailed,setSceneFailed]=useState(false),[sceneAttempt,setSceneAttempt]=useState(0);
 const [inspectorOpen,setInspectorOpen]=useState(true);
 const [cameraMode,setCameraMode]=useState<'orbit'|'pan'>('orbit');
 const [sceneComposition,setSceneComposition]=useState<SceneComposition>(()=>normaliseSceneComposition(null));
 const compositionRef=useRef(sceneComposition);compositionRef.current=sceneComposition;
 useEffect(()=>{if(window.matchMedia('(max-width: 700px)').matches)setInspectorOpen(false)},[]);
 const token=profile?.overlay_token;
 const sceneKey=token?token+':'+sceneAttempt:null;
 const sceneReady=!!sceneKey&&readyToken===sceneKey;
 const chatConnected=!!stage?.active&&!stage?.error;
 const chatLabel=pendingAction==='connect'?'Conectando…':pendingAction==='disconnect'?'Desconectando…':stage?.error?'Falha na conexão':chatConnected?'Chat conectado':'Chat desconectado';
 const portrait=profile?.orientation==='portrait';
 const resolution=portrait?(profile?.quality==='fullhd'?'1080 × 1920':profile?.quality==='economy'?'480 × 854':'720 × 1280'):(profile?.quality==='fullhd'?'1920 × 1080':profile?.quality==='economy'?'854 × 480':'1280 × 720');
 const biomeName=biome.name;
 const origin=typeof window!=='undefined'?location.origin:'';
 const overlay=token?origin+'/static/index.html?token='+token:'';
 useEffect(()=>{
  if(!sceneKey)return;
  setSceneFailed(false);
  const timer=setTimeout(()=>setSceneFailed(true),45000);
  const receive=(event:MessageEvent)=>{if(event.origin!==location.origin||event.source!==frame.current?.contentWindow)return;if(event.data?.type==='stage-ready'){clearTimeout(timer);setReadyToken(sceneKey);setSceneFailed(false);}else if(event.data?.type==='scene-camera-change'&&event.data.camera){const key=compositionKey(biomeId,profile?.orientation);const current=compositionRef.current;commitComposition({...current,views:{...current.views,[key]:{...(current.views[key]||defaultSceneView(profile?.orientation)),camera:event.data.camera}}});}};
  window.addEventListener('message',receive);
  return()=>{clearTimeout(timer);window.removeEventListener('message',receive);};
 },[sceneKey,biomeId,profile?.orientation]);
 const sendToFrame=(data:any)=>{try{frame.current?.contentWindow?.postMessage(data,'*');}catch{}};
 const populate=(data:any)=>{const composition=normaliseSceneComposition(data.profile.scene_composition);compositionRef.current=composition;setSceneComposition(composition);setProfile(data.profile);setStage(data.stage);setForm({...defaults,...data.profile,biome:biomeId});setPayerEmail(data.profile.mp_email||'');setAmount(Number(data.profile.mp_amount||5).toFixed(2));setSavedLives(data.history||[]);if(data.stage)sendToFrame({type:'stage-state',state:data.stage});};
 useEffect(()=>{
  let active=true,first=true;
  async function poll(){if(pollBusy.current)return;pollBusy.current=true;try{const data=await api('/api/studio');if(active){if(first){populate(data);first=false;}else{setStage(data.stage);setProfile(data.profile);if(data.stage)sendToFrame({type:'stage-state',state:data.stage});}}}catch(e){if(active)setError((e as Error).message);}finally{pollBusy.current=false;}}
  poll();const timer=setInterval(poll,5000);return()=>{active=false;clearInterval(timer)};
 },[user,biomeId]);
 async function action(name:string,extra:any={}) {
  setBusy(true);setPendingAction(name);setError('');setNotice('');
  try {const data=await api('/api/studio',{action:name,...extra});populate(data);setNotice(name==='connect'?(data.stage?.error?'Não foi possível conectar ao chat. Confira o erro abaixo.':'Chat conectado. Aguardando mensagens da sua comunidade.'):name==='disconnect'?'Chat desconectado.':name==='demo_qr'?'QR de demonstração visível por 60 segundos. Não é uma cobrança.':name==='test_donation'?'Alerta de teste enviado ao palco.':'Alteração salva.');return data;}
  catch(e){setError((e as Error).message);throw e;}
  finally{setBusy(false);setPendingAction('');}
 }
 const run=(name:string,extra:any={})=>{void action(name,extra).catch(()=>{});};
 async function persistComposition(next:SceneComposition){try{const data=await api('/api/studio',{action:'save_composition',scene_composition:next});const saved=normaliseSceneComposition(data.profile.scene_composition);compositionRef.current=saved;setSceneComposition(saved);setProfile(data.profile);setStage(data.stage);setSavedLives(data.history||[]);sendToFrame({type:'stage-state',state:data.stage});setNotice('Composição da cena salva.');}catch(e){setError((e as Error).message);}}
 function previewComposition(next:SceneComposition){compositionRef.current=next;setSceneComposition(next);sendToFrame({type:'scene-composition-preview',scene_composition:next});}
 function commitComposition(next:SceneComposition){previewComposition(next);void persistComposition(next);}
 const activeCompositionKey=compositionKey(biomeId,profile?.orientation);
 const activeView=sceneComposition.views[activeCompositionKey]||defaultSceneView(profile?.orientation);
 function updateActiveView(view:SceneView,commit=false){const next={...compositionRef.current,views:{...compositionRef.current.views,[activeCompositionKey]:view}};if(commit)commitComposition(next);else previewComposition(next);}
 async function copyLink(){try{await navigator.clipboard.writeText(overlay);setCopied(true);setTimeout(()=>setCopied(false),2500);}catch{setError('Selecione e copie o link do palco abaixo.');}}
 function field(key:keyof Form,value:string){setForm(f=>({...f,[key]:value}));if(key==='entry_animation'||key==='exit_animation')sendToFrame({type:'update-settings',[key]:value});}
 useEffect(()=>{
  const context=(document as any).modelContext;if(!context?.registerTool)return;
  const controller=new AbortController();
  Promise.resolve(context.registerTool({name:'test_stage',title:'Testar palco',description:'Adiciona participantes de demonstração ao palco da conta atual, sem transmitir ou gerar cobrança.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},async execute(input:any){if(!input||Object.keys(input).length)throw new Error('Envie um objeto vazio.');const data=await action('demo');return {participants:data.stage.participants.length};}},{signal:controller.signal})).catch(()=>{});
  return()=>controller.abort();
 },[user]);

 return <StudioLayout biomeName={biomeName} chatLabel={chatLabel} chatState={chatConnected?'is-connected':stage?.error?'is-error':''} actions={<>
   <button className="studio-icon-btn" onClick={copyLink} disabled={!token} aria-label="Copiar link OBS" title="Copiar link OBS">{copied?<Check size={16}/>:<Copy size={16}/>}<span>OBS</span></button>
   <a className="studio-icon-btn" href={overlay||'#'} target="_blank" rel="noreferrer" aria-label="Abrir prévia do palco" title="Abrir prévia do palco"><ExternalLink size={16}/><span>Prévia</span></a>
   <button className="studio-icon-btn" onClick={()=>setInspectorOpen(v=>!v)} aria-controls="studio-inspector" aria-expanded={inspectorOpen} aria-label={inspectorOpen?'Recolher configurações':'Abrir configurações'} title={inspectorOpen?'Recolher configurações':'Abrir configurações'}>{inspectorOpen?<PanelRightClose size={16}/>:<PanelRightOpen size={16}/>}<span>Config.</span></button>
  </>}>
  {/* ── Workspace ── */}
  <div className={'studio-workspace'+(inspectorOpen?' inspector-open':'')}>
   {/* ── Canvas / Preview ── */}
   <section className="studio-canvas-area">
    <div className="studio-preview-card">
     <div className="preview-top"><span><MonitorPlay size={17}/> {biomeId==='minecraft'?'BIOMA MINECRAFT':'BIOMA FANTASIA'}</span><span>{resolution} · FONTE PARA OBS</span></div>
     <div className={'studio-scene-container'+(portrait?' is-portrait':'')} aria-busy={!sceneReady}>
      {token&&<iframe key={sceneKey} ref={frame} title="Prévia interativa do palco 3D" src={'/static/index.html?token='+token} allow="autoplay" onLoad={()=>{sendToFrame({type:'editor-mode',enabled:true});sendToFrame({type:'camera-mode',mode:cameraMode});sendToFrame({type:'stage-ready-check'});if(stage)sendToFrame({type:'stage-state',state:stage});}}/>}
      <div className="studio-editor-label">VIEWPORT DO EDITOR</div>
      <div className="studio-camera-tools" aria-label="Controles da câmera"><button className={cameraMode==='orbit'?'is-active':''} onClick={()=>{setCameraMode('orbit');sendToFrame({type:'camera-mode',mode:'orbit'})}} title="Arrastar para girar"><Rotate3D size={15}/> Girar</button><button className={cameraMode==='pan'?'is-active':''} onClick={()=>{setCameraMode('pan');sendToFrame({type:'camera-mode',mode:'pan'})}} title="Arrastar para mover em todas as direções"><Move3D size={15}/> Mover</button><button onClick={()=>{const resetView:SceneView={ranking:activeView.ranking,pix:activeView.pix};updateActiveView(resetView,true);sendToFrame({type:'reset-camera'});}} title="Centralizar câmera"><Focus size={15}/></button></div>
      <div className="studio-frame-guide-wrap"><div className={'studio-frame-guide '+(portrait?'is-portrait':'is-landscape')}><span>Área visível no OBS · {portrait?'9:16':'16:9'}</span><SceneOverlayEditor view={activeView} onPreview={view=>updateActiveView(view)} onCommit={view=>updateActiveView(view,true)}/></div></div>
      {!sceneReady&&<div className="scene-loading" role="status">{sceneFailed?<><strong>O ambiente está demorando para carregar.</strong><button className="secondary-button" onClick={()=>setSceneAttempt(v=>v+1)}>Tentar novamente</button></>:<><LoaderCircle className="loading-spinner" size={30}/><strong>Carregando ambiente…</strong><span>Preparando o ambiente e os elementos do palco.</span></>}</div>}
     </div>
     <div className="preview-bottom"><MessageCircle size={17}/><span>{stage?.participants?.length?stage.participants.length+' participantes no palco':'Aguardando os primeiros participantes'}{stage?.pix?.enabled?' · QR Pix visível':''}</span></div>
    </div>
    {/* OBS card inline */}
    <div className="studio-obs-strip">
     <div className="overlay-link"><input aria-label="Link do palco para OBS" readOnly value={overlay} onFocus={e=>e.currentTarget.select()}/><button className="secondary-button" onClick={copyLink} disabled={!token}>{copied?<Check size={17}/>:<Copy size={17}/>} {copied?'Copiado':'Copiar'}</button></div>
    </div>
   </section>

   {/* ── Inspector ── */}
   {inspectorOpen&&<aside id="studio-inspector" className="studio-inspector">
    <div className="section-heading"><span className="eyebrow">CONFIGURAÇÕES</span><Settings2 size={18}/></div>
    <Tabs value={tab} onValueChange={v=>setTab(String(v))} className="tabs">
     <TabsList><TabsTrigger value="live">Live</TabsTrigger><TabsTrigger value="pix">Pix</TabsTrigger><TabsTrigger value="scene">Cena</TabsTrigger><TabsTrigger value="tests">Testes</TabsTrigger><TabsTrigger value="history">Histórico</TabsTrigger></TabsList>

     <TabsContent value="live"><h2>Prepare sua live</h2><p className="small-note">Use o link público da transmissão cujo chat vai aparecer no palco.</p><form onSubmit={e=>{e.preventDefault();run('save',{...form,biome:biomeId,title:liveTitle})}}><label className="form-field">Título desta configuração<input value={liveTitle} onChange={e=>setLiveTitle(e.target.value)} maxLength={100} placeholder="Ex.: Live de sexta · comunidade"/></label><label className="form-field">Nome do canal<input value={form.display_name} onChange={e=>field('display_name',e.target.value)} maxLength={64} required/></label><label className="form-field">Seu canal no YouTube<input type="url" value={form.channel_url} onChange={e=>field('channel_url',e.target.value)} placeholder="https://youtube.com/@seucanal"/></label><label className="form-field">Link da live<input value={form.live_source} onChange={e=>field('live_source',e.target.value)} placeholder="https://youtube.com/watch?v=…" required/></label><button disabled={busy||!profile} className="primary-button full-width">Salvar configuração</button></form><div className={'chat-status '+(chatConnected?'is-connected':stage?.error?'is-error':'')} role="status" aria-live="polite"><i/>{chatLabel}</div><div className="inline-actions"><button disabled={busy||!profile||( !stage?.active&&!profile?.live_source)} className="secondary-button full-width" onClick={()=>run(stage?.active?'disconnect':'connect')}>{pendingAction==='connect'||pendingAction==='disconnect'?<LoaderCircle size={15} className="loading-spinner"/>:stage?.active?<Square size={15}/>:<Play size={15}/>} {pendingAction==='connect'?'Conectando…':pendingAction==='disconnect'?'Desconectando…':stage?.active?'Desconectar chat':'Conectar chat'}</button></div><p className="small-note">Conectar o chat não inicia uma transmissão. O envio de vídeo é feito pelo OBS.</p></TabsContent>

     <TabsContent value="pix"><h2>Seu Pix na live</h2><p className="small-note">Configure sua conta Mercado Pago. O QR é renovado após aprovação ou expiração.</p><form onSubmit={e=>{e.preventDefault();const f=e.currentTarget;const t=(new FormData(f).get('access_token')||'').toString();void action('pix_configure',{access_token:t,amount:Number(amount),payer_email:payerEmail}).then(()=>f.reset()).catch(()=>{})}}><label className="form-field">Access Token do Mercado Pago<input name="access_token" type="password" autoComplete="off" required minLength={20} maxLength={500} placeholder={profile?.mp_configured?'Token protegido. Informe outro para alterar.':'APP_USR-…'}/></label><label className="form-field">Valor por doação (R$)<input type="number" min=".01" max="1000000" step=".01" value={amount} onChange={e=>setAmount(e.target.value)} required/></label><label className="form-field">E-mail da cobrança<input type="email" value={payerEmail} onChange={e=>setPayerEmail(e.target.value)} required/></label><button disabled={busy} className="primary-button full-width"><QrCode size={18}/>Ativar QR Pix</button></form>{stage?.pix?.error&&<p className="notice error" role="alert">{stage.pix.error}</p>}{profile?.mp_active&&<button disabled={busy} className="secondary-button full-width" onClick={()=>run('pix_disable')}>Desativar e remover token</button>}<p className="small-note">O token é criptografado no servidor. Nunca aparece no link do palco. Consultas a cada 5 segundos enquanto o estúdio ou o OBS estiver aberto.</p></TabsContent>

     <TabsContent value="scene"><h2>Seu mundo em cena</h2><form onSubmit={e=>{e.preventDefault();run('save',{...form,biome:biomeId,title:liveTitle})}}><Choice label="Formato da visualização" value={form.orientation} onChange={v=>field('orientation',v)} options={[['landscape','Horizontal · 16:9'],['portrait','Vertical · 9:16']]}/><p className="small-note">No vertical, o ranking mostra os 3 primeiros e o Pix fica compacto em um canto. A câmera é ajustada para manter o cenário visível.</p><Choice label="Qualidade no OBS" value={form.quality} onChange={v=>field('quality',v)} options={[['fullhd','1080p · 60 FPS'],['normal','720p · 30 FPS'],['economy','480p · 24 FPS']]}/><Choice label="Entrada dos avatares" value={form.entry_animation} onChange={v=>field('entry_animation',v)} options={[['spotlight','Apresentação individual'],['bounce','Pulo elástico'],['rise','Surgir do chão'],['twirl','Giro acrobático'],['drop','Queda suave'],['portal','Portal giratório'],['current','Entrada direta']]}/><Choice label="Saída dos avatares" value={form.exit_animation} onChange={v=>field('exit_animation',v)} options={[['walk','Caminhar para fora'],['rocket','Decolar como foguete'],['shrink','Encolher'],['twirl','Giro de despedida'],['float','Subir e sair'],['portal','Portal giratório'],['current','Saída imediata']]}/><button disabled={busy} className="primary-button full-width">Salvar cena</button></form><p className="small-note">Configure também a fonte Navegador do OBS para {resolution} ({portrait?'vertical':'horizontal'}).</p></TabsContent>

     <TabsContent value="tests"><h2>Confira antes de entrar</h2><p className="small-note">As demonstrações aparecem no seu link do OBS. Nenhum teste inicia uma live ou realiza pagamento.</p><div className="test-actions"><button disabled={busy} className="secondary-button full-width" onClick={()=>run('demo')}>Adicionar avatares de teste</button><button disabled={busy} className="secondary-button full-width" onClick={()=>run('clear_demo')}>Remover avatares de teste</button><button disabled={busy} className="secondary-button full-width" onClick={()=>run('test_donation')}>Testar alerta de doação</button><button disabled={busy||profile?.mp_active} className="secondary-button full-width" onClick={()=>run('demo_qr')}>Testar QR · sem cobrança</button></div><p className="small-note">O QR de demonstração aparece por 60 segundos e não pode receber pagamentos.</p></TabsContent>

     <TabsContent value="history"><h2>Suas lives salvas</h2><p className="small-note">Cada salvamento cria uma versão independente deste bioma. Reutilize a cena e o link do YouTube; o chat só conecta quando você quiser.</p>{savedLives.filter(item=>item.config.biome===biomeId).length?<div className="history-list">{savedLives.filter(item=>item.config.biome===biomeId).map(item=><article key={item.id}><span className="history-date">{new Date(item.created_at).toLocaleString('pt-BR')}</span><h3>{item.title}</h3><p>{item.config.live_source||'Cena sem live vinculada'}</p><span className="history-meta">{item.config.quality==='fullhd'?'1080p':item.config.quality==='economy'?'480p':'720p'} · {item.config.orientation==='portrait'?'Vertical':'Horizontal'} · {item.config.display_name}</span><button disabled={busy} className="secondary-button full-width" onClick={()=>{setLiveTitle(item.title);run('restore',{id:item.id,biome:biomeId});}}>Reutilizar configuração</button></article>)}</div>:<div className="empty-history">Seu histórico deste bioma começa ao salvar a primeira configuração.</div>}<p className="small-note">Exibimos as 100 versões mais recentes. Credenciais e cobranças Pix não são copiadas para o histórico.</p></TabsContent>
    </Tabs>
    {error&&<p className="notice error" role="alert">{error}</p>}
    {notice&&<p className="message-status" role="status">{notice}</p>}
    {!profile&&!error&&<p className="small-note">Carregando seu estúdio…</p>}
   </aside>}
  </div>

  {/* ── Status Bar ── */}
  <footer className="studio-statusbar">
   <span>{stage?.participants?.length||0} / 10 participantes</span>
   <span>{stage?.active&&!stage.error?'● Chat conectado':'○ Chat desconectado'}</span>
   <span>{stage?.pix?.demo?'Pix teste':stage?.pix?.enabled?'● Pix ativo':'○ Pix inativo'}</span>
   <span>{resolution}</span>
  </footer>
 </StudioLayout>;
}
