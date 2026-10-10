/**
 * Kneipenquiz 0.7 – zentrales Google-Apps-Script-Backend.
 * An BESTEHENDE Google-Tabelle gebunden verwenden (keine neue Tabelle anlegen).
 * ERST setup() ausführen, danach Bereitstellungen verwalten -> Bearbeiten -> Neue Version.
 * Web-App: Ausführen als ICH / Zugriff JEDER.
 * Keine Geheimnisse/Authentifizierung: Nutzername ist ein Vertrauensprofil, kein Login.
 */
const QUIZ_ZONE = 'Europe/Berlin';
const QUIZ_TABS = {
  players: { name: 'Spieler', headers: ['Spieler-ID', 'Spielername', 'Name (normalisiert)', 'Erstellt am'] },
  answers: { name: 'Antworten', headers: ['Ereignis-ID', 'Spieler-ID', 'Runden-ID', 'Frage-ID', 'Kategorie', 'Richtig', 'Tipp verwendet', 'Antwortzeit (ms)', 'Zeitpunkt', 'Punkte', 'Version', 'Modus', 'Tagesquiz-Tag'] },
  rounds: { name: 'Runden', headers: ['Runden-ID', 'Spieler-ID', 'Beendet am', 'Fragen', 'Richtig', 'Tipps', 'Dauer (ms)', 'Modus', 'Tagesquiz-Tag'] },
  daily: { name: 'Tagesquiz', headers: ['Tag (Berlin)', 'Spieler-ID', 'Runden-ID', 'Gestartet am'] }
};
function setup() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  if (!book) throw new Error('Apps Script bitte direkt aus der Google-Spielerdatenbank öffnen.');
  Object.keys(QUIZ_TABS).forEach(key => {
    const d = QUIZ_TABS[key];
    let sheet = book.getSheetByName(d.name);
    if (!sheet) sheet = book.insertSheet(d.name);
    sheet.getRange(1,1,1,d.headers.length).setValues([d.headers]);
    sheet.getRange(1,1,1,d.headers.length).setBackground('#1C4D3A').setFontColor('#FFFFFF').setFontWeight('bold');
    sheet.setFrozenRows(1);
  });
  return 'Kneipenquiz 0.7.2 eingerichtet – vorhandene Spieler/Antworten bleiben erhalten. Bitte Web-App als neue Version bereitstellen.';
}
function getSheet_(key) {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(QUIZ_TABS[key].name);
  if (!s) throw new Error('Tabelle '+QUIZ_TABS[key].name+' fehlt: setup() ausführen.');
  return s;
}
function rows_(key) {
  const s=getSheet_(key), last=s.getLastRow();
  return last<2 ? [] : s.getRange(2,1,last-1,QUIZ_TABS[key].headers.length).getValues();
}
function id_(v) { return String(v == null?'':v).trim().slice(0,120); }
function name_(v) { return String(v == null?'':v).replace(/[\u0000-\u001F\u007F]/g,'').trim().replace(/\s+/g,' ').slice(0,60); }
function norm_(v) { return name_(v).normalize('NFKC').toLocaleLowerCase('de-DE'); }
function cell_(v) { const s=String(v==null?'':v);return /^[=+\-@]/.test(s)?"'"+s:s; }
function bool_(v) { return v===true||v===1||String(v).toLowerCase()==='true'||String(v)==='1'; }
function num_(v,max) { return Math.max(0,Math.min(max,Math.round(Number(v)||0))); }
function day_(date) { return Utilities.formatDate(date instanceof Date?date:new Date(date),QUIZ_ZONE,'yyyy-MM-dd'); }
function today_() { return day_(new Date()); }
// Google Sheets wandelt ISO-Text in Datumzellen um. getValues() liefert dann Date.
// Deshalb bei Tagesquiz-Reservierungen immer im ZEITRAUM der Tabelle normalisieren.
function dailyDay_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) {
    var book=SpreadsheetApp.getActiveSpreadsheet();
    var zone=(book && book.getSpreadsheetTimeZone()) || QUIZ_ZONE;
    return Utilities.formatDate(v,zone,'yyyy-MM-dd');
  }
  var raw=String(v==null?'':v).trim();
  if (/^\d{5}(?:\.\d+)?$/.test(raw)) {
    var serial=Number(raw);
    return Utilities.formatDate(new Date(Date.UTC(1899,11,30)+serial*86400000),'UTC','yyyy-MM-dd');
  }
  return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0,10) : raw;
}
function json_(x) { return JSON.stringify(x).replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029').replace(/<\//g,'<\\/'); }
function out_(x,cb) {
  const body=json_(x);
  if(cb && /^[A-Za-z_$][\w$]{0,80}$/.test(cb))
    return ContentService.createTextOutput(cb+'('+body+');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}
function doGet(e) {
  const p=e&&e.parameter||{};
  try {
    const a=String(p.action||'snapshot');
    if(a==='ping') return out_({ok:true,version:'0.7',build:'0.7.2',dayKey:today_()},p.callback);
    if(a==='snapshot') return out_(snapshot_(id_(p.playerId)),p.callback);
    if(a==='ack') return out_(ack_(String(p.ids||'').split(',').map(id_).filter(Boolean).slice(0,40)),p.callback);
    return out_({ok:false,error:'Unbekannte Aktion'},p.callback);
  }catch(err){return out_({ok:false,error:String(err.message||err)},p.callback);}
}
function doPost(e) {
  try {
    const data=JSON.parse(e&&e.postData&&e.postData.contents||'{}');
    if(data.action!=='batch'||!Array.isArray(data.items)||data.items.length>40)throw Error('Ungültige Anfrage');
    const lock=LockService.getScriptLock();lock.waitLock(20000);
    try { writeBatch_(data.items); } finally {lock.releaseLock();}
    return out_({ok:true,version:'0.7',build:'0.7.2'});
  }catch(err){return out_({ok:false,error:String(err.message||err)});}
}
function emptyStats_(){return {sessions:0,answered:0,uniqueAnswered:0,correct:0,best:0,points:0,hints:0,totalMs:0,avgMs:0,currentStreak:0,longestStreak:0};}
function emptyProgress_(){return {seen:0,correct:0,wrong:0,streak:0,lastAt:0,lastCorrect:false,hintEver:false,points:0,category:''};}
// Ein einziges Punktesystem fuer NEUE und BESTEHENDE Daten:
// Erste Antwort ohne Tipp: richtig +2, falsch +0.
// Erste Antwort mit Tipp: richtig +1, falsch +0.
// Bei bereits beantworteter Frage kann nur ein frueher benutzter Tipp zu
// einem nachtraeglichen Punktezuwachs fuehren: richtig OHNE Tipp -> Rest bis 2.
// Alle anderen Wiederholungen +0. Hoechstens 2 je Frage / 1024 je Spieler.
function award_(old,correct,hint) {
  if(!correct) return 0;
  if(!old.seen) return hint?1:2;
  if(old.hintEver&&!hint) return Math.max(0,2-old.points);
  return 0;
}
function validCorrect_(raw,mode,time) {
  return bool_(raw)&&num_(time,3600000) <= (String(mode)==='daily'?20000:60000);
}
// Bewertet alle bisherigen Ereignisse in Tabellenreihenfolge (append-only).
// Liefert zugleich Stand je Frage, Kategorie, Trainingstage und Tagesrangliste.
function calculate_(players,ar,rr,dr,selectedId) {
  const stats={},progress={},seen={},daySets={},awards={},dailyResults={};
  players.forEach(p=>{stats[p.id]=emptyStats_();progress[p.id]={};daySets[p.id]=new Set();seen[p.id]=new Set();});
  const dailySessions={};
  // Bei alten Fehler-Versuchen existieren mehrere Reservierungen je Tag.
  // Bevorzuge eine Runde mit echten Antworten, ansonsten die erste Reservierung.
  const sessionAnswers={};
  ar.forEach(row=>{
    if(String(row[11]||'')==='daily'){
      const key=id_(row[1])+'|'+id_(row[2]);
      sessionAnswers[key]=(sessionAnswers[key]||0)+1;
    }
  });
  rr.forEach(row=>{
    if(String(row[7]||'')==='daily'){
      const key=id_(row[1])+'|'+id_(row[0]);
      sessionAnswers[key]=(sessionAnswers[key]||0)+100;
    }
  });
  dr.forEach(r=>{
    const pid=id_(r[1]),date=dailyDay_(r[0]),sid=id_(r[2]);
    if(stats[pid]&&date&&sid){
      if(!dailySessions[pid]) dailySessions[pid]={};
      const original=dailySessions[pid][date];
      if(!original || (sessionAnswers[pid+'|'+sid]||0)>(sessionAnswers[pid+'|'+original]||0)){
        dailySessions[pid][date]=sid;
      }
    }
  });
  ar.forEach(r=>{
    const pid=id_(r[1]),qid=id_(r[3]),eid=id_(r[0]);
    if(!stats[pid]||!qid||!eid)return;
    const mode=String(r[11]||'original'),duration=num_(r[7],3600000);
    const correct=validCorrect_(r[5],mode,duration),hint=bool_(r[6]);
    const s=stats[pid], q=progress[pid][qid]||emptyProgress_();
    let awarded=award_(q,correct,hint);
    awarded=Math.min(awarded,Math.max(0,1024-s.points));
    awards[eid]=awarded;
    s.answered++;s.correct+=correct?1:0;s.hints+=hint?1:0;s.totalMs+=duration;s.points+=awarded;
    if(!q.seen) {if(/^\d+$/.test(qid)&&Number(qid)>=1&&Number(qid)<=512)s.uniqueAnswered++;seen[pid].add(qid);}
    q.seen++;q.correct+=correct?1:0;q.wrong+=correct?0:1;q.streak=correct?q.streak+1:0;
    q.lastCorrect=correct;q.hintEver=q.hintEver||hint;q.points=Math.min(2,q.points+awarded);
    q.category=String(r[4]||q.category||'');
    if(r[8] instanceof Date && !isNaN(r[8].getTime())) {
      q.lastAt=Math.max(q.lastAt,r[8].getTime());daySets[pid].add(day_(r[8]));
    }
    progress[pid][qid]=q;
    const dailyDay=dailyDay_(r[12]);
    // Tageswertung nur fuer die am Server reservierte Runde; Wiederholungen ignorieren.
    if(mode==='daily' && dailyDay && dailySessions[pid] && dailySessions[pid][dailyDay]===id_(r[2])) {
      const k=dailyDay+'|'+pid;
      const res=dailyResults[k]||{playerId:pid,dayKey:dailyDay,correct:0,answered:0,totalMs:0,ids:[]};
      if(!res.ids.includes(qid)){
        res.ids.push(qid);res.answered++;res.correct+=correct?1:0;res.totalMs+=duration;
        if(!res.answers) res.answers=[];
        res.answers.push({id:qid,correct:correct,responseMs:duration});
      }
      dailyResults[k]=res;
    }
  });
  rr.forEach(r=>{
    const pid=id_(r[1]);if(!stats[pid])return;
    const s=stats[pid];s.sessions++;
    const total=num_(r[3],10000),correct=num_(r[4],10000);
    if(total)s.best=Math.max(s.best,100*correct/total);
  });
  const dayPrev=d=>{const o=new Date(d+'T12:00:00Z');o.setUTCDate(o.getUTCDate()-1);return o.toISOString().slice(0,10);};
  const today=today_();
  players.forEach(p=>{
    const s=stats[p.id],days=Array.from(daySets[p.id]).sort(),set=daySets[p.id];
    s.avgMs=s.answered?Math.round(s.totalMs/s.answered):0;
    let run=0,last='';
    days.forEach(d=>{run=last&&dayPrev(d)===last?run+1:1;s.longestStreak=Math.max(s.longestStreak,run);last=d;});
    let day=set.has(today)?today:dayPrev(today);
    while(set.has(day)){s.currentStreak++;day=dayPrev(day);}
  });
  const leaderboard=players.map(p=>({id:p.id,name:p.name,...stats[p.id]}))
    .sort((a,b)=>b.points-a.points||b.uniqueAnswered-a.uniqueAnswered||a.name.localeCompare(b.name,'de'));
  const currentDaily=Object.keys(dailyResults).filter(k=>k.startsWith(today+'|'))
    .map(k=>dailyResults[k]).map(r=>{
      const found=players.find(p=>p.id===r.playerId);
      return {id:r.playerId,name:found ? found.name : '',correct:r.correct,answered:r.answered,totalMs:r.totalMs};
    })
    .sort((a,b)=>b.correct-a.correct||a.totalMs-b.totalMs||a.name.localeCompare(b.name,'de'));
  return {stats,progress,seen,leaderboard,dailySessions,dailyResults,dailyLeaderboard:currentDaily,awards};
}
function writeBatch_(items) {
  const pSheet=getSheet_('players'),aSheet=getSheet_('answers'),rSheet=getSheet_('rounds'),dSheet=getSheet_('daily');
  const pr=rows_('players'),ar=rows_('answers'),rr=rows_('rounds'),dr=rows_('daily');
  const players=pr.filter(r=>r[0]&&r[1]).map(r=>({id:id_(r[0]),name:String(r[1])}));
  const playerIds=new Set(players.map(p=>p.id)),names=new Set(players.map(p=>norm_(p.name)));
  const answerIds=new Set(ar.map(r=>id_(r[0]))),roundIds=new Set(rr.map(r=>id_(r[0]))),dailyUnique=new Set(dr.map(r=>dailyDay_(r[0])+'|'+id_(r[1])));
  const calc=calculate_(players,ar,rr,dr,'');
  const points={},qprogress={};
  players.forEach(p=>{points[p.id]=calc.stats[p.id].points;qprogress[p.id]=calc.progress[p.id]||{};});
  items.forEach(item=>{
    if(!item||typeof item!=='object')return;
    if(item.kind==='player'){
      const pid=id_(item.playerId),display=name_(item.name),normalized=norm_(display);
      if(!pid||!display||playerIds.has(pid)||names.has(normalized))return;
      pSheet.appendRow([cell_(pid),cell_(display),cell_(normalized),new Date()]);
      playerIds.add(pid);names.add(normalized);players.push({id:pid,name:display});points[pid]=0;qprogress[pid]={};
    }else if(item.kind==='dailyStart'){
      const pid=id_(item.playerId),sid=id_(item.sessionId),day=String(item.dayKey||'');
      if(!playerIds.has(pid)||!sid||day!==today_()||dailyUnique.has(day+'|'+pid))return;
      dSheet.appendRow([day,cell_(pid),cell_(sid),new Date()]);
      dailyUnique.add(day+'|'+pid);dr.push([day,pid,sid,new Date()]);
    }else if(item.kind==='answer'){
      const eid=id_(item.eventId),pid=id_(item.playerId),sid=id_(item.sessionId),qid=id_(item.questionId);
      if(!eid||!playerIds.has(pid)||!sid||!qid||answerIds.has(eid))return;
      const mode=String(item.mode||'original').slice(0,30),dayKey=String(item.dayKey||'').slice(0,10);
      if(mode==='daily' && (!dailyUnique.has(dayKey+'|'+pid) || !dr.some(r=>dailyDay_(r[0])===dayKey && id_(r[1])===pid && id_(r[2])===sid))) return;
      // Eine vor Mitternacht begonnene Runde darf auch spaeter synchronisieren.
      // Entscheidend ist die bestehende, serverseitige Reservierung.
      const duration=num_(item.responseMs,3600000),correct=validCorrect_(item.correct,mode,duration),hint=mode==='daily'?false:bool_(item.hintUsed);
      const q=qprogress[pid][qid]||emptyProgress_();
      let awarded=award_(q,correct,hint);awarded=Math.min(awarded,Math.max(0,1024-points[pid]));
      aSheet.appendRow([cell_(eid),cell_(pid),cell_(sid),cell_(qid),cell_(String(item.category||'').slice(0,90)),correct,hint,duration,new Date(),awarded,'0.7',cell_(mode),mode==='daily'?dayKey:'']);
      answerIds.add(eid);points[pid]+=awarded;q.seen++;q.correct+=correct?1:0;q.wrong+=correct?0:1;q.streak=correct?q.streak+1:0;
      q.lastCorrect=correct;q.hintEver=q.hintEver||hint;q.points=Math.min(2,q.points+awarded);qprogress[pid][qid]=q;
    }else if(item.kind==='round'){
      const sid=id_(item.sessionId),pid=id_(item.playerId),mode=String(item.mode||'original').slice(0,30),dayKey=String(item.dayKey||'').slice(0,10);
      if(!sid||!playerIds.has(pid)||roundIds.has(sid))return;
      if(mode==='daily' && !dr.some(r=>dailyDay_(r[0])===dayKey&&id_(r[1])===pid&&id_(r[2])===sid))return;
      rSheet.appendRow([cell_(sid),cell_(pid),new Date(),num_(item.total,10000),num_(item.correct,10000),num_(item.hintsUsed,10000),num_(item.durationMs,36000000),cell_(mode),mode==='daily'?dayKey:'']);
      roundIds.add(sid);
    }
  });
}
function ack_(ids) {
  const all=new Set(rows_('answers').map(r=>id_(r[0])));
  rows_('rounds').forEach(r=>all.add(id_(r[0])));
  rows_('players').forEach(r=>all.add(id_(r[0])));
  rows_('daily').forEach(r=>all.add(id_(r[2])));
  return {ok:true,version:'0.7',build:'0.7.2',ids:ids.filter(id=>all.has(id))};
}
function snapshot_(selectedId) {
  const players=rows_('players').filter(r=>r[0]&&r[1]).map(r=>({id:String(r[0]),name:String(r[1])}));
  const a=rows_('answers'),r=rows_('rounds'),d=rows_('daily'),x=calculate_(players,a,r,d,selectedId);
  const today=today_(),sessions=x.dailySessions[selectedId]||{},sid=sessions[today]||'';
  const dailyResult=x.dailyResults[today+'|'+selectedId]||null;
  return {ok:true,version:'0.7',build:'0.7.2',dayKey:today,players,stats:x.stats,seen:Array.from(x.seen[selectedId]||[]),
    progress:x.progress[selectedId]||{},leaderboard:x.leaderboard,
    daily:{dayKey:today,reservedSessionId:sid,completed:!!r.some(row=>id_(row[1])===selectedId && id_(row[0])===sid&&sid),
      result:dailyResult?{correct:dailyResult.correct,answered:dailyResult.answered,totalMs:dailyResult.totalMs,
        answers:dailyResult.answers||[]}:null,
      leaderboard:x.dailyLeaderboard},
    generatedAt:new Date().toISOString()};
}
/** Optional: Im Tabellenblatt Antworten die historischen Punkte (Spalte J)
 * an die neuen Regeln angleichen. Einmal von Hand im Script-Editor ausfuehren.
 * Datenzeilen bleiben unveraendert, nur die Punkte-Spalte wird korrigiert.
 */
function recalculateScores() {
  const sheet=getSheet_('answers'),ar=rows_('answers');
  if(!ar.length)return 'Keine Antworten';
  const players=rows_('players').filter(r=>r[0]&&r[1]).map(r=>({id:String(r[0]),name:String(r[1])}));
  const x=calculate_(players,ar,rows_('rounds'),rows_('daily'),'');
  sheet.getRange(2,10,ar.length,1).setValues(ar.map(row=>[x.awards[id_(row[0])]||0]));
  return ar.length+' historische Antworten neu bewertet. Hoechstens 1024 Punkte je Spieler.';
}
