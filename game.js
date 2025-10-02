// ====== 言語切替（説明とボタン表記） ======
const descText = document.getElementById("descText");
const langBtn  = document.getElementById("langBtn");

// ボタン要素
const btnShuffle = document.getElementById('shuffle');
const btnUndo    = document.getElementById('undo');
const btnReset   = document.getElementById('reset');
const btnCheck   = document.getElementById('check');
const btnColor   = document.getElementById('colorBtn');

let lang = "jp"; // 初期は日本語
const texts = {
  jp: {
    desc: "このゲームは15パズルです。タイルを動かして 1〜15 を順番に並べましょう。",
    shuffle: "シャッフル",
    undo: "1手戻す",
    reset: "リセット",
    check: "揃ってる？",
    color: "背景チェンジ！",
    win: "🎉 クリア！ おめでとう！",
    langBtn: "English",
    tile: (v, fits) => `タイル ${v}${fits ? "（動かせます）" : ""}`,
    empty: "空白"
  },
  en: {
    desc: "This game is the 15 Puzzle. Move tiles to arrange numbers from 1 to 15.",
    shuffle: "Shuffle",
    undo: "Undo",
    reset: "Reset",
    check: "Check",
    color: "Change BG!",
    win: "🎉 Cleared! Congrats!",
    langBtn: "日本語",
    tile: (v, fits) => `Tile ${v}${fits ? " (movable)" : ""}`,
    empty: "Empty"
  }
};

function applyLang() {
  descText.textContent   = texts[lang].desc;
  langBtn.textContent    = texts[lang].langBtn;
  btnShuffle.textContent = texts[lang].shuffle;
  btnUndo.textContent    = texts[lang].undo;
  btnReset.textContent   = texts[lang].reset;
  btnCheck.textContent   = texts[lang].check;
  btnColor.textContent   = texts[lang].color;
  winEl.textContent      = texts[lang].win;
}

langBtn.addEventListener("click", () => {
  lang = (lang === "jp") ? "en" : "jp";
  applyLang();
});

// ====== 15パズル本体 ======
const N = 4;
let board = [];
let moves = 0;
let timerId = null;
let startAt = null;   // タイマー開始時刻
let elapsedMs = 0;    // 蓄積経過（一時停止→再開対応用、今回はクリア時のみ停止だが一応）
let undoStack = [];

const gridEl   = document.getElementById('grid');
const movesEl  = document.getElementById('moves');
const timeEl   = document.getElementById('time');
const winEl    = document.getElementById('win');
const se       = document.getElementById('se');

// 背景候補
const backgrounds = [
  "linear-gradient(135deg,#89f7fe,#66a6ff)",
  "linear-gradient(135deg,#ff9a9e,#fad0c4)",
  "linear-gradient(135deg,#a18cd1,#fbc2eb)",
  "linear-gradient(135deg,#f6d365,#fda085)",
  "linear-gradient(135deg,#84fab0,#8fd3f4)",
  "linear-gradient(135deg,#96fbc4,#f9f586)",
  "linear-gradient(135deg,#5ee7df,#b490ca)"
];
function randomBackground(){
  const rand = backgrounds[Math.floor(Math.random()*backgrounds.length)];
  document.body.style.background = rand;
}

// 小道具
const clone = a => a.slice();
const idx = (r,c) => r*N + c;

function formatTime(ms){
  const sec = Math.floor(ms/1000);
  const m = String(Math.floor(sec/60)).padStart(2,'0');
  const s = String(sec%60).padStart(2,'0');
  return `${m}:${s}`;
}

function startTimer(){
  if (timerId) return;
  startAt = performance.now();
  timerId = setInterval(()=>{
    const now = performance.now();
    timeEl.textContent = formatTime(elapsedMs + (now - startAt));
  }, 200);
}
function stopTimer(){
  if (!timerId) return;
  const now = performance.now();
  elapsedMs += (now - startAt);
  clearInterval(timerId);
  timerId = null;
}
function resetTimer(){
  stopTimer();
  elapsedMs = 0;
  startAt   = null;
  timeEl.textContent = "00:00";
}

function isSolved(arr=board){
  for (let i=0;i<15;i++){ if (arr[i] !== i+1) return false; }
  return arr[15] === 0;
}
function findZero(arr=board){
  const i = arr.indexOf(0);
  return {r: Math.floor(i/N), c: i%N, i};
}
function canMove(tileIndex, arr=board){
  const {i:zi} = findZero(arr);
  const zr = Math.floor(zi/N), zc = zi%N;
  const tr = Math.floor(tileIndex/N), tc = tileIndex%N;
  return Math.abs(zr-tr) + Math.abs(zc-tc) === 1;
}
function swap(a, i, j){ const t = a[i]; a[i]=a[j]; a[j]=t; }

function countInversions(arr){
  const a = arr.filter(x=>x!==0);
  let inv=0;
  for(let i=0;i<a.length;i++){
    for(let j=i+1;j<a.length;j++){
      if (a[i]>a[j]) inv++;
    }
  }
  return inv;
}
function rowFromBottomOfZero(arr){
  const z = arr.indexOf(0);
  const r = Math.floor(z/N); // 0-based from top
  return N - r;              // 1=最下段, 2=下から2段目...
}
// ★可解条件修正：4x4は (反転数 + 空白の下からの行) が「奇数」で解ける
function isSolvable(arr){
  return ((countInversions(arr) + rowFromBottomOfZero(arr)) % 2) === 1;
}

function shuffledSolvable(){
  let a = [...Array(15).keys()].map(x=>x+1).concat(0);
  do{
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      swap(a,i,j);
    }
  } while (!isSolvable(a) || isSolved(a));
  return a;
}

function render(){
  gridEl.innerHTML = '';
  board.forEach((v,i)=>{
    const div = document.createElement('div');
    div.className = 'tile' + (v===0 ? ' empty' : '');
    div.dataset.index = i;
    if (v!==0){
      const fits = canMove(i);
      if (fits) div.classList.add('fits');
      div.textContent = v;
      div.setAttribute('role','button');
      div.setAttribute('tabindex','0');
      div.setAttribute('aria-label', texts[lang].tile(v, fits));
    } else {
      div.setAttribute('aria-label', texts[lang].empty);
    }
    gridEl.appendChild(div);
  });

  // ステータス表示
  movesEl.textContent = String(moves);

  // クリア表示
  if (isSolved()){
    winEl.classList.add('show');
    stopTimer();
  } else {
    winEl.classList.remove('show');
  }
}

// 効果音（失敗しても無視）
function playSE(){
  try { se.currentTime = 0; se.play(); } catch(e){}
}

// 1手実行
function moveAtIndex(i, pushUndo=false){
  if (!canMove(i)) return false;
  if (pushUndo) undoStack.push(clone(board));
  const zi = findZero().i;
  swap(board, i, zi);
  moves++;
  if (!timerId) startTimer();
  render();
  playSE(); // タイル移動音
  return true;
}

// クリック（イベント委譲）
gridEl.addEventListener('click', (e)=>{
  const tile = e.target.closest('.tile');
  if (!tile || tile.classList.contains('empty')) return;
  const i = Number(tile.dataset.index);
  moveAtIndex(i, true);
});

// キーボード
window.addEventListener('keydown', (e)=>{
  const key = e.key.toLowerCase();
  const {r,c} = findZero();
  let target=null;
  if (key==='arrowup'||key==='w'){ if (r<N-1) target=idx(r+1,c); }
  if (key==='arrowdown'||key==='s'){ if (r>0)   target=idx(r-1,c); }
  if (key==='arrowleft'||key==='a'){ if (c<N-1) target=idx(r,c+1); }
  if (key==='arrowright'||key==='d'){ if (c>0)  target=idx(r,c-1); }
  if (target!=null) moveAtIndex(target,true);
}, {passive:true});

// スワイプ
let touchStart=null;
gridEl.addEventListener('touchstart',(e)=>{
  if(e.touches.length===1){
    touchStart={x:e.touches[0].clientX,y:e.touches[0].clientY};
  }
},{passive:true});

gridEl.addEventListener('touchend',(e)=>{
  if(!touchStart)return;
  const dx=e.changedTouches[0].clientX-touchStart.x;
  const dy=e.changedTouches[0].clientY-touchStart.y;
  const absx=Math.abs(dx),absy=Math.abs(dy);
  const {r,c}=findZero(); let target=null;
  if(Math.max(absx,absy)<24){touchStart=null;return;}
  if(absx>absy){
    if(dx>0&&c>0)target=idx(r,c-1);
    if(dx<0&&c<N-1)target=idx(r,c+1);
  } else {
    if(dy>0&&r>0)target=idx(r-1,c);
    if(dy<0&&r<N-1)target=idx(r+1,c);
  }
  if(target!=null) moveAtIndex(target,true);
  touchStart=null;
},{passive:true});

// ボタン
function newGame(){
  board = shuffledSolvable();
  moves = 0;
  undoStack = [];
  resetTimer();
  render();
}
btnShuffle.addEventListener('click',()=>{
  newGame();
  randomBackground();
  playSE();
});
btnUndo.addEventListener('click',()=>{
  const prev = undoStack.pop();
  if(!prev) return;
  board = prev;
  // Undoは手数を「減らす」or「据え置き」が自然。ここでは減らす。
  if (moves > 0) moves--;
  render();
  playSE();
});
btnReset.addEventListener('click',()=>{
  newGame();
  playSE();
});
btnCheck.addEventListener('click',()=>{
  if(isSolved()){
    winEl.classList.add('show');
    playSE();
  } else {
    winEl.classList.remove('show');
    gridEl.animate(
      [
        {transform:'translateX(0)'},
        {transform:'translateX(-4px)'},
        {transform:'translateX(4px)'},
        {transform:'translateX(0)'}
      ],
      {duration:200}
    );
  }
});
btnColor.addEventListener('click',()=>{
  randomBackground();
  playSE();
});

// 初期化
(function init(){
  newGame();
  applyLang();
})();
