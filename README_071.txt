KNEIPENQUIZ 0.7.1 - Tagesquiz-Reparatur (10.10.2026)
=====================================================

URSACHE
Google Sheets wandelt Werte wie "2026-10-10" in echte Datumszellen um.
Das alte Apps Script verglich diese Datumsobjekte mit Text und konnte
Tagesquiz-Reservierungen deshalb nicht wiederfinden. Mehrfachversuche
konnten weitere Reservierungen fuer denselben Spieler erzeugen.

1. DATENBANK SICHERN
   In Google Tabellen: Datei -> Kopie erstellen.
   KEINE Spieler, Antworten oder Tagesquiz-Zeilen manuell loeschen.

2. GOOGLE APPS SCRIPT ZUERST AKTUALISIEREN
   In der BESTEHENDEN Google-Spielerdatenbank: Erweiterungen -> Apps Script.
   Code.gs komplett mit der Datei aus backend/Code.gs ersetzen.
   Speichern. Optional setup() ausfuehren (neue Tabellen sind nicht noetig).
   Bereitstellen -> Bereitstellungen verwalten -> Stift -> Version: NEUE VERSION.
   Ausfuehren als ICH, Zugriff JEDER. Die bisherige /exec-URL bleibt gleich.
   PRUEFEN: .../exec?action=ping muss enthalten:
     "version":"0.7","build":"0.7.1"
   Bis dahin NICHT erneut das Tagesquiz starten.

3. GITHUB UPDATE
   Diese Dateien direkt in dein bestehendes GitHub-Repository kopieren:
     index.html, app.js, profiles.js, service-worker.js, diagnose.html
   Anschliessend Commit und Push origin.
   config.js, questions.js, styles.css, Assets und manifest bleiben UNVERAENDERT.
   Bei GitHub Pages die Installation abwarten, auf Handy ggf. zweimal neu laden.

4. TEST
   https://quiz.thiefen.de/diagnose.html sollte Reparatur 0.7.1 melden.
   Quiz starten, den betreffenden Spieler waehlen.
   Statt "Tagesquiz wird reserviert ..." erscheint bei bereits
   reservierten, nicht abgeschlossenen Runden "Tagesquiz fortsetzen".
   Bei neuem Spieler einmal starten, nach Laden die Tagesquiz-Tabelle pruefen:
   Pro Spieler und Tag darf nur EINE neue Reservierung hinzukommen.

Hinweise:
- Vorherige doppelte Reservierungen werden nur noch logisch zusammengefasst;
  vorhandene Zeilen bleiben aus Gruenden der Datensicherheit erhalten.
- Die bisherige Backend-Protokollversion bleibt zur Kompatibilitaet "0.7".
  Das Kennzeichen "build":"0.7.1" bestaetigt die tatsaechliche Reparatur.
- Der Server-Live-Test kann erst nach Deiner neuen Apps-Script-Bereitstellung erfolgen.
