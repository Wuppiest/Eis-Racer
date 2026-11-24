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
| Leertaste **halten** | Kleine Räder ausfahren: Sie drehen sich beim Drücken in deine Blickrichtung, und die Scholle rollt nur noch in diese Richtung (keine Lenkung). Seitliches Rutschen wird weggebremst, Drehen blockiert. Loslassen: Räder rein, wieder Eis |

### iPad / Touch
Wird beim ersten Antippen automatisch erkannt (am besten im Querformat). Sobald eine Tastatur benutzt wird, verschwinden die Knöpfe wieder.

| Touch | Aktion |
|---|---|
| Wischen (überall) | Umschauen / zielen |
| HAKEN-Knopf links **halten** | Greifhaken schießen und ranziehen (beim Halten weiterwischen zum Nachzielen) |
| loslassen | Haken lösen |
| RÄDER-Knopf rechts **halten** | Räder ausfahren (zeigen in Blickrichtung beim Drücken) |
| ❚❚ oben links | Pause |

Das Fadenkreuz leuchtet **türkis**, wenn der Haken etwas treffen würde (Reichweite 80 m), und **orange**, solange du eingehakt bist.

### Hüpfen
Hängt der Haken hoch über dir (Decke, Fachwerk, Banner, hohe Pfosten), zieht dich das Seil auch etwas nach oben. Damit kannst du über Kurvenecken und Banden hüpfen. Der Zug nach oben ist deutlich schwächer als der nach vorne und endet bei gut 2 m Höhe. Weit entfernte Anker heben dich kaum an.

## Regeln
- 3 Runden auf Zeit. Die Uhr startet bei „LOS!“.
- Kleine Abkürzungen über Ecken sind erlaubt. Wer ein ganzes Viertel der Runde überspringt, bekommt die Runde nicht gezählt („Abkürzung“).
- Wer neben der Strecke landet, kommt per Haken und Sprung wieder zurück.
- Unten in der Mitte stehen klein die Geschwindigkeit, die Runde und die Zeit.
- Bestzeit und beste Runde werden im Browser gespeichert.

## Strecken
10 Strecken, jede mit eigener Halle, eigenem Look und eigenen Spezial-Elementen. Auswahl im Menü über „Strecke wählen“; Bestzeiten werden pro Strecke gespeichert.

| # | Strecke | Besonderheiten |
|---|---|---|
| 1 | 🏁 Kart Arena | Der Klassiker: Reifenstapel, Brücke über den Mittelteil |
| 2 | 🌙 Nachtschicht | Neon-Halle, Acht mit **flacher Kreuzung**, Boost-Felder, Bumper |
| 3 | ❄️ Kühlhaus | Serpentinen, **Blankeis**, verschiebende **Paletten**, Matsch |
| 4 | 🏭 Fabrikhalle | **Förderbänder**, **Pressen**, Drehbalken, zwei **Laufkräne** |
| 5 | 🎡 Kirmes | Kleeblatt mit drei **Drehscheiben**, Drehkreuz, Riesenrad & Karussell |
| 6 | ✈️ Flugzeughangar | Breit und schnell, **Seitenwind** aus Riesen-Ventilatoren, Abrissbirne |
| 7 | 🅿️ Parkhaus | Hochstraße über zwei Geraden, **Schranken**, rangierendes Auto |
| 8 | 🏀 Turnhalle | Eng und verwinkelt, Medizinbälle, **Pendel**, Turnmatte |
| 9 | 🕹️ Flipper | **Bumper** und **Flipperarme**, die dich wegschlagen |
| 10 | 🏆 Eisstadion | Das Finale: Lasso mit Brücke, die ganze Halle ist Eis, von allem etwas |

### Spezial-Elemente
- **Boost-Feld**: schiebt dich nach vorn · **Blankeis**: fast keine Reibung · **Matsch**: bremst stark
- **Förderband**: zieht dich in seine Richtung · **Drehscheibe**: nimmt dich mit und dreht dich
- **Ventilator**: Seitenwind · **Drehbalken/-kreuz**, **Schranke**, **Presse/Palette/Auto**, **Pendel**, **Flipperarm**: bewegte Hindernisse
- **Bumper**: schleudert dich zurück
- **Laufkran**: bewegter Ankerpunkt. Bewegte Teile kann man anhaken, der Haken wandert dann mit.

## Entwicklung
Der Quellcode liegt in `src/`, Three.js (r159, MIT) in `vendor/`. Nach Änderungen die Datei neu bauen:

```bash
node build.js
```

| Datei | Inhalt |
|---|---|
| `src/core.js` | Helfer, Low-Poly-Bausteine, Mesh-Merging |
| `src/track.js` | Strecke aus Kontrollpunkten (Spline), Abfragen für die Physik |
| `src/maps.js` | Die 10 Strecken: Layout, Halle, Farben, Elemente |
| `src/world.js` | Halle, Strecke, Brücke, Banden, Trefferflächen für den Haken |
| `src/decor.js` | Deko pro Halle (Riesenrad, Flugzeug, Regale …) |
| `src/elements.js` | Spezial-Elemente: Bewegung, Physik, Zonen |
| `src/floe.js` | Eisscholle, Beine, Hakenwerfer, Haken, Seil |
| `src/audio.js` | Prozeduraler Sound (Web Audio, keine Dateien) |
| `src/game.js` | Renderer, Physik, Greifhaken, Runden, HUD, Menüs |
| `src/template.html` | HTML/CSS-Gerüst (UI) |
