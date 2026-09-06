export function videoId(source:string) {
 if (/^[A-Za-z0-9_-]{11}$/.test(source)) return source;
 try {const url=new URL(source); if (!['www.youtube.com','youtube.com','m.youtube.com','youtu.be'].includes(url.hostname)) return null;
 const id=url.hostname==='youtu.be'?url.pathname.slice(1).split('/')[0]:url.pathname.startsWith('/live/')?url.pathname.split('/')[2]:url.pathname==='/watch'?url.searchParams.get('v'):null;
 return id && /^[A-Za-z0-9_-]{11}$/.test(id)?id:null;} catch{return null;}
}
export function trustedImage(value:string) {
 try { const u=new URL(value); return u.protocol==='https:' && ['ggpht.com','googleusercontent.com'].some(h=>u.hostname===h || u.hostname.endsWith('.'+h)); } catch {return false;}
}
export function initialData(html:string) {
 for(const marker of ['window["ytInitialData"]','var ytInitialData']) {
  const pos=html.indexOf(marker); if(pos<0)continue;
  const source=html.slice(html.indexOf('=',pos)+1).trimStart();
  let depth=0,quoted=false,escaped=false;
  for(let i=0;i<source.length;i++) {const c=source[i]; if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}if(c==='"')quoted=true;else if(c==='{')depth++;else if(c==='}' && --depth===0){try{return JSON.parse(source.slice(0,i+1));}catch{break;}}}
 }
 throw new Error('O YouTube não forneceu o chat público. Confira se a live está ao vivo e o chat está habilitado.');
}
function continuation(chat:any) {
 for(const c of chat.continuations || []) for(const v of Object.values(c) as any[]) if(v?.continuation) return {continuation:v.continuation,wait_ms:Math.max(1500,Math.min(Number(v.timeoutMs)||5000,15000))};
 throw new Error('O YouTube encerrou ou ocultou o chat desta live.');
}
const headers={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36','Accept-Language':'pt-BR,pt;q=0.9,en;q=0.8'};
export async function pollChat(state:any,source:string) {
 const id=videoId(source); if(!id)throw new Error('Informe o link público da live do YouTube.');
 let chat:any, apiKey=state.apiKey, version=state.version;
 const publicUrl='https://www.youtube.com/live_chat?v='+id+'&embed_domain=www.youtube.com';
 if (!state.continuation || state.error) {
  const response=await fetch(publicUrl,{headers,signal:AbortSignal.timeout(18000)});
  if(!response.ok)throw new Error('YouTube respondeu HTTP '+response.status+' ao ler o chat público.');
  const html=await response.text(); const payload=initialData(html); chat=payload.contents?.liveChatRenderer;
  if(!chat && payload.contents?.messageRenderer)throw new Error('O YouTube informa que o chat está desativado ou indisponível para esta transmissão.');
  apiKey=html.match(/"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/)?.[1];
  version=html.match(/"INNERTUBE_CLIENT_VERSION"\s*:\s*"([^"]+)"/)?.[1];
  if(!chat || !apiKey || !version)throw new Error('O chat desta live não está disponível publicamente agora.');
 } else {
  const response=await fetch('https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key='+encodeURIComponent(apiKey),{method:'POST',signal:AbortSignal.timeout(18000),headers:{...headers,'Content-Type':'application/json',Origin:'https://www.youtube.com','X-YouTube-Client-Name':'1','X-YouTube-Client-Version':version},body:JSON.stringify({context:{client:{clientName:'WEB',clientVersion:version,originalUrl:publicUrl}},continuation:state.continuation})});
  if(!response.ok)throw new Error('YouTube respondeu HTTP '+response.status+' ao ler o chat público.');
  chat=(await response.json() as any).continuationContents?.liveChatContinuation;
  if(!chat)throw new Error('O YouTube encerrou ou ocultou o chat desta live.');
 }
 const next=continuation(chat); const people:any[]=state.people||[], seen:string[]=state.seen||[]; let sequence=state.sequence||0;
 for(const action of chat.actions||[]) {
  const item=action.addChatItemAction?.item; if(!item)continue;
  const renderer=Object.entries(item).find(([name,value]:any)=>name.endsWith('Renderer')&&value?.authorExternalChannelId)?.[1] as any;
  if(!renderer || (renderer.id && seen.includes(renderer.id)))continue;
  if(renderer.id)seen.push(renderer.id);
  const name=typeof renderer.authorName==='string'?renderer.authorName:renderer.authorName?.simpleText || renderer.authorName?.runs?.map((x:any)=>x.text||'').join('');
  if(!name)continue;
  const icons=(renderer.authorBadges||[]).map((b:any)=>Object.values(b).map((v:any)=>v?.icon?.iconType||'').join('')).join(' ');
  const role=icons.includes('OWNER')?'criador':icons.includes('MODERATOR')?'moderador':/SPONSOR|MEMBER/.test(icons)?'membro':'participante';
  const photo=[...(renderer.authorPhoto?.thumbnails||[])].reverse().find((x:any)=>trustedImage(x.url))?.url||null;
  let person=people.find(x=>x.channel===renderer.authorExternalChannelId);
  if(!person) {if(people.length>=10)people.splice(people.reduce((i,p,j,a)=>p.last_seen<a[i].last_seen?j:i,0),1);person={id:'avatar-'+(++sequence),channel:renderer.authorExternalChannelId,messages:0};people.push(person);}
  Object.assign(person,{display_name:String(name).slice(0,32),role,messages:person.messages+1,last_seen:Date.now(),photo});
 }
 return {...next,apiKey,version,people,seen:seen.slice(-300),sequence,error:null,updated_at:Date.now()};
}
export function publicParticipants(people:any[]) {return people.map(({id,display_name,role,messages,photo})=>({id,display_name,role,messages,profile_image_available:!!photo}));}
