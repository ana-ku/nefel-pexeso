'use strict';

/* =====================================================================
   PEXESO PROTI POČÍTAČI
   ---------------------------------------------------------------------
   Pravidla:
   - Klasické pexeso: otočíš dvě karty, při shodě hraješ znovu.
   - Začíná počítač.
   - Pravidlo A: hráč nesmí mít víc párů než počítač -> ruka zamíchá
     karty, které zbývají na stole.
   - Pravidlo B: když počítač otočí kartu, jejíž dvojice už byla dřív
     odkryta, poprosí hráče o radu. Hráč klikne na kartu a počítač
     otočí právě tu (hráč může poradit správně, nebo napálit).
   ===================================================================== */


   const PAIRS = [
  ['obrazky/nikdo-ti-to-nerekne.png',   'obrazky/ze-ten-strach-nezmizi.png'],
  ['obrazky/unik.png', 'obrazky/unik.png'],
  ['obrazky/jak-o-tom-mluvit.png',      'obrazky/aby-to-nebyl-kyc.png'],
  ['obrazky/obava.png',      'obrazky/obava.png'],       
  ['obrazky/radost.png',      'obrazky/radost.png'],       
  ['obrazky/vsechno-se-meni.png',      'obrazky/ale-tohle-ne.png'],
  ['obrazky/pece.png',      'obrazky/pece.png'],       
  ['obrazky/zaplat-skolku.png',      'obrazky/zaplat-skolku.png'],       
  ['obrazky/zeme-hori.png',      'obrazky/slova-chybi.png'],      
  ['obrazky/prvni-odmitani.png',      'obrazky/prvni-odmitani.png'],       

  // ...
];

/* Hlášky počítače do speech bubble. Klidně uprav nebo přidej další. */
const MESSAGES = {
  start:         ['HLAJU PLVNÍ', 'CHCI VYHLÁT JO?'],
  computerStart: ['TAK TUDLE?', 'KALTIČKO KDEPAK SI', 'TUHLE zKUsÍM'],
  computerSecond:['KDE TO ASI JE', 'TADYYY?'],
  computerHit:   ['JES!'],
  computerMiss:  ['NEEEEEE', '*frustrovaně dýchá*', '$%@§!!!'],
  askAdvice:     ['POLADÍŠ MI, SI PŽECE MOJE MÁMA', 'KDE JE TAHLE, POLAĎ!'],
  adviceTrust:   ['JOOO?', 'DOUFÁM ŽE NELHÁŠ', 'DOBzE DÍKY MAMI'],
  adviceGood:    ['UFFFFF DÍKY!!!!', 'TO BYLO o FOUS DíKY MAMI', 'JES!'],
  adviceBad:     ['NEEEE', 'TY LHÁŠ!', '*zuřivě zatíná čelist*' ],
  thanks:        ['JOOO?', 'DOUFÁM ŽE NELHÁŠ', 'DÍKY MAMI'],
  playerTurn:    ['HLAJEŠ MAMI.', 'HLAJ', 'TY HLAJEŠ!'],
  playerHit:     ['NEFÉL!', 'NEEEEEEE', 'MAMI!!! NE!!'],
  playerMiss:    ['HIHIHI.', 'UU TO JE MI LÍTO mami (*není jí to líto*)', 'VEDLE!'],
  unfair:        ['NEHLAJU!!!!!!!!!!!!', 'NEFÉL!!!!!!!!!!!'],
  shuffled:      ['...', 'HLAJEM?']
};

const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------------------------------------------------------------------
   NASTAVENÍ (ukládá se do localStorage)
   --------------------------------------------------------------------- */
function loadSettings() {
  try { return JSON.parse(localStorage.getItem('pexeso') || '{}'); } catch (e) { return {}; }
}
function saveSettings() {
  try { localStorage.setItem('pexeso', JSON.stringify(settings)); } catch (e) { /* nevadí */ }
}
const settings = Object.assign({ size: 6, bubble: true, sfx: true, music: true }, loadSettings());

/* ---------------------------------------------------------------------
   ZVUK (vše generované přes Web Audio API, žádné soubory)
   Chceš vlastní zvuky? Nahraď obsah objektu `sfx` voláním
   new Audio('zvuk.mp3').play()
   --------------------------------------------------------------------- */
let ac = null, sfxGain = null, musicGain = null;

function audio() {
  if (!ac) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ac = new C();
    sfxGain = ac.createGain();
    musicGain = ac.createGain();
    sfxGain.connect(ac.destination);
    musicGain.connect(ac.destination);
    applyAudioSettings();
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

function applyAudioSettings() {
  if (!ac) return;
  sfxGain.gain.value = settings.sfx ? 0.8 : 0;
  musicGain.gain.value = settings.music ? 0.12 : 0;
}

function note(freq, dur, type, vol, when, bus, slideTo) {
  const a = audio();
  if (!a) return;
  const t = (when === null || when === undefined) ? a.currentTime : when;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(bus === 'music' ? musicGain : sfxGain);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function arpeggio(freqs, step, dur, type, vol) {
  const a = audio();
  if (!a) return;
  freqs.forEach((f, i) => note(f, dur, type, vol, a.currentTime + i * step, 'sfx'));
}

const sfx = {
  flip()   { note(500, 0.09, 'square', 0.12, null, 'sfx', 850); },
  match()  { arpeggio([523, 659, 784], 0.09, 0.18, 'triangle', 0.25); },
  miss()   { note(240, 0.3, 'sawtooth', 0.15, null, 'sfx', 130); },
  think()  { arpeggio([330, 392, 330, 392], 0.12, 0.14, 'sine', 0.2); },
  hand()   { note(900, 1.6, 'sawtooth', 0.1, null, 'sfx', 150); },
  win()    { arpeggio([523, 659, 784, 1047, 784, 1047], 0.13, 0.25, 'triangle', 0.25); }
};

/* Jednoduchá hudba na pozadí: opakující se smyčka čtyř akordů */
const MUSIC_BARS = [
  [261.63, 329.63, 392.00, 329.63],
  [220.00, 261.63, 329.63, 261.63],
  [174.61, 220.00, 261.63, 220.00],
  [196.00, 246.94, 293.66, 246.94]
];
let musicTimer = null, musicBar = 0, musicNext = 0;

function startMusic() {
  if (musicTimer) return;
  const a = audio();
  if (!a) return;
  musicNext = a.currentTime + 0.1;
  musicTimer = setInterval(scheduleMusic, 500);
  scheduleMusic();
}

function scheduleMusic() {
  while (musicNext < ac.currentTime + 1.5) {
    const bar = MUSIC_BARS[musicBar % MUSIC_BARS.length];
    bar.forEach((f, i) => note(f, 0.5, 'triangle', 0.5, musicNext + i * 0.4, 'music'));
    note(bar[0] / 2, 1.6, 'sine', 0.7, musicNext, 'music');
    musicNext += 1.6;
    musicBar++;
  }
}

/* ---------------------------------------------------------------------
   UI: obrazovky, bublina, skóre
   --------------------------------------------------------------------- */
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
}

/* Avatar počítače podle stavu (klíče jsou stejné jako v MESSAGES).
   Cokoli, co tu není, použije výchozí obrázek. */
const AVATAR_DEFAULT = 'obrazky/green-happy.png';
const AVATARS = {
  unfair:       'obrazky/red-angry.png',       // počítač se zlobí
  adviceBad:    'obrazky/blue-sad.png',      // zklamaný / naštvaný
  computerMiss: 'obrazky/blue-sad.png',
  playerHit:    'obrazky/blue-sad.png'
};

// předem načte obrázky, ať první změna avatara neblikne
Object.values(AVATARS).forEach(src => { new Image().src = src; });


function say(key) {
   $('avatar').querySelector('img').src = AVATARS[key] || AVATAR_DEFAULT;
  $('bubble-text').textContent = pick(MESSAGES[key]);
}

function applyBubbleSetting() {
  $('bubble').classList.toggle('hidden', !settings.bubble);
  $('btn-bubble').textContent = '💬 Bublina: ' + (settings.bubble ? 'ano' : 'ne');
}

function applyAudioButtons() {
  $('btn-sfx').classList.toggle('off', !settings.sfx);
  $('btn-music').classList.toggle('off', !settings.music);
}

function applySizeButtons() {
  document.querySelectorAll('.size-btn').forEach(b =>
    b.classList.toggle('selected', Number(b.dataset.size) === settings.size));
}

function updateScore() {
  $('score-player').textContent = playerPairs;
  $('score-computer').textContent = computerPairs;
}

function setTurn(who) {
  $('score-player').parentElement.classList.toggle('active', who === 'player');
  $('score-computer').parentElement.classList.toggle('active', who === 'computer');}

/* ---------------------------------------------------------------------
   STAV HRY
   --------------------------------------------------------------------- */
const ABORT = Symbol('abort');   // přeruší rozběhnutou hru (třeba při návratu do menu)
let gameId = 0;
let cards = [];                  // jen skutečné karty (bez prázdného políčka)
let playerPairs = 0, computerPairs = 0;
let pending = null;              // čeká se na klik hráče na kartu
let firstMove = true;

const board = $('board');

function pause(ms, gid) {
  return sleep(ms).then(() => { if (gid !== gameId) throw ABORT; });
}

function remaining() {
  return cards.filter(c => !c.matched).length;
}

function linkTwins() {
  cards.forEach(c => { c.twin = cards.find(o => o !== c && o.pair === c.pair); });
}

function buildBoard() {
  const n = settings.size;
  const total = n * n;
  const centre = total % 2 === 1 ? (total - 1) / 2 : -1;  
  
  const pairCount = Math.floor(total / 2);
  if (PAIRS.length < pairCount) {
    throw new Error('Mřížka ' + n + '×' + n + ' potřebuje ' + pairCount +
                    ' párů, v PAIRS jich je ' + PAIRS.length);
  }
  const chosen = shuffle(PAIRS.map((imgs, id) => ({ id, imgs }))).slice(0, pairCount);
  const deck = shuffle(chosen.flatMap(p => [
    { pair: p.id, img: p.imgs[0] },
    { pair: p.id, img: p.imgs[1] }
  ]));

  board.innerHTML = '';
  board.style.setProperty('--n', n);
  board.className = '';
  cards = [];

  let d = 0;
  for (let i = 0; i < total; i++) {
    if (i === centre) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      board.appendChild(slot);
      continue;
    }
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = '<div class="inner"><div class="face back"></div><div class="face front"></div></div>';
    const { pair, img } = deck[d++];
    const card = { pair, img, el, matched: false, faceUp: false, seen: false, twin: null };
    const image = document.createElement('img');
    image.src = img;
    image.alt = '';
    image.draggable = false;
    el.querySelector('.front').appendChild(image);
    el.addEventListener('click', () => onCardClick(card));
    board.appendChild(el);
    cards.push(card);
  }
  linkTwins();
}

function onCardClick(card) {
  if (!pending) return;                        // teď není čas klikat
  if (card.matched || card.faceUp) return;
  const resolve = pending;
  pending = null;
  resolve(card);
}

function waitCard() {
  return new Promise(resolve => { pending = resolve; });
}

function flip(card, up) {
  card.faceUp = up;
  card.el.classList.toggle('flipped', up);
  if (up) card.seen = true;
  sfx.flip();
}

/* Vyhodnotí dvojici otočených karet. Vrací true, pokud je to pár. */
async function resolvePair(a, b, gid) {
  await pause(900, gid);
  if (a.pair === b.pair) {
    a.matched = b.matched = true;
    a.el.classList.add('matched');
    b.el.classList.add('matched');
    sfx.match();
    return true;
  }
  flip(a, false);
  flip(b, false);
  sfx.miss();
  await pause(500, gid);
  return false;
}

/* ---------------------------------------------------------------------
   TAH HRÁČE
   --------------------------------------------------------------------- */
async function playerTurn(gid) {
  setTurn('player');
  say('playerTurn');

  const a = await waitCard();
  flip(a, true);
  const b = await waitCard();
  flip(b, true);

  const ok = await resolvePair(a, b, gid);
  if (!ok) { say('playerMiss'); await pause(1500, gid); return 'computer'; }

  playerPairs++;
  updateScore();
  if (remaining() === 0) return 'player';

  // PRAVIDLO A: hráč nesmí mít víc párů než počítač
  if (playerPairs > computerPairs) {
    await handShuffle(gid);
  } else {
    say('playerHit');
    await pause(1500, gid);
  }
  return 'player';
}

/* Animace ruky + zamíchání zbývajících karet */
async function handShuffle(gid) {
  say('unfair');
  await pause(1800, gid);

  $('hand').classList.add('sweep');
  board.classList.add('scramble');
  sfx.hand();
  await pause(900, gid);                       // ruka je právě nad plochou

  // const free = cards.filter(c => !c.matched);
  // const values = shuffle(free.map(c => c.value));
  // free.forEach((c, i) => {
  //   c.value = values[i];
  //   c.el.querySelector('.front').textContent = c.value;
  //   c.seen = false;                            // počítač zapomněl, kde co bylo
  // });
  // linkTwins();

  const rand = () => Math.random() * 2 - 1;    // náhodné číslo od -1 do 1
  cards.filter(c => !c.matched).forEach(c => {
    // posun v násobcích velikosti karty, takže funguje u 5×5 i 7×7
  c.el.style.setProperty('--dx', (rand() * 0.5).toFixed(3));
  c.el.style.setProperty('--dy', (rand() * 0.5).toFixed(3));
  });

  await pause(900, gid);
  $('hand').classList.remove('sweep');
  board.classList.remove('scramble');
  say('shuffled');
  await pause(1200, gid);
}

/* ---------------------------------------------------------------------
   TAH POČÍTAČE
   --------------------------------------------------------------------- */
function pickFirst() {
  const open = cards.filter(c => !c.matched && !c.faceUp);
  const knownPairs = open.filter(c => c.seen && c.twin.seen);
  if (knownPairs.length && Math.random() < 0.6) return pick(knownPairs);
  const unseen = open.filter(c => !c.seen);
  return pick(unseen.length ? unseen : open);
}

function pickSecond(first) {
  const open = cards.filter(c => !c.matched && !c.faceUp && c !== first);
  const unseen = open.filter(c => !c.seen);
  return pick(unseen.length ? unseen : open);
}

/* Náhodná karta, která NENÍ dvojicí první karty (a není to první karta) */
function pickWrong(first) {
  const others = cards.filter(c => !c.matched && !c.faceUp && c !== first && c !== first.twin);
  return others.length ? pick(others) : first.twin;   // zbývá-li jen pár, není z čeho vybírat
}

async function computerTurn(gid) {
  setTurn('computer');
  say(firstMove ? 'start' : 'computerStart');
  firstMove = false;
  await pause(1500, gid);

  const first = pickFirst();
  flip(first, true);
  await pause(800, gid);

  let second;
  let advised = false;                         // true, pokud druhou kartu vybral hráč
  const twin = first.twin;
  const knowsTwin = twin.seen && !twin.matched;   // dvojice už byla dřív odhalena
  const P_ASK = 0.5, P_WRONG = 0.2;               // zbytek (0.3) = správná karta
  const roll = Math.random();                     // číslo od 0 do 1

  if (knowsTwin && roll < P_ASK) {
    // 50 %: počítač se zeptá hráče (pravidlo B)
    advised = true;
    say('askAdvice');
    sfx.think();
    board.classList.add('advice');
    second = await waitCard();
    board.classList.remove('advice');
    second.el.classList.add('marked');
    say('adviceTrust');
    await pause(1400, gid);
    second.el.classList.remove('marked');
  } else if (knowsTwin && roll < P_ASK + P_WRONG) {
    // 20 %: počítač otočí náhodnou špatnou kartu
    say('computerSecond');
    await pause(1000, gid);
    second = pickWrong(first);
  } else if (knowsTwin) {
    // 30 %: počítač otočí správnou kartu
    say('computerSecond');
    await pause(1000, gid);
    second = twin;
  } else {
    // dvojice zatím neznámá: náhodná neviděná karta
    say('computerSecond');
    await pause(1000, gid);
    second = pickSecond(first);
  }
  flip(second, true);
  const ok = await resolvePair(first, second, gid);
  if (ok) {
    computerPairs++;
    updateScore();
    if (remaining() > 0) {
      say(advised ? 'adviceGood' : 'computerHit');   // poděkování až teď
      await pause(1800, gid);
    }
    return 'computer';
  }
  say(advised ? 'adviceBad' : 'computerMiss');       // zvláštní hláška pro špatnou radu
  await pause(1800, gid);
  return 'player';
}

/* ---------------------------------------------------------------------
   HLAVNÍ SMYČKA
   --------------------------------------------------------------------- */
async function gameLoop(gid) {
  try {
    let turn = 'computer';                     // začíná počítač
    while (remaining() > 0) {
      turn = turn === 'computer' ? await computerTurn(gid) : await playerTurn(gid);
    }
    await pause(900, gid);
    showEnd();
  } catch (e) {
    if (e !== ABORT) throw e;
  }
}

function resetTransient() {
  pending = null;
  $('hand').classList.remove('sweep');
  board.classList.remove('scramble', 'advice');
}

function startGame() {
  gameId++;
  resetTransient();
  playerPairs = 0;
  computerPairs = 0;
  firstMove = true;
  buildBoard();
  updateScore();
  applyBubbleSetting();
  show('screen-game');
  gameLoop(gameId);
}

function leaveToMenu() {
  gameId++;                                    // zruší rozehranou hru
  resetTransient();
  show('screen-start');
}

const END_TITLES = {
  computer: 'PROHRÁLA JSI<br>HURÁ',   // vyhrál počítač
  player:   'VYHRÁLA JSI,<br>ALE PŘÍŠTĚ S TEBOU N*NA<br>HRÁT NEBUDE',  // vyhrál hráč
  draw:     'NIKDO NEPROHRÁL<br>TAKŽE PROHRÁLI VŠICHNI'    // remíza
};

function showEnd() {
  const result = playerPairs > computerPairs ? 'player'
               : playerPairs < computerPairs ? 'computer'
               : 'draw';
  $('end-title').innerHTML = END_TITLES[result];
  $('end-score').textContent = 'Ty: ' + playerPairs + ' : N*na: ' + computerPairs;
  sfx.win();
  show('screen-end');
}

/* ---------------------------------------------------------------------
   OVLÁDÁNÍ
   --------------------------------------------------------------------- */
// Prohlížeče povolí zvuk až po prvním kliknutí
document.addEventListener('pointerdown', () => { audio(); startMusic(); }, { once: true });

$('btn-new').addEventListener('click', startGame);
$('btn-again').addEventListener('click', startGame);
// $('btn-credits').addEventListener('click', () => show('screen-credits'));
// $('btn-credits-back').addEventListener('click', () => show('screen-start'));
$('btn-menu').addEventListener('click', leaveToMenu);
$('btn-end-menu').addEventListener('click', leaveToMenu);

document.querySelectorAll('.size-btn').forEach(b => {
  b.addEventListener('click', () => {
    settings.size = Number(b.dataset.size);
    saveSettings();
    applySizeButtons();
  });
});

$('btn-bubble').addEventListener('click', () => {
  settings.bubble = !settings.bubble;
  saveSettings();
  applyBubbleSetting();
});

$('btn-sfx').addEventListener('click', () => {
  settings.sfx = !settings.sfx;
  saveSettings();
  applyAudioSettings();
  applyAudioButtons();
});

$('btn-music').addEventListener('click', () => {
  settings.music = !settings.music;
  saveSettings();
  applyAudioSettings();
  applyAudioButtons();
});

/* Rozdělí text prvků s třídou .wave na písmena, aby se mohla animovat jednotlivě */
function initWaveText() {
  document.querySelectorAll('.wave').forEach(el => {
    const text = el.textContent;
    el.setAttribute('aria-label', text);   // čtečky obrazovky přečtou celý text
    el.textContent = '';
    [...text].forEach((char, i) => {
      const span = document.createElement('span');
      span.setAttribute('aria-hidden', 'true');
      span.className = char === ' ' ? 'space' : 'ch';
      span.style.setProperty('--i', i);
      span.textContent = char === ' ' ? '' : char;
      el.appendChild(span);
    });
  });
}

initWaveText();

applySizeButtons();
applyBubbleSetting();
applyAudioButtons();
