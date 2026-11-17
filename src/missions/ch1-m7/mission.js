// Rozdział 1, misja 7. Treść w ../_shared/ch1-data.js, przebieg w ../_shared/ch1-engine.js.
import { MISSIONS } from '../_shared/ch1-data.js';
import { runMission } from '../_shared/ch1-engine.js';

const M = MISSIONS[6];
export const meta = {
  id: M.id, title: M.title, titleEn: M.titleEn || null, chapter: 1, nr: M.nr,
  part: M.parts[0] || null, parts: M.parts, skills: [`phoneme.${M.sound}`, 'spelling', 'reading', 'listening'],
  minutes: 6, requires: M.nr > 1 ? ['ch1-m' + (M.nr - 1)] : [],
};
export function mount(root, ctx) { return runMission(root, ctx, M); }
