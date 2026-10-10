/* Berliner Kneipenquiz v0.6 – Spielerprofile, lokale Offline-Warteschlange, Google Sheets */
(() => {
  'use strict';
  const KEY = 'bq_profiles_v06';
  const rawApi = String(window.BQ_CONFIG?.apiUrl || '').trim();
  const API = /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec(?:\?.*)?$/.test(rawApi) ? rawApi.split('?')[0] : '';
  const central = !!API;
  const empty = () => ({ players: [], activeId: '', answers: [], rounds: [], queue: [], remoteStats: {}, remoteSeen: {}, remoteLeaderboard: [], remoteLoaded: false });
  let state;
  try { state = Object.assign(empty(), JSON.parse(localStorage.getItem(KEY) || '{}')); }
  catch { state = empty(); }
  for (const k of ['players', 'answers', 'rounds', 'queue', 'remoteLeaderboard']) if (!Array.isArray(state[k])) state[k] = [];
  for (const k of ['remoteStats', 'remoteSeen']) if (!state[k] || typeof state[k] !== 'object') state[k] = {};
  let online = !central, lastError = '', flushing = false, refreshInFlight = null, flushTimer = 0;
  const listeners = new Set();
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + '-' + Math.random().toString(36).slice(2));
  const normalize = s => String(s || '').trim().replace(/\s+/g, ' ').normalize('NFKC').toLocaleLowerCase('de-DE');
  const cleanName = s => String(s || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().replace(/\s+/g, ' ').slice(0, 60);
  const persist = () => localStorage.setItem(KEY, JSON.stringify(state));
  const notify = () => { for (const fn of listeners) { try { fn(); } catch (err) { console.warn(err); } } };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  function getActive() { return state.players.find(p => p.id === state.activeId) || null; }
  function getPlayers() { return [...state.players].sort((a, b) => a.name.localeCompare(b.name, 'de')); }
  function getStatus() { return { central, online, pending: state.queue.length, error: lastError }; }
  function zero() { return { sessions: 0, answered: 0, correct: 0, best: 0, points: 0, hints: 0, totalMs: 0, avgMs: 0 }; }
  function addAnswer(stat, a) {
    stat.answered++;
    if (a.correct) { stat.correct++; stat.points += a.hintUsed ? 1 : 2; }
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
        if (playerId) state.remoteSeen[playerId] = data.seen || [];
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
      version: '0.6', mode: String(a.mode || 'original') };
    if (central) { state.queue.push(item); queueFlush(); }
    else state.answers.push(item);
    persist(); notify();
  }
  function finishRound(r) {
    const player = getActive(); if (!player) return;
    const item = { kind: 'round', playerId: player.id, sessionId: String(r.sessionId),
      total: Number(r.total) || 0, correct: Number(r.correct) || 0,
      hintsUsed: Number(r.hintsUsed) || 0, durationMs: Number(r.durationMs) || 0 };
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
  async function init() {
    if (central) {
      try { await refresh(); } catch { /* Gespeicherte Profile und Offline-Fragen bleiben nutzbar. */ }
      if (state.queue.length) flush().catch(() => {});
    }
    notify();
  }
  window.addEventListener('online', () => { refresh().catch(() => {}); flush().catch(() => {}); });
  window.addEventListener('visibilitychange', () => { if (!document.hidden && central) { refresh().catch(() => {}); flush().catch(() => {}); } });
  window.BQProfiles = { init, getActive, getPlayers, getStatus, getStats, getSeenIds, getLeaderboard,
    createPlayer, selectPlayer, recordAnswer, finishRound, refresh, flush,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); } };
})();
