// Panel rodzica: raport asystenta AEGIS-7. Użycie w rdzeniu:
//   import { renderParentPanel } from '../assistant/panel.js';
//   renderParentPanel(rootEl, profile);
import RGAssistant from './assistant.js';

const CSS = `
.rga{font-family:var(--font-ui,system-ui,sans-serif);color:var(--text,#e8f1ff);max-width:860px;margin:0 auto;line-height:1.45}
.rga h2{font-size:1.4rem;margin:0 0 .3rem}.rga h3{font-size:1.05rem;margin:1.2rem 0 .5rem}
.rga .rga-sub{opacity:.75;margin:0 0 1rem}
.rga .rga-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.6rem}
.rga .rga-tile{background:var(--panel,#13233d);border-radius:12px;padding:.7rem .9rem}
.rga .rga-tile b{display:block;font-size:1.5rem}.rga .rga-tile span{opacity:.75;font-size:.85rem}
.rga .rga-card{background:var(--panel,#13233d);border-left:4px solid var(--accent,#3fb6ff);border-radius:10px;padding:.7rem .9rem;margin:.5rem 0}
.rga .rga-card.s3{border-color:#ff6b6b}.rga .rga-card.s2{border-color:#ffb547}.rga .rga-card.s1{border-color:#7fd1ff}
.rga .rga-card p{margin:.25rem 0}.rga .rga-card .rga-ev{opacity:.8;font-size:.9rem}
.rga .rga-good{background:var(--panel,#13233d);border-left:4px solid #4cd38a;border-radius:10px;padding:.5rem .9rem;margin:.4rem 0}
.rga table{width:100%;border-collapse:collapse;font-size:.92rem}
.rga td,.rga th{padding:.35rem .4rem;border-bottom:1px solid rgba(255,255,255,.08);text-align:left}
.rga .rga-bar{height:8px;border-radius:4px;background:rgba(255,255,255,.1);overflow:hidden;min-width:80px}
.rga .rga-bar i{display:block;height:100%;background:var(--accent,#3fb6ff)}
.rga button{font:inherit;min-height:48px;padding:.6rem 1rem;border-radius:10px;border:0;background:var(--accent,#3fb6ff);color:#04121f;font-weight:600;cursor:pointer;margin:.3rem .4rem .3rem 0}
.rga button.ghost{background:transparent;color:inherit;border:1px solid rgba(255,255,255,.3)}
.rga textarea{width:100%;min-height:180px;margin-top:.5rem;background:#0a1628;color:inherit;border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:.6rem;font:12px/1.4 ui-monospace,monospace;box-sizing:border-box}
.rga .rga-note{font-size:.85rem;opacity:.75}
`;

function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function pct(x) { return x == null ? '–' : Math.round(x * 100) + '%'; }

export function renderParentPanel(root, profile, opts = {}) {
  if (!document.getElementById('rga-css')) {
    const st = document.createElement('style'); st.id = 'rga-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  const name = opts.name || profile.name || 'Dziecko';
  const { analysis: a } = RGAssistant.report(profile, { name });
  const s = a.stats;
  if (!s.answers) {
    root.innerHTML = `<div class="rga"><h2>Raport AEGIS-7: ${esc(name)}</h2><p class="rga-sub">Raport pojawi się po pierwszej misji.</p></div>`;
    return;
  }
  const skills = s.skills.filter(k => k.n >= 3).sort((x, y) => x.recent - y.recent);
  root.innerHTML = `<div class="rga">
    <h2>Raport AEGIS-7: ${esc(name)}</h2>
    <p class="rga-sub">Analiza działa w tej przeglądarce. Wyniki nie są nigdzie wysyłane.</p>
    <div class="rga-tiles">
      <div class="rga-tile"><b>${s.level} / 5</b><span>poziom gry</span></div>
      <div class="rga-tile"><b>${pct(s.accuracy)}</b><span>dobrych za 1. razem</span></div>
      <div class="rga-tile"><b>${s.itemsMastered} / ${s.itemsSeen}</b><span>słów zapamiętanych</span></div>
      <div class="rga-tile"><b>${s.activeDays7}</b><span>dni nauki w tygodniu</span></div>
    </div>
    ${a.strengths.length ? `<h3>Co idzie dobrze</h3>${a.strengths.map(x => `<div class="rga-good">${esc(x.text)}</div>`).join('')}` : ''}
    ${a.problems.length ? `<h3>Na co zwrócić uwagę</h3>${a.problems.map(p => `<div class="rga-card s${p.severity}">
        <p><b>${esc(p.title)}</b></p><p class="rga-ev">${esc(p.evidence)}</p>
        <p>👪 ${esc(p.action)}</p>${p.game ? `<p class="rga-ev">🤖 ${esc(p.game)}</p>` : ''}</div>`).join('')}` : ''}
    <h3>Plan na ten tydzień</h3><ol>${a.plan.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
    ${skills.length ? `<h3>Umiejętności</h3><table><tr><th>Umiejętność</th><th>Ostatnio</th><th></th><th>Poziom</th></tr>
      ${skills.map(k => `<tr><td>${esc(k.name)}</td><td>${pct(k.recent)}</td><td><div class="rga-bar"><i style="width:${Math.round(k.recent * 100)}%"></i></div></td><td>${k.level ?? '–'}</td></tr>`).join('')}</table>` : ''}
    <h3>Głębsza analiza w Claude</h3>
    <p class="rga-note">Skopiuj dane i wklej je w swoim Claude (claude.ai). Tekst nie zawiera imienia dziecka.</p>
    <button data-act="copy">📋 Kopiuj raport dla Claude</button>
    <button class="ghost" data-act="show">Pokaż tekst</button>
    <textarea readonly hidden></textarea>
  </div>`;
  const ta = root.querySelector('textarea');
  const prompt = () => RGAssistant.claudePrompt(profile, { age: opts.age });
  root.querySelector('[data-act=copy]').onclick = async (ev) => {
    const txt = prompt(); ta.value = txt;
    try { await navigator.clipboard.writeText(txt); ev.target.textContent = '✓ Skopiowano'; }
    catch (e) { ta.hidden = false; ta.select(); ev.target.textContent = 'Zaznaczono, naciśnij Ctrl+C'; }
  };
  root.querySelector('[data-act=show]').onclick = () => { ta.value = prompt(); ta.hidden = !ta.hidden; };
}
