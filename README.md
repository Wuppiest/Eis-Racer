# Eis-Racer 🧊🪝

3D-Rennspiel im Low-Poly-Stil, als **eine einzige HTML-Datei**: `index.html` im Browser öffnen, fertig. Läuft offline und lässt sich einfach verschicken.

Du sitzt auf einer Eisscholle mitten in einer Kart-Halle. Es gibt kein Gas und keine Lenkung, nur deinen **Greifhaken**.
Häng dich irgendwo ein (Reifenstapel, Pfosten, Brücke, Hallendecke, Boden …), lass dich ranziehen und schleuder dich durch die Kurven.
Wer seitlich zieht, bringt die Scholle zum Drehen. Wer sich um einen Pfosten pendeln lässt, nimmt richtig Tempo mit.

## Steuerung
| Taste | Aktion |
|---|---|
| Maus | Umschauen / zielen (First-Person) |
| E oder Linksklick **halten** | Greifhaken schießen und ranziehen |
| loslassen | Haken lösen |
| R | Rennen neu starten |
| Esc / P | Pause (mit Einstellungen) |
| Leertaste | *später: kleine Räder ausfahren* |

Das Fadenkreuz leuchtet **türkis**, wenn der Haken etwas treffen würde (Reichweite 80 m), und **orange**, solange du eingehakt bist.

## Regeln
- 3 Runden auf Zeit. Die Uhr startet bei „LOS!“.
- Unten in der Mitte zeigt der Tacho die Geschwindigkeit, die Runde und die Zeit.
- Bestzeit und beste Runde werden im Browser gespeichert.

## Strecke
- Rund 700 m Kartbahn mit Reifenstapeln, Curbs und Start/Ziel-Portal mit Startampel
- **Brücke**: Die Strecke führt über eine Rampe hoch und kreuzt den Mittelteil, bergab gibt's Schwung
- Gelb-schwarze **Ankerpfosten** an jeder Kurve, ideal zum Herumpendeln

## Entwicklung
Der Quellcode liegt in `src/`, Three.js (r159, MIT) in `vendor/`. Nach Änderungen die Datei neu bauen:

```bash
node build.js
```

| Datei | Inhalt |
|---|---|
| `src/core.js` | Helfer, Low-Poly-Bausteine, Mesh-Merging |
| `src/track.js` | Streckenlayout (Spline), Abfragen für die Physik |
| `src/world.js` | Halle, Strecke, Brücke, Banden, Deko, Trefferflächen für den Haken |
| `src/floe.js` | Eisscholle, Beine, Hakenwerfer, Haken, Seil |
| `src/audio.js` | Prozeduraler Sound (Web Audio, keine Dateien) |
| `src/game.js` | Renderer, Physik, Greifhaken, Runden, HUD, Menüs |
| `src/template.html` | HTML/CSS-Gerüst (UI) |
