/**
 * Berliner Kneipenquiz Trainer v0.6 – Google Apps Script Backend
 * An die Google-Tabelle aus Kneipenquiz_0.6_Spielerdatenbank.xlsx binden.
 * 1. setup() einmal ausführen.
 * 2. Als Web-App bereitstellen: Ausführen als ICH, Zugriff JEDER.
 * 3. /exec-URL in config.js eintragen.
 *
 * Keine E-Mails, kein Passwort. Wer einen Namen kennt, kann ihn auswählen.
 * Eine öffentlich zugängliche Web-App ist keine fälschungssichere Rangliste.
 */
const QUIZ_TABS = {
  players: { name: 'Spieler', headers: ['Spieler-ID', 'Spielername', 'Name (normalisiert)', 'Erstellt am'] },
  answers: { name: 'Antworten', headers: ['Ereignis-ID', 'Spieler-ID', 'Runden-ID', 'Frage-ID', 'Kategorie', 'Richtig', 'Tipp verwendet', 'Antwortzeit (ms)', 'Zeitpunkt', 'Punkte', 'Version', 'Modus'] },
  rounds: { name: 'Runden', headers: ['Runden-ID', 'Spieler-ID', 'Beendet am', 'Fragen', 'Richtig', 'Tipps', 'Dauer (ms)'] }
};

function setup() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  if (!book) throw new Error('Apps Script muss an eine Google-Tabelle gebunden sein.');
  Object.keys(QUIZ_TABS).forEach(key => {
    const def = QUIZ_TABS[key];
    let sheet = book.getSheetByName(def.name);
    if (!sheet) sheet = book.insertSheet(def.name);
    sheet.getRange(1, 1, 1, def.headers.length).setValues([def.headers]);
    sheet.getRange(1, 1, 1, def.headers.length).setBackground('#1C4D3A').setFontColor('#FFFFFF').setFontWeight('bold');
    sheet.setFrozenRows(1);
  });
  return 'Kneipenquiz v0.6 eingerichtet. Jetzt Web-App bereitstellen.';
}

function getSheet_(key) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(QUIZ_TABS[key].name);
  if (!sheet) throw new Error('Tabelle ' + QUIZ_TABS[key].name + ' fehlt. Bitte setup() ausführen.');
  return sheet;
}
function rows_(key) {
  const sheet = getSheet_(key), last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, QUIZ_TABS[key].headers.length).getValues();
}
function id_(value) { return String(value == null ? '' : value).trim().slice(0, 120); }
function name_(value) { return String(value == null ? '' : value).replace(/[\u0000-\u001F\u007F]/g, '').trim().replace(/\s+/g, ' ').slice(0, 60); }
function norm_(value) { return name_(value).normalize('NFKC').toLocaleLowerCase('de-DE'); }
function safeCell_(value) { const s = String(value == null ? '' : value); return /^[=+\-@]/.test(s) ? "'" + s : s; }
function bool_(value) { return value === true || value === 'true' || value === 1 || value === '1'; }
function num_(value, max) { return Math.max(0, Math.min(max, Math.round(Number(value) || 0))); }
function json_(obj) { return JSON.stringify(obj).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029'); }
function out_(obj, callback) {
  const body = json_(obj);
  if (callback && /^[A-Za-z_$][\w$]{0,80}$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + body + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}
function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    const action = String(p.action || 'snapshot');
    if (action === 'snapshot') return out_(snapshot_(id_(p.playerId)), p.callback);
    if (action === 'ack') return out_(ack_(String(p.ids || '').split(',').map(id_).filter(Boolean).slice(0, 40)), p.callback);
    if (action === 'ping') return out_({ ok: true, version: '0.6' }, p.callback);
    return out_({ ok: false, error: 'Unbekannte Aktion' }, p.callback);
  } catch (err) { return out_({ ok: false, error: String(err.message || err) }, p.callback); }
}
function doPost(e) {
  try {
    const raw = e && e.postData && e.postData.contents;
    const data = JSON.parse(raw || '{}');
    if (data.action !== 'batch' || !Array.isArray(data.items) || data.items.length > 40) {
      throw new Error('Ungültige Anfrage');
    }
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try { writeBatch_(data.items); }
    finally { lock.releaseLock(); }
    return out_({ ok: true });
  } catch (err) { return out_({ ok: false, error: String(err.message || err) }); }
}
function writeBatch_(items) {
  const pSheet = getSheet_('players'), aSheet = getSheet_('answers'), rSheet = getSheet_('rounds');
  const players = rows_('players');
  const playerIds = new Set(players.map(r => id_(r[0])));
  const names = new Set(players.map(r => norm_(r[2] || r[1])));
  const answerIds = new Set(rows_('answers').map(r => id_(r[0])));
  const roundIds = new Set(rows_('rounds').map(r => id_(r[0])));
  items.forEach(item => {
    if (!item || typeof item !== 'object') return;
    if (item.kind === 'player') {
      const pid = id_(item.playerId), display = name_(item.name), normalized = norm_(display);
      if (!pid || !display || playerIds.has(pid) || names.has(normalized)) return;
      pSheet.appendRow([safeCell_(pid), safeCell_(display), safeCell_(normalized), new Date()]);
      playerIds.add(pid); names.add(normalized);
    } else if (item.kind === 'answer') {
      const eventId = id_(item.eventId), pid = id_(item.playerId), sid = id_(item.sessionId);
      if (!eventId || !playerIds.has(pid) || !sid || answerIds.has(eventId)) return;
      const correct = bool_(item.correct), hint = bool_(item.hintUsed);
      aSheet.appendRow([
        safeCell_(eventId), safeCell_(pid), safeCell_(sid), safeCell_(id_(item.questionId)),
        safeCell_(String(item.category || '').slice(0, 90)), correct, hint,
        num_(item.responseMs, 3600000), new Date(), correct ? (hint ? 1 : 2) : 0,
        safeCell_(String(item.version || '0.6').slice(0, 20)), safeCell_(String(item.mode || 'original').slice(0, 30))
      ]);
      answerIds.add(eventId);
    } else if (item.kind === 'round') {
      const sid = id_(item.sessionId), pid = id_(item.playerId);
      if (!sid || !playerIds.has(pid) || roundIds.has(sid)) return;
      rSheet.appendRow([safeCell_(sid), safeCell_(pid), new Date(), num_(item.total, 10000),
        num_(item.correct, 10000), num_(item.hintsUsed, 10000), num_(item.durationMs, 36000000)]);
      roundIds.add(sid);
    }
  });
}
function ack_(ids) {
  const known = new Set(rows_('answers').map(r => id_(r[0])));
  rows_('rounds').forEach(r => known.add(id_(r[0])));
  rows_('players').forEach(r => known.add(id_(r[0])));
  return { ok: true, ids: ids.filter(id => known.has(id)) };
}
function snapshot_(selectedId) {
  const players = rows_('players').filter(r => r[0] && r[1]).map(r => ({ id: String(r[0]), name: String(r[1]) }));
  const stats = {};
  const seen = [];
  const seenSet = new Set();
  players.forEach(p => stats[p.id] = { answered: 0, correct: 0, sessions: 0, best: 0, points: 0, hints: 0, totalMs: 0, avgMs: 0 });
  rows_('answers').forEach(r => {
    const pid = String(r[1]);
    if (!stats[pid]) return;
    const s = stats[pid];
    s.answered++;
    if (bool_(r[5])) s.correct++;
    if (bool_(r[6])) s.hints++;
    s.points += num_(r[9], 2);
    s.totalMs += num_(r[7], 3600000);
    if (pid === selectedId) {
      const qid = String(r[3]);
      if (!seenSet.has(qid)) { seenSet.add(qid); seen.push(qid); }
    }
  });
  rows_('rounds').forEach(r => {
    const pid = String(r[1]);
    if (!stats[pid]) return;
    const s = stats[pid];
    s.sessions++;
    const total = num_(r[3], 10000), correct = num_(r[4], 10000);
    if (total) s.best = Math.max(s.best, 100 * correct / total);
  });
  players.forEach(p => {
    const s = stats[p.id];
    s.avgMs = s.answered ? Math.round(s.totalMs / s.answered) : 0;
  });
  const leaderboard = players.map(p => ({ ...p, ...stats[p.id] }))
    .sort((a, b) => b.points - a.points || b.correct - a.correct ||
      (a.avgMs || Infinity) - (b.avgMs || Infinity) || b.answered - a.answered || a.name.localeCompare(b.name, 'de'));
  return { ok: true, version: '0.6', players, stats, seen, leaderboard, generatedAt: new Date().toISOString() };
}
