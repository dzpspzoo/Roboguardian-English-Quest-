// Kurs Nauczyciela AEGIS-7. Tylko dane. Kolejność i zasady: plan w dokumencie projektu
// („AEGIS-7: model idealnego nauczyciela angielskiego”): najpierw zwroty do rozmowy,
// dźwięki tylko w słowach z misji, maks. 3 nowe elementy dziennie, tydzień = 5 dni nauki + powtórka + rozmowa.

// Zwroty i słowa. en = co mówi lektor (i co dziecko pisze), pl = polski napis, icon = obrazek.
export const ITEMS = {
  hello: { en: 'Hello!', pl: 'Cześć! / Dzień dobry!', icon: '👋' },
  hi: { en: 'Hi!', pl: 'Hej!', icon: '🙋' },
  goodbye: { en: 'Goodbye!', pl: 'Do widzenia!', icon: '🚪' },
  whats_your_name: { en: "What's your name?", pl: 'Jak masz na imię?', icon: '❓' },
  my_name_is: { en: 'My name is AEGIS.', pl: 'Mam na imię AEGIS.', icon: '🤖' },
  im_guardian: { en: "I'm a Guardian.", pl: 'Jestem Strażnikiem.', icon: '🛡️' },
  yes: { en: 'Yes.', pl: 'Tak.', icon: '✅' },
  no: { en: 'No.', pl: 'Nie.', icon: '❌' },
  thank_you: { en: 'Thank you!', pl: 'Dziękuję!', icon: '🙏' },
  one: { en: 'one', pl: 'jeden', icon: '1️⃣' },
  two: { en: 'two', pl: 'dwa', icon: '2️⃣' },
  three: { en: 'three', pl: 'trzy', icon: '3️⃣' },
  four: { en: 'four', pl: 'cztery', icon: '4️⃣' },
  five: { en: 'five', pl: 'pięć', icon: '5️⃣' },
  six: { en: 'six', pl: 'sześć', icon: '6️⃣' },
  seven: { en: 'seven', pl: 'siedem', icon: '7️⃣' },
  eight: { en: 'eight', pl: 'osiem', icon: '8️⃣' },
  nine: { en: 'nine', pl: 'dziewięć', icon: '9️⃣' },
  ten: { en: 'ten', pl: 'dziesięć', icon: '🔟' },
  how_old: { en: 'How old are you?', pl: 'Ile masz lat?', icon: '🎂' },
  im_ten: { en: "I'm ten.", pl: 'Mam dziesięć lat.', icon: '🧒' },
  cat: { en: 'a cat', pl: 'kot', icon: '🐱' },
  dog: { en: 'a dog', pl: 'pies', icon: '🐶' },
  bag: { en: 'a bag', pl: 'torba', icon: '👜' },
  its_a_cat: { en: "It's a cat.", pl: 'To jest kot.', icon: '👉🐱' },
  please: { en: 'Please.', pl: 'Proszę.', icon: '🥺' },
  sorry: { en: 'Sorry!', pl: 'Przepraszam!', icon: '😔' },
  help: { en: 'Help!', pl: 'Pomocy!', icon: '🆘' },
  big: { en: "It's big.", pl: 'To jest duże.', icon: '🐘' },
  small: { en: "It's small.", pl: 'To jest małe.', icon: '🐭' },
  is_it_big: { en: 'Is it big?', pl: 'Czy to jest duże?', icon: '🤔' },
};

// Pary dźwięków. Zawsze prawdziwe słowa z polskim znaczeniem; tip = jawne wyjaśnienie po błędzie.
export const CONTRASTS = {
  thank_think: { a: { en: 'thank', pl: 'dziękować', icon: '🙏' }, b: { en: 'think', pl: 'myśleć', icon: '💭' }, sound: 'ae_ih',
    tip: 'W „thank” usta szeroko jak w uśmiechu, dźwięk między polskim a i e. W „think” krótkie i, prawie jak polskie y.' },
  three_tree: { a: { en: 'three', pl: 'trzy', icon: '3️⃣' }, b: { en: 'tree', pl: 'drzewo', icon: '🌳' }, sound: 'th_t',
    tip: 'W „three” czubek języka wysuwasz lekko między zęby i dmuchasz. W „tree” język zostaje za zębami, jak w polskim t.' },
  three_free: { a: { en: 'three', pl: 'trzy', icon: '3️⃣' }, b: { en: 'free', pl: 'wolny', icon: '🕊️' }, sound: 'th_f',
    tip: '„three”: język między zębami. „free”: górne zęby dotykają dolnej wargi, jak w polskim f.' },
  pen_pan: { a: { en: 'pen', pl: 'długopis', icon: '🖊️' }, b: { en: 'pan', pl: 'patelnia', icon: '🍳' }, sound: 'e_ae',
    tip: '„pen” to krótkie polskie e. „pan” to szerokie a z uśmiechem, między a i e. Literę a czytamy tu inaczej niż po polsku.' },
  cat_cut: { a: { en: 'cat', pl: 'kot', icon: '🐱' }, b: { en: 'cut', pl: 'ciąć', icon: '✂️' }, sound: 'ae_uh',
    tip: '„cat”: szeroko, z uśmiechem, pisane a. „cut”: krótkie, luźne a z gardła, pisane u.' },
  cap_cup: { a: { en: 'cap', pl: 'czapka z daszkiem', icon: '🧢' }, b: { en: 'cup', pl: 'kubek', icon: '☕' }, sound: 'ae_uh',
    tip: 'Jak cat i cut: „cap” szeroko z uśmiechem, „cup” krótko i luźno. Litera u w cup brzmi jak krótkie a.' },
  big_bag: { a: { en: 'big', pl: 'duży', icon: '🐘' }, b: { en: 'bag', pl: 'torba', icon: '👜' }, sound: 'ih_ae',
    tip: '„big”: krótkie i, prawie jak polskie y. „bag”: szerokie a z uśmiechem.' },
};

const L = (aegis, pl, options, answer = 0, reply) => ({ aegis: { en: aegis, pl }, options, answer, reply });

// Rozdział 1: Hangar (2 tygodnie, 14 Misji dnia). type: learn | review | talk
export const CHAPTERS = [
  {
    id: 'ch1', title: 'Hangar', titleEn: 'The hangar', weeks: '1–2',
    can: 'Przywitać się, przedstawić, policzyć do 10, powiedzieć ile masz lat, dziękuję, proszę, przepraszam, duże i małe.',
    days: [
      { type: 'learn', goal: { en: 'I am waking up. Say hello to me!', pl: 'Budzę się. Przywitaj się ze mną!' },
        items: ['hello', 'hi', 'goodbye'], contrast: null, write: 'Hello!',
        scene: [L('Hello, Guardian!', 'Cześć, Strażniku!', ['Hello, AEGIS!', 'Goodbye!']),
                L('Hi! I am happy.', 'Hej! Jestem szczęśliwy.', ['Hi!', 'Goodbye!']),
                L('I need to sleep now. Goodbye!', 'Muszę teraz spać. Do widzenia!', ['Goodbye!', 'Hello!'])] },
      { type: 'learn', goal: { en: 'My memory is empty. Tell me who you are!', pl: 'Moja pamięć jest pusta. Powiedz mi, kim jesteś!' },
        items: ['whats_your_name', 'my_name_is', 'im_guardian'], contrast: null, write: "I'm a Guardian.",
        scene: [L('Hello! My name is AEGIS.', 'Cześć! Mam na imię AEGIS.', ['Hello, AEGIS!', 'Goodbye!']),
                L("What's your name?", 'Jak masz na imię?', ["I'm a Guardian.", 'Thank you!']),
                L('A Guardian! Great!', 'Strażnik! Super!', ["What's your name?", 'Goodbye!'], 0, 'My name is AEGIS.')] },
      { type: 'learn', goal: { en: 'Answer my questions. Yes or no?', pl: 'Odpowiadaj na moje pytania. Tak czy nie?' },
        items: ['yes', 'no', 'thank_you'], contrast: 'thank_think', write: 'Thank you!',
        scene: [L('Are you a Guardian?', 'Czy jesteś Strażnikiem?', ['Yes.', 'No.']),
                L('Are you a robot?', 'Czy jesteś robotem?', ['No.', 'Yes.']),
                L('Here is a battery for you.', 'Proszę, bateria dla ciebie.', ['Thank you!', 'Goodbye!'])] },
      { type: 'learn', goal: { en: 'My counter is broken. Help me count!', pl: 'Mój licznik jest zepsuty. Pomóż mi liczyć!' },
        items: ['one', 'two', 'three'], contrast: 'three_tree', write: 'three',
        scene: [L('How many owls? 🦉🦉', 'Ile sów?', ['two', 'three']),
                L('How many frogs? 🐸🐸🐸', 'Ile żab?', ['three', 'one']),
                L('How many elephants? 🐘', 'Ile słoni?', ['one', 'two'])] },
      { type: 'learn', goal: { en: 'More numbers! Count the animals in my scanner.', pl: 'Więcej liczb! Policz zwierzęta w moim skanerze.' },
        items: ['four', 'five', 'six'], contrast: 'three_free', write: 'five',
        scene: [L('Count the penguins: 🐧🐧🐧🐧', 'Policz pingwiny:', ['four', 'five']),
                L('An insect has legs. How many? 🐜', 'Owad ma nogi. Ile?', ['six', 'three']),
                L('Hands up! How many fingers? 🖐️', 'Ręka w górę! Ile palców?', ['five', 'four'])] },
      { type: 'review', goal: { en: 'Let us check my memory. What do you remember?', pl: 'Sprawdźmy moją pamięć. Co pamiętasz?' } },
      { type: 'talk', goal: { en: 'Talk to me, Guardian!', pl: 'Porozmawiaj ze mną, Strażniku!' },
        scene: [L('Hi! What is your name?', 'Hej! Jak masz na imię?', ["I'm a Guardian.", 'Six.']),
                L('Are you happy today?', 'Czy jesteś dziś szczęśliwy?', ['Yes.', 'Three.']),
                L('Count with me: one, two...', 'Policz ze mną: jeden, dwa...', ['three', 'five']),
                L('How many arms do I have? 🦾🦾', 'Ile mam rąk?', ['two', 'four']),
                L('Here is a star for you! ⭐', 'Proszę, gwiazdka dla ciebie!', ['Thank you!', 'Hello!'])], write: 'Thank you!' },
      { type: 'learn', goal: { en: 'Count to nine with me!', pl: 'Policz ze mną do dziewięciu!' },
        items: ['seven', 'eight', 'nine'], contrast: 'three_tree', write: 'nine',
        scene: [L('Count the ladybirds: 🐞🐞🐞🐞🐞🐞🐞', 'Policz biedronki:', ['seven', 'nine']),
                L('A spider has legs. How many? 🕷️', 'Pająk ma nogi. Ile?', ['eight', 'six']),
                L('One, two... nine! How many?', 'Jeden, dwa... dziewięć! Ile?', ['nine', 'seven'])] },
      { type: 'learn', goal: { en: 'How old are you? Tell me!', pl: 'Ile masz lat? Powiedz mi!' },
        items: ['ten', 'how_old', 'im_ten'], contrast: 'pen_pan', write: "I'm ten.",
        scene: [L('I am one week old. How old are you?', 'Mam tydzień. Ile ty masz lat?', ["I'm ten.", "I'm a Guardian."]),
                L('Ten! Count my fingers: 🖐️🖐️', 'Dziesięć! Policz moje palce:', ['ten', 'eight']),
                L('Ask me!', 'Zapytaj mnie!', ['How old are you?', 'Thank you!'], 0, 'I am one week old!')] },
      { type: 'learn', goal: { en: 'What is it? Help me see animals.', pl: 'Co to jest? Pomóż mi rozpoznawać zwierzęta.' },
        items: ['cat', 'dog', 'its_a_cat'], contrast: 'cat_cut', write: "It's a cat.",
        scene: [L('What is it? 🐱', 'Co to jest?', ["It's a cat.", 'a dog']),
                L('And this? 🐶', 'A to?', ['a dog', 'a cat']),
                L('Is it a dog? 🐱', 'Czy to pies?', ["No. It's a cat.", 'Yes.'])] },
      { type: 'learn', goal: { en: 'Be polite, Guardian. And call me if you need help!', pl: 'Bądź uprzejmy, Strażniku. I wołaj mnie, gdy potrzebujesz pomocy!' },
        items: ['please', 'sorry', 'help'], contrast: 'cap_cup', write: 'Help!',
        scene: [L('Do you want a battery?', 'Chcesz baterię?', ['Yes, please.', 'Sorry!']),
                L('Oh no! You are on my foot!', 'O nie! Stoisz mi na stopie!', ['Sorry!', 'Thank you!']),
                L('The monster is here! What do you say?', 'Potwór tu jest! Co mówisz?', ['Help!', 'Hello!'])] },
      { type: 'learn', goal: { en: 'Big or small? Look around the hangar.', pl: 'Duże czy małe? Rozejrzyj się po hangarze.' },
        items: ['big', 'small', 'is_it_big'], contrast: 'big_bag', write: "It's big.",
        scene: [L('Look at the elephant! 🐘', 'Spójrz na słonia!', ["It's big.", "It's small."]),
                L('Look at the mouse! 🐭', 'Spójrz na mysz!', ["It's small.", "It's big."]),
                L('Ask me about the cat!', 'Zapytaj mnie o kota!', ['Is it big?', 'Goodbye!'], 0, "No. It's small.")] },
      { type: 'review', goal: { en: 'Big test for my memory! What do you remember?', pl: 'Wielki test mojej pamięci! Co pamiętasz?' } },
      { type: 'talk', goal: { en: 'Let us talk, Guardian. You know a lot now!', pl: 'Porozmawiajmy, Strażniku. Dużo już umiesz!' },
        scene: [L('Hello! What is your name?', 'Cześć! Jak masz na imię?', ["I'm a Guardian.", "It's big."]),
                L('How old are you?', 'Ile masz lat?', ["I'm ten.", 'Thank you!']),
                L('What is it? 🐶', 'Co to jest?', ['a dog', 'Help!']),
                L('Is it big? 🐭', 'Czy jest duża?', ["No. It's small.", 'Yes, please.']),
                L('Do you want a star?', 'Chcesz gwiazdkę?', ['Yes, please.', 'Sorry!']),
                L('See you tomorrow, Guardian!', 'Widzimy się jutro, Strażniku!', ['Goodbye!', 'Hello!'])], write: "I'm ten.", final: true },
    ],
  },
];

// Kolejne rozdziały: zarys z planu (treść powstaje w etapie 3, przed dojściem syna do nich).
export const OUTLINE = [
  { id: 'ch2', title: 'Ciało robota', weeks: '3–4', can: 'This is my head. It is big. I have two arms. Kolory.' },
  { id: 'ch3', title: 'Rodzina naukowców', weeks: '5–6', can: 'He is my dad. She is… His / Her name is…' },
  { id: 'ch4', title: 'Komendy', weeks: '7–8', can: 'Go! Stop! Turn left. I can jump. Can you…?' },
  { id: 'ch5', title: 'Gdzie to jest?', weeks: '9–10', can: 'Where is the key? It is in / on / under the box.' },
  { id: 'ch6', title: 'Pomoc i plan dnia', weeks: '11–12', can: 'I am hungry. Can I have…, please? I get up at seven.' },
];

// Wszystkie dni kursu po kolei, z numerem rozdziału.
export const COURSE = CHAPTERS.flatMap(ch => ch.days.map((d, i) => ({ ...d, chapter: ch.id, chapterTitle: ch.title, dayInChapter: i + 1, daysInChapter: ch.days.length })));

// Kolejność części AEGIS-7 nagradzanych w Misjach dnia (id z src/core/parts.js).
// Kolejność wg życzenia rodzica: głowa, tułów z rdzeniem, kończyny (dalej: silnik, miecz, tarcza, gdy rdzeń doda te części).
export const PART_ORDER = ['head', 'torso', 'pelvis', 'thigh_l', 'thigh_r', 'shin_l', 'shin_r', 'arm_l', 'forearm_l', 'arm_r', 'forearm_r'];

// Wszystkie teksty do nagrania (tools/nagraj_nauczyciel.py).
// Polecenia AEGIS-a w lekcji (po angielsku; polski tylko w napisie).
export const AEGIS_LINES = ['Let us remember!', 'What does it mean?', 'Which one?', 'Which word do you hear?', 'New words. Listen!',
  'Listen. Two words, two sounds.', 'What do you say?', 'Look, listen and remember.', 'Welcome back, Guardian! Let us remember.',
  'Great job, Guardian! My memory is stronger now.', 'See you tomorrow, Guardian!'];

export function phrases() {
  const s = new Set(AEGIS_LINES);
  for (const it of Object.values(ITEMS)) s.add(it.en);
  for (const c of Object.values(CONTRASTS)) { s.add(c.a.en); s.add(c.b.en); }
  for (const d of COURSE) {
    if (d.goal) s.add(d.goal.en);
    for (const l of d.scene || []) { s.add(l.aegis.en); l.options.forEach(o => s.add(o)); if (l.reply) s.add(l.reply); }
    if (d.write) s.add(d.write);
  }
  return [...s];
}
