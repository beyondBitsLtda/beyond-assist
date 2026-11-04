"use client";

/**
 * Os 3 jurados do Modo Bootcamp desenhados (04/11/2026): personagens originais inspirados nos ARQUÉTIPOS de uma
 * bancada de reality de cozinha — nenhum é retrato de pessoa real.
 *
 *   kernel   o francês ranzinza: toque branco alto, bigode grisalho de pontas viradas, dólmã branca com a gola
 *            em três cores e as sobrancelhas grossas
 *   vetor    a perfeccionista implacável: dólmã preta com debrum branco, cabelo escuro preso num coque e brincos
 *   sintaxe  o durão tatuado: cabeça raspada, barba cheia, camiseta e avental escuros e os braços tatuados
 *
 * Humores: normal (braços cruzados), feliz (joinha), bravo (o dedo apontado) e pensando (a mão no queixo). As
 * cores ficam nos atributos, sem CSS: o recorte de papel do 3D (src/componentes/reino/papel.js) copia o desenho
 * do jeito que está.
 */

const TINTA = "#1F2937";

const ESTILO = {
  kernel: { pele: "#F2C9A0", roupa: "#F9FAFB", detalhe: "#CBD5E1", braco: "#F9FAFB", sobrancelha: "#6B7280", bochecha: 0.45 },
  // as mangas da Vetor num grafite mais claro que a dólmã: preto sobre preto, os braços sumiam
  vetor: { pele: "#E8B98F", roupa: "#111827", detalhe: "#F9FAFB", braco: "#374151", sobrancelha: "#3B2416", bochecha: 0.2 },
  sintaxe: { pele: "#D9A67A", roupa: "#1F2937", detalhe: "#374151", braco: "#D9A67A", sobrancelha: "#2B1D14", bochecha: 0.2 },
};

/** Um braço: o contorno escuro por baixo, a manga (ou a pele) por cima e, no Sintaxe, as tatuagens. */
function Braco({ d, cor, tatuado }) {
  return (
    <g>
      <path d={d} fill="none" stroke={TINTA} strokeWidth="22" strokeLinecap="round" />
      <path d={d} fill="none" stroke={cor} strokeWidth="16" strokeLinecap="round" />
      {/* as tatuagens: uma faixa tribal e os traços, em dois tons */}
      {tatuado && <path d={d} fill="none" stroke="#1E3A8A" strokeWidth="9" strokeLinecap="butt" strokeDasharray="2 9 6 9" opacity="0.85" />}
      {tatuado && <path d={d} fill="none" stroke="#B91C1C" strokeWidth="3" strokeLinecap="round" strokeDasharray="1 25" />}
    </g>
  );
}
const Mao = ({ x, y, pele, r = 9 }) => <circle cx={x} cy={y} r={r} fill={pele} stroke={TINTA} strokeWidth="3" />;

function Bracos({ humor, e, tatuado }) {
  const c = e.braco;
  if (humor === "feliz") {
    return (
      <g>
        <Braco d="M58 140 Q48 166 56 186" cor={c} tatuado={tatuado} />
        <Braco d="M144 138 Q166 130 164 112" cor={c} tatuado={tatuado} />
        {/* o joinha: o punho fechado e o polegar para cima */}
        <rect x="153" y="96" width="22" height="18" rx="7" fill={e.pele} stroke={TINTA} strokeWidth="3" />
        <path d="M156 98 q-3 -12 3 -17 q5 -2 5 4 l-1 13" fill={e.pele} stroke={TINTA} strokeWidth="3" strokeLinejoin="round" />
        <path d="M160 103 h12 M160 108 h12" stroke={TINTA} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      </g>
    );
  }
  if (humor === "bravo") {
    return (
      <g>
        <Braco d="M58 150 Q100 164 128 150" cor={c} tatuado={tatuado} />
        <Braco d="M144 138 Q170 126 184 112" cor={c} tatuado={tatuado} />
        <Mao x={186} y={110} pele={e.pele} r={8} />
        <path d="M190 106 l9 -6" stroke={TINTA} strokeWidth="8" strokeLinecap="round" />
        <path d="M190 106 l9 -6" stroke={e.pele} strokeWidth="4" strokeLinecap="round" />
      </g>
    );
  }
  if (humor === "pensando") {
    return (
      <g>
        <Braco d="M58 154 Q100 168 142 152" cor={c} tatuado={tatuado} />
        <Braco d="M142 146 Q132 138 116 128" cor={c} tatuado={tatuado} />
        <Mao x={110} y={124} pele={e.pele} r={9} />
      </g>
    );
  }
  // normal: os braços cruzados
  return (
    <g>
      <Braco d="M58 150 Q100 166 140 146" cor={c} tatuado={tatuado} />
      <Braco d="M142 152 Q100 170 60 148" cor={c} tatuado={tatuado} />
      <Mao x={140} y={146} pele={e.pele} />
      <Mao x={60} y={148} pele={e.pele} />
    </g>
  );
}

function Olhos({ humor, e }) {
  const sobrancelhas = {
    normal: "M80 74 q7 -3 14 0 M106 74 q7 -3 14 0",
    feliz: "M80 72 q7 -5 14 -1 M106 71 q7 -4 14 1",
    bravo: "M79 70 l16 7 M121 70 l-16 7",
    pensando: "M80 68 q7 -7 14 -3 M106 75 q7 -1 14 1",
  }[humor] || "M80 74 q7 -3 14 0 M106 74 q7 -3 14 0";
  return (
    <g>
      <path d={sobrancelhas} fill="none" stroke={e.sobrancelha} strokeWidth={e === ESTILO.kernel ? 6 : 4} strokeLinecap="round" />
      {humor === "feliz" ? (
        <path d="M81 87 q6 -7 12 0 M107 87 q6 -7 12 0" fill="none" stroke={TINTA} strokeWidth="3.5" strokeLinecap="round" />
      ) : humor === "pensando" ? (
        <g>
          <circle cx="87" cy="85" r="4.5" fill={TINTA} />
          <path d="M107 86 h12" stroke={TINTA} strokeWidth="3.5" strokeLinecap="round" />
        </g>
      ) : (
        <g>
          <circle cx="87" cy="85" r={humor === "bravo" ? 3.8 : 4.5} fill={TINTA} />
          <circle cx="113" cy="85" r={humor === "bravo" ? 3.8 : 4.5} fill={TINTA} />
          <circle cx="88.5" cy="83.5" r="1.4" fill="#FFFFFF" />
          <circle cx="114.5" cy="83.5" r="1.4" fill="#FFFFFF" />
        </g>
      )}
    </g>
  );
}

function Boca({ humor, id }) {
  if (humor === "feliz") {
    return (
      <g>
        <path d="M88 106 q12 15 24 0 z" fill="#7F1D1D" stroke={TINTA} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M94 112 q6 4 12 0 q-6 -3 -12 0 z" fill="#F472B6" />
      </g>
    );
  }
  if (humor === "bravo") {
    return (
      <g>
        <ellipse cx="100" cy="112" rx="10" ry="7.5" fill="#7F1D1D" stroke={TINTA} strokeWidth="2.5" />
        <path d="M92 108 h16" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
      </g>
    );
  }
  if (humor === "pensando") return <path d="M94 111 q6 -3 12 1" fill="none" stroke={id === "sintaxe" ? "#E7C3A0" : TINTA} strokeWidth="3" strokeLinecap="round" />;
  if (id === "kernel") return <path d="M92 113 q8 -5 16 0" fill="none" stroke={TINTA} strokeWidth="3" strokeLinecap="round" />;
  if (id === "vetor") return <path d="M92 110 q8 2.5 16 0" fill="none" stroke="#B4535A" strokeWidth="3.5" strokeLinecap="round" />;
  return <path d="M92 111 h16" stroke="#E7C3A0" strokeWidth="3" strokeLinecap="round" />;
}

/**
 * A apresentadora do programa, Clara Compila (personagem original): blazer verde-petróleo com o lenço lima no
 * bolso, cabelo cacheado, argolas e o microfone de mão. Humores: normal, feliz, pensando e triste (a empatia de
 * quem se despede de um competidor).
 */
export function DesenhoDaApresentadora({ humor = "normal", tamanho = 120, className = "", titulo }) {
  const pele = "#C68B59";
  const h = ["normal", "feliz", "pensando", "triste"].includes(humor) ? humor : "normal";
  const sobrancelhas = {
    normal: "M80 73 q7 -4 14 -1 M106 72 q7 -3 14 1",
    feliz: "M80 71 q7 -5 14 -1 M106 70 q7 -4 14 1",
    pensando: "M80 67 q7 -7 14 -3 M106 74 q7 -1 14 1",
    triste: "M80 74 q8 -2 14 -6 M120 74 q-8 -2 -14 -6",
  }[h];
  return (
    <svg viewBox="0 0 200 200" width={tamanho} height={tamanho} className={className} role={titulo ? "img" : undefined}
      aria-label={titulo || undefined} aria-hidden={titulo ? undefined : true}>
      {/* o cabelo cacheado por trás */}
      {[[64, 70, 16], [136, 70, 16], [60, 96, 14], [140, 96, 14], [70, 116, 12], [130, 116, 12]].map(([x, y, r]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#2B1A12" stroke={TINTA} strokeWidth="2.5" />
      ))}
      {/* o blazer, a blusa clara e o lenço lima no bolso */}
      <path d="M50 138 Q56 124 80 122 L120 122 Q144 124 150 138 L160 200 L40 200 Z" fill="#0F766E" stroke={TINTA} strokeWidth="3" strokeLinejoin="round" />
      <path d="M86 122 L100 158 L114 122 Z" fill="#F9FAFB" stroke={TINTA} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M80 124 L94 162 L86 200 M120 124 L106 162 L114 200" fill="none" stroke="#115E59" strokeWidth="4" />
      <path d="M124 150 l14 -2 l-3 9 z" fill="#84CC16" stroke={TINTA} strokeWidth="2" strokeLinejoin="round" />
      {/* o pescoço e a cabeça */}
      <rect x="90" y="112" width="20" height="16" fill={pele} stroke={TINTA} strokeWidth="3" />
      <ellipse cx="100" cy="86" rx="31" ry="35" fill={pele} stroke={TINTA} strokeWidth="3" />
      {/* a franja cacheada por cima */}
      {[[74, 58, 12], [88, 50, 13], [104, 48, 13], [120, 54, 12], [130, 66, 10], [70, 70, 9]].map(([x, y, r]) => (
        <circle key={`f${x}`} cx={x} cy={y} r={r} fill="#2B1A12" stroke={TINTA} strokeWidth="2.5" />
      ))}
      <circle cx="69" cy="100" r="5" fill="none" stroke="#F0BE45" strokeWidth="2.5" />
      <circle cx="131" cy="100" r="5" fill="none" stroke="#F0BE45" strokeWidth="2.5" />

      <path d={sobrancelhas} fill="none" stroke="#2B1A12" strokeWidth="4" strokeLinecap="round" />
      {h === "feliz" ? (
        <path d="M81 87 q6 -7 12 0 M107 87 q6 -7 12 0" fill="none" stroke={TINTA} strokeWidth="3.5" strokeLinecap="round" />
      ) : (
        <g>
          <circle cx="87" cy="86" r="4.5" fill={TINTA} /><circle cx="113" cy="86" r="4.5" fill={TINTA} />
          <circle cx="88.5" cy="84.5" r="1.4" fill="#FFFFFF" /><circle cx="114.5" cy="84.5" r="1.4" fill="#FFFFFF" />
          <path d="M82 81 l-3 -3 M118 81 l3 -3" stroke={TINTA} strokeWidth="2" strokeLinecap="round" />
        </g>
      )}
      <path d="M98 92 q-4 8 3 9" fill="none" stroke={TINTA} strokeWidth="2.8" strokeLinecap="round" />
      <ellipse cx="78" cy="100" rx="7" ry="4" fill="#F87171" opacity="0.35" />
      <ellipse cx="122" cy="100" rx="7" ry="4" fill="#F87171" opacity="0.35" />
      {h === "feliz" ? (
        <path d="M88 106 q12 14 24 0 z" fill="#7F1D1D" stroke={TINTA} strokeWidth="2.5" strokeLinejoin="round" />
      ) : h === "triste" ? (
        <path d="M91 112 q9 -6 18 0" fill="none" stroke="#9F1239" strokeWidth="3.5" strokeLinecap="round" />
      ) : h === "pensando" ? (
        <path d="M93 110 q7 -3 14 1" fill="none" stroke="#9F1239" strokeWidth="3.5" strokeLinecap="round" />
      ) : (
        <path d="M90 107 q10 8 20 0" fill="none" stroke="#9F1239" strokeWidth="3.5" strokeLinecap="round" />
      )}

      {/* os braços: o microfone de mão na frente (normal, feliz e triste) ou a mão no queixo (pensando) */}
      {h === "pensando" ? (
        <g>
          <Braco d="M58 154 Q100 168 142 152" cor="#0F766E" />
          <Braco d="M142 146 Q132 138 116 128" cor="#0F766E" />
          <Mao x={110} y={124} pele={pele} r={9} />
        </g>
      ) : (
        <g>
          <Braco d="M58 150 Q60 172 70 186" cor="#0F766E" />
          <Braco d="M148 160 Q148 146 138 140" cor="#0F766E" />
          {/* o microfone fica no queixo, de lado: a boca aparece */}
          <rect x="128" y="118" width="9" height="24" rx="3" fill="#4B5563" stroke={TINTA} strokeWidth="2.5" transform="rotate(-24 132 130)" />
          <circle cx="127" cy="116" r="7.5" fill="#111827" stroke={TINTA} strokeWidth="2.5" />
          <Mao x={136} y={138} pele={pele} r={8.5} />
        </g>
      )}
    </svg>
  );
}

/** O desenho do jurado `id` ("kernel", "vetor" ou "sintaxe") com o humor pedido. */
export default function DesenhoDoJurado({ id, humor = "normal", tamanho = 120, className = "", titulo }) {
  const e = ESTILO[id] || ESTILO.kernel;
  const h = ["normal", "feliz", "bravo", "pensando"].includes(humor) ? humor : "normal";
  return (
    <svg viewBox="0 0 200 200" width={tamanho} height={tamanho} className={className} role={titulo ? "img" : undefined}
      aria-label={titulo || undefined} aria-hidden={titulo ? undefined : true}>
      {/* o coque da Vetor fica atrás da cabeça */}
      {id === "vetor" && <circle cx="136" cy="64" r="14" fill="#3B2416" stroke={TINTA} strokeWidth="3" />}

      {/* o corpo */}
      <path d="M52 136 Q56 124 80 122 L120 122 Q144 124 148 136 L158 200 L42 200 Z" fill={e.roupa} stroke={TINTA} strokeWidth="3" strokeLinejoin="round" />
      {id === "kernel" && (
        <g>
          {[146, 162, 178].map((y) => <g key={y}><circle cx="88" cy={y} r="3" fill={e.detalhe} /><circle cx="112" cy={y} r="3" fill={e.detalhe} /></g>)}
          <rect x="86" y="120" width="9" height="6" fill="#1D4ED8" /><rect x="95" y="120" width="10" height="6" fill="#F9FAFB" /><rect x="105" y="120" width="9" height="6" fill="#DC2626" />
        </g>
      )}
      {id === "vetor" && (
        <g>
          <path d="M100 124 L100 200" stroke={e.detalhe} strokeWidth="2.5" />
          {[146, 164, 182].map((y) => <circle key={y} cx="108" cy={y} r="3" fill={e.detalhe} />)}
        </g>
      )}
      {id === "sintaxe" && (
        <g>
          {/* o avental por cima da camiseta, com as alças */}
          <path d="M72 150 L128 150 L136 200 L64 200 Z" fill={e.detalhe} stroke={TINTA} strokeWidth="3" strokeLinejoin="round" />
          <path d="M76 150 L84 124 M124 150 L116 124" stroke={e.detalhe} strokeWidth="5" />
        </g>
      )}

      {/* o pescoço e a cabeça */}
      <rect x="90" y="112" width="20" height="16" fill={e.pele} stroke={TINTA} strokeWidth="3" />
      <circle cx="67" cy="88" r="7" fill={e.pele} stroke={TINTA} strokeWidth="3" />
      <circle cx="133" cy="88" r="7" fill={e.pele} stroke={TINTA} strokeWidth="3" />
      <ellipse cx="100" cy="86" rx="32" ry="36" fill={e.pele} stroke={TINTA} strokeWidth="3" />

      {id === "kernel" && (
        <g>
          {/* o grisalho dos lados e o toque branco */}
          <path d="M69 74 q-6 14 2 26 M131 74 q6 14 -2 26" fill="none" stroke="#D1D5DB" strokeWidth="7" strokeLinecap="round" />
          <rect x="70" y="44" width="60" height="16" rx="3" fill="#FFFFFF" stroke={TINTA} strokeWidth="3" />
          <circle cx="80" cy="34" r="15" fill="#FFFFFF" stroke={TINTA} strokeWidth="3" />
          <circle cx="120" cy="34" r="15" fill="#FFFFFF" stroke={TINTA} strokeWidth="3" />
          <circle cx="100" cy="24" r="18" fill="#FFFFFF" stroke={TINTA} strokeWidth="3" />
          <rect x="71" y="38" width="58" height="10" fill="#FFFFFF" />
        </g>
      )}
      {id === "vetor" && (
        <g>
          <path d="M67 90 Q62 50 100 48 Q140 50 133 90 Q128 66 106 62 Q84 64 72 98 Z" fill="#3B2416" stroke={TINTA} strokeWidth="3" strokeLinejoin="round" />
          <circle cx="67" cy="98" r="3" fill="#F0BE45" />
          <circle cx="133" cy="98" r="3" fill="#F0BE45" />
        </g>
      )}
      {id === "sintaxe" && (
        <g>
          {/* a cabeça raspada, a barba cheia e a argola */}
          <path d="M70 72 Q74 50 100 50 Q126 50 130 72 Q116 60 100 60 Q84 60 70 72 Z" fill="#4B3A2E" opacity="0.35" />
          <path d="M69 94 Q70 134 100 138 Q130 134 131 94 Q124 114 100 116 Q76 114 69 94 Z" fill="#2B1D14" stroke={TINTA} strokeWidth="2.5" strokeLinejoin="round" />
          <circle cx="135" cy="94" r="3.5" fill="none" stroke="#9CA3AF" strokeWidth="2.5" />
        </g>
      )}

      <Olhos humor={h} e={e} />
      {/* o nariz */}
      <path d={id === "kernel" ? "M96 90 q-6 12 4 13 q8 0 4 -6" : "M98 92 q-4 8 3 9"} fill="none" stroke={TINTA} strokeWidth="2.8" strokeLinecap="round" />
      <ellipse cx="78" cy="100" rx="7" ry="4" fill="#F87171" opacity={h === "bravo" ? 0.75 : e.bochecha} />
      <ellipse cx="122" cy="100" rx="7" ry="4" fill="#F87171" opacity={h === "bravo" ? 0.75 : e.bochecha} />
      {id === "kernel" && (
        <path d="M82 104 q8 -8 18 -3 q10 -5 18 3 q4 -2 6 -7 q-2 10 -9 10 q-8 1 -15 -3 q-7 4 -15 3 q-7 0 -9 -10 q2 5 6 7 z" fill="#9CA3AF" stroke={TINTA} strokeWidth="2" strokeLinejoin="round" />
      )}
      <Boca humor={h} id={id} />
      {h === "bravo" && <path d="M146 44 q6 4 6 10 M166 44 q-6 4 -6 10 M146 68 q6 -4 6 -10 M166 68 q-6 -4 -6 -10" fill="none" stroke="#DC2626" strokeWidth="4" strokeLinecap="round" />}

      <Bracos humor={h} e={e} tatuado={id === "sintaxe"} />
    </svg>
  );
}
