BERLINER KNEIPENQUIZ – UPDATE 0.7.4 (FRAGENQUALITAET)
======================================================

Dieses Update verbessert die Bewertung, ohne weitere Quizloesungen in dieser
Anleitung zu zeigen. Der Quiz-Fragenbestand umfasst weiterhin exakt 512
Fragen mit unveraenderten IDs 1–512.

NEU
- 14 Auswahlfragen: statt gleichwertiger Antworttexte nun vier
  inhaltlich unterschiedliche Moeglichkeiten.
- Bei dreiteiligen Aufzaehlungen zaehlt der Inhalt statt der Reihenfolge;
  fuer ausgewaehlte Literaturfragen gibt es einen geprueften Titelpool.
- Bessere Erkennung gleichwertiger Zahlenformate, Schreibweisen und
  alltaeglicher Umschreibungen. Falsche Zahlen werden nicht durch
  unscharfen Ziffernvergleich versehentlich akzeptiert.
- Rechtschreib-Aufgaben verraten die Loesung nicht mehr im Fragetext.
  Sie erscheinen als Auswahlaufgaben und nicht im reinen Freitextmodus.
- Ein redaktionell begruendeter Zahlenbereich und mehrere weitere
  Aufgabenformulierungen wurden korrigiert.
- 27 Frage-Datensaetze gezielt angepasst; alle 512 IDs bleiben erhalten.

INSTALLATION
1. Den lokalen Repository-Ordner in GitHub Desktop sichern.
2. Genau diese vier Dateien in den HAUPTORDNER des bestehenden Repositories
   kopieren und die vorhandenen Dateien ueberschreiben:
     index.html
     app.js
     questions.js
     service-worker.js
3. In GitHub Desktop: Commit -> Push origin.
4. quiz.thiefen.de im Browser aktualisieren. Die installierte App einmal
   vollstaendig schliessen und erneut oeffnen, ggf. neu laden.
5. Auf der Spieler-Auswahl muss VERSION 0.7.4 angezeigt werden.

WICHTIG
- config.js, profiles.js, die Google-Spielerdatenbank und Google Apps Script
  bleiben UNVERAENDERT. Keine neue Google-Bereitstellung erforderlich.
- Gespeicherte Spieler, Runden, Punkte und die Tagesquiz-Reservierungen
  werden nicht geloescht oder zurueckgesetzt.
- Historisch als falsch verbuchte Antworten werden NICHT nachtraeglich
  neu bewertet: Die Datenbank speichert keine vollstaendigen Freitext-
  Eingaben, anhand derer das zuverlaessig moeglich waere.
- Die Aenderungen wurden durch JavaScript-Syntaxpruefung und 12
  automatisierte Testgruppen geprueft. Ein Live-Test nach dem Upload
  in deiner PWA ist noch erforderlich.
- Dies ist eine systematische Struktur- und gezielte Plausibilitaetspruefung.
  Sie ersetzt keine externe Faktenpruefung jeder einzelnen Quizfrage.

Viel Spass beim Quizzen – ohne Spoiler!
