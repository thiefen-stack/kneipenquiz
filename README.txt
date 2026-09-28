BERLINER KNEIPENQUIZ TRAINER v0.4
=================================

Zieladresse: https://quiz.thiefen.de

Neu in v0.4
- exakt 512 fest integrierte Basisfragen
- deutlich mehr Bildfragen, darunter 20 Flaggen
- adaptives Training: unsichere/falsche Fragen werden häufiger ausgewählt
- sicher beantwortete Fragen erscheinen seltener
- Fehler gelten nach zwei richtigen Antworten in Folge als gefestigt
- Filter nach Kategorie und Schwierigkeit
- lokaler Frageneditor mit Bearbeiten/Löschen/JSON-Export
- PWA/Offline-Modus bleibt erhalten

Hinweis zum Frageneditor
GitHub Pages ist statisch und kann Dateien nicht direkt aus dem Browser verändern.
Fragen aus dem Editor werden deshalb lokal im Browser gespeichert. Sie können als JSON
exportiert und später dauerhaft in die feste Fragenbank übernommen werden.

Deployment
Den Inhalt dieses Ordners in das GitHub-Repository thiefen-stack/kneipenquiz kopieren,
committen und pushen. GitHub Pages veröffentlicht anschließend automatisch.
