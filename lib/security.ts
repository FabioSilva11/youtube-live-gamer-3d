import { env } from 'cloudflare:workers';
export const json = (data: unknown, status = 200) => Response.json(data, {status, headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function checkOrigin(request: Request) {
 const origin = request.headers.get('origin');
 if (origin && origin !== new URL(request.url).origin) throw new Error('Origem não permitida.');
}
export function randomToken() { return Array.from(crypto.getRandomValues(new Uint8Array(32)), x=>x.toString(16).padStart(2,'0')).join(''); }
function bytes(value: string) { return Uint8Array.from(atob(value), x=>x.charCodeAt(0)); }
function base64(value: Uint8Array) { return btoa(String.fromCharCode(...value)); }
async function secretKey() {
 const value = (env as unknown as {APP_ENCRYPTION_KEY?:string}).APP_ENCRYPTION_KEY;
 if (!value) throw new Error('A proteção de credenciais Pix ainda não está configurada.');
 return crypto.subtle.importKey('raw', bytes(value), 'AES-GCM', false, ['encrypt','decrypt']);
}
export async function encrypt(value: string) {
 const iv = crypto.getRandomValues(new Uint8Array(12));
 const data = await crypto.subtle.encrypt({name:'AES-GCM',iv}, await secretKey(), new TextEncoder().encode(value));
 return base64(iv) + '.' + base64(new Uint8Array(data));
}
export async function decrypt(value: string) {
 const [iv, data] = value.split('.');
 return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(iv)},await secretKey(),bytes(data)));
}
