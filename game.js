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
      modal: "ゲームの説明",
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
      modal: "Game Explanation",
      desc: "This is the 15 Puzzle. Move the tiles and arrange them from 1 to 15.",
      win: "🎉 Clear! Congratulations!",
      start: "Start",
      back: "← Back to Menu"
    }
  };
  let currentLang = localStorage.getItem("puzzleLang") || "jp";

  // ---------- DOM refs ----------
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
  const se2        = document.getElementById('se2');
  const se3        = document.getElementById('se3');

  const menuEl   = document.getElementById("menu");
  const appEl    = document.getElementById("app");
  const startBtn = document.getElementById("startBtn");
  const backBtn  = document.getElementById("backBtn");

  const modalEl     = document.getElementById("modal");
  const closeModal  = document.getElementById("closeModal");
  // 歯車ボタン（メニュー/ゲーム どちらでもOK）
  const settingsButtons = Array.from(document.querySelectorAll('#settingsBtn, #settingsBtnMenu')).filter(Boolean);

  // セーブUI
  const saveNameInput = document.getElementById('saveName');
  const saveBtn  = document.getElementById('saveBtn');
  const loadBtn  = document.getElementById('loadBtn');
  const deleteBtn= document.getElementById('deleteBtn');
  const saveList = document.getElementById('saveList');
  const autosaveChk   = document.getElementById('autosaveChk');
  const deleteAllBtn  = document.getElementById('deleteAllBtn');

  // 言語ラジオ
  const langRadios = document.querySelectorAll("input[name='langOpt']");

  // ---------- Game state ----------
  const N = 4;
  let board = [];
  let moves = 0;
  let timerId = null;
  let startAt = null;
  let undoStack = [];
  let elapsedMs = 0;

  // ---------- Language ----------
  function applyLanguage(lang){
    currentLang = lang;
    localStorage.setItem("puzzleLang", lang);

    const setText = (sel, text) => {
      const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
      if (el) el.textContent = text;
    };

    setText("header h1", texts[lang].title);
    setText("#movesLabel", texts[lang].moves);
    setText("#timeLabel",  texts[lang].time);

    setText("#shuffle",  texts[lang].shuffle);
    setText("#undo",     texts[lang].undo);
    setText("#reset",    texts[lang].reset);
    setText("#check",    texts[lang].check);
    setText("#colorBtn", texts[lang].bg);
    
    setText("#modalTitle", texts[lang].modal);
    setText("#descText", texts[lang].desc);
    setText("#win",      texts[lang].win);
    setText("#startBtn", texts[lang].start);
    setText("#backBtn",  texts[lang].back);
  }
  langRadios.forEach(r => r.addEventListener('change', e => applyLanguage(e.target.value)));
  applyLanguage(currentLang);

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
      if (timeEl) timeEl.textContent = formatTime(elapsedMs);
    },200);
  }
  function stopTimer(){ clearInterval(timerId); timerId=null; }
  function resetTimer(){ stopTimer(); elapsedMs=0; if (timeEl) timeEl.textContent="00:00"; }

  // ---------- Board logic ----------
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

  function countInversions(arr){
    const a=arr.filter(x=>x!==0); let inv=0;
    for(let i=0;i<a.length;i++) for(let j=i+1;j<a.length;j++) if(a[i]>a[j]) inv++;
    return inv;
  }
  function rowFromBottomOfZero(arr){
    const z=arr.indexOf(0); const r=Math.floor(z/N); return N-r;
  }
  function isSolvable(arr){
    return ((countInversions(arr)+rowFromBottomOfZero(arr))%2)===0;
  }

  function shuffledByRandomMoves(iterations = N** 4){
    const a=[...Array(15).keys()].map(x=>x+1).concat(0);
    let prevBlank = -1;
    // do{
    //   for(let i=a.length-1;i>0;i--){
    //     const j=Math.floor(Math.random()*(i+1));
    //     swap(a,i,j);
    //   }
    // } while(!isSolvable(a)||isSolved(a));
    const neighborsOfBlank = (blankIndex) => {
      const r = Math.floor(blankIndex / N);
      const c = blankIndex % N;
      const ns = [];
      if (r > 0) ns.push(blankIndex -N);
      if (r < N - 1) ns.push(blankIndex + N);
      if (c > 0) ns.push(blankIndex - 1);
      if (c < N -1) ns.push(blankIndex + 1);
      return ns;
    };
    for(let k=0;k<iterations;k++){
      const blank = a.indexOf(0);
    let candidates = neighborsOfBlank(blank);
    if (prevBlank !== -1 && candidates.length > 1){
      const filtered = candidates.filter(x => x !== prevBlank);
      if (filtered.length) candidates = filtered;
    }
    const target = candidates[Math.floor(Math.random() * candidates.length)];
    prevBlank = blank;
    swap(a, blank, target);
    }
    if (isSolved(a)){
      for(let k=0;k<8;k++){
        const blank = a.indexOf(0);
        const candidates = neighborsOfBlank(blank)
        const target = candidates[Math.floor(Math.random() * candidates.length)];
        swap(a, blank, target);
      }
    }
    
    return a;
  }

  function render(){
    if (!gridEl) return;

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

    if (movesEl) movesEl.textContent=moves;

    if (winEl){
      if(isSolved()){ winEl.classList.add('show'); stopTimer(); }
      else winEl.classList.remove('show');
    }
  }

  // ---------- Sound ----------

let currentBgm = null;
  function playSE3(audio){
    if (!audio)return;
    try{ audio.currentTime=0; audio.play(); }catch(e){}
  }
    function stopSE3(audio, reset = true){
    if(!audio) return;
    try { audio.pause(); } catch(e) {}
    if (reset){
      try { audio.currentTime = 0; } catch(e) {}
    }
    try { audio.load(); } catch(e) {}
  }

    function playLoopAudio (audio){
      if(!audio) return;
      try {
        audio.loop = true;
        const p = audio.play();
        if (p && p.catch) p.catch(()=>{});
        } catch(e) {}
    }
    function syncBgmWithScreen(){
      const isGameVisible =appEl && appEl.style.display !== "none";
      const want = isGameVisible ? "game" : "menu";
      if (currentBgm === want) return;
      stopSE3(se2, true);
      stopSE3(se3, true);

      if (want === "game") playLoopAudio(se2);
      else playLoopAudio(se3);

      currentBgm = went;
    }
       function playSE(){
         playSE3(se);
       }
  
  // let bgmWanted = false;

  // function playSE(){
  //   if(!se) return;
  //   try{ se.currentTime=0; se.play(); }catch(e){}
  // }
  // function playSE2(){
  //   if(!se2) return;
  //   bgmWanted = true;
  //   try{
  //     se2.loop = true;
  //     const p = se2.play();
  //     if (p && p.then) {
  //       p.then(() => {
  //         if (!bgmWanted) {
  //           try { se2.pause(); } catch(e) {}
  //           try { se2.currentTime = 0; } catch(e) {}
  //         }
  //       }).catch(() => {});
  //     }
  //   }catch(e){}
  // }
  // function stopSE2(reset = true){
  //   if(!se2) return;
  //   bgmWanted = false;
  //   try { se2.pause(); } catch(e) {}
  //   if (reset){
  //     try { se2.currentTime = 0; } catch(e) {}
  //   }
  //   try { se2.load(); } catch(e) {}
  // }

  // ---------- Actions ----------
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
    board= shuffledByRandomMoves(N ** 4);
    moves=0; undoStack=[];
    resetTimer(); render();
    autoSaveIfEnabled();
  }

  // keyboard
  window.addEventListener('keydown',(e)=>{
    const key=e.key.toLowerCase(); const {r,c}=findZero(); let target=null;
    if(key==='arrowup'||key==='w'){ if(r<N-1) target=idx(r+1,c); }
    if(key==='arrowdown'||key==='s'){ if(r>0) target=idx(r-1,c); }
    if(key==='arrowleft'||key==='a'){ if(c<N-1) target=idx(r,c+1); }
    if(key==='arrowright'||key==='d'){ if(c>0) target=idx(r,c-1); }
    if(target!=null) moveAtIndex(target,true);
  },{passive:true});

  // swipe
  let touchStart=null;
  if (gridEl){
    gridEl.addEventListener('touchstart',(e)=>{
      if(e.touches.length===1) touchStart={x:e.touches[0].clientX,y:e.touches[0].clientY};
    },{passive:true});

    gridEl.addEventListener('touchend',(e)=>{
      if(!touchStart)return;
      const dx=e.changedTouches[0].clientX-touchStart.x;
      const dy=e.changedTouches[0].clientY-touchStart.y;
      const absx=Math.abs(dx), absy=Math.abs(dy);
      const {r,c}=findZero(); let target=null;
      if(Math.max(absx,absy)<24){ touchStart=null; return; }
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
  }

  // ---------- Buttons ----------
  if (btnShuffle) btnShuffle.addEventListener('click',()=>{ newGame(); playSE(); });

  // ※ Undoで moves++ すると「手数」が増えるので、普通は増やさないのがおすすめ
  if (btnUndo) btnUndo.addEventListener('click',()=>{
    const prev=undoStack.pop();
    if(!prev) return;
    board=prev;
    render();
    playSE();
    autoSaveIfEnabled();
  });

  if (btnReset) btnReset.addEventListener('click',()=>{ newGame(); playSE(); });

  if (btnCheck) btnCheck.addEventListener('click',()=>{
    if(!winEl) return;
    if(isSolved()){ winEl.classList.add('show'); playSE(); }
    else winEl.classList.remove('show');
  });

  if (btnColor) btnColor.addEventListener('click',()=>{
    document.body.style.background=randomBackground();
    playSE();
  });

  const backgrounds=[
    "linear-gradient(135deg,#89f7fe,#66a6ff)",
    "linear-gradient(135deg,#ff9a9e,#fad0c4)",
    "linear-gradient(135deg,#a18cd1,#fbc2eb)",
    "linear-gradient(135deg,#f6d365,#fda085)",
    "linear-gradient(135deg,#84fab0,#8fd3f4)",
    "linear-gradient(135deg,#96fbc4,#f9f586)",
    "linear-gradient(135deg,#5ee7df,#b490ca)"
  ];
  function randomBackground(){ return backgrounds[Math.floor(Math.random()*backgrounds.length)]; }

  // ---------- Menu / Modal ----------
  if (startBtn) startBtn.addEventListener("click", async ()=>{
    if(menuEl) menuEl.style.display="none";
    if(appEl)  appEl.style.display="block";
    newGame();
    syncBgmWithScreen();
  });

  if (backBtn) backBtn.addEventListener("click",()=>{
    // stopSE2(true);
    if(appEl)  appEl.style.display="none";
    if(menuEl) menuEl.style.display="grid";
    newGame();
    resetTimer();
    if(winEl) winEl.classList.remove("show");
    autoSaveIfEnabled();
    syncBgmWithScreen();
  });

  settingsButtons.forEach(btn=>{
    btn.addEventListener("click", ()=>{
      if(modalEl) modalEl.style.display="block";
      if (autosaveChk) autosaveChk.checked = isAutosaveEnabled();
      renderSaveList();
    });
  });
  if (closeModal) closeModal.addEventListener("click",()=>{ if(modalEl) modalEl.style.display="none"; });
  window.addEventListener('click',(e)=>{ if(modalEl && e.target===modalEl) modalEl.style.display="none"; });

  // ---------- Save / Load / Autosave ----------
  const SAVE_PREFIX='puzzleSave:';
  const LAST_KEY='puzzleSave:last';
  const AUTO_KEY=SAVE_PREFIX+'__AUTO__';
  const AUTO_FLAG='puzzleSave:__AUTOSAVE_ENABLED__';

  function sanitizeName(name){
    return String(name||'').trim().replace(/[^\w\-ぁ-んァ-ン一-龥]/g,'').slice(0,24);
  }
  function keyOf(name){ return SAVE_PREFIX+name; }

  function listSaves(){
    const names=[];
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      if(k && k.startsWith(SAVE_PREFIX) && k!==AUTO_KEY) names.push(k.slice(SAVE_PREFIX.length));
    }
    return names.sort();
  }
  function renderSaveList(){
    if(!saveList) return;
    saveList.innerHTML='';
    listSaves().forEach(n=>{
      const li=document.createElement('li');
      li.innerHTML=`<span>${n}</span><small>クリックで選択</small>`;
      li.addEventListener('click',()=>{ if(saveNameInput) saveNameInput.value=n; });
      saveList.appendChild(li);
    });
  }

  function saveSnapshotTo(key){
    const data={ board:board.slice(), moves, elapsedMs, solved:isSolved(), savedAt:new Date().toISOString() };
    localStorage.setItem(key, JSON.stringify(data));
  }
  function saveGameByName(name){
    const nm=sanitizeName(name || (saveNameInput && saveNameInput.value));
    if(!nm){ alert('セーブ名を入力してね'); return; }
    saveSnapshotTo(keyOf(nm)); localStorage.setItem(LAST_KEY,nm);
    renderSaveList();
  }
  function applyLoadedData(data){
    stopTimer();
    board = Array.isArray(data.board)? data.board.slice(): board;
    moves = Number(data.moves)||0;
    elapsedMs = Number(data.elapsedMs)||0;
    render();
    timeEl.textContent = formatTime(elapsedMs);
    //menuEl.style.display="none";
    //appEl.style.display="block";
  }
  function loadGameByName(name){
    const nm=sanitizeName(name || (saveNameInput && saveNameInput.value));
    if(!nm){ alert('読み込むセーブ名を入力/選択してね'); return; }
    const raw=localStorage.getItem(keyOf(nm));
    if(!raw){ alert('その名前のセーブは無いよ'); return; }
    applyLoadedData(JSON.parse(raw));
  }
  function deleteGameByName(name){
    const nm=sanitizeName(name || (saveNameInput && saveNameInput.value));
    if(!nm){ alert('消去したいセーブ名を入力/選択してね'); return; }
    const k=keyOf(nm);
    if(!localStorage.getItem(k)){ alert('その名前のセーブは無い'); return; }
    if(!confirm(`「${nm}」を消去する？`)) return;
    localStorage.removeItem(k);
    renderSaveList();
    if(saveNameInput) saveNameInput.value='';
  }

  if (saveBtn)    saveBtn.addEventListener('click',()=>saveGameByName());
  if (loadBtn)    loadBtn.addEventListener('click',()=>loadGameByName());
  if (deleteBtn)  deleteBtn.addEventListener('click',()=>deleteGameByName());

  if (deleteAllBtn){
    deleteAllBtn.addEventListener('click',()=>{
      if(!confirm('この端末のセーブデータを全部消します。よい？')) return;
      const ks=[];
      for(let i=0;i<localStorage.length;i++){
        const k=localStorage.key(i);
        if(k && k.startsWith(SAVE_PREFIX)) ks.push(k);
      }
      ks.forEach(k=>localStorage.removeItem(k));
      renderSaveList();
      if(saveNameInput) saveNameInput.value='';
      alert('全部消したよ');
    });
  }

  function isAutosaveEnabled(){ return localStorage.getItem(AUTO_FLAG)!=='0'; }
  function setAutosaveEnabled(f){ localStorage.setItem(AUTO_FLAG, f?'1':'0'); }
  function autoSaveIfEnabled(){ if(isAutosaveEnabled()) saveSnapshotTo(AUTO_KEY); }

  if (autosaveChk){
    autosaveChk.checked = isAutosaveEnabled();
    autosaveChk.addEventListener('change', ()=>{
      setAutosaveEnabled(autosaveChk.checked);
      if(autosaveChk.checked) autoSaveIfEnabled();
    });
  }

  // leave-page safety save
  window.addEventListener('beforeunload', ()=>{ autoSaveIfEnabled(); });

  // ---------- Init ----------
  (function init(){
    try{
      const raw = localStorage.getItem(AUTO_KEY);
      if (raw) applyLoadedData(JSON.parse(raw));
      else     newGame();
    }catch(e){
      console.error(e);
      newGame();
    }
  })();
});













