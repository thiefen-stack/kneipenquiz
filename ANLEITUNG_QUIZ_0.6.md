# Berliner Kneipenquiz Trainer – Update 0.6

**Basis:** Version 0.5 im Repository `thiefen-stack/kneipenquiz`  
**Ziel:** Spielerwahl ohne Registrierung, unbekannte Fragen, 1 Tipp je 10 Fragen, persönliche Statistik und gemeinsame Rangliste.

## A. Spieler-Datenbank als Google-Tabelle anlegen

1. Öffne Google Drive und lade `Kneipenquiz_0.6_Spielerdatenbank.xlsx` hoch.
2. Öffne die Datei mit **Google Tabellen** und speichere sie als echte Google-Tabelle (falls nötig: **Datei → Als Google-Tabelle speichern**).
3. Die Tabellenblätter **Spieler**, **Antworten** und **Runden** müssen exakt so heißen. Die übrigen Blätter **Übersicht** und **Anleitung** dienen dir als Cockpit/Hilfe.
4. Öffne **Erweiterungen → Apps Script**. Ersetze den Beispielcode durch den gesamten Inhalt von `backend/Code.gs`.
5. Speichere. Wähle oben die Funktion **setup** und klicke **Ausführen**. Bestätige die Google-Berechtigungen für deine eigene Tabelle.
6. Klicke **Bereitstellen → Neue Bereitstellung → Typ: Web-App**. Wähle **Ausführen als: Ich** und **Zugriff: Jeder** (nicht nur Google-Kontonutzer). Stelle bereit.
7. Kopiere die Web-App-Adresse, die mit `/exec` endet. **Die Tabelle selbst bleibt privat** und wird nicht öffentlich freigegeben.

**Wichtig:** Bei einigen verwalteten Google-Konten ist „Jeder“ gesperrt. Dann lässt sich die gemeinsame, anonyme Spielerwahl damit nicht betreiben.

## B. Update in das bestehende GitHub-Desktop-Projekt einspielen

1. Öffne im Explorer den lokalen GitHub-Ordner des Repositorys `kneipenquiz` (darin liegen `index.html`, `app.js`, `questions.js`, `styles.css`).
2. Entpacke den Inhalt des Update-ZIPs **in genau diesen Ordner**, sodass `tools/v06` und `backend` entstehen.
3. Doppelklicke `tools\v06\install_v06.bat`. Das Update verändert `index.html`, `app.js`, `styles.css`, `service-worker.js` und kopiert `config.js` sowie `profiles.js` in den Projektordner.
4. Der Installer sichert die alten Dateien zuvor im Windows-Temp-Ordner. `questions.js` und Bilder werden **nicht** verändert.
5. Öffne im Projektordner `config.js` und ersetze den leeren Wert durch deine Web-App-URL:

   ```js
   window.BQ_CONFIG = {
     apiUrl: 'https://script.google.com/macros/s/DEINE_DEPLOYMENT_ID/exec'
   };
   ```

6. Teste lokal mit `index.html` im Browser. Für den vollständigen Google-Sheets-Test ist eine Bereitstellung über HTTPS nötig.
7. In **GitHub Desktop** Änderungen prüfen, Commit erstellen und **Push origin**. Bei GitHub Pages auf `main` wird die Website damit öffentlich aktualisiert. **Also erst pushen, wenn du das Update freigeben möchtest.**
8. Nach dem Update kann der Browser die alte Version noch kurz aus dem Offline-Cache zeigen. App schließen/neu öffnen bzw. neu laden; der Service-Worker-Cache ist auf 0.6 erhöht.

## C. Funktionsregeln

- Beim App-Start wird **immer die Spielerwahl** angezeigt, auch wenn auf diesem Gerät bereits ein Spieler genutzt wurde.
- Neue Spieler benötigen nur einen Namen. Ein leerer Name wird nicht akzeptiert. Doppelte Namen werden unabhängig von Groß-/Kleinschreibung und mehrfachen Leerzeichen verhindert. Die zentrale Prüfung erfolgt unter Sperre, sodass gleichzeitige Registrierungen nicht denselben Namen bekommen.
- **Nur neue Fragen** bedeutet: Die Frage wurde vom aktiven Spieler noch nie beantwortet. Fragen sind innerhalb einer Runde ohnehin eindeutig.
- **Tipps:** Pro volle zehn Fragen in einer Runde ein Tipp (10→1, 20→2, 30→3). Ein Tipp verwandelt eine Freitextfrage in vier Antwortmöglichkeiten. Bei nicht geeigneten Zeichen-/Audiofragen wird kein Tipp angeboten. Wenn keine vier sinnvollen Optionen gebildet werden können, bleibt der Tipp erhalten.
- **Punkte:** richtige Antwort ohne Tipp = 2; richtige Antwort mit Tipp = 1; falsch = 0. Sortierung: Punkte, richtig beantwortete Fragen, mittlere Antwortzeit.
- **Antwortzeit:** Vom Anzeigen der Frage bis zur Abgabe/abschließenden Selbsteinschätzung. Angezeigt wird der Mittelwert pro beantworteter Frage.
- Die bisherige lokale Version-0.5-Statistik ist keinem Spielernamen zugeordnet und wird deshalb **nicht automatisch übernommen**. Sie bleibt im Browser erhalten; neue Spielerstatistiken starten bei null.
- Im Offline-Betrieb bleiben bekannte Spieler und Training nutzbar; neue Ergebnisse werden lokal vorgemerkt und bei wiederhergestellter Verbindung synchronisiert. **Neue zentrale Spielernamen können offline nicht angelegt werden**, weil sonst Namensdoppelungen möglich wären.

## D. Datenschutz und Grenzen

- Es werden keine E-Mail-Adressen, Telefonnummern, Klarnamenpflicht oder Passwörter benötigt. Empfohlen sind frei gewählte Nicknames.
- Die **Namen und Ranglistenwerte** sind in der App für alle Spieler sichtbar. Informiere die Spieler darüber, bevor sie teilnehmen.
- Jeder, der einen Spielernamen kennt, kann diesen auswählen. Das ist bewusst reibungsarm, aber **keine sichere Identitätsprüfung** und nicht gegen manipulierte Ergebnisse geschützt.
- Google Apps Script wird für die Web-App anonym aufrufbar bereitgestellt. Die Google-Tabelle selbst bleibt in deinem Google-Konto privat.
- Google-Apps-Script-Kontingente und Zugriffsregeln können sich ändern. Für eine kleine private Quizrunde ist diese Lösung gedacht, nicht für eine öffentliche Plattform mit tausenden Nutzern.
- Spieler und zugehörige Ergebnisse kannst du als Tabelleninhaber aus den Blättern **Spieler**, **Antworten** und **Runden** löschen. Entferne dabei auch alle Zeilen mit der jeweiligen Spieler-ID.

## E. Testplan vor Veröffentlichung

- [ ] Ohne Spielerwahl sind Training, Statistik und Rangliste nicht erreichbar.
- [ ] Neuen Namen anlegen und auswählen.
- [ ] Gleichen Namen in anderer Groß-/Kleinschreibung erneut anlegen → Fehlermeldung.
- [ ] Mit zwei unterschiedlichen Spielern getrennte Statistiken aufbauen.
- [ ] „Nur neue Fragen“ aktivieren → zuvor beantwortete Fragen fehlen.
- [ ] Runde mit 10 Fragen → genau ein Tipp; bei 20 Fragen → zwei Tipps.
- [ ] Freitextfrage mit Tipp → vier Auswahlmöglichkeiten; richtiger Tipp bringt einen Punkt.
- [ ] Statistik: Anzahl, richtig, Trefferquote und durchschnittliche Antwortzeit prüfen.
- [ ] Rangliste auf einem **zweiten Gerät** öffnen und dieselben Spieler sehen.
- [ ] Offline eine Runde beantworten; nach Rückkehr ins Netz prüfen, ob die Ergebnisse erscheinen.
- [ ] Die Daten in der Google-Tabelle unter **Spieler**, **Antworten** und **Runden** kontrollieren.

**Stand:** Bereitgestellter Quellcode und Testpaket. Die echte Google-Web-App kann erst nach dem Anlegen und Bereitstellen im Google-Konto live geprüft werden.
