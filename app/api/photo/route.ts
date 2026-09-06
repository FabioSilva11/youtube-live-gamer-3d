import { database } from '@/db';
import { tokenProfile } from '@/lib/profiles';
import { trustedImage } from '@/lib/youtube';
export async function GET(request:Request) {
 const url=new URL(request.url),p=await tokenProfile(url.searchParams.get('token')||'');
 if(!p)return new Response(null,{status:404});
 const row=await database().prepare('SELECT state FROM runtimes WHERE user_id = ? AND kind = ?').bind(p.user_id,'chat').first<{state:string}>();
 const person=JSON.parse(row?.state||'{}').people?.find((x:any)=>x.id===url.searchParams.get('id'));
 if(!person?.photo || !trustedImage(person.photo))return new Response(null,{status:404});
 try {
  const response=await fetch(person.photo,{redirect:'error',signal:AbortSignal.timeout(8000)});
  const type=response.headers.get('content-type')||'';
  if(!response.ok||!type.startsWith('image/')||Number(response.headers.get('content-length')||0)>1000000)return new Response(null,{status:502});
  const reader=response.body!.getReader(),chunks:Uint8Array[]=[];let size=0;
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>1000000){await reader.cancel();return new Response(null,{status:502});}chunks.push(value);}
  const image=new Uint8Array(size);let offset=0;for(const chunk of chunks){image.set(chunk,offset);offset+=chunk.length;}
  return new Response(image,{headers:{'Content-Type':type,'Cache-Control':'private, max-age=60','X-Content-Type-Options':'nosniff'}});
 }catch{return new Response(null,{status:502});}
}
