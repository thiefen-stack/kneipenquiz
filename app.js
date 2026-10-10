/* KNEIPENQUIZ_V06 */
(() => {
  const BASE = window.QUIZ_QUESTIONS || [];
  let imported = JSON.parse(localStorage.getItem('bq_imported') || '[]');
  let bank = [...BASE, ...imported];
  let session = [];
  let index = 0;
  let selected = [];
  let answers = [];
  let checked = false;
  let drawTouched = false;
  let currentAudioUrl = null;

  const $ = s => document.querySelector(s);
  const profiles = window.BQProfiles;
  const screens = ['playerGate','home','quiz','results','playerStats','leaderboard'];
  let mistakes = new Set();
  let mastery = {};
  let sessionId = '', hintsRemaining = 0, hintsUsed = 0, questionStartedAt = 0;
  const progressKey = name => `bq_v06_${profiles.getActive()?.id || 'none'}_${name}`;
  function loadPlayerProgress(){
    try { mistakes = new Set(JSON.parse(localStorage.getItem(progressKey('mistakes')) || '[]')); }
    catch { mistakes = new Set(); }
    try { mastery = JSON.parse(localStorage.getItem(progressKey('mastery')) || '{}'); }
    catch { mastery = {}; }
  }

  function show(id){
    screens.forEach(x=>$('#'+x).classList.toggle('active',x===id));
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function shuffle(a){ return [...a].sort(()=>Math.random()-.5); }
  function masteryFor(id){ return mastery[String(id)] || {seen:0,correct:0,wrong:0,streak:0}; }
  function questionWeight(q){
    const m=masteryFor(q.id);
    if(mistakes.has(q.id)) return 10 + Math.min(5,m.wrong||0);
    if(!m.seen) return 5;
    const accuracy=(m.correct||0)/Math.max(1,m.seen||1);
    return Math.max(.7, 4.5-(accuracy*2.4)-Math.min(4,m.streak||0)*.45);
  }
  function weightedSample(pool,count){
    const work=[...pool], out=[];
    while(work.length && out.length<count){
      const weights=work.map(questionWeight), total=weights.reduce((a,b)=>a+b,0);
      let r=Math.random()*total, picked=0;
      for(let i=0;i<work.length;i++){ r-=weights[i]; if(r<=0){picked=i;break;} }
      out.push(work.splice(picked,1)[0]);
    }
    return out;
  }
  function normalize(s=''){
    return String(s).toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/ß/g,'ss').replace(/[^a-z0-9äöü]+/g,' ').replace(/\s+/g,' ').trim();
  }
  function normalizeSpelling(s=''){
    return String(s).normalize('NFC').toLocaleLowerCase('de-DE').trim().replace(/\s+/g,' ');
  }
  function levenshtein(a,b){
    const m=[];
    for(let i=0;i<=b.length;i++)m[i]=[i];
    for(let j=0;j<=a.length;j++)m[0][j]=j;
    for(let i=1;i<=b.length;i++)for(let j=1;j<=a.length;j++)m[i][j]=b[i-1]===a[j-1]?m[i-1][j-1]:Math.min(m[i-1][j-1]+1,m[i][j-1]+1,m[i-1][j]+1);
    return m[b.length][a.length];
  }
  function parseNumber(input=''){
    const m=String(input).match(/-?\d[\d.\s]*(?:,\d+)?/);
    if(!m) return NaN;
    let t=m[0].replace(/\s/g,'');
    if(t.includes(',') && t.includes('.')) t=t.replace(/\./g,'').replace(',','.');
    else if(t.includes(',')) t=t.replace(',','.');
    else if(/^[-+]?\d{1,3}(?:\.\d{3})+$/.test(t)) t=t.replace(/\./g,'');
    return Number(t);
  }
  function simpleMatch(input, expected, aliases=[]){
    const n=normalize(input); if(!n) return false;
    const vals=[expected,...aliases].filter(Boolean).map(normalize);
    if(vals.includes(n)) return true;
    return vals.some(v=>v.length>=6 && Math.abs(v.length-n.length)<=2 && levenshtein(v,n)<=1);
  }
  function textCorrect(input,q){
    if(q.strictSpelling){
      const n=normalizeSpelling(input);
      return [q.answer,...(q.aliases||[])].some(v=>normalizeSpelling(v)===n);
    }
    if(q.numeric){
      const num=parseNumber(input);
      if(Number.isFinite(num) && Math.abs(num-Number(q.numeric.value))<=Number(q.numeric.tolerance||0)) return true;
    }
    if(q.keywords?.length){
      const n=normalize(input);
      const hits=q.keywords.filter(k=>n.includes(normalize(k))).length;
      if(hits >= (q.minKeywords || q.keywords.length)) return true;
    }
    return simpleMatch(input,q.answer,q.aliases||[]);
  }
  function bonusCorrect(input,b){ return simpleMatch(input,b.answer,b.aliases||[]); }

  function saveImported(){ localStorage.setItem('bq_imported',JSON.stringify(imported)); }
  function refreshBank(){ bank=[...BASE,...imported]; fillCategories(); updatePoolInfo(); updateAudioCount(); renderCustomQuestions(); }
  function updateStats(){
    const s = profiles.getStats();
    $('#statSessions').textContent = s.sessions;
    $('#statAnswered').textContent = s.answered;
    $('#statCorrect').textContent = s.correct;
    $('#statWrong').textContent = mistakes.size;
    $('#bestRate').textContent = Math.round(s.best || 0) + '%';
    $('#activePlayerName').textContent = profiles.getActive()?.name || '–';
    const status = profiles.getStatus();
    $('#syncStatus').textContent = !status.central ? 'Testbetrieb: nur auf diesem Gerät' :
      status.online ? (status.pending ? `${status.pending} Einträge warten auf Abgleich` : 'Mit Google Sheets synchronisiert') :
      'Offline – Ergebnisse werden später übertragen';
  }
  function updatePoolInfo(){
    const visual=bank.filter(q=>q.visual).length;
    const audio=bank.filter(q=>q.melody||q.audioLocal).length;
    const custom=imported.length;
    $('#poolPill').textContent=`${BASE.length} Basisfragen${custom?` + ${custom} eigene`:''} • ${visual} Bild • ${audio} Audio`;
  }
  function updateAudioCount(){
    const n=bank.filter(q=>q.audioLocal).length;
    $('#localAudioCount').textContent=n===1?'1 lokaler Song':`${n} lokale Songs`;
  }
  function fillCategories(){
    const current=$('#categorySelect').value || 'all';
    const cats=[...new Set(bank.map(q=>q.category))].sort((a,b)=>a.localeCompare(b,'de'));
    $('#categorySelect').innerHTML='<option value="all">Alle Kategorien</option>'+cats.map(c=>`<option>${escapeHtml(c)}</option>`).join('');
    if([...$('#categorySelect').options].some(o=>o.value===current)) $('#categorySelect').value=current;
  }

  function pickQuestions({mistakeOnly=false}={}){
    if (!profiles.getActive()) { show('playerGate'); return false; }
    const cat=$('#categorySelect').value;
    const diff=$('#difficultySelect')?.value||'all';
    let pool=bank.filter(q=>(cat==='all'||q.category===cat) && (diff==='all'||q.difficulty===diff) && (!mistakeOnly || mistakes.has(q.id)));
    const onlyNew = !mistakeOnly && $('#unseenOnly').checked;
    if (onlyNew) {
      const seen = profiles.getSeenIds();
      pool = pool.filter(q => !seen.has(String(q.id)) && !(masteryFor(q.id).seen > 0));
    }
    if(!pool.length){ alert(onlyNew ? 'Für diese Auswahl hast du bereits alle Fragen gesehen. Deaktiviere „Nur neue Fragen“ oder wähle eine andere Kategorie.' : mistakeOnly ? 'Aktuell sind keine Fehler zum Wiederholen gespeichert.' : 'Für diese Auswahl gibt es keine Fragen.'); return false; }
    const requested=Number($('#questionCount').value);
    const desired=requested===0?pool.length:Math.min(requested,pool.length);
    session=weightedSample(pool,desired);
    const mode=$('#modeSelect').value;
    if(mode==='original'){
      const eligible=shuffle(session.filter(q=>Array.isArray(q.choices)&&q.choices.length>=2&&!q.taskType&&!q.audioLocal));
      const choiceCount=Math.min(eligible.length, Math.max(1,Math.round(session.length*.20)));
      const ids=new Set(eligible.slice(0,choiceCount).map(q=>String(q.id)));
      session=session.map(q=>({...q,renderType:ids.has(String(q.id))?'choice':'text'}));
    } else if(mode==='choice'){
      session=session.filter(q=>q.choices?.length>=2&&!q.taskType&&!q.audioLocal).map(q=>({...q,renderType:'choice'}));
      if(!session.length){alert('Für diese Auswahl stehen keine Auswahlfragen zur Verfügung.');return false;}
    } else session=session.map(q=>({...q,renderType:'text'}));
    index=0; answers=[];
    sessionId = 's-' + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random());
    hintsRemaining = Math.floor(session.length / 10); hintsUsed = 0;
    renderQuestion(); show('quiz'); return true;
  }

  async function renderQuestion(){
    checked=false; selected=[]; drawTouched=false;
    revokeCurrentAudio();
    const q=session[index];
    $('#progressText').textContent=`${index+1} / ${session.length}`;
    $('#progressBar').style.width=`${(index/session.length)*100}%`;
    $('#categoryPill').textContent=q.category;
    $('#difficultyPill').textContent=q.difficulty||'mittel';
    $('#typePill').textContent=typeName(q);
    const op=$('#originPill');
    if(q.origin){ op.textContent=q.origin; op.classList.remove('hidden'); } else op.classList.add('hidden');
    $('#questionText').textContent=q.q;
    $('#feedback').className='feedback hidden'; $('#feedback').innerHTML='';
    $('#checkBtn').classList.remove('hidden'); $('#nextBtn').classList.add('hidden');

    const vw=$('#visualWrap');
    if(q.visual){ $('#questionVisual').src=q.visual; $('#questionVisual').alt=q.visualAlt||'Bild zur Frage'; vw.classList.remove('hidden'); }
    else vw.classList.add('hidden');

    await renderAudio(q);
    renderAnswerArea(q);
    questionStartedAt = performance.now();
    renderHintUI(q);
  }

  function typeName(q){
    if(q.taskType==='draw') return 'Zeichnen';
    if(q.audioLocal||q.melody) return 'Audiofrage';
    if(q.visual) return 'Bildfrage';
    return q.renderType==='choice'?'Auswahl':'Freitext';
  }

  async function renderAudio(q){
    const wrap=$('#audioWrap');
    wrap.classList.add('hidden'); wrap.innerHTML='';
    if(q.melody){
      wrap.innerHTML='<div class="audio-player-row"><button id="playMelody" class="secondary" type="button">▶ Melodie abspielen</button><span class="audio-hint">Synthetisch erzeugtes Hörbeispiel, keine Originalaufnahme.</span></div>';
      wrap.classList.remove('hidden');
      $('#playMelody').onclick=()=>playMelody(q.melody);
    } else if(q.audioLocal){
      const blob=await getAudio(q.audioKey||String(q.id));
      if(blob){
        currentAudioUrl=URL.createObjectURL(blob);
        wrap.innerHTML=`<audio controls preload="metadata" src="${currentAudioUrl}"></audio><div class="audio-hint">Lokaler Clip – bleibt auf diesem Gerät.</div>`;
      } else {
        wrap.innerHTML='<div class="audio-hint">Der lokale Audioclip ist auf diesem Gerät nicht vorhanden. Diese Frage kann hier nicht sinnvoll beantwortet werden.</div>';
      }
      wrap.classList.remove('hidden');
    }
  }

  function focusAnswerIfDesktop(selector){
    // On phones, autofocus opens the keyboard immediately and can trigger browser auto-zoom.
    // Let the player tap the field when ready. Desktop keeps the quick keyboard workflow.
    const isTouchDevice = window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    if(isTouchDevice) return;
    setTimeout(()=>document.querySelector(selector)?.focus(),50);
  }

  function renderAnswerArea(q){
    const area=$('#answerArea');
    if(q.taskType==='draw'){
      area.innerHTML='<div class="draw-tools"><button id="clearCanvas" class="ghost small" type="button">Zeichnung löschen</button></div><canvas id="drawCanvas" class="draw-canvas" aria-label="Zeichenfläche"></canvas>';
      setupCanvas($('#drawCanvas'));
      $('#clearCanvas').onclick=()=>clearCanvas($('#drawCanvas'));
      return;
    }
    if(q.audioLocal && q.audioAnswers){
      area.innerHTML='<div class="audio-answer-grid"><label>Künstler<input id="artistAnswer" type="text" autocomplete="off" placeholder="Künstler …"></label><label>Titel<input id="titleAnswer" type="text" autocomplete="off" placeholder="Titel …"></label></div>';
      $('#artistAnswer').addEventListener('keydown',e=>{if(e.key==='Enter')$('#titleAnswer').focus();});
      $('#titleAnswer').addEventListener('keydown',e=>{if(e.key==='Enter')checkAnswer();});
      focusAnswerIfDesktop('#artistAnswer');
      return;
    }
    if(q.renderType==='choice'){
      area.innerHTML='<div class="choice-grid">'+q.choices.map((c,i)=>`<button class="choice" type="button" data-value="${escapeHtml(c)}"><span class="letter">${String.fromCharCode(65+i)}</span><span>${escapeHtml(c)}</span></button>`).join('')+'</div>';
      area.querySelectorAll('.choice').forEach(btn=>btn.addEventListener('click',()=>{
        if(checked)return;
        if(q.multi){ btn.classList.toggle('selected'); selected=[...area.querySelectorAll('.choice.selected')].map(x=>x.dataset.value); }
        else { area.querySelectorAll('.choice').forEach(x=>x.classList.remove('selected')); btn.classList.add('selected'); selected=[btn.dataset.value]; }
      }));
    } else {
      area.innerHTML='<input id="textAnswer" type="text" autocomplete="off" autocapitalize="sentences" placeholder="Antwort eingeben …" aria-label="Antwort" />';
      $('#textAnswer').addEventListener('keydown',e=>{if(e.key==='Enter')checkAnswer();});
      focusAnswerIfDesktop('#textAnswer');
    }
    if(q.bonus){
      area.insertAdjacentHTML('beforeend',`<div class="bonus-box"><label>${escapeHtml(q.bonus.q)}<input id="bonusAnswer" type="text" autocomplete="off" placeholder="Bonusantwort (optional) …"></label></div>`);
    }
  }

  function buildHintChoices(q){
    const correct = String(q.answer || '').trim();
    if (!correct) return [];
    const values = [correct];
    const candidates = [
      ...(Array.isArray(q.choices) ? q.choices : []),
      ...shuffle(bank.filter(x => x.id !== q.id && x.category === q.category).map(x => x.answer)),
      ...shuffle(bank.filter(x => x.id !== q.id).map(x => x.answer))
    ];
    for (const c of candidates) {
      const v = String(c || '').trim();
      if (!v || v.length > 75 || /selbsteinschätzung/i.test(v) || values.some(x => normalize(x) === normalize(v))) continue;
      if (/^\d+(?:[.,]\d+)?$/.test(correct) !== /^\d+(?:[.,]\d+)?$/.test(v)) continue;
      values.push(v);
      if (values.length === 4) break;
    }
    return values.length === 4 ? shuffle(values) : [];
  }
  function renderHintUI(q){
    const canHint = !checked && hintsRemaining > 0 && q.renderType === 'text' && !q.hintUsed &&
      !q.taskType && !q.audioLocal && !q.selfCheck && !q.multi;
    $('#hintBtn').classList.toggle('hidden', !canHint);
    $('#hintCounter').textContent = `Tipps übrig: ${hintsRemaining}`;
  }
  function useHint(){
    const q = session[index];
    if (checked || hintsRemaining < 1 || q.renderType !== 'text' || q.taskType || q.audioLocal || q.selfCheck || q.multi) return;
    const choices = buildHintChoices(q);
    if (choices.length !== 4) { alert('Für diese Frage stehen keine geeigneten Auswahlantworten zur Verfügung. Dein Tipp bleibt erhalten.'); return; }
    q.choices = choices; q.renderType = 'choice'; q.hintUsed = true;
    hintsRemaining--; hintsUsed++;
    selected = []; renderAnswerArea(q);
    $('#typePill').textContent = 'Auswahl · Tipp';
    renderHintUI(q);
  }

  function checkAnswer(){
    if(checked)return;
    const q=session[index];
    if(q.selfCheck){ return beginSelfCheck(q); }
    let correct=false, given='', bonusStatus=null;
    if(q.audioLocal && q.audioAnswers){
      const artist=$('#artistAnswer')?.value||'', title=$('#titleAnswer')?.value||'';
      if(!artist.trim()||!title.trim()) return;
      const aok=simpleMatch(artist,q.audioAnswers.artist,q.audioAnswers.artistAliases||[]);
      const tok=simpleMatch(title,q.audioAnswers.title,q.audioAnswers.titleAliases||[]);
      correct=aok&&tok; given=`${artist} – ${title}`;
    } else if(q.renderType==='choice'){
      if(!selected.length)return;
      given=selected.join(', ');
      if(q.multi){
        const a=[...selected].map(normalize).sort(); const b=[...(q.correctChoices||[])].map(normalize).sort();
        correct=JSON.stringify(a)===JSON.stringify(b);
      } else correct=normalize(selected[0])===normalize(q.answer);
    } else {
      given=$('#textAnswer')?.value||'';
      if(!given.trim())return;
      correct=textCorrect(given,q);
    }
    if(q.bonus){
      const bg=$('#bonusAnswer')?.value||'';
      if(bg.trim()) bonusStatus=bonusCorrect(bg,q.bonus);
    }
    finalizeAnswer(q,correct,given,bonusStatus);
  }

  function beginSelfCheck(q){
    if(!drawTouched){ alert('Zeichne zuerst etwas auf die Fläche.'); return; }
    checked='pending';
    $('#checkBtn').classList.add('hidden');
    const fb=$('#feedback'); fb.className='feedback neutral';
    fb.innerHTML=`<strong>Jetzt selbst vergleichen.</strong>${escapeHtml(q.explanation||'')}<div class="self-actions"><button id="selfYes" class="primary" type="button">Passt ungefähr</button><button id="selfNo" class="secondary" type="button">Nochmal üben</button></div>`;
    $('#selfYes').onclick=()=>finalizeSelf(q,true);
    $('#selfNo').onclick=()=>finalizeSelf(q,false);
  }
  function finalizeSelf(q,correct){
    if(checked!== 'pending') return;
    finalizeAnswer(q,correct,'Zeichenaufgabe',null,true);
  }

  function finalizeAnswer(q,correct,given,bonusStatus=null,self=false){
    checked=true;
    const responseMs = Math.max(100, Math.round(performance.now() - questionStartedAt));
    answers.push({id:q.id,correct,given,category:q.category,bonus:bonusStatus,responseMs,hintUsed:!!q.hintUsed});
    profiles.recordAnswer({sessionId,questionId:q.id,category:q.category,correct,hintUsed:!!q.hintUsed,
      responseMs,mode:$('#modeSelect').value});
    const mk=String(q.id), m=masteryFor(q.id);
    m.seen=(m.seen||0)+1;
    if(correct){ m.correct=(m.correct||0)+1; m.streak=(m.streak||0)+1; if(m.streak>=2) mistakes.delete(q.id); }
    else { m.wrong=(m.wrong||0)+1; m.streak=0; mistakes.add(q.id); }
    m.lastSeen=Date.now(); mastery[mk]=m;
    localStorage.setItem(progressKey('mastery'),JSON.stringify(mastery));
    localStorage.setItem(progressKey('mistakes'),JSON.stringify([...mistakes]));
    const fb=$('#feedback'); fb.className='feedback '+(correct?'good':'bad');
    const answerLine=!correct&&!self?`Richtige Antwort: <b>${escapeHtml(q.answer)}</b><br>`:'';
    const bonusLine=q.bonus&&bonusStatus!==null?`<br><b>Bonus:</b> ${bonusStatus?'richtig':'nicht ganz'} – ${escapeHtml(q.bonus.answer)}`:'';
    const currentNote=q.volatile?`<div class="volatile-note">Aktualitätsfrage – Stand ${escapeHtml(q.asOf||'laut Fragenbank')}.</div>`:'';
    fb.innerHTML=`<strong>${correct?'Richtig.':'Nicht ganz.'}</strong>${answerLine}${escapeHtml(q.explanation||'')}${bonusLine}${currentNote}`;
    $('#checkBtn').classList.add('hidden'); $('#nextBtn').classList.remove('hidden');
    $('#progressBar').style.width=`${((index+1)/session.length)*100}%`;
  }

  function next(){
    if(!checked || checked==='pending')return;
    if(index<session.length-1){index++;renderQuestion();}
    else finish();
  }
  function finish(){
    revokeCurrentAudio();
    const right=answers.filter(a=>a.correct).length, total=answers.length, rate=total?right/total*100:0;
    profiles.finishRound({sessionId,total,correct:right,hintsUsed,
      durationMs:answers.reduce((sum,a)=>sum+a.responseMs,0)});
    updateStats();
    $('#resultPercent').textContent=Math.round(rate)+'%';
    $('#resultTitle').textContent=rate>=80?'Starke Runde.':rate>=60?'Solide – da geht noch was.':'Perfekt fürs Fehlertraining.';
    $('#resultText').textContent=`${right} von ${total} Fragen richtig beantwortet.`;
    const bonusAnswered=answers.filter(a=>a.bonus!==null).length;
    const bonusRight=answers.filter(a=>a.bonus===true).length;
    const br=$('#bonusResult');
    if(bonusAnswered){br.textContent=`Bonusfragen: ${bonusRight} von ${bonusAnswered} richtig.`;br.classList.remove('hidden');} else br.classList.add('hidden');
    const grouped={}; answers.forEach(a=>{grouped[a.category]??={r:0,t:0};grouped[a.category].t++; if(a.correct)grouped[a.category].r++;});
    $('#resultBreakdown').innerHTML=Object.entries(grouped).sort((a,b)=>a[0].localeCompare(b[0],'de')).map(([c,v])=>`<div class="break-row"><span>${escapeHtml(c)}</span><strong>${v.r} / ${v.t}</strong></div>`).join('');
    $('#resultMistakesBtn').disabled=!mistakes.size; show('results');
  }

  function escapeHtml(v=''){ return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

  // Drawing canvas
  function setupCanvas(canvas){
    const rect=canvas.getBoundingClientRect(); const ratio=Math.max(1,window.devicePixelRatio||1);
    canvas.width=Math.round(rect.width*ratio); canvas.height=Math.round(rect.height*ratio);
    const ctx=canvas.getContext('2d'); ctx.scale(ratio,ratio); ctx.lineCap='round'; ctx.lineJoin='round'; ctx.lineWidth=4; ctx.strokeStyle='#111318';
    let drawing=false;
    const pos=e=>{const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}};
    canvas.addEventListener('pointerdown',e=>{drawing=true;drawTouched=true;canvas.setPointerCapture(e.pointerId);const p=pos(e);ctx.beginPath();ctx.moveTo(p.x,p.y)});
    canvas.addEventListener('pointermove',e=>{if(!drawing)return;const p=pos(e);ctx.lineTo(p.x,p.y);ctx.stroke()});
    const stop=()=>{drawing=false;ctx.closePath()}; canvas.addEventListener('pointerup',stop); canvas.addEventListener('pointercancel',stop);
  }
  function clearCanvas(canvas){
    const ratio=Math.max(1,window.devicePixelRatio||1), ctx=canvas.getContext('2d');
    ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,canvas.width,canvas.height); ctx.restore(); drawTouched=false;
  }

  // WebAudio melody player for public-domain/traditional material.
  const noteIndex={C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11};
  function noteFreq(note){
    const m=String(note).match(/^([A-G](?:#|b)?)(\d)$/); if(!m)return 440;
    const midi=(Number(m[2])+1)*12+noteIndex[m[1]]; return 440*Math.pow(2,(midi-69)/12);
  }
  function playMelody(melody){
    const Ctx=window.AudioContext||window.webkitAudioContext; if(!Ctx){alert('Dieser Browser unterstützt die Audiowiedergabe nicht.');return;}
    const ctx=new Ctx(); let t=ctx.currentTime+.05;
    melody.forEach(([note,dur])=>{
      const o=ctx.createOscillator(), g=ctx.createGain(); o.type='triangle'; o.frequency.value=noteFreq(note);
      g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(.18,t+.02); g.gain.exponentialRampToValueAtTime(.0001,t+Math.max(.06,dur-.02));
      o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t+dur); t+=dur;
    });
    setTimeout(()=>ctx.close().catch(()=>{}),(t-ctx.currentTime+1)*1000);
  }

  // Local question editor. GitHub Pages itself is read-only; edited questions live in localStorage until exported.
  function editorLocalQuestions(){ return imported.filter(q=>q.origin==='Frageneditor'); }
  function renderCustomQuestions(){
    const list=$('#customQuestionList'), count=$('#customQuestionCount');
    if(!list||!count) return;
    const own=editorLocalQuestions(); count.textContent=own.length===1?'1 eigene Frage':`${own.length} eigene Fragen`;
    if(!own.length){ list.innerHTML='<div class="fineprint">Noch keine Frage im Editor gespeichert.</div>'; return; }
    list.innerHTML=own.slice().reverse().map(q=>`<div class="custom-question-item"><div><strong>${escapeHtml(q.q)}</strong><small>${escapeHtml(q.category)} • ${escapeHtml(q.difficulty||'mittel')} • Antwort: ${escapeHtml(q.answer)}</small></div><div class="custom-question-actions"><button class="ghost small edit-custom" data-id="${escapeHtml(String(q.id))}" type="button">Bearbeiten</button><button class="danger small delete-custom" data-id="${escapeHtml(String(q.id))}" type="button">Löschen</button></div></div>`).join('');
    list.querySelectorAll('.edit-custom').forEach(b=>b.onclick=()=>loadEditorQuestion(b.dataset.id));
    list.querySelectorAll('.delete-custom').forEach(b=>b.onclick=()=>deleteEditorQuestion(b.dataset.id));
  }
  function resetEditor(){
    if(!$('#editorForm')) return;
    $('#editorForm').reset(); $('#editorId').value=''; $('#editorCategory').value='Allgemeinwissen'; $('#editorDifficulty').value='mittel';
  }
  function loadEditorQuestion(id){
    const q=imported.find(x=>String(x.id)===String(id)); if(!q)return;
    $('#editorId').value=q.id; $('#editorCategory').value=q.category||'Allgemeinwissen'; $('#editorDifficulty').value=q.difficulty||'mittel';
    $('#editorQuestion').value=q.q||''; $('#editorAnswer').value=q.answer||''; $('#editorAliases').value=(q.aliases||[]).join('\n');
    $('#editorChoices').value=(q.choices||[]).join('\n'); $('#editorExplanation').value=q.explanation||''; $('#editorVisual').value=q.visual||''; $('#editorStrict').checked=!!q.strictSpelling;
    document.querySelector('.editor-card')?.setAttribute('open',''); $('#editorQuestion').focus();
  }
  function deleteEditorQuestion(id){
    const q=imported.find(x=>String(x.id)===String(id)); if(!q)return;
    if(!confirm(`Frage wirklich löschen?\n\n${q.q}`))return;
    imported=imported.filter(x=>String(x.id)!==String(id)); saveImported(); refreshBank();
  }
  function downloadJson(data,name){
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}), a=document.createElement('a');
    a.href=URL.createObjectURL(blob); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),0);
  }
  $('#editorForm')?.addEventListener('submit',e=>{
    e.preventDefault();
    const editId=$('#editorId').value.trim();
    const question=$('#editorQuestion').value.trim(), answer=$('#editorAnswer').value.trim(), category=$('#editorCategory').value.trim();
    if(!question||!answer||!category)return;
    const aliases=$('#editorAliases').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    const choices=$('#editorChoices').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    const q={id:editId||`custom-${Date.now()}`,category,difficulty:$('#editorDifficulty').value,q:question,answer,explanation:$('#editorExplanation').value.trim()||`Richtige Antwort: ${answer}`,origin:'Frageneditor'};
    if(aliases.length)q.aliases=aliases;
    if(choices.length){ if(!choices.some(x=>normalize(x)===normalize(answer))) choices.unshift(answer); q.choices=choices.slice(0,6); }
    const visual=$('#editorVisual').value.trim(); if(visual){q.visual=visual;q.visualAlt='Eigenes Bild zur Frage';}
    if($('#editorStrict').checked)q.strictSpelling=true;
    const pos=imported.findIndex(x=>String(x.id)===String(editId)); if(pos>=0)imported[pos]=q; else imported.push(q);
    saveImported(); refreshBank(); resetEditor();
  });
  $('#editorReset')?.addEventListener('click',resetEditor);
  $('#exportCustomBtn')?.addEventListener('click',()=>downloadJson(editorLocalQuestions(),'kneipenquiz-eigene-fragen.json'));

  // Local audio store: IndexedDB keeps modern song clips out of the distributed app package.
  function openAudioDB(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open('bq_audio_v1',1);
      req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('clips'))db.createObjectStore('clips')};
      req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
    });
  }
  async function putAudio(key,blob){ const db=await openAudioDB(); return new Promise((res,rej)=>{const tx=db.transaction('clips','readwrite');tx.objectStore('clips').put(blob,key);tx.oncomplete=()=>{db.close();res()};tx.onerror=()=>{db.close();rej(tx.error)}}); }
  async function getAudio(key){ try{const db=await openAudioDB();return await new Promise((res,rej)=>{const tx=db.transaction('clips','readonly');const r=tx.objectStore('clips').get(key);r.onsuccess=()=>{db.close();res(r.result||null)};r.onerror=()=>{db.close();rej(r.error)}})}catch{return null} }
  function revokeCurrentAudio(){ if(currentAudioUrl){URL.revokeObjectURL(currentAudioUrl);currentAudioUrl=null;} }

  function renderGate(){
    const select = $('#profileSelect');
    const chosen = select.value || profiles.getActive()?.id || '';
    const players = profiles.getPlayers();
    select.innerHTML = '<option value="">Bitte Spieler auswählen …</option>' +
      players.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join('');
    if (players.some(p => p.id === chosen)) select.value = chosen;
    const status = profiles.getStatus();
    $('#retrySyncBtn').classList.toggle('hidden', !status.central);
    $('#gateNote').textContent = status.central ?
      (status.online ? 'Spieler und Ergebnisse werden zentral gespeichert. Ohne Spielernamen sind keine weiteren Optionen verfügbar.' : 'Server nicht erreichbar: ' + (status.error || 'Bitte Web-App-Freigabe und Verbindung prüfen.') + ' Bekannte Spieler können offline weitertrainieren.') :
      'Testbetrieb nur auf diesem Gerät. Für die gemeinsame Rangliste später die Apps-Script-URL eintragen.';
  }
  function renderPersonalStats(){
    const s = profiles.getStats(), seen = profiles.getSeenIds();
    const items = [
      ['Runden',s.sessions],['Beantwortete Fragen',s.answered],['Richtig',s.correct],
      ['Trefferquote',s.answered ? (100*s.correct/s.answered).toFixed(1)+'%' : '0%'],
      ['Ø Antwortzeit',s.answered ? (s.avgMs/1000).toFixed(1)+' s' : '–'],
      ['Genutzte Tipps',s.hints],['Ranglistenpunkte',s.points],['Beste Runde',Math.round(s.best)+'%']
    ];
    $('#playerStatsGrid').innerHTML = items.map(([label,value]) =>
      `<div class="stat card"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`).join('');
    const seenBase = BASE.filter(q => seen.has(String(q.id))).length;
    $('#seenCount').textContent = `${seenBase} von ${BASE.length} Basisfragen bereits gesehen.`;
  }
  function renderLeaderboard(){
    const rows = profiles.getLeaderboard();
    const status = profiles.getStatus();
    $('#leaderboardNote').textContent = !status.central ? 'Testbetrieb: Rangliste nur für dieses Gerät.' :
      status.online ? 'Gemeinsame Rangliste · 2 Punkte pro richtiger Antwort, 1 Punkt mit Tipp.' :
      'Offline: zuletzt gespeicherte Rangliste. Noch nicht synchronisierte Antworten fehlen.';
    $('#leaderboardBody').innerHTML = rows.length ? rows.map((p,i) =>
      `<div class="rank-row ${p.id===profiles.getActive()?.id?'rank-self':''}"><span><b>${i+1}.</b> ${escapeHtml(p.name)}</span><strong>${p.points||0}</strong><span>${p.correct||0}/${p.answered||0}</span><span>${p.answered?(p.avgMs/1000).toFixed(1)+' s':'–'}</span></div>`).join('') :
      '<p class="empty-leaderboard">Noch keine Spieler vorhanden.</p>';
  }
  function showProfileError(message){
    $('#profileError').textContent = message;
    $('#profileError').classList.toggle('hidden', !message);
  }
  async function enterProfile(id){
    await profiles.selectPlayer(id);
    loadPlayerProgress(); updateStats(); showProfileError(''); show('home');
  }
  $('#selectPlayerBtn').onclick = async () => {
    const id = $('#profileSelect').value;
    if (!id) { showProfileError('Bitte zuerst einen Spieler auswählen oder anlegen.'); return; }
    try { await enterProfile(id); } catch (err) { showProfileError(err.message); }
  };
  $('#createPlayerBtn').onclick = async () => {
    const btn = $('#createPlayerBtn'); btn.disabled = true; showProfileError('');
    try {
      const player = await profiles.createPlayer($('#newPlayerName').value);
      $('#newPlayerName').value = '';
      await enterProfile(player.id);
    } catch (err) { showProfileError(err.message); }
    finally { btn.disabled = false; }
  };
  $('#newPlayerName').addEventListener('keydown',e=>{if(e.key==='Enter')$('#createPlayerBtn').click();});
  $('#retrySyncBtn').onclick = async()=>{
    const btn=$('#retrySyncBtn');btn.disabled=true;btn.textContent='Verbindung wird geprüft …';
    try{
      await profiles.refresh();
      await profiles.migrateLocalPlayers();
      await profiles.flush();
      showProfileError('');
    }catch(err){showProfileError('Serverfehler: '+(err.message||err)+' · Prüfe die Apps-Script-Web-App-Freigabe „Jeder“ sowie setup().');}
    finally{btn.disabled=false;btn.textContent='↻ Verbindung prüfen / Spieler übertragen';renderGate();}
  };
  $('#switchPlayerBtn').onclick = () => { renderGate(); show('playerGate'); };
  $('#viewStatsBtn').onclick = () => { renderPersonalStats(); show('playerStats'); };
  $('#viewLeaderboardBtn').onclick = () => { renderLeaderboard(); show('leaderboard');
    profiles.refresh().catch(()=>{}); };
  $('#backStatsBtn').onclick = () => show('home');
  $('#backLeaderboardBtn').onclick = () => show('home');
  $('#hintBtn').onclick = useHint;

  $('#startBtn').onclick=()=>pickQuestions();
  $('#mistakeBtn').onclick=()=>pickQuestions({mistakeOnly:true});
  $('#checkBtn').onclick=checkAnswer; $('#nextBtn').onclick=next;
  $('#quitBtn').onclick=()=>{revokeCurrentAudio();show('home')};
  $('#againBtn').onclick=()=>show('home');
  $('#resultMistakesBtn').onclick=()=>{show('home');setTimeout(()=>pickQuestions({mistakeOnly:true}),0)};

  $('#exportBtn').onclick=()=>{
    const blob=new Blob([JSON.stringify(bank,null,2)],{type:'application/json'}); const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);a.download='kneipenquiz-fragenbank-v0.6.json';a.click();URL.revokeObjectURL(a.href);
  };
  $('#importInput').addEventListener('change',async e=>{
    try{
      const file=e.target.files?.[0]; if(!file)return; const txt=await file.text(); const arr=JSON.parse(txt); if(!Array.isArray(arr))throw new Error();
      let numeric=Math.max(1000,...bank.map(q=>Number(q.id)||0))+1; const existing=new Set(bank.map(q=>String(q.id)));
      const clean=arr.map(q=>{let id=q.id;if(id==null||existing.has(String(id)))id=numeric++;existing.add(String(id));return{...q,id}}).filter(q=>q.q&&q.answer&&q.category);
      imported=[...imported,...clean]; saveImported(); refreshBank(); alert(`${clean.length} Fragen importiert.`);
    }catch{alert('Die JSON-Datei konnte nicht als Fragenbank gelesen werden.');}
    e.target.value='';
  });

  $('#addAudioBtn').onclick=async()=>{
    const artist=$('#audioArtist').value.trim(), title=$('#audioTitle').value.trim(), file=$('#audioFile').files?.[0];
    if(!artist||!title||!file){alert('Bitte Künstler, Titel und eine Audiodatei angeben.');return;}
    const id='audio-'+Date.now();
    try{
      await putAudio(id,file);
      const q={id,category:'Musik',difficulty:'mittel',q:'Song erkennen: Nenne Künstler und Titel.',answer:`${artist} – ${title}`,aliases:[`${title} ${artist}`,`${artist} ${title}`],explanation:`${artist} – ${title}`,audioLocal:true,audioKey:id,audioAnswers:{artist,title},origin:'Eigener Musikclip'};
      imported.push(q); saveImported(); refreshBank();
      $('#audioArtist').value=''; $('#audioTitle').value=''; $('#audioFile').value='';
      alert('Songfrage wurde lokal hinzugefügt. Der Audioclip bleibt in diesem Browser.');
    }catch{alert('Der Audioclip konnte in diesem Browser nicht lokal gespeichert werden.');}
  };

  // PWA: Sichtbarer Installationsweg auf Android / iOS, auch ohne Prompt-Event.
  let deferredInstallPrompt = null;
  const installBtn=$('#installBtn'),connectionPill=$('#connectionPill');
  const installGuide=$('#installGuide');
  const isStandalone=()=>window.matchMedia('(display-mode: standalone)').matches || navigator.standalone===true;
  const isMobile=()=>/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    window.matchMedia('(max-width:900px), (pointer:coarse)').matches ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isIOS=()=>/iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function updateInstallVisibility(){
    const installed = isStandalone();
    document.documentElement.classList.toggle('kq-installed', installed);
    installBtn?.classList.toggle('hidden', installed || (!isMobile() && !deferredInstallPrompt));
  }
  function closeInstallGuide(){installGuide.classList.add('hidden');installBtn?.focus();}
  function openInstallGuide(){
    $('#installGuideText').textContent=isIOS()
      ? 'Öffne das Quiz in Safari. Tippe auf „Teilen“ (Quadrat mit Pfeil) und wähle „Zum Home-Bildschirm“. Bestätige mit „Hinzufügen“. Auf dem Startbildschirm erscheint dann die Quiz-App.'
      : /Android/i.test(navigator.userAgent)
        ? 'Öffne das Quiz in Chrome oder Edge. Öffne das Menü ⋮ und wähle „App installieren“ oder „Zum Startbildschirm hinzufügen“. Falls der Eintrag fehlt: HTTPS-Adresse öffnen und Seite neu laden.'
        : 'Öffne das Browsermenü. Wähle „App installieren“ oder „Zum Startbildschirm hinzufügen“. Die Installation erfordert eine sichere HTTPS-Seite.';
    installGuide.classList.remove('hidden');installGuide.focus();
  }
  function updateConnectionState(){
    if(!connectionPill) return;
    const status=profiles.getStatus();
    const offline=!navigator.onLine || (status.central && !status.online);
    connectionPill.textContent=!navigator.onLine?'Offline': !status.central?'Nur lokal': status.online?'Server verbunden':'Server getrennt';
    connectionPill.classList.toggle('offline',offline);
    const activeNote=$('#syncStatus');
    if(activeNote){
      activeNote.textContent=!status.central?'Daten nur auf diesem Gerät':status.online
       ? (status.pending?status.pending+' Antwort(en) warten auf Übertragung':'Synchronisiert mit Google Sheets')
       : 'Keine Serververbindung – '+(status.error||'Bitte Verbindung prüfen');
    }
  }
  window.addEventListener('online',updateConnectionState);
  window.addEventListener('offline',updateConnectionState);
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;updateInstallVisibility();});
  async function requestInstallation(){
    if(isStandalone()) return;
    if(deferredInstallPrompt){
      try{
        const prompt = deferredInstallPrompt;
        deferredInstallPrompt=null;
        await prompt.prompt();
        const result=await prompt.userChoice;
        if(result?.outcome !== 'accepted') openInstallGuide();
      }catch(err){console.warn('Installation:',err);openInstallGuide();}
      updateInstallVisibility();
    }else openInstallGuide();
  }
  installBtn?.addEventListener('click',requestInstallation);
  $('#installMobileBtn')?.addEventListener('click',requestInstallation);
  $('#installGuideCloseBtn').onclick=closeInstallGuide;
  $('#installGuideDoneBtn').onclick=closeInstallGuide;
  installGuide.addEventListener('click',e=>{if(e.target===installGuide)closeInstallGuide();});
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!installGuide.classList.contains('hidden'))closeInstallGuide();});
  window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;updateInstallVisibility();});
  updateInstallVisibility();updateConnectionState();

  if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost' || location.hostname==='127.0.0.1')){
    window.addEventListener('load',()=>{
      navigator.serviceWorker.register('./service-worker.js').catch(err=>console.warn('Service Worker konnte nicht registriert werden:',err));
    });
  }

  fillCategories(); updatePoolInfo(); updateAudioCount(); renderCustomQuestions();
  profiles.subscribe(() => { renderGate(); updateStats(); renderPersonalStats(); renderLeaderboard(); updateConnectionState(); });
  profiles.init().then(() => {
    renderGate();
    show('playerGate');
  });
})();
