Kneipenquiz 0.7.3 – Browser-/Android-Zuruecktaste

GEAENDERT: index.html, app.js, service-worker.js.

1. Aus diesem ZIP genau diese drei Dateien in den Ordner deines
   GitHub-Desktop-Repositories kneipenquiz kopieren (Dateien ersetzen).
2. In GitHub Desktop Commit und danach Push origin ausfuehren.
3. Am Mobilgeraet Browser/PWA erneut oeffnen und ggf. neu laden.

VERHALTEN:
- Beim Druecken von Zurueck waehrend einer Frage erscheint die Quiz-Startseite.
- Die Runde bleibt im geoeffneten Browser/App-Fenster erhalten.
- Auf der Startseite steht der Button 'Runde fortsetzen'.
- Die 20-/60-Sekunden-Zeitbegrenzung laeuft beim Zurueckgehen weiter,
  damit das Zeitlimit nicht umgangen werden kann.
- Der sichtbare Button 'Startseite' waehrend einer Frage hat denselben Zweck.
- Nach dem Ergebnis fuehrt Browser-Back ebenfalls zur Startseite.
- Beim vollstaendigen Beenden der App ist der laufende In-Memory-Zustand nicht
  garantiert erhalten. Bereits synchronisierte Antworten bleiben gespeichert;
  das Tagesquiz laesst sich ueber die vorhandene Server-Reservierung fortsetzen.

WICHTIG: KEIN Google Apps Script-Update notwendig.
Die 0.7.2-Backend-Version und die Punktelogik bleiben unveraendert.
config.js, profiles.js, questions.js, styles.css und Assets NICHT ersetzen.

Test: PC normaler Browser; Chrome Android; installierte PWA:
1. Normale Runde starten, Zurueck druecken – Startseite.
2. 'Runde fortsetzen' druecken – dieselbe Frage bleibt erhalten.
3. Zeit ablaufen lassen – die Frage gilt als falsch.
4. Tagesquiz starten und wiederholen, ohne neue Tages-Reservierung.
5. Nach Ende der Runde Back – Startseite.
