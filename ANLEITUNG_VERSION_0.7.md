# Berliner Kneipenquiz — Update 0.7

**Neu:** Intelligentes Training, Tagesquiz, 28 Erfolge/Abzeichen (je nach Anzahl der Kategorien), Punkte-Cap 1024, 30-/10-Sekunden-Timer.

## Zuerst: Sicherung!

1. Dein aktuelles GitHub-Repository in GitHub Desktop lokal sichern oder einen neuen Branch anlegen.
2. In Google Drive **Kneipenquiz_0.6_Spielerdatenbank** öffnen: Datei > Kopie erstellen. Darin sind die bisherigen Spieler, Runden und Antworten gespeichert.
3. Die Browser-Daten auf PC/Handy **nicht löschen**. Offene Antworten werden weiterhin lokal zwischengespeichert.

## Schritt 1 — Google Apps Script zuerst aktualisieren

1. Deine **bestehende** Google-Tabelle öffnen (nicht die alte Excel-Datei).
2. **Erweiterungen > Apps Script** öffnen. Den bisherigen Inhalt von `Code.gs` vollständig durch den Inhalt aus `BACKEND/Code.gs` ersetzen und speichern.
3. In der Funktionsauswahl `setup` wählen und **einmal ausführen**. Das ergänzt die Spalten `Tagesquiz-Tag`, `Modus` und legt das neue Tabellenblatt `Tagesquiz` an. **Bereits vorhandene Zeilen bleiben erhalten.**
4. Optional, aber empfohlen: `recalculateScores` **einmal ausführen**. Damit werden die bisher gespeicherten Punkte in Spalte J nach den neuen Regeln neu berechnet. Die bisherigen Antwortdatensätze bleiben erhalten. Erstelle vorher die Sicherung aus Schritt 2.
5. **Bereitstellen > Bereitstellungen verwalten** > Stift bei der vorhandenen Web-App > **Version: Neue Version** > **Bereitstellen**. Nicht nur auf »Speichern« klicken.
6. **Ausführen als: Ich** / **Zugriff: Jeder**. So können Spieler ohne Google-Konto teilnehmen.
7. Teste die vorhandene URL mit `?action=ping` am Ende (falls schon `?` vorhanden: `&action=ping`). Die Antwort muss `"ok":true` und `"version":"0.7"` enthalten.

**Wichtig:** Wenn du die vorhandene Bereitstellung aktualisierst, bleibt ihre `/exec`-URL normalerweise gleich. Wenn du statt dessen eine neue Bereitstellung anlegst, musst du deren URL in `config.js` ändern.

## Schritt 2 — Quiz auf GitHub aktualisieren

Ersetze in deinem GitHub-Desktop-Repository **nur diese Dateien aus dem ZIP-Hauptverzeichnis**:

- `index.html`
- `app.js`
- `profiles.js`
- `styles.css`
- `service-worker.js`
- `diagnose.html`

**Nicht löschen/ersetzen**: `questions.js`, `assets/`, `CNAME`, `config.js` und gespeicherte Daten. Deine bestehende `config.js` muss weiterhin auf deine gültige Apps-Script-URL `/exec` zeigen.

In GitHub Desktop **Commit** und **Push origin**. Teste mit `https://quiz.thiefen.de/diagnose.html` auf beiden Geräten. Falls die alte Version angezeigt wird: Quiz neu laden, ggf. installierte App schließen und erneut öffnen. Bei GitHub Pages können Veröffentlichungen einige Minuten dauern.

## Neue Regeln

- **Normales Training:** 30 Sekunden pro Frage, inklusive Lesen und Antworten. Wenn die Zeit abläuft, wird automatisch »falsch« gespeichert.
- **Tagesquiz:** Pro Berliner Kalendertag dieselben 10 Multiple-Choice-Fragen für alle; 10 Sekunden je Frage; keine Tipps. Multiple-Choice-Fragen mit mehreren richtigen Lösungen können ebenfalls vorkommen. Der Start wird beim Google-Server reserviert: **ein Versuch pro Spieler und Tag**, auch wenn man später abbricht. Tagesrangliste nach richtigen Antworten, bei Gleichstand nach der summierten Antwortzeit.
- **Ranglistenpunkte:** Erste richtige Antwort ohne Tipp: **2 Punkte**. Erste richtige Antwort mit Tipp: **1 Punkt**. Eine Frage, bei der früher ein Tipp eingesetzt wurde, kann später ohne Tipp bis auf insgesamt 2 Punkte aufgewertet werden. Jede andere Wiederholung gibt **0 Punkte**. Auch eine zuerst falsch beantwortete Frage ohne Tipp gibt durch einfaches Wiederholen keine Punkte. **Maximal 1024 Punkte pro Spieler.**
- **Intelligentes Training:** Adaptiv, Meine Schwächen, nach Lernintervall fällige Fragen, nur neue Fragen. Lernfortschritt wird geräteübergreifend aus dem Google-Sheet gelesen.
- **Abzeichen:** 100/250/500/1024 Punkte; 100/250/512 **verschiedene Basisfragen** beantwortet; 3/10/30 Tage hintereinander trainiert; Kategorie gemeistert (= alle Basisfragen der Kategorie mindestens einmal richtig). Tages-Serien werden nach **Europe/Berlin** berechnet. Ein einmal erreichter Serienrekord bleibt erhalten.

## Worauf beim Test achten

1. Einmal neue Frage korrekt lösen => in Rangliste +2 Punkte; dieselbe Frage erneut => +0.
2. Neue Freitextfrage per Tipp korrekt lösen => +1; später ohne Tipp korrekt => insgesamt +2.
3. Auf PC und Handy denselben Spieler wählen; Werte nach Synchronisierung vergleichen.
4. Normale Frage 30 Sekunden offen lassen: automatisches »falsch«.
5. Tagesquiz starten: Multiple Choice und sichtbarer 10-Sekunden-Timer. Ein erneuter Tagesquiz-Start mit demselben Spieler wird blockiert.
6. Erfolge & Abzeichen in der Startseite öffnen und Fortschritt prüfen.

## Technische Grenzen

Die Quizspieler wählen nur Nicknamen; es gibt **keine Passwörter/Authentifizierung**. Jeder, der einen Nicknamen kennt, könnte ihn auswählen. Ein öffentliches Apps Script kann nicht absolut verhindern, dass technisch versierte Nutzer Antworten manipulieren; die serverseitige Punkte-Obergrenze, doppelte Fragepunkte und Tagesquiz-Reservierungen verhindern aber normale Doppelzählungen zwischen Geräten.

Google Apps Script und Google Sheets sind ein kostenloser Einstieg, haben aber Nutzungsquoten und sind für sehr große öffentliche Wettbewerbe begrenzt. Die Quiz-Frontends laufen weiterhin statisch auf GitHub Pages. Es wird kein zusätzlicher Hostingvertrag benötigt.

**Der Google Apps Script Code muss zuerst live sein, sonst lässt Version 0.7 keine neuen zentral synchronisierten Quizrunden starten.**
