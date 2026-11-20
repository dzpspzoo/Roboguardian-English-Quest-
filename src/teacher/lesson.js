// Misja dnia: jedna lekcja Nauczyciela AEGIS-7 w 8 krokach (ok. 14 min).
// przypomnienie → zadanie AEGIS-a → pokaz → para dźwięków → powiedz → scenka → napisz → koniec (żart robi farewell)
// Interfejs jak misja: mountLesson(root, ctx, plan) -> sprzątanie; na końcu ctx.done({...}).
import { ITEMS, CONTRASTS, COURSE, PART_ORDER } from './curriculum.js';
import { teacherState, itemState, introduce, review, finishToday, tired as tiredBase, lessonMinutes } from './schedule.js';
import { aiReady, aiChat, logTalk } from './ai.js';
import { makeVoice, pause } from './voice.js';

class Stop extends Error {}
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pickOne = a => a[Math.floor(Math.random() * a.length)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}

const STEPS = [
  ['recall', 'Przypomnienie'], ['goal', 'Zadanie'], ['show', 'Pokaz'], ['sounds', 'Dźwięki'],
  ['speak', 'Powiedz'], ['scene', 'Scenka'], ['write', 'Napisz'], ['end', 'Koniec'],
];

export function mountLesson(root, ctx, plan) {
  const voice = makeVoice(ctx);
  const profile = ctx.profile;
  // Prowadzenie misji po angielsku (dziecko osłuchuje się z głosem), polskie napisy do czytania.
  // Polski lektor tylko jako podpowiedź PO BŁĘDZIE, bez przycisku dla dziecka (decyzja rodzica).
  // Ustawienie rodzica: 'after-wrong' (domyślne) albo 'off'. Wartość 'always' z wcześniejszej wersji traktujemy jak 'after-wrong'.
  const plMode = teacherState(profile).plVoice === 'off' ? 'off' : 'after-wrong';
  const plTip = text => (plMode === 'after-wrong' ? voice.pl(text) : Promise.resolve());
  const aegisBoth = async (en) => { await voice.aegis(en); };
  const t0 = Date.now();
  const limitMin = lessonMinutes(profile);
  const tired = (a, ms) => tiredBase(a, ms, limitMin);
  const answers = [];
  let alive = true;
  const good = new Set(), hard = new Set();
  const check = () => { if (!alive) throw new Stop(); };
  const sfx = id => { try { ctx.audio && ctx.audio.sfx && ctx.audio.sfx(id); } catch (e) {} };

  root.classList.add('tch');
  const top = h('div', { class: 'tch-top' });
  const body = h('div', { class: 'tch-body' });
  const exit = h('button', { class: 'iconbtn', 'aria-label': 'Wyjdź do hangaru', title: 'Wyjdź do hangaru', onclick: () => { alive = false; voice.stop(); ctx.exit ? ctx.exit() : null; } }, '✕');
  root.replaceChildren(h('div', { class: 'bg', style: 'background-image:url(assets/gfx/backgrounds/hangar.svg),url(assets/img/hangar.webp)' }), h('div', { class: 'tch-bar' }, exit, top), body);

  const stepsOn = new Set();
  function header(stepId) {
    const idx = STEPS.findIndex(s => s[0] === stepId);
    stepsOn.add(stepId);
    top.replaceChildren(h('div', { class: 'tch-steps', role: 'list', 'aria-label': 'Kroki misji' },
      STEPS.map(([id, label], i) => h('span', { role: 'listitem', class: `tch-step${i < idx ? ' done' : ''}${i === idx ? ' now' : ''}`, title: label }, i < idx ? '✓' : String(i + 1)))),
      h('span', { class: 'tch-steplabel' }, STEPS[idx][1]),
      h('span', { class: 'tch-day' }, `Mission ${plan.number}`));
  }
  function screen(...kids) { body.replaceChildren(h('div', { class: 'tch-card' }, ...kids)); }
  function waitClick(btn) { return new Promise(res => btn.addEventListener('click', () => { sfx('click'); res(); }, { once: true })); }
  function nextBtn(label = 'Dalej ▶') { return h('button', { class: 'btn primary big', autofocus: true }, label); }
  function aegisRow(en, pl) {
    const img = h('img', { class: 'tch-aegis', src: 'assets/img/aegis.webp', alt: 'AEGIS-7' });
    const again = h('button', { class: 'btn small', 'aria-label': 'Posłuchaj jeszcze raz', onclick: () => voice.aegis(en) }, '🔊');
    return h('div', { class: 'tch-aegisrow' }, img, h('div', { class: 'tch-bubble' }, h('p', { class: 'tch-pl' }, pl), again));
  }
  const rec = (ev) => { try { ctx.record && ctx.record({ mission: 'teacher', level: plan.number, ...ev }); } catch (e) {} };

  // Pytanie z wyborem. Po 1. błędzie: wyjaśnienie + posłuchaj jeszcze raz; po 2.: podświetlenie dobrej.
  async function choose({ prompt, options, correct, play, tip, item, skill, mode, ask }) {
    const started = Date.now();
    let wrong = 0;
    const tipBox = h('p', { class: 'tch-tip', hidden: true });
    const btns = options.map(o => h('button', { class: 'tch-opt' }, o.icon ? h('span', { class: 'tch-ico' }, o.icon) : null,
      o.en ? h('span', { class: 'tch-en' }, o.en) : null, o.pl ? h('span', { class: 'tch-optpl' }, o.pl) : null));
    const replay = play ? h('button', { class: 'btn', onclick: () => play() }, '🔊 Posłuchaj') : null;
    screen(prompt, replay, h('div', { class: `tch-opts n${options.length}` }, btns), tipBox);
    if (ask) { await voice.aegis(ask); check(); }
    if (play) { await pause(250); check(); await play(); }
    return new Promise((res, rej) => {
      btns.forEach((b, i) => b.addEventListener('click', async () => {
        if (!alive) return rej(new Stop());
        const ok = options[i].value === correct;
        if (ok) {
          sfx('correct'); b.classList.add('ok'); btns.forEach(x => x.disabled = true);
          const firstTry = wrong === 0;
          answers.push({ ok: firstTry, ms: Date.now() - started });
          rec({ item, skill, mode, ok: firstTry, ms: Date.now() - started, opts: options.length, hint: wrong > 0 });
          if (options[i].after) { try { await options[i].after(); } catch (e) {} }
          await pause(500); res(firstTry);
        } else {
          wrong++; sfx('wrong'); b.classList.add('no'); b.disabled = true;
          answers.push({ ok: false, ms: Date.now() - started });
          if (tip) { tipBox.hidden = false; tipBox.innerHTML = esc(tip); await plTip(tip); }
          if (wrong >= 2) btns.forEach((x, k) => { if (options[k].value === correct) x.classList.add('hint'); });
          if (play) { await pause(300); await play(); }
        }
      }));
    });
  }

  const asked = new Set();
  const firstAsk = q => (asked.has(q) ? null : (asked.add(q), q));
  const itemOpt = id => ({ value: id, icon: ITEMS[id].icon, pl: ITEMS[id].pl });
  const learned = () => Object.keys(teacherState(profile).items).filter(id => ITEMS[id] && teacherState(profile).items[id].introduced);

  /* ---------- 1. przypomnienie ---------- */
  async function stepRecall(ids) {
    header('recall');
    if (!ids.length) return;
    screen(aegisRow('Let us remember!', 'Najpierw przypomnijmy sobie, co już umiesz.'), h('p', { class: 'muted' }, `${ids.length} zwrot${ids.length === 1 ? '' : 'y'} do przypomnienia`));
    await aegisBoth('Let us remember!', 'Najpierw przypomnijmy sobie, co już umiesz.'); check(); await pause(400);
    for (const id of shuffle(ids)) {
      check();
      const st = itemState(profile, id);
      const pool = learned().filter(x => x !== id);
      const n = st.box >= 2 ? 3 : 2;
      const others = shuffle(pool).slice(0, n - 1);
      const it = ITEMS[id];
      let ok;
      if (st.stage >= 2) {
        // zna już ze słuchu: widzi polski, wybiera angielski zapis (czytanie), potem słyszy
        ok = await choose({ prompt: h('h2', { class: 'tch-q' }, h('span', { class: 'tch-ico' }, it.icon), ' ', it.pl), item: id, skill: 'reading', mode: 'read',
          options: shuffle([id, ...others]).map(x => ({ value: x, en: ITEMS[x].en, after: x === id ? () => voice.play(it.en) : null })), correct: id });
        review(profile, id, ok, { mode: 'say' });
      } else {
        ok = await choose({ prompt: h('h2', { class: 'tch-q' }, 'Co to znaczy?'), ask: firstAsk('What does it mean?'), play: () => voice.play(it.en, { voice: Math.floor(Math.random() * 3) }),
          item: id, skill: 'vocab', mode: 'listen', options: shuffle([id, ...others]).map(itemOpt), correct: id, tip: `To „${it.pl}”.` });
        review(profile, id, ok, { mode: 'recognize' });
      }
      (ok ? good : hard).add(it.en);
    }
  }

  /* ---------- 2. zadanie AEGIS-a ---------- */
  async function stepGoal(goal) {
    header('goal');
    const b = nextBtn('Zaczynamy ▶');
    screen(aegisRow(goal.en, goal.pl), b);
    aegisBoth(goal.en, goal.pl);
    await waitClick(b); check();
  }

  /* ---------- 3. pokaz nowych zwrotów ---------- */
  async function stepShow(ids) {
    header('show');
    for (const id of ids) {
      check();
      const it = ITEMS[id];
      introduce(profile, id);
      const again = h('button', { class: 'btn', onclick: () => voice.series(it.en, [0, 1, 2], () => alive) }, '🔊 Jeszcze raz');
      const slow = h('button', { class: 'btn', onclick: () => voice.play(it.en, { slow: true }) }, '🐢 Wolno');
      const b = nextBtn(); b.disabled = true;
      if (!asked.has('show')) { asked.add('show'); await voice.aegis('New words. Listen!'); check(); }
      screen(h('p', { class: 'muted' }, 'Nowy zwrot. Posłuchaj w kilku głosach.'),
        h('div', { class: 'tch-show' }, h('span', { class: 'tch-ico big' }, it.icon), h('span', { class: 'tch-en big' }, it.en), h('span', { class: 'tch-pl' }, it.pl)),
        h('div', { class: 'row', style: 'justify-content:center' }, again, slow), b);
      await pause(900); check();
      await voice.series(it.en, [0, 1, 2], () => alive); check();
      await voice.play(it.en, { slow: true }); check();
      b.disabled = false; b.focus();
      await waitClick(b);
    }
    // szybkie sprawdzenie: najpierw 2 opcje (bez błędów na start), potem wszystkie nowe
    for (const [k, id] of shuffle(ids).entries()) {
      check();
      const others = shuffle(ids.filter(x => x !== id)).slice(0, k === 0 ? 1 : 2);
      const ok = await choose({ prompt: h('h2', { class: 'tch-q' }, 'Który to?'), ask: firstAsk('Which one?'), play: () => voice.play(ITEMS[id].en, { voice: (k + 1) % 3 }),
        options: shuffle([id, ...others]).map(itemOpt), correct: id, item: id, skill: 'listening', mode: 'listen', tip: `To „${ITEMS[id].pl}”.` });
      (ok ? good : hard).add(ITEMS[id].en);
    }
  }

  /* ---------- 4. para dźwięków ---------- */
  async function stepSounds(key) {
    const c = CONTRASTS[key]; if (!c) return;
    header('sounds');
    const both = async () => { await voice.play(c.a.en); await pause(300); await voice.play(c.b.en); };
    const b = nextBtn('Gram ▶');
    screen(aegisRow('Listen. Two words, two sounds.', 'Posłuchaj: dwa słowa, dwa różne dźwięki.'),
      h('div', { class: 'tch-pair' }, [c.a, c.b].map(w => h('button', { class: 'tch-opt', onclick: () => voice.play(w.en) }, h('span', { class: 'tch-ico' }, w.icon), h('span', { class: 'tch-en' }, w.en), h('span', { class: 'tch-optpl' }, w.pl)))),
      h('p', { class: 'tch-tip' }, c.tip), b);
    await aegisBoth('Listen. Two words, two sounds.', 'Posłuchaj: dwa słowa, dwa różne dźwięki.'); check();
    await both(); check();
    await waitClick(b);
    const seq = shuffle(['a', 'a', 'a', 'b', 'b', 'b']);
    for (const [k, side] of seq.entries()) {
      check();
      if (tired(answers, Date.now() - t0)) return;
      const w = c[side];
      const ok = await choose({ prompt: h('h2', { class: 'tch-q' }, 'Które słowo słyszysz?'), ask: firstAsk('Which word do you hear?'), play: () => voice.play(w.en, { voice: k % 4 }),
        options: [c.a, c.b].map((x, i) => ({ value: i ? 'b' : 'a', icon: x.icon, en: x.en, pl: x.pl })), correct: side,
        item: w.en, skill: `phoneme.${c.sound}`, mode: 'listen', tip: c.tip });
      (ok ? good : hard).add(`${c.a.en} / ${c.b.en}`);
    }
  }

  /* ---------- 5. powiedz i nagraj ---------- */
  async function recordOnce(ms = 3500) {
    if (!navigator.mediaDevices || !window.MediaRecorder) return null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream); const chunks = [];
      mr.ondataavailable = e => chunks.push(e.data);
      const done = new Promise(r => mr.onstop = r);
      mr.start(); await pause(ms); mr.stop(); await done;
      stream.getTracks().forEach(tr => tr.stop());
      return URL.createObjectURL(new Blob(chunks, { type: mr.mimeType || 'audio/webm' }));
    } catch (e) { return null; }
  }
  async function stepSpeak(ids) {
    if (!ids.length) return;
    header('speak');
    for (const id of ids) {
      check();
      if (tired(answers, Date.now() - t0)) return;
      const it = ITEMS[id];
      let tries = 0, done = false;
      while (!done && tries < 3) {
        check(); tries++;
        const status = h('p', { class: 'muted' }, 'Posłuchaj, potem kliknij mikrofon i powiedz to samo.');
        const mic = h('button', { class: 'btn primary big' }, '🎤 Mówię');
        const listen = h('button', { class: 'btn', onclick: () => voice.play(it.en) }, '🔊 Posłuchaj');
        screen(h('div', { class: 'tch-show' }, h('span', { class: 'tch-ico big' }, it.icon), h('span', { class: 'tch-en big' }, it.en), h('span', { class: 'tch-pl' }, it.pl)),
          status, h('div', { class: 'row', style: 'justify-content:center' }, listen, mic));
        await voice.play(it.en); check();
        await waitClick(mic); check();
        mic.disabled = true; mic.textContent = '🔴 Nagrywam… mów teraz'; status.textContent = 'Powiedz głośno i wyraźnie.';
        const url = await recordOnce(); check();
        if (url) {
          status.textContent = 'Najpierw Ty, potem lektor. Brzmi podobnie?';
          await new Promise(r => { const a = new Audio(url); a.onended = r; a.onerror = r; a.play().catch(r); });
          await pause(250); await voice.play(it.en); check();
        } else {
          status.textContent = 'Mikrofon nie działa, więc powiedz to na głos. Brzmiało podobnie?';
        }
        const yes = h('button', { class: 'btn primary' }, '👍 Podobnie');
        const again = h('button', { class: 'btn' }, '🔁 Jeszcze raz');
        mic.replaceWith(h('span', {}, yes, ' ', again));
        const pickYes = await new Promise(r => { yes.onclick = () => r(true); again.onclick = () => r(false); });
        sfx(pickYes ? 'correct' : 'click');
        if (pickYes || tries >= 3) {
          done = true;
          rec({ item: id, skill: 'speaking', mode: 'speak', ok: pickYes && tries === 1, ms: 0, opts: 0, hint: tries > 1, selfRated: true });
          review(profile, id, pickYes && tries === 1, { mode: 'say' });
        }
      }
    }
  }

  /* ---------- 6. scenka z AEGIS-em ---------- */
  async function stepScene(lines) {
    if (!lines || !lines.length) return;
    header('scene');
    for (const [k, line] of lines.entries()) {
      check();
      const correct = line.options[line.answer || 0];
      const opts = shuffle(line.options).map(o => ({ value: o, en: o, after: o === correct ? async () => { await voice.play(o); if (line.reply) { await pause(250); await voice.aegis(line.reply); } } : null }));
      const prompt = aegisRow(line.aegis.en, line.aegis.pl);
      const said = aegisBoth(line.aegis.en, line.aegis.pl).then(() => k === 0 && voice.aegis('What do you say?'));
      const ok = await choose({ prompt: h('div', {}, prompt, h('p', { class: 'muted' }, 'Co odpowiesz? Kliknij odpowiedź.')), options: opts, correct,
        item: correct, skill: 'dialog', mode: 'choose', tip: `AEGIS mówi: „${line.aegis.pl}”. Pasuje: „${correct}”.` });
      await said;
      (ok ? good : hard).add(correct);
      if (k === lines.length - 1) await pause(300);
    }
  }

  /* ---------- 6b. rozmowa z AEGIS-em (AI) ---------- */
  // Tylko gdy rodzic skonfigurował serwer AI. Dziecko odpowiada: kafelkiem z podpowiedzią, pisząc albo głosem
  // (rozpoznawanie mowy przeglądarki, gdy rodzic je włączył). Błąd sieci = krok się po prostu kończy.
  function recognizer() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || teacherState(profile).aiMic !== 'on') return null;
    return () => new Promise(res => {
      try {
        const r = new SR(); r.lang = 'en-US'; r.interimResults = false; r.maxAlternatives = 1;
        let got = '';
        r.onresult = e => { got = (e.results[0] && e.results[0][0] && e.results[0][0].transcript) || ''; };
        r.onerror = () => res(''); r.onend = () => res(got);
        r.start(); setTimeout(() => { try { r.stop(); } catch (e) {} }, 6000);
      } catch (e) { res(''); }
    });
  }
  // maxTurns = liczba wypowiedzi AEGIS-a razem z pożegnaniem (dziecko odpowiada maxTurns - 1 razy).
  async function stepTalk(topic, maxTurns) {
    if (!aiReady(profile)) return;
    header('scene');
    const history = [];
    const listen = recognizer();
    screen(h('p', { class: 'muted' }, 'AEGIS się zastanawia…'));
    let res = await aiChat(profile, { topic, history, child: '', turn: 1, maxTurns }); check();
    if (!res || res.error || !res.reply) return;
    for (let turn = 1; turn <= maxTurns + 1; turn++) {
      history.push({ who: 'aegis', text: res.reply });
      const said = voice.aegis(res.reply);
      const input = h('input', { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Napisz odpowiedź po angielsku', placeholder: 'Napisz po angielsku…' });
      let pick = null;
      const answer = new Promise(r => { pick = r; });
      const send = h('button', { class: 'btn primary' }, 'Wyślij ✔');
      send.onclick = () => input.value.trim() && pick({ text: input.value.trim(), mode: 'write' });
      input.addEventListener('keydown', e => { if (e.key === 'Enter' && input.value.trim()) pick({ text: input.value.trim(), mode: 'write' }); });
      const tiles = (res.suggestions || []).map(sug => h('button', { class: 'tch-opt', onclick: async () => { sfx('click'); await voice.play(sug); pick({ text: sug, mode: 'choose' }); } }, h('span', { class: 'tch-en' }, sug)));
      const mic = listen ? h('button', { class: 'btn', onclick: async () => {
        mic.disabled = true; mic.textContent = '🎙️ Słucham…';
        const heard = await listen(); mic.disabled = false; mic.textContent = '🎙️ Powiedz';
        if (heard) pick({ text: heard, mode: 'say' });
      } }, '🎙️ Powiedz') : null;
      screen(aegisRow(res.reply, res.reply_pl),
        h('p', { class: 'tch-en' }, res.reply),
        res.end ? null : h('p', { class: 'muted' }, 'Odpowiedz AEGIS-owi: kliknij, powiedz albo napisz.'),
        res.end ? null : h('div', { class: `tch-opts n${tiles.length}` }, tiles),
        res.end ? null : h('div', { class: 'row' }, mic, input, send));
      if (res.end || turn > maxTurns) { await said; check(); await pause(1200); break; }
      const started = Date.now();
      const a = await answer; check();
      await said;
      history.push({ who: 'child', text: a.text });
      screen(h('p', { class: 'tch-en big' }, a.text), h('p', { class: 'muted' }, 'AEGIS się zastanawia…'));
      res = await aiChat(profile, { topic, history, child: a.text, turn: turn + 1, maxTurns }); check();
      if (!res || res.error || !res.reply) break;
      rec({ item: 'ai-talk', skill: 'dialog', mode: a.mode, ok: !!res.understood, ms: Date.now() - started, opts: a.mode === 'choose' ? 3 : 0, hint: false, chosen: a.text.slice(0, 60) });
      if (res.understood) good.add(a.text.slice(0, 40));
      if (res.better && a.mode !== 'choose') {
        // poprawna wersja zdania: pokaz i posłuchaj (bez słowa „źle”)
        const b = nextBtn();
        screen(h('p', { class: 'muted' }, res.understood ? 'AEGIS zrozumiał! Tak mówi się najlepiej:' : 'Spróbujmy tak:'),
          h('p', { class: 'tch-en big' }, res.better), b);
        if (!res.understood && res.hint_pl) await plTip(res.hint_pl); check();
        await voice.play(res.better); check();
        await waitClick(b); check();
      } else if (!res.understood && res.hint_pl) { await plTip(res.hint_pl); check(); }
    }
    logTalk(profile, { day: plan.number, turns: history });
  }

  /* ---------- 7. napisz zdanie ---------- */
  const norm = s => String(s).toLowerCase().replace(/[’`´]/g, "'").replace(/[.!?,]/g, '').replace(/\s+/g, ' ').trim();
  function diff(target, typed) {
    const a = target.split(''), b = typed.split('');
    return a.map((ch, i) => h('span', { class: (b[i] || '').toLowerCase() === ch.toLowerCase() ? 'ok' : 'no' }, ch));
  }
  async function stepWrite(target) {
    if (!target) return;
    header('write');
    // 1) popatrz i posłuchaj
    const ready = nextBtn('Zapamiętałem ▶');
    screen(h('p', { class: 'muted' }, 'Popatrz, posłuchaj i zapamiętaj.'), h('p', { class: 'tch-en big' }, target),
      h('button', { class: 'btn', onclick: () => voice.play(target) }, '🔊 Posłuchaj'), ready);
    await voice.aegis('Look, listen and remember.'); check();
    await voice.play(target); check();
    await waitClick(ready); check();
    // 2) zasłoń i napisz; po błędzie: pokaż różnicę, potem przepisz
    for (let attempt = 1; attempt <= 3; attempt++) {
      check();
      const copy = attempt === 3;
      const input = h('input', { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Napisz zdanie', autofocus: true });
      const ok = h('button', { class: 'btn primary big' }, 'Sprawdź ✔');
      screen(h('p', { class: 'muted' }, copy ? 'Przepisz uważnie, litera po literze.' : 'Napisz z pamięci. Wielkie litery i kropki nie mają znaczenia.'),
        copy ? h('p', { class: 'tch-en big' }, target) : null,
        h('button', { class: 'btn', onclick: () => voice.play(target) }, '🔊 Posłuchaj'), input, ok);
      input.focus();
      const started = Date.now();
      await new Promise(r => { ok.onclick = r; input.addEventListener('keydown', e => e.key === 'Enter' && r()); }); check();
      const right = norm(input.value) === norm(target);
      rec({ item: target, skill: 'spelling', mode: 'write', ok: right && attempt === 1, ms: Date.now() - started, opts: 0, hint: attempt > 1, chosen: input.value.slice(0, 60) });
      answers.push({ ok: right, ms: Date.now() - started });
      if (right) { sfx('correct'); (attempt === 1 ? good : hard).add(target); break; }
      sfx('wrong'); hard.add(target);
      const b = nextBtn(attempt < 2 ? 'Spróbuję jeszcze raz ▶' : 'Przepiszę ▶');
      screen(h('p', {}, 'Prawie! Zielone litery masz dobrze, pomarańczowe popraw:'), h('p', { class: 'tch-diff' }, diff(target, input.value.trim())),
        h('p', { class: 'muted' }, `Ty: ${input.value || '(puste)'}`), b);
      await plTip('Prawie! Zielone litery masz dobrze, pomarańczowe popraw.'); check();
      await voice.play(target); check();
      await waitClick(b);
    }
    for (const id of plan.newIds) if (ITEMS[id] && norm(ITEMS[id].en).length && norm(target).includes(norm(ITEMS[id].en))) review(profile, id, true, { mode: 'write' });
  }

  /* ---------- przebieg ---------- */
  (async () => {
    try {
      const d = plan.day;
      const pastDays = COURSE.slice(0, Math.max(plan.index, 0));
      if (plan.type === 'learn') {
        await stepRecall(plan.reviewIds);
        await stepGoal(d.goal);
        await stepShow(plan.newIds);
        if (!tired(answers, Date.now() - t0)) await stepSounds(d.contrast);
        if (!tired(answers, Date.now() - t0)) await stepSpeak(plan.newIds);
        await stepScene(d.scene);
        if (!tired(answers, Date.now() - t0)) await stepTalk(d.goal && d.goal.en, 3);
        await stepWrite(d.write);
      } else if (plan.type === 'talk') {
        await stepGoal(d.goal);
        await stepRecall(plan.reviewIds.slice(0, 3));
        await stepScene(d.scene);
        await stepTalk(d.goal && d.goal.en, 5);
        if (!tired(answers, Date.now() - t0)) await stepSpeak(shuffle(learned()).slice(0, 2));
        await stepWrite(d.write);
      } else {
        const goal = plan.comeback ? { en: 'Welcome back, Guardian! Let us remember.', pl: 'Witaj z powrotem, Strażniku! Przypomnijmy sobie.' } : d.goal;
        await stepGoal(goal);
        await stepRecall(plan.reviewIds);
        const contrasts = [...new Set(pastDays.map(x => x.contrast).filter(Boolean))];
        // plan AI: najpierw dźwięki, które według analizy sprawiają najwięcej kłopotu
        const focus = ((teacherState(profile).aiPlan || {}).focus || []).filter(k => CONTRASTS[k]);
        const pickSound = focus.length ? pickOne(focus) : contrasts.length ? pickOne(contrasts) : null;
        if (pickSound && !tired(answers, Date.now() - t0)) await stepSounds(pickSound);
        const writes = pastDays.map(x => x.write).filter(Boolean);
        await stepWrite(writes.length ? pickOne(writes) : null);
      }
      check();
      header('end');
      const firsts = answers.filter(a => a.ok).length, total = Math.max(1, answers.length);
      const ratio = firsts / total;
      const stars = ratio >= 0.8 ? 3 : ratio >= 0.5 ? 2 : 1;
      const part = finishToday(profile, plan, { stars, minutes: (Date.now() - t0) / 60e3, partOrder: PART_ORDER });
      sfx('level_up');
      ctx.done({
        stars, parts: part ? [part] : [], partEarned: part || false, rewardEarned: !!part,
        summary: { good: [...good].slice(0, 6), hard: [...hard].filter(x => !good.has(x)).slice(0, 4), final: !!d.final,
          cheer: { en: 'Great job, Guardian! My memory is stronger now.', pl: 'Świetna robota, Strażniku! Moja pamięć jest teraz silniejsza.' } },
      });
    } catch (e) {
      if (!(e instanceof Stop)) console.error('Nauczyciel:', e);
    }
  })();

  return () => { alive = false; voice.stop(); };
}
