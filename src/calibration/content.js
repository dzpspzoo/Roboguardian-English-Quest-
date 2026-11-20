// Roboguardian English Quest: treść testu startowego (kalibracji).
// Wszystko, co mówi lektor, jest w polach `say` / `en` / słowach. Nagrania leżą we wspólnej
// bibliotece assets/audio/words/{en,en-slow}/<slug>.mp3 (slug z src/core/say.js).
// Listę fraz do nagrania wypisuje: node tools/frazy-kalibracja.mjs > tools/frazy-kalibracja.txt

// ---- Linie AEGIS-7: angielski głos, polski napis ----
const lines = {
  intro: {
    en: "Hello, Guardian! I am AEGIS-7. My systems are damaged. Let's scan your communicator, so I can understand you.",
    pl: "Cześć, Strażniku! Jestem AEGIS-7. Moje systemy są uszkodzone. Przeskanujmy Twój komunikator, żebym mógł Cię rozumieć."
  },
  audioCheck: { en: "Can you hear me, Guardian?", pl: "Słyszysz mnie, Strażniku?" },
  micCheck: { en: "Now say: Hello!", pl: "Teraz powiedz: Hello!" },
  micOk: { en: "I can hear you!", pl: "Słyszę Cię!" },
  micNo: { en: "No problem. We will talk later.", pl: "Nic nie szkodzi. Porozmawiamy później." },
  gotIt: [
    { en: "Got it!", pl: "Mam!" },
    { en: "Data saved.", pl: "Dane zapisane." },
    { en: "Next signal.", pl: "Następny sygnał." },
    { en: "Good. Keep going!", pl: "Dobrze. Lecimy dalej!" }
  ],
  breakTime: {
    en: "My battery is low. Let's take a short break. Stand up and stretch!",
    pl: "Moja bateria się kończy. Zróbmy krótką przerwę. Wstań i przeciągnij się!"
  },
  breakEnd: { en: "Battery charged. Let's continue!", pl: "Bateria naładowana. Działamy dalej!" },
  end: {
    en: "Scan complete! Thank you, Guardian. Now I know how to help you.",
    pl: "Skan zakończony! Dziękuję, Strażniku. Teraz wiem, jak Ci pomóc."
  }
};

// ---- Część 1: słowa ze słuchu (obrazek z 3) ----
const wordPools = {
  A: [
    ["cat", "🐱"], ["dog", "🐶"], ["sun", "☀️"], ["apple", "🍎"], ["car", "🚗"],
    ["fish", "🐟"], ["house", "🏠"], ["ball", "⚽"], ["book", "📖"]
  ],
  B: [
    ["jacket", "🧥"], ["dress", "👗"], ["trousers", "👖"], ["socks", "🧦"], ["rainy", "🌧️"],
    ["snowy", "❄️"], ["rabbit", "🐰"], ["cloudy", "☁️"], ["clock", "🕒"]
  ],
  C: [
    ["rocket", "🚀"], ["umbrella", "☂️"], ["penguin", "🐧"], ["giraffe", "🦒"], ["key", "🔑"],
    ["octopus", "🐙"], ["island", "🏝️"], ["castle", "🏰"], ["volcano", "🌋"]
  ]
};

// ---- Część 2: pary podobnych słów ----
// type "pair": dziecko słyszy oba słowa przy obrazkach, potem jedno z nich i wybiera.
// type "samediff": dwa słowa po sobie, czy takie same czy różne.
const contrastItems = [
  { id: "c_pan_pen", type: "pair", contrast: "ae_e", a: ["pan", "🍳"], b: ["pen", "🖊️"] },
  { id: "c_man_men", type: "pair", contrast: "ae_e", a: ["man", "👨"], b: ["men", "👬"] },
  { id: "c_ship_sheep", type: "pair", contrast: "i_ee", a: ["ship", "🚢"], b: ["sheep", "🐑"] },
  { id: "c_bin_bean", type: "pair", contrast: "i_ee", a: ["bin", "🗑️"], b: ["bean", "🫘"] },
  { id: "c_cart_card", type: "pair", contrast: "t_d_final", a: ["cart", "🛒"], b: ["card", "🃏"] },
  { id: "c_at_add", type: "samediff", contrast: "t_d_final", words: ["at", "add"] },
  { id: "c_pear_bear", type: "pair", contrast: "p_b", a: ["pear", "🍐"], b: ["bear", "🐻"] },
  { id: "c_pin_bin", type: "pair", contrast: "p_b", a: ["pin", "📌"], b: ["bin", "🗑️"] },
  { id: "c_three_tree", type: "pair", contrast: "th_s_f", a: ["three", "3️⃣"], b: ["tree", "🌳"] },
  { id: "c_mouth_mouse", type: "pair", contrast: "th_s_f", a: ["mouth", "👄"], b: ["mouse", "🐭"] },
  { id: "c_wet_vet", type: "samediff", contrast: "w_v", words: ["wet", "vet"] },
  { id: "c_west_vest", type: "samediff", contrast: "w_v", words: ["west", "vest"] },
  { id: "c_heart_art", type: "pair", contrast: "h", a: ["heart", "❤️"], b: ["art", "🎨"] },
  { id: "c_hair_air", type: "pair", contrast: "h", a: ["hair", "💇"], b: ["air", "💨"] },
  // próba kontrolna: te same słowa, sprawdza, czy dziecko nie klika zawsze „różne”
  { id: "c_bed_bed", type: "samediff", contrast: null, words: ["bed", "bed"] }
];

// ---- Część 3: dźwięk i litera (jak to się pisze) ----
// Każda błędna opcja ma typ błędu, który mówi, skąd się bierze.
const phonicsItems = [
  { id: "p_sit", word: "sit", options: [["sit", null], ["syt", "polish_phonetic"], ["set", "vowel_i_e"]] },
  { id: "p_cat", word: "cat", options: [["cat", null], ["ket", "polish_phonetic"], ["cut", "vowel_ae_e"]] },
  { id: "p_bed", word: "bed", options: [["bed", null], ["bet", "voicing_t_d"], ["bad", "vowel_ae_e"]] },
  { id: "p_ship", word: "ship", options: [["ship", null], ["szip", "polish_phonetic"], ["sheep", "vowel_i_ee"]] },
  { id: "p_shop", word: "shop", options: [["shop", null], ["szop", "polish_phonetic"], ["chop", "other"]] },
  { id: "p_think", word: "think", options: [["think", null], ["fink", "th"], ["sink", "th"]] },
  { id: "p_cheese", word: "cheese", options: [["cheese", null], ["czis", "polish_phonetic"], ["chees", "missing_letter"]] },
  { id: "p_house", word: "house", options: [["house", null], ["hałs", "polish_phonetic"], ["haus", "polish_phonetic"]] },
  { id: "p_window", word: "window", options: [["window", null], ["łindoł", "polish_phonetic"], ["vindow", "w_v"]] },
  { id: "p_night", word: "night", options: [["night", null], ["najt", "polish_phonetic"], ["nite", "other"]] }
];

// ---- Część 4: czytanie bez dźwięku ----
const readingLevels = {
  A: [
    { id: "r_dog", text: "dog", options: [["dog", "🐶"], ["cat", "🐱"], ["fish", "🐟"]] },
    { id: "r_sun", text: "sun", options: [["sun", "☀️"], ["bed", "🛏️"], ["car", "🚗"]] },
    { id: "r_bed", text: "bed", options: [["bed", "🛏️"], ["ball", "⚽"], ["book", "📖"]] }
  ],
  B: [
    { id: "r_three", text: "three", options: [["three", "3️⃣"], ["tree", "🌳"], ["sun", "☀️"]] },
    { id: "r_mouse", text: "mouse", options: [["mouse", "🐭"], ["mouth", "👄"], ["house", "🏠"]] },
    { id: "r_jacket", text: "jacket", options: [["jacket", "🧥"], ["socks", "🧦"], ["dress", "👗"]] }
  ],
  C: [
    { id: "r_snowy", text: "It is snowy today.", options: [["snowy", "❄️"], ["sunny", "☀️"], ["rainy", "🌧️"]] },
    { id: "r_twocats", text: "I have two cats.", options: [["twocats", "🐱🐱"], ["onecat", "🐱"], ["twodogs", "🐶🐶"]] },
    { id: "r_redbook", text: "My book is red.", options: [["red", "📕"], ["green", "📗"], ["blue", "📘"]] }
  ]
};

// ---- Część 5: rozumienie poleceń i krótkich wiadomości ----
const listeningLevels = {
  A: [
    { id: "l_redcircle", say: "Touch the red circle.", options: [["red", "🔴"], ["blue", "🔵"], ["green", "🟢"]] },
    { id: "l_five", say: "Show me number five.", options: [["5", "5️⃣"], ["3", "3️⃣"], ["9", "9️⃣"]] },
    { id: "l_bluesquare", say: "Touch the blue square.", options: [["blue", "🟦"], ["red", "🟥"], ["green", "🟩"]] }
  ],
  B: [
    { id: "l_snowy", say: "It's cold and snowy today.", options: [["snowy", "❄️"], ["sunny", "☀️"], ["rainy", "🌧️"]] },
    { id: "l_three", say: "It's three o'clock.", options: [["3", "🕒"], ["9", "🕘"], ["1", "🕐"]] },
    { id: "l_jacket", say: "Put on your jacket, please.", options: [["jacket", "🧥"], ["dress", "👗"], ["socks", "🧦"]] }
  ],
  C: [
    { id: "l_max", say: "Max is ten years old. How old is Max?", options: [["10", "10"], ["8", "8"], ["12", "12"]] },
    { id: "l_anna", say: "Anna likes music. She plays the guitar. What does Anna play?", options: [["guitar", "🎸"], ["football", "⚽"], ["games", "🎮"]] },
    { id: "l_tom", say: "Tom's birthday is in winter. He wants a new bike. What does Tom want?", options: [["bike", "🚲"], ["scooter", "🛴"], ["phone", "📱"]] }
  ]
};

// ---- Część 6: układanie słowa z liter ----
const spellingLevels = {
  A: [
    { id: "s_cat", word: "cat", extra: ["e", "k"] },
    { id: "s_sit", word: "sit", extra: ["y", "e"] },
    { id: "s_bed", word: "bed", extra: ["t", "a"] }
  ],
  B: [
    { id: "s_ship", word: "ship", extra: ["z", "e"] },
    { id: "s_fish", word: "fish", extra: ["y", "z"] },
    { id: "s_three", word: "three", extra: ["f", "i"] }
  ],
  C: [
    { id: "s_jacket", word: "jacket", extra: ["d", "z"] },
    { id: "s_rainy", word: "rainy", extra: ["e", "j"] },
    { id: "s_window", word: "window", extra: ["v", "ł"] }
  ]
};

// ---- Część 7: mówienie (nagranie zostaje na urządzeniu) ----
const speakingItems = [
  { id: "m_hello", word: "hello" },
  { id: "m_cat", word: "cat" },
  { id: "m_ship", word: "ship" },
  { id: "m_three", word: "three" },
  { id: "m_thankyou", word: "thank you" }
];

// ---- Opis części testu ----
const sections = [
  {
    key: "words", skill: "listening_vocab", title: "Skan 1: słowa",
    intro: { en: "Listen and touch the picture.", pl: "Posłuchaj i dotknij obrazka." },
    mode: "levels", perLevel: 3, passAt: 2
  },
  {
    key: "contrasts", skill: "discrimination", title: "Skan 2: podobne dźwięki",
    intro: {
      en: "Listen carefully. You will hear two words. Then touch the one I say.",
      pl: "Słuchaj uważnie. Usłyszysz dwa słowa. Potem dotknij tego, które powiem."
    },
    introSameDiff: {
      en: "Are the two words the same, or different?",
      pl: "Czy te dwa słowa są takie same, czy różne?"
    },
    mode: "list"
  },
  {
    key: "phonics", skill: "sound_letter", title: "Skan 3: dźwięk i litera",
    intro: { en: "Listen and choose how to write it.", pl: "Posłuchaj i wybierz, jak to się pisze." },
    mode: "list", stopAfterWrongInRow: 3
  },
  {
    key: "reading", skill: "reading", title: "Skan 4: czytanie",
    intro: { en: "Read and touch the picture.", pl: "Przeczytaj i dotknij obrazka. Tu nic nie usłyszysz." },
    mode: "levels", perLevel: 3, passAt: 2
  },
  { key: "break" },
  {
    key: "listening", skill: "listening_comprehension", title: "Skan 5: wiadomości",
    intro: { en: "Listen to the message and choose the picture.", pl: "Posłuchaj wiadomości i wybierz obrazek." },
    mode: "levels", perLevel: 3, passAt: 2
  },
  {
    key: "spelling", skill: "spelling", title: "Skan 6: kod z liter",
    intro: { en: "Listen and build the word.", pl: "Posłuchaj i ułóż słowo z liter." },
    mode: "levels", perLevel: 3, passAt: 2
  },
  {
    key: "speaking", skill: "speaking", title: "Skan 7: mówienie",
    intro: { en: "Now talk to me. Repeat after me.", pl: "Teraz mów do mnie. Powtórz za mną." },
    mode: "list", needsMic: true
  }
];

export const content = {
  version: "1.0.0",
  lines, sections, wordPools, contrastItems, phonicsItems,
  readingLevels, listeningLevels, spellingLevels, speakingItems
};

// Wszystkie angielskie teksty, które test odtwarza (do nagrania).
export function allPhrases() {
  const out = new Set();
  const addLine = l => out.add(l.en);
  Object.values(lines).forEach(v => (Array.isArray(v) ? v.forEach(addLine) : addLine(v)));
  sections.forEach(s => { if (s.intro) addLine(s.intro); if (s.introSameDiff) addLine(s.introSameDiff); });
  Object.values(wordPools).forEach(pool => pool.forEach(([w]) => out.add(w)));
  contrastItems.forEach(it => (it.type === "pair" ? [it.a[0], it.b[0]] : it.words).forEach(w => out.add(w)));
  phonicsItems.forEach(it => out.add(it.word));
  Object.values(listeningLevels).forEach(l => l.forEach(it => out.add(it.say)));
  Object.values(spellingLevels).forEach(l => l.forEach(it => out.add(it.word)));
  speakingItems.forEach(it => out.add(it.word));
  return [...out];
}

// Polskie polecenia czytane polskim lektorem (assets/audio/words/pl/).
export function allPolishPhrases() {
  const out = new Set();
  const add = l => l && l.pl && out.add(l.pl);
  Object.values(lines).forEach(v => (Array.isArray(v) ? v.forEach(add) : add(v)));
  sections.forEach(s => { add(s.intro); add(s.introSameDiff); });
  return [...out];
}
