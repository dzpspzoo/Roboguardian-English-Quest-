// Misja specjalna: podsumowanie po 3 działach. Film „review”, raport AEGIS-7 z działów, powtórka 10 najtrudniejszych słów.
import { createShell, practisedUnits, hardestWords, wordStats, practice, starsFor } from '../_shared/special-engine.js';
import { LINES } from '../_shared/special-data.js';

export const meta = {
  id: 'sp-review', title: 'Podsumowanie działów', titleEn: 'Systems report', chapter: 1, special: true, icon: '📊',
  desc: 'Po 3 przećwiczonych działach: raport AEGIS-7 i powtórka najtrudniejszych słów.',
  part: null, parts: [], skills: ['vocab', 'listening', 'spelling'], minutes: 8, requires: [],
};
export const NEED_UNITS = 3;

// Dla hangaru: czy misja jest już dostępna i dlaczego nie.
export function available(profile) {
  const n = practisedUnits(profile).length;
  return { ok: n >= NEED_UNITS, units: n, need: NEED_UNITS, reason: n >= NEED_UNITS ? '' : `Przećwicz jeszcze ${NEED_UNITS - n} ${NEED_UNITS - n === 1 ? 'dział' : 'działy'}.` };
}

export function mount(root, ctx) {
  const S = createShell(root, ctx, { id: meta.id, title: meta.title });
  (async () => {
    try {
      const units = practisedUnits(ctx.profile);
      const hard = hardestWords(ctx.profile, 10, units.length ? units : undefined);
      if (units.length < NEED_UNITS || hard.length < 3) {
        S.clear(S.h('div', { class: 'ch1-label' }, 'Raport AEGIS-7 będzie gotowy po 3 działach'),
          S.h('div', { class: 'ch1-tip on' }, `Przećwiczone działy: ${units.length} z ${NEED_UNITS}. Zagraj w „Przygotuj się do kartkówki” albo „Dyktando” z innymi działami.`));
        const back = S.h('button', { class: 'ch1-next' }, 'Wróć'); S.stage.append(back); await S.clickOf([back]);
        ctx.exit ? ctx.exit() : ctx.done?.({ stars: 0, partEarned: false, parts: [] });
        return;
      }
      await S.film('review');
      const st = wordStats(ctx.profile);
      const rows = units.map(u => { const seen = u.words.filter(w => st[w.en]?.seen); const good = seen.filter(w => (st[w.en].box || 0) >= 3); return { u, seen: seen.length, good: good.length, pct: Math.round(good.length / u.words.length * 100) }; });
      S.progress(0, 'Raport');
      S.clear(S.h('div', { class: 'ch1-label' }, 'Raport systemów AEGIS-7'),
        S.h('div', { class: 'sp-report' }, rows.map(r => S.h('div', { class: 'sp-rrow' }, S.h('span', {}, r.u.title), S.h('span', { class: 'sp-rbar' }, S.h('span', { style: `width:${r.pct}%` })), S.h('span', { class: 'ch1-pl' }, `${r.good}/${r.u.words.length} opanowane`)))),
        S.h('div', { class: 'ch1-label' }, 'Najtrudniejsze słowa:'), S.h('div', { class: 'sp-hardlist' }, hard.map(w => S.h('span', { class: 'tag' }, w.en))));
      await S.aegis(LINES.reviewIntro);
      const next = S.h('button', { class: 'ch1-next' }, 'Naprawiamy ›'); S.stage.append(next); await S.clickOf([next]);
      const tr = await practice(S, 'review', hard, { minutes: ctx.profile?.settings?.reviewMinutes || 8, startStage: 1, label: 'Naprawa pamięci' });
      const okWords = hard.filter(w => !tr.hard.includes(w.en));
      await S.aegis(LINES.reviewDone);
      ctx.done?.({ stars: starsFor(okWords.length, hard.length), partEarned: false, parts: [], summary: {
        missionId: meta.id, units: rows.map(r => ({ id: r.u.id, title: r.u.title, mastered: r.good, total: r.u.words.length })),
        good: okWords.map(w => w.en), hard: tr.hard, cheer: LINES.reviewDone, en: LINES.reviewDone.en, pl: LINES.reviewDone.pl,
      } });
    } catch (e) { S.error(e); }
  })();
  return S.cleanup;
}
