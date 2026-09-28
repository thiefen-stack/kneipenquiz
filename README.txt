BERLINER KNEIPENQUIZ TRAINER v0.2.1 HTTP
========================================

Diese Version ist speziell fuer:
http://www.5mw.de/quiz/

Installation
------------
1. Den INHALT dieses ZIP-Archivs direkt in den Ordner /quiz/ auf dem Webspace kopieren.
2. Danach aufrufen:
   http://www.5mw.de/quiz/
3. Alternativ funktioniert:
   http://www.5mw.de/quiz/index.html

Wichtig
-------
- Diese Ausgabe benoetigt KEIN HTTPS.
- Service Worker und PWA-Installation sind bewusst entfernt.
- Fragen, Fehlerstatistik und Fortschritt werden im Browser lokal gespeichert.
- Eigene Audiofragen werden lokal per IndexedDB im verwendeten Browser gespeichert.
- Die App laedt keine externen Bibliotheken, Fonts oder Skripte nach.
- Die Dateien sollen DIREKT unter /quiz/ liegen, nicht in einem zusaetzlichen Unterordner.

Erwartete Struktur auf dem Webspace:
/quiz/index.html
/quiz/app.js
/quiz/questions.js
/quiz/styles.css
/quiz/.htaccess
/quiz/assets/...
