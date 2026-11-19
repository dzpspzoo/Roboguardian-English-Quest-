// Misja specjalna: dyktando z klawiatury. Robot mówi słowo, dziecko wpisuje, gra podświetla złe i brakujące litery.
import { createShell, chooseWords, typeGame, starsFor } from '../_shared/special-engine.js';
import { LINES } from '../_shared/special-data.js';

export const meta = {
  id: 'sp-dictation', title: 'Dyktando', titleEn: 'Dictation', chapter: 1, special: true, icon: '⌨️',
  desc: 'AEGIS-7 mówi słowo, a Ty je wpisujesz. Gra pokazuje, które litery poprawić.',
  part: null, parts: [], skills: ['spelling'], minutes: 6, requires: [],
};

export function mount(root, ctx) {
  const S = createShell(root, ctx, { id: meta.id, title: meta.title });
  (async () => {
    try {
      S.progress(0, 'Wybór działu');
      const sel = await chooseWords(S, { allowHardest: true, intro: 'Z czego dyktando?' });
      await S.aegis(LINES.dictIntro);
      const words = sel.words.slice().sort(() => Math.random() - .5).slice(0, 10);
      let ok = 0; const wrong = [];
      for (let i = 0; i < words.length; i++) {
        S.progress(i / words.length, `Dyktando: ${i + 1} z ${words.length}`);
        const r = await typeGame(S, sel.unitId, words[i], { mode: 'dict' });
        if (r) ok++; else wrong.push(words[i].en);
      }
      S.progress(1, `Dyktando: ${ok} z ${words.length}`);
      const line = ok === words.length ? LINES.great : LINES.testGood;
      S.clear(S.h('div', { class: 'sp-score' }, `${ok} / ${words.length}`), S.h('div', { class: 'ch1-label' }, 'dobrze za pierwszym razem'),
        wrong.length ? S.h('div', { class: 'ch1-tip on' }, 'Do powtórki: ', S.h('b', {}, wrong.join(', '))) : null);
      await S.aegis(line);
      const next = S.h('button', { class: 'ch1-next' }, 'Dalej ›'); S.stage.append(next); await S.clickOf([next]);
      ctx.done?.({ stars: starsFor(ok, words.length), partEarned: false, parts: [], summary: {
        missionId: meta.id, unit: sel.unitId, unitTitle: sel.title, good: words.map(w => w.en).filter(x => !wrong.includes(x)), hard: wrong,
        cheer: line, en: line.en, pl: `${line.pl} Wynik: ${ok} z ${words.length}.`,
      } });
    } catch (e) { S.error(e); }
  })();
  return S.cleanup;
}
