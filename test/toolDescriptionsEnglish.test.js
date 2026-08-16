import { TOOLS } from '../src/server.js';

/**
 * Werkzeug- und Parameterbeschreibungen bleiben fest englisch.
 *
 * Das ist dieselbe Publikumsregel wie in der REST-API (turbometrics,
 * 2026-08-16): was einem *Menschen* erklaert, warum etwas nicht geht, folgt
 * seiner Sprache — was eine *Maschine* liest, bleibt fest englisch. Diese
 * Texte liest kein Kunde, sondern das Modell: sie entscheiden, ob es das
 * richtige Werkzeug waehlt und die Parameter richtig fuellt.
 *
 * Sie sind auch gar nicht pro Kunde uebersetzbar. Die Werkzeugliste entsteht
 * einmal beim Verbindungsaufbau in createMcpTransport(); den Kunden kennt der
 * Server zu dem Zeitpunkt nur als Token, und eine API-Rundreise allein fuer
 * die Sprache eines Textes, den nie ein Mensch liest, waere Aufwand ohne
 * Gegenwert.
 *
 * Vorgefunden am 2026-08-16: sieben der vierzehn Werkzeuge beschrieben sich
 * deutsch, sieben englisch — keine Entscheidung, sondern gewachsen. Der
 * *Inhalt* der Antworten ist davon unberuehrt und folgt weiterhin der
 * Kundensprache (ApiLocale liest users.locale, der MCP-Server setzt bewusst
 * kein ?locale=).
 */

/** Nur eigenstaendige deutsche Woerter, die in englischem Text nicht vorkommen. */
const DEUTSCHE_WOERTER = [
  'gibt', 'gib', 'listet', 'liste', 'vergleicht', 'liefert', 'startet',
  'erstellt', 'zurueck', 'zurück', 'alle', 'einen', 'eines', 'einer',
  'eine', 'oder', 'und', 'nach', 'der', 'des', 'dem', 'den', 'die', 'das',
  'nicht', 'kein', 'keine', 'anzahl', 'seite', 'zeitraum', 'standard',
  'ueberwachten', 'überwachten', 'inklusive', 'auf', 'mit', 'von', 'fuer',
  'für', 'ist', 'sind', 'wird', 'werden',
];

function beschreibungen() {
  const treffer = [];

  for (const tool of TOOLS) {
    treffer.push({ ort: `${tool.name}`, text: tool.description });

    const props = tool.inputSchema?.properties ?? {};
    for (const [name, prop] of Object.entries(props)) {
      if (prop?.description) {
        treffer.push({ ort: `${tool.name}.${name}`, text: prop.description });
      }
    }
  }

  return treffer;
}

describe('Werkzeugbeschreibungen', () => {
  test('jedes registrierte Werkzeug hat eine Beschreibung', () => {
    expect(TOOLS.length).toBeGreaterThan(0);

    const ohne = TOOLS.filter((t) => !t.description || t.description.trim() === '');

    expect(ohne.map((t) => t.name)).toEqual([]);
  });

  test('keine Umlaute', () => {
    const treffer = beschreibungen()
      .filter(({ text }) => /[äöüßÄÖÜ]/u.test(text))
      .map(({ ort, text }) => `${ort}: ${text}`);

    expect(treffer).toEqual([]);
  });

  test('keine deutschen Woerter ohne Umlaut', () => {
    // Ein Umlaut allein reicht als Pruefung nicht: 'Listet Scans auf' und
    // 'ID des Scans' rutschen daran vorbei.
    const treffer = [];

    for (const { ort, text } of beschreibungen()) {
      for (const wort of DEUTSCHE_WOERTER) {
        if (new RegExp(`\\b${wort}\\b`, 'iu').test(text)) {
          treffer.push(`${ort} (Wort: ${wort}): ${text}`);
        }
      }
    }

    expect(treffer).toEqual([]);
  });
});
