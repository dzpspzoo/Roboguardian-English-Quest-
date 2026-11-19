// Misja specjalna: „Przygotuj się do kartkówki”. Rodzic wybiera dział albo wpisuje słówka,
// film „quiz”, ok. 10 minut treningu, potem krótki sprawdzian (polskie słowo → wpisz po angielsku, jedna próba).
import { createShell, chooseWords, practice, typeGame, starsFor } from '../_shared/special-engine.js';
import { LINES } from '../_shared/special-data.js';

export const meta = {
  id: 'sp-quiz', title: 'Przygotuj się do kartkówki', titleEn: 'Test simulator', chapter: 1, special: true, icon: '📝',
  desc: 'Rodzic wybiera dział albo wpisuje słówka z zeszytu. 10 minut ćwiczeń i krótki sprawdzian.',
  part: null, parts: [], skills: ['vocab', 'listening', 'reading', 'spelling'], minutes: 12, requires: [],
};

export function mount(root, ctx) {
  const S = createShell(root, ctx, { id: meta.id, title: meta.title });
  (async () => {
    try {
      S.progress(0, 'Wybór działu');
      const sel = await chooseWords(S, { intro: 'Z czego jest kartkówka?' });
      await S.film('quiz');
      await S.aegis(LINES.quizIntro);
      const minutes = ctx.profile?.settings?.quizMinutes || 10;
      const tr = await practice(S, sel.unitId, sel.words, { minutes, label: 'Trening' });
      await S.aegis(LINES.testStart);
      const test = sel.words.slice().sort(() => Math.random() - .5).slice(0, 10);
      let ok = 0; const wrong = [];
      for (let i = 0; i < test.length; i++) {
        S.progress(i / test.length, `Sprawdzian: ${i + 1} z ${test.length}`);
        const w = test[i];
        const r = await typeGame(S, sel.unitId, w, { mode: w.pl ? 'pl' : 'dict', test: true, label: w.pl ? 'Sprawdzian: napisz po angielsku' : 'Sprawdzian: napisz słowo, które słyszysz' });
        if (r) ok++; else wrong.push(w.en);
      }
      S.progress(1, `Sprawdzian: ${ok} z ${test.length}`);
      const pct = Math.round(ok / test.length * 100);
      const line = pct >= 90 ? LINES.testGreat : LINES.testGood;
      S.clear(S.h('div', { class: 'sp-score' }, `${ok} / ${test.length}`), S.h('div', { class: 'ch1-label' }, `${sel.title}: ${pct}% dobrze`),
        wrong.length ? S.h('div', { class: 'ch1-tip on' }, 'Do powtórki: ', S.h('b', {}, wrong.join(', '))) : S.h('div', { class: 'ch1-label' }, 'Bez ani jednego błędu!'));
      await S.aegis(line);
      const next = S.h('button', { class: 'ch1-next' }, 'Dalej ›'); S.stage.append(next); await S.clickOf([next]);
      ctx.done?.({ stars: starsFor(ok, test.length), partEarned: false, parts: [], summary: {
        missionId: meta.id, unit: sel.unitId, unitTitle: sel.title, test: { ok, total: test.length, wrong },
        good: test.map(w => w.en).filter(x => !wrong.includes(x)), hard: [...new Set([...wrong, ...tr.hard])],
        cheer: line, en: line.en, pl: `${line.pl} Wynik: ${ok} z ${test.length}.`,
      } });
    } catch (e) { S.error(e); }
  })();
  return S.cleanup;
}
