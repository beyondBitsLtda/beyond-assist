"use client";

// Painel "Visual da Lisa" (pedido de 24/10/2026: "faça uns modos gráficos para o assistente
// baseados nesses visuais, e deixe um painel com a visualização do tema"). Mostra cada visual
// ao vivo — na prévia grande e na galeria —, com um simulador de estado (pronta, ouvindo,
// pensando, falando) para ver como ele reage, e escolhe o que vai para o Assistente. A escolha
// fica neste navegador e vale na hora, inclusive numa aba do Assistente já aberta.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import VisualDaLisa, { usarVisualEscolhido } from "@/components/panels/visuais/VisualDaLisa.js";
import { VISUAIS, ESTADOS, escolherVisual, visualDe } from "@/lib/visuaisDaLisa.js";

const NOMES_DOS_ESTADOS = { auto: "Automático", pronta: "Pronta", ouvindo: "Ouvindo", pensando: "Pensando", falando: "Falando" };
const PASSO_DO_AUTOMATICO_MS = 3500;

export default function VisualDaLisaPage() {
  const emUso = usarVisualEscolhido();
  const [foco, setFoco] = useState(null); // o visual da prévia grande; null = o que está em uso
  const [simular, setSimular] = useState("auto");
  const [estadoAgora, setEstadoAgora] = useState("pronta");
  const estadoRef = useRef("pronta");

  // o simulador: um estado fixo, ou o automático passando pelos quatro
  useEffect(() => {
    if (simular !== "auto") {
      estadoRef.current = simular;
      setEstadoAgora(simular);
      return undefined;
    }
    let i = 0;
    estadoRef.current = ESTADOS[0];
    setEstadoAgora(ESTADOS[0]);
    const id = setInterval(() => {
      i = (i + 1) % ESTADOS.length;
      estadoRef.current = ESTADOS[i];
      setEstadoAgora(ESTADOS[i]);
    }, PASSO_DO_AUTOMATICO_MS);
    return () => clearInterval(id);
  }, [simular]);

  // o mesmo contrato do Assistente: { estado, nivel } a cada quadro (sem nível medido, o visual simula a fala)
  const obterSinal = useCallback(() => ({ estado: estadoRef.current, nivel: null }), []);

  const naPrevia = foco || emUso;
  const v = visualDe(naPrevia);

  return (
    <div className="bb-visuais">
      <header>
        <h1>Visual da Lisa</h1>
        <p>O que fica no centro do Assistente e reage à voz — a sua, quando ela ouve, e a dela, quando fala. Escolha um; a troca vale na hora.</p>
      </header>

      <div className="bb-visuais-simulador" role="group" aria-label="Simular o estado da Lisa">
        <span>Simular:</span>
        {["auto", ...ESTADOS].map((e) => (
          <button key={e} type="button" aria-pressed={simular === e} onClick={() => setSimular(e)}>
            {NOMES_DOS_ESTADOS[e]}
          </button>
        ))}
      </div>

      <section className="bb-visuais-palco" aria-label={`Prévia: ${v.nome}`}>
        <div className="bb-visuais-tela bb-visuais-tela--grande">
          <VisualDaLisa key={`grande-${naPrevia}`} modo={naPrevia} obterSinal={obterSinal} />
        </div>
        <div className="bb-visuais-info">
          <span className="bb-visuais-estado"><i />{NOMES_DOS_ESTADOS[estadoAgora]}</span>
          <h2>{v.nome}</h2>
          <p>{v.descricao}</p>
          <div className="bb-visuais-paleta" aria-label="Cores de cada estado">
            {ESTADOS.map((e) => (
              <div key={e} className={`bb-visuais-paleta-linha${e === estadoAgora ? " bb-visuais-paleta-linha--agora" : ""}`}>
                <span>{NOMES_DOS_ESTADOS[e]}</span>
                {v.cores[e].map((cor) => <i key={cor} style={{ background: cor }} title={cor} />)}
              </div>
            ))}
          </div>
          <div className="bb-visuais-acoes">
            {naPrevia === emUso
              ? <span className="bb-visuais-em-uso">✓ Em uso no Assistente</span>
              : <button type="button" className="bb-visuais-usar" onClick={() => escolherVisual(naPrevia)}>Usar este visual</button>}
            <Link href="/assistant" className="bb-visuais-link">Abrir o Assistente →</Link>
          </div>
        </div>
      </section>

      <section className="bb-visuais-galeria" aria-label="Todos os visuais">
        {VISUAIS.map((x) => (
          <article key={x.id} className={`bb-visuais-cartao${x.id === naPrevia ? " bb-visuais-cartao--foco" : ""}`}>
            <button type="button" className="bb-visuais-tela" onClick={() => setFoco(x.id)} aria-label={`Ver ${x.nome} na prévia grande`}>
              <VisualDaLisa modo={x.id} obterSinal={obterSinal} ocupacao={0.82} />
            </button>
            <div className="bb-visuais-cartao-pe">
              <strong>{x.nome}</strong>
              {x.id === emUso
                ? <span className="bb-visuais-em-uso">Em uso</span>
                : <button type="button" className="bb-visuais-usar bb-visuais-usar--pequeno" onClick={() => escolherVisual(x.id)}>Usar</button>}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
