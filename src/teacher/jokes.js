// Startowa pula żartów AEGIS-7 na koniec misji. Gdy wątek historii doda src/story/jokes.json
// (format: [{ id, en, pl, img?, clip?, anim? }]), ekran pożegnania użyje tamtego pliku.
// anim = animacja obrazka AEGIS-a w CSS: dance | jump | sleep | spin | shake | wobble
export const JOKES = [
  { id: 'j01', en: 'What does a robot eat? Micro-chips!', pl: 'Co je robot? Mikroczipsy!', anim: 'wobble' },
  { id: 'j02', en: 'I am a robot. I can dance! Beep, boop, beep!', pl: 'Jestem robotem. Umiem tańczyć! Bip, bup, bip!', anim: 'dance' },
  { id: 'j03', en: 'What is my favourite music? Heavy metal!', pl: 'Jaka jest moja ulubiona muzyka? Heavy metal!', anim: 'shake' },
  { id: 'j04', en: 'My cat is a robot too. Meow... beep!', pl: 'Mój kot też jest robotem. Miau... bip!', anim: 'wobble' },
  { id: 'j05', en: 'I am big. The cat is small. The cat is the boss!', pl: 'Ja jestem duży. Kot jest mały. To kot tu rządzi!', anim: 'shake' },
  { id: 'j06', en: 'I have ten fingers. One, two... nine! Where is number ten?', pl: 'Mam dziesięć palców. Jeden, dwa... dziewięć! Gdzie jest numer dziesięć?', anim: 'spin' },
  { id: 'j07', en: 'Robots never sleep. Zzz... I am not sleeping! Zzz...', pl: 'Roboty nigdy nie śpią. Chrr... Nie śpię! Chrr...', anim: 'sleep' },
  { id: 'j08', en: 'Hello, fridge! Oh... sorry. You are not a robot.', pl: 'Cześć, lodówko! Ojej... przepraszam. Nie jesteś robotem.', anim: 'wobble' },
  { id: 'j09', en: 'I wanted to say three. I said tree. Now I have a tree in the hangar!', pl: 'Chciałem powiedzieć „three”. Powiedziałem „tree”. Teraz mam drzewo w hangarze!', anim: 'spin' },
  { id: 'j10', en: 'My battery is low. I need a sandwich. A battery sandwich!', pl: 'Mam słabą baterię. Potrzebuję kanapki. Kanapki z bateriami!', anim: 'sleep' },
  { id: 'j11', en: 'Look! I can jump! ...Oops. I can not jump.', pl: 'Patrz! Umiem skakać! ...Ups. Nie umiem skakać.', anim: 'jump' },
  { id: 'j12', en: 'A cat in a hat with a bag. That is a funny cat!', pl: 'Kot w kapeluszu z torbą. To zabawny kot!', anim: 'dance' },
  { id: 'j13', en: 'What is my favourite snack? Nuts and bolts!', pl: 'Jaka jest moja ulubiona przekąska? Śrubki i nakrętki!', anim: 'wobble' },
  { id: 'j14', en: 'I said goodbye to my left leg. It walked away!', pl: 'Powiedziałem „do widzenia” mojej lewej nodze. Poszła sobie!', anim: 'jump' },
  { id: 'j15', en: 'How old am I? One week old. And very, very big!', pl: 'Ile mam lat? Tydzień. I jestem bardzo, bardzo duży!', anim: 'shake' },
  { id: 'j16', en: 'Why did the robot cross the road? To find a Guardian like you!', pl: 'Dlaczego robot przeszedł przez ulicę? Żeby znaleźć Strażnika takiego jak ty!', anim: 'dance' },
  { id: 'j17', en: 'I can count to ten! One, two, three... ten! Clap, clap, clap!', pl: 'Umiem liczyć do dziesięciu! Jeden, dwa, trzy... dziesięć! Brawa!', anim: 'jump' },
  { id: 'j18', en: 'Oops! My head is on my leg!', pl: 'Ups! Moja głowa jest na nodze!', anim: 'spin' },
  { id: 'j19', en: 'Beep! I am a car. No... I am a robot. A robot with a horn! Honk!', pl: 'Bip! Jestem samochodem. Nie... jestem robotem. Robotem z klaksonem! Trąb!', anim: 'shake' },
  { id: 'j20', en: 'Do you know my favourite day? Fri-day! Because fries!', pl: 'Wiesz, jaki jest mój ulubiony dzień? Piątek! Bo frytki! (fries = frytki)', anim: 'dance' },
];

// Wybiera żart, który dziecko widziało najdawniej (albo wcale).
export function pickJoke(pool, seen = []) {
  const fresh = pool.filter(j => !seen.includes(j.id));
  const list = fresh.length ? fresh : pool;
  return list[Math.floor(Math.random() * list.length)];
}
