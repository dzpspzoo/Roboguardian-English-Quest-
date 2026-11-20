// Testy oceny: node src/calibration/tests/scoring.test.mjs
import assert from 'node:assert/strict';
import { classifySpelling, buildResult, overallLevel, describeForParent, SCHEMA } from '../scoring.js';
import { content, allPhrases } from '../content.js';

let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };

t('klasyfikacja pisowni', () => {
  assert.equal(classifySpelling('sit', 'sit'), null);
  assert.equal(classifySpelling('sit', 'syt'), 'polish_phonetic');
  assert.equal(classifySpelling('ship', 'szip'), 'polish_phonetic');
  assert.equal(classifySpelling('window', 'łindoł'), 'polish_phonetic');
  assert.equal(classifySpelling('cat', 'kat'), 'polish_phonetic');
  assert.equal(classifySpelling('bed', 'bet'), 'voicing_t_d');
  assert.equal(classifySpelling('cat', 'cet'), 'vowel_ae_e');
  assert.equal(classifySpelling('sit', 'set'), 'vowel_i_e');
  assert.equal(classifySpelling('window', 'vindow'), 'w_v');
  assert.equal(classifySpelling('three', 'free'), 'th');
  assert.equal(classifySpelling('fish', 'fsih'), 'letter_order');
  assert.equal(classifySpelling('jacket', 'jaket'), 'missing_letter');
  assert.equal(classifySpelling('cat', ''), 'missing_letter');
});

const mk = (section, correct, extra = {}) => ({ id: section + Math.random(), section, correct, rtMs: 3000, replays: 0, slowUsed: false, ...extra });

t('wynik dla słabego ucha i polskiej fonetyki', () => {
  const items = [
    ...['A', 'A', 'A', 'B', 'B', 'B'].map((L, i) => mk('words', i < 4, { level: L })),
    mk('contrasts', false, { contrast: 'i_ee' }), mk('contrasts', false, { contrast: 'i_ee' }),
    mk('contrasts', true, { contrast: 'ae_e' }), mk('contrasts', false, { contrast: 'ae_e' }),
    mk('contrasts', true, { contrast: 'th_s_f' }), mk('contrasts', true, { contrast: 'th_s_f' }),
    mk('phonics', false, { errorType: 'polish_phonetic' }), mk('phonics', true), mk('phonics', false, { errorType: 'voicing_t_d' }),
    ...['A', 'A', 'A'].map((L, i) => mk('reading', i < 2, { level: L })),
    ...['A', 'A', 'A'].map(L => mk('listening', false, { level: L })),
    mk('spelling', false, { level: 'A', errorType: 'polish_phonetic' }), mk('spelling', true, { level: 'A' }), mk('spelling', false, { level: 'A', errorType: 'voicing_t_d' }),
    mk('speaking', null, { responded: true, latencyMs: 900 })
  ];
  const r = buildResult({ profileId: 'x', startedAt: '2026-11-17T10:00:00Z', finishedAt: '2026-11-17T10:10:30Z', context: { micOk: true }, items, breakTaken: true,
    sectionModes: { words: 'levels', reading: 'levels', listening: 'levels', spelling: 'levels' } });
  assert.equal(r.schema, SCHEMA);
  assert.equal(r.durationSec, 630);
  assert.equal(r.sections.words.level, 'A');
  assert.equal(r.sections.listening.level, null);
  assert.equal(r.sections.speaking.respondedRate, 1);
  assert.equal(r.plan.startSounds[0], 'i_ee');
  assert.ok(r.plan.startSounds.includes('t_d_final')); // 2 błędy t/d w pisowni
  assert.ok(r.plan.startSounds.includes('ae_e'));
  assert.equal(r.plan.startSounds.length, 3);
  assert.ok(r.profile.weaknesses.includes('sound_letter'));
  assert.equal(r.plan.supports.speakingMode, 'practice');
  assert.equal(r.errors.polish_phonetic, 2);
  assert.ok(['preA1', 'A1-'].includes(r.profile.overall));
  assert.equal(r.profile.flags.hearing.measured, true);
  assert.equal(r.profile.flags.soundLetter.measured, true);
  assert.equal(r.profile.flags.slowReading.parent, null);
  const txt = describeForParent(r);
  assert.match(txt, /ship i sheep/);
});

t('zmęczenie wykryte, gdy odpowiedzi mocno zwalniają', () => {
  const items = Array.from({ length: 12 }, (_, i) => mk('contrasts', true, { contrast: 'h', rtMs: i < 4 ? 2000 : i < 8 ? 3000 : 6000 }));
  const r = buildResult({ startedAt: '2026-11-17T10:00:00Z', finishedAt: '2026-11-17T10:05:00Z', items });
  assert.equal(r.attention.fatigueFlag, true);
  assert.equal(r.plan.missionMinutes, 5);
  assert.ok(r.attention.rtTrend > 0);
});

t('informacje od rodzica zmieniają wsparcie', () => {
  const items = [...['A', 'A', 'A'].map(L => mk('reading', true, { level: L, rtMs: 9000 }))];
  const r = buildResult({ startedAt: '2026-11-17T10:00:00Z', finishedAt: '2026-11-17T10:05:00Z', items, sectionModes: { reading: 'levels' },
    context: { parent: { readingPl: true, adhd: true, hearing: false }, interests: ['animals', 'lego'] } });
  assert.equal(r.attention.readingAvgRtMs, 9000);
  assert.equal(r.profile.flags.slowReading.measured, true);
  assert.equal(r.profile.flags.fatigue.parent, true);
  assert.equal(r.plan.supports.plAudio, true);
  assert.equal(r.plan.missionMinutes, 5);
  assert.deepEqual(r.plan.interests, ['animals', 'lego']);
});

t('poziom ogólny', () => {
  assert.equal(overallLevel({ words: { n: 9, level: 'C' }, listening: { n: 9, level: 'C' }, reading: { n: 9, level: 'C' }, spelling: { n: 9, level: 'B' }, phonics: { n: 10, score: 1 } }), 'A2');
  assert.equal(overallLevel({ words: { n: 3, level: null }, listening: { n: 3, level: null }, phonics: { n: 3, score: 0 } }), 'preA1');
});

t('treść testu jest kompletna', () => {
  assert.ok(content.contrastItems.length >= 14);
  for (const L of ['A', 'B', 'C']) {
    assert.ok(content.wordPools[L].length >= 3);
    content.spellingLevels[L].forEach(s => assert.ok(s.extra.every(x => !s.word.includes(x)), 'litera-pułapka nie może być w słowie: ' + s.word));
  }
  content.phonicsItems.forEach(p => assert.equal(p.options[0][0], p.word));
  assert.ok(allPhrases().length > 50);
});

console.log(`\n${n} testów OK`);
