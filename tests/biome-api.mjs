import assert from 'node:assert/strict';
const origin = process.env.TEST_ORIGIN || 'http://localhost:3000';
let cookie;
async function request(path, body) {
 const r = await fetch(origin + path, { method: body ? 'POST' : 'GET', headers: { origin, 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
 return { status: r.status, data: await r.json(), cookie: r.headers.get('set-cookie')?.split(';')[0] };
}
const account = await request('/api/auth/register', { name: 'Teste dos biomas', email: `biome-${Date.now()}@example.test`, password: `Biome!${crypto.randomUUID()}` });
assert.equal(account.status, 200); cookie = account.cookie;
const initial = (await request('/api/studio')).data; assert.equal(initial.profile.biome, 'fantasy');
const saved = await request('/api/studio', { ...initial.profile, action: 'save', biome: 'minecraft', title: 'Construção cooperativa' });
assert.equal(saved.status, 200, JSON.stringify(saved.data)); assert.equal(saved.data.profile.biome, 'minecraft'); assert.equal(saved.data.stage.biome, 'minecraft');
const id = saved.data.history[0].id; assert.equal(saved.data.history[0].config.biome, 'minecraft');
const obs = (await request('/api/stage?token=' + initial.profile.overlay_token)).data; assert.equal(obs.biome, 'minecraft');
assert.equal((await request('/api/studio', { ...initial.profile, action: 'save', biome: 'invalid' })).status, 422);
await request('/api/studio', { ...initial.profile, action: 'save', biome: 'fantasy' });
const restored = (await request('/api/studio', { action: 'restore', id })).data; assert.equal(restored.profile.biome, 'minecraft'); assert.equal(restored.stage.active, false);
const demo = (await request('/api/studio', { action: 'demo' })).data; assert.equal(demo.stage.participants.length, 5);
const pix = (await request('/api/studio', { action: 'test_donation' })).data; assert(pix.stage.events.some(e => e.amount === 10));
await request('/api/auth/logout', {});
console.log('PASS biome defaults, validation, save, OBS state, history restore, shared participants and Pix events');
