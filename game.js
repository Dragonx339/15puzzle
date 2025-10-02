// ==========================
// 言語切替用テキスト
// ==========================
const texts = {
  jp: {
    title: "15パズル",
    moves: "手数",
    time: "時間",
    shuffle: "シャッフル",
    undo: "1手戻す",
    reset: "リセット",
    check: "揃ってる？",
    bg: "背景チェンジ！",
    desc: "このゲームは15パズルです。タイルを動かして1〜15を順番に並べましょう。",
    win: "🎉 クリア！ おめでとう！",
    start: "スタート",
    back: "← メニューへ戻る"
  },
  en: {
    title: "15 Puzzle",
    moves: "Moves",
    time: "Time",
    shuffle: "Shuffle",
    undo: "Undo",
    reset: "Reset",
    check: "Check",
    bg: "Change BG!",
    desc: "This is the 15 Puzzle. Move the tiles and arrange them from 1 to 15.",
    win: "🎉 Clear! Congratulations!",
    start: "Start",
    back: "← Back to Menu"
  }
};

let currentLang = localStorage.getItem("puzzleLang") || "jp";

// ==========================
// 要素取得
// ==========================
const gridEl   = document.getElementById('grid');
const movesEl  = document.getElementById('moves');
const timeEl   = document.getElementById('time');
const winEl    = document.getElementById('win');

const btnShuffle = document.getElementById('shuffle');
const btnUndo    = document.getElementById('undo');
const btnReset   = document.getElementById('reset');
const btnCheck   = document.getElementById('check');
const btnColor   = document.getElementById('colorBtn');
const se         = document.getElementById('se');

const menuEl   = document.getElementById("menu");
const appEl    = document.getElementById("app");
const startBtn = document.getElementById("startBtn");
const backBtn  = document.getElementById("backBtn");

const settingsBtn = document.getElementById("settingsBtn");
const modalEl     = document.getElementById("modal");
const closeModal  = document.getElementById("closeModal");

const saveNameInput = document.getElementById('saveName');
const saveBtn  = document.getElementById('saveBtn');
const loadBtn  = document.getElementById('loadBtn');
const deleteBtn= document.getElementById('deleteBtn');
const saveList = document.getElementById('saveList');
const autosaveChk   = document.getElementById('autosaveChk');
const deleteAllBtn  = document.getElementById('deleteAllBtn');

// ==========================
// ゲーム変数
// ==========================
const N = 4;
let board = [];
let moves = 0;
let timerId = null;
let startAt = null;
let undoStack = [];
let elapsedMs = 0;

// ==========================
// 言語適用
// ==========================
function applyLanguage(lang){
  currentLang = lang;
  localStorage.setItem("puzzleLang", lang);

  document.querySelector("header h1").textContent = texts[lang].title;
  movesEl.parentNode.firstChild.textContent = texts[lang].moves + ": ";
  timeEl.parentNode.firstChild.textContent = texts[lang].time + ": ";

  btnShuffle.textContent = texts[lang].shuffle;
  btnUndo.textContent = texts[lang].undo;
  btnReset.textContent = texts[lang].reset;
  btnCheck.textContent = texts[lang].check;
  btnColor.textContent = texts[lang].bg;

  document.getElementById("descText").textContent = texts[lang].desc;
  winEl.textContent = texts[lang].win;
  startBtn.textContent = texts[lang].start;
  backBtn.textContent = texts[lang].back;
}
document.querySelectorAll("input[name='langOpt']").forEach(r=>{
  r.addEventListener("change", (e)=> applyLanguage(e.target.value));
});
applyLanguage(currentLang);

// ==========================
// タイマー関連
// ==========================
function formatTime(ms){
  const sec = Math.floor(ms/1000);
  const m = String(Math.floor(sec/60)).padStart(2,'0');
  const s = String(sec%60).padStart(2,'0');
  return `${m}:${s}`;
}
function startTimer(){
  if (timerId) return;
  startAt = performance.now() - elapsedMs;
  timerId = setInterval(()=>{
    elapsedMs = performance.now() - startAt;
    timeEl.textContent = formatTime(elapsedMs);
  },200);
}
function stopTimer(){ clearInterval(timerId); timerId=null; }
function resetTimer(){ stopTimer(); elapsedMs=0; timeEl.textContent="00:00"; }

// ==========================
// 盤面ロジック
// ==========================
const clone = a => a.slice();
const idx = (r,c) => r*N+c;

function isSolved(arr=board){
  for (let i=0;i<15;i++) if(arr[i]!==i+1) return false;
  return arr[15]===0;
}
function findZero(arr=board){ const i=arr.indexOf(0); return {r:Math.floor(i/N), c:i%N, i}; }
function canMove(tileIndex, arr=board){
  const {i:zi}=findZero(arr); const zr=Math.floor(zi/N), zc=zi%N;
  const tr=Math.floor(tileIndex/N), tc=tileIndex%N;
  return Math.abs(zr-tr)+Math.abs(zc-tc)===1;
}
function swap(a,i,j){ const t=a[i]; a[i]=a[j]; a[j]=t; }

function countInversions(arr){ const a=arr.filter(x=>x!==0); let inv=0;
  for(let i=0;i<a.length;i++){ for(let j=i+1;j<a.length;j++){ if(a[i]>a[j]) inv++; } }
  return inv;
}
function rowFromBottomOfZero(arr){ const z=arr.indexOf(0); const r=Math.floor(z/N); return N-r; }
function isSolvable(arr){ return ((countInversions(arr)+rowFromBottomOfZero(arr))%2)===0; }

function shuffledSolvable(){
  let a=[...Array(15).keys()].map(x=>x+1).concat(0);
  do{ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); swap(a,i,j); } }
  while(!isSolvable(a)||isSolved(a));
  return a;
}

function render(){
  gridEl.innerHTML='';
  board.forEach((v,i)=>{
    const div=document.createElement('div');
    div.className='tile'+(v===0?' empty':'');
    if(v!==0){
      if(canMove(i)) div.classList.add('fits');
      div.textContent=v;
      div.addEventListener('click',()=>moveAtIndex(i,true));
    }
    gridEl.appendChild(div);
  });
  movesEl.textContent=moves;
  if(isSolved()){ winEl.classList.add('show'); stopTimer(); }
  else winEl.classList.remove('show');
}

// ==========================
// 効果音
// ==========================
function playSE(){ try{ se.currentTime=0; se.play(); }catch(e){} }

// ==========================
// 操作系
// ==========================
function moveAtIndex(i,pushUndo=false){
  if(!canMove(i)) return false;
  if(pushUndo) undoStack.push(clone(board));
  const zi=findZero().i;
  swap(board,i,zi);
  moves++;
  if(!timerId) startTimer();
  render();
  playSE();
  autoSaveIfEnabled();
  return true;
}

function newGame(){
  board=shuffledSolvable(); moves=0; undoStack=[];
  resetTimer(); render();
  autoSaveIfEnabled();
}

// キー操作
window.addEventListener('keydown',(e)=>{
  const key=e.key.toLowerCase(); const {r,c}=findZero(); let target=null;
  if(key==='arrowup'||key==='w'){ if(r<N-1) target=idx(r+1,c);}
  if(key==='arrowdown'||key==='s'){ if(r>0) target=idx(r-1,c);}
  if(key==='arrowleft'||key==='a'){ if(c<N-1) target=idx(r,c+1);}
  if(key==='arrowright'||key==='d'){ if(c>0) target=idx(r,c-1);}
  if(target!=null) moveAtIndex(target,true);
},{passive:true});

// スワイプ
let touchStart=null;
gridEl.addEventListener('touchstart',(e)=>{ if(e.touches.length===1) touchStart={x:e.touches[0].clientX,y:e.touches[0].clientY}; },{passive:true});
gridEl.addEventListener('touchend',(e)=>{
  if(!touchStart)return;
  const dx=e.changedTouches[0].clientX-touchStart.x;
  const dy=e.changedTouches[0].clientY-touchStart.y;
  const absx=Math.abs(dx), absy=Math.abs(dy);
  const {r,c}=findZero(); let target=null;
  if(Math.max(absx,absy)<24){touchStart=null;return;}
  if(absx>absy){ if(dx>0&&c>0)target=idx(r,c-1); if(dx<0&&c<N-1)target=idx(r,c+1);}
  else{ if(dy>0&&r>0)target=idx(r-1,c); if(dy<0&&r<N-1)target=idx(r+1,c);}
  if(target!=null) moveAtIndex(target,true);
  touchStart=null;
},{passive:true});

// ==========================
// ボタン動作
// ==========================
btnShuffle.addEventListener('click',()=>{ newGame(); playSE(); });
btnUndo.addEventListener('click',()=>{ const prev=undoStack.pop(); if(!prev)return; board=prev; moves++; render(); playSE(); autoSaveIfEnabled(); });
btnReset.addEventListener('click',()=>{ newGame(); playSE(); });
btnCheck.addEventListener('click',()=>{ if(isSolved()){ winEl.classList.add('show'); playSE(); } else { winEl.classList.remove('show'); }});
btnColor.addEventListener('click',()=>{ document.body.style.background=randomBackground(); playSE(); });

// 背景候補
const backgrounds=[
 "linear-gradient(135deg,#89f7fe,#66a6ff)",
 "linear-gradient(135deg,#ff9a9e,#fad0c4)",
 "linear-gradient(135deg,#a18cd1,#fbc2eb)",
 "linear-gradient(135deg,#f6d365,#fda085)",
 "linear-gradient(135deg,#84fab0,#8fd3f4)",
 "linear-gradient(135deg,#96fbc4,#f9f586)",
 "linear-gradient(135deg,#5ee7df,#b490ca)"
];
function randomBackground(){
 return backgrounds[Math.floor(Math.random()*backgrounds.length)];
}

// ==========================
// メニュー/戻る/モーダル
// ==========================
startBtn.addEventListener("click",()=>{ menuEl.style.display="none"; appEl.style.display="block"; newGame(); });
backBtn.addEventListener("click",()=>{
  appEl.style.display="none"; menuEl.style.display="grid"; newGame(); resetTimer(); winEl.classList.remove("show"); autoSaveIfEnabled();
});
settingsBtn.addEventListener("click",()=>{ modalEl.style.display="block"; autosaveChk.checked=isAutosaveEnabled(); renderSaveList(); });
closeModal.addEventListener("click",()=>{ modalEl.style.display="none"; });

// ==========================
// セーブ/ロード/自動保存
// ==========================
const SAVE_PREFIX='puzzleSave:'; const LAST_KEY='puzzleSave:last'; const AUTO_KEY=SAVE_PREFIX+'__AUTO__'; const AUTO_FLAG='puzzleSave:__AUTOSAVE_ENABLED__';

function sanitizeName(name){ return String(name||'').trim().replace(/[^\w\-ぁ-んァ-ン一-龥]/g,'').slice(0,24);}
function keyOf(name){ return SAVE_PREFIX+name; }
function listSaves(){ const names=[]; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k&&k.startsWith(SAVE_PREFIX)&&k!==AUTO_KEY) names.push(k.slice(SAVE_PREFIX.length)); } return names.sort(); }
function renderSaveList(){ saveList.innerHTML=''; listSaves().forEach(n=>{ const li=document.createElement('li'); li.innerHTML=`<span>${n}</span><small>クリックで選択</small>`; li.addEventListener('click',()=>{saveNameInput.value=n;}); saveList.appendChild(li); }); }

function saveSnapshotTo(key){ const data={board:board.slice(), moves, elapsedMs, solved:isSolved(), savedAt:new Date().toISOString()}; localStorage.setItem(key,JSON.stringify(data)); }
function saveGameByName(name){ const nm=sanitizeName(name||saveNameInput.value); if(!nm){alert('セーブ名を入力してね');return;} saveSnapshotTo(keyOf(nm)); localStorage.setItem(LAST_KEY,nm); renderSaveList(); }
function loadGameByName(name){ const nm=sanitizeName(name||saveNameInput.value); const raw=localStorage.getItem(keyOf(nm)); if(!raw){alert('その名前のセーブは無いよ');return;} applyLoadedData(JSON.parse(raw)); }
function deleteGameByName(name){ const nm=sanitizeName(name||saveNameInput.value); const k=keyOf(nm); if(!localStorage.getItem(k)){alert('その名前のセーブは無い');return;} localStorage.removeItem(k); renderSaveList(); }

function applyLoadedData(data){ stopTimer(); board=data.board.slice(); moves=data.moves; elapsedMs=data.elapsedMs||0; render(); timeEl.textContent=formatTime(elapsedMs); menuEl.style.display="none"; appEl.style.display="block"; }

saveBtn.addEventListener('click',()=>saveGameByName());
loadBtn.addEventListener('click',()=>loadGameByName());
deleteBtn.addEventListener('click',()=>deleteGameByName());
deleteAllBtn.addEventListener('click',()=>{ if(confirm("全部消す？")){ const ks=[]; for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i); if(k&&k.startsWith(SAVE_PREFIX)) ks.push(k);} ks.forEach(k=>localStorage.removeItem(k)); renderSaveList(); }});

// 自動保存
function isAutosaveEnabled(){ return localStorage.getItem(AUTO_FLAG)!=='0'; }
function setAutosaveEnabled(f){ localStorage.setItem(AUTO_FLAG,f?'1':'0'); }
function autoSaveIfEnabled(){ if(isAutosaveEnabled()) saveSnapshotTo(AUTO_KEY); }
autosaveChk.addEventListener('change',()=>{ setAutosaveEnabled(autosaveChk.checked); if(autosaveChk.checked) autoSaveIfEnabled(); });

// ==========================
// 初期化
// ==========================
(function init(){
  const raw=localStorage.getItem(AUTO_KEY);
  if(raw){ applyLoadedData(JSON.parse(raw)); }
  else newGame();
})();
