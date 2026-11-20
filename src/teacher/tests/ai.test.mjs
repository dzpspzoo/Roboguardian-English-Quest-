// Etap 2: plan AI w harmonogramie, klient ai.js i serwer server/worker.js (z atrapą Claude API, bez sieci).
import test from 'node:test';
import assert from 'node:assert/strict';
import { newToday, lessonMinutes, tired, planToday, introduce } from '../schedule.js';
import { COURSE, CONTRASTS } from '../curriculum.js';

const mem = {};
globalThis.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
const ai = await import('../ai.js');
const worker = (await import('../../../server/worker.js')).default;

test('newToday: domyślnie 3 nowe, plan AI zmniejsza dawkę, zaległe idą pierwsze', () => {
  const p = { id: 'x', teacher: { day: 1 } };
  const d1 = COURSE[0].items, d2 = COURSE[1].items;
  assert.deepEqual(newToday(p, COURSE, 0), d1.slice(0, 3));
  p.teacher.aiPlan = { newPerDay: 2 };
  // dzień 1 nieprzerobiony: najpierw jego zwroty
  assert.deepEqual(newToday(p, COURSE, 1), d1.slice(0, 2));
  for (const id of d1) introduce(p, id);
  assert.deepEqual(newToday(p, COURSE, 1), d2.slice(0, 2));
  assert.equal(planToday(p, COURSE).newIds.length <= 2, true);
});

test('lessonMinutes i tired z limitem z planu AI', () => {
  assert.equal(lessonMinutes({}), 12);
  assert.equal(lessonMinutes({ teacher: { aiPlan: { minutes: 8 } } }), 8);
  assert.equal(lessonMinutes({ teacher: { aiPlan: { minutes: 99 } } }), 12);
  assert.equal(tired([], 9 * 60e3, 8), true);
  assert.equal(tired([], 9 * 60e3), false);
});

test('ai.js: konfiguracja tylko w localStorage, analiza bez imienia', () => {
  const p = { id: 'x', name: 'Jaś', teacher: { day: 2 }, calibration: { finishedAt: 'T1', sections: { words: { n: 3, correct: 2, score: 0.67 } }, contrasts: { th_s_f: { n: 3, correct: 1 } }, context: { age: 10, name: 'Jaś' } } };
  assert.equal(ai.aiReady(p), false);
  ai.setAiConfig({ url: 'https://w.example.dev/', token: 'abc' });
  assert.equal(ai.aiConfig().url, 'https://w.example.dev');
  assert.equal(ai.aiReady(p), true);
  const inp = ai.analysisInput(p);
  assert.equal(JSON.stringify(inp).includes('Jaś'), false);
  assert.deepEqual(inp.contrasts, Object.keys(CONTRASTS));
  assert.match(inp.contrastInfo, /three_tree: three\/tree/);
  assert.equal(ai.aiAnalysisDue(p), true);
  p.teacher.ai = 'off';
  assert.equal(ai.aiReady(p), false);
});

/* ---------- serwer ---------- */
function kv() { const m = new Map(); return { get: async k => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); }, m }; }
const env = (extra = {}) => ({ ANTHROPIC_API_KEY: 'sk-test', GAME_TOKEN: 'tok', BUDGET_USD: '250', DAILY_USD: '2', RG_KV: kv(), ...extra });
const req = (path, body, token = 'tok') => new Request('https://w.example.dev' + path, {
  method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'X-Game-Token': token, Origin: 'https://dzpspzoo.github.io' }, body: body ? JSON.stringify(body) : undefined });
let sent = null;
function mockApi(out, usage = { input_tokens: 1000, output_tokens: 200 }) {
  globalThis.fetch = async (url, init) => {
    sent = { url, init, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ model: 'claude-opus-5-5', stop_reason: 'end_turn', usage, content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify(out) }] }), { status: 200 });
  };
}

test('worker: bez hasła gry 401, status liczy wydatki', async () => {
  const e = env();
  assert.equal((await worker.fetch(req('/status', null, 'zle'), e)).status, 401);
  const r = await (await worker.fetch(req('/status'), e)).json();
  assert.equal(r.budgetUsd, 250); assert.equal(r.spentUsd, 0);
});

test('worker /chat: structured output, model i nagłówki, koszt w KV', async () => {
  const e = env();
  mockApi({ reply: 'Hello, Guardian! Do you like cats?', reply_pl: 'Cześć, Strażniku! Lubisz koty?', understood: true, better: '', hint_pl: 'Powiedz: Yes albo No.', suggestions: ['Yes.', 'No.', 'Yes, I do.', 'extra'], end: false });
  const res = await worker.fetch(req('/chat', { topic: 'animals', known: ['Hello!', 'Yes.'], history: [], child: '', turn: 1, maxTurns: 2 }), e);
  assert.equal(res.status, 200);
  const o = await res.json();
  assert.equal(o.suggestions.length, 3);
  assert.equal(sent.body.model, 'claude-opus-5-5');
  assert.equal(sent.body.output_config.format.type, 'json_schema');
  assert.equal(sent.body.output_config.effort, 'low');
  assert.equal('temperature' in sent.body, false);
  assert.equal(sent.init.headers['x-api-key'], 'sk-test');
  assert.equal(sent.init.headers['anthropic-version'], '2026-10-21');
  assert.equal(sent.body.fallbacks, 'default');
  const spent = Number(await e.RG_KV.get('spent_total'));
  assert.ok(Math.abs(spent - (1000 * 4 + 200 * 20) / 1e6) < 1e-9);
});

test('worker: limit budżetu i limit dzienny blokują przed wywołaniem API', async () => {
  const e = env();
  await e.RG_KV.put('spent_total', '250');
  sent = null; mockApi({});
  assert.equal((await worker.fetch(req('/chat', { child: 'hi' }), e)).status, 402);
  assert.equal(sent, null);
  const e2 = env();
  await e2.RG_KV.put('spent_' + new Date().toISOString().slice(0, 10), '2.5');
  assert.equal((await worker.fetch(req('/chat', { child: 'hi' }), e2)).status, 429);
});

test('worker /analyze: enum dźwięków z gry, przycięty wynik', async () => {
  const e = env();
  mockApi({ notes_pl: 'Krótko.', focus_contrasts: ['three_tree', 'three_tree', 'pen_pan'], new_per_day: 2, minutes: 10, slow_voice: true, writing: 'copy', tips_pl: ['a', 'b'] });
  const p = { id: 'x', teacher: {}, calibration: { finishedAt: 'T1' } };
  const res = await worker.fetch(req('/analyze', ai.analysisInput(p)), e);
  const o = await res.json();
  assert.deepEqual(o.focus_contrasts, ['three_tree', 'pen_pan']);
  assert.deepEqual(sent.body.output_config.format.schema.properties.focus_contrasts.items.enum, Object.keys(CONTRASTS));
});

test('ai.js aiAnalyze zapisuje plan w profilu', async () => {
  ai.setAiConfig({ url: 'https://w.example.dev', token: 'tok' });
  const e = env();
  mockApi({ notes_pl: 'Plan.', focus_contrasts: ['cat_cut'], new_per_day: 1, minutes: 8, slow_voice: false, writing: 'type', tips_pl: [] });
  const realApi = globalThis.fetch;
  globalThis.fetch = async (url, init) => url.startsWith('https://w.example.dev') ? worker.fetch(new Request(url, init), e) : realApi(url, init);
  const p = { id: 'x', teacher: {}, calibration: { finishedAt: 'T1' } };
  const r = await ai.aiAnalyze(p);
  assert.equal(r.plan.newPerDay, 1);
  assert.deepEqual(p.teacher.aiPlan.focus, ['cat_cut']);
  assert.equal(ai.aiAnalysisDue(p), false);
  assert.equal(lessonMinutes(p), 8);
});
