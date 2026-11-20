// Działy (zestawy słówek) dla misji specjalnych: kartkówka, dyktando, podsumowanie.
// Unit 2 = materiał z kartkówki (te same słowa co w „Paliwie”, nagrania już są w assets/audio/words).
// Działy „Dźwięki” = słowa z misji rozdziału 1.
import { WORDS, MISSIONS, SOUNDS } from './ch1-data.js';

const W = (en, pl, icon = '') => ({ en, pl, icon });

export const UNITS = [
  { id: 'u2-clothes', group: 'Unit 2', title: 'Ubrania', words: [
    W('hat', 'czapka'), W('jacket', 'kurtka', '🧥'), W('T-shirt', 'koszulka', '👕'), W('shirt', 'koszula'), W('shoes', 'buty', '👟'),
    W('trousers', 'spodnie', '👖'), W('shorts', 'krótkie spodenki', '🩳'), W('flip-flops', 'japonki', '🩴'), W('scarf', 'szalik', '🧣'),
    W('dress', 'sukienka', '👗'), W('boots', 'kozaki', '🥾'), W('jumper', 'sweter'), W('skirt', 'spódnica'), W('tie', 'krawat'), W('uniform', 'mundurek szkolny')] },
  { id: 'u2-weather', group: 'Unit 2', title: 'Pogoda', words: [
    W('sunny', 'słonecznie', '☀️'), W('rainy', 'deszczowo', '🌧️'), W('snowy', 'śnieżnie', '🌨️'), W('cloudy', 'pochmurno', '☁️'),
    W('hot', 'gorąco'), W('cold', 'zimno'), W('windy', 'wietrznie', '🌬️')] },
  { id: 'u2-months', group: 'Unit 2', title: 'Miesiące', words: [
    W('January', 'styczeń'), W('February', 'luty'), W('March', 'marzec'), W('April', 'kwiecień'), W('May', 'maj'), W('June', 'czerwiec'),
    W('July', 'lipiec'), W('August', 'sierpień'), W('September', 'wrzesień'), W('October', 'październik'), W('November', 'listopad'), W('December', 'grudzień')] },
  { id: 'u2-subjects', group: 'Unit 2', title: 'Przedmioty szkolne', words: [
    W('maths', 'matematyka'), W('art', 'plastyka'), W('science', 'przyroda'), W('music', 'muzyka'), W('history', 'historia'), W('geography', 'geografia')] },
  { id: 'u2-this', group: 'Unit 2', title: 'this, that, these, those', words: [
    W('this', 'ten, to (blisko, jedna rzecz)'), W('that', 'tamten (daleko, jedna rzecz)'), W('these', 'te (blisko, wiele rzeczy)'), W('those', 'tamte (daleko, wiele rzeczy)')] },
  { id: 'u2-poss', group: 'Unit 2', title: 'my, your, his, her…', words: [
    W('my', 'mój, moja'), W('your', 'twój, twoja'), W('his', 'jego (chłopca)'), W('her', 'jej (dziewczynki)'), W('its', 'jego (rzeczy, zwierzęcia)'), W('our', 'nasz, nasza'), W('their', 'ich')] },
  ...MISSIONS.filter(m => m.nr <= 5).map(m => ({
    id: 'ch1-' + m.sound, group: 'Dźwięki z misji', title: SOUNDS[m.sound].label,
    words: [...new Set([...m.words, ...m.build])].map(w => W(w, WORDS[w]?.pl || '', WORDS[w]?.icon || '')),
  })),
];

export const CUSTOM_KEY = 'rg.special.custom'; // ustawienie rodzica (lista słówek), nie wyniki dziecka

// „jacket = kurtka” albo „jacket - kurtka” albo samo „jacket”; jedna pozycja na linię lub po przecinku.
export function parseCustom(text) {
  const out = [];
  for (const raw of String(text || '').split(/\n|;/)) {
    const line = raw.trim(); if (!line) continue;
    const m = line.split(/\s*(?:=|–|—|\s-\s|:)\s*/);
    const en = (m[0] || '').trim().replace(/\s+/g, ' ');
    if (!/^[A-Za-z][A-Za-z' .,?!-]{0,40}$/.test(en)) continue;
    if (out.some(w => w.en.toLowerCase() === en.toLowerCase())) continue;
    out.push(W(en, (m[1] || '').trim().slice(0, 60)));
  }
  return out.slice(0, 40);
}
export function loadCustom() { try { return localStorage.getItem(CUSTOM_KEY) || ''; } catch (e) { return ''; } }
export function saveCustom(t) { try { localStorage.setItem(CUSTOM_KEY, t); } catch (e) {} }

export const LINES = {
  quizIntro: { en: 'Test simulation. First we practise, then a short test.', pl: 'Symulacja sprawdzianu. Najpierw ćwiczymy, potem krótki sprawdzian.' },
  testStart: { en: 'Practice complete. Now the test. Take your time.', pl: 'Trening zakończony. Teraz sprawdzian. Nie spiesz się.' },
  testGreat: { en: 'Excellent! You are ready for the test at school.', pl: 'Doskonale! Jesteś gotowy na kartkówkę w szkole.' },
  testGood: { en: 'Good work! Practise the red words one more time.', pl: 'Dobra robota! Poćwicz jeszcze raz czerwone słowa.' },
  dictIntro: { en: 'Dictation. Listen to the word and type it.', pl: 'Dyktando. Posłuchaj słowa i wpisz je.' },
  dictFix: { en: 'Look at the red letters and try again.', pl: 'Popatrz na czerwone litery i spróbuj jeszcze raz.' },
  dictCopy: { en: 'Here is the right spelling. Copy it.', pl: 'Tak to się pisze. Przepisz.' },
  reviewIntro: { en: 'Systems report. These words were the hardest. Let us repair them.', pl: 'Raport systemów. Te słowa były najtrudniejsze. Naprawmy je.' },
  reviewDone: { en: 'Memory repaired. Great work, Guardian!', pl: 'Pamięć naprawiona. Świetna robota, Strażniku!' },
  great: { en: 'Great job, Guardian!', pl: 'Świetnie, Strażniku!' },
  again: { en: 'Hmm, not this one. Listen again.', pl: 'Hmm, nie to. Posłuchaj jeszcze raz.' },
  lookAgain: { en: 'Hmm, not this one. Look again.', pl: 'Hmm, nie to. Popatrz jeszcze raz.' },
  mazeIntro: { en: 'Fly through the tunnel. Choose the right gate!', pl: 'Leć przez tunel. Wybierz właściwą bramkę!' },
  mazeSave: { en: 'You saved an animal!', pl: 'Uratowałeś zwierzaka!' },
  mazeBump: { en: 'Bump! Wrong gate. Look at the right one.', pl: 'Bum! Zła bramka. Popatrz na dobrą.' },
  mazeEnd: { en: 'We are out of the maze. The animals are safe!', pl: 'Wylecieliśmy z labiryntu. Zwierzęta są bezpieczne!' },
};
