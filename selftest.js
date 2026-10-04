/* LERNI – Selbsttest im Browser: dist/index.html?selftest (lädt diese Datei nach).
   Prüft Inhalte, Textvergleich, Bewertung aller Fragetypen, Lernlogik, Speicherstand und Sicherung,
   beantwortet jede Frage über die echte Oberfläche und öffnet jede Seite.
   Ergebnis: window.lerniTest = { ok, fails, errors, n, ms } – fails und errors müssen leer sein.
   Der Lernstand wird vorher gesichert und danach wiederhergestellt. */
(function () {
  'use strict';
  const t0 = performance.now(), fails = [], errors = [];
  let n = 0;
  const ok = (cond, text) => { n++; if (!cond) fails.push(text); };
  const gleich = (a, b, text) => ok(JSON.stringify(a) === JSON.stringify(b), text + ' – erwartet ' + JSON.stringify(b) + ', war ' + JSON.stringify(a));
  const fang = (text, fn) => { try { fn(); } catch (e) { errors.push(text + ': ' + (e && e.stack || e)); } };
  const onErr = (e) => errors.push('window.onerror: ' + (e.message || e.reason || e));
  window.addEventListener('error', onErr); window.addEventListener('unhandledrejection', onErr);

  const { App, Store, Lerni, Lernlogik, Bewerter } = window.lerni;
  const altStand = JSON.stringify(Store.data), altKlausur = localStorage.getItem('lerni.klausur'), altVorImport = localStorage.getItem('lerni.vorImport');
  const alleFragen = Object.values(Lerni.fragen);

  /* ---------- Inhalte ---------- */
  fang('Inhalte', () => {
    const p = Lerni.pruefen();
    ok(p.fehler.length === 0, 'Inhaltsfehler: ' + p.fehler.join(' | '));
    ok(alleFragen.length > 0, 'keine Fragen geladen');
    for (const typ of Object.keys(TYPEN)) ok(alleFragen.some((f) => f.typ === typ) || typ === 'none', 'kein Beispiel für Typ ' + typ);
  });

  /* ---------- Textvergleich, Zahlen, Datum, Markdown ---------- */
  fang('Hilfsfunktionen', () => {
    ok(U.passt('Konsolidierung', ['Konsolidierung']), 'gleiches Wort');
    ok(U.passt('  konsolidierung ', ['Konsolidierung']), 'Groß/klein und Leerzeichen');
    ok(U.passt('Konsolidirung', ['Konsolidierung']), 'ein Tippfehler bei langem Wort');
    ok(!U.passt('Konzentration', ['Konsolidierung']), 'anderes Wort darf nicht passen');
    ok(U.passt('Uebung', ['Übung']) && U.passt('Übung', ['Uebung']), 'Umlaute ä = ae');
    ok(U.passt('Strasse', ['Straße']), 'ß = ss');
    ok(!U.passt('Tag', ['Tal']), 'kurze Wörter genau');
    ok(!U.passt('13', ['15']), 'Zahlen genau');
    ok(!U.passt('', ['x']), 'leer passt nie');
    gleich(U.zahl('10,5'), 10.5, 'Komma'); gleich(U.zahl('1.234,5'), 1234.5, 'Tausenderpunkt'); gleich(U.zahl('1,234.5'), 1234.5, 'engl. Tausender');
    gleich(U.zahl('-3e2'), -300, 'Exponent'); ok(isNaN(U.zahl('abc')), 'keine Zahl'); gleich(U.zahl(' 12 % '), 12, 'Prozent');
    const d = U.dayNum(); gleich(U.keyToNum(U.numToKey(d)), d, 'Tag hin und zurück'); gleich(U.numToKey(U.keyToNum('2026-03-29')), '2026-03-29', 'Tag über Zeitumstellung');
    ok(U.md('**a** und *b*\n- x\n- y').includes('<b>a</b>') && U.md('- x\n- y').includes('<ul><li>x</li><li>y</li></ul>'), 'Markdown fett und Liste');
    ok(U.md('<script>').indexOf('<script') < 0, 'Markdown maskiert HTML');
    ok(U.md('$a*b*c$').includes('<span class="math">a*b*c</span>'), 'Formel bleibt unformatiert');
  });

  /* ---------- Bewertung je Typ ---------- */
  fang('Bewertung', () => {
    for (const f of alleFragen) {
      const w = f.qid;
      switch (f.typ) {
        case 'luecke': {
          const L = Lerni.luecken(f.text).luecken;
          gleich(Bewerter.luecke(f, L.map((l) => l.a[0])).s, 1, w + ' richtig');
          gleich(Bewerter.luecke(f, L.map(() => '')).s, 0, w + ' leer');
          gleich(Bewerter.luecke(f, L.map(() => ''), L.map(() => true)).s, 1, w + ' doch richtig');
          break;
        }
        case 'mc': {
          const r = f.optionen.map((o, i) => o.r ? i : -1).filter((i) => i >= 0), falsch = f.optionen.map((o, i) => o.r ? -1 : i).filter((i) => i >= 0);
          gleich(Bewerter.mc(f, r).s, 1, w + ' alle richtigen');
          if (falsch.length) ok(Bewerter.mc(f, [falsch[0]]).s === 0, w + ' nur falsche');
          if (r.length > 1) ok(Bewerter.mc(f, [r[0]]).s > 0 && Bewerter.mc(f, [r[0]]).s < 1, w + ' teilweise');
          break;
        }
        case 'wf': gleich(Bewerter.wf(f, f.wahr).s, 1, w); gleich(Bewerter.wf(f, !f.wahr).s, 0, w + ' falsch'); break;
        case 'reihe': gleich(Bewerter.reihe(f, f.schritte.map((_, i) => i)).s, 1, w); ok(Bewerter.reihe(f, f.schritte.map((_, i) => i).reverse()).s < 1, w + ' umgedreht'); break;
        case 'paare': gleich(Bewerter.paare(f, f.paare.map((_, i) => i)).s, 1, w); ok(Bewerter.paare(f, f.paare.map((_, i) => (i + 1) % f.paare.length)).s === 0, w + ' verschoben'); break;
        case 'zahl': gleich(Bewerter.zahl(f, String(f.loesung).replace('.', ',')).s, 1, w); gleich(Bewerter.zahl(f, String(f.loesung + Lerni.toleranz(f) + 1)).s, 0, w + ' daneben'); break;
        case 'offen': gleich(Bewerter.offen(f, f.kernpunkte.length).s, 1, w); gleich(Bewerter.offen(f, 0).s, 0, w + ' nichts'); break;
      }
    }
  });

  /* ---------- Lernlogik ---------- */
  fang('Lernlogik', () => {
    const r = { box: 0 }, heute = U.dayNum();
    Lernlogik.planen(r, 1, false, null); gleich([r.box, r.due - heute], [1, 1], 'richtig: Fach 1, morgen');
    Lernlogik.planen(r, 1, false, null); gleich([r.box, r.due - heute], [2, 2], 'richtig: Fach 2');
    Lernlogik.planen(r, 1, true, null); gleich(r.box, 2, 'richtig unsicher: Fach bleibt');
    Lernlogik.planen(r, 0.5, false, null); gleich(r.box, 1, 'teilweise: ein Fach zurück');
    Lernlogik.planen(r, 0, false, null); gleich([r.box, r.due], [0, heute], 'falsch: heute nochmal');
    r.box = 6; Lernlogik.planen(r, 1, false, 3); gleich(r.due - heute, 3, 'Klausur-Kappe');
    gleich(Lernlogik.ergebnis(0.8), 'richtig', 'Grenze richtig'); gleich(Lernlogik.ergebnis(0.4), 'teilweise', 'Grenze teilweise'); gleich(Lernlogik.ergebnis(0.39), 'falsch', 'Grenze falsch');

    // Frischer Stand: Listen und Sitzungsplan
    Store.data = Store.defaults(); const k = App.kurs(), fr = k.alleFragen;
    gleich(Lernlogik.liste('neu', fr).length, fr.length, 'anfangs alles neu');
    const plan = Lernlogik.plan(k.id, 'heute');
    ok(plan.length > 0 && plan.length <= Math.min(Store.data.set.laenge, Store.data.set.neuProTag), 'Tagesplan begrenzt auf neue pro Tag');
    ok(plan.every((f) => f.stufe < 3) || fr.every((f) => f.stufe === 3), 'Lernpfad: keine offenen Fragen vor den leichteren');
    // Verlauf erzeugen: a immer richtig, b abwechselnd, c immer falsch, d richtig aber unsicher
    const [a, b, c, d] = fr;
    const ant = (f, s, u) => Store.antwort(f, s, u, 1000, 'l');
    for (let i = 0; i < 4; i++) { ant(a, 1, false); ant(b, i % 2, false); ant(c, 0, false); }
    ant(d, 1, true);
    const L = (id) => Lernlogik.liste(id, fr).map((f) => f.qid);
    ok(L('falsch').includes(c.qid) && !L('falsch').includes(a.qid), 'Liste zuletzt falsch');
    ok(L('wackelig').includes(b.qid) && !L('wackelig').includes(a.qid), 'Liste wackelig (abwechselnd)');
    ok(L('oftfalsch').includes(c.qid), 'Liste oft falsch');
    ok(L('glueck').includes(d.qid) && !L('glueck').includes(a.qid), 'Liste Glückstreffer');
    gleich(L('kritisch')[0], c.qid, 'kritischste zuerst: immer falsch');
    ok(!L('kritisch').includes(a.qid), 'immer richtig ist nicht kritisch');
    ok(Lernlogik.info(a).status === 'sitzt', 'viermal sicher richtig: sitzt (war ' + Lernlogik.info(a).status + ')');
    ok(L('faellig').includes(c.qid) && !L('faellig').includes(a.qid), 'fällig: falsche heute, richtige später');
    gleich(Lernlogik.heute().n, 13, 'Tageszähler');
    gleich(Lernlogik.serie(), 1, 'Serie heute');
    const z = Lernlogik.zaehlen(fr); gleich(Object.values(z.status).reduce((x, y) => x + y, 0), fr.length, 'Status summiert sich');
    // Sitzung: falsche kommt einmal wieder
    const s = new Sitzung([a, b], { modus: 'mix', titel: 't', kurs: k.id });
    s.erfassen(0, false); gleich(s.anzahl, 3, 'falsche Frage kommt wieder'); s.weiter(); s.erfassen(1, false); s.weiter(); gleich(s.aktuell, a, 'Wiedervorlage ist die falsche');
    s.erfassen(0, false); gleich(s.anzahl, 3, 'nur einmal Wiedervorlage'); gleich(s.zusammenfassung().n, 2, 'Ergebnis zählt erste Versuche');
  });

  /* ---------- Speicherstand, Sicherung, alte Stände ---------- */
  fang('Speicherstand', () => {
    const vorher = JSON.stringify(Store.data);
    const text = Store.exportText();
    Store.data = Store.defaults();
    const r = Store.importText(text);
    gleich(Store.data.q, JSON.parse(vorher).q, 'Sicherung hin und zurück');
    ok(r.antworten === Store.data.log.length, 'Import meldet Antworten');
    ok(Store.hatVorImport(), 'Stand vor Import gesichert');
    let fehler = ''; try { Store.importText('{"x":1}'); } catch (e) { fehler = e.message; } ok(/keine Lerni-Sicherung/.test(fehler), 'fremde Datei abgelehnt');
    try { Store.importText('kein json'); fehler = ''; } catch (e) { fehler = e.message; } ok(!!fehler, 'kaputte Datei abgelehnt');
    try { Store.importText(JSON.stringify({ app: 'lerni', schema: 999, daten: { q: {}, set: {} } })); fehler = ''; } catch (e) { fehler = e.message; } ok(/neueren/.test(fehler), 'neueres Format abgelehnt');
    const alt = Store.pruefeUndErgaenze({ q: { 'demo:x': { h: [], n: 0 } }, set: { ziel: 30 } });
    ok(alt.set.ziel === 30 && alt.set.laenge === 15 && Array.isArray(alt.log) && alt.tage && alt.sich, 'alter Stand wird ergänzt');
    ok(Store.pruefeUndErgaenze(null).schema === SCHEMA && Store.pruefeUndErgaenze('Unsinn').q, 'leerer Stand');
  });

  /* ---------- Oberfläche: jede Frage über die echte Seite richtig beantworten ---------- */
  const klick = (x) => { if (!x) throw new Error('Element fehlt'); x.click(); };
  const $ = (s) => App.view.querySelector(s), $$ = (s) => [...App.view.querySelectorAll(s)];
  const txt = (e) => e.textContent.replace(/\s+/g, ' ').trim();
  const plainT = (s) => U.plain(s).replace(/\s+/g, ' ').trim();
  const setze = (inp, v) => { inp.value = v; inp.dispatchEvent(new Event(inp.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
  function beantworte(f) {
    switch (f.typ) {
      case 'mc': $$('.opt').forEach((b) => { const o = f.optionen.find((x) => plainT(x.t) === txt(b.querySelector('.ot'))); if (o && o.r) klick(b); }); break;
      case 'wf': klick($$('.opt').find((b) => txt(b) === (f.wahr ? 'Wahr' : 'Falsch'))); break;
      case 'luecke': $$('.gap').forEach((inp, i) => setze(inp, Lerni.luecken(f.text).luecken[i].a[0])); break;
      case 'reihe': f.schritte.forEach((s) => klick($$('.rpool .rchip').find((b) => txt(b) === plainT(s)))); break;
      case 'paare': {
        const L = $$('.pcol:first-child .pz'), R = $$('.pcol:last-child .pz');
        f.paare.forEach((p, i) => { klick(L[i]); if (!L[i].classList.contains('sel')) klick(L[i]); klick(R.find((b) => txt(b).replace(/^\d+/, '') === plainT(p[1]))); });
        break;
      }
      case 'zahl': setze($('.num'), String(f.loesung).replace('.', ',')); break;
      case 'karte': klick([...App.view.querySelectorAll('button')].find((b) => txt(b) === 'Umdrehen')); klick($$('.sb.ok')[0]); return;
      case 'offen': klick([...App.view.querySelectorAll('button')].find((b) => txt(b) === 'Lösung zeigen')); klick([...App.view.querySelectorAll('.kpbox .btn')].find((b) => txt(b) === 'Alles')); klick($('.kpbox > .btn.primary')); return;
    }
    const p = $('#pruefen'); ok(p && !p.disabled, f.qid + ': Prüfen nicht bereit'); klick(p);
    ok(!!$('.rueck.richtig'), f.qid + ': Rückmeldung nicht „richtig“ (' + (($('.rueck') || {}).className || 'keine') + ')');
    klick($('#weiter'));
  }
  fang('Oberfläche Fragen', () => {
    Store.data = Store.defaults();
    for (const f of alleFragen) {
      fang('Frage ' + f.qid, () => {
        App.stapel = []; App.oeffne(App.lernSeite, new Sitzung([f], { modus: 'fragen', titel: 'Test', kurs: f.kurs }));
        for (const b of Lerni.bilder(f.bild)) ok(!!App.view.querySelector('.frage-k figure.grafik[data-grafik="' + b + '"] svg'), f.qid + ': Skizze ' + b + ' fehlt bei der Frage');
        beantworte(f);
        const r = Store.rec(f.qid);
        ok(r && r.n === 1 && r.h[0][1] === 100, f.qid + ' (' + f.typ + '): über die Oberfläche nicht als richtig gespeichert (' + JSON.stringify(r && r.h) + ')');
        ok(!!App.view.querySelector('.ergebnis'), f.qid + ': Ergebnisseite fehlt');
      });
    }
    // Falsch beantworten: Wiedervorlage in der Runde
    const f = alleFragen.find((x) => x.typ === 'wf');
    App.stapel = []; App.oeffne(App.lernSeite, new Sitzung([f], { modus: 'fragen', titel: 'Test', kurs: f.kurs }));
    klick($$('.opt').find((b) => txt(b) === (f.wahr ? 'Falsch' : 'Wahr'))); klick($('#pruefen'));
    ok(!!$('.rueck.falsch'), 'falsche Antwort wird als falsch gezeigt'); klick($('#weiter'));
    ok(/2 \/ 2/.test(txt($('.kopf h1'))), 'falsche Frage kommt in der Runde wieder');
  });

  /* ---------- Skizzen (Lerni.grafik): jede im Skript bzw. in der Lösung sichtbar ---------- */
  fang('Skizzen', () => {
    const genutzt = new Set();
    for (const k of Lerni.kurse) for (const e of k.einheitenListe) {
      const soll = [].concat(...(e.skript || []).map((s) => Lerni.bilder(s.bild)));
      if (!soll.length) continue;
      const vorher = Store.data.set.kurs; Store.data.set.kurs = k.id;
      App.stapel = []; App.oeffne(App.einheit, e.id);
      for (const b of soll) { genutzt.add(k.id + ':' + b); ok(!!App.view.querySelector('details.skript figure.grafik[data-grafik="' + b + '"] svg'), 'Einheit ' + e.id + ': Skizze ' + b + ' fehlt im Skript'); }
      Store.data.set.kurs = vorher;
    }
    for (const f of alleFragen) {
      for (const b of Lerni.bilder(f.bild).concat(Lerni.bilder(f.bildLoesung))) genutzt.add(f.kurs + ':' + b);
      if (f.bildLoesung) ok(loesungHtml(f).includes('data-grafik="' + Lerni.bilder(f.bildLoesung)[0] + '"'), f.qid + ': Skizze fehlt in der Lösung');
    }
    for (const key of Object.keys(Lerni.grafiken)) ok(genutzt.has(key), 'Skizze ' + key + ' wird nirgends verwendet');
    // Antippen vergrößert, Schließen räumt auf
    const fig = App.view.querySelector('figure.grafik');
    if (fig) { fig.click(); const L = document.querySelector('.glupe'); ok(!!(L && L.querySelector('svg')), 'Lupe öffnet die Skizze'); if (L) L.click(); ok(!document.querySelector('.glupe'), 'Lupe schließt'); }
  });

  /* ---------- Oberfläche: alle Seiten ---------- */
  fang('Oberfläche Seiten', () => {
    const k = App.kurs();
    const seiten = [
      ['Start', () => App.tab('lernen')], ['Logbuch', () => App.tab('logbuch')], ['Einstellungen', () => App.tab('einst')],
      ['Logbuch Fragen', () => App.ersetze(App.logbuch, 'fragen', 'alle')], ['Logbuch Verlauf', () => App.ersetze(App.logbuch, 'verlauf')],
      ...LISTEN.filter((l) => l.id !== 'faellig').map((l) => ['Filter ' + l.id, () => App.ersetze(App.logbuch, 'fragen', l.id)]),
      ...k.einheitenListe.map((e) => ['Einheit ' + e.id, () => App.oeffne(App.einheit, e.id)]),
      ...alleFragen.slice(0, 6).map((f) => ['Details ' + f.qid, () => App.oeffne(App.frageDetail, f.qid)]),
      ['Klausur-Start', () => App.oeffne(App.klausurStart)], ['Kurswahl', () => App.oeffne(App.kursWahl)],
    ];
    for (const [name, fn] of seiten) fang('Seite ' + name, () => { fn(); ok(!!App.view.querySelector('.kopf h1'), 'Seite ' + name + ' ohne Titel'); });
    // Startseite: Knöpfe starten Runden
    App.tab('lernen');
    ok(!!document.getElementById('startHeute') || !!App.view.querySelector('.fertig'), 'Start: Lernen-Knopf oder „erledigt“');
    ok(App.view.querySelectorAll('.kachel').length >= 10, 'Start: Kacheln');
    App.tab('lernen'); klick(document.getElementById('k_mix')); klick(document.getElementById('mixLos')); ok(!!App.view.querySelector('.frage-k'), 'Kachel „Mix“ startet Runde');
    App.tab('lernen'); klick(document.getElementById('k_top')); ok(!!App.view.querySelector('.frage-k'), 'Kachel „Top 60“ startet Runde');
    App.tab('lernen'); klick(document.getElementById('k_zufall')); klick(document.getElementById('mixLos')); ok(!!App.view.querySelector('.frage-k'), 'Kachel „Zufallsfragen“ startet Runde');
    { const kk = Lerni.kurse[0], t = Lernlogik.plan(kk.id, 'top'), m = Lernlogik.plan(kk.id, 'mix', { einheiten: [kk.einheitenListe[0].id], n: 10 }), z = Lernlogik.plan(kk.id, 'mix', { n: 25 });
      ok(t.length === Math.min(60, kk.alleFragen.length) && new Set(t).size === t.length, 'Top 60: 60 verschiedene Fragen');
      ok(m.length > 0 && m.length <= 10 && m.every((f) => f.einheit === kk.einheitenListe[0].id), 'Mix: nur gewählte Einheit, höchstens n');
      ok(z.length === Math.min(25, kk.alleFragen.length), 'Zufall: 25 Fragen'); }
    // Klausur-Simulation (nur offene Fragen) einmal ganz durch
    App.tab('lernen'); App._kcfg.modus = 'offen'; App.oeffne(App.klausurStart); klick(document.getElementById('klausurLos'));
    const K = App.klausurOffen(); ok(K && K.qids.length > 0 && !K.modus, 'Klausur angelegt');
    const ta = App.view.querySelector('textarea'); setze(ta, 'Testantwort');
    App.ersetze(App.klausurAuswertung, Object.assign(K, { antworten: ['Testantwort'], abgegeben: true, tEnde: Date.now(), ri: 0 }));
    for (let i = 0; i < K.qids.length && document.getElementById('kWeiter'); i++) klick(document.getElementById('kWeiter'));
    ok(/Klausur-Ergebnis/.test(txt(App.view.querySelector('.kopf h1'))), 'Klausur-Ergebnis erreicht');
    ok(!App.klausurOffen(), 'Klausur nach Ergebnis abgeschlossen');
    App._kcfg.modus = null;
    App.tab('lernen');
  });

  /* ---------- Vollklausur: Auswahl, Zeit, Bewertung, Neustart ---------- */
  fang('Vollklausur', () => {
    const k = App.kurs(), offenPool = k.alleFragen.filter((f) => f.typ === 'offen'), mcPool = k.alleFragen.filter((f) => f.typ === 'mc');
    if (!offenPool.length || !mcPool.length) return;
    Store.data = Store.defaults(); localStorage.removeItem('lerni.klausur');
    const einheitenMit = new Set(offenPool.concat(mcPool).map((f) => f.einheit));
    for (let t = 0; t < 20; t++) {
      const w = App._kVollWahl(offenPool, mcPool, ['kritisch', 'neu', 'zufall'][t % 3]), alle = w.offen.concat(w.mc);
      gleich([w.offen.length, w.mc.length], [Math.min(8, offenPool.length), Math.min(10, mcPool.length)], 'Vollklausur: 8 offene + 10 MC');
      const summe = w.offen.reduce((a, f) => a + (f.punkte || 2), 0);
      ok(offenPool.length < 8 || Math.abs(summe - 20) <= 1, 'Vollklausur: offene Fragen ergeben etwa 20 Punkte (war ' + summe + ')');
      ok(new Set(alle.map((f) => f.einheit)).size >= Math.min(einheitenMit.size, alle.length), 'Vollklausur: Themenabdeckung (' + new Set(alle.map((f) => f.einheit)).size + ' von ' + einheitenMit.size + ' Einheiten)');
      ok(new Set(alle).size === alle.length, 'Vollklausur: keine Frage doppelt');
    }
    // über die Oberfläche anlegen
    App.stapel = []; Object.assign(App._kcfg, { modus: 'voll', aus: null, vollMin: 45, wahl: 'kritisch' });
    App.oeffne(App.klausurStart); ok(/30/.test(txt(App.view)) && /15/.test(txt(App.view)), 'Start zeigt 30 Punkte / Bestehen ab 15');
    klick(document.getElementById('klausurLos'));
    let K = App.klausurOffen();
    ok(K && K.modus === 'voll' && K.dauer === 45 * 60000 && K.qids.length === 18, 'Vollklausur angelegt: 18 Aufgaben, 45 min');
    const fr = K.qids.map((q) => Lerni.fragen[q]), iMc = fr.findIndex((f) => f.typ === 'mc'), nOff = fr.filter((f) => f.typ !== 'mc').length;
    gleich(iMc, nOff, 'Vollklausur: erst offene Fragen, dann Multiple Choice');
    setze(App.view.querySelector('textarea'), 'Meine Antwort');
    klick($$('.knav .kn')[iMc]);
    const f0 = fr[iMc], nR = f0.optionen.filter((o) => o.r).length;
    ok(!App.view.querySelector('.opt .warum') && !$$('.opt').some((b) => /\bok\b|\bbad\b/.test(b.className)), 'MC in der Klausur ohne Lösungshinweise');
    $$('.opt').forEach((b) => { const o = f0.optionen.find((x) => plainT(x.t) === txt(b.querySelector('.ot'))); if (o && o.r) klick(b); });
    K = App.klausurOffen();
    gleich((K.antworten[iMc] || []).length, nR, 'MC-Kreuze gespeichert');
    gleich(K.antworten[0], 'Meine Antwort', 'Antwort der offenen Frage nach Seitenwechsel gespeichert');
    App.ersetze(App.klausurLauf, App.klausurOffen());                 // wie nach einem App-Neustart
    gleich($$('.opt[aria-pressed="true"]').length, nR, 'MC-Kreuze nach Neustart sichtbar');
    // restliche MC richtig ankreuzen, Zeit ablaufen lassen → automatische Abgabe
    K = App.klausurOffen();
    fr.forEach((f, i) => { if (f.typ === 'mc' && i !== iMc) K.antworten[i] = f.optionen.map((o, j) => (o.r ? j : -1)).filter((j) => j >= 0); });
    K.t0 = Date.now() - 46 * 60000; App._kSpeichern(K);
    App.ersetze(App.klausurLauf, K);
    ok(K.abgegeben === true, 'Zeit abgelaufen: Abgabe ausgelöst');
    App.ersetze(App.klausurAuswertung, K);                                  // räumt den Abgabe-Timer auf
    ok(K.mcGewertet && fr.every((f, i) => f.typ !== 'mc' || K.bewertung[i] === 1), 'MC automatisch bewertet');
    const vorher = Store.data.log.length;
    App.ersetze(App.klausurAuswertung, K);
    gleich(Store.data.log.length, vorher, 'MC nur einmal ins Logbuch');
    // erste offene Frage: alle Kernpunkte abhaken, Rest ohne
    $$('.kps .kp').forEach((b) => klick(b));
    ok(/· \d+(,5)? P\./.test(txt(document.getElementById('kWeiter'))), 'Punkteanzeige in der Auswertung');
    for (let i = 0; i < 18 && document.getElementById('kWeiter'); i++) klick(document.getElementById('kWeiter'));
    const max = fr.reduce((a, f) => a + (f.typ === 'mc' ? 1 : f.punkte || 2), 0), soll = fr.filter((f) => f.typ === 'mc').length + (fr[0].punkte || 2);
    gleich(txt(document.getElementById('kGesamt')), U.fmtNum(soll) + ' von ' + U.fmtNum(max) + ' Punkten', 'Vollklausur: Gesamtpunkte');
    ok(/bestanden/i.test(txt(App.view)) && !!document.getElementById('kEinheiten'), 'Ergebnis mit Bestehensgrenze und Einheiten');
    const S = Store.data.sitzungen[Store.data.sitzungen.length - 1];
    ok(S && S.titel === 'Vollklausur' && S.p === soll && S.pmax === max, 'Vollklausur im Logbuch (Punkte)');
    ok(!App.klausurOffen(), 'Vollklausur abgeschlossen');
    App.ersetze(App.logbuch, 'verlauf'); ok(/P\./.test(txt(App.view)), 'Logbuch-Verlauf zeigt Klausurpunkte');
    // Rundung: halbe Punkte
    gleich(App._kPunkte({ modus: 'voll' }, { typ: 'offen', punkte: 3 }, 1 / 3), 1, 'Rundung auf 0,5 (1 von 3)');
    gleich(App._kPunkte({ modus: 'voll' }, { typ: 'offen', punkte: 3 }, 0.5), 1.5, 'Rundung auf 0,5 (1,5 von 3)');
    gleich(App._kPunkte({ modus: 'voll' }, { typ: 'mc' }, 0.5), 0.5, 'MC-Teilpunkte');
    // alter Stand ohne modus läuft als Simulation weiter
    App.ersetze(App.klausurLauf, { qids: [offenPool[0].qid], antworten: ['x'], i: 0, t0: Date.now(), dauer: 0, kurs: k.id, abgegeben: false, bewertung: [], ri: 0 });
    ok(/Klausur-Simulation/.test(txt(App.view.querySelector('.kopf'))) && !!App.view.querySelector('textarea'), 'Alter Klausurstand ohne modus läuft weiter');
    Object.assign(App._kcfg, { modus: null });
    App.tab('lernen'); localStorage.removeItem('lerni.klausur');
  });

  /* ---------- Aufräumen, Ergebnis ---------- */
  window.removeEventListener('error', onErr); window.removeEventListener('unhandledrejection', onErr);
  Store.data = JSON.parse(altStand); Store.save();
  const zurueck = (key, v) => { if (v == null) localStorage.removeItem(key); else localStorage.setItem(key, v); };
  zurueck('lerni.klausur', altKlausur); zurueck('lerni.vorImport', altVorImport);
  App.tab('lernen');
  const res = { ok: !fails.length && !errors.length, fails, errors, n, ms: Math.round(performance.now() - t0) };
  window.lerniTest = res;
  const zeilen = ['LERNI Selbsttest: ' + (res.ok ? 'alles in Ordnung' : 'PROBLEME') + ' · ' + n + ' Prüfungen · ' + res.ms + ' ms'].concat(errors.map((e) => 'FEHLER ' + e), fails.map((f) => 'NICHT ERFÜLLT ' + f));
  console[res.ok ? 'log' : 'error'](zeilen.join('\n'));
  const box = document.createElement('pre');
  box.id = 'selftest';
  box.style.cssText = 'position:fixed;left:8px;right:8px;top:calc(env(safe-area-inset-top) + 8px);z-index:99;max-height:60vh;overflow:auto;padding:12px;border-radius:12px;font:12px/1.4 ui-monospace,monospace;white-space:pre-wrap;background:' + (res.ok ? '#e4f5ea' : '#fde7e7') + ';color:#111';
  box.textContent = zeilen.join('\n') + '\n\n(Tippen zum Schließen)';
  box.onclick = () => box.remove();
  document.body.appendChild(box);
})();
