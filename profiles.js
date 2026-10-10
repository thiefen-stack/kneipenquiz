/* Berliner Kneipenquiz v0.6.2 – Spielerprofile, lokale Offline-Warteschlange, Google Sheets */
(() => {
  'use strict';
  const KEY = 'bq_profiles_v06';
  const rawApi = String(window.BQ_CONFIG?.apiUrl || '').trim();
  const API = /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec(?:\?.*)?$/.test(rawApi) ? rawApi.split('?')[0] : '';
  const central = !!API;
  const empty = () => ({ players: [], activeId: '', answers: [], rounds: [], queue: [], remoteStats: {}, remoteSeen: {}, remoteLeaderboard: [], remoteLoaded: false, legacyImport: null, remoteProgress: {}, remoteDaily: null, dayKey: "", backendVersion: "", backendBuild: "" });
  let state;
  try { state = Object.assign(empty(), JSON.parse(localStorage.getItem(KEY) || '{}')); }
  catch { state = empty(); }
  for (const k of ['players', 'answers', 'rounds', 'queue', 'remoteLeaderboard']) if (!Array.isArray(state[k])) state[k] = [];
  for (const k of ['remoteStats', 'remoteSeen']) if (!state[k] || typeof state[k] !== 'object') state[k] = {};
  let online = !central, lastError = '', flushing = false, refreshInFlight = null, flushTimer = 0;
  if (!state.remoteProgress || typeof state.remoteProgress !== 'object') state.remoteProgress = {};
  let migrationPromise = null;
  const listeners = new Set();
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + '-' + Math.random().toString(36).slice(2));
  const normalize = s => String(s || '').trim().replace(/\s+/g, ' ').normalize('NFKC').toLocaleLowerCase('de-DE');
  const cleanName = s => String(s || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().replace(/\s+/g, ' ').slice(0, 60);
  const persist = () => localStorage.setItem(KEY, JSON.stringify(state));
  const notify = () => { for (const fn of listeners) { try { fn(); } catch (err) { console.warn(err); } } };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  function getActive() { return state.players.find(p => p.id === state.activeId) || null; }
  function getPlayers() { return [...state.players].sort((a, b) => a.name.localeCompare(b.name, 'de')); }
  function getStatus() { return { central, online, pending: state.queue.length, error: lastError, version: state.backendVersion || '', build:state.backendBuild || '', dayKey: state.dayKey || '' }; }
  const zeroProgress = () => ({seen:0,correct:0,wrong:0,streak:0,lastAt:0,lastCorrect:false,hintEver:false,points:0,category:''});
  function earnedFor(prior, correct, hint, total) {
    if (!correct || total >= 1024) return 0;
    const award = !prior.seen ? (hint ? 1 : 2) : prior.hintEver && !hint ? Math.max(0,2-prior.points) : 0;
    return Math.min(award, 1024-total);
  }
  function getQuestionProgress(playerId=state.activeId) {
    const base = central ? state.remoteProgress[playerId] || {} : {};
    const p = Object.fromEntries(Object.entries(base).map(([k,v])=>[String(k),{...v}]));
    const local = central ? state.queue : state.answers;
    let score = central ? (state.remoteStats[playerId]?.points || 0) : 0;
    local.forEach(a=>{
      if (a.kind !== 'answer' || a.playerId !== playerId) return;
      const id=String(a.questionId), q=p[id] || zeroProgress();
      const duration = Math.max(0, Number(a.responseMs)||0);
      const correct = !!a.correct && duration <= (a.mode==='daily'?10000:30000);
      const hint = !!a.hintUsed, earned = earnedFor(q,correct,hint,score);
      score += earned; q.seen++;q.correct+=correct?1:0;q.wrong+=correct?0:1;
      q.streak=correct?q.streak+1:0;q.lastCorrect=correct;q.hintEver=q.hintEver||hint;
      q.points=Math.min(2,q.points+earned);q.lastAt=a.at || Date.now();q.category=a.category||q.category;
      p[id]=q;
    });
    return p;
  }
  function getDaily() { return state.remoteDaily || { dayKey:state.dayKey||'',reservedSessionId:'',completed:false,result:null,leaderboard:[] }; }
  function getBackendVersion() { return String(state.backendVersion||''); }
  function zero() { return { sessions:0,answered:0,uniqueAnswered:0,correct:0,best:0,points:0,hints:0,totalMs:0,avgMs:0,currentStreak:0,longestStreak:0 }; }
  function addAnswer(stat, a) {
    stat.answered++;
    if (a.correct && Number(a.responseMs||0) <= (a.mode==='daily'?10000:30000)) stat.correct++;
    if (a.hintUsed) stat.hints++;
    stat.totalMs += Math.max(0, Number(a.responseMs) || 0);
  }
  function addRound(stat, r) {
    stat.sessions++;
    if (r.total) stat.best = Math.max(stat.best, (Number(r.correct) || 0) / r.total * 100);
  }
  function getStats(playerId = state.activeId) {
    const base = central ? state.remoteStats[playerId] : null;
    const s = Object.assign(zero(), base || {});
    const answers = central ? state.queue.filter(x => x.kind === 'answer' && x.playerId === playerId) : state.answers.filter(x => x.playerId === playerId);
    const rounds = central ? state.queue.filter(x => x.kind === 'round' && x.playerId === playerId) : state.rounds.filter(x => x.playerId === playerId);
    answers.forEach(a => addAnswer(s, a));
    rounds.forEach(r => addRound(s, r));
    s.uniqueAnswered = Object.keys(getQuestionProgress(playerId)).filter(id=>/^\d+$/.test(id)&&Number(id)>=1&&Number(id)<=512).length;
    if (!central) s.points = Math.min(1024,Object.values(getQuestionProgress(playerId)).reduce((n,q)=>n+q.points,0));
    s.avgMs = s.answered ? Math.round(s.totalMs / s.answered) : 0;
    return s;
  }
  function getSeenIds(playerId = state.activeId) {
    const ids = new Set(central ? (state.remoteSeen[playerId] || []).map(String) : []);
    const answers = central ? state.queue : state.answers;
    answers.forEach(a => { if (a.kind === 'answer' && a.playerId === playerId) ids.add(String(a.questionId)); });
    return ids;
  }
  function getLeaderboard() {
    if (central) return state.remoteLeaderboard;
    return getPlayers().map(p => ({ ...p, ...getStats(p.id) })).sort((a, b) =>
      b.points - a.points || b.correct - a.correct || (a.avgMs || Infinity) - (b.avgMs || Infinity) || a.name.localeCompare(b.name, 'de'));
  }
  function jsonp(action, params = {}) {
    return new Promise((resolve, reject) => {
      const cb = '__bq_cb_' + uuid().replace(/[^A-Za-z0-9_]/g, '');
      const script = document.createElement('script');
      let done = false;
      const clean = () => { delete window[cb]; script.remove(); clearTimeout(timer); };
      const fail = error => { if (done) return; done = true; clean(); reject(error); };
      window[cb] = data => { if (done) return; done = true; clean(); if (!data || data.ok === false) reject(new Error(data?.error || 'Serverfehler')); else resolve(data); };
      const url = new URL(API);
      url.searchParams.set('action', action);
      url.searchParams.set('callback', cb);
      url.searchParams.set('_', String(Date.now()));
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
      const timer = setTimeout(() => fail(new Error('Keine Antwort vom Quiz-Server.')), 15000);
      script.onerror = () => fail(new Error('Quiz-Server nicht erreichbar.'));
      script.src = url.toString();
      document.head.appendChild(script);
    });
  }
  async function send(items) {
    // Apps Script gibt eine fremde Origin zurück. POST wird deshalb ohne CORS-Lesezugriff gesendet.
    // Bestätigung erfolgt separat per JSONP-GET (ack); keine Antwort wird blind als Erfolg gewertet.
    await fetch(API, { method: 'POST', mode: 'no-cors', redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'batch', items }) });
  }
  async function refresh() {
    if (!central) { online = true; notify(); return true; }
    if (refreshInFlight) return refreshInFlight;
    const playerId = state.activeId;
    refreshInFlight = (async () => {
      try {
        const data = await jsonp('snapshot', { playerId });
        state.players = data.players || [];
        state.remoteStats = data.stats || {};
        state.remoteLeaderboard = data.leaderboard || [];
        if (playerId) {
          state.remoteSeen[playerId] = data.seen || [];
          if (data.progress) state.remoteProgress[playerId] = data.progress;
        }
        state.remoteDaily = data.daily || null;
        state.dayKey = data.dayKey || state.dayKey || '';
        state.backendVersion = data.version || '';
        state.backendBuild = data.build || '';
        state.remoteLoaded = true;
        online = true; lastError = '';
        persist(); notify();
        return true;
      } catch (err) {
        online = false; lastError = String(err.message || err);
        notify(); throw err;
      } finally { refreshInFlight = null; }
    })();
    return refreshInFlight;
  }
  async function createPlayer(rawName) {
    const name = cleanName(rawName);
    if (!name) throw new Error('Bitte zuerst einen Spielernamen eingeben.');
    if (getPlayers().some(p => normalize(p.name) === normalize(name))) throw new Error('Dieser Spielername ist bereits vergeben.');
    const player = { id: 'p-' + uuid(), name };
    if (central) {
      if (!navigator.onLine) throw new Error('Neue Spieler können nur mit Internetverbindung angelegt werden.');
      await refresh();
      if (getPlayers().some(p => normalize(p.name) === normalize(name))) throw new Error('Dieser Spielername ist bereits vergeben.');
      await send([{ kind: 'player', playerId: player.id, name }]);
      for (let i = 0; i < 5; i++) {
        await wait(500 + i * 400);
        try { await refresh(); } catch { continue; }
        const found = getPlayers().find(p => normalize(p.name) === normalize(name));
        if (found) {
          if (found.id !== player.id) throw new Error('Dieser Spielername ist bereits vergeben.');
          state.activeId = player.id; persist(); notify();
          await refresh().catch(() => {});
          return player;
        }
      }
      throw new Error('Der Spieler konnte nicht bestätigt werden. Bitte Verbindung prüfen und erneut versuchen.');
    }
    state.players.push(player);
    state.activeId = player.id; persist(); notify();
    return player;
  }
  async function selectPlayer(playerId) {
    if (!state.players.some(p => p.id === playerId)) throw new Error('Spieler nicht gefunden.');
    state.activeId = playerId; persist(); notify();
    if (central) await refresh().catch(() => {});
    return getActive();
  }
  function queueFlush() {
    if (!central || flushTimer) return;
    flushTimer = setTimeout(() => { flushTimer = 0; flush().catch(err => console.warn('Quiz-Synchronisierung:', err)); }, 1200);
  }
  function recordAnswer(a) {
    const player = getActive(); if (!player) return;
    const item = { kind: 'answer', eventId: 'a-' + uuid(), playerId: player.id,
      sessionId: String(a.sessionId), questionId: String(a.questionId), category: String(a.category || ''),
      correct: !!a.correct, hintUsed: !!a.hintUsed, responseMs: Math.round(a.responseMs || 0),
      version: '0.7', mode: String(a.mode || 'original'),dayKey:String(a.dayKey||''),at:Date.now() };
    if (central) { state.queue.push(item); queueFlush(); }
    else state.answers.push(item);
    persist(); notify();
  }
  function finishRound(r) {
    const player = getActive(); if (!player) return;
    const item = { kind: 'round', playerId: player.id, sessionId: String(r.sessionId),
      total: Number(r.total) || 0, correct: Number(r.correct) || 0,
      hintsUsed: Number(r.hintsUsed) || 0, durationMs: Number(r.durationMs) || 0,
      mode:String(r.mode||'original'),dayKey:String(r.dayKey||'') };
    if (central) {
      if (!state.queue.some(x => x.kind === 'round' && x.sessionId === item.sessionId)) state.queue.push(item);
      queueFlush();
    } else if (!state.rounds.some(x => x.sessionId === item.sessionId)) state.rounds.push(item);
    persist(); notify();
  }
  async function flush() {
    if (!central || flushing || !state.queue.length || !navigator.onLine) return;
    flushing = true;
    try {
      while (state.queue.length) {
        const batch = state.queue.slice(0, 25);
        await send(batch);
        const ids = batch.map(x => x.eventId || x.sessionId);
        let acked = [];
        for (let attempt = 0; attempt < 3; attempt++) {
          await wait(550 + attempt * 500);
          const ack = await jsonp('ack', { ids: ids.join(',') });
          acked = ack.ids || [];
          if (acked.length === ids.length) break;
        }
        if (!acked.length) throw new Error('Synchronisierung noch nicht bestätigt.');
        // Erst nach erfolgreichem Abruf der neuen Statistik entfernen.
        await refresh();
        const set = new Set(acked);
        state.queue = state.queue.filter(x => !set.has(x.eventId || x.sessionId));
        persist(); notify();
        if (acked.length !== ids.length) break;
      }
    } catch (err) {
      online = false; lastError = String(err.message || err);
      notify();
      throw err;
    } finally { flushing = false; }
  }
  // Spieler, die in der vorherigen Testversion nur auf dem PC angelegt wurden,
  // müssen VOR dem ersten Remote-Snapshot gesichert werden.
  function captureLocalPlayers(){
    if(!central || state.legacyImport || state.remoteLoaded || !state.players.length) return;
    state.legacyImport={players:[...state.players],answers:[...state.answers],rounds:[...state.rounds],activeId:state.activeId};
    persist();
  }
  async function migrateLocalPlayers(){
    if(!central || !state.legacyImport || !online) return false;
    if(migrationPromise) return migrationPromise;
    migrationPromise = (async()=>{
      const legacy = state.legacyImport;
      const mapping={};
      for(const player of legacy.players){
        let remote=state.players.find(p=>p.id===player.id)||state.players.find(p=>normalize(p.name)===normalize(player.name));
        if(!remote){
          // Atomare Namensvergabe bleibt im Apps Script (LockService).
          await send([{kind:'player',playerId:player.id,name:player.name}]);
          for(let attempt=0;attempt<6;attempt++){
            await wait(650 + attempt * 250);
            await refresh();
            remote=state.players.find(p=>p.id===player.id)||state.players.find(p=>normalize(p.name)===normalize(player.name));
            if(remote) break;
          }
        }
        if(!remote) throw new Error('Lokaler Spieler '+player.name+' konnte nicht zum Server übertragen werden.');
        mapping[player.id]=remote.id;
      }
      // Frühere Offline-Antworten mit stabilen Ereignis-IDs in die Warteschlange.
      const queued=new Set(state.queue.map(x=>x.eventId||x.sessionId));
      for(const a of legacy.answers){
        const eid=a.eventId||('m-a-'+uuid());
        if(!mapping[a.playerId]||queued.has(eid)) continue;
        state.queue.push({...a,kind:'answer',eventId:eid,playerId:mapping[a.playerId]});queued.add(eid);
      }
      for(const r of legacy.rounds){
        const rid=r.sessionId||('m-r-'+uuid());
        if(!mapping[r.playerId]||queued.has(rid)) continue;
        state.queue.push({...r,kind:'round',sessionId:rid,playerId:mapping[r.playerId]});queued.add(rid);
      }
      if(mapping[legacy.activeId]) state.activeId=mapping[legacy.activeId];
      state.legacyImport=null;persist();notify();
      if(state.activeId) await refresh();
      if(state.queue.length) await flush();
      return true;
    })().catch(err=>{online=false;lastError=String(err.message||err);notify();throw err;}).finally(()=>{migrationPromise=null;});
    return migrationPromise;
  }
  async function reserveDaily(sessionId) {
    if (!central || !online || getBackendVersion() !== '0.7' || state.backendBuild !== '0.7.1') throw new Error('Tagesquiz benötigt Apps Script 0.7.1 und eine Serververbindung.');
    await refresh();
    const dayKey = state.dayKey;
    if (!dayKey) throw new Error('Kein gültiger Quiztag vom Server empfangen.');
    // Vorhandene Serverreservierung niemals duplizieren: dieselbe Runde fortsetzen.
    if (state.remoteDaily?.reservedSessionId) return {dayKey,sessionId:state.remoteDaily.reservedSessionId};
    await send([{kind:'dailyStart',playerId:state.activeId,sessionId,dayKey}]);
    for (let i=0;i<7;i++) {
      await wait(350+i*250);
      await refresh();
      if (state.remoteDaily?.reservedSessionId) {
        return {dayKey,sessionId:state.remoteDaily.reservedSessionId};
      }
    }
    throw new Error('Der Quizstart wurde nicht bestätigt. Bitte die Seite aktualisieren – keine weitere Reservierung erzeugen.');
  }
  async function init() {
    if (central) {
      captureLocalPlayers();
      try {
        await refresh();
        await migrateLocalPlayers();
      } catch (err) {
        // Bei gescheiterter Übertragung die nur lokal vorhandenen Spieler weiterhin
        // zur Auswahl anbieten. Lokaldaten niemals automatisch verwerfen.
        if(state.legacyImport?.players?.length){
          const known=new Set(state.players.map(p=>normalize(p.name)));
          for(const p of state.legacyImport.players){
            if(!known.has(normalize(p.name))){state.players.push(p);known.add(normalize(p.name));}
          }
          if(!getActive() && state.legacyImport.activeId){state.activeId=state.legacyImport.activeId;}
          persist();
        }
        online=false; lastError=String(err.message||err);
      }
      if (state.queue.length && online) flush().catch(() => {});
    }
    notify();
  }
  window.addEventListener('online', () => { refresh().then(()=>migrateLocalPlayers()).catch(() => {}); flush().catch(() => {}); });
  window.addEventListener('visibilitychange', () => { if (!document.hidden && central) { refresh().then(()=>migrateLocalPlayers()).catch(() => {}); flush().catch(() => {}); } });
  window.BQProfiles = { init, getActive, getPlayers, getStatus, getStats, getSeenIds, getLeaderboard,
    createPlayer, selectPlayer, recordAnswer, finishRound, refresh, flush, migrateLocalPlayers,
    getQuestionProgress,getDaily,getBackendVersion,reserveDaily,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); } };
})();
