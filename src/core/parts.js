// Części AEGIS-7 w rozdziale 1 (zgodne z figurką 3D v2: 11 części).
export const PARTS = [
  { id: 'torso', pl: 'Tułów z rdzeniem', en: 'torso' },
  { id: 'head', pl: 'Głowa', en: 'head' },
  { id: 'pelvis', pl: 'Miednica', en: 'pelvis' },
  { id: 'thigh_l', pl: 'Lewe udo', en: 'left thigh' },
  { id: 'thigh_r', pl: 'Prawe udo', en: 'right thigh' },
  { id: 'shin_l', pl: 'Lewa goleń', en: 'left leg' },
  { id: 'shin_r', pl: 'Prawa goleń', en: 'right leg' },
  { id: 'arm_l', pl: 'Lewe ramię', en: 'left arm' },
  { id: 'forearm_l', pl: 'Lewe przedramię', en: 'left forearm' },
  { id: 'arm_r', pl: 'Prawe ramię', en: 'right arm' },
  { id: 'forearm_r', pl: 'Prawe przedramię', en: 'right forearm' },
];
export const partName = id => (PARTS.find(p => p.id === id) || { pl: id }).pl;
