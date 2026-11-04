// O mascote do Lisa_Proof (31/10/2026): a marca do sistema, no lugar do antigo ✓ verde. O desenho é
// traço (desenhoDoMascote.js) e pega a cor do texto (currentColor), então serve no claro e no escuro.
// `animado`: o traço se desenha, a tinta preenche e os olhos piscam — a tela de abertura usa.

import { VIEWBOX_DO_MASCOTE, CONTORNOS_DO_MASCOTE, PUPILAS_DO_MASCOTE } from "./desenhoDoMascote.js";

const TINTA = CONTORNOS_DO_MASCOTE.map((c) => c.d).join(" ");

export function Mascote({ tamanho = 32, animado = false, titulo = "", className = "" }) {
  return (
    <svg
      viewBox={VIEWBOX_DO_MASCOTE} width={tamanho} height={tamanho}
      className={`mascote${animado ? " mascote--desenhando" : ""}${className ? ` ${className}` : ""}`}
      role={titulo ? "img" : undefined} aria-label={titulo || undefined} aria-hidden={titulo ? undefined : true}
    >
      {animado && (
        <g className="mascote__traco">
          {CONTORNOS_DO_MASCOTE.map((c, i) => <path key={i} d={c.d} pathLength="1" style={{ "--i": i }} />)}
        </g>
      )}
      <path className="mascote__tinta" d={TINTA} fillRule="evenodd" />
      {PUPILAS_DO_MASCOTE.map((p, i) => <path key={i} className="mascote__pupila" d={p.d} />)}
    </svg>
  );
}

/** O selo da marca: o mascote num círculo claro (o rosto aparece em qualquer fundo). */
export function SeloDoMascote({ className = "pf-marca__icone", tamanho = 32 }) {
  return (
    <span className={`marca-selo ${className}`} style={{ "--selo": `${tamanho}px` }} aria-hidden="true">
      <Mascote tamanho={Math.round(tamanho * 0.86)} />
    </span>
  );
}
