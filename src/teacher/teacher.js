// Nauczyciel AEGIS-7: wejścia dla rdzenia gry (src/core/app.js).
//   todayMission(profile)                         -> misja w formacie rdzenia { id, title, titleEn, minutes, mod:{ meta, mount } }
//   renderTodayCard(box, profile, { start, locked }) -> karta „Misja dnia” w hangarze
//   gate(profile)                                 -> { open, opensAt, msLeft } blokada po misji (12 h albo do rana)
//   lockScreen(root, { profile, aegisSay, save, onUnlock, onBack })
//   farewell(root, { profile, missionId, aegisSay, save, onDone })  -> żart + „See you tomorrow, Guardian!”
//   renderParentControls(box, profile, save)      -> PIN, rytm, odblokowanie, postęp kursu
// Stan dziecka tylko w profile.teacher.
import { COURSE, CHAPTERS, OUTLINE, ITEMS, CONTRASTS } from './curriculum.js';
import { PART_EVERY, teacherState, planToday, gate, opensAt, parentUnlock, markDone, fmtLeft, setPin, checkPin, lastDone } from './schedule.js';
import { mountLesson } from './lesson.js';
import { JOKES, pickJoke } from './jokes.js';
import { aiConfig, setAiConfig, aiConfigured, aiStatus, aiAnalyze, autoAnalyze, aiErrorPl } from './ai.js';

export { gate } from './schedule.js';

(function css() {
  if (typeof document === 'undefined' || document.getElementById('tch-css')) return;
  const l = document.createElement('link'); l.id = 'tch-css'; l.rel = 'stylesheet'; l.href = new URL('./teacher.css', import.meta.url).href;
  document.head.append(l);
})();

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hm = t => new Date(t).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
function when(t) {
  const d = new Date(t), now = new Date();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const day = d.toDateString() === now.toDateString() ? 'dziś' : d.toDateString() === tomorrow.toDateString() ? 'jutro' : d.toLocaleDateString('pl-PL', { weekday: 'long' });
  return `${day} o ${hm(t)}`;
}
const TYPE_PL = { learn: 'nowe zwroty', review: 'powtórka', talk: 'dzień rozmowy' };
const TYPE_EN = { learn: 'new words', review: 'memory check', talk: 'talk day' };
// Karta w hangarze widzi dziecko: po angielsku, polski tylko jako mały napis do czytania.
function whenEn(t) {
  const d = new Date(t), now = new Date();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const day = d.toDateString() === now.toDateString() ? 'today' : d.toDateString() === tomorrow.toDateString() ? 'tomorrow' : d.toLocaleDateString('en-GB', { weekday: 'long' });
  return `${day} at ${hm(t)}`;
}

export function todayMission(profile) {
  const plan = planToday(profile, COURSE);
  const meta = {
    id: `teacher-d${plan.number}${plan.type === 'review' && plan.comeback ? 'r' : ''}`,
    title: `Mission ${plan.number}`, titleEn: plan.day.goal ? plan.day.goal.en : 'Mission of the day',
    chapter: 1, minutes: 14, teacher: true,
  };
  return { ...meta, plan, mod: { meta, mount: (root, ctx) => mountLesson(root, ctx, plan) } };
}

export function renderTodayCard(box, profile, { start, locked } = {}) {
  if (!box) return;
  const g = gate(profile);
  const plan = planToday(profile, COURSE);
  const t = teacherState(profile);
  const d = plan.day;
  const energy = (t.energy || 0) % PART_EVERY;
  const head = `<span class="tag">Chapter 1: ${esc(d.chapterTitle)} · day ${d.dayInChapter} of ${d.daysInChapter}</span>`;
  const energyBar = `<span class="tch-energy" title="Co ${PART_EVERY} misji AEGIS dostaje nową część">${Array.from({ length: PART_EVERY }, (_, i) => i).map(i => `<i class="${i < energy ? 'on' : ''}"></i>`).join('')}<small>next robot part</small></span>`;
  if (g.open) {
    box.innerHTML = `<div class="panel tch-today">
      <div class="tch-today-main">${head}<h2>Mission ${plan.number}</h2>
      <p class="tch-en">${esc(d.goal ? d.goal.en : 'Learn with AEGIS!')}</p>
      ${d.goal ? `<p class="tch-pl">${esc(d.goal.pl)}</p>` : ''}
      <p class="muted">about 14 min · ${TYPE_EN[plan.type] || ''}${plan.comeback ? ' · welcome back' : ''}${plan.finished ? ' · chapter 1 done' : ''}</p>${energyBar}</div>
      <button class="btn primary big" data-tch-start>▶ Start</button></div>`;
    box.querySelector('[data-tch-start]').onclick = () => start && start(todayMission(profile));
  } else {
    box.innerHTML = `<div class="panel tch-today locked">
      <div class="tch-today-main">${head}<h2>AEGIS is charging 🔋</h2>
      <p class="tch-en">Next mission: <b>${esc(whenEn(g.opensAt))}</b> (in ${esc(fmtLeft(g.msLeft))}).</p>
      <p class="tch-en">See you tomorrow, Guardian!</p>
      <p class="tch-pl">Widzimy się jutro, Strażniku!</p>${energyBar}</div>
      <button class="btn" data-tch-lock>🔒 Parent</button></div>`;
    box.querySelector('[data-tch-lock]').onclick = () => locked && locked();
  }
}

/* ---------- ekran blokady z odblokowaniem przez rodzica ---------- */
export function lockScreen(root, { profile, aegisSay, save, onUnlock, onBack }) {
  const g = gate(profile);
  const t = teacherState(profile);
  const a = 6 + Math.floor(Math.random() * 4), b = 3 + Math.floor(Math.random() * 6);
  root.innerHTML = `<div class="bg" style="background-image:url(assets/gfx/backgrounds/hangar.svg),url(assets/img/hangar.webp)"></div>
    <div class="topbar"><button class="iconbtn" data-a="back" aria-label="Wstecz">←</button><span class="title">AEGIS się ładuje</span></div>
    <div class="wrap center">
      <img class="tch-aegis big anim-sleep" src="assets/img/aegis.webp" alt="AEGIS-7 śpi">
      <h2>See you tomorrow, Guardian!</h2><p class="subtitle">Widzimy się jutro, Strażniku!</p>
      <p>Następna misja otworzy się <b>${esc(when(g.opensAt))}</b>${g.msLeft ? ` (za ${esc(fmtLeft(g.msLeft))})` : ''}.</p>
      <p class="muted" style="max-width:620px">Przerwa między misjami jest częścią nauki: to, co powtarzasz po nocy, zostaje w pamięci na dłużej.</p>
      <div class="panel col" style="align-items:center;max-width:460px">
        <p><b>Dla rodzica:</b> ${t.pinHash ? 'wpisz PIN, żeby otworzyć misję wcześniej.' : `ile to jest ${a} × ${b}? (PIN ustawisz w panelu rodzica)`}</p>
        <input type="password" inputmode="numeric" maxlength="8" autocomplete="off" data-pin style="width:180px;text-align:center;font-size:24px;padding:10px;border-radius:12px">
        <button class="btn primary" data-a="ok">Otwórz misję</button><p class="tch-tip" data-msg hidden></p>
      </div>
    </div>`;
  try { aegisSay && aegisSay('See you tomorrow, Guardian!'); } catch (e) {}
  const input = root.querySelector('[data-pin]'), msg = root.querySelector('[data-msg]');
  const ok = () => {
    const v = input.value.trim();
    const good = t.pinHash ? checkPin(profile, v) : +v === a * b;
    if (!good) { msg.hidden = false; msg.textContent = 'To nie ten kod.'; input.value = ''; input.focus(); return; }
    parentUnlock(profile); save && save(profile); onUnlock && onUnlock();
  };
  input.addEventListener('keydown', e => e.key === 'Enter' && ok());
  root.querySelector('[data-a=ok]').onclick = ok;
  root.querySelector('[data-a=back]').onclick = () => onBack && onBack();
}

/* ---------- żart i pożegnanie po misji ---------- */
let jokesCache = null;
async function loadJokes() {
  if (jokesCache) return jokesCache;
  try {
    const r = await fetch('src/story/jokes.json');
    if (r.ok) { const j = await r.json(); if (j && Array.isArray(j.jokes) && j.jokes.length) return (jokesCache = { jokes: j.jokes, bye: j.bye || null }); }
  } catch (e) {}
  return (jokesCache = { jokes: JOKES, bye: null });
}
function playFile(url) {
  return new Promise(res => { if (!url) return res(false); const a = new Audio(url); a.onended = () => res(true); a.onerror = () => res(false); a.play().catch(() => res(false)); });
}
const ANIMS = ['dance', 'jump', 'spin', 'shake', 'wobble'];

export async function farewell(root, { profile, missionId, aegisSay, save, onDone }) {
  const t = teacherState(profile);
  const special = /^sp-/.test(missionId || '');
  if (!special && !String(missionId || '').startsWith('teacher-')) markDone(profile, { mission: missionId });
  autoAnalyze(profile, save).catch(() => {}); // po teście startowym: plan od AI w tle (bez czekania)
  const { jokes, bye } = await loadJokes();
  const j = pickJoke(jokes, t.jokesSeen || []);
  t.jokesSeen = [...(t.jokesSeen || []), j.id].slice(-Math.max(5, jokes.length - 5));
  save && save(profile);
  const g = gate(profile);
  const anim = j.anim || ANIMS[Math.floor(Math.random() * ANIMS.length)];
  root.innerHTML = `<div class="bg" style="background-image:url(assets/gfx/backgrounds/hangar.svg),url(assets/img/hangar.webp)"></div>
    <div class="wrap center tch-bye">
      ${j.img ? `<img class="tch-aegis big" src="${esc(j.img)}" alt="">` : `<img class="tch-aegis big anim-${esc(anim)}" src="assets/img/aegis.webp" alt="AEGIS-7">`}
      <p class="subtitle tch-joke">${esc(j.pl)}</p>
      <button class="btn small" data-a="again" aria-label="Posłuchaj żartu jeszcze raz">🔊</button>
      <div class="tch-seeyou" data-bye hidden>
        <h2>See you tomorrow, Guardian!</h2>
        <p class="subtitle">Widzimy się jutro, Strażniku!</p>
        ${special || g.open ? '' : `<p class="muted">Następna misja: ${esc(when(g.opensAt))}</p>`}
      </div>
      <button class="btn primary big" data-a="next" hidden>Do hangaru ▶</button>
    </div>`;
  const sayJoke = async () => (j.audio ? (await playFile(j.audio)) || (aegisSay && await aegisSay(j.en)) : aegisSay && aegisSay(j.en));
  root.querySelector('[data-a=again]').onclick = () => sayJoke();
  const next = root.querySelector('[data-a=next]');
  next.onclick = () => onDone && onDone();
  setTimeout(() => { next.hidden = false; }, 2500);  // nie trzymamy dziecka, gdy dźwięk nie działa
  await sayJoke();
  if (!root.isConnected) return;
  root.querySelector('[data-bye]').hidden = false;
  next.hidden = false; next.focus();
  const byeText = (bye && bye.en) || 'See you tomorrow, Guardian!';
  if (bye && bye.audio) { if (!(await playFile(bye.audio))) aegisSay && aegisSay(byeText); } else aegisSay && aegisSay(byeText);
}

/* ---------- panel rodzica ---------- */
export function renderParentControls(box, profile, save) {
  if (!box) return;
  const t = teacherState(profile);
  const g = gate(profile);
  const plan = planToday(profile, COURSE);
  const items = Object.entries(t.items).filter(([id, s]) => s.introduced && ITEMS[id]);
  const known = items.filter(([, s]) => s.box >= 3).length;
  const weak = items.filter(([, s]) => s.wrong > s.ok).map(([id]) => ITEMS[id].en);
  const recent = t.history.slice(-7);
  const unlocks7 = t.unlocks.filter(x => x > Date.now() - 7 * 864e5).length;
  const ch = CHAPTERS[0];
  box.innerHTML = `<div class="tch-parent">
    <h3>Nauczyciel AEGIS-7</h3>
    <p>Kurs: <b>dzień ${Math.min(t.day + 1, COURSE.length)} z ${COURSE.length}</b> (rozdział 1: ${esc(ch.title)}). Po rozdziale dziecko umie: ${esc(ch.can)}</p>
    <p>Zwroty: poznane <b>${items.length}</b>, utrwalone <b>${known}</b>${weak.length ? `, sprawiają kłopot: <b>${weak.map(esc).join(', ')}</b>` : ''}.</p>
    <p>Następna misja: <b>${g.open ? 'otwarta' : esc(when(g.opensAt))}</b>${lastDone(profile) ? ` · ostatnia: ${esc(new Date(lastDone(profile)).toLocaleString('pl-PL'))}` : ''}${unlocks7 ? ` · odblokowania przez rodzica w tym tygodniu: ${unlocks7}` : ''}</p>
    ${recent.length ? `<p class="muted">Ostatnie misje: ${recent.map(r => `${new Date(r.at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'numeric' })} ${r.min ? r.min + ' min' : ''}${r.stars ? ' ' + '★'.repeat(r.stars) : ''}`).map(esc).join(' · ')}</p>` : ''}
    <div class="row">
      <label class="row">Przerwa między misjami:
        <select data-rhythm style="font:inherit;font-size:18px;padding:6px 10px;border-radius:10px">
          <option value="12h" ${t.rhythm.mode !== 'morning' ? 'selected' : ''}>12 godzin od końca misji</option>
          <option value="morning" ${t.rhythm.mode === 'morning' ? 'selected' : ''}>do następnego ranka (6:00)</option>
        </select></label>
      ${g.open ? '' : '<button class="btn small" data-unlock>🔓 Otwórz misję teraz</button>'}
    </div>
    <label class="row">Polski lektor:
      <select data-plvoice style="font:inherit;font-size:18px;padding:6px 10px;border-radius:10px">
        <option value="after-wrong" ${t.plVoice !== 'off' ? 'selected' : ''}>tylko podpowiedź po błędzie (zalecane)</option>
        <option value="off" ${t.plVoice === 'off' ? 'selected' : ''}>wyłączony</option>
      </select></label>
    <div class="row">
      <label class="row">PIN rodzica (4–8 cyfr): <input type="password" inputmode="numeric" maxlength="8" data-pinset style="width:140px;font-size:18px;padding:6px 10px;border-radius:10px" placeholder="${t.pinHash ? 'ustawiony' : 'brak'}"></label>
      <button class="btn small" data-pinsave>Zapisz PIN</button>
      ${t.pinHash ? '<button class="btn small" data-pindel>Usuń PIN</button>' : ''}
    </div>
    ${aiSection(profile)}
    <p class="muted">Dalsze rozdziały: ${OUTLINE.map(o => `${esc(o.title)} (tyg. ${esc(o.weeks)})`).join(', ')}.</p>
    <p class="muted">Dziś: ${esc(TYPE_PL[plan.type] || '')}, misja dnia ${plan.number}.</p>
  </div>`;
  const re = () => renderParentControls(box, profile, save);
  box.querySelector('[data-rhythm]').onchange = e => { t.rhythm = e.target.value === 'morning' ? { mode: 'morning' } : { mode: '12h', hours: 12 }; save && save(profile); re(); };
  box.querySelector('[data-plvoice]').onchange = e => { t.plVoice = e.target.value; save && save(profile); };
  const un = box.querySelector('[data-unlock]'); if (un) un.onclick = () => { parentUnlock(profile); save && save(profile); re(); };
  box.querySelector('[data-pinsave]').onclick = () => {
    const v = box.querySelector('[data-pinset]').value.trim();
    if (!/^\d{4,8}$/.test(v)) { box.querySelector('[data-pinset]').value = ''; box.querySelector('[data-pinset]').placeholder = '4–8 cyfr'; return; }
    setPin(profile, v); save && save(profile); re();
  };
  const del = box.querySelector('[data-pindel]'); if (del) del.onclick = () => { setPin(profile, null); save && save(profile); re(); };
  bindAi(box, profile, save, re);
}

/* ---------- AEGIS AI w panelu rodzica ---------- */
const sel = 'font:inherit;font-size:18px;padding:6px 10px;border-radius:10px';
function aiSection(profile) {
  const t = teacherState(profile);
  const c = aiConfig();
  const p = t.aiPlan;
  const log = (t.aiLog || []).slice(-5).reverse();
  return `<details class="tch-ai" ${aiConfigured() ? '' : 'open'}>
    <summary><b>AEGIS AI: rozmowa i plan nauki</b> ${aiConfigured() ? (t.ai === 'off' ? '(wyłączone)' : '(włączone)') : '(nieskonfigurowane)'}</summary>
    <p class="muted">Adres serwera i hasło gry z instrukcji <code>server/README.md</code>. Klucz API zostaje na serwerze, tu go nie wpisuj.</p>
    <div class="row">
      <label class="row">Adres serwera: <input type="url" data-aiurl value="${esc(c.url || '')}" placeholder="https://aegis-teacher.….workers.dev" style="width:320px;${sel}"></label>
      <label class="row">Hasło gry: <input type="password" data-aitoken value="${esc(c.token || '')}" autocomplete="off" style="width:180px;${sel}"></label>
      <button class="btn small" data-aisave>Zapisz i sprawdź</button>
    </div>
    <p data-aistatus class="muted"></p>
    ${aiConfigured() ? `<div class="row">
      <label class="row">Rozmowa z AI w Misji dnia:
        <select data-aion style="${sel}"><option value="on" ${t.ai !== 'off' ? 'selected' : ''}>włączona</option><option value="off" ${t.ai === 'off' ? 'selected' : ''}>wyłączona</option></select></label>
      <label class="row">Odpowiedź głosem (mikrofon):
        <select data-aimic style="${sel}"><option value="off" ${t.aiMic !== 'on' ? 'selected' : ''}>wyłączona</option><option value="on" ${t.aiMic === 'on' ? 'selected' : ''}>włączona</option></select></label>
    </div>
    <p class="muted">Mikrofon używa rozpoznawania mowy przeglądarki (w Chrome nagranie przetwarza Google). Bez mikrofonu dziecko klika podpowiedź albo pisze.</p>
    <div class="row"><button class="btn small" data-aianalyze>${p ? 'Przeanalizuj ponownie' : 'Przeanalizuj test startowy i postępy'}</button>
      ${profile.calibration ? '' : '<span class="muted">Najpierw test startowy (bez niego AI oceni tylko misje).</span>'}</div>
    <p data-aimsg class="muted"></p>
    ${p ? `<div class="tch-aiplan"><p><b>Plan od AI</b> (${esc(new Date(p.at).toLocaleString('pl-PL'))}): ${esc(p.notes || '')}</p>
      <p class="muted">Nowe zwroty dziennie: <b>${p.newPerDay}</b> · długość misji: <b>${esc(String(p.minutes || 12))} min</b> · ćwiczone dźwięki: <b>${esc((p.focus || []).map(k => CONTRASTS[k] ? `${CONTRASTS[k].a.en}/${CONTRASTS[k].b.en}` : k).join(', ') || 'jak w kursie')}</b>${p.slowVoice ? ' · AI radzi włączyć wolny głos w ustawieniach' : ''}</p>
      ${(p.tips || []).length ? `<ul>${p.tips.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</div>` : ''}
    ${log.length ? `<details><summary>Ostatnie rozmowy z AEGIS-em (${log.length})</summary>${log.map(l => `<p class="muted">${esc(new Date(l.at).toLocaleString('pl-PL'))}, misja ${esc(String(l.day))}</p><ul>${(l.turns || []).map(x => `<li>${x.who === 'child' ? '<b>Dziecko:</b>' : 'AEGIS:'} ${esc(x.text)}</li>`).join('')}</ul>`).join('')}</details>` : ''}` : ''}
  </details>`;
}
function bindAi(box, profile, save, re) {
  const t = teacherState(profile);
  const st = box.querySelector('[data-aistatus]');
  const showStatus = () => aiStatus().then(r => {
    if (!st.isConnected) return;
    st.textContent = r.error ? `⚠️ ${aiErrorPl(r.error)}` : `✅ Połączono. Wydano ${r.spentUsd.toFixed(2)} z ${r.budgetUsd} USD (dziś ${r.todayUsd.toFixed(2)} z ${r.dailyUsd} USD).`;
  });
  if (aiConfigured()) showStatus();
  box.querySelector('[data-aisave]').onclick = () => {
    setAiConfig({ url: box.querySelector('[data-aiurl]').value, token: box.querySelector('[data-aitoken]').value });
    re();
  };
  const on = box.querySelector('[data-aion]'); if (on) on.onchange = e => { t.ai = e.target.value; save && save(profile); re(); };
  const mic = box.querySelector('[data-aimic]'); if (mic) mic.onchange = e => { t.aiMic = e.target.value; save && save(profile); };
  const an = box.querySelector('[data-aianalyze]');
  if (an) an.onclick = async () => {
    an.disabled = true; const msg = box.querySelector('[data-aimsg]'); msg.textContent = 'AI analizuje (do minuty)…';
    const r = await aiAnalyze(profile);
    if (r.error) { an.disabled = false; msg.textContent = `⚠️ ${aiErrorPl(r.error)}`; return; }
    save && save(profile); re();
  };
}
