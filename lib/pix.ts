import QRCode from 'qrcode';
import { database } from '@/db';
import { decrypt } from './security';
import type { Profile } from './profiles';
export function money(value:unknown) {
 const n=typeof value==='string'||typeof value==='number'?Number(value):NaN;
 if(!Number.isFinite(n)||n<.01||n>1000000)throw new Error('Informe um valor entre R$ 0,01 e R$ 1.000.000,00.');
 return (Math.round((n+Number.EPSILON)*100)/100).toFixed(2);
}
const first=(r:any)=>r?.transactions?.payments?.[0] || r;
async function request(token:string,method:string,path:string,body?:any,key?:string) {
 let r:Response;
 try {r=await fetch('https://api.mercadopago.com'+path,{method,redirect:'error',signal:AbortSignal.timeout(12000),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(key?{'X-Idempotency-Key':key}:{})},body:body?JSON.stringify(body):undefined});}
 catch {throw new Error('Não foi possível acessar o Mercado Pago. Tente novamente.');}
 if(!r.ok)throw new Error(r.status===401||r.status===403?'O Mercado Pago recusou o Access Token. Confira suas credenciais.':r.status===429?'O Mercado Pago limitou as consultas. Aguarde alguns segundos.':r.status<500?'O Mercado Pago recusou a cobrança. Confira o e-mail, o token e sua chave Pix cadastrada.':'O Mercado Pago está temporariamente indisponível.');
 try {return await r.json() as any;}catch{throw new Error('O Mercado Pago devolveu uma resposta inválida.');}
}
export async function qrImage(text:string) {return (await QRCode.toDataURL(text,{errorCorrectionLevel:'M',margin:4,scale:10})).split(',')[1];}
export async function pollPix(state:any,p:Profile,persist:(next:any)=>Promise<void>) {
 if(!p.mp_secret)return {};
 const token=await decrypt(p.mp_secret);
 if(state.charge) {
  const charge=state.charge;
  const resource=await request(token,'GET','/v1/'+charge.kind+'/'+encodeURIComponent(charge.id));
  const payment=first(resource);
  const statuses=[resource.status,resource.status_detail,payment?.status,payment?.status_detail].map(x=>String(x||'').trim().toLowerCase());
  const paid=statuses.some(x=>['approved','processed','accredited'].includes(x));
  const expired=Date.now()>=charge.expires_at||statuses.some(x=>['canceled','cancelled','expired','rejected','refunded'].includes(x));
  if(paid) {
   let name='Apoiador via Pix';
   for(const payer of [payment?.payer,resource.payer]) {if(payer?.first_name && String(payer.first_name).toUpperCase()!=='APRO'){name=[payer.first_name,payer.last_name].filter(Boolean).join(' ').trim().slice(0,32);break;}}
   const donation={donor_name:name,amount:Number(money(payment?.transaction_amount||payment?.amount||resource.total_amount||charge.amount)),currency:'BRL',message:'Doação recebida via Pix'};
   await database().prepare('INSERT OR IGNORE INTO events (id, user_id, payload, created_at) VALUES (?, ?, ?, ?)').bind(p.user_id+':pix:'+charge.id,p.user_id,JSON.stringify(donation),Date.now()).run();
  }
  if(paid||expired) {state.charge=null;state.pending=null;await persist(state);}
  else return {...state,error:null,charge:{...charge,status:resource.status||payment.status||'pending'},updated_at:Date.now()};
 }
 if(!state.pending){state.pending={key:crypto.randomUUID(),reference:'live-gamer-'+crypto.randomUUID(),expires:new Date(Date.now()+30*60000).toISOString()};await persist(state);}
 const legacy=token.startsWith('TEST-'),kind=legacy?'payments':'orders';
 const body=legacy?{transaction_amount:Number(p.mp_amount),description:'Doação Live Gamer 3D',payment_method_id:'pix',date_of_expiration:state.pending.expires,external_reference:state.pending.reference,payer:{email:p.mp_email,first_name:'APRO'}}:{type:'online',total_amount:p.mp_amount,external_reference:state.pending.reference,processing_mode:'automatic',transactions:{payments:[{amount:p.mp_amount,payment_method:{id:'pix',type:'bank_transfer'},expiration_time:'PT30M'}]},payer:{email:p.mp_email}};
 const resource=await request(token,'POST','/v1/'+kind,body,state.pending.key);
 const payment=first(resource), qr=legacy?resource.point_of_interaction?.transaction_data:payment?.payment_method;
 let image=qr?.qr_code_base64?.replace(/^data:image\/[^;]+;base64,/,'');
 if(qr?.qr_code)image=await qrImage(qr.qr_code);
 if(!resource.id||!image)throw new Error('O Mercado Pago não devolveu um QR Code para a cobrança.');
 return {charge:{id:String(resource.id),kind,amount:p.mp_amount,qr_code_base64:image,status:resource.status||'created',expires_at:Date.parse(state.pending.expires)},pending:null,error:null,updated_at:Date.now()};
}
export function publicPix(state:any,active:boolean) {
 const c=state?.charge;
 return {enabled:!!(active&&c),charge_id:active&&c?c.id:null,amount:active&&c?Number(c.amount):0,currency:'BRL',expires_at:active&&c?new Date(c.expires_at).toISOString():null,qr_code_base64:active&&c?c.qr_code_base64:null,error:active?state?.error||null:null};
}
