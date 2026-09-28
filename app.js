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
  const screens = ['home','quiz','results'];
  const statsKey = 'bq_stats_v2';
  const mistakesKey = 'bq_mistakes_v2';
  const masteryKey = 'bq_mastery_v1';
  const stats = Object.assign({sessions:0,answered:0,correct:0,best:0}, JSON.parse(localStorage.getItem(statsKey)||'{}'));
  let mistakes = new Set(JSON.parse(localStorage.getItem(mistakesKey)||'[]'));
  let mastery = JSON.parse(localStorage.getItem(masteryKey)||'{}');

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
    $('#statSessions').textContent=stats.sessions;
    $('#statAnswered').textContent=stats.answered;
    $('#statCorrect').textContent=stats.correct;
    $('#statWrong').textContent=mistakes.size;
    $('#bestRate').textContent=Math.round(stats.best||0)+'%';
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
    const cat=$('#categorySelect').value;
    const diff=$('#difficultySelect')?.value||'all';
    let pool=bank.filter(q=>(cat==='all'||q.category===cat) && (diff==='all'||q.difficulty===diff) && (!mistakeOnly || mistakes.has(q.id)));
    if(!pool.length){ alert(mistakeOnly?'Aktuell sind keine Fehler zum Wiederholen gespeichert.':'Für diese Auswahl gibt es keine Fragen.'); return false; }
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
    index=0; answers=[]; renderQuestion(); show('quiz'); return true;
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
      setTimeout(()=>$('#artistAnswer')?.focus(),50);
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
      setTimeout(()=>$('#textAnswer')?.focus(),50);
    }
    if(q.bonus){
      area.insertAdjacentHTML('beforeend',`<div class="bonus-box"><label>${escapeHtml(q.bonus.q)}<input id="bonusAnswer" type="text" autocomplete="off" placeholder="Bonusantwort (optional) …"></label></div>`);
    }
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
    answers.push({id:q.id,correct,given,category:q.category,bonus:bonusStatus});
    const mk=String(q.id), m=masteryFor(q.id);
    m.seen=(m.seen||0)+1;
    if(correct){ m.correct=(m.correct||0)+1; m.streak=(m.streak||0)+1; if(m.streak>=2) mistakes.delete(q.id); }
    else { m.wrong=(m.wrong||0)+1; m.streak=0; mistakes.add(q.id); }
    m.lastSeen=Date.now(); mastery[mk]=m;
    localStorage.setItem(masteryKey,JSON.stringify(mastery));
    localStorage.setItem(mistakesKey,JSON.stringify([...mistakes]));
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
    stats.sessions++; stats.answered+=total; stats.correct+=right; stats.best=Math.max(stats.best||0,rate); localStorage.setItem(statsKey,JSON.stringify(stats)); updateStats();
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

  $('#startBtn').onclick=()=>pickQuestions();
  $('#mistakeBtn').onclick=()=>pickQuestions({mistakeOnly:true});
  $('#checkBtn').onclick=checkAnswer; $('#nextBtn').onclick=next;
  $('#quitBtn').onclick=()=>{revokeCurrentAudio();show('home')};
  $('#againBtn').onclick=()=>show('home');
  $('#resultMistakesBtn').onclick=()=>{show('home');setTimeout(()=>pickQuestions({mistakeOnly:true}),0)};

  $('#exportBtn').onclick=()=>{
    const blob=new Blob([JSON.stringify(bank,null,2)],{type:'application/json'}); const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);a.download='kneipenquiz-fragenbank-v0.4.json';a.click();URL.revokeObjectURL(a.href);
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

  // PWA / Offline support. Requires HTTPS (or localhost).
  let deferredInstallPrompt = null;
  const installBtn = $('#installBtn');
  const connectionPill = $('#connectionPill');

  function updateConnectionState(){
    if(!connectionPill) return;
    if(navigator.onLine){
      connectionPill.textContent='Online';
      connectionPill.classList.remove('offline');
    } else {
      connectionPill.textContent='Offline';
      connectionPill.classList.add('offline');
    }
  }
  window.addEventListener('online', updateConnectionState);
  window.addEventListener('offline', updateConnectionState);
  updateConnectionState();

  window.addEventListener('beforeinstallprompt', e=>{
    e.preventDefault();
    deferredInstallPrompt=e;
    installBtn?.classList.remove('hidden');
  });

  installBtn?.addEventListener('click', async()=>{
    if(!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt=null;
    installBtn.classList.add('hidden');
  });

  window.addEventListener('appinstalled',()=>{
    deferredInstallPrompt=null;
    installBtn?.classList.add('hidden');
  });

  if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost' || location.hostname==='127.0.0.1')){
    window.addEventListener('load',()=>{
      navigator.serviceWorker.register('./service-worker.js').catch(err=>console.warn('Service Worker konnte nicht registriert werden:',err));
    });
  }

  fillCategories(); updateStats(); updatePoolInfo(); updateAudioCount(); renderCustomQuestions();
})();
