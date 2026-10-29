/* =====================================================================
   Fördermittelkompass Thüringen – Programmlogik der Website
   Seiten (über die Adresse nach dem #):
     #/                Suche
     #/anmelden        Anmeldung per E-Mail-Link
     #/profil          Organisationsprofil
     #/projekte        Projekte inkl. Fördermittelwecker
     #/merkliste       gemerkte Programme mit Status und Notizen
     #/vergleich?ids=  Programme nebeneinander
     #/programm/ID     Programmdetails
     #/assistent/ID    Antragsassistent (?projekt=…, ?antrag=…)
     #/antraege        gespeicherte Antragsentwürfe
     #/impressum, #/datenschutz
   ===================================================================== */
(function () {
  "use strict";

  const E = window.EINSTELLUNGEN || {};
  const kamVomAnmeldelink = /access_token=/.test(location.hash);
  const sb = window.supabase.createClient(E.SUPABASE_URL, E.SUPABASE_KEY, {
    auth: { flowType: "implicit", detectSessionInUrl: true, persistSession: true },
  });

  // ------------------------------------------------------------------
  // Zustand
  // ------------------------------------------------------------------
  const zustand = {
    sitzung: null,
    organisation: null,
    projekte: [],
    merkliste: [],           // Einträge {id, programm_id, projekt_id, status, …}
    zielgruppen: [
      ["privatpersonen", "Private Haushalte & Privatpersonen"],
      ["gruendung", "Gründer:innen & Start-ups"],
      ["unternehmen", "Unternehmen & Mittelstand"],
      ["kommunen", "Kommunen"],
      ["oeffentlich", "Öffentliche Einrichtungen"],
      ["vereine", "Vereine & Verbände"],
      ["forschung", "Hochschulen & Forschung"],
      ["bildung", "Bildungseinrichtungen"],
      ["landwirtschaft", "Land- & Forstwirtschaft"],
    ],
    letzteSuche: null,       // {anfrage, daten} – bleibt beim Seitenwechsel erhalten
    suchnummer: 0,
  };

  const EBENE = { land: "Land Thüringen", bund: "Bund", eu: "Europäische Union", kommune: "Region in Thüringen", sonstige: "" };
  const STUFEN = [
    ["passt", "Passt gut"],
    ["passt_teilweise", "Passt möglicherweise"],
    ["unbewertet", "Gefundene Programme"],
    ["passt_nicht", "Passt eher nicht"],
  ];
  const MERK_STATUS = [
    ["interessant", "Interessant"],
    ["pruefen", "Wird geprüft"],
    ["in_vorbereitung", "Antrag in Vorbereitung"],
    ["beantragt", "Beantragt"],
    ["bewilligt", "Bewilligt"],
    ["abgelehnt", "Abgelehnt / verworfen"],
  ];
  const RECHTSFORMEN = ["Privatperson", "Einzelunternehmen", "GbR", "GmbH / UG", "gGmbH", "eingetragener Verein (e. V.)",
    "Stiftung", "Genossenschaft (eG)", "Kommune / Gebietskörperschaft", "Andere öffentliche Einrichtung", "Sonstige"];
  const GROESSEN = ["keine", "unter 10", "10–49", "50–249", "250 und mehr"];
  const LANDKREISE = ["Altenburger Land", "Eichsfeld", "Gotha", "Greiz", "Hildburghausen", "Ilm-Kreis",
    "Kyffhäuserkreis", "Nordhausen", "Saale-Holzland-Kreis", "Saale-Orla-Kreis", "Saalfeld-Rudolstadt",
    "Schmalkalden-Meiningen", "Sömmerda", "Sonneberg", "Unstrut-Hainich-Kreis", "Wartburgkreis", "Weimarer Land",
    "Stadt Erfurt", "Stadt Gera", "Stadt Jena", "Stadt Suhl", "Stadt Weimar", "Stadt Eisenach"];

  const NADEL = '<svg class="nadel" viewBox="0 0 34 34" aria-hidden="true"><circle cx="17" cy="17" r="15" fill="none" stroke="#1d3a31" stroke-width="1.6"/><g><path d="M17 5 L20.5 17 L17 29 L13.5 17 Z" fill="#1d3a31"/><path d="M17 5 L20.5 17 L13.5 17 Z" fill="#2c7a4c"/></g></svg>';

  // ------------------------------------------------------------------
  // Hilfsfunktionen
  // ------------------------------------------------------------------
  const $ = (s, w = document) => w.querySelector(s);
  function el(tag, attrs = {}, ...kinder) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === "class") e.className = v;
      else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
      else if (k === "value") e.value = v;
      else if (v === true) e.setAttribute(k, "");
      else e.setAttribute(k, v);
    }
    for (const k of kinder.flat()) if (k !== null && k !== undefined && k !== false && k !== "") e.append(k);
    return e;
  }
  function saeubern(t) {
    if (!t) return "";
    const d = document.createElement("div");
    d.innerHTML = String(t).replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|li|h\d)>/gi, "\n");
    return (d.textContent || "").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
  }
  function kuerzen(t, n) { t = saeubern(t); return t.length > n ? t.slice(0, n - 1) + "…" : t; }
  function datum(t) { try { return new Date(t).toLocaleDateString("de-DE"); } catch { return ""; } }
  function gruppenName(slug) { return (zustand.zielgruppen.find((z) => z[0] === slug) || [])[1] || ""; }
  function angemeldet() { return Boolean(zustand.sitzung); }
  function seitenkopf(titel, text) {
    return el("div", { class: "seitenkopf" }, el("h1", { class: "klein" }, titel), text ? el("p", {}, text) : null);
  }
  function meldung(text, art = "") { return el("div", { class: "meldung " + art, role: art === "fehler" ? "alert" : null }, el("p", {}, text)); }
  function ladeanzeige(text) {
    const d = el("div", { class: "status" }); d.innerHTML = NADEL; d.append(el("span", {}, text)); return d;
  }
  function anmeldenHinweis(text) {
    return el("div", { class: "meldung hinweis" },
      el("p", {}, text), el("p", {}, el("a", { href: "#/anmelden" }, "Jetzt anmelden oder Konto anlegen")));
  }
  function fehlertext(f) {
    const m = (f && f.message) || String(f || "");
    if (/Failed to fetch|NetworkError/i.test(m)) return "Der Kompass ist gerade nicht erreichbar. Prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.";
    return m || "Etwas ist schiefgegangen. Bitte versuchen Sie es erneut.";
  }

  async function funktion(name, daten) {
    const token = zustand.sitzung ? zustand.sitzung.access_token : E.SUPABASE_KEY;
    const r = await fetch(`${E.SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: { apikey: E.SUPABASE_KEY, Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify(daten),
    });
    const antwort = await r.json().catch(() => ({}));
    if (!r.ok) {
      const f = new Error(antwort.fehler || "Etwas ist schiefgegangen. Bitte versuchen Sie es erneut.");
      f.code = antwort.code || "";
      throw f;
    }
    return antwort;
  }

  function profilText() {
    const o = zustand.organisation;
    if (!o) return "";
    return [o.name && `Name: ${o.name}`, o.rechtsform && `Rechtsform: ${o.rechtsform}`,
      o.mitarbeitende && `Mitarbeitende: ${o.mitarbeitende}`, o.gruendungsjahr && `Gegründet: ${o.gruendungsjahr}`,
      o.taetigkeitsfeld && `Tätigkeitsfeld: ${o.taetigkeitsfeld}`, o.beschreibung && `Über uns: ${o.beschreibung}`]
      .filter(Boolean).join(". ");
  }

  // ------------------------------------------------------------------
  // Daten laden
  // ------------------------------------------------------------------
  async function zielgruppenLaden() {
    try {
      const { data } = await sb.from("zielgruppen").select("slug,bezeichnung").order("reihenfolge");
      if (data && data.length) zustand.zielgruppen = data.map((d) => [d.slug, d.bezeichnung]);
    } catch (_) { /* Standardliste bleibt */ }
  }
  async function kontoLaden() {
    if (!angemeldet()) { zustand.organisation = null; zustand.projekte = []; zustand.merkliste = []; return; }
    const [o, p, m] = await Promise.all([
      sb.from("organisationen").select("*").maybeSingle(),
      sb.from("projekte").select("id,titel,beschreibung,kosten_euro,beginn,wecker_aktiv,erstellt_am,aktualisiert_am").order("erstellt_am", { ascending: false }),
      sb.from("merkliste").select("id,programm_id,projekt_id,status,notiz,einstufung,begruendung,aktualisiert_am"),
    ]);
    zustand.organisation = o.data || null;
    zustand.projekte = p.data || [];
    zustand.merkliste = m.data || [];
  }
  function gemerkt(programmId, projektId) {
    return zustand.merkliste.find((m) => m.programm_id === programmId && (m.projekt_id || null) === (projektId || null));
  }

  // ------------------------------------------------------------------
  // Navigation
  // ------------------------------------------------------------------
  function menueZeigen(aktuell) {
    const ul = $("#menue");
    if (angemeldet()) {
      ul.replaceChildren(
        el("li", { class: "konto" }, zustand.sitzung.user.email),
        el("li", {}, el("a", { href: "#/abmelden" }, "Abmelden")));
      return;
    }
    const punkte = [["#/", "Start"], ["#/start", "Förderung finden"], ["#/suche", "Freie Suche"]];
    ul.replaceChildren(...punkte.map(([href, text]) =>
      el("li", {}, el("a", { href, "aria-current": aktuell === href ? "page" : null }, text))));
    ul.append(el("li", {}, el("a", { class: "anmelden", href: "#/anmelden", "aria-current": aktuell === "#/anmelden" ? "page" : null }, "Anmelden")));
  }

  function seitenleiste(aktuell) {
    const offen = zustand.projekte.length;
    const gemerktZahl = zustand.merkliste.length;
    const punkte = [
      ["#/arbeitsbereich", "Übersicht", null, ["#/", "#/arbeitsbereich"]],
      ["#/start", "Förderung finden", null, ["#/start"]],
      ["#/projekte", "Projekte", offen, ["#/projekte", "#/projekt"]],
      ["#/merkliste", "Merkliste", gemerktZahl, ["#/merkliste", "#/vergleich"]],
      ["#/antraege", "Anträge", null, ["#/antraege", "#/assistent"]],
      ["#/suche", "Freie Suche", null, ["#/suche"]],
      ["#/profil", "Profil", null, ["#/profil"]],
    ];
    return el("nav", { class: "seitenleiste", "aria-label": "Arbeitsbereich" },
      el("ul", {}, punkte.map(([href, text, zahl, pfade]) =>
        el("li", {}, el("a", { href, "aria-current": pfade.includes(aktuell) ? "page" : null },
          el("span", {}, text), zahl ? el("span", { class: "zaehler" }, String(zahl)) : null)))));
  }

  function route() {
    const h = location.hash || "#/";
    if (/access_token=|error_description=/.test(h)) return { pfad: "#/warten", teile: [], params: new URLSearchParams() };
    const [pfad, query] = h.split("?");
    const teile = pfad.replace(/^#\/?/, "").split("/").filter(Boolean);
    return { pfad: "#/" + (teile[0] || ""), teile, params: new URLSearchParams(query || "") };
  }

  async function zeigen() {
    const r = route();
    const main = $("#inhalt");
    menueZeigen(r.pfad);
    const seiten = {
      "#/": angemeldet() ? seiteArbeitsbereich : seiteLanding, "#/start": seiteEinstieg, "#/suche": seiteSuche,
      "#/arbeitsbereich": seiteArbeitsbereich, "#/projekt": seiteProjekt,
      "#/anmelden": seiteAnmelden, "#/abmelden": seiteAbmelden, "#/profil": seiteProfil,
      "#/projekte": seiteProjekte, "#/merkliste": seiteMerkliste, "#/vergleich": seiteVergleich,
      "#/programm": seiteProgramm, "#/assistent": seiteAssistent, "#/antraege": seiteAntraege,
      "#/impressum": seiteImpressum, "#/datenschutz": seiteDatenschutz, "#/warten": seiteWarten,
    };
    const seite = seiten[r.pfad] || (angemeldet() ? seiteArbeitsbereich : seiteLanding);
    main.replaceChildren();
    let ziel = main;
    const mitLeiste = angemeldet() && !["#/anmelden", "#/warten", "#/abmelden"].includes(r.pfad);
    main.classList.toggle("mit-leiste", mitLeiste);
    document.body.classList.toggle("angemeldet", mitLeiste);
    if (mitLeiste) {
      ziel = el("div", { class: "app-inhalt" });
      main.append(seitenleiste(r.pfad), ziel);
    }
    try {
      await seite(ziel, r);
    } catch (f) {
      console.error(f);
      ziel.replaceChildren(el("div", { class: "seite" }, seitenkopf("Das hat nicht geklappt"), meldung(fehlertext(f), "fehler")));
    }
    window.scrollTo(0, 0);
  }

  // ------------------------------------------------------------------
  // Programmkarte (Suche, Merkliste)
  // ------------------------------------------------------------------
  function karte(p, { projektId = null, mitAktionen = true } = {}) {
    const herkunft = [EBENE[p.ebene], p.foerdergeber].filter(Boolean).join(", ");
    const arten = (p.foerderart || []).length
      ? el("ul", { class: "arten", "aria-label": "Förderart" }, (p.foerderart || []).map((a) => el("li", {}, a)))
      : null;
    const fuss = el("div", { class: "kartenfuss" });
    if (mitAktionen) {
      const knopf = el("button", { type: "button", class: "neben" });
      const aktualisieren = () => {
        const ist = gemerkt(p.id, projektId);
        knopf.textContent = ist ? "Gemerkt" : "Merken";
        knopf.setAttribute("aria-pressed", ist ? "true" : "false");
      };
      aktualisieren();
      knopf.addEventListener("click", async () => {
        if (!angemeldet()) { location.hash = "#/anmelden"; return; }
        knopf.disabled = true;
        try {
          const ist = gemerkt(p.id, projektId);
          if (ist) {
            await sb.from("merkliste").delete().eq("id", ist.id).throwOnError();
            zustand.merkliste = zustand.merkliste.filter((m) => m.id !== ist.id);
          } else {
            const { data } = await sb.from("merkliste").insert({
              programm_id: p.id, projekt_id: projektId, einstufung: p.einstufung || null, begruendung: p.begruendung || null,
            }).select().single().throwOnError();
            zustand.merkliste.push(data);
          }
        } catch (f) { alertFrei(knopf, fehlertext(f)); }
        knopf.disabled = false;
        aktualisieren();
      });
      fuss.append(knopf);
      const assistLink = "#/assistent/" + p.id + (projektId ? "?projekt=" + projektId : "");
      fuss.append(el("a", { class: "knopf neben", href: assistLink }, "Antrag vorbereiten"));
    }
    if (p.link) fuss.append(el("a", { class: "original", href: p.link, target: "_blank", rel: "noopener" }, "Beim Fördergeber ansehen"));

    return el("article", { class: "programm " + (p.einstufung || "") },
      el("div", { class: "kartenkopf" },
        el("h4", {}, el("a", { href: "#/programm/" + p.id }, p.titel)),
        passungAnzeige(p.punkte)),
      herkunft ? el("p", { class: "herkunft" }, herkunft) : null,
      arten,
      p.begruendung ? el("p", { class: "begruendung" }, p.begruendung) : el("p", { class: "kurz" }, kuerzen(p.kurztext, 320)),
      p.offene_fragen ? el("p", { class: "offen" }, el("strong", {}, "Noch zu klären: "), p.offene_fragen) : null,
      p.fristen ? el("p", { class: "frist" }, el("strong", {}, "Frist: "), kuerzen(p.fristen, 200)) : null,
      fuss);
  }
  function passungAnzeige(punkte) {
    if (punkte === null || punkte === undefined) return null;
    const stufe = punkte >= 70 ? "hoch" : punkte >= 40 ? "mittel" : "niedrig";
    return el("div", { class: "passung " + stufe, title: "Passung zu Ihrem Vorhaben" },
      el("span", { class: "passung-zahl" }, `${punkte} %`),
      el("span", { class: "passung-balken", "aria-hidden": "true" }, el("span", { style: `width:${punkte}%` })),
      el("span", { class: "versteckt" }, " Passung"));
  }
  function alertFrei(nach, text) {
    const f = el("p", { class: "formfehler", role: "alert" }, text);
    nach.after(f);
    setTimeout(() => f.remove(), 6000);
  }

  // ------------------------------------------------------------------
  // Seite: Suche
  // ------------------------------------------------------------------
  async function seiteSuche(main, r) {
    const kopf = el("header", { class: "kopf" });
    kopf.innerHTML = `<svg class="hoehenlinien" viewBox="0 0 800 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g fill="none" stroke="#1d3a31" stroke-opacity=".09" stroke-width="1.4"><path d="M-20 250 C 120 200, 220 230, 330 170 S 560 90, 820 140"/><path d="M-20 222 C 110 176, 230 204, 340 146 S 560 66, 820 112"/><path d="M-20 194 C 100 152, 240 178, 350 122 S 565 44, 820 86"/><path d="M-20 166 C 95 130, 250 152, 362 100 S 570 26, 820 62"/><path d="M-20 138 C 90 108, 262 126, 376 80 S 578 12, 820 40"/><path d="M-20 110 C 88 88, 276 102, 392 62 S 590 2, 820 20"/><path d="M480 300 C 520 260, 600 250, 650 270 S 760 300, 820 280"/></g></svg>`;
    kopf.append(el("div", { class: "seite" },
      el("h1", {}, "Freie Suche"),
      el("p", { class: "einleitung" }, "Beschreiben Sie in eigenen Worten, was Sie vorhaben. Der Kompass prüft alle Förderprogramme des Landes Thüringen, des Bundes, der EU und der LEADER-Regionen. Lieber Schritt für Schritt? ",
        el("a", { href: "#/start" }, "Zum geführten Einstieg"))));
    main.append(kopf);

    const seite = el("div", { class: "seite" });
    main.append(seite);
    const o = zustand.organisation;

    // Projektauswahl für angemeldete Personen
    let projektWahl = null;
    if (angemeldet() && zustand.projekte.length) {
      projektWahl = el("select", { id: "projektwahl" },
        el("option", { value: "" }, "Ohne Projekt suchen"),
        zustand.projekte.map((p) => el("option", { value: p.id }, p.titel)));
    }

    const gruppen = el("div", { class: "gruppen", role: "radiogroup", "aria-labelledby": "gruppen-titel" });
    const alle = [...zustand.zielgruppen, ["", "Weiß ich nicht / Sonstige"]];
    alle.forEach(([slug, name], i) => {
      const id = "g" + i;
      const input = el("input", { type: "radio", name: "zielgruppe", id, value: slug, "data-name": name });
      input.checked = o && o.zielgruppe ? o.zielgruppe === slug : i === alle.length - 1;
      gruppen.append(input, el("label", { for: id }, name));
    });

    const vorhaben = el("textarea", { id: "vorhaben", maxlength: "2000", "aria-describedby": "vorhaben-hilfe",
      placeholder: "Zum Beispiel: Unser Sportverein möchte das Vereinsheim dämmen und eine Photovoltaikanlage aufs Dach bauen. Kosten etwa 80.000 Euro." });
    const standort = el("input", { type: "text", id: "standort", maxlength: "100", placeholder: "z. B. Landkreis Gotha", value: (o && o.landkreis) || "" });

    const beispiele = el("div", { class: "beispiele" }, el("span", {}, "Beispiele:"));
    [["gruendung", "Ich möchte in Weimar ein kleines Café mit eigener Backstube eröffnen und brauche Geld für die Einrichtung und die ersten Monate.", "Café gründen"],
     ["privatpersonen", "Wir wollen in unserem Einfamilienhaus die alte Ölheizung durch eine Wärmepumpe ersetzen und das Dach dämmen.", "Heizung tauschen"],
     ["vereine", "Unser Heimatverein möchte im Dorf einen Spielplatz und einen Treffpunkt für Jung und Alt bauen.", "Treffpunkt im Dorf"],
     ["unternehmen", "Unser Handwerksbetrieb mit 12 Mitarbeitern möchte eine neue Maschine kaufen und die Auftragsabwicklung digitalisieren.", "Betrieb digitalisieren"]]
      .forEach(([g, text, titel]) => beispiele.append(el("button", { type: "button", onclick: () => {
        vorhaben.value = text;
        const rad = gruppen.querySelector(`input[value="${g}"]`); if (rad) rad.checked = true;
        if (projektWahl) projektWahl.value = "";
        vorhaben.focus();
      } }, titel)));

    if (projektWahl) {
      projektWahl.addEventListener("change", () => {
        const p = zustand.projekte.find((x) => x.id === projektWahl.value);
        if (p) vorhaben.value = `${p.titel}. ${p.beschreibung}${p.kosten_euro ? ` Kosten etwa ${Number(p.kosten_euro).toLocaleString("de-DE")} Euro.` : ""}`;
      });
    }

    const knopf = el("button", { type: "submit", class: "haupt" }, "Passende Förderung finden");
    const formfehler = el("p", { class: "formfehler", role: "alert" });
    const ergebnisse = el("div", { id: "ergebnisse", "aria-live": "polite" });

    const form = el("form", { class: "flaeche", novalidate: true },
      projektWahl ? el("div", { class: "feldgruppe" }, el("label", { class: "titel", for: "projektwahl" }, "Für welches Projekt?"), projektWahl) : null,
      el("fieldset", {}, el("legend", { id: "gruppen-titel" }, "Wer stellt den Antrag?"), gruppen),
      el("div", { class: "feldgruppe" },
        el("label", { class: "titel", for: "vorhaben" }, "Was haben Sie vor?"),
        el("p", { class: "hilfe", id: "vorhaben-hilfe" }, "Je genauer, desto besser: Was soll entstehen, wer profitiert, ungefähr wie teuer?"),
        vorhaben, beispiele),
      el("div", { class: "feldgruppe" },
        el("label", { class: "titel", for: "standort" }, "Wo in Thüringen?"),
        el("p", { class: "hilfe" }, "Landkreis oder Stadt, falls Sie es schon wissen."), standort),
      angemeldet() ? null : el("p", { class: "hilfe" }, "Tipp: Mit einem kostenlosen Konto können Sie Programme merken, Projekte speichern und sich über neue Programme benachrichtigen lassen. ", el("a", { href: "#/anmelden" }, "Konto anlegen")),
      el("div", { class: "knoepfe" }, knopf, formfehler));
    seite.append(form, ergebnisse);

    // Letzte Suche wiederherstellen (z. B. nach dem Merken und Zurückkommen)
    if (zustand.letzteSuche) {
      const a = zustand.letzteSuche.anfrage;
      vorhaben.value = a.vorhaben; standort.value = a.standort;
      const rad = gruppen.querySelector(`input[value="${a.zielgruppe || ""}"]`); if (rad) rad.checked = true;
      if (projektWahl && a.projekt_id) projektWahl.value = a.projekt_id;
      if (zustand.letzteSuche.daten) ergebnisseZeigen(ergebnisse, zustand.letzteSuche.daten, a.projekt_id, { fokus: false });
    }
    const vorgabe = r.params.get("projekt");
    if (vorgabe && projektWahl) { projektWahl.value = vorgabe; projektWahl.dispatchEvent(new Event("change")); }

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      formfehler.textContent = "";
      const text = vorhaben.value.trim();
      if (text.length < 15) { formfehler.textContent = "Bitte beschreiben Sie Ihr Vorhaben in ein, zwei Sätzen."; vorhaben.focus(); return; }
      const gewaehlt = gruppen.querySelector("input:checked");
      const anfrage = {
        vorhaben: text,
        zielgruppe: gewaehlt && gewaehlt.value ? gewaehlt.value : null,
        zielgruppe_name: gewaehlt && gewaehlt.value ? gewaehlt.dataset.name : "",
        standort: standort.value.trim(),
        profil: profilText(),
        projekt_id: projektWahl && projektWahl.value ? projektWahl.value : null,
      };
      const nummer = ++zustand.suchnummer;
      knopf.disabled = true; knopf.textContent = "Suche läuft …";
      ergebnisse.replaceChildren(ladeanzeige("Der Kompass sucht passende Förderprogramme …"));
      try {
        const vorschau = await funktion("matching", { ...anfrage, nur_suche: true });
        if (nummer !== zustand.suchnummer) return;
        const treffer = (vorschau.ergebnisse || []).length > 0;
        zustand.letzteSuche = { anfrage, daten: vorschau };
        ergebnisseZeigen(ergebnisse, vorschau, anfrage.projekt_id, { vorschau: treffer });
        if (!treffer) return;
        knopf.textContent = "KI prüft …";
        try {
          const bewertet = await funktion("matching", anfrage);
          if (nummer !== zustand.suchnummer) return;
          zustand.letzteSuche = { anfrage, daten: bewertet };
          ergebnisseZeigen(ergebnisse, bewertet, anfrage.projekt_id, { fokus: false });
          if (anfrage.projekt_id) empfehlungenSpeichern(anfrage.projekt_id, bewertet);
        } catch (_) {
          if (nummer !== zustand.suchnummer) return;
          ergebnisseZeigen(ergebnisse, { ...vorschau, bewertet: false }, anfrage.projekt_id, { fokus: false });
        }
      } catch (f) {
        if (f.code === "limit_gast") {
          ergebnisse.replaceChildren(el("div", { class: "meldung hinweis", role: "alert" },
            el("p", {}, f.message),
            el("p", {}, el("a", { class: "knopf haupt", href: "#/anmelden" }, "Kostenloses Konto anlegen"))));
        } else {
          ergebnisse.replaceChildren(meldung(fehlertext(f), f.code ? "hinweis" : "fehler"));
        }
      } finally {
        if (nummer === zustand.suchnummer) { knopf.disabled = false; knopf.textContent = "Passende Förderung finden"; }
      }
    });
  }

  function ergebnisseZeigen(box, daten, projektId, { vorschau = false, fokus = true } = {}) {
    box.replaceChildren();
    const liste = daten.ergebnisse || [];
    if (!liste.length) {
      box.append(meldung("Zu dieser Beschreibung hat der Kompass kein Programm gefunden. Beschreiben Sie Ihr Vorhaben etwas allgemeiner oder wählen Sie bei „Wer stellt den Antrag?“ eine andere Gruppe."));
      return;
    }
    const gut = liste.filter((p) => p.einstufung === "passt").length;
    const teils = liste.filter((p) => p.einstufung === "passt_teilweise").length;
    let satz;
    if (vorschau || !daten.bewertet) satz = `${liste.length} Programme kommen infrage`;
    else if (gut) satz = `${gut} ${gut === 1 ? "Programm passt" : "Programme passen"} gut zu Ihrem Vorhaben`;
    else if (teils) satz = `${teils} ${teils === 1 ? "Programm kommt" : "Programme kommen"} möglicherweise infrage`;
    else satz = "Kein Programm passt eindeutig";
    box.append(el("h2", { class: "zusammenfassung", tabindex: "-1", id: "ergebnis-titel" }, satz));
    if (vorschau) {
      const h = el("div", { class: "status pruefung" }); h.innerHTML = NADEL;
      h.append(el("span", {}, "Die KI prüft jetzt jedes Programm einzeln und sortiert nach „passt gut“, „passt möglicherweise“ und „passt eher nicht“. Das dauert noch einige Sekunden."));
      box.append(h);
    } else {
      box.append(el("p", {}, daten.bewertet
        ? `Der Kompass hat die ${liste.length} ähnlichsten Programme ausgewählt und einzeln geprüft.`
        : "Die genaue Prüfung ist gerade nicht verfügbar. Hier sind die ähnlichsten Programme ohne Einschätzung."));
    }
    for (const [stufe, titel] of STUFEN) {
      const teil = liste.filter((p) => p.einstufung === stufe)
        .sort((a, b) => (b.punkte ?? -1) - (a.punkte ?? -1));
      if (!teil.length) continue;
      const sektion = el("section", { class: "stufe" });
      if (stufe === "passt_nicht") {
        const d = el("details", { class: "weitere" }, el("summary", {}, `${titel} (${teil.length})`));
        teil.forEach((p) => d.append(karte(p, { projektId })));
        sektion.append(d);
      } else {
        sektion.append(el("h3", {}, el("span", { class: "punkt " + stufe, "aria-hidden": "true" }), `${titel} (${teil.length})`));
        teil.forEach((p) => sektion.append(karte(p, { projektId })));
      }
      box.append(sektion);
    }
    if (fokus) {
      const t = $("#ergebnis-titel");
      t.focus({ preventScroll: true });
      t.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    }
  }

  // ------------------------------------------------------------------
  // Seite: Anmelden / Abmelden
  // ------------------------------------------------------------------
  async function seiteAnmelden(main) {
    const seite = el("div", { class: "seite" });
    main.append(seite);
    if (angemeldet()) {
      seite.append(seitenkopf("Sie sind angemeldet", `Angemeldet als ${zustand.sitzung.user.email}.`),
        el("p", {}, el("a", { href: "#/projekte" }, "Zu Ihren Projekten")));
      return;
    }
    const email = el("input", { type: "email", id: "email", autocomplete: "email", required: true, placeholder: "name@beispiel.de" });
    const knopf = el("button", { type: "submit", class: "haupt" }, "Anmeldelink schicken");
    const rueck = el("div", { "aria-live": "polite" });
    const form = el("form", { class: "flaeche", novalidate: true },
      el("div", { class: "feldgruppe" }, el("label", { class: "titel", for: "email" }, "Ihre E-Mail-Adresse"),
        el("p", { class: "hilfe" }, "Wir schicken Ihnen einen Link. Ein Klick darauf meldet Sie an – ohne Passwort. Gibt es noch kein Konto, wird es dabei angelegt."),
        email),
      el("div", { class: "knoepfe" }, knopf), rueck);
    seite.append(seitenkopf("Anmelden", "Mit einem kostenlosen Konto speichern Sie Ihr Profil und Ihre Projekte, merken sich Programme, werden über neue Programme benachrichtigt und können Anträge vorbereiten."), form);
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const adresse = email.value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adresse)) { rueck.replaceChildren(el("p", { class: "formfehler" }, "Bitte geben Sie eine gültige E-Mail-Adresse ein.")); return; }
      knopf.disabled = true;
      const ziel = location.origin + location.pathname;
      const { error } = await sb.auth.signInWithOtp({ email: adresse, options: { emailRedirectTo: ziel } });
      knopf.disabled = false;
      if (error) {
        const zuViele = /rate|too many|seconds/i.test(error.message);
        rueck.replaceChildren(meldung(zuViele ? "Es wurden gerade zu viele Anmeldelinks verschickt. Bitte warten Sie eine Minute und versuchen Sie es erneut." : "Der Link konnte nicht verschickt werden: " + error.message, "fehler"));
        return;
      }
      form.replaceChildren(meldung(`Wir haben einen Anmeldelink an ${adresse} geschickt. Öffnen Sie die E-Mail und klicken Sie auf den Link. Sie können dieses Fenster schließen.`, "hinweis"));
    });
  }
  async function seiteAbmelden(main) {
    await sb.auth.signOut();
    zustand.sitzung = null; zustand.letzteSuche = null;
    await kontoLaden();
    location.hash = "#/";
  }
  async function seiteWarten(main) {
    main.append(el("div", { class: "seite" }, ladeanzeige("Sie werden angemeldet …")));
    setTimeout(() => { if (/access_token=|error_description=/.test(location.hash)) location.hash = "#/"; }, 4000);
  }

  // ------------------------------------------------------------------
  // Seite: Profil
  // ------------------------------------------------------------------
  async function seiteProfil(main) {
    const seite = el("div", { class: "seite" });
    main.append(seite);
    if (!angemeldet()) { seite.append(seitenkopf("Profil"), anmeldenHinweis("Melden Sie sich an, um ein Profil anzulegen.")); return; }
    const o = zustand.organisation || {};
    const auswahl = (id, werte, wert, leer) => el("select", { id }, el("option", { value: "" }, leer),
      werte.map((w) => { const [v, t] = Array.isArray(w) ? w : [w, w]; const opt = el("option", { value: v }, t); if (v === wert) opt.selected = true; return opt; }));
    const f = {
      name: el("input", { type: "text", id: "p-name", value: o.name || "", maxlength: "200" }),
      zielgruppe: auswahl("p-zielgruppe", zustand.zielgruppen, o.zielgruppe, "Bitte wählen"),
      rechtsform: auswahl("p-rechtsform", RECHTSFORMEN, o.rechtsform, "Bitte wählen"),
      landkreis: auswahl("p-landkreis", LANDKREISE, o.landkreis, "Bitte wählen"),
      mitarbeitende: auswahl("p-ma", GROESSEN, o.mitarbeitende, "Bitte wählen"),
      gruendungsjahr: el("input", { type: "number", id: "p-jahr", min: "1800", max: "2100", value: o.gruendungsjahr || "" }),
      taetigkeitsfeld: el("input", { type: "text", id: "p-feld", value: o.taetigkeitsfeld || "", maxlength: "300", placeholder: "z. B. Jugendarbeit, Bäckerei, Maschinenbau" }),
      beschreibung: el("textarea", { id: "p-beschreibung", maxlength: "2000", placeholder: "Was machen Sie, für wen, seit wann? Das hilft der KI bei der Einschätzung und beim Antragsentwurf." }, o.beschreibung || ""),
      website: el("input", { type: "url", id: "p-website", maxlength: "300", value: o.website || "", placeholder: "www.ihre-website.de", inputmode: "url" }),
    };
    const webKnopf = el("button", { type: "button", class: "neben" }, "Website auslesen");
    const webRueck = el("div", { "aria-live": "polite" });
    webKnopf.addEventListener("click", async () => {
      if (!f.website.value.trim()) { webRueck.replaceChildren(el("p", { class: "formfehler" }, "Bitte geben Sie eine Website-Adresse ein.")); return; }
      webKnopf.disabled = true;
      webRueck.replaceChildren(ladeanzeige("Die KI liest Ihre Website …"));
      try {
        const { profil } = await funktion("ideen", { aktion: "website", url: f.website.value.trim() });
        if (profil.name && !f.name.value) f.name.value = profil.name;
        if (profil.zielgruppe && !f.zielgruppe.value) f.zielgruppe.value = profil.zielgruppe;
        if (profil.rechtsform && !f.rechtsform.value) f.rechtsform.value = profil.rechtsform;
        if (profil.landkreis && !f.landkreis.value) f.landkreis.value = profil.landkreis;
        if (profil.taetigkeitsfeld) f.taetigkeitsfeld.value = profil.taetigkeitsfeld;
        if (profil.beschreibung) f.beschreibung.value = profil.beschreibung;
        if (profil.website) f.website.value = profil.website;
        webRueck.replaceChildren(el("p", { class: "erfolg" }, "Übernommen – bitte prüfen und dann speichern."));
      } catch (fe) { webRueck.replaceChildren(el("p", { class: "formfehler" }, fehlertext(fe))); }
      webKnopf.disabled = false;
    });
    const zeile = (id, text, feld, hilfe) => el("div", { class: "feldgruppe" }, el("label", { class: "feld", for: id }, text), hilfe ? el("p", { class: "hilfe" }, hilfe) : null, feld);
    const knopf = el("button", { type: "submit", class: "haupt" }, "Profil speichern");
    const rueck = el("p", { class: "erfolg", "aria-live": "polite" });
    const form = el("form", { class: "flaeche", novalidate: true },
      el("div", { class: "website-kasten" }, el("label", { class: "feld", for: "p-website" }, "Website"),
        el("p", { class: "hilfe" }, "Die KI kann Ihr Profil aus Ihrer Website ausfüllen."),
        el("div", { class: "zeile-mit-knopf" }, f.website, webKnopf), webRueck),
      zeile("p-name", "Name der Organisation oder Ihr Name", f.name),
      el("div", { class: "raster" },
        zeile("p-zielgruppe", "Wer stellt Anträge?", f.zielgruppe),
        zeile("p-rechtsform", "Rechtsform", f.rechtsform),
        zeile("p-landkreis", "Landkreis / Stadt", f.landkreis),
        zeile("p-ma", "Mitarbeitende", f.mitarbeitende),
        zeile("p-jahr", "Gründungsjahr", f.gruendungsjahr)),
      zeile("p-feld", "Tätigkeitsfeld", f.taetigkeitsfeld),
      zeile("p-beschreibung", "Kurzbeschreibung", f.beschreibung),
      el("div", { class: "knoepfe" }, knopf, rueck));
    seite.append(seitenkopf("Ihr Profil", "Diese Angaben nutzt der Kompass bei jeder Suche, beim Fördermittelwecker und im Antragsassistenten. So werden die Einschätzungen genauer."),
      form,
      el("p", { class: "hilfe" }, `Angemeldet als ${zustand.sitzung.user.email}. `,
        el("button", { type: "button", class: "leise gefahr", onclick: kontoLoeschen }, "Konto und alle Daten löschen")));
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      knopf.disabled = true; rueck.textContent = "";
      const daten = {
        name: f.name.value.trim() || null, zielgruppe: f.zielgruppe.value || null, rechtsform: f.rechtsform.value || null,
        landkreis: f.landkreis.value || null, mitarbeitende: f.mitarbeitende.value || null,
        gruendungsjahr: f.gruendungsjahr.value ? Number(f.gruendungsjahr.value) : null,
        taetigkeitsfeld: f.taetigkeitsfeld.value.trim() || null, beschreibung: f.beschreibung.value.trim() || null,
        website: f.website.value.trim() || null,
      };
      try {
        const anfrage = zustand.organisation
          ? sb.from("organisationen").update(daten).eq("id", zustand.organisation.id)
          : sb.from("organisationen").insert(daten);
        const { data } = await anfrage.select().single().throwOnError();
        zustand.organisation = data;
        rueck.className = "erfolg"; rueck.textContent = "Gespeichert.";
      } catch (fe) { rueck.className = "formfehler"; rueck.textContent = fehlertext(fe); }
      knopf.disabled = false;
    });
  }
  async function kontoLoeschen() {
    if (!window.confirm("Wirklich alle Ihre Daten löschen? Profil, Projekte, Merkliste und Anträge werden entfernt. Das lässt sich nicht rückgängig machen.")) return;
    try {
      await sb.from("antraege").delete().not("id", "is", null).throwOnError();
      await sb.from("merkliste").delete().not("id", "is", null).throwOnError();
      await sb.from("projekte").delete().not("id", "is", null).throwOnError();
      await sb.from("organisationen").delete().not("id", "is", null).throwOnError();
      window.alert("Ihre Daten wurden gelöscht. Ihre E-Mail-Adresse entfernen wir auf Anfrage vollständig – schreiben Sie uns dazu über die Adresse im Impressum.");
      location.hash = "#/abmelden";
    } catch (f) { window.alert(fehlertext(f)); }
  }

  // ------------------------------------------------------------------
  // Seite: Projekte
  // ------------------------------------------------------------------
  function projektFormular(p, fertig) {
    const titel = el("input", { type: "text", maxlength: "200", value: p ? p.titel : "", required: true });
    const beschreibung = el("textarea", { maxlength: "4000", placeholder: "Was soll entstehen? Wer profitiert? Wo? Bis wann?" }, p ? p.beschreibung : "");
    const kosten = el("input", { type: "number", min: "0", step: "100", value: p && p.kosten_euro ? p.kosten_euro : "" });
    const beginn = el("input", { type: "date", value: p && p.beginn ? p.beginn : "" });
    const wecker = el("input", { type: "checkbox" }); wecker.checked = p ? p.wecker_aktiv : true;
    const fehler = el("p", { class: "formfehler", role: "alert" });
    const id = "pf" + Math.random().toString(36).slice(2, 7);
    titel.id = id + "t"; beschreibung.id = id + "b"; kosten.id = id + "k"; beginn.id = id + "d";
    const form = el("form", { class: "flaeche", novalidate: true },
      el("div", { class: "feldgruppe" }, el("label", { class: "feld", for: titel.id }, "Titel des Projekts"), titel),
      el("div", { class: "feldgruppe" }, el("label", { class: "feld", for: beschreibung.id }, "Beschreibung"), beschreibung),
      el("div", { class: "raster" },
        el("div", { class: "feldgruppe" }, el("label", { class: "feld", for: kosten.id }, "Geschätzte Kosten in Euro"), kosten),
        el("div", { class: "feldgruppe" }, el("label", { class: "feld", for: beginn.id }, "Geplanter Beginn"), beginn)),
      el("div", { class: "feldgruppe" }, el("label", { class: "schalter" }, wecker, "Fördermittelwecker: wöchentlich per E-Mail über neue passende Programme informieren")),
      el("div", { class: "knoepfe" },
        el("button", { type: "submit", class: "haupt" }, p ? "Änderungen speichern" : "Projekt anlegen"),
        el("button", { type: "button", class: "leise", onclick: () => fertig(null) }, "Abbrechen"), fehler));
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      if (titel.value.trim().length < 3 || beschreibung.value.trim().length < 15) {
        fehler.textContent = "Bitte geben Sie einen Titel und eine kurze Beschreibung (ein, zwei Sätze) ein."; return;
      }
      const daten = { titel: titel.value.trim(), beschreibung: beschreibung.value.trim(),
        kosten_euro: kosten.value ? Number(kosten.value) : null, beginn: beginn.value || null, wecker_aktiv: wecker.checked };
      try {
        const anfrage = p ? sb.from("projekte").update(daten).eq("id", p.id) : sb.from("projekte").insert(daten);
        const { data } = await anfrage.select("id,titel,beschreibung,kosten_euro,beginn,wecker_aktiv,erstellt_am,aktualisiert_am").single().throwOnError();
        fertig(data);
      } catch (f) { fehler.textContent = fehlertext(f); }
    });
    setTimeout(() => titel.focus(), 0);
    return form;
  }

  async function seiteProjekte(main) {
    const seite = el("div", { class: "seite" });
    main.append(seite);
    if (!angemeldet()) { seite.append(seitenkopf("Projekte"), anmeldenHinweis("Melden Sie sich an, um Projekte zu speichern.")); return; }
    seite.append(seitenkopf("Ihre Projekte", "Legen Sie für jedes Vorhaben ein Projekt an. Der Kompass sucht dann passende Programme und meldet sich per E-Mail, wenn neue dazukommen."));
    if (!zustand.organisation) seite.append(el("div", { class: "meldung hinweis" }, el("p", {}, "Tipp: Füllen Sie Ihr ", el("a", { href: "#/profil" }, "Profil"), " aus – dann werden die Einschätzungen genauer.")));
    const bereich = el("div");
    seite.append(bereich);

    const liste = () => {
      bereich.replaceChildren(el("div", { class: "knoepfe", style: "margin-bottom:20px" },
        el("button", { type: "button", class: "haupt", onclick: () => bearbeiten(null) }, "Neues Projekt anlegen")));
      if (!zustand.projekte.length) { bereich.append(meldung("Sie haben noch kein Projekt angelegt.")); return; }
      for (const p of zustand.projekte) {
        const anzahl = zustand.merkliste.filter((m) => m.projekt_id === p.id).length;
        bereich.append(el("div", { class: "eintrag" },
          el("h3", {}, p.titel),
          el("p", { class: "meta" }, [p.kosten_euro ? `ca. ${Number(p.kosten_euro).toLocaleString("de-DE")} Euro` : "",
            p.beginn ? `Beginn ${datum(p.beginn)}` : "", p.wecker_aktiv ? "Wecker an" : "Wecker aus",
            `${anzahl} gemerkte Programme`].filter(Boolean).join(" · ")),
          el("p", {}, kuerzen(p.beschreibung, 280)),
          el("div", { class: "knoepfe" },
            el("a", { class: "knopf haupt", href: "#/projekt/" + p.id }, "Empfehlungen ansehen"),
            el("a", { class: "knopf neben", href: "#/merkliste?projekt=" + p.id }, "Merkliste"),
            el("button", { type: "button", class: "neben", onclick: () => bearbeiten(p) }, "Bearbeiten"),
            el("button", { type: "button", class: "leise gefahr", onclick: () => loeschen(p) }, "Löschen"))));
      }
    };
    const bearbeiten = (p) => {
      bereich.replaceChildren(projektFormular(p, (neu) => {
        if (neu) {
          const i = zustand.projekte.findIndex((x) => x.id === neu.id);
          if (i >= 0) zustand.projekte[i] = neu; else zustand.projekte.unshift(neu);
        }
        liste();
      }));
    };
    const loeschen = async (p) => {
      if (!window.confirm(`Projekt „${p.titel}“ löschen? Die zugehörigen Merklisten-Einträge werden ebenfalls entfernt.`)) return;
      try {
        await sb.from("projekte").delete().eq("id", p.id).throwOnError();
        zustand.projekte = zustand.projekte.filter((x) => x.id !== p.id);
        zustand.merkliste = zustand.merkliste.filter((m) => m.projekt_id !== p.id);
        liste();
      } catch (f) { window.alert(fehlertext(f)); }
    };
    liste();
  }

  // ------------------------------------------------------------------
  // Seite: Merkliste
  // ------------------------------------------------------------------
  async function seiteMerkliste(main, r) {
    const seite = el("div", { class: "seite" });
    main.append(seite);
    if (!angemeldet()) { seite.append(seitenkopf("Merkliste"), anmeldenHinweis("Melden Sie sich an, um Programme zu merken.")); return; }
    seite.append(seitenkopf("Ihre Merkliste", "Gemerkte Programme mit Status und Notizen. Wählen Sie mehrere aus, um sie zu vergleichen."));
    const filterProjekt = r.params.get("projekt") || "";
    const filter = el("select", { id: "mfilter" },
      el("option", { value: "" }, "Alle Projekte"), el("option", { value: "ohne" }, "Ohne Projekt"),
      zustand.projekte.map((p) => el("option", { value: p.id }, p.titel)));
    filter.value = filterProjekt;
    filter.addEventListener("change", () => { location.hash = "#/merkliste" + (filter.value ? "?projekt=" + filter.value : ""); });
    seite.append(el("div", { class: "feldgruppe", style: "max-width:360px" }, el("label", { class: "feld", for: "mfilter" }, "Anzeigen für"), filter));

    let eintraege = zustand.merkliste;
    if (filterProjekt === "ohne") eintraege = eintraege.filter((m) => !m.projekt_id);
    else if (filterProjekt) eintraege = eintraege.filter((m) => m.projekt_id === filterProjekt);
    if (!eintraege.length) { seite.append(meldung("Hier ist noch nichts gemerkt. Starten Sie eine Suche und klicken Sie bei interessanten Programmen auf „Merken“.")); return; }

    seite.append(ladeanzeige("Programme werden geladen …"));
    const ids = [...new Set(eintraege.map((m) => m.programm_id))];
    const { data: programme, error } = await sb.rpc("programm_details", { ids });
    seite.lastChild.remove();
    if (error) throw error;
    const nachId = new Map((programme || []).map((p) => [p.id, p]));
    const auswahl = new Set();
    const leiste = el("div", { class: "vergleichsleiste", hidden: true });
    const leisteText = el("span");
    leiste.append(leisteText, el("button", { type: "button", onclick: () => { location.hash = "#/vergleich?ids=" + [...auswahl].join(","); } }, "Ausgewählte vergleichen"));
    const auswahlGeaendert = () => {
      leiste.hidden = auswahl.size < 2;
      leisteText.textContent = `${auswahl.size} Programme ausgewählt`;
    };

    for (const [status, titel] of MERK_STATUS) {
      const teil = eintraege.filter((m) => m.status === status);
      if (!teil.length) continue;
      const gruppe = el("section", { class: "statusgruppe" }, el("h3", {}, `${titel} (${teil.length})`));
      for (const m of teil) {
        const p = nachId.get(m.programm_id);
        if (!p) continue;
        const projekt = zustand.projekte.find((x) => x.id === m.projekt_id);
        const box = el("input", { type: "checkbox", "aria-label": `${p.titel} zum Vergleich auswählen` });
        box.addEventListener("change", () => { box.checked ? auswahl.add(p.id) : auswahl.delete(p.id); auswahlGeaendert(); });
        const statusWahl = el("select", { "aria-label": "Status" }, MERK_STATUS.map(([v, t]) => el("option", { value: v }, t)));
        statusWahl.value = m.status;
        const notiz = el("textarea", { "aria-label": "Notiz", placeholder: "Notiz, z. B. Ansprechpartner, nächste Schritte …", maxlength: "4000" }, m.notiz || "");
        const gespeichert = el("span", { class: "erfolg", "aria-live": "polite" });
        const speichern = async (felder) => {
          try {
            await sb.from("merkliste").update(felder).eq("id", m.id).throwOnError();
            Object.assign(m, felder);
            gespeichert.textContent = "Gespeichert"; setTimeout(() => { gespeichert.textContent = ""; }, 2000);
          } catch (f) { gespeichert.className = "formfehler"; gespeichert.textContent = fehlertext(f); }
        };
        statusWahl.addEventListener("change", async () => { await speichern({ status: statusWahl.value }); zeigen(); });
        notiz.addEventListener("change", () => speichern({ notiz: notiz.value.trim() || null }));
        gruppe.append(el("div", { class: "eintrag" }, el("div", { class: "merkzeile" }, box, el("div", {},
          el("h3", {}, el("a", { href: "#/programm/" + p.id }, p.titel)),
          el("p", { class: "meta" }, [EBENE[p.ebene], p.foerdergeber, projekt ? `Projekt: ${projekt.titel}` : "",
            p.status === "ausgelaufen" ? "Programm nicht mehr in der Förderdatenbank" : ""].filter(Boolean).join(" · ")),
          m.begruendung ? el("p", {}, m.begruendung) : el("p", { class: "kurz" }, kuerzen(p.kurztext, 240)),
          el("div", { class: "merkfelder" }, statusWahl, notiz),
          el("div", { class: "kartenfuss" },
            el("a", { class: "knopf neben", href: "#/assistent/" + p.id + (m.projekt_id ? "?projekt=" + m.projekt_id : "") }, "Antrag vorbereiten"),
            p.link ? el("a", { class: "original", href: p.link, target: "_blank", rel: "noopener" }, "Beim Fördergeber ansehen") : null,
            el("button", { type: "button", class: "leise gefahr", onclick: async () => {
              await sb.from("merkliste").delete().eq("id", m.id);
              zustand.merkliste = zustand.merkliste.filter((x) => x.id !== m.id);
              zeigen();
            } }, "Entfernen"), gespeichert)))));
      }
      seite.append(gruppe);
    }
    seite.append(leiste);
  }

  // ------------------------------------------------------------------
  // Seite: Vergleich
  // ------------------------------------------------------------------
  async function seiteVergleich(main, r) {
    const ids = (r.params.get("ids") || "").split(",").map(Number).filter(Boolean).slice(0, 4);
    const seite = el("div", { class: "seite breit" });
    main.append(seite);
    seite.append(seitenkopf("Programme vergleichen"));
    if (ids.length < 2) { seite.append(meldung("Wählen Sie in Ihrer Merkliste mindestens zwei Programme aus.")); return; }
    const { data, error } = await sb.rpc("programm_details", { ids });
    if (error) throw error;
    const programme = ids.map((i) => (data || []).find((p) => p.id === i)).filter(Boolean);
    const zeilen = [
      ["Förderart", (p) => (p.foerderart || []).join(", ")],
      ["Ebene", (p) => EBENE[p.ebene] || ""],
      ["Fördergeber", (p) => p.foerdergeber || ""],
      ["Wer kann beantragen?", (p) => (p.foerderberechtigte || []).join(", ")],
      ["Unternehmensgröße", (p) => saeubern(p.unternehmensgroesse)],
      ["Kurzbeschreibung", (p) => kuerzen(p.kurztext, 500)],
      ["Voraussetzungen", (p) => kuerzen(p.voraussetzungen, 1200)],
      ["Fristen", (p) => kuerzen(p.fristen, 400)],
      ["Antragsweg", (p) => kuerzen(p.verfahren, 600)],
    ];
    const tabelle = el("table", { class: "vergleich" },
      el("thead", {}, el("tr", {}, el("th", { scope: "col" }, el("span", { class: "versteckt" }, "Merkmal")),
        programme.map((p) => el("th", { scope: "col" }, el("a", { href: "#/programm/" + p.id }, p.titel))))),
      el("tbody", {}, zeilen.map(([titel, f]) => el("tr", {}, el("th", { scope: "row" }, titel),
        programme.map((p) => el("td", {}, el("div", { class: "lang" }, f(p) || "–"))))),
        el("tr", {}, el("th", { scope: "row" }, "Links"), programme.map((p) => el("td", {},
          p.link ? el("a", { href: p.link, target: "_blank", rel: "noopener" }, "Beim Fördergeber") : "–", " ",
          angemeldet() ? el("a", { href: "#/assistent/" + p.id, style: "display:block;margin-top:6px" }, "Antrag vorbereiten") : null)))));
    seite.append(el("div", { class: "tabellenrahmen" }, tabelle),
      el("p", { style: "margin-top:16px" }, el("a", { href: "#/merkliste" }, "Zurück zur Merkliste")));
  }

  // ------------------------------------------------------------------
  // Seite: Programmdetails
  // ------------------------------------------------------------------
  async function seiteProgramm(main, r) {
    const id = Number(r.teile[1]);
    const seite = el("div", { class: "seite" });
    main.append(seite);
    const { data, error } = await sb.rpc("programm_details", { ids: [id] });
    if (error) throw error;
    const p = data && data[0];
    if (!p) { seite.append(seitenkopf("Programm nicht gefunden"), meldung("Dieses Programm gibt es nicht (mehr).")); return; }
    const feld = (titel, wert) => (wert ? [el("dt", {}, titel), el("dd", {}, wert)] : []);
    seite.append(
      seitenkopf(p.titel, [EBENE[p.ebene], p.foerdergeber].filter(Boolean).join(", ")),
      p.status === "ausgelaufen" ? meldung("Dieses Programm ist nicht mehr in der Förderdatenbank des Bundes enthalten und läuft möglicherweise nicht mehr.", "hinweis") : null,
      el("div", { class: "knoepfe", style: "margin-bottom:24px" },
        karteAktionenKurz(p),
        p.link ? el("a", { class: "knopf neben", href: p.link, target: "_blank", rel: "noopener" }, "Beim Fördergeber ansehen") : null),
      el("div", { class: "flaeche" }, el("dl", { class: "details" },
        feld("Förderart", (p.foerderart || []).join(", ")),
        feld("Förderbereich", (p.foerderbereich || []).join(", ")),
        feld("Wer kann beantragen?", (p.foerderberechtigte || []).join(", ")),
        feld("Kurzbeschreibung", saeubern(p.kurztext)),
        feld("Beschreibung", saeubern(p.beschreibung)),
        feld("Voraussetzungen", saeubern(p.voraussetzungen)),
        feld("Unternehmensgröße", saeubern(p.unternehmensgroesse)),
        feld("Fristen", saeubern(p.fristen)),
        feld("Antragsweg", saeubern(p.verfahren)),
        feld("Erforderliche Unterlagen", saeubern(p.unterlagen)),
        feld("Ansprechpunkt", saeubern(p.ansprechpunkt)),
        feld("Rechtsgrundlage", saeubern(p.rechtsgrundlage)),
        feld("Stand", datum(p.aktualisiert_am)))));
  }
  function karteAktionenKurz(p) {
    return el("a", { class: "knopf haupt", href: "#/assistent/" + p.id }, "Antrag vorbereiten");
  }

  // ------------------------------------------------------------------
  // Gastmodus des Antragsassistenten: Daten bleiben nur in diesem Browser
  // und werden nach der Anmeldung ins Konto übernommen.
  // ------------------------------------------------------------------
  const GAST_SCHLUESSEL = "foerderkompass_gastantrag";
  function gastLaden() { try { return JSON.parse(localStorage.getItem(GAST_SCHLUESSEL) || "null"); } catch { return null; } }
  function gastSpeichern(d) { try { localStorage.setItem(GAST_SCHLUESSEL, JSON.stringify(d)); } catch { /* privat surfen */ } }
  function gastLoeschen() { try { localStorage.removeItem(GAST_SCHLUESSEL); } catch { /* egal */ } }

  async function gastUebernehmen() {
    let ziel = null;
    const e = einstiegLaden();
    if (angemeldet() && e && e.alsGast && e.ergebnis && e.ergebnis.daten && e.ergebnis.daten.bewertet && (e.vorhaben || {}).beschreibung) {
      try { ziel = "#/projekt/" + await einstiegAlsProjekt(e, e.ergebnis.daten); }
      catch (f) { console.error("Einstieg konnte nicht übernommen werden", f); }
    }
    return (await gastAntragUebernehmen()) || ziel;
  }
  async function gastAntragUebernehmen() {
    const g = gastLaden();
    if (!g || !angemeldet() || !(g.pruefung || g.entwurf)) return null;
    try {
      const o = g.organisation || {};
      if (!zustand.organisation && (o.zielgruppe || o.rechtsform || o.landkreis || o.name)) {
        const { data } = await sb.from("organisationen").insert({
          name: o.name || null, zielgruppe: o.zielgruppe || null, rechtsform: o.rechtsform || null, landkreis: o.landkreis || null,
        }).select().single().throwOnError();
        zustand.organisation = data;
      }
      let projektId = null;
      const v = g.vorhaben || {};
      if ((v.beschreibung || "").trim().length >= 15) {
        const { data } = await sb.from("projekte").insert({
          titel: (v.titel || "").trim() || v.beschreibung.slice(0, 60), beschreibung: v.beschreibung,
          kosten_euro: v.kosten_euro || null,
        }).select("id,titel,beschreibung,kosten_euro,beginn,wecker_aktiv,erstellt_am,aktualisiert_am").single().throwOnError();
        zustand.projekte.unshift(data);
        projektId = data.id;
      }
      const { data: a } = await sb.from("antraege").insert({
        programm_id: g.programm_id, projekt_id: projektId, pruefung: g.pruefung || null,
        antworten: g.antworten || null, entwurf: g.entwurf || null,
      }).select().single().throwOnError();
      gastLoeschen();
      return `#/assistent/${g.programm_id}?antrag=${a.id}`;
    } catch (f) {
      console.error("Gast-Entwurf konnte nicht übernommen werden", f);
      return null;
    }
  }

  // ------------------------------------------------------------------
  // Seite: Antragsassistent
  // ------------------------------------------------------------------
  async function seiteAssistent(main, r) {
    const programmId = Number(r.teile[1]);
    const seite = el("div", { class: "seite" });
    main.append(seite);
    const gast = !angemeldet();
    const { data } = await sb.rpc("programm_details", { ids: [programmId] });
    const programm = data && data[0];
    if (!programm) { seite.append(seitenkopf("Antragsassistent"), meldung("Dieses Programm wurde nicht gefunden.", "fehler")); return; }

    // vorhandenen Antrag laden oder neu beginnen
    let antrag = null;
    const antragId = gast ? null : r.params.get("antrag");
    if (antragId) {
      const { data: a } = await sb.from("antraege").select("*").eq("id", antragId).maybeSingle();
      antrag = a;
    }
    let projektId = (antrag && antrag.projekt_id) || r.params.get("projekt") || (zustand.projekte[0] && zustand.projekte[0].id) || "";

    // Gastdaten: gleiche Programmnummer → weitermachen, sonst neu (Angaben aus der letzten Suche übernehmen)
    let gastDaten = null;
    if (gast) {
      const alt = gastLaden() || {};
      const suche = (zustand.letzteSuche && zustand.letzteSuche.anfrage) || {};
      gastDaten = alt.programm_id === programmId ? alt : {
        programm_id: programmId,
        vorhaben: alt.vorhaben || { titel: "", beschreibung: suche.vorhaben || "", kosten_euro: null },
        organisation: alt.organisation || { zielgruppe: suche.zielgruppe || "", landkreis: "", rechtsform: "", name: "" },
      };
    }

    const schrittleiste = el("ol", { class: "schritte", "aria-label": "Fortschritt" });
    const SCHRITTE = ["Vorhaben wählen", "Voraussetzungen prüfen", "Rückfragen beantworten", "Entwurf bearbeiten"];
    const schritt = (n) => schrittleiste.replaceChildren(...SCHRITTE.map((t, i) => el("li", { "aria-current": i === n ? "step" : null }, `${i + 1}. ${t}`)));
    const bereich = el("div", { "aria-live": "polite" });
    seite.append(seitenkopf("Antragsassistent", `für „${programm.titel}“`), schrittleiste,
      el("div", { class: "meldung hinweis" }, el("p", {}, "Der Assistent hilft beim Vorbereiten. Er ersetzt keine Beratung durch den Fördergeber. Wichtig: Bei den meisten Programmen dürfen Sie mit dem Vorhaben erst nach der Antragstellung oder Bewilligung beginnen.")),
      bereich);

    const projekt = () => zustand.projekte.find((p) => p.id === projektId) || null;
    const basisDaten = () => {
      const o = gast ? gastDaten.organisation : (zustand.organisation || {});
      return { programm_id: programmId,
        organisation: { ...o, zielgruppe_name: gruppenName(o.zielgruppe) },
        projekt: gast ? gastDaten.vorhaben : (projekt() || {}) };
    };
    const speichern = async (felder) => {
      if (gast) { Object.assign(gastDaten, felder); gastSpeichern(gastDaten); return; }
      try {
        if (antrag) {
          const { data: a } = await sb.from("antraege").update(felder).eq("id", antrag.id).select().single().throwOnError();
          antrag = a;
        } else {
          const { data: a } = await sb.from("antraege").insert({ programm_id: programmId, projekt_id: projektId || null, ...felder }).select().single().throwOnError();
          antrag = a;
          history.replaceState(null, "", `#/assistent/${programmId}?antrag=${a.id}`);
        }
      } catch (f) { console.error(f); }
    };

    // Schritt 1: Vorhaben wählen
    const schritt1 = () => {
      schritt(0);
      if (gast) { schritt1Gast(); return; }
      if (!zustand.projekte.length) {
        bereich.replaceChildren(meldung("Legen Sie zuerst ein Projekt an. Der Assistent braucht eine Beschreibung Ihres Vorhabens."),
          projektFormular(null, (neu) => { if (neu) { zustand.projekte.unshift(neu); projektId = neu.id; schritt1(); } else location.hash = "#/projekte"; }));
        return;
      }
      const wahl = el("select", { id: "a-projekt" }, zustand.projekte.map((p) => el("option", { value: p.id }, p.titel)));
      if (projektId) wahl.value = projektId;
      const fehltProfil = !zustand.organisation;
      bereich.replaceChildren(el("div", { class: "flaeche" },
        el("div", { class: "feldgruppe" }, el("label", { class: "titel", for: "a-projekt" }, "Für welches Projekt?"), wahl),
        fehltProfil ? el("p", { class: "hilfe" }, "Tipp: Mit ausgefülltem ", el("a", { href: "#/profil" }, "Profil"), " wird die Prüfung genauer.") : null,
        el("div", { class: "knoepfe" }, el("button", { type: "button", class: "haupt", onclick: () => { projektId = wahl.value; schritt2(); } }, "Voraussetzungen prüfen"))));
    };

    const schritt1Gast = () => {
      const o = gastDaten.organisation, v = gastDaten.vorhaben;
      const auswahl = (id, werte, wert, leer) => {
        const s = el("select", { id }, el("option", { value: "" }, leer),
          werte.map((w) => { const [val, t] = Array.isArray(w) ? w : [w, w]; return el("option", { value: val }, t); }));
        s.value = wert || "";
        return s;
      };
      const f = {
        zielgruppe: auswahl("g-gruppe", zustand.zielgruppen, o.zielgruppe, "Bitte wählen"),
        rechtsform: auswahl("g-rechtsform", RECHTSFORMEN, o.rechtsform, "Bitte wählen"),
        landkreis: auswahl("g-landkreis", LANDKREISE, o.landkreis, "Bitte wählen"),
        name: el("input", { type: "text", id: "g-name", maxlength: "200", value: o.name || "", placeholder: "optional" }),
        titel: el("input", { type: "text", id: "g-titel", maxlength: "200", value: v.titel || "", placeholder: "z. B. Spielplatz am Dorfteich" }),
        beschreibung: el("textarea", { id: "g-beschreibung", maxlength: "4000", placeholder: "Was soll entstehen? Wer profitiert? Wo? Bis wann?" }, v.beschreibung || ""),
        kosten: el("input", { type: "number", id: "g-kosten", min: "0", step: "100", value: v.kosten_euro || "" }),
      };
      const zeile = (id, text, feld) => el("div", { class: "feldgruppe" }, el("label", { class: "feld", for: id }, text), feld);
      const fehler = el("p", { class: "formfehler", role: "alert" });
      bereich.replaceChildren(
        el("div", { class: "meldung" }, el("p", {}, "Sie nutzen den Assistenten ohne Konto. Ihre Angaben bleiben nur in diesem Browser. ",
          el("a", { href: "#/anmelden" }, "Mit einem kostenlosen Konto"), " speichern Sie Entwürfe dauerhaft – Ihr bisheriger Entwurf wird dabei übernommen.")),
        el("form", { class: "flaeche", novalidate: true, onsubmit: (ev) => {
          ev.preventDefault();
          if (f.beschreibung.value.trim().length < 15) { fehler.textContent = "Bitte beschreiben Sie Ihr Vorhaben in ein, zwei Sätzen."; f.beschreibung.focus(); return; }
          gastDaten.organisation = { zielgruppe: f.zielgruppe.value, rechtsform: f.rechtsform.value, landkreis: f.landkreis.value, name: f.name.value.trim() };
          gastDaten.vorhaben = { titel: f.titel.value.trim(), beschreibung: f.beschreibung.value.trim(), kosten_euro: f.kosten.value ? Number(f.kosten.value) : null };
          delete gastDaten.pruefung; delete gastDaten.antworten; delete gastDaten.entwurf;
          gastSpeichern(gastDaten);
          schritt2();
        } },
          el("h2", {}, "Wer stellt den Antrag?"),
          el("div", { class: "raster" },
            zeile("g-gruppe", "Antragsteller", f.zielgruppe),
            zeile("g-rechtsform", "Rechtsform", f.rechtsform),
            zeile("g-landkreis", "Landkreis / Stadt", f.landkreis),
            zeile("g-name", "Name der Organisation", f.name)),
          el("h2", {}, "Ihr Vorhaben"),
          zeile("g-titel", "Titel", f.titel),
          zeile("g-beschreibung", "Beschreibung", f.beschreibung),
          el("div", { style: "max-width:260px" }, zeile("g-kosten", "Geschätzte Kosten in Euro", f.kosten)),
          el("div", { class: "knoepfe" }, el("button", { type: "submit", class: "haupt" }, "Voraussetzungen prüfen"), fehler)));
      setTimeout(() => f.beschreibung.focus(), 0);
    };

    // Schritt 2+3: Prüfung und Rückfragen
    const schritt2 = async (vorhanden) => {
      schritt(1);
      let pruefung = vorhanden;
      if (!pruefung) {
        bereich.replaceChildren(ladeanzeige("Die KI prüft die Voraussetzungen des Programms. Das dauert etwa 10 bis 20 Sekunden …"));
        try {
          pruefung = (await funktion("assistent", { ...basisDaten(), aktion: "pruefen" })).pruefung;
          await speichern({ pruefung, projekt_id: projektId || null });
        } catch (f) {
          bereich.replaceChildren(...assistentFehler(f, () => schritt2()));
          return;
        }
      }
      schritt(2);
      const symbol = { erfuellt: "✓", unklar: "?", nicht_erfuellt: "✕" };
      const statusText = { erfuellt: "erfüllt", unklar: "unklar", nicht_erfuellt: "nicht erfüllt" };
      const einschaetzung = { passt: "Das Programm passt voraussichtlich.", passt_teilweise: "Das Programm passt möglicherweise – einige Punkte sind offen.", passt_nicht: "Das Programm passt voraussichtlich nicht." }[pruefung.gesamteinschaetzung] || "";
      const fragen = Array.isArray(pruefung.rueckfragen) ? pruefung.rueckfragen : [];
      const alteAntworten = new Map(((gast ? gastDaten.antworten : antrag && antrag.antworten) || []).map((a) => [a.frage, a.antwort]));
      const felder = fragen.map((f, i) => {
        const t = el("textarea", { id: "frage" + i, style: "min-height:80px" }, alteAntworten.get(f.frage) || "");
        return { frage: f.frage, feld: t, knoten: el("div", { class: "feldgruppe" },
          el("label", { class: "feld", for: "frage" + i }, f.frage), f.hinweis ? el("p", { class: "hilfe" }, f.hinweis) : null, t) };
      });
      bereich.replaceChildren(
        el("div", { class: "flaeche" },
          el("h2", {}, einschaetzung),
          pruefung.zusammenfassung ? el("p", {}, pruefung.zusammenfassung) : null,
          (pruefung.voraussetzungen || []).length ? el("ul", { class: "pruefliste" }, pruefung.voraussetzungen.map((v) =>
            el("li", {}, el("span", { class: "symbol " + v.status, "aria-hidden": "true" }, symbol[v.status] || "?"),
              el("div", {}, el("strong", {}, v.punkt), el("span", { class: "versteckt" }, ` (${statusText[v.status] || "unklar"})`),
                v.erklaerung ? el("div", { class: "kurz", style: "margin:2px 0 0" }, v.erklaerung) : null)))) : null,
          (pruefung.unterlagen || []).length ? [el("h3", {}, "Benötigte Unterlagen"), el("ul", {}, pruefung.unterlagen.map((u) => el("li", {}, u)))] : null,
          (pruefung.naechste_schritte || []).length ? [el("h3", {}, "Nächste Schritte"), el("ol", {}, pruefung.naechste_schritte.map((u) => el("li", {}, u)))] : null),
        el("form", { class: "flaeche", novalidate: true, onsubmit: (ev) => { ev.preventDefault(); schritt4(felder.map((f) => ({ frage: f.frage, antwort: f.feld.value.trim() }))); } },
          el("h2", {}, fragen.length ? "Rückfragen für den Antrag" : "Antragsentwurf erstellen"),
          el("p", { class: "hilfe" }, fragen.length ? "Je mehr Sie beantworten, desto besser wird der Entwurf. Unbeantwortete Fragen werden im Entwurf als Platzhalter markiert." : "Der Assistent schreibt jetzt einen ersten Entwurf Ihrer Projektbeschreibung."),
          felder.map((f) => f.knoten),
          el("div", { class: "knoepfe" },
            el("button", { type: "submit", class: "haupt" }, "Antragsentwurf schreiben"),
            el("button", { type: "button", class: "leise", onclick: () => schritt2() }, "Prüfung wiederholen"),
            el("button", { type: "button", class: "leise", onclick: () => schritt1() }, gast ? "Angaben ändern" : "Anderes Projekt wählen"))));
    };

    // Schritt 4: Entwurf
    const schritt4 = async (antworten, vorhanden) => {
      schritt(3);
      let entwurf = vorhanden;
      if (!entwurf) {
        bereich.replaceChildren(ladeanzeige("Die KI schreibt Ihren Antragsentwurf. Das kann bis zu einer Minute dauern …"));
        try {
          await speichern({ antworten });
          entwurf = (await funktion("assistent", { ...basisDaten(), aktion: "entwurf", antworten })).entwurf;
          await speichern({ entwurf });
        } catch (f) {
          bereich.replaceChildren(...assistentFehler(f, () => schritt4(antworten)));
          return;
        }
      }
      const titelFeld = el("input", { type: "text", "aria-label": "Titel des Antrags", value: entwurf.titel || "" });
      const abschnitte = (entwurf.abschnitte || []).map((a, i) => {
        const u = el("input", { type: "text", value: a.ueberschrift || "", "aria-label": `Überschrift Abschnitt ${i + 1}` });
        const t = el("textarea", { "aria-label": a.ueberschrift || `Abschnitt ${i + 1}` }, (a.text || "").replace(/\\n/g, "\n"));
        return { u, t, knoten: el("div", { class: "entwurf-abschnitt" }, u, t) };
      });
      const aktueller = () => ({ titel: titelFeld.value, abschnitte: abschnitte.map((a) => ({ ueberschrift: a.u.value, text: a.t.value })), hinweise: entwurf.hinweise || [] });
      const status = el("span", { class: "erfolg", "aria-live": "polite" });
      if (gast) {
        const sichern = () => speichern({ entwurf: aktueller() });
        titelFeld.addEventListener("change", sichern);
        abschnitte.forEach((a) => { a.u.addEventListener("change", sichern); a.t.addEventListener("change", sichern); });
      }
      bereich.replaceChildren(
        (entwurf.hinweise || []).length ? el("div", { class: "meldung hinweis" }, el("p", {}, el("strong", {}, "Vor dem Einreichen prüfen:")), el("ul", {}, entwurf.hinweise.map((h) => el("li", {}, h)))) : null,
        el("div", { class: "flaeche" },
          el("p", { class: "hilfe" }, "Sie können alle Texte direkt bearbeiten. Platzhalter in [eckigen Klammern] bitte ergänzen."),
          el("div", { class: "entwurf-abschnitt" }, titelFeld),
          abschnitte.map((a) => a.knoten),
          el("div", { class: "knoepfe nicht-drucken" },
            gast
              ? el("button", { type: "button", class: "haupt", onclick: async () => { await speichern({ entwurf: aktueller() }); location.hash = "#/anmelden"; } }, "Konto anlegen und Entwurf speichern")
              : el("button", { type: "button", class: "haupt", onclick: async () => { await speichern({ entwurf: aktueller() }); status.textContent = "Gespeichert."; } }, "Speichern"),
            el("button", { type: "button", class: "neben", onclick: () => alsWord(aktueller(), programm) }, "Als Word herunterladen"),
            el("button", { type: "button", class: "neben", onclick: () => alsPdf(aktueller(), programm) }, "Als PDF drucken"),
            el("button", { type: "button", class: "leise", onclick: () => schritt2(gast ? gastDaten.pruefung : antrag && antrag.pruefung) }, "Zurück zu den Rückfragen"),
            status)));
    };

    // Einstieg
    if (gast) {
      if (gastDaten.entwurf) schritt4(gastDaten.antworten || [], gastDaten.entwurf);
      else if (gastDaten.pruefung) schritt2(gastDaten.pruefung);
      else schritt1();
      return;
    }
    if (antrag && antrag.entwurf) schritt4(antrag.antworten || [], antrag.entwurf);
    else if (antrag && antrag.pruefung) schritt2(antrag.pruefung);
    else schritt1();
  }

  function assistentFehler(f, nochmal) {
    if (f && f.code === "limit_gast") {
      return [el("div", { class: "meldung hinweis", role: "alert" }, el("p", {}, f.message),
        el("p", {}, el("a", { class: "knopf haupt", href: "#/anmelden" }, "Kostenloses Konto anlegen")))];
    }
    return [meldung(fehlertext(f), f && f.code ? "hinweis" : "fehler"),
      el("button", { type: "button", class: "neben", onclick: nochmal }, "Erneut versuchen")];
  }

  function entwurfHtml(e, programm) {
    const esc = (t) => String(t || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const absatz = (t) => String(t || "").split(/\n\s*\n/).map((x) => `<p>${esc(x).replace(/\n/g, "<br>")}</p>`).join("");
    return `<h1>${esc(e.titel)}</h1><p><em>Entwurf für: ${esc(programm.titel)}${programm.foerdergeber ? " (" + esc(programm.foerdergeber) + ")" : ""}</em></p>` +
      e.abschnitte.map((a) => `<h2>${esc(a.ueberschrift)}</h2>${absatz(a.text)}`).join("") +
      `<p style="margin-top:24pt;font-size:9pt;color:#555">Erstellt mit dem Fördermittelkompass Thüringen. KI-gestützter Entwurf – bitte vor dem Einreichen prüfen und an die Vorgaben des Fördergebers anpassen.</p>`;
  }
  function alsWord(e, programm) {
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${(e.titel || "Antrag").replace(/</g, "")}</title>
<style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.4}h1{font-size:18pt;color:#1d3a31}h2{font-size:13pt;color:#1d3a31;margin-top:16pt}</style></head><body>${entwurfHtml(e, programm)}</body></html>`;
    const blob = new Blob(["﻿", html], { type: "application/msword" });
    const a = el("a", { href: URL.createObjectURL(blob), download: ((e.titel || "Antragsentwurf").replace(/[^\wäöüÄÖÜß\- ]+/g, "").trim() || "Antragsentwurf") + ".doc" });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  function alsPdf(e, programm) {
    const d = $("#druckbereich");
    d.innerHTML = entwurfHtml(e, programm);
    window.print();
  }

  // ------------------------------------------------------------------
  // Seite: Anträge
  // ------------------------------------------------------------------
  async function seiteAntraege(main) {
    const seite = el("div", { class: "seite" });
    main.append(seite);
    if (!angemeldet()) { seite.append(seitenkopf("Anträge"), anmeldenHinweis("Melden Sie sich an, um Anträge vorzubereiten.")); return; }
    seite.append(seitenkopf("Ihre Antragsentwürfe", "Vom Antragsassistenten gespeicherte Prüfungen und Entwürfe."));
    const { data, error } = await sb.from("antraege").select("id,programm_id,projekt_id,pruefung,entwurf,aktualisiert_am").order("aktualisiert_am", { ascending: false });
    if (error) throw error;
    if (!data.length) { seite.append(meldung("Noch keine Anträge. Öffnen Sie ein Programm und klicken Sie auf „Antrag vorbereiten“.")); return; }
    const { data: programme } = await sb.rpc("programm_details", { ids: [...new Set(data.map((a) => a.programm_id))] });
    const nachId = new Map((programme || []).map((p) => [p.id, p]));
    for (const a of data) {
      const p = nachId.get(a.programm_id) || { titel: "Programm" };
      const projekt = zustand.projekte.find((x) => x.id === a.projekt_id);
      const stand = a.entwurf ? "Entwurf vorhanden" : a.pruefung ? "Voraussetzungen geprüft" : "Begonnen";
      seite.append(el("div", { class: "eintrag" },
        el("h3", {}, (a.entwurf && a.entwurf.titel) || p.titel),
        el("p", { class: "meta" }, [p.titel, projekt ? `Projekt: ${projekt.titel}` : "", stand, `zuletzt ${datum(a.aktualisiert_am)}`].filter(Boolean).join(" · ")),
        el("div", { class: "knoepfe" },
          el("a", { class: "knopf neben", href: `#/assistent/${a.programm_id}?antrag=${a.id}` }, "Öffnen"),
          el("button", { type: "button", class: "leise gefahr", onclick: async () => {
            if (!window.confirm("Diesen Antragsentwurf löschen?")) return;
            await sb.from("antraege").delete().eq("id", a.id); zeigen();
          } }, "Löschen"))));
    }
  }

  // ------------------------------------------------------------------
  // Seiten: Impressum, Datenschutz
  // ------------------------------------------------------------------
  function betreiberBlock() {
    if (!E.BETREIBER_NAME) return meldung("Die Angaben zum Betreiber werden gerade ergänzt.", "hinweis");
    return el("p", {}, E.BETREIBER_NAME, el("br"), E.BETREIBER_ADRESSE, el("br"), "E-Mail: ", el("a", { href: "mailto:" + E.BETREIBER_EMAIL }, E.BETREIBER_EMAIL));
  }
  async function seiteImpressum(main) {
    main.append(el("div", { class: "seite" }, seitenkopf("Impressum"), el("div", { class: "flaeche" },
      el("h2", {}, "Angaben gemäß § 5 DDG"), betreiberBlock(),
      el("h2", {}, "Hinweis"), el("p", {}, "Alle Angaben zu Förderprogrammen ohne Gewähr. Maßgeblich sind die Richtlinien und Auskünfte der jeweiligen Fördergeber. Die Einschätzungen und Entwürfe werden mit Hilfe künstlicher Intelligenz erstellt und stellen keine Rechts- oder Fördermittelberatung dar."))));
  }
  async function seiteDatenschutz(main) {
    main.append(el("div", { class: "seite" }, seitenkopf("Datenschutz"), el("div", { class: "flaeche" },
      el("h2", {}, "Verantwortlich"), betreiberBlock(),
      el("h2", {}, "Welche Daten verarbeitet werden"),
      el("p", {}, "Wenn Sie ohne Konto suchen, wird Ihre Vorhabenbeschreibung zur Suche an unseren Datenbankdienst (Supabase) und zur Auswertung an Google (Gemini) übermittelt und nicht dauerhaft gespeichert."),
      el("p", {}, "Mit einem Konto speichern wir Ihre E-Mail-Adresse, Ihr Profil, Ihre Projekte, Ihre Merkliste und Ihre Antragsentwürfe, damit Sie sie wieder aufrufen können. Für den Fördermittelwecker senden wir Ihnen E-Mails über einen Versanddienst (Resend). Sie können Ihre Daten jederzeit im Profil löschen."),
      el("h2", {}, "Dienstleister"),
      el("p", {}, "Supabase (Datenbank und Anmeldung), Google (KI-Auswertung mit Gemini), Resend (E-Mail-Versand), GitHub (Bereitstellung der Website), Google Fonts (Schriften)."),
      meldung("Dieser Text ist eine Vorlage und muss vor dem öffentlichen Betrieb rechtlich geprüft und vervollständigt werden (u. a. Rechtsgrundlagen, Speicherdauer, Ihre Rechte, Drittlandübermittlung).", "hinweis"))));
  }

  // ------------------------------------------------------------------
  // Gemeinsame Bausteine für Einstieg, Arbeitsbereich und Projektseite
  // ------------------------------------------------------------------
  const GRUPPEN_TEXT = {
    privatpersonen: "Haus, Wohnung, Energie, Familie",
    gruendung: "Geschäftsidee, Gründung, erste Jahre",
    unternehmen: "Investition, Innovation, Digitalisierung, Personal",
    kommunen: "Ortsentwicklung, Infrastruktur, Klimaschutz",
    oeffentlich: "Schulen, Kitas, soziale Einrichtungen",
    vereine: "Vereinsleben, Ehrenamt, Kultur, Sport",
    forschung: "Forschung, Transfer, Kooperationen",
    bildung: "Bildungsangebote, Ausstattung, Weiterbildung",
    landwirtschaft: "Hof, Betrieb, ländliche Entwicklung",
  };
  const EINSTIEG_SCHLUESSEL = "foerderkompass_einstieg";
  function einstiegLaden() { try { return JSON.parse(localStorage.getItem(EINSTIEG_SCHLUESSEL) || "null"); } catch { return null; } }
  function einstiegSpeichern(d) { try { localStorage.setItem(EINSTIEG_SCHLUESSEL, JSON.stringify(d)); } catch { /* privat */ } }
  function einstiegLoeschen() { try { localStorage.removeItem(EINSTIEG_SCHLUESSEL); } catch { /* egal */ } }

  function profilTextAus(o) {
    if (!o) return "";
    return [o.name && `Name: ${o.name}`, o.rechtsform && `Rechtsform: ${o.rechtsform}`,
      o.mitarbeitende && `Mitarbeitende: ${o.mitarbeitende}`, o.taetigkeitsfeld && `Tätigkeitsfeld: ${o.taetigkeitsfeld}`,
      o.beschreibung && `Über uns: ${o.beschreibung}`].filter(Boolean).join(". ");
  }
  function vorhabenText(v) {
    return [v.titel, v.beschreibung, v.kosten_euro ? `Kosten etwa ${Number(v.kosten_euro).toLocaleString("de-DE")} Euro.` : ""]
      .filter(Boolean).join(". ");
  }
  function empfehlungenAus(daten) {
    return (daten.ergebnisse || []).map((p) => ({
      id: p.id, titel: p.titel, kurztext: p.kurztext, foerderart: p.foerderart, foerdergeber: p.foerdergeber,
      ebene: p.ebene, link: p.link, fristen: p.fristen, einstufung: p.einstufung, punkte: p.punkte,
      begruendung: p.begruendung, offene_fragen: p.offene_fragen,
    }));
  }
  async function empfehlungenSpeichern(projektId, daten) {
    if (!angemeldet() || !daten || !daten.bewertet) return;
    const empfehlungen = empfehlungenAus(daten);
    const jetzt = new Date().toISOString();
    try {
      await sb.from("projekte").update({ empfehlungen, empfehlungen_am: jetzt }).eq("id", projektId).throwOnError();
      const p = zustand.projekte.find((x) => x.id === projektId);
      if (p) { p.empfehlungen = empfehlungen; p.empfehlungen_am = jetzt; }
    } catch (f) { console.error("Empfehlungen nicht gespeichert", f); }
  }

  // Suche in zwei Stufen (schnelle Vorschau, dann KI-Bewertung) in einen Kasten
  async function suchenUndZeigen(box, anfrage, { projektId = null, nachBewertung = null } = {}) {
    const nummer = ++zustand.suchnummer;
    box.replaceChildren(ladeanzeige("Der Kompass sucht passende Förderprogramme …"));
    try {
      const vorschau = await funktion("matching", { ...anfrage, nur_suche: true });
      if (nummer !== zustand.suchnummer) return null;
      const treffer = (vorschau.ergebnisse || []).length > 0;
      ergebnisseZeigen(box, vorschau, projektId, { vorschau: treffer, fokus: false });
      if (!treffer) return vorschau;
      let bewertet;
      try { bewertet = await funktion("matching", anfrage); } catch (_) { bewertet = { ...vorschau, bewertet: false }; }
      if (nummer !== zustand.suchnummer) return null;
      ergebnisseZeigen(box, bewertet, projektId, { fokus: false });
      if (nachBewertung) await nachBewertung(bewertet);
      return bewertet;
    } catch (f) {
      if (f.code === "limit_gast") {
        box.replaceChildren(el("div", { class: "meldung hinweis", role: "alert" }, el("p", {}, f.message),
          el("p", {}, el("a", { class: "knopf haupt", href: "#/anmelden" }, "Kostenloses Konto anlegen"))));
      } else {
        box.replaceChildren(meldung(fehlertext(f), f.code ? "hinweis" : "fehler"));
      }
      return null;
    }
  }

  function anzahlText(n, eins, mehr) { return `${n} ${n === 1 ? eins : mehr}`; }

  function hoehenlinienKopf() {
    const kopf = el("header", { class: "kopf" });
    kopf.innerHTML = `<svg class="hoehenlinien" viewBox="0 0 800 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g fill="none" stroke="#1d3a31" stroke-opacity=".09" stroke-width="1.4"><path d="M-20 250 C 120 200, 220 230, 330 170 S 560 90, 820 140"/><path d="M-20 222 C 110 176, 230 204, 340 146 S 560 66, 820 112"/><path d="M-20 194 C 100 152, 240 178, 350 122 S 565 44, 820 86"/><path d="M-20 166 C 95 130, 250 152, 362 100 S 570 26, 820 62"/><path d="M-20 138 C 90 108, 262 126, 376 80 S 578 12, 820 40"/><path d="M-20 110 C 88 88, 276 102, 392 62 S 590 2, 820 20"/><path d="M480 300 C 520 260, 600 250, 650 270 S 760 300, 820 280"/></g></svg>`;
    return kopf;
  }

  // ------------------------------------------------------------------
  // Seite: Startseite (öffentlich)
  // ------------------------------------------------------------------
  async function seiteLanding(main) {
    const kopf = hoehenlinienKopf();
    kopf.classList.add("landing");
    kopf.append(el("div", { class: "seite breit landing-raster" },
      el("div", {},
        el("h1", {}, "Fördermittel für Ihr Vorhaben in Thüringen – gefunden in fünf Minuten."),
        el("p", { class: "einleitung" }, "Der Kompass kennt die Förderprogramme des Landes, des Bundes, der EU und aller 15 LEADER-Regionen in Thüringen. Sie beantworten ein paar Fragen, die KI prüft jedes Programm für Sie und hilft beim Antrag."),
        el("div", { class: "knoepfe", style: "margin-top:24px" },
          el("a", { class: "knopf haupt gross", href: "#/start" }, "Kostenlos starten"),
          el("a", { class: "knopf neben", href: "#/suche" }, "Direkt suchen")),
        el("p", { class: "hilfe", style: "margin-top:14px" }, "Ohne Anmeldung ausprobieren. Ein Konto brauchen Sie erst zum Speichern.")),
      beispielKarte()));
    main.append(kopf);

    const schritte = [
      ["Erzählen Sie von sich", "Wer Sie sind und wo – oder geben Sie einfach Ihre Website an, die KI füllt den Rest aus."],
      ["Beschreiben Sie Ihr Vorhaben", "In eigenen Worten. Noch keine konkrete Idee? Die KI schlägt förderfähige Projekte vor."],
      ["Erhalten Sie Empfehlungen", "Jedes passende Programm mit Passung in Prozent, Begründung und offenen Fragen."],
      ["Bereiten Sie den Antrag vor", "Der Assistent prüft die Voraussetzungen und schreibt einen ersten Entwurf – als Word oder PDF."],
    ];
    const leistungen = [
      ["Regional statt nur bundesweit", "Neben Land, Bund und EU auch die Aufrufe der LEADER-Regionen und Regionalbudgets – das, was in Thüringen vor Ort wirklich zählt."],
      ["Fördermittelwecker", "Speichern Sie Ihr Projekt, und wir melden uns jeden Montag, wenn ein neues passendes Programm dazukommt."],
      ["Merkliste und Vergleich", "Programme mit Status und Notizen verwalten und nebeneinander vergleichen."],
      ["Für alle, die Förderung suchen", "Privathaushalte, Gründer:innen, Unternehmen, Vereine, Kommunen, Bildung und Forschung."],
    ];
    main.append(el("div", { class: "seite breit" },
      el("section", { class: "abschnitt" },
        el("h2", {}, "So funktioniert's"),
        el("ol", { class: "ablauf" }, schritte.map(([t, x]) => el("li", {}, el("h3", {}, t), el("p", {}, x))))),
      el("section", { class: "abschnitt" },
        el("h2", {}, "Was der Kompass für Sie tut"),
        el("div", { class: "leistungen" }, leistungen.map(([t, x]) => el("div", {}, el("h3", {}, t), el("p", {}, x))))),
      el("section", { class: "abschnitt aufruf" },
        el("h2", {}, "Bereit?"),
        el("p", {}, "Fünf Minuten, und Sie wissen, welche Förderung für Ihr Vorhaben infrage kommt."),
        el("a", { class: "knopf haupt gross", href: "#/start" }, "Kostenlos starten"))));
  }
  function beispielKarte() {
    return el("div", { class: "beispiel", "aria-hidden": "true" },
      el("p", { class: "beispiel-titel" }, "Beispiel: Heimatverein im Landkreis Gotha"),
      [["LEADER-Förderung Gotha-Ilm-Kreis-Erfurt", 92, "passt"], ["Regionalbudget für Kleinprojekte", 85, "passt"],
       ["Solidarisches Zusammenleben der Generationen", 64, "passt_teilweise"]].map(([t, pz, e]) =>
        el("div", { class: "beispiel-zeile " + e }, el("span", {}, t), passungAnzeige(pz))));
  }

  // ------------------------------------------------------------------
  // Seite: Geführter Einstieg (#/start)
  // ------------------------------------------------------------------
  async function seiteEinstieg(main, r) {
    const seite = el("div", { class: "seite" });
    main.append(seite);
    const s = einstiegLaden() || {};
    s.organisation = s.organisation || {};
    s.vorhaben = s.vorhaben || {};
    const o = zustand.organisation;
    if (angemeldet() && o && !s.organisation.zielgruppe) {
      s.organisation = { name: o.name || "", zielgruppe: o.zielgruppe || "", rechtsform: o.rechtsform || "", landkreis: o.landkreis || "",
        taetigkeitsfeld: o.taetigkeitsfeld || "", beschreibung: o.beschreibung || "", website: o.website || "" };
    }
    const neu = r.params.get("neu");
    if (neu) { s.vorhaben = {}; s.ideen = null; s.ergebnis = null; }
    let start = Number(r.params.get("schritt")) || s.schritt || 1;
    if (start > 1 && !s.organisation.zielgruppe) start = 1;
    if (start > 3 && !(s.vorhaben.beschreibung || "").trim()) start = 3;
    const merken = () => einstiegSpeichern(s);

    const TITEL = ["Wer sind Sie?", "Über Sie", "Ihr Vorhaben", "Ihre Empfehlungen"];
    const leiste = el("ol", { class: "schritte", "aria-label": "Fortschritt" });
    const bereich = el("div", { class: "einstieg" });
    seite.append(el("div", { class: "seitenkopf" }, el("h1", { class: "klein" }, "Passende Förderung finden"),
      el("p", {}, angemeldet() ? "In vier Schritten zu Ihren Empfehlungen." : "In vier Schritten zu Ihren persönlichen Empfehlungen – ohne Anmeldung.")),
      leiste, bereich);

    const gehe = (n) => {
      s.schritt = n; merken();
      leiste.replaceChildren(...TITEL.map((t, i) => el("li", { "aria-current": i + 1 === n ? "step" : null },
        i + 1 < n ? el("button", { type: "button", class: "schritt-knopf", onclick: () => gehe(i + 1) }, `${i + 1}. ${t}`) : `${i + 1}. ${t}`)));
      [null, schritt1, schritt2, schritt3, schritt4][n]();
      window.scrollTo(0, 0);
    };
    const navi = (zurueck, weiterText, weiter) => el("div", { class: "knoepfe einstieg-navi" },
      zurueck ? el("button", { type: "button", class: "neben", onclick: zurueck }, "Zurück") : null,
      weiter ? el("button", { type: "submit", class: "haupt" }, weiterText) : null);

    // Schritt 1: Wer sind Sie?
    const schritt1 = () => {
      bereich.replaceChildren(el("div", { class: "kacheln", role: "list" },
        zustand.zielgruppen.map(([slug, name]) => el("button", {
          type: "button", role: "listitem", class: "kachel" + (s.organisation.zielgruppe === slug ? " gewaehlt" : ""),
          onclick: () => {
            s.organisation.zielgruppe = slug;
            if (slug === "privatpersonen" && !s.organisation.rechtsform) s.organisation.rechtsform = "Privatperson";
            gehe(2);
          },
        }, el("span", { class: "kachel-titel" }, name), el("span", { class: "kachel-text" }, GRUPPEN_TEXT[slug] || "")))));
    };

    // Schritt 2: Über Sie (mit Website-Auslesen)
    const schritt2 = () => {
      const og = s.organisation;
      const auswahl = (id, werte, wert, leer) => {
        const sel = el("select", { id }, el("option", { value: "" }, leer),
          werte.map((w) => { const [v, t] = Array.isArray(w) ? w : [w, w]; return el("option", { value: v }, t); }));
        sel.value = wert || ""; return sel;
      };
      const f = {
        name: el("input", { type: "text", id: "e-name", maxlength: "200", value: og.name || "", placeholder: og.zielgruppe === "privatpersonen" ? "optional" : "z. B. Heimatverein Musterdorf e. V." }),
        landkreis: auswahl("e-landkreis", LANDKREISE, og.landkreis, "Bitte wählen"),
        rechtsform: auswahl("e-rechtsform", RECHTSFORMEN, og.rechtsform, "Bitte wählen"),
        feld: el("input", { type: "text", id: "e-feld", maxlength: "300", value: og.taetigkeitsfeld || "", placeholder: "z. B. Jugendarbeit, Bäckerei, Maschinenbau" }),
        beschreibung: el("textarea", { id: "e-beschreibung", maxlength: "2000", placeholder: "Was machen Sie, für wen, seit wann? Zwei, drei Sätze genügen." }, og.beschreibung || ""),
      };
      const url = el("input", { type: "url", id: "e-url", value: og.website || "", placeholder: "www.ihre-website.de", inputmode: "url" });
      const urlKnopf = el("button", { type: "button", class: "neben" }, "Website auslesen");
      const urlRueck = el("div", { "aria-live": "polite" });
      urlKnopf.addEventListener("click", async () => {
        if (!url.value.trim()) { urlRueck.replaceChildren(el("p", { class: "formfehler" }, "Bitte geben Sie eine Website-Adresse ein.")); return; }
        urlKnopf.disabled = true;
        urlRueck.replaceChildren(ladeanzeige("Die KI liest Ihre Website …"));
        try {
          const { profil } = await funktion("ideen", { aktion: "website", url: url.value.trim() });
          if (profil.name) f.name.value = profil.name;
          if (profil.landkreis) f.landkreis.value = profil.landkreis;
          if (profil.rechtsform) f.rechtsform.value = profil.rechtsform;
          if (profil.taetigkeitsfeld) f.feld.value = profil.taetigkeitsfeld;
          if (profil.beschreibung) f.beschreibung.value = profil.beschreibung;
          if (profil.zielgruppe && profil.zielgruppe !== og.zielgruppe) og.zielgruppe_vorschlag = profil.zielgruppe;
          og.website = profil.website || url.value.trim();
          urlRueck.replaceChildren(el("p", { class: "erfolg" }, "Übernommen – bitte kurz prüfen und bei Bedarf anpassen."));
        } catch (fe) {
          urlRueck.replaceChildren(...(fe.code === "limit_gast" ? assistentFehler(fe) : [el("p", { class: "formfehler" }, fehlertext(fe))]));
        }
        urlKnopf.disabled = false;
      });
      const zeile = (id, text, feld, hilfe) => el("div", { class: "feldgruppe" }, el("label", { class: "feld", for: id }, text), hilfe ? el("p", { class: "hilfe" }, hilfe) : null, feld);
      const fehler = el("p", { class: "formfehler", role: "alert" });
      const form = el("form", { class: "flaeche", novalidate: true },
        el("div", { class: "website-kasten" },
          el("label", { class: "titel", for: "e-url" }, "Haben Sie eine Website?"),
          el("p", { class: "hilfe" }, "Dann füllt die KI die Angaben unten für Sie aus."),
          el("div", { class: "zeile-mit-knopf" }, url, urlKnopf), urlRueck),
        el("div", { class: "raster" },
          zeile("e-name", "Name", f.name),
          zeile("e-landkreis", "Landkreis / Stadt", f.landkreis),
          zeile("e-rechtsform", "Rechtsform", f.rechtsform),
          zeile("e-feld", "Tätigkeitsfeld", f.feld)),
        zeile("e-beschreibung", "Kurz über Sie", f.beschreibung, "Hilft der KI, passende Programme und Ideen zu finden."),
        fehler,
        navi(() => { leseFelder(); gehe(1); }, "Weiter", true));
      const leseFelder = () => {
        Object.assign(og, { name: f.name.value.trim(), landkreis: f.landkreis.value, rechtsform: f.rechtsform.value,
          taetigkeitsfeld: f.feld.value.trim(), beschreibung: f.beschreibung.value.trim() });
        merken();
      };
      form.addEventListener("submit", (ev) => {
        ev.preventDefault(); leseFelder();
        if (!og.landkreis) { fehler.textContent = "Bitte wählen Sie Ihren Landkreis oder Ihre Stadt."; f.landkreis.focus(); return; }
        gehe(3);
      });
      bereich.replaceChildren(form);
    };

    // Schritt 3: Vorhaben – eigene Idee oder KI-Vorschläge
    const schritt3 = () => {
      const v = s.vorhaben;
      const modus = s.modus || "idee";
      const wahl = el("div", { class: "wahl", role: "radiogroup", "aria-label": "Wie möchten Sie weitermachen?" },
        [["idee", "Ich habe schon eine Idee", "Beschreiben Sie Ihr Vorhaben in eigenen Worten."],
         ["vorschlag", "Schlagen Sie mir Ideen vor", "Die KI entwickelt förderfähige Projekte passend zu Ihnen."]].map(([wert, titel, text]) =>
          el("button", { type: "button", role: "radio", "aria-checked": modus === wert ? "true" : "false", class: "wahl-karte",
            onclick: () => { s.modus = wert; merken(); schritt3(); } },
            el("span", { class: "kachel-titel" }, titel), el("span", { class: "kachel-text" }, text))));
      const inhalt = el("div");
      bereich.replaceChildren(wahl, inhalt);

      if (modus === "idee") {
        const titel = el("input", { type: "text", id: "v-titel", maxlength: "200", value: v.titel || "", placeholder: "z. B. Spielplatz am Dorfteich" });
        const text = el("textarea", { id: "v-text", maxlength: "4000", placeholder: "Was soll entstehen? Wer profitiert? Bis wann?" }, v.beschreibung || "");
        const kosten = el("input", { type: "number", id: "v-kosten", min: "0", step: "100", value: v.kosten_euro || "" });
        const fehler = el("p", { class: "formfehler", role: "alert" });
        const form = el("form", { class: "flaeche", novalidate: true },
          el("div", { class: "feldgruppe" }, el("label", { class: "feld", for: "v-titel" }, "Titel (optional)"), titel),
          el("div", { class: "feldgruppe" }, el("label", { class: "feld", for: "v-text" }, "Was haben Sie vor?"), text),
          el("div", { class: "feldgruppe", style: "max-width:260px" }, el("label", { class: "feld", for: "v-kosten" }, "Geschätzte Kosten in Euro (optional)"), kosten),
          fehler, navi(() => gehe(2), "Empfehlungen anzeigen", true));
        form.addEventListener("submit", (ev) => {
          ev.preventDefault();
          if (text.value.trim().length < 15) { fehler.textContent = "Bitte beschreiben Sie Ihr Vorhaben in ein, zwei Sätzen."; text.focus(); return; }
          s.vorhaben = { titel: titel.value.trim(), beschreibung: text.value.trim(), kosten_euro: kosten.value ? Number(kosten.value) : null };
          s.ergebnis = null; merken(); gehe(4);
        });
        inhalt.append(form);
        return;
      }

      // KI-Projektideen
      const wunsch = el("input", { type: "text", id: "v-wunsch", maxlength: "300", value: s.wunsch || "", placeholder: "optional, z. B. Energie sparen, Jugendarbeit, Digitalisierung" });
      const knopf = el("button", { type: "button", class: "haupt" }, s.ideen ? "Neue Ideen entwickeln" : "Ideen entwickeln");
      const ideenBox = el("div", { "aria-live": "polite" });
      const zeigeIdeen = () => {
        ideenBox.replaceChildren(...(s.ideen || []).map((i) => el("article", { class: "idee" },
          el("h3", {}, i.titel),
          el("p", {}, i.beschreibung),
          i.nutzen ? el("p", { class: "kurz" }, i.nutzen) : null,
          (i.themen || []).length ? el("ul", { class: "arten" }, i.themen.map((t) => el("li", {}, t))) : null,
          (i.programme || []).length ? el("p", { class: "idee-programme" }, el("strong", {}, "Zum Beispiel: "),
            i.programme.flatMap((p, n) => [n ? " · " : "", el("a", { href: "#/programm/" + p.id }, p.titel)])) : null,
          el("button", { type: "button", class: "haupt", onclick: () => {
            s.vorhaben = { titel: i.titel, beschreibung: i.beschreibung, kosten_euro: null };
            s.modus = "idee"; s.ergebnis = null; merken(); gehe(4);
          } }, "Mit dieser Idee weiter"))));
      };
      knopf.addEventListener("click", async () => {
        s.wunsch = wunsch.value.trim(); merken();
        knopf.disabled = true;
        ideenBox.replaceChildren(ladeanzeige("Die KI entwickelt Projektideen für Sie. Das dauert etwa 15 Sekunden …"));
        try {
          const og = s.organisation;
          const { ideen } = await funktion("ideen", { aktion: "ideen", wunsch: s.wunsch,
            organisation: { ...og, zielgruppe_name: gruppenName(og.zielgruppe) } });
          s.ideen = ideen; merken(); zeigeIdeen();
          knopf.textContent = "Neue Ideen entwickeln";
        } catch (fe) {
          ideenBox.replaceChildren(...assistentFehler(fe, () => knopf.click()));
        }
        knopf.disabled = false;
      });
      inhalt.append(el("div", { class: "flaeche" },
        el("div", { class: "feldgruppe" }, el("label", { class: "feld", for: "v-wunsch" }, "Worum soll es gehen?"), wunsch),
        el("div", { class: "knoepfe" }, el("button", { type: "button", class: "neben", onclick: () => gehe(2) }, "Zurück"), knopf)),
        ideenBox);
      if (s.ideen) zeigeIdeen();
    };

    // Schritt 4: Empfehlungen
    const schritt4 = async () => {
      const og = s.organisation, v = s.vorhaben;
      const zusammenfassung = el("div", { class: "flaeche zusammenfassung-kasten" },
        el("p", { class: "meta" }, [gruppenName(og.zielgruppe), og.name, og.landkreis].filter(Boolean).join(" · ")),
        el("h2", {}, v.titel || "Ihr Vorhaben"),
        el("p", {}, v.beschreibung),
        el("button", { type: "button", class: "leise", onclick: () => gehe(3) }, "Vorhaben ändern"));
      const box = el("div", { id: "ergebnisse", "aria-live": "polite" });
      const sichern = el("div");
      bereich.replaceChildren(zusammenfassung, sichern, box);

      const sichernZeigen = (daten) => {
        if (!daten || !(daten.ergebnisse || []).length) { sichern.replaceChildren(); return; }
        if (angemeldet()) {
          if (s.gespeichertesProjekt) {
            sichern.replaceChildren(el("div", { class: "meldung" }, el("p", {}, "Gespeichert als Projekt. ",
              el("a", { href: "#/projekt/" + s.gespeichertesProjekt }, "Zum Projekt"))));
            return;
          }
          const k = el("button", { type: "button", class: "haupt" }, "Als Projekt speichern");
          k.addEventListener("click", async () => {
            k.disabled = true;
            try {
              const id = await einstiegAlsProjekt(s, daten);
              location.hash = "#/projekt/" + id;
            } catch (fe) { k.disabled = false; alertFrei(k, fehlertext(fe)); }
          });
          sichern.replaceChildren(el("div", { class: "sichern-kasten" },
            el("div", {}, el("strong", {}, "Projekt speichern"), el("p", {}, "Empfehlungen behalten und jeden Montag über neue passende Programme informiert werden.")), k));
        } else {
          sichern.replaceChildren(el("div", { class: "sichern-kasten" },
            el("div", {}, el("strong", {}, "Ergebnisse sichern – kostenlos"),
              el("p", {}, "Mit einem Konto speichern wir Ihr Profil, dieses Projekt und die Empfehlungen. Der Fördermittelwecker meldet sich, wenn neue passende Programme dazukommen.")),
            el("a", { class: "knopf haupt", href: "#/anmelden" }, "Kostenlos speichern")));
        }
      };

      const anfrage = {
        vorhaben: vorhabenText(v), zielgruppe: og.zielgruppe || null, zielgruppe_name: gruppenName(og.zielgruppe),
        standort: og.landkreis || "", profil: profilTextAus(og),
      };
      const schluessel = JSON.stringify(anfrage);
      if (s.ergebnis && s.ergebnis.schluessel === schluessel && s.ergebnis.daten && s.ergebnis.daten.bewertet) {
        ergebnisseZeigen(box, s.ergebnis.daten, null, { fokus: false });
        sichernZeigen(s.ergebnis.daten);
        return;
      }
      s.gespeichertesProjekt = null;
      await suchenUndZeigen(box, anfrage, { nachBewertung: async (daten) => {
        s.ergebnis = { schluessel, daten }; s.alsGast = !angemeldet(); merken();
        sichernZeigen(daten);
      } });
    };

    gehe(start);
  }

  async function einstiegAlsProjekt(s, daten) {
    const og = s.organisation || {};
    const profilFelder = { name: og.name || null, zielgruppe: og.zielgruppe || null, rechtsform: og.rechtsform || null,
      landkreis: og.landkreis || null, taetigkeitsfeld: og.taetigkeitsfeld || null, beschreibung: og.beschreibung || null,
      website: og.website || null };
    if (!zustand.organisation) {
      const { data } = await sb.from("organisationen").insert(profilFelder).select().single().throwOnError();
      zustand.organisation = data;
    } else {
      // nur leere Felder ergänzen, nichts Vorhandenes überschreiben
      const ergaenzen = {};
      for (const [k, w] of Object.entries(profilFelder)) if (w && !zustand.organisation[k]) ergaenzen[k] = w;
      if (Object.keys(ergaenzen).length) {
        const { data } = await sb.from("organisationen").update(ergaenzen).eq("id", zustand.organisation.id).select().single().throwOnError();
        zustand.organisation = data;
      }
    }
    const v = s.vorhaben || {};
    const { data: pr } = await sb.from("projekte").insert({
      titel: v.titel || v.beschreibung.slice(0, 60), beschreibung: v.beschreibung, kosten_euro: v.kosten_euro || null,
    }).select("id,titel,beschreibung,kosten_euro,beginn,wecker_aktiv,erstellt_am,aktualisiert_am").single().throwOnError();
    zustand.projekte.unshift(pr);
    if (daten && daten.bewertet) await empfehlungenSpeichern(pr.id, daten);
    s.gespeichertesProjekt = pr.id;
    einstiegLoeschen();
    return pr.id;
  }

  // ------------------------------------------------------------------
  // Seite: Arbeitsbereich (Übersicht nach der Anmeldung)
  // ------------------------------------------------------------------
  async function seiteArbeitsbereich(main) {
    const seite = el("div", { class: "seite breit" });
    main.append(seite);
    if (!angemeldet()) { location.hash = "#/"; return; }
    const o = zustand.organisation || {};
    const { data: projekte } = await sb.from("projekte").select("id,titel,beschreibung,kosten_euro,wecker_aktiv,empfehlungen,empfehlungen_am,erstellt_am").order("erstellt_am", { ascending: false });
    const { data: antraege } = await sb.from("antraege").select("id,programm_id,entwurf,pruefung,aktualisiert_am").order("aktualisiert_am", { ascending: false }).limit(5);
    const merkIds = [...new Set(zustand.merkliste.map((m) => m.programm_id))].slice(0, 50);
    const programme = merkIds.length ? ((await sb.rpc("programm_details", { ids: merkIds })).data || []) : [];
    const progNach = new Map(programme.map((p) => [p.id, p]));
    const antragProgramme = (antraege || []).length ? ((await sb.rpc("programm_details", { ids: [...new Set(antraege.map((a) => a.programm_id))] })).data || []) : [];
    const antragProgNach = new Map(antragProgramme.map((p) => [p.id, p]));

    // Nächste Schritte
    const schritte = [];
    const profilFelder = ["name", "zielgruppe", "landkreis", "rechtsform", "beschreibung"];
    const fehlend = profilFelder.filter((k) => !o[k]).length;
    if (fehlend) schritte.push(["Profil vervollständigen", `${profilFelder.length - fehlend} von ${profilFelder.length} Angaben ausgefüllt – je vollständiger, desto genauer die Empfehlungen.`, "#/profil", "Profil öffnen"]);
    if (!(projekte || []).length) schritte.push(["Erstes Projekt anlegen", "Beschreiben Sie Ihr Vorhaben oder lassen Sie sich Ideen vorschlagen.", "#/start?schritt=3&neu=1", "Los geht's"]);
    for (const p of (projekte || []).filter((x) => !x.empfehlungen).slice(0, 2)) {
      schritte.push([`Empfehlungen für „${p.titel}“`, "Für dieses Projekt wurden noch keine Programme geprüft.", "#/projekt/" + p.id, "Jetzt prüfen"]);
    }
    for (const a of (antraege || []).filter((x) => !x.entwurf).slice(0, 2)) {
      const pr = antragProgNach.get(a.programm_id);
      schritte.push(["Antrag fortsetzen", pr ? pr.titel : "Begonnener Antrag", `#/assistent/${a.programm_id}?antrag=${a.id}`, "Fortsetzen"]);
    }
    const mitFrist = zustand.merkliste.filter((m) => !["abgelehnt", "bewilligt", "beantragt"].includes(m.status))
      .map((m) => progNach.get(m.programm_id)).filter((p) => p && p.fristen).slice(0, 3);
    for (const p of mitFrist) schritte.push([`Frist beachten: ${p.titel}`, kuerzen(p.fristen, 140), "#/programm/" + p.id, "Ansehen"]);

    const gruss = o.name ? `Willkommen zurück, ${o.name}` : "Willkommen in Ihrem Arbeitsbereich";
    seite.append(el("div", { class: "seitenkopf" }, el("h1", { class: "klein" }, gruss),
      el("p", {}, [anzahlText((projekte || []).length, "Projekt", "Projekte"),
        anzahlText(zustand.merkliste.length, "gemerktes Programm", "gemerkte Programme"),
        (antraege || []).length ? anzahlText(antraege.length, "Antrag in Arbeit", "Anträge in Arbeit") : "noch keine Anträge"].join(" · "))));

    if (schritte.length) {
      seite.append(el("section", { class: "flaeche naechste" }, el("h2", {}, "Nächste Schritte"),
        el("ul", { class: "schrittliste" }, schritte.slice(0, 6).map(([t, x, href, knopf]) =>
          el("li", {}, el("div", {}, el("strong", {}, t), el("p", {}, x)), el("a", { class: "knopf neben", href }, knopf))))));
    }

    // Projekte mit Empfehlungen
    const projektBereich = el("section", { class: "abschnitt-innen" },
      el("div", { class: "kopfzeile" }, el("h2", {}, "Ihre Projekte"),
        el("a", { class: "knopf neben", href: "#/start?schritt=3&neu=1" }, "Neues Vorhaben")));
    if (!(projekte || []).length) {
      projektBereich.append(meldung("Noch keine Projekte. Starten Sie mit „Neues Vorhaben“."));
    } else {
      projektBereich.append(el("div", { class: "projektraster" }, projekte.map((p) => {
        const e = p.empfehlungen || [];
        const gut = e.filter((x) => x.einstufung === "passt").length;
        const teils = e.filter((x) => x.einstufung === "passt_teilweise").length;
        const top = e.filter((x) => x.einstufung !== "passt_nicht").sort((a, b) => (b.punkte ?? 0) - (a.punkte ?? 0)).slice(0, 3);
        return el("article", { class: "projektkarte" },
          el("h3", {}, el("a", { href: "#/projekt/" + p.id }, p.titel)),
          el("p", { class: "meta" }, [p.wecker_aktiv ? "Wecker an" : "Wecker aus",
            p.empfehlungen_am ? `geprüft am ${datum(p.empfehlungen_am)}` : "noch nicht geprüft"].join(" · ")),
          e.length ? el("p", { class: "zahlen" }, el("span", { class: "punkt passt" }), ` ${gut} passen gut  `,
            el("span", { class: "punkt passt_teilweise" }), ` ${teils} möglicherweise`) : null,
          top.length ? el("ul", { class: "top-liste" }, top.map((x) => el("li", {},
            el("a", { href: "#/programm/" + x.id }, x.titel), passungAnzeige(x.punkte)))) :
            el("p", { class: "kurz" }, kuerzen(p.beschreibung, 160)),
          el("a", { class: "knopf " + (e.length ? "neben" : "haupt"), href: "#/projekt/" + p.id }, e.length ? "Alle Empfehlungen" : "Empfehlungen ermitteln"));
      })));
    }
    seite.append(projektBereich);

    // Merkliste und Anträge
    const zaehl = (st) => zustand.merkliste.filter((m) => m.status === st).length;
    seite.append(el("div", { class: "zweispaltig" },
      el("section", { class: "flaeche" }, el("h2", {}, "Merkliste"),
        zustand.merkliste.length
          ? el("ul", { class: "statuszahlen" }, MERK_STATUS.filter(([st]) => zaehl(st)).map(([st, t]) =>
              el("li", {}, el("span", {}, t), el("strong", {}, String(zaehl(st))))))
          : el("p", { class: "kurz" }, "Noch nichts gemerkt."),
        el("a", { class: "knopf neben", href: "#/merkliste" }, "Zur Merkliste")),
      el("section", { class: "flaeche" }, el("h2", {}, "Anträge in Arbeit"),
        (antraege || []).length
          ? el("ul", { class: "einfache-liste" }, antraege.slice(0, 4).map((a) => {
              const pr = antragProgNach.get(a.programm_id);
              return el("li", {}, el("a", { href: `#/assistent/${a.programm_id}?antrag=${a.id}` },
                (a.entwurf && a.entwurf.titel) || (pr && pr.titel) || "Antrag"),
                el("span", { class: "meta" }, a.entwurf ? " – Entwurf fertig" : " – Voraussetzungen geprüft"));
            }))
          : el("p", { class: "kurz" }, "Öffnen Sie eine Empfehlung und klicken Sie auf „Antrag vorbereiten“."),
        el("a", { class: "knopf neben", href: "#/antraege" }, "Alle Anträge"))));
  }

  // ------------------------------------------------------------------
  // Seite: Projekt mit Empfehlungen
  // ------------------------------------------------------------------
  async function seiteProjekt(main, r) {
    const id = r.teile[1];
    const seite = el("div", { class: "seite" });
    main.append(seite);
    if (!angemeldet()) { location.hash = "#/anmelden"; return; }
    const { data: p } = await sb.from("projekte").select("*").eq("id", id).maybeSingle();
    if (!p) { seite.append(seitenkopf("Projekt nicht gefunden"), meldung("Dieses Projekt gibt es nicht (mehr).")); return; }
    const o = zustand.organisation || {};
    const wecker = el("input", { type: "checkbox" }); wecker.checked = p.wecker_aktiv;
    wecker.addEventListener("change", async () => {
      await sb.from("projekte").update({ wecker_aktiv: wecker.checked }).eq("id", p.id);
      const z = zustand.projekte.find((x) => x.id === p.id); if (z) z.wecker_aktiv = wecker.checked;
    });
    const box = el("div", { id: "ergebnisse", "aria-live": "polite" });
    const stand = el("p", { class: "meta" });
    const aktualisieren = el("button", { type: "button", class: "neben" }, "Neu prüfen");
    const pruefen = async () => {
      aktualisieren.disabled = true;
      await suchenUndZeigen(box, {
        vorhaben: vorhabenText(p), zielgruppe: o.zielgruppe || null, zielgruppe_name: gruppenName(o.zielgruppe),
        standort: o.landkreis || "", profil: profilTextAus(o), projekt_id: p.id,
      }, { projektId: p.id, nachBewertung: async (daten) => {
        await empfehlungenSpeichern(p.id, daten);
        stand.textContent = "Geprüft am " + datum(new Date());
      } });
      aktualisieren.disabled = false;
    };
    aktualisieren.addEventListener("click", pruefen);
    seite.append(
      el("div", { class: "seitenkopf" }, el("p", { class: "meta" }, el("a", { href: "#/projekte" }, "Projekte"), " / ", p.titel),
        el("h1", { class: "klein" }, p.titel), el("p", {}, p.beschreibung)),
      el("div", { class: "projektleiste" },
        el("label", { class: "schalter" }, wecker, "Fördermittelwecker"),
        el("a", { href: "#/merkliste?projekt=" + p.id }, "Merkliste dieses Projekts"),
        el("a", { href: "#/projekte" }, "Projekt bearbeiten"),
        el("span", { class: "abstand" }), stand, aktualisieren),
      box);
    if (p.empfehlungen && p.empfehlungen.length && !r.params.get("neu")) {
      stand.textContent = "Geprüft am " + datum(p.empfehlungen_am);
      ergebnisseZeigen(box, { ergebnisse: p.empfehlungen, bewertet: true }, p.id, { fokus: false });
    } else {
      await pruefen();
    }
  }

  // ------------------------------------------------------------------
  // Start
  // ------------------------------------------------------------------
  async function start() {
    const { data } = await sb.auth.getSession();
    zustand.sitzung = data.session;
    await Promise.all([zielgruppenLaden(), kontoLaden()]);
    sb.auth.onAuthStateChange(async (ereignis, sitzung) => {
      const vorher = zustand.sitzung && zustand.sitzung.user.id;
      zustand.sitzung = sitzung;
      if ((sitzung && sitzung.user.id) !== vorher) {
        await kontoLaden();
        if (ereignis === "SIGNED_IN") {
          const ziel = await gastUebernehmen();
          location.hash = ziel || "#/arbeitsbereich";
          return;
        }
        zeigen();
      }
    });
    window.addEventListener("hashchange", zeigen);
    if (zustand.sitzung) {
      const ziel = await gastUebernehmen();
      if (ziel) { location.hash = ziel; return; }
    }
    if (kamVomAnmeldelink && zustand.sitzung) {
      location.hash = "#/arbeitsbereich";
      return;
    }
    zeigen();
  }
  start();
})();
