// Uruchom: node --test src/assistant/tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import A from '../assistant.js';

const T0 = Date.parse('2026-11-10T16:00:00Z');
const MIN = 60000, DAY = 86400000;
function rng(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }

test('poziom dąży do ok. 80% dobrych odpowiedzi', () => {
  const p = {}; const r = rng(7);
  // dziecko o „prawdziwej” umiejętności 3: szansa sukcesu maleje z poziomem gry
  for (let i = 0; i < 600; i++) {
    const lvl = A.nextSettings(p, { skill: 'vocab', now: T0 + i * 20000 }).level;
    const pOk = 1 / (1 + Math.exp(2 * (lvl - 3.6)));
    A.record(p, { t: T0 + i * 20000 + (i >> 5) * DAY, session: 's' + (i >> 5), mission: 'm', item: 'w' + (i % 40), skill: 'vocab', ok: r() < pOk, ms: 3000 });
  }
  const lvl = p.assistant.level.skills.vocab;
  assert.ok(lvl > 2.6 && lvl < 3.6, 'poziom ' + lvl);
});

test('wykrywa mylenie his/her, zgadywanie i słabe słuchanie', () => {
  const p = {};
  let t = T0;
  for (let i = 0; i < 40; i++) {
    t += 30000;
    A.record(p, { t, session: 'a', mission: 'm', item: i % 2 ? 'her' : 'his', chosen: i % 2 ? 'his' : 'her', skill: 'grammar.his_her', mode: 'choose', ok: i % 3 === 0, ms: 900 });
    A.record(p, { t: t + 1000, session: 'a', mission: 'm', item: 'r' + i, skill: 'reading', mode: 'read', ok: true, ms: 3000 });
    A.record(p, { t: t + 2000, session: 'a', mission: 'm', item: 'l' + i, skill: 'listening', mode: 'listen', ok: i % 2 === 0, ms: 3000 });
  }
  const a = A.analyze(p, { now: t });
  const ids = a.problems.map(x => x.id);
  assert.ok(ids.includes('confuse:her|his'), ids.join());
  assert.ok(ids.includes('guessing'), ids.join());
  assert.ok(ids.includes('listen-gap'), ids.join());
  assert.ok(ids.includes('weak:grammar.his_her'), ids.join());
  const rep = A.report(p, { name: 'Test', now: t }).text;
  assert.match(rep, /Myli „(her|his)” z „(her|his)”/);
  assert.match(rep, /Plan na ten tydzień/);
  assert.ok(A.nextSettings(p, { skill: 'grammar.his_her', now: t }).options === 2);
});

test('zmęczenie: propozycja przerwy w trakcie sesji', () => {
  const p = {};
  for (let i = 0; i < 30; i++) A.record(p, { t: T0 + i * 40000, session: 'z', item: 'x' + i, ok: i < 20, ms: 3000 });
  const s = A.nextSettings(p, { session: 'z', now: T0 + 30 * 40000 });
  assert.equal(s.suggestBreak, true);
});

test('przyjmuje surowy log zapisany przez rdzeń, gdy asystent nie był wczytany', () => {
  const p = { assistant: { v: 1, log: [{ t: T0, session: 's', mission: 'paliwo', item: 'jacket', skill: 'vocab', ok: true }, { t: T0 + 1000, session: 's', item: 'jacket', ok: false, chosen: 'dress' }] } };
  const a = A.analyze(p, { now: T0 + 2000 });
  assert.equal(a.stats.answers, 2);
  assert.equal(p.assistant.items.jacket.seen, 2);
  assert.equal(p.assistant.items.jacket.confusions.dress, 1);
});

test('format misji rozdziału 1 (ear + target, attempts) i getDifficulty', () => {
  const p = {};
  for (let i = 0; i < 12; i++) A.record(p, { ts: T0 + i * 10000, missionId: 'ch1-ear', itemId: i % 2 ? 'bed' : 'bad', skill: 'ear', target: 'ae', correct: true, attempts: i % 3 === 0 ? 2 : 1, ms: 2500, hintShown: false });
  assert.ok(p.assistant.skills['phoneme.ae']);
  assert.equal(p.assistant.skills['phoneme.ae'].ok, 8); // poprawne za drugim razem się nie liczą
  const d = A.getDifficulty(p, 'ch1-ear', { now: T0 + 200000 });
  assert.ok([1, 2, 3].includes(d.level));
  assert.ok([2, 3, 4].includes(d.maxChoices));
  assert.ok(d.focusItems.length >= 1);
  assert.match(A.claudePrompt(p, { now: T0 + 200000 }), /æ \/ e/);
});

test('import testu startowego ustawia poziomy', () => {
  const p = { calibration: {
    schema: 'roboguardian.calibration/1', finishedAt: '2026-11-10T16:10:00Z', context: { age: 9 },
    items: [{ id: 'ship', section: 'contrasts', skill: 'contrasts', contrast: 'i_ee', target: 'ship', shown: ['ship', 'sheep'], answer: 'sheep', correct: false, errorType: 'vowel_i_ee', rtMs: 2100 }],
    sections: { words: { n: 20, correct: 18, score: 0.9 }, spelling: { n: 10, correct: 3, score: 0.3 } },
    contrasts: { i_ee: { n: 4, correct: 1 }, ae_e: { n: 4, correct: 4 } },
    profile: { overall: 'A1', weaknesses: ['spelling'], weakContrasts: ['i_ee'] }, plan: { supports: { slowAudioDefault: true } } } };
  A.analyze(p); // import automatyczny z profile.calibration
  const L = p.assistant.level;
  assert.ok(L.skills.vocab > L.overall && L.skills.spelling < L.overall);
  assert.ok(L.skills['phoneme.ih'] < L.skills['phoneme.ae']);
  assert.ok(p.assistant.items.ship.confusions.sheep === 1);
  const prompt = A.claudePrompt(p);
  assert.match(prompt, /9 lat/);
  assert.match(prompt, /ship – sheep/);
  assert.doesNotMatch(prompt, /undefined/);
});

test('pickItems: nowe w limicie poziomu, powtórki najpierw', () => {
  const p = {};
  A.setLevel(p, 'overall', 1.5); // newPerRound = 1
  for (let i = 0; i < 3; i++) A.record(p, { t: T0, session: 's', item: 'old' + i, ok: false });
  const pool = ['old0', 'old1', 'old2', 'n1', 'n2', 'n3', 'n4'].map(id => ({ id }));
  const out = A.pickItems(p, pool, 4, { now: T0 + 60000 }).map(x => x.id);
  assert.equal(out.length, 4);
  assert.equal(out.filter(x => x.startsWith('old')).length, 3);
});
