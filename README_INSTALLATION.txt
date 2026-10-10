KNEIPENQUIZ 0.7.2 – VERDOPPELTE ANTWORTZEITEN
================================================

Neue Limits:
  Tagesquiz: 20 Sekunden je Frage (bisher 10)
  Normales Training und Fehlertraining: 60 Sekunden je Frage (bisher 30)
  Bei Zeitablauf weiterhin automatische Falschwertung.

INSTALLATION (Reihenfolge wichtig):

1) In Google Tabellen → Erweiterungen → Apps Script den Inhalt der vorhandenen
   Code.gs durch backend/Code.gs aus diesem ZIP ersetzen und speichern.
   Bestehende Tabellen, Nutzer und Antworten bleiben unberührt.
   Kein erneutes setup() oder recalculateScores() erforderlich.
2) Bereitstellen → Bereitstellungen verwalten → vorhandene Web-App
   bearbeiten → Neue Version → Bereitstellen. Nicht eine neue URL erstellen.
3) Prüfen: aktuelle /exec?action=ping-Adresse muss enthalten:
     "version":"0.7","build":"0.7.2"
4) Nur die fünf Dateien index.html, app.js, profiles.js, service-worker.js
   und diagnose.html direkt ins GitHub-Repository-Hauptverzeichnis kopieren.
   Dann über GitHub Desktop: Commit → Push origin.
   config.js, questions.js, styles.css und assets NICHT ersetzen.
5) quiz.thiefen.de am PC und Handy neu laden, bei PWA ggf. erneut starten.
   Bei Problemen diagnose.html öffnen.

Die Regeln gelten für neue Antworten. Früher bereits als falsch gespeicherte
Antworten werden nicht automatisch nachträglich als richtig bewertet.

Die Tagesquiz-Reservierungen und die Einmal-pro-Tag-Regel bleiben unverändert.

HINWEIS: Da die Regeln auch serverseitig aktualisiert werden, können während
des Deployments (alte App + neuer Server / neue App + alter Server)
kurzzeitig unterschiedliche Anzeigen auftreten. Nach beiden Updates neu laden.
