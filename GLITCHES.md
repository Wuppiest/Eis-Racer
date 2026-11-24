# Eis-Racer – Glitches (geheim 🤫)

Bugs, die als Feature im Spiel geblieben sind. Ein geschaffter Trick macht ein kurzes digitales „Glitch“-Geräusch.

| Trick | Was passiert | Wie es geht |
|---|---|---|
| **Seil-Snap** | Kurzer Tempo-Schub Richtung Anker. Mehrmals hintereinander möglich, jedes Mal schwächer. | Seil **straff** halten, loslassen und innerhalb von **0,12 s** neu schießen. |
| **Bandenreiten** | Du rutschst *auf* der Bande, fast ohne Reibung, und lenkst in Kurven automatisch mit. | Mit über **29 km/h** aus einem Sprung **genau auf der Oberkante** einer Bande landen (±0,5 m). Endet bei unter 18 km/h, am Bandenende oder beim nächsten Sprung. |
| **Räder-Trampolin** | Statt Landung wirst du hoch geschleudert (bis ~10 m), auch **durch Brücken** hindurch auf die Fahrbahn darüber. | Im Fallen die **Räder-Taste höchstens 0,5 s vor der Landung drücken und halten**. |
| **Doppelbumper** | Der Bumper-Kick zählt 2,6-fach, du wirst extrem weggeschossen. | Den Bumper (oder direkt daneben) **anhaken**, sodass der Haken **höchstens 0,6 s** vor dem Aufprall greift. |
| **Decken-Clip** | Du rutschst von unten durch die Brücke und landest oben auf ihr. | Unter einer Brücke **in den ersten oder letzten 8 m** mit Schwung nach oben gegen die Unterseite springen. |
| **Seil-Zieher** | Du wirst durch die Brücke nach oben gezogen. | Die Brücke **über dir** anhaken, hochspringen, mit dem Kopf anstoßen und innerhalb von **0,35 s** loslassen und neu schießen. |
| **Kreuzungs-Verwechslung** | Das Spiel setzt dich auf einen anderen, weiter vorne liegenden Streckenteil. Großer Skip, zählt nicht als Abkürzung. | Wo sich zwei Streckenteile kreuzen oder dicht nebeneinander liegen: **Räder antippen** (drücken und innerhalb von **0,3 s** loslassen). |
| **Wand-Clip** | Du rutschst durch die Bande, eventuell bis auf einen anderen Streckenteil. Zählt nicht als Abkürzung. | Mit über **45 km/h** schräg (**20–70°**) gegen die Bande fahren und die **Räder antippen**, bis **0,15 s vor oder nach** dem Aufprall. |

## Test-Werkzeuge (später wieder entfernen)
- **Bug-Anzeige:** Ein lila Banner zeigt den Namen eines geschafften Tricks.
- **Admin-Menü** im Pause-Menü (Esc / ❚❚): Ein Knopf pro Trick startet eine **Demo mit Anlauf** an der nächsten passenden Stelle der Strecke, in **Zeitlupe (0,4×)**. Links zeigt eine Anzeige jede Eingabe (E/Maus, Leertaste, Zielen leuchten auf) mit Zeitstempel und Abstand zur vorherigen Eingabe. Die Kamera schwenkt sichtbar auf die Ziele. Esc bricht ab. Gibt es auf der Strecke keine Stelle, kommt eine Meldung. Bestzeiten werden in diesem Rennen nicht gespeichert.
- Beim Bandenreiten hilft die Demo bei der Landung etwas nach (Richtung und Tempo), damit sie zuverlässig klappt.
- Beides hängt am Schalter `GLITCH_DEBUG` in `src/game.js`.

| Trick | Möglich auf |
|---|---|
| Seil-Snap, Bandenreiten, Räder-Trampolin, Wand-Clip | allen Strecken |
| Doppelbumper | Nachtschicht, Kirmes, Turnhalle, Flipper, Eisstadion |
| Decken-Clip, Seil-Zieher | Kart Arena, Parkhaus, Eisstadion (Brücken) |
| Kreuzungs-Verwechslung | Kart Arena, Nachtschicht, Turnhalle |
