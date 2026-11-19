// Nagrania głosu dziecka (IndexedDB "rg-recordings", magazyn "clips"): odsłuch i ocena rodzica 1–3 gwiazdki.
// Nic nie wychodzi z przeglądarki. Oceny zapisuje profil (profile.speech[klucz] = 1..3).
const DB = 'rg-recordings', STORE = 'clips';

function openDb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE, { autoIncrement: true }); };
    r.onerror = () => rej(r.error);
    r.onsuccess = () => res(r.result);
  });
}

// Zwraca [{ key, word, mission, profileId, time, blob }], najnowsze pierwsze.
export async function listClips() {
  const db = await openDb();
  return new Promise((res, rej) => {
    const out = [];
    const tx = db.transaction(STORE, 'readonly');
    const cur = tx.objectStore(STORE).openCursor();
    cur.onsuccess = () => {
      const c = cur.result; if (!c) return;
      const v = c.value || {};
      const meta = v.meta || {};
      out.push({ key: String(c.key), word: v.item || meta.word || '', mission: v.mission || meta.mission || '',
        profileId: v.profileId || meta.profileId || null, time: v.t || Date.parse(v.savedAt || '') || 0, blob: v.blob });
      c.continue();
    };
    tx.oncomplete = () => { db.close(); res(out.sort((a, b) => b.time - a.time)); };
    tx.onerror = () => { db.close(); rej(tx.error); };
  });
}

export async function deleteClips(keys) {
  const db = await openDb();
  const all = await new Promise(res => { const r = db.transaction(STORE).objectStore(STORE).getAllKeys(); r.onsuccess = () => res(r.result); r.onerror = () => res([]); });
  return new Promise(res => {
    const tx = db.transaction(STORE, 'readwrite'); const st = tx.objectStore(STORE);
    for (const k of all) if (keys.includes(String(k))) st.delete(k);
    tx.oncomplete = () => { db.close(); res(); };
  });
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MISSION = { calibration: 'test startowy' };

// Wstawia listę nagrań gracza do `box`. Nagrania bez profilu (starsze) pokazuje u wszystkich.
export async function renderRecordings(box, profile, saveProfile) {
  let clips = [];
  try { clips = (await listClips()).filter(c => !c.profileId || c.profileId === profile.id); } catch (e) { box.innerHTML = ''; return; }
  profile.speech = profile.speech || {};
  if (!clips.length) { box.innerHTML = '<p class="muted">Nagrań głosu jeszcze nie ma. Pojawią się po teście startowym i misjach z mówieniem.</p>'; return; }
  const rated = clips.filter(c => profile.speech[c.key]);
  const avg = rated.length ? (rated.reduce((s, c) => s + profile.speech[c.key], 0) / rated.length).toFixed(1) : null;
  box.innerHTML = `<details><summary style="cursor:pointer;font-size:18px"><b>Nagrania głosu</b> (${clips.length}${avg ? `, średnia ocena ${avg} / 3` : ''})</summary>
    <p class="muted" style="margin:8px 0">Posłuchaj i oceń wymowę: 1 gwiazdka = trudno zrozumieć, 2 = zrozumiałe z błędami, 3 = dobrze. Nagrania są tylko na tym urządzeniu.</p>
    <div class="col" style="gap:6px">${clips.slice(0, 60).map(c => `
      <div class="row" data-k="${esc(c.key)}" style="gap:8px">
        <button class="btn small" data-play>▶</button>
        <span class="grow"><b>${esc(c.word || '–')}</b> <span class="muted">${esc(MISSION[c.mission] || c.mission)}${c.time ? ' · ' + new Date(c.time).toLocaleDateString('pl-PL') : ''}</span></span>
        ${[1, 2, 3].map(n => `<button class="btn small ${profile.speech[c.key] === n ? 'primary' : ''}" data-star="${n}" aria-label="${n} z 3">${'★'.repeat(n)}</button>`).join('')}
      </div>`).join('')}</div>
    <button class="btn small" data-delall style="margin-top:10px">Usuń nagrania tego gracza</button></details>`;
  let audio = null;
  box.onclick = async e => {
    const row = e.target.closest('[data-k]');
    if (e.target.closest('[data-play]') && row) {
      const c = clips.find(x => x.key === row.dataset.k); if (!c || !c.blob) return;
      if (audio) { audio.pause(); URL.revokeObjectURL(audio.src); }
      audio = new Audio(URL.createObjectURL(c.blob)); audio.play().catch(() => {});
    }
    const st = e.target.closest('[data-star]');
    if (st && row) { profile.speech[row.dataset.k] = +st.dataset.star; saveProfile(profile); renderRecordings(box, profile, saveProfile); }
    if (e.target.closest('[data-delall]') && confirm('Usunąć wszystkie nagrania tego gracza z tego urządzenia?')) {
      await deleteClips(clips.map(c => c.key)); renderRecordings(box, profile, saveProfile);
    }
  };
}
