// ==========================
// 15 Puzzle - complete game.js
// ==========================
document.addEventListener('DOMContentLoaded', () => {

  // ---------- i18n texts ----------
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

  // ---------- DOM ----------
  const gridEl   = document.getElementById('grid');
  const movesEl  = document.getElementById('moves');
  const timeEl   = document.getElementById('time');
  const winEl    = document.getElementById('win');

  const btnShuffle = document.getElementById('shuffle');
  const btnUndo    = document.getElementById('undo');
  const btnReset   = document.getElementById('reset');
  const btnCheck   = document.getElementById('check');

  const se = document.getElementById('se');

  const menuEl   = document.getElementById("menu");
  const appEl    = document.getElementById("app");
  const startBtn = document.getElementById("startBtn");
  const backBtn  = document.getElementById("backBtn");

  // ---------- Save UI ----------
  const saveNameInput = document.getElementById('saveName');
  const saveBtn  = document.getElementById('saveBtn');
  const loadBtn  = document.getElementById('loadBtn');
  const deleteBtn= document.getElementById('deleteBtn');
  const saveList = document.getElementById('saveList');
  const autosaveChk   = document.getElementById('autosaveChk');

  // ---------- Game state ----------
  const N = 4;
  let board = [];
  let moves = 0;
  let timerId = null;
  let startAt = null;
  let undoStack = [];
  let elapsedMs = 0;

  // ---------- BGM ----------
  let bgm = null;

  function playBGM() {
    if (!bgm) {
      bgm = new Audio("tetris-theme-korobeiniki-rearranged-arr-for-music-box-184978.mp3");
      bgm.loop = true;
    }
    bgm.currentTime = 0;
    bgm.play();
  }

  function stopBGM() {
    if (bgm) {
      bgm.pause();
      bgm.currentTime = 0;
    }
  }

  // ---------- Timer ----------
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

  // ---------- Board ----------
  const clone = a => a.slice();
  const idx = (r,c) => r*N+c;

  function isSolved(arr=board){
    for (let i=0;i<15;i++) if(arr[i]!==i+1) return false;
    return arr[15]===0;
  }

  function findZero(arr=board){
    const i=arr.indexOf(0);
    return {r:Math.floor(i/N), c:i%N, i};
  }

  function canMove(tileIndex, arr=board){
    const {i:zi}=findZero(arr);
    const zr=Math.floor(zi/N), zc=zi%N;
    const tr=Math.floor(tileIndex/N), tc=tileIndex%N;
    return Math.abs(zr-tr)+Math.abs(zc-tc)===1;
  }

  function swap(a,i,j){
    const t=a[i]; a[i]=a[j]; a[j]=t;
  }

  function shuffledSolvable(){
    let a=[...Array(15).keys()].map(x=>x+1).concat(0);
    do{
      for(let i=a.length-1;i>0;i--){
        const j=Math.floor(Math.random()*(i+1));
        swap(a,i,j);
      }
    }while(!isSolved(a));
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
    if(isSolved()){
      winEl.classList.add('show');
      stopTimer();
    }else{
      winEl.classList.remove('show');
    }
  }

  // ---------- Sound ----------
  function playSE(){
    try{ se.currentTime=0; se.play(); }catch(e){}
  }

  // ---------- Save / Load ----------
  const SAVE_PREFIX='puzzleSave:';
  const AUTO_KEY=SAVE_PREFIX+'__AUTO__';

  function saveSnapshot(key){
    const data={ board:clone(board), moves, elapsedMs };
    localStorage.setItem(key, JSON.stringify(data));
  }

  function loadSnapshot(key){
    const raw=localStorage.getItem(key);
    if(!raw) return false;
    const d=JSON.parse(raw);
    board=d.board; moves=d.moves; elapsedMs=d.elapsedMs;
    render();
    timeEl.textContent=formatTime(elapsedMs);
    return true;
  }

  function autoSaveIfEnabled(){
    if(autosaveChk && autosaveChk.checked){
      saveSnapshot(AUTO_KEY);
    }
  }

  function renderSaveList(){
    if(!saveList) return;
    saveList.innerHTML='';
    Object.keys(localStorage)
      .filter(k=>k.startsWith(SAVE_PREFIX) && k!==AUTO_KEY)
      .forEach(k=>{
        const name=k.replace(SAVE_PREFIX,'');
        const li=document.createElement('li');
        li.textContent=name;
        li.onclick=()=>saveNameInput.value=name;
        saveList.appendChild(li);
      });
  }

  // ---------- Actions ----------
  function moveAtIndex(i,pushUndo=false){
    if(!canMove(i)) return;
    if(pushUndo) undoStack.push(clone(board));
    swap(board,i,findZero().i);
    moves++;
    if(!timerId) startTimer();
    render();
    playSE();
    autoSaveIfEnabled();
  }

  function newGame(){
    board=shuffledSolvable();
    moves=0;
    undoStack=[];
    resetTimer();
    render();
    autoSaveIfEnabled();
  }

  // ---------- Buttons ----------
  btnShuffle.onclick=()=>{ newGame(); playSE(); };
  btnUndo.onclick=()=>{
    const p=undoStack.pop();
    if(!p)return;
    board=p; moves++; render(); playSE();
  };
  btnReset.onclick=()=>{ newGame(); playSE(); };
  btnCheck.onclick=()=>{ if(isSolved()){ winEl.classList.add('show'); playSE(); } };

  // ---------- Menu ----------
  startBtn.onclick=()=>{
    menuEl.style.display="none";
    appEl.style.display="block";
    newGame();
    playBGM();
  };

  backBtn.onclick=()=>{
    stopBGM();
    appEl.style.display="none";
    menuEl.style.display="grid";
    resetTimer();
    winEl.classList.remove("show");
  };

  // ---------- Save buttons ----------
  saveBtn.onclick=()=>{
    if(!saveNameInput.value) return;
    saveSnapshot(SAVE_PREFIX+saveNameInput.value);
    renderSaveList();
  };

  loadBtn.onclick=()=>{
    if(loadSnapshot(SAVE_PREFIX+saveNameInput.value)){
      menuEl.style.display="none";
      appEl.style.display="block";
    }
  };

  deleteBtn.onclick=()=>{
    localStorage.removeItem(SAVE_PREFIX+saveNameInput.value);
    renderSaveList();
  };

  // ---------- Init ----------
  autosaveChk.checked=true;
  if(!loadSnapshot(AUTO_KEY)) newGame();
  renderSaveList();
});
