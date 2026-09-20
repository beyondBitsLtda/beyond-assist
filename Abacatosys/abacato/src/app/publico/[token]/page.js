"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Barras, Rosca, Agenda } from "@/componentes/painel/Graficos.js";

/** Uma data curta, do jeito que se lê em voz alta: "12 de mar". Sem ano quando é o ano
 *  corrente — o ano só atrapalha a leitura de um prazo que é daqui a duas semanas. */
function quando(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const mesmoAno = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("pt-BR", mesmoAno
    ? { day: "2-digit", month: "short" }
    : { day: "2-digit", month: "short", year: "numeric" });
}

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

        {/* A ORDEM DAS SEÇÕES É A ORDEM DAS PERGUNTAS DE QUEM ACOMPANHA DE FORA.
            Antes o painel abria com gráficos: eles dizem "como vai", e a primeira
            pergunta de um cliente nunca é essa — é "o que vocês estão fazendo?".
            Os gráficos continuam, no fim, para quem quiser o panorama. */}

        {dados.emAndamento?.length > 0 && (
          <section className="abacato-bloco">
            <h2 className="abacato-bloco__titulo">Em andamento agora</h2>
            <div className="abacato-linhas">
              {dados.emAndamento.map((c, i) => (
                <div key={i} className="abacato-linha-tarefa">
                  <span className="abacato-linha-tarefa__etapa">{c.etapa}</span>
                  <span className="abacato-linha-tarefa__titulo">{c.titulo}</span>
                  {c.fimEm && (
                    <span className={`abacato-linha-tarefa__prazo abacato-linha-tarefa__prazo--${c.estado}`}>
                      {quando(c.fimEm)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {dados.proximasEntregas?.length > 0 && (
          <section className="abacato-bloco">
            <h2 className="abacato-bloco__titulo">Próximas entregas</h2>
            <div className="abacato-linhas">
              {dados.proximasEntregas.map((c, i) => (
                <div key={i} className="abacato-linha-tarefa">
                  <span className={`abacato-linha-tarefa__quando abacato-linha-tarefa__quando--${c.estado}`}>
                    {c.emDias === 0 ? "hoje" : c.emDias === 1 ? "amanhã" : `em ${c.emDias} dias`}
                  </span>
                  <span className="abacato-linha-tarefa__titulo">{c.titulo}</span>
                  <span className="abacato-linha-tarefa__prazo">{quando(c.fimEm)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

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

        {/* O que já ficou pronto. Sem esta seção o painel só mostra dívida — prazo
            vindo, prazo vencido — e dá a impressão de que nada anda. */}
        {dados.entregues?.length > 0 && (
          <section className="abacato-bloco">
            <h2 className="abacato-bloco__titulo">Entregue recentemente</h2>
            <div className="abacato-linhas">
              {dados.entregues.map((c, i) => (
                <div key={i} className="abacato-linha-tarefa">
                  <span className="abacato-linha-tarefa__ok">✓</span>
                  <span className="abacato-linha-tarefa__titulo">{c.titulo}</span>
                  {c.fimEm && <span className="abacato-linha-tarefa__prazo">{quando(c.fimEm)}</span>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Sem títulos, o painel ainda diz QUANTAS frentes existem: o número não
            identifica ninguém, e sem ele não sobra nada além de porcentagem. */}
        {!dados.mostraTitulos && dados.contagens && (
          <section className="abacato-bloco">
            <h2 className="abacato-bloco__titulo">Andamento</h2>
            <div className="abacato-publico__numeros">
              <div className="abacato-pilula"><strong>{dados.contagens.emAndamento}</strong><span>em andamento</span></div>
              <div className="abacato-pilula"><strong>{dados.contagens.proximasEntregas}</strong><span>entregas à frente</span></div>
              <div className="abacato-pilula abacato-pilula--ok"><strong>{dados.contagens.entregues}</strong><span>entregues</span></div>
            </div>
            <p className="abacato-dica abacato-dica--bloco">
              Os títulos das tarefas não são exibidos neste painel.
            </p>
          </section>
        )}

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

        <footer className="abacato-publico__rodape">
          Painel de acompanhamento · Beyond Bits
        </footer>
      </div>
    </main>
  );
}
