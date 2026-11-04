// Os hologramas da cena (01/11/2026), no estilo da imagem que a pessoa mandou: anéis com marcações,
// uma mira, painéis de cantos cortados e barras de dados, em ciano. Só aparecem com a resposta
// (a classe bb-cena--hud, em CenaDaLisa.js), cada um na sua profundidade (--z) e no seu tempo
// (--atraso), piscando ao surgir como um holograma ligando. As barras do sinal seguem o nível da voz
// (--nivel). Tudo é decoração: aria-hidden, sem clique.

const TICKS = Array.from({ length: 72 }, (_, i) => i * 5);

/** O anel grande atrás da Lisa (anda com ela): marcações, um anel tracejado e arcos girando. */
export function AnelDaLisa() {
  return (
    <svg className="bb-holo bb-holo--anel" viewBox="-100 -100 200 200" aria-hidden="true" style={{ "--z": "-60px", "--atraso": "0.05s" }}>
      <circle r="97" className="bb-holo-traco" strokeOpacity="0.22" />
      <g className="bb-holo-gira">
        <circle r="91" className="bb-holo-traco" strokeWidth="1.4" strokeDasharray="1.5 4.5" strokeOpacity="0.75" />
      </g>
      <g className="bb-holo-gira bb-holo-gira--contra">
        <circle r="84" className="bb-holo-traco" strokeWidth="2.6" strokeDasharray="70 30 18 120 40 250" strokeOpacity="0.85" />
      </g>
      <g className="bb-holo-gira bb-holo-gira--lento">
        {TICKS.map((a) => (
          <line key={a} x1="0" y1={a % 30 ? -74 : -70} x2="0" y2="-77" className="bb-holo-traco" strokeOpacity={a % 30 ? 0.35 : 0.8} transform={`rotate(${a})`} />
        ))}
      </g>
      <circle r="66" className="bb-holo-traco" strokeOpacity="0.15" strokeDasharray="2 6" />
    </svg>
  );
}

/** Os quatro cantos que enquadram a Lisa (andam com ela). */
export function CantosDaLisa() {
  return (
    <div className="bb-holo bb-holo--cantos" aria-hidden="true" style={{ "--z": "30px", "--atraso": "0.25s" }}>
      <i /><i /><i /><i />
    </div>
  );
}

/** A mira: um mostrador redondo com marcações, cruz e um arco que gira (como o do meio da imagem). */
function Mira() {
  return (
    <svg className="bb-holo bb-holo--mira" viewBox="-60 -60 120 120" aria-hidden="true" style={{ "--z": "50px", "--atraso": "0.35s" }}>
      <circle r="56" className="bb-holo-traco" strokeWidth="1.2" strokeOpacity="0.8" />
      <g className="bb-holo-gira bb-holo-gira--rapido">
        <circle r="48" className="bb-holo-traco" strokeWidth="3" strokeDasharray="40 262" strokeOpacity="0.95" />
      </g>
      {TICKS.filter((a) => a % 10 === 0).map((a) => (
        <line key={a} x1="0" y1="-42" x2="0" y2={a % 90 ? -38 : -32} className="bb-holo-traco" strokeOpacity="0.6" transform={`rotate(${a})`} />
      ))}
      <circle r="18" className="bb-holo-traco" strokeOpacity="0.7" />
      <circle r="5" className="bb-holo-cheio" />
      <path d="M-30 0H-22M22 0H30M0-30V-22M0 22V30" className="bb-holo-traco" strokeWidth="1.4" />
    </svg>
  );
}

/** Um painel de cantos cortados (a moldura dos painéis de dados). */
function Painel({ classe, z, atraso, titulo, children }) {
  return (
    <div className={`bb-holo bb-holo-painel ${classe}`} aria-hidden="true" style={{ "--z": z, "--atraso": atraso }}>
      <div className="bb-holo-painel-dentro">
        <div className="bb-holo-painel-titulo"><span>{titulo}</span><b>● ● ●</b></div>
        {children}
      </div>
    </div>
  );
}

const ALTURAS = [0.5, 0.8, 1, 0.7, 0.9, 0.6, 1, 0.85, 0.55, 0.95, 0.7, 0.4, 0.9, 1, 0.65, 0.8, 0.5, 0.75, 1, 0.6];

/**
 * Os hologramas soltos na cena. `dados`: { estado, voz, palavras, fontes } — o que o painel de status
 * mostra.
 */
export default function HologramasDaLisa({ dados = {} }) {
  const linha = (rotulo, valor) => <div className="bb-holo-linha"><span>{rotulo}</span><b>{valor}</b></div>;
  return (
    <div className="bb-holos" aria-hidden="true">
      <Mira />
      <Painel classe="bb-holo--status" z="80px" atraso="0.45s" titulo="SISTEMA LISA">
        {linha("ESTADO", dados.estado || "—")}
        {linha("VOZ", dados.voz || "—")}
        {linha("PALAVRAS", String(dados.palavras ?? 0).padStart(3, "0"))}
        {linha("FONTES", String(dados.fontes ?? 0).padStart(2, "0"))}
        <div className="bb-holo-pontos">{Array.from({ length: 14 }, (_, i) => <i key={i} />)}</div>
      </Painel>
      <Painel classe="bb-holo--sinal" z="60px" atraso="0.6s" titulo="SINAL DE VOZ">
        <div className="bb-holo-eq">
          {ALTURAS.map((k, i) => <i key={i} style={{ "--k": k, "--d": `${(i % 7) * -0.17}s` }} />)}
        </div>
      </Painel>
      <div className="bb-holo bb-holo--barras" style={{ "--z": "30px", "--atraso": "0.75s" }}>
        <i /><i /><i />
      </div>
    </div>
  );
}
