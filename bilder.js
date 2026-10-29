/* =====================================================================
   Fördermittelkompass Thüringen – eigene Illustrationen (SVG)
   Farbwelt: Tannengrün, Wiesengrün, Bernstein; ruhig und flächig.
   ===================================================================== */
window.BILDER = {

  // Startseite: Thüringer Hügelland mit Dorf, Weg und Kompass als Sonne
  landschaft: `
<svg viewBox="0 0 560 420" role="img" aria-label="Illustration: Hügellandschaft mit Dorf, ein Weg führt zu einem Kompass am Himmel">
  <defs>
    <linearGradient id="himmel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e4efe8"/><stop offset="1" stop-color="#f4f8f5"/>
    </linearGradient>
    <clipPath id="rahmen"><rect x="0" y="0" width="560" height="420" rx="28"/></clipPath>
  </defs>
  <g clip-path="url(#rahmen)">
    <rect width="560" height="420" fill="url(#himmel)"/>
    <!-- Kompass als Sonne -->
    <g transform="translate(408 104)">
      <circle r="62" fill="#f6e7c4"/>
      <circle r="46" fill="#fff" stroke="#1d3a31" stroke-width="3"/>
      <g stroke="#1d3a31" stroke-width="2" stroke-linecap="round" opacity=".55">
        <line y1="-38" y2="-31"/><line y1="38" y2="31"/><line x1="-38" x2="-31"/><line x1="38" x2="31"/>
      </g>
      <g transform="rotate(28)">
        <path d="M0 -34 L9 0 L0 34 L-9 0 Z" fill="#1d3a31"/>
        <path d="M0 -34 L9 0 L-9 0 Z" fill="#2c7a4c"/>
      </g>
      <circle r="4" fill="#fff" stroke="#1d3a31" stroke-width="2"/>
    </g>
    <!-- Wolken -->
    <g fill="#fff" opacity=".9">
      <ellipse cx="120" cy="86" rx="46" ry="14"/><ellipse cx="148" cy="76" rx="28" ry="14"/>
      <ellipse cx="250" cy="58" rx="30" ry="9"/>
    </g>
    <!-- Hintere Berge (Thüringer Wald) -->
    <path d="M0 240 C 70 186 130 200 190 176 C 250 152 300 190 360 170 C 430 146 500 176 560 160 L560 420 L0 420 Z" fill="#a9c8b6"/>
    <g fill="#8fb39f">
      <path d="M60 214 l10 -26 l10 26 Z"/><path d="M78 210 l9 -22 l9 22 Z"/><path d="M300 186 l10 -26 l10 26 Z"/>
      <path d="M318 182 l8 -20 l8 20 Z"/><path d="M470 172 l10 -26 l10 26 Z"/><path d="M488 170 l8 -20 l8 20 Z"/>
    </g>
    <!-- Mittlerer Hügel mit Dorf -->
    <path d="M0 290 C 90 240 170 250 250 238 C 330 226 420 262 560 236 L560 420 L0 420 Z" fill="#7fa891"/>
    <g transform="translate(206 196)">
      <!-- Kirche -->
      <rect x="40" y="10" width="18" height="34" fill="#fff"/>
      <path d="M38 12 L49 -14 L60 12 Z" fill="#1d3a31"/>
      <rect x="46" y="22" width="6" height="8" rx="3" fill="#1d3a31"/>
      <!-- Häuser -->
      <rect x="0" y="24" width="30" height="20" fill="#fff"/><path d="M-3 26 L15 10 L33 26 Z" fill="#b5532f"/>
      <rect x="10" y="32" width="6" height="12" fill="#1d3a31" opacity=".8"/>
      <rect x="66" y="22" width="34" height="22" fill="#fff"/><path d="M63 24 L83 6 L103 24 Z" fill="#a86f12"/>
      <rect x="74" y="30" width="7" height="7" fill="#2b5446"/><rect x="86" y="30" width="7" height="7" fill="#2b5446"/>
      <rect x="108" y="28" width="24" height="16" fill="#fff"/><path d="M105 30 L120 16 L135 30 Z" fill="#b5532f"/>
    </g>
    <!-- Vordere Wiese -->
    <path d="M0 340 C 120 300 230 318 330 306 C 430 294 500 318 560 300 L560 420 L0 420 Z" fill="#5f8f74"/>
    <!-- Weg vom Vordergrund zum Dorf -->
    <path d="M150 420 C 190 380 300 372 268 340 C 240 312 250 292 262 246" fill="none" stroke="#f3ecd9" stroke-width="22" stroke-linecap="round"/>
    <path d="M150 420 C 190 380 300 372 268 340 C 240 312 250 292 262 246" fill="none" stroke="#e4d8b8" stroke-width="2" stroke-dasharray="2 10" stroke-linecap="round"/>
    <!-- Person auf dem Weg, mit Mappe -->
    <g transform="translate(226 356)">
      <circle cx="0" cy="-34" r="7" fill="#3c2f22"/>
      <path d="M-7 -26 Q0 -30 7 -26 L9 -4 L-9 -4 Z" fill="#a86f12"/>
      <rect x="-8" y="-5" width="6" height="18" rx="3" fill="#1d3a31" transform="rotate(8 -5 -5)"/>
      <rect x="2" y="-5" width="6" height="18" rx="3" fill="#1d3a31" transform="rotate(-10 5 -5)"/>
      <rect x="8" y="-20" width="12" height="15" rx="2" fill="#fff" stroke="#1d3a31" stroke-width="1.5"/>
    </g>
    <!-- Bäume vorne -->
    <g>
      <rect x="430" y="330" width="6" height="22" fill="#3c2f22"/><circle cx="433" cy="320" r="22" fill="#2c7a4c"/>
      <rect x="470" y="340" width="5" height="18" fill="#3c2f22"/><circle cx="472" cy="332" r="16" fill="#2b5446"/>
      <rect x="62" y="336" width="6" height="22" fill="#3c2f22"/><circle cx="65" cy="326" r="20" fill="#2b5446"/>
    </g>
    <!-- Wegweiser mit Euro-Fahne -->
    <g transform="translate(330 330)">
      <rect x="-2" y="-46" width="4" height="56" fill="#1d3a31"/>
      <path d="M2 -44 L46 -44 L56 -36 L46 -28 L2 -28 Z" fill="#fff" stroke="#1d3a31" stroke-width="2"/>
      <text x="26" y="-31.5" font-family="Public Sans, Arial, sans-serif" font-size="11" font-weight="700" fill="#2c7a4c" text-anchor="middle">€</text>
    </g>
  </g>
</svg>`,

  // Schritt 1: Erzählen Sie von sich
  profil: `
<svg viewBox="0 0 200 140" aria-hidden="true">
  <rect x="10" y="14" width="180" height="116" rx="18" fill="#e4efe8"/>
  <rect x="40" y="30" width="120" height="86" rx="10" fill="#fff" stroke="#cfd8d3" stroke-width="2"/>
  <circle cx="72" cy="62" r="16" fill="#a9c8b6"/>
  <path d="M60 60 L72 50 L84 60 L84 72 L60 72 Z" fill="#fff"/><path d="M57 61 L72 48 L87 61" fill="none" stroke="#1d3a31" stroke-width="2.5" stroke-linejoin="round"/>
  <rect x="96" y="52" width="48" height="7" rx="3.5" fill="#1d3a31"/>
  <rect x="96" y="66" width="36" height="6" rx="3" fill="#cfd8d3"/>
  <rect x="56" y="90" width="88" height="6" rx="3" fill="#cfd8d3"/>
  <rect x="56" y="102" width="62" height="6" rx="3" fill="#cfd8d3"/>
  <circle cx="160" cy="34" r="16" fill="#2c7a4c"/><path d="M152 34 l6 6 l10 -12" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`,

  // Schritt 2: Empfehlungen mit Passung
  empfehlungen: `
<svg viewBox="0 0 200 140" aria-hidden="true">
  <rect x="10" y="14" width="180" height="116" rx="18" fill="#e4efe8"/>
  <g>
    <rect x="34" y="28" width="132" height="26" rx="7" fill="#fff"/><rect x="34" y="28" width="5" height="26" rx="2" fill="#2c7a4c"/>
    <rect x="46" y="38" width="58" height="6" rx="3" fill="#1d3a31"/><rect x="118" y="38" width="38" height="6" rx="3" fill="#e3e8e5"/><rect x="118" y="38" width="34" height="6" rx="3" fill="#2c7a4c"/>
    <rect x="34" y="60" width="132" height="26" rx="7" fill="#fff"/><rect x="34" y="60" width="5" height="26" rx="2" fill="#2c7a4c"/>
    <rect x="46" y="70" width="46" height="6" rx="3" fill="#1d3a31"/><rect x="118" y="70" width="38" height="6" rx="3" fill="#e3e8e5"/><rect x="118" y="70" width="30" height="6" rx="3" fill="#2c7a4c"/>
    <rect x="34" y="92" width="132" height="26" rx="7" fill="#fff"/><rect x="34" y="92" width="5" height="26" rx="2" fill="#a86f12"/>
    <rect x="46" y="102" width="52" height="6" rx="3" fill="#1d3a31"/><rect x="118" y="102" width="38" height="6" rx="3" fill="#e3e8e5"/><rect x="118" y="102" width="22" height="6" rx="3" fill="#a86f12"/>
  </g>
  <g transform="translate(160 26)">
    <circle r="18" fill="#f6e7c4"/><text y="6" font-family="Public Sans, Arial, sans-serif" font-size="17" font-weight="700" fill="#a86f12" text-anchor="middle">€</text>
  </g>
</svg>`,

  // Schritt 3: Antrag vorbereiten
  antrag: `
<svg viewBox="0 0 200 140" aria-hidden="true">
  <rect x="10" y="14" width="180" height="116" rx="18" fill="#e4efe8"/>
  <path d="M58 22 L128 22 L146 40 L146 122 L58 122 Z" fill="#fff" stroke="#cfd8d3" stroke-width="2"/>
  <path d="M128 22 L128 40 L146 40" fill="#e4efe8" stroke="#cfd8d3" stroke-width="2"/>
  <rect x="72" y="46" width="52" height="7" rx="3.5" fill="#1d3a31"/>
  <rect x="72" y="62" width="60" height="5" rx="2.5" fill="#cfd8d3"/><rect x="72" y="73" width="56" height="5" rx="2.5" fill="#cfd8d3"/>
  <rect x="72" y="84" width="44" height="5" rx="2.5" fill="#cfd8d3"/>
  <g transform="translate(150 96) rotate(40)">
    <rect x="-5" y="-40" width="10" height="44" rx="2" fill="#a86f12"/><path d="M-5 4 L5 4 L0 14 Z" fill="#1d3a31"/>
    <rect x="-5" y="-40" width="10" height="8" fill="#1d3a31"/>
  </g>
  <circle cx="84" cy="106" r="11" fill="none" stroke="#2c7a4c" stroke-width="3"/>
  <path d="M79 106 l4 4 l7 -8" fill="none" stroke="#2c7a4c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`,

  // Expertenprüfung: Lupe über dem Antrag, Siegel
  experte: `
<svg viewBox="0 0 320 240" aria-hidden="true">
  <rect x="0" y="0" width="320" height="240" rx="26" fill="#e4efe8"/>
  <path d="M86 36 L196 36 L222 62 L222 204 L86 204 Z" fill="#fff" stroke="#cfd8d3" stroke-width="2.5"/>
  <path d="M196 36 L196 62 L222 62" fill="#e4efe8" stroke="#cfd8d3" stroke-width="2.5"/>
  <rect x="106" y="70" width="80" height="9" rx="4.5" fill="#1d3a31"/>
  <g fill="#cfd8d3">
    <rect x="106" y="92" width="96" height="6" rx="3"/><rect x="106" y="106" width="88" height="6" rx="3"/>
    <rect x="106" y="120" width="92" height="6" rx="3"/><rect x="106" y="134" width="70" height="6" rx="3"/>
    <rect x="106" y="148" width="84" height="6" rx="3"/>
  </g>
  <g transform="translate(224 140)">
    <circle r="38" fill="rgba(255,255,255,.55)" stroke="#1d3a31" stroke-width="7"/>
    <rect x="26" y="24" width="14" height="40" rx="6" transform="rotate(-45 33 44)" fill="#1d3a31"/>
    <path d="M-15 0 l10 10 l20 -22" fill="none" stroke="#2c7a4c" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <g transform="translate(96 186)">
    <circle r="22" fill="#a86f12"/><circle r="15" fill="none" stroke="#f6e7c4" stroke-width="2.5"/>
    <path d="M-7 0 l5 5 l9 -11" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`,
};
