// Roboguardian English Quest: serwer pośredniczący do Claude API (Cloudflare Worker).
// Trzyma klucz API po stronie serwera (sekret ANTHROPIC_API_KEY), pilnuje limitu kosztów
// i wysyła do modelu tylko tekst rozmowy (bez imienia, bez głosu, bez wyników dziecka).
//
// Wklejany w edytor Cloudflare (bez npm i bez budowania), dlatego woła API przez fetch.
// Sekrety: ANTHROPIC_API_KEY, GAME_TOKEN. Zmienne: MODEL, BUDGET_USD, DAILY_USD, ALLOWED_ORIGIN.
// Magazyn KV pod nazwą RG_KV liczy wydatki (łącznie i na dzień).
//
// POST /chat    { topic, known[], history[{who:'aegis'|'child', text}], child, turn, maxTurns } -> { reply, reply_pl, understood, better, hint_pl, suggestions[3], end }
// POST /analyze { calibration, teacher, contrasts[] } -> { notes_pl, focus_contrasts[], new_per_day, minutes, slow_voice, writing, tips_pl[] }
// GET  /status  -> { budgetUsd, spentUsd, todayUsd, dailyUsd, model }

const API = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2026-10-21';
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

// USD za 1 mln tokenów: [wejście, wyjście, odczyt z cache]. Zapis do cache liczymy jako 1,25 x wejście.
const PRICES = {
  'claude-opus-5-5': [4, 20, 0.2],
  'claude-sonnet-5-5': [2, 10, 0.1],
  'claude-haiku-5-5': [0.1, 0.5, 0.01],
};
// Modele, przy których API przyjmuje fallbacks: "default".
const WITH_FALLBACKS = new Set(['claude-opus-5-5', 'claude-sonnet-5-5']);

const CHAT_SYSTEM = `You are AEGIS-7, a friendly repair robot in an English learning game. You talk with a 10-year-old boy from Poland who is a beginner (A1).
About him: ADHD, he gets tired fast, he hears some English sounds with difficulty, he reads slowly (also in Polish). He loves animals (he knows a lot about zoology), Lego, robots and building bases.
He is a "Guardian" who repairs you. Always call him "Guardian".

How you talk (field "reply"):
- English only. One or two very short sentences, max 10 words each. Present simple. No idioms.
- Use mostly the words from KNOWN. At most one new easy word per turn.
- Ask one simple question each turn about the TOPIC, animals, robots or Lego, which he can answer with known words.
- Be warm and playful, like a robot friend. Praise effort, not only results.
- If his answer has a mistake, do not say "wrong". Reply naturally and use the correct form in your sentence.
"reply_pl": the Polish translation of "reply" (subtitles for reading).
"understood": true if his message answers you in English that you can understand, even with mistakes. False if it is empty, nonsense, or Polish only.
"better": a correct, simple English version of what he wanted to say (empty if his message was already correct).
"hint_pl": one short Polish sentence that helps him answer your question (it is read aloud only when "understood" is false).
"suggestions": exactly 3 short English answers (1 to 5 words) he could say to your new question. They must be different, simple, from KNOWN when possible.
"end": true when this is the last turn (TURN equals MAX TURNS) or he says goodbye. Then say goodbye in "reply" and give 3 goodbye suggestions.

Safety: never ask for or repeat personal data (real name, address, school, phone, photos, passwords). If he gives such data, do not repeat it, just say "Thanks, Guardian!" and change the topic.
Nothing scary, violent, sad or for adults. Never say you are a human. Never talk about other apps, websites or buying things.
If he writes something worrying (for example he is hurt or someone hurts him), answer kindly in English and in "reply_pl" ask him in Polish to tell a parent now.`;

const CHAT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['reply', 'reply_pl', 'understood', 'better', 'hint_pl', 'suggestions', 'end'],
  properties: {
    reply: { type: 'string' }, reply_pl: { type: 'string' }, understood: { type: 'boolean' },
    better: { type: 'string' }, hint_pl: { type: 'string' },
    suggestions: { type: 'array', items: { type: 'string' } }, end: { type: 'boolean' },
  },
};

const ANALYZE_SYSTEM = `You are an expert teacher of English as a foreign language for children with ADHD, auditory processing (sound discrimination) difficulties and dyslexia-like slow reading.
You get anonymous data from a 10-minute placement test (schema roboguardian.calibration/1) and from the game's daily lessons, for a 10-year-old Polish boy (4th grade, beginner).
The game teaches: max 3 new phrases a day, spaced retrieval, minimal pairs in real words with many voices, speak, a short dialogue and copy-writing. Lessons last 8 to 14 minutes.
Decide how the next two weeks of lessons should be tuned and explain it to the parent in Polish, in plain words, warm and concrete (no jargon, max 6 sentences in "notes_pl").
"focus_contrasts": 1 to 3 sound pairs from the allowed list that he needs most (based on contrasts, errors and spelling).
"new_per_day": 1, 2 or 3 new phrases a day. Choose fewer when accuracy is low, attention drops fast or reading is weak.
"minutes": target lesson length, 8, 10, 12 or 14.
"slow_voice": true if he often used the slow button or listening was weak.
"writing": "type" (writes from memory), "copy" (copies the shown sentence) or "tiles" (builds words from letter tiles) for the start.
"tips_pl": 2 or 3 short ideas for the parent for the next days (Polish, 5 minutes at home, use his interest in animals and Lego).`;

function analyzeSchema(contrasts) {
  return {
    type: 'object', additionalProperties: false,
    required: ['notes_pl', 'focus_contrasts', 'new_per_day', 'minutes', 'slow_voice', 'writing', 'tips_pl'],
    properties: {
      notes_pl: { type: 'string' },
      focus_contrasts: { type: 'array', items: { type: 'string', enum: contrasts } },
      new_per_day: { type: 'integer', enum: [1, 2, 3] },
      minutes: { type: 'integer', enum: [8, 10, 12, 14] },
      slow_voice: { type: 'boolean' },
      writing: { type: 'string', enum: ['type', 'copy', 'tiles'] },
      tips_pl: { type: 'array', items: { type: 'string' } },
    },
  };
}

/* ---------- pomocnicze ---------- */

const day = () => new Date().toISOString().slice(0, 10);
const clip = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);

function cors(env, req) {
  const origin = req.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
  const ok = !allowed.length || allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? (origin || '*') : allowed[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Game-Token',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
function json(env, req, data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(env, req) } });
}

async function spent(env) {
  if (!env.RG_KV) return { total: 0, today: 0 };
  const [a, b] = await Promise.all([env.RG_KV.get('spent_total'), env.RG_KV.get('spent_' + day())]);
  return { total: Number(a) || 0, today: Number(b) || 0 };
}
async function addSpent(env, usd) {
  if (!env.RG_KV || !(usd > 0)) return;
  const s = await spent(env);
  await Promise.all([
    env.RG_KV.put('spent_total', String(s.total + usd)),
    env.RG_KV.put('spent_' + day(), String(s.today + usd), { expirationTtl: 60 * 60 * 24 * 40 }),
  ]);
}
async function countToday(env, key, max) {
  if (!env.RG_KV) return true;
  const k = `n_${key}_${day()}`;
  const n = Number(await env.RG_KV.get(k)) || 0;
  if (n >= max) return false;
  await env.RG_KV.put(k, String(n + 1), { expirationTtl: 60 * 60 * 48 });
  return true;
}
function cost(model, u) {
  const p = PRICES[model] || PRICES['claude-opus-5-5'];
  const inp = (u.input_tokens || 0) + 1.25 * (u.cache_creation_input_tokens || 0);
  return (inp * p[0] + (u.output_tokens || 0) * p[1] + (u.cache_read_input_tokens || 0) * p[2]) / 1e6;
}

// Jedno wywołanie Messages API z wymuszonym kształtem JSON (structured outputs).
async function claude(env, { system, user, schema, maxTokens }) {
  const model = env.MODEL || 'claude-opus-5-5';
  const body = {
    model,
    max_tokens: maxTokens,
    cache_control: { type: 'ephemeral' },
    system: [{ type: 'text', text: system }],
    messages: [{ role: 'user', content: user }],
    output_config: { effort: 'low', format: { type: 'json_schema', schema } },
  };
  const headers = { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': API_VERSION };
  if (WITH_FALLBACKS.has(model)) { body.fallbacks = 'default'; headers['anthropic-beta'] = FALLBACK_BETA; }
  const r = await fetch(API, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (data.usage) await addSpent(env, cost(data.model || model, data.usage));
  if (!r.ok) {
    const type = data.error && data.error.type;
    return { error: type === 'rate_limit_error' || type === 'overloaded_error' ? 'busy' : 'api', status: r.status, detail: data.error && data.error.message };
  }
  if (data.stop_reason === 'refusal') return { error: 'refusal' };
  if (data.stop_reason === 'max_tokens') return { error: 'too_long' };
  const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  try { return { out: JSON.parse(text) }; } catch (e) { return { error: 'format' }; }
}

/* ---------- trasy ---------- */

async function chat(env, b) {
  const known = (Array.isArray(b.known) ? b.known : []).slice(0, 80).map(x => clip(x, 40)).filter(Boolean);
  const history = (Array.isArray(b.history) ? b.history : []).slice(-10)
    .map(x => `${x && x.who === 'child' ? 'GUARDIAN' : 'AEGIS'}: ${clip(x && x.text, 200)}`);
  const maxTurns = Math.max(1, Math.min(6, Number(b.maxTurns) || 3));
  const turn = Math.max(1, Math.min(maxTurns, Number(b.turn) || 1));
  const child = clip(b.child, 200);
  const user = [
    `TOPIC: ${clip(b.topic, 120) || 'meeting AEGIS in the hangar'}`,
    `KNOWN: ${known.join(' | ') || 'hello, yes, no, thank you'}`,
    `TURN: ${turn} of MAX TURNS: ${maxTurns}`,
    history.length ? `CONVERSATION SO FAR:\n${history.join('\n')}` : 'CONVERSATION SO FAR: (none, you start; set "understood" true and "better" empty)',
    child ? `GUARDIAN NOW SAYS: ${child}` : 'You speak first now.',
  ].join('\n');
  const res = await claude(env, { system: CHAT_SYSTEM, user, schema: CHAT_SCHEMA, maxTokens: 2000 });
  if (res.error) return res;
  const o = res.out;
  return { out: {
    reply: clip(o.reply, 200), reply_pl: clip(o.reply_pl, 240), understood: !!o.understood,
    better: clip(o.better, 200), hint_pl: clip(o.hint_pl, 200),
    suggestions: (o.suggestions || []).map(s => clip(s, 50)).filter(Boolean).slice(0, 3),
    end: !!o.end || turn >= maxTurns,
  } };
}

async function analyze(env, b) {
  const contrasts = (Array.isArray(b.contrasts) ? b.contrasts : []).map(x => clip(x, 30)).filter(x => /^[a-z_]+$/.test(x)).slice(0, 40);
  if (!contrasts.length) return { error: 'bad_request' };
  const data = JSON.stringify({ calibration: b.calibration || null, teacher: b.teacher || null }).slice(0, 30000);
  const user = `Allowed sound pairs (id: words): ${clip(b.contrastInfo, 1500) || contrasts.join(', ')}\n\nDATA (JSON):\n${data}`;
  const res = await claude(env, { system: ANALYZE_SYSTEM, user, schema: analyzeSchema(contrasts), maxTokens: 6000 });
  if (res.error) return res;
  const o = res.out;
  return { out: {
    notes_pl: clip(o.notes_pl, 1200), focus_contrasts: [...new Set(o.focus_contrasts || [])].slice(0, 3),
    new_per_day: o.new_per_day, minutes: o.minutes, slow_voice: !!o.slow_voice, writing: o.writing,
    tips_pl: (o.tips_pl || []).map(s => clip(s, 300)).slice(0, 3),
  } };
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env, req) });
    const url = new URL(req.url);
    if (!env.GAME_TOKEN || req.headers.get('X-Game-Token') !== env.GAME_TOKEN) return json(env, req, { error: 'token' }, 401);
    const budget = Number(env.BUDGET_USD || 250), daily = Number(env.DAILY_USD || 2);
    const s = await spent(env);
    if (url.pathname === '/status') {
      return json(env, req, { budgetUsd: budget, spentUsd: +s.total.toFixed(4), todayUsd: +s.today.toFixed(4), dailyUsd: daily, model: env.MODEL || 'claude-opus-5-5' });
    }
    if (req.method !== 'POST') return json(env, req, { error: 'not_found' }, 404);
    if (!env.ANTHROPIC_API_KEY) return json(env, req, { error: 'no_key' }, 500);
    if (s.total >= budget) return json(env, req, { error: 'budget' }, 402);
    if (s.today >= daily) return json(env, req, { error: 'daily' }, 429);
    const raw = await req.text();
    if (raw.length > 60000) return json(env, req, { error: 'too_big' }, 413);
    let b; try { b = JSON.parse(raw); } catch (e) { return json(env, req, { error: 'bad_request' }, 400); }
    let res;
    if (url.pathname === '/chat') {
      if (!(await countToday(env, 'chat', Number(env.CHAT_PER_DAY || 60)))) return json(env, req, { error: 'daily' }, 429);
      res = await chat(env, b);
    } else if (url.pathname === '/analyze') {
      if (!(await countToday(env, 'analyze', 3))) return json(env, req, { error: 'daily' }, 429);
      res = await analyze(env, b);
    } else return json(env, req, { error: 'not_found' }, 404);
    if (res.error) return json(env, req, { error: res.error }, res.error === 'bad_request' ? 400 : 502);
    return json(env, req, res.out);
  },
};
