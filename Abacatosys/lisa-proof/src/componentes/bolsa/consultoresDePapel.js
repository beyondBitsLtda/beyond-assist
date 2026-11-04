// Os retratos dos consultores da Bolsa (26/10/2026), no mesmo papel recortado dos monstros do Reino
// (src/componentes/reino/monstrosDePapel.js): cores chapadas, contorno grosso e escuro, e a borda
// branca de adesivo em volta do personagem. Cada um tem o seu cenário: a tenda da vidente, o
// escritório do banqueiro, a nave da influenciadora, a lousa do professor, a feira e a tempestade
// do urso. Um quadrado de 200×200 com a moldura arredondada; vira imagem por URL (retratoDoConsultor).

const CONTORNO = "#1f2937";

/** Um brilho de quatro pontas (as estrelas dos cenários). */
const brilho = (x, y, r, cor = "#fde68a") =>
  `<path d="M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z" fill="${cor}" stroke="none"/>`;

/** Uma estrela de cinco pontas. */
function estrela(cx, cy, r, cor, extra = "") {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const raio = i % 2 ? r * 0.45 : r;
    pts.push(`${(cx + raio * Math.cos(a)).toFixed(1)} ${(cy + raio * Math.sin(a)).toFixed(1)}`);
  }
  return `<path d="M${pts.join("L")}Z" fill="${cor}"${extra}/>`;
}

/** A franja de festões (a cortina da vidente, o toldo da feira). */
function festoes(y, n, cores, raio) {
  const largura = 200 / n;
  let s = "";
  for (let i = 0; i < n; i++) {
    const x = i * largura;
    s += `<path d="M${x} ${y}L${x + largura} ${y}Q${x + largura / 2} ${y + raio * 2} ${x} ${y}Z" fill="${cores[i % cores.length]}"/>`;
  }
  return s;
}

/** O busto de sempre: os ombros e o tronco, da gola até o pé do quadro. */
const ombros = (cor, larg = 0) => `<path d="M${20 - larg} 200Q${26 - larg} 152 100 143Q${174 + larg} 152 ${180 + larg} 200Z" fill="${cor}"/>`;

const DESENHOS = {
  // -------------------------------------------------------------- Madame Ametista
  ametista: {
    cena: `
      <rect width="200" height="200" fill="#2e1065" stroke="none"/>
      ${brilho(30, 44, 7)}${brilho(46, 120, 5)}${brilho(20, 92, 4)}${brilho(176, 104, 5)}${brilho(160, 140, 6)}${brilho(140, 30, 4)}
      <path d="M155.05 28.26A16 16 0 1 0 173.2 49A14 14 0 0 1 155.05 28.26Z" fill="#fde68a"/>
      <rect width="200" height="12" fill="#6d28d9"/>
      ${festoes(12, 8, ["#6d28d9", "#7c3aed"], 7)}
      ${[12.5, 37.5, 62.5, 87.5, 112.5, 137.5, 162.5, 187.5].map((x) => `<circle cx="${x}" cy="${21}" r="2.6" fill="#fbbf24" stroke="none"/>`).join("")}`,
    personagem: `
      <circle cx="70" cy="98" r="18" fill="#3b1a0c"/><circle cx="130" cy="98" r="18" fill="#3b1a0c"/>
      <circle cx="66" cy="124" r="16" fill="#3b1a0c"/><circle cx="134" cy="124" r="16" fill="#3b1a0c"/>
      ${ombros("#be185d")}
      <path d="M70 150Q100 166 130 150" fill="none" stroke="#fbbf24" stroke-width="5"/>
      <path d="M88 118L88 142Q100 148 112 142L112 118Z" fill="#b97a56"/>
      ${[[84, 146], [90, 151], [96, 153.5], [104, 153.5], [110, 151], [116, 146]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.4" fill="#fbbf24" stroke-width="2"/>`).join("")}
      <ellipse cx="100" cy="98" rx="28" ry="31" fill="#b97a56"/>
      <ellipse cx="82" cy="111" rx="6" ry="3.5" fill="#f472b6" fill-opacity=".45" stroke="none"/>
      <ellipse cx="118" cy="111" rx="6" ry="3.5" fill="#f472b6" fill-opacity=".45" stroke="none"/>
      <path d="M79 88Q87 81 95 87" fill="none" stroke-width="3"/>
      <path d="M105 87Q113 81 121 88" fill="none" stroke-width="3"/>
      <ellipse cx="87" cy="98" rx="7" ry="4.6" fill="#fff" stroke-width="3"/>
      <ellipse cx="113" cy="98" rx="7" ry="4.6" fill="#fff" stroke-width="3"/>
      <circle cx="87" cy="99" r="3" fill="#7c3aed" stroke="none"/><circle cx="113" cy="99" r="3" fill="#7c3aed" stroke="none"/>
      <path d="M79.5 98Q87 88.5 94.5 98Z" fill="#a855f7" stroke-width="3"/>
      <path d="M105.5 98Q113 88.5 120.5 98Z" fill="#a855f7" stroke-width="3"/>
      <path d="M79.5 97L76 94M120.5 97L124 94" fill="none" stroke-width="2.5"/>
      <path d="M100 101Q97 110 102 112" fill="none" stroke-width="3"/>
      <path d="M90 119Q100 124 110 119Q101 129 90 119Z" fill="#9f1239" stroke-width="3"/>
      <circle cx="115" cy="114" r="1.6" fill="${CONTORNO}" stroke="none"/>
      <path d="M68 96Q60 52 100 44Q140 52 132 96Q124 80 100 78Q76 80 68 96Z" fill="#7c3aed"/>
      <path d="M74 80Q100 62 126 80M80 64Q100 52 120 64" fill="none" stroke-width="3"/>
      <path d="M104 64Q112 30 134 22Q124 44 108 66Z" fill="#14b8a6"/>
      <circle cx="100" cy="70" r="10.5" fill="#fbbf24"/><circle cx="100" cy="70" r="6" fill="#f0abfc" stroke-width="2.5"/>
      <circle cx="72" cy="117" r="8" fill="none" stroke="#fbbf24" stroke-width="4"/>
      <circle cx="128" cy="117" r="8" fill="none" stroke="#fbbf24" stroke-width="4"/>
      <path d="M0 182Q100 175 200 182L200 200L0 200Z" fill="#4c1d95"/>
      <path d="M0 188L200 188" fill="none" stroke="#fbbf24" stroke-width="3"/>
      <path d="M85 188L89 179L111 179L115 188Z" fill="#fbbf24"/>
      <circle cx="100" cy="161" r="19" fill="#a5f3fc"/>
      <circle cx="100" cy="162" r="11.5" fill="#cffafe" stroke="none"/>
      ${brilho(104, 164, 6, "#22d3ee")}
      <ellipse cx="92" cy="153" rx="5" ry="3.2" fill="#fff" stroke="none"/>
      <ellipse cx="73" cy="174" rx="11" ry="8" fill="#b97a56"/><ellipse cx="127" cy="174" rx="11" ry="8" fill="#b97a56"/>
      <circle cx="77" cy="169" r="2.4" fill="#fbbf24" stroke-width="1.5"/><circle cx="123" cy="169" r="2.4" fill="#fbbf24" stroke-width="1.5"/>`,
  },

  // -------------------------------------------------------------- Barão Baltazar Cifrão
  barao: {
    cena: `
      <rect width="200" height="200" fill="#f3e3c0" stroke="none"/>
      ${[0, 24, 48, 72, 96, 120, 144, 168, 192].map((x) => `<rect x="${x}" y="0" width="10" height="200" fill="#e9d4a6" stroke="none"/>`).join("")}
      <rect x="0" y="150" width="200" height="50" fill="#92400e"/>
      <circle cx="170" cy="74" r="40" fill="#9ca3af"/>
      <circle cx="170" cy="74" r="30" fill="#cbd5e1"/>
      ${[0, 60, 120, 180, 240, 300].map((g) => { const a = (g * Math.PI) / 180; return `<circle cx="${(170 + 35 * Math.cos(a)).toFixed(1)}" cy="${(74 + 35 * Math.sin(a)).toFixed(1)}" r="2.4" fill="#64748b" stroke="none"/>`; }).join("")}
      <path d="M170 52L170 96M151 63L189 85M151 85L189 63" fill="none" stroke="#475569" stroke-width="5"/>
      <circle cx="170" cy="74" r="7" fill="#64748b"/>
      <ellipse cx="28" cy="146" rx="16" ry="5" fill="#fbbf24"/><rect x="12" y="128" width="32" height="18" fill="#fbbf24" stroke="none"/>
      <path d="M12 128L12 146M44 128L44 146M12 134L44 134M12 140L44 140" fill="none" stroke-width="2.5"/>
      <ellipse cx="28" cy="128" rx="16" ry="5" fill="#fde68a"/>`,
    personagem: `
      ${ombros("#166534")}
      <path d="M78 148L100 200L122 148Q100 156 78 148Z" fill="#ca8a04"/>
      <path d="M86 146L100 178L114 146Q100 152 86 146Z" fill="#f8fafc"/>
      <path d="M78 148L62 168L94 198Z" fill="#14532d"/><path d="M122 148L138 168L106 198Z" fill="#14532d"/>
      <path d="M104 182Q118 192 128 180" fill="none" stroke="#fbbf24" stroke-width="3"/>
      <circle cx="100" cy="186" r="2.4" fill="#fbbf24" stroke-width="1.5"/>
      <path d="M86 140L100 150L114 140L114 132L86 132Z" fill="#f8fafc"/>
      <path d="M88 146L100 152L88 158Z" fill="#991b1b"/><path d="M112 146L100 152L112 158Z" fill="#991b1b"/>
      <circle cx="100" cy="152" r="3.6" fill="#991b1b"/>
      <circle cx="73" cy="102" r="6.5" fill="#f6c7a6"/><circle cx="127" cy="102" r="6.5" fill="#f6c7a6"/>
      <ellipse cx="100" cy="100" rx="27" ry="29" fill="#f6c7a6"/>
      <path d="M73 86Q68 104 77 116L81 94Z" fill="#f1f5f9"/><path d="M127 86Q132 104 123 116L119 94Z" fill="#f1f5f9"/>
      <ellipse cx="84" cy="111" rx="5.5" ry="3.5" fill="#fca5a5" fill-opacity=".6" stroke="none"/>
      <ellipse cx="116" cy="111" rx="5.5" ry="3.5" fill="#fca5a5" fill-opacity=".6" stroke="none"/>
      <path d="M78 90Q87 79 97 88Q88 85 78 90Z" fill="#f1f5f9" stroke-width="3"/>
      <path d="M122 90Q113 79 103 88Q112 85 122 90Z" fill="#f1f5f9" stroke-width="3"/>
      <circle cx="88" cy="97" r="2.8" fill="${CONTORNO}" stroke="none"/>
      <circle cx="113" cy="97" r="3.6" fill="${CONTORNO}" stroke="none"/>
      <circle cx="113" cy="97" r="10" fill="#e0f2fe" fill-opacity=".45" stroke="#ca8a04" stroke-width="3.5"/>
      <path d="M121 103Q138 128 130 152" fill="none" stroke="#ca8a04" stroke-width="2"/>
      <ellipse cx="100" cy="106" rx="7" ry="6" fill="#f19c86" stroke-width="3"/>
      <path d="M100 112Q88 107 78 113Q70 118 65 110Q65 123 80 123Q92 123 100 117Q108 123 120 123Q135 123 135 110Q130 118 122 113Q112 107 100 112Z" fill="#f8fafc" stroke-width="3"/>
      <path d="M94 125Q100 128 106 125" fill="none" stroke-width="2.5"/>
      <ellipse cx="100" cy="74" rx="40" ry="8" fill="#111827"/>
      <path d="M74 74L78 26Q100 20 122 26L126 74Z" fill="#111827"/>
      <path d="M76.5 60L123.5 60L124.5 72Q100 76 75.5 72Z" fill="#166534" stroke-width="3"/>
      <path d="M85 32L83 56" fill="none" stroke="#4b5563" stroke-width="3"/>`,
  },

  // -------------------------------------------------------------- Luna "Foguete" Estrela
  luna: {
    cena: `
      <rect width="200" height="200" fill="#1e1b4b" stroke="none"/>
      ${[[16, 70], [58, 22], [92, 14], [150, 92], [178, 120], [12, 124], [60, 140], [186, 160], [120, 18]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8" fill="#fff" stroke="none"/>`).join("")}
      ${brilho(172, 96, 5, "#fff")}${brilho(48, 100, 4, "#fff")}
      <circle cx="28" cy="166" r="22" fill="#f59e0b"/>
      <path d="M14 158Q28 150 42 156" fill="none" stroke="#b45309" stroke-width="3"/>
      <ellipse cx="28" cy="166" rx="36" ry="8" fill="none" stroke="#fde68a" stroke-width="4" transform="rotate(-18 28 166)"/>
      <path d="M128 70L146 52L158 60L184 28" fill="none" stroke="#4ade80" stroke-width="6"/>
      <path d="M186 20L190 38L174 32Z" fill="#4ade80"/>
      <g transform="translate(30 38) rotate(40)">
        <path d="M-4 10Q0 24 4 10Z" fill="#fb923c"/>
        <path d="M-6 4L-12 14L-6 11ZM6 4L12 14L6 11Z" fill="#ef4444"/>
        <path d="M0 -17Q9 -6 6 11L-6 11Q-9 -6 0 -17Z" fill="#f8fafc"/>
        <circle cx="0" cy="-3" r="3.4" fill="#38bdf8" stroke-width="2.5"/>
      </g>`,
    personagem: `
      <path d="M68 92Q60 140 74 154L126 154Q140 140 132 92Z" fill="#db2777"/>
      <circle cx="70" cy="52" r="12.5" fill="#ec4899"/><circle cx="130" cy="52" r="12.5" fill="#ec4899"/>
      <path d="M64 50Q70 44 75 50Q72 57 67 54M136 50Q130 44 125 50Q128 57 133 54" fill="none" stroke-width="2.5"/>
      <path d="M76 60L81 65M124 60L119 65" fill="none" stroke="#22d3ee" stroke-width="5"/>
      ${ombros("#06b6d4")}
      <path d="M100 158L100 200" fill="none" stroke-width="3"/>
      ${estrela(138, 178, 11, "#fde047", ' stroke-width="3"')}
      <path d="M88 118L88 142Q100 148 112 142L112 118Z" fill="#e9b38a"/>
      <path d="M74 148Q100 162 126 148L122 140Q100 154 78 140Z" fill="#f472b6" stroke-width="3.5"/>
      <ellipse cx="100" cy="98" rx="28" ry="30" fill="#e9b38a"/>
      <ellipse cx="82" cy="110" rx="6" ry="3.6" fill="#f472b6" fill-opacity=".5" stroke="none"/>
      <ellipse cx="118" cy="110" rx="6" ry="3.6" fill="#f472b6" fill-opacity=".5" stroke="none"/>
      ${[[78, 106], [83, 104], [81, 109], [119, 104], [117, 109], [122, 106]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.1" fill="#9a3412" stroke="none"/>`).join("")}
      <path d="M80 86Q87 81 94 85M106 85Q113 81 120 86" fill="none" stroke-width="3"/>
      <ellipse cx="87" cy="97" rx="5" ry="6.2" fill="${CONTORNO}" stroke="none"/>
      <ellipse cx="113" cy="97" rx="5" ry="6.2" fill="${CONTORNO}" stroke="none"/>
      <circle cx="88.6" cy="95" r="1.9" fill="#fff" stroke="none"/><circle cx="114.6" cy="95" r="1.9" fill="#fff" stroke="none"/>
      <path d="M82 94L78 91M118 94L122 91" fill="none" stroke-width="2.5"/>
      <path d="M86 111Q100 128 114 111Z" fill="#7f1d1d" stroke-width="3.5"/>
      <path d="M88.5 112L111.5 112Q110 116.5 100 116.5Q90 116.5 88.5 112Z" fill="#fff" stroke="none"/>
      <path d="M70 92Q66 58 100 56Q134 58 130 92Q122 74 112 80Q104 68 96 80Q86 70 80 84Q74 82 70 92Z" fill="#ec4899"/>
      ${estrela(86, 64, 11, "#facc15", ' stroke-width="3"')}${estrela(114, 64, 11, "#facc15", ' stroke-width="3"')}
      <path d="M95 64L105 64" fill="none" stroke-width="3"/>
      <ellipse cx="71" cy="102" rx="5" ry="7.5" fill="#334155"/>
      <path d="M71 108Q72 120 86 120" fill="none" stroke-width="3"/>
      <circle cx="87" cy="120" r="3.6" fill="#334155" stroke-width="2.5"/>`,
  },

  // -------------------------------------------------------------- Professor Corvo
  corvo: {
    cena: `
      <rect width="200" height="200" fill="#1f4d3a" stroke="none"/>
      <rect width="200" height="10" fill="#92400e"/>
      <g fill="none" stroke="#e5e7eb" stroke-width="2.5">
        <path d="M10 100L60 100M11 98Q22 98 28 80Q34 60 40 80Q46 98 58 98"/>
        <path d="M34 66L34 100" stroke-dasharray="3 4"/>
        <path d="M150 104L150 134L190 134M157 134L157 122M167 134L167 112M177 134L177 118M184 134L184 108"/>
      </g>
      <g fill="#e5e7eb" stroke="none" font-family="Georgia, 'Times New Roman', serif" font-style="italic">
        <text x="160" y="52" font-size="28">σ</text>
        <text x="12" y="38" font-size="13">x̄ = Σx/n</text>
        <text x="10" y="132" font-size="15">μ ± 2σ</text>
      </g>`,
    personagem: `
      ${ombros("#8b5e34")}
      <path d="M84 146L100 176L116 146Q100 152 84 146Z" fill="#f8fafc"/>
      <path d="M80 148L64 168L94 198Z" fill="#6f4a28"/><path d="M120 148L136 168L106 198Z" fill="#6f4a28"/>
      <rect x="128" y="168" width="18" height="4" fill="#6f4a28" stroke-width="2.5"/>
      <path d="M134 168L134 158M140 168L140 160" fill="none" stroke="#fbbf24" stroke-width="3"/>
      <path d="M86 140L100 150L86 158ZM114 140L100 150L114 158Z" fill="#dc2626"/>
      <circle cx="100" cy="149" r="3.6" fill="#dc2626"/>
      <path d="M70 108L60 112L68 116L60 122L72 122ZM130 108L140 112L132 116L140 122L128 122Z" fill="#27272a"/>
      <circle cx="100" cy="98" r="32" fill="#27272a"/>
      <path d="M76 84Q84 72 96 70M108 70Q118 72 124 80" fill="none" stroke="#52525b" stroke-width="3"/>
      <path d="M73 84L94 81L92 87Z" fill="#71717a" stroke-width="2.5"/>
      <path d="M127 84L106 81L108 87Z" fill="#71717a" stroke-width="2.5"/>
      <circle cx="85" cy="97" r="11" fill="#e0f2fe"/><circle cx="115" cy="97" r="11" fill="#e0f2fe"/>
      <path d="M96 97L104 97" fill="none" stroke-width="3.5"/>
      <circle cx="86" cy="98" r="4.6" fill="#111827" stroke="none"/><circle cx="114" cy="98" r="4.6" fill="#111827" stroke="none"/>
      <circle cx="87.6" cy="96.4" r="1.6" fill="#fff" stroke="none"/><circle cx="115.6" cy="96.4" r="1.6" fill="#fff" stroke="none"/>
      <path d="M87 108Q100 102 113 108L102 138Q100 141 98 138Z" fill="#52525b"/>
      <path d="M94 112L99 132" fill="none" stroke="#a1a1aa" stroke-width="2"/>
      <path d="M78 66L78 78Q100 86 122 78L122 66Z" fill="#1e40af"/>
      <path d="M58 60L100 44L142 60L100 76Z" fill="#1e3a8a"/>
      <path d="M100 60Q124 62 134 64L134 84" fill="none" stroke="#fbbf24" stroke-width="3"/>
      <path d="M130 84L138 84L140 98L128 98Z" fill="#fbbf24" stroke-width="3"/>
      <circle cx="100" cy="60" r="3.4" fill="#fbbf24" stroke-width="2.5"/>`,
  },

  // -------------------------------------------------------------- Dona Zuleica
  zuleica: {
    cena: `
      <rect width="200" height="200" fill="#bae6fd" stroke="none"/>
      ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<rect x="${i * 25}" y="0" width="25" height="30" fill="${i % 2 ? "#fff7ed" : "#f97316"}"/>`).join("")}
      ${festoes(30, 8, ["#f97316", "#fff7ed"], 6)}
      <rect x="146" y="50" width="46" height="30" rx="4" fill="#78350f"/>
      <g fill="#fef3c7" stroke="none" font-family="'Comic Sans MS', 'Segoe Print', cursive" text-anchor="middle">
        <text x="169" y="63" font-size="9">TOMATE</text>
        <text x="169" y="75" font-size="10" font-weight="bold">2,00</text>
      </g>
      <rect x="-4" y="164" width="50" height="40" fill="#d97706"/>
      <path d="M-4 176L46 176M-4 188L46 188" fill="none" stroke-width="2.5"/>
      ${[[8, 160], [24, 155], [40, 161]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="#ef4444"/>${estrela(x, y - 7, 4.5, "#16a34a", ' stroke-width="1.5"')}`).join("")}
      <rect x="156" y="166" width="50" height="40" fill="#d97706"/>
      <path d="M156 178L206 178M156 190L206 190" fill="none" stroke-width="2.5"/>
      <path d="M160 160Q176 176 198 156Q182 166 160 160Z" fill="#facc15"/>
      <path d="M162 152Q178 168 200 148Q184 158 162 152Z" fill="#fde047"/>`,
    personagem: `
      <circle cx="100" cy="58" r="15" fill="#d1d5db"/>
      <path d="M80 48L120 66" fill="none" stroke="#facc15" stroke-width="5"/>
      <circle cx="120" cy="52" r="5" fill="#f43f5e" stroke-width="2.5"/><circle cx="114" cy="48" r="4" fill="#fb7185" stroke-width="2.5"/>
      ${ombros("#0d9488")}
      ${[[40, 176], [60, 160], [146, 166], [160, 186], [36, 194]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#fef9c3" stroke="none"/>`).join("")}
      <path d="M66 158Q100 152 134 158L140 200L60 200Z" fill="#fef3c7"/>
      <rect x="86" y="174" width="28" height="18" rx="4" fill="#fde68a" stroke-width="3"/>
      <path d="M88 118L88 142Q100 148 112 142L112 118Z" fill="#8d5524"/>
      <circle cx="72" cy="104" r="6" fill="#8d5524"/><circle cx="128" cy="104" r="6" fill="#8d5524"/>
      <circle cx="71" cy="113" r="3" fill="#fff" stroke-width="2"/><circle cx="129" cy="113" r="3" fill="#fff" stroke-width="2"/>
      <ellipse cx="100" cy="100" rx="28" ry="30" fill="#8d5524"/>
      <ellipse cx="82" cy="111" rx="6" ry="3.6" fill="#f87171" fill-opacity=".45" stroke="none"/>
      <ellipse cx="118" cy="111" rx="6" ry="3.6" fill="#f87171" fill-opacity=".45" stroke="none"/>
      <path d="M80 87Q87 83 94 86M106 86Q113 83 120 87" fill="none" stroke="#d1d5db" stroke-width="3.5"/>
      <path d="M80 97Q87 91 94 97M106 97Q113 91 120 97" fill="none" stroke-width="3.5"/>
      <path d="M77 95L74 93M77 99L74 100M123 95L126 93M123 99L126 100" fill="none" stroke-width="2"/>
      <path d="M78 102Q86 112 95 102Z" fill="#e0f2fe" stroke-width="3"/>
      <path d="M105 102Q114 112 122 102Z" fill="#e0f2fe" stroke-width="3"/>
      <path d="M95 102Q100 99 105 102" fill="none" stroke-width="2.5"/>
      <path d="M78 103Q68 128 86 142M122 103Q132 128 114 142" fill="none" stroke="#fbbf24" stroke-width="2" stroke-dasharray="2 3"/>
      <path d="M98 105Q96 112 102 113" fill="none" stroke-width="2.5"/>
      <path d="M88 118Q100 131 112 118Z" fill="#7f1d1d" stroke-width="3"/>
      <path d="M90 119L110 119Q108 122 100 122Q92 122 90 119Z" fill="#fff" stroke="none"/>
      <path d="M70 98Q66 64 100 62Q134 64 130 98Q126 80 100 78Q74 80 70 98Z" fill="#d1d5db"/>
      <path d="M86 70Q100 64 114 70" fill="none" stroke="#9ca3af" stroke-width="2.5"/>
      <circle cx="54" cy="160" r="12" fill="#ef4444"/>
      ${estrela(54, 150, 5.5, "#16a34a", ' stroke-width="2"')}
      <ellipse cx="54" cy="176" rx="13" ry="9" fill="#8d5524"/>`,
  },

  // -------------------------------------------------------------- Gorgo, o Urso
  gorgo: {
    cena: `
      <rect width="200" height="200" fill="#334155" stroke="none"/>
      <path d="M8 44Q6 28 24 28Q30 12 50 20Q64 10 74 26Q92 24 92 40Q92 48 82 48L16 48Q8 48 8 44Z" fill="#64748b"/>
      <path d="M22 58L18 70M40 58L36 70M58 58L54 70M76 58L72 70M30 78L26 90M50 78L46 90M68 78L64 90" fill="none" stroke="#93c5fd" stroke-width="3"/>
      <path d="M140 30Q140 18 154 18Q160 6 176 12Q192 8 194 24Q204 26 200 36L146 36Q140 36 140 30Z" fill="#64748b"/>
      <path d="M170 40L158 66L168 66L156 92L182 56L170 56L180 40Z" fill="#fde047"/>
      <path d="M6 100L22 112L34 106L52 134" fill="none" stroke="#ef4444" stroke-width="6"/>
      <path d="M58 144L42 136L56 126Z" fill="#ef4444"/>`,
    personagem: `
      <circle cx="68" cy="64" r="15" fill="#78350f"/><circle cx="132" cy="64" r="15" fill="#78350f"/>
      <circle cx="68" cy="64" r="7.5" fill="#d4a373" stroke-width="3"/><circle cx="132" cy="64" r="7.5" fill="#d4a373" stroke-width="3"/>
      ${ombros("#78350f", 6)}
      <ellipse cx="100" cy="98" rx="38" ry="36" fill="#92400e"/>
      <path d="M60 132Q100 154 140 132L142 146Q100 170 58 146Z" fill="#94a3b8"/>
      <path d="M68 140Q100 158 132 140" fill="none" stroke="#dc2626" stroke-width="3"/>
      <path d="M118 148L126 190L112 192L106 154Z" fill="#94a3b8"/>
      <path d="M110 166L122 164M112 178L124 176" fill="none" stroke="#dc2626" stroke-width="3"/>
      <ellipse cx="100" cy="114" rx="20" ry="15" fill="#d4a373"/>
      <path d="M92 104Q100 98 108 104Q104 112 100 112Q96 112 92 104Z" fill="${CONTORNO}"/>
      <path d="M100 112L100 118M90 125Q100 117 110 125" fill="none" stroke-width="3.5"/>
      <circle cx="84" cy="92" r="3.4" fill="${CONTORNO}" stroke="none"/><circle cx="116" cy="92" r="3.4" fill="${CONTORNO}" stroke="none"/>
      <path d="M72 80L94 87M128 80L106 87" fill="none" stroke-width="6"/>
      <path d="M79 98Q84 101 89 98M111 98Q116 101 121 98" fill="none" stroke-width="2.5"/>
      <g transform="rotate(-10 152 168)">
        <rect x="128" y="150" width="50" height="36" fill="#f8fafc"/>
        <text x="153" y="164" font-size="10.5" font-weight="bold" text-anchor="middle" fill="#dc2626" stroke="none" font-family="Arial, sans-serif">CRISE!</text>
        <path d="M134 171L172 171M134 178L164 178" fill="none" stroke="#94a3b8" stroke-width="2.5"/>
      </g>
      <ellipse cx="136" cy="182" rx="12" ry="9" fill="#92400e"/>`,
  },
};

/** O SVG do retrato de um consultor: o cenário, o personagem com borda de adesivo e a moldura. */
export function svgDoConsultor(id) {
  const d = DESENHOS[id];
  if (!d) return "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="400" height="400">`
    + `<defs><clipPath id="q"><rect x="4" y="4" width="192" height="192" rx="22"/></clipPath><g id="p">${d.personagem}</g></defs>`
    + `<g clip-path="url(#q)" stroke-linejoin="round" stroke-linecap="round">`
    + `<g stroke="${CONTORNO}" stroke-width="3">${d.cena}</g>`
    + `<use href="#p" stroke="#fff" stroke-width="13"/>`
    + `<use href="#p" stroke="${CONTORNO}" stroke-width="4.5"/>`
    + `</g><rect x="4" y="4" width="192" height="192" rx="22" fill="none" stroke="${CONTORNO}" stroke-width="6"/></svg>`;
}

const cache = new Map();
/** O retrato como URL de imagem (para <img>). */
export function retratoDoConsultor(id) {
  if (!cache.has(id)) cache.set(id, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgDoConsultor(id))}`);
  return cache.get(id);
}
