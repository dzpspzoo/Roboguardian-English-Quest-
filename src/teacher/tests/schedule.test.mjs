import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../schedule.js';
import { COURSE, ITEMS, CONTRASTS, PART_ORDER, phrases } from '../curriculum.js';

const H = 3600e3, D = 24 * H;
const T0 = Date.parse('2026-11-20T17:00:00');
const prof = () => ({ id: 'p1', progress: { missions: {}, parts: [] } });

test('nowy gracz: misja otwarta', () => {
  assert.equal(S.gate(prof(), T0).open, true);
});

test('po misji blokada 12 h, potem otwarte', () => {
  const p = prof(); S.markDone(p, {}, T0);
  const g = S.gate(p, T0 + 3 * H);
  assert.equal(g.open, false); assert.equal(g.opensAt, T0 + 12 * H);
  assert.equal(S.gate(p, T0 + 12 * H + 1).open, true);
});

test('misja rozdziału 1 zapisana przez rdzeń też zamyka dzień, specjalna nie', () => {
  const p = prof(); p.progress.missions['sp-quiz'] = { last: new Date(T0).toISOString() };
  assert.equal(S.gate(p, T0 + H).open, true);
  p.progress.missions['ch1-m3'] = { last: new Date(T0).toISOString() };
  assert.equal(S.gate(p, T0 + H).open, false);
});

test('cofnięcie zegara nie otwiera misji', () => {
  const p = prof(); S.markDone(p, {}, T0);
  S.gate(p, T0 + 5 * H);
  assert.equal(S.gate(p, T0 - 30 * D).open, false);
});

test('rodzic odblokowuje do następnej misji', () => {
  const p = prof(); S.markDone(p, {}, T0);
  S.parentUnlock(p, T0 + H);
  assert.equal(S.gate(p, T0 + 2 * H).open, true);
  S.markDone(p, {}, T0 + 3 * H);
  assert.equal(S.gate(p, T0 + 4 * H).open, false);
});

test('tryb „do rana”: następnego dnia od 6:00, min. 8 h', () => {
  const p = prof(); S.teacherState(p).rhythm = { mode: 'morning' };
  const late = Date.parse('2026-11-20T23:30:00');
  S.markDone(p, {}, late);
  assert.equal(S.opensAt(p), late + 8 * H);
  const p2 = prof(); S.teacherState(p2).rhythm = { mode: 'morning' };
  S.markDone(p2, {}, T0);
  assert.equal(S.opensAt(p2), Date.parse('2026-11-21T06:00:00'));
});

test('PIN', () => {
  const p = prof(); S.setPin(p, '4321');
  assert.equal(S.checkPin(p, '4321'), true); assert.equal(S.checkPin(p, '1234'), false);
  S.setPin(p, null); assert.equal(S.checkPin(p, '4321'), false);
});

test('powtórki: pudełko rośnie raz dziennie, błąd cofa', () => {
  const p = prof(); S.introduce(p, 'hello', T0);
  assert.deepEqual(S.dueItems(p, T0), []);
  assert.deepEqual(S.dueItems(p, T0 + D), ['hello']);
  S.review(p, 'hello', true, { now: T0 + D });
  S.review(p, 'hello', true, { now: T0 + D + H });
  assert.equal(S.itemState(p, 'hello').box, 1);
  S.review(p, 'hello', true, { now: T0 + 2 * D });
  const s = S.itemState(p, 'hello');
  assert.equal(s.box, 2); assert.ok(s.due >= S.startOfDay(T0 + 2 * D) + 2 * D);
  S.review(p, 'hello', false, { now: T0 + 4 * D });
  assert.equal(S.itemState(p, 'hello').box, 1);
});

test('drabina: awans po 2 dniach trafień', () => {
  const p = prof(); S.introduce(p, 'yes', T0);
  S.review(p, 'yes', true, { mode: 'recognize', now: T0 + D });
  assert.equal(S.itemState(p, 'yes').stage, 0);
  S.review(p, 'yes', true, { mode: 'recognize', now: T0 + 2 * D });
  assert.equal(S.itemState(p, 'yes').stage, 1);
});

test('plan dnia: maks. 3 nowe, kurs idzie dalej, część co PART_EVERY misji', () => {
  const p = prof();
  let part = null;
  for (let i = 0; i < S.PART_EVERY; i++) {
    const plan = S.planToday(p, COURSE, T0 + i * D);
    assert.equal(plan.number, i + 1);
    assert.ok(plan.newIds.length <= 3);
    plan.newIds.forEach(id => S.introduce(p, id, T0 + i * D));
    part = S.finishToday(p, plan, { now: T0 + i * D + H, partOrder: PART_ORDER });
    if (i < S.PART_EVERY - 1) assert.equal(part, null);
  }
  assert.equal(part, 'head');
  assert.equal(S.teacherState(p).day, S.PART_EVERY);
});

test('po przerwie > 3 dni: powtórka bez przesuwania kursu', () => {
  const p = prof();
  const plan = S.planToday(p, COURSE, T0); plan.newIds.forEach(id => S.introduce(p, id, T0));
  S.finishToday(p, plan, { now: T0 });
  const back = S.planToday(p, COURSE, T0 + 5 * D);
  assert.equal(back.type, 'review'); assert.equal(back.comeback, true); assert.equal(back.newIds.length, 0);
  S.finishToday(p, back, { now: T0 + 5 * D });
  assert.equal(S.teacherState(p).day, 1);
  assert.equal(S.planToday(p, COURSE, T0 + 6 * D).type, 'learn');
});

test('zmęczenie: 3 szybkie błędy albo ponad 12 min', () => {
  assert.equal(S.tired([{ ok: false, ms: 500 }, { ok: false, ms: 700 }, { ok: false, ms: 900 }], 60e3), true);
  assert.equal(S.tired([{ ok: true, ms: 500 }], 13 * 60e3), true);
  assert.equal(S.tired([{ ok: false, ms: 3000 }, { ok: false, ms: 700 }, { ok: false, ms: 900 }], 60e3), false);
});

test('kurs: 14 dni, poprawne odwołania', () => {
  assert.equal(COURSE.length, 14);
  for (const d of COURSE) {
    for (const id of d.items || []) assert.ok(ITEMS[id], id);
    assert.ok((d.items || []).length <= 3);
    if (d.contrast) assert.ok(CONTRASTS[d.contrast], d.contrast);
    for (const l of d.scene || []) assert.ok(l.options.length >= 2 && l.options[l.answer || 0]);
  }
  assert.ok(phrases().length > 60);
});
