BERLINER KNEIPENQUIZ TRAINER v0.3 PWA
=========================================

Ziel:
https://quiz.thiefen.de/

GitHub Pages
------------
- Repository: thiefen-stack/kneipenquiz
- Veröffentlichung: main / (root)
- Custom Domain: quiz.thiefen.de
- CNAME-Datei ist enthalten.

Installation / Update
---------------------
1. Den INHALT dieses ZIP-Archivs direkt in die Wurzel des GitHub-Repositories laden.
2. Vorhandene Dateien gleichen Namens ersetzen.
3. Commit changes ausführen.
4. GitHub Pages veröffentlicht die neue Version automatisch.

PWA / Offline
-------------
- manifest.webmanifest und service-worker.js sind enthalten.
- Die App kann über HTTPS installiert werden.
- Der App-Kern und die mitgelieferten Bildfragen werden für Offline-Nutzung gecacht.
- Statistik, Fehlerliste und importierte Fragen bleiben lokal im Browser.
- Eigene Songclips bleiben lokal in IndexedDB und werden nicht ins Repository hochgeladen.

Hinweis
-------
Wenn quiz.thiefen.de auf GitHub Pages zeigt, haben Dateien auf einem separaten STRATO-Webspace keinen Einfluss auf diese Subdomain.
