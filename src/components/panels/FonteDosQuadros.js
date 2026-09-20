"use client";

import { useCallback, useEffect, useState } from "react";
import { CY, OR, GR, mono } from "@/lib/theme.js";

/**
 * O interruptor que decide de onde vêm as tarefas: do Trello ou do Abacato.
 *
 * Mostra os DOIS lados antes de deixar trocar. Trocar a fonte das tarefas às cegas é o tipo de
 * clique de que a pessoa se arrepende — ninguém quer descobrir que o Abacato tinha três cards
 * depois de o painel inteiro passar a mostrar três cards. Com os números na tela, o caso
 * "esqueci de importar do Trello" aparece antes, e não depois.
 *
 * A troca vale para os DOIS servidores da Lisa — o da nuvem e o de casa — porque a escolha mora
 * numa tabela do Postgres compartilhado, e não numa variável de ambiente de cada um.
 */

const ROTULOS = {
  trello: { nome: "Trello", nota: "o sistema de fora, pela API deles" },
  abacato: { nome: "Abacato", nota: "o sistema da casa, no mesmo banco" },
};

export default function FonteDosQuadros({ aoTrocar }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [trocando, setTrocando] = useState(null);
  const [confirmando, setConfirmando] = useState(null);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/fonte-dos-quadros");
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || `HTTP ${res.status}`);
      setDados(d);
      setErro(null);
    } catch (e) {
      setErro(e.message);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function trocar(fonte) {
    setTrocando(fonte);
    setConfirmando(null);
    try {
      const res = await fetch("/api/fonte-dos-quadros", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fonte }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || `HTTP ${res.status}`);
      await carregar();
      aoTrocar?.(fonte);
    } catch (e) {
      setErro(e.message);
    } finally {
      setTrocando(null);
    }
  }

  const caixa = {
    border: "1px solid rgba(var(--accent-rgb),0.18)",
    borderRadius: 8,
    padding: "14px 16px",
    background: "linear-gradient(160deg, rgba(var(--accent-rgb),0.05), rgba(0,0,0,0.2))",
    marginBottom: 20,
  };

  if (!dados && !erro) {
    return <div style={{ ...caixa, ...mono, fontSize: 10, color: "rgba(207,239,251,0.5)" }}>lendo as duas fontes…</div>;
  }

  return (
    <div style={caixa}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ ...mono, fontSize: 11, letterSpacing: 3, color: CY }}>◈ FONTE DAS TAREFAS</div>
        {dados && (
          <div style={{ ...mono, fontSize: 9, color: "rgba(207,239,251,0.45)" }}>
            vale para a Lisa de casa e a de fora
          </div>
        )}
      </div>

      {erro && <div style={{ ...mono, fontSize: 10, color: OR, marginTop: 10 }}>⚠ {erro}</div>}

      {dados && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10, marginTop: 12 }}>
          {["trello", "abacato"].map((fonte) => {
            const info = dados.fontes[fonte];
            const ativa = dados.atual === fonte;
            return (
              <div
                key={fonte}
                style={{
                  border: `1px solid ${ativa ? CY : "rgba(var(--accent-rgb),0.15)"}`,
                  borderRadius: 6,
                  padding: "12px 14px",
                  background: ativa ? "rgba(var(--accent-rgb),0.09)" : "transparent",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#eafcff" }}>{ROTULOS[fonte].nome}</span>
                  {ativa && (
                    <span style={{ ...mono, fontSize: 8, letterSpacing: 2, color: GR, border: `1px solid ${GR}`, borderRadius: 3, padding: "2px 6px" }}>
                      EM USO
                    </span>
                  )}
                </div>
                <div style={{ ...mono, fontSize: 9, color: "rgba(207,239,251,0.4)", marginTop: 3 }}>
                  {ROTULOS[fonte].nota}
                </div>

                {info.ok ? (
                  <div style={{ ...mono, fontSize: 10, color: "rgba(207,239,251,0.65)", marginTop: 10, lineHeight: 1.7 }}>
                    {info.quadros} quadro(s) · {info.cards} cards
                    <br />
                    <span style={{ color: GR }}>{info.abertos} abertos</span>
                    {info.atrasados > 0 && <> · <span style={{ color: OR }}>{info.atrasados} atrasados</span></>}
                  </div>
                ) : (
                  // O erro fica escrito no lugar dos números, em vez de sumir com o cartão. Uma
                  // tela que esconde a fonte com problema esconde justamente o que interessa.
                  <div style={{ ...mono, fontSize: 9, color: OR, marginTop: 10, lineHeight: 1.6 }}>
                    ⚠ não consegui ler: {info.erro}
                  </div>
                )}

                {!ativa && (
                  confirmando === fonte ? (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ ...mono, fontSize: 9, color: "rgba(207,239,251,0.6)", lineHeight: 1.6, marginBottom: 8 }}>
                        A partir daí, TODOS os painéis, as notificações e as respostas do
                        assistente passam a usar o {ROTULOS[fonte].nome}. Dá para voltar a
                        qualquer momento, e nada é apagado dos dois lados.
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => trocar(fonte)}
                          disabled={trocando === fonte}
                          style={{ ...mono, fontSize: 9, letterSpacing: 2, padding: "6px 12px", border: `1px solid ${GR}`, borderRadius: 3, background: "rgba(0,255,150,0.08)", color: "#eafcff", cursor: "pointer" }}
                        >
                          {trocando === fonte ? "…" : "CONFIRMAR"}
                        </button>
                        <button
                          onClick={() => setConfirmando(null)}
                          style={{ ...mono, fontSize: 9, letterSpacing: 2, padding: "6px 12px", border: "1px solid rgba(var(--accent-rgb),0.25)", borderRadius: 3, background: "transparent", color: "rgba(207,239,251,0.6)", cursor: "pointer" }}
                        >
                          CANCELAR
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmando(fonte)}
                      // Uma fonte que a Lisa não conseguiu ler não pode ser escolhida: o clique
                      // trocaria o painel inteiro por uma tela vazia.
                      disabled={!info.ok}
                      title={info.ok ? `Passar a usar o ${ROTULOS[fonte].nome}` : "não dá para usar uma fonte que não responde"}
                      style={{
                        ...mono, fontSize: 9, letterSpacing: 2, padding: "6px 12px", marginTop: 12,
                        border: `1px solid ${info.ok ? CY : "rgba(207,239,251,0.2)"}`, borderRadius: 3,
                        background: "rgba(var(--accent-rgb),0.06)",
                        color: info.ok ? "#eafcff" : "rgba(207,239,251,0.3)",
                        cursor: info.ok ? "pointer" : "not-allowed",
                      }}
                    >
                      USAR ESTA
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
