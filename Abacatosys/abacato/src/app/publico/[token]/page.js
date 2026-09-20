"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Barras, Rosca, Agenda } from "@/componentes/painel/Graficos.js";

/**
 * O painel que o cliente abre — sem conta, sem senha, sem nada para explicar.
 *
 * Fica FORA do grupo `(sistema)`: sem barra lateral, sem faixa do topo, sem menu. Quem abre
 * isto não faz parte do sistema e não deveria ver que existe um sistema por trás — só o
 * andamento do trabalho dele.
 *
 * Nada aqui pede login, e nada aqui leva a lugar nenhum de dentro. É uma folha de papel.
 */
export default function PainelPublico() {
  const { token } = useParams();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`/api/publico/${token}`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) throw new Error(d.error || "não consegui abrir este painel");
      setDados(d);
    } catch (e) { setErro(e.message); }
  }, [token]);

  useEffect(() => { carregar(); }, [carregar]);

  // Atualiza sozinho de dez em dez minutos. O cliente costuma deixar a aba aberta, e um painel
  // parado em números de ontem é pior que nenhum painel.
  useEffect(() => {
    const id = setInterval(carregar, 600000);
    return () => clearInterval(id);
  }, [carregar]);

  if (erro) {
    return (
      <main className="abacato-publico">
        <div className="abacato-publico__caixa">
          <div className="abacato-vazio">
            <p className="abacato-vazio__titulo">Este painel não está disponível</p>
            <p>{erro}</p>
            <p className="abacato-dica" style={{ marginTop: 14 }}>
              Se você recebeu este endereço de alguém da Beyond Bits, peça um novo.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!dados) {
    return (
      <main className="abacato-publico">
        <div className="abacato-publico__caixa"><div className="abacato-vazio">carregando…</div></div>
      </main>
    );
  }

  const r = dados.resumo;

  return (
    <main className="abacato-publico">
      <div className="abacato-publico__caixa">
        <header className="abacato-publico__topo">
          <div>
            <h1 className="abacato-publico__titulo">{dados.titulo}</h1>
            <p className="abacato-dica">
              Atualizado em {new Date(dados.atualizadoEm).toLocaleString("pt-BR", {
                day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit",
              })}
            </p>
          </div>
          <Rosca pct={r.progresso} rotulo="concluído" />
        </header>

        <section className="abacato-publico__numeros">
          <div className="abacato-pilula"><strong>{r.total}</strong><span>tarefas</span></div>
          <div className="abacato-pilula abacato-pilula--ok"><strong>{r.feitos}</strong><span>concluídas</span></div>
          <div className="abacato-pilula"><strong>{r.abertos}</strong><span>em andamento</span></div>
          {r.atrasados > 0 && (
            <div className="abacato-pilula abacato-pilula--alerta"><strong>{r.atrasados}</strong><span>atrasadas</span></div>
          )}
          {r.paraHoje > 0 && (
            <div className="abacato-pilula abacato-pilula--atencao"><strong>{r.paraHoje}</strong><span>para hoje</span></div>
          )}
        </section>

        <section className="abacato-bloco">
          <h2 className="abacato-bloco__titulo">Próximas duas semanas</h2>
          <Agenda baldes={dados.semana} />
        </section>

        <div className="abacato-publico__colunas">
          <section className="abacato-bloco">
            <h2 className="abacato-bloco__titulo">Etapas</h2>
            <Barras itens={dados.colunas} cor="var(--abacato-verde-fundo)" />
          </section>

          {dados.etiquetas.length > 0 && (
            <section className="abacato-bloco">
              <h2 className="abacato-bloco__titulo">Por tipo</h2>
              <Barras itens={dados.etiquetas} />
            </section>
          )}
        </div>

        {dados.atrasados.length > 0 && (
          <section className="abacato-bloco">
            <h2 className="abacato-bloco__titulo">O que está atrasado</h2>
            {dados.atrasados.map((c, i) => (
              <div key={i} className="abacato-atrasado">
                <span className="abacato-atrasado__dias">{c.diasAtrasado}d</span>
                <span className="abacato-atrasado__titulo">{c.titulo}</span>
              </div>
            ))}
          </section>
        )}

        {!dados.mostraTitulos && r.atrasados > 0 && (
          <p className="abacato-dica abacato-dica--bloco">
            Os títulos das tarefas não são exibidos neste painel.
          </p>
        )}

        <footer className="abacato-publico__rodape">
          Painel de acompanhamento · Beyond Bits
        </footer>
      </div>
    </main>
  );
}
