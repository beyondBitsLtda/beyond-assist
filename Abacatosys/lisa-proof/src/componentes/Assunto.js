"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { pedir, obter, criar, mudar } from "@/lib/api.js";
import { NOTA_DE_APROVACAO } from "@/dominio/pratica.js";
import { formatarDia } from "@/dominio/datas.js";
import { NOMES_DOS_NIVEIS } from "@/dominio/plano.js";
import { IconeCerto } from "./Icones.js";
import Explicacao from "./Explicacao.js";

const SITUACOES = {
  atrasada: { texto: "Atrasado", classe: "pf-pilula--alerta" },
  hoje: { texto: "Para hoje", classe: "pf-pilula--verde" },
  feita: { texto: "Concluído hoje", classe: "pf-pilula--verde" },
  adiantar: { texto: "Próximo — dá para adiantar", classe: "pf-pilula--atencao" },
  // Os três abaixo vêm do mapa da trilha, que mostra a trilha inteira e não só o dia.
  concluida: { texto: "Concluído", classe: "pf-pilula--verde" },
  disponivel: { texto: "Liberado", classe: "pf-pilula--verde" },
  futuro: { texto: "Mais para a frente", classe: "" },
  // a trilha amarrada (23/10/2026): teoria feita sem o quiz; e o assunto da semana ainda trancada
  quiz: { texto: "Falta o quiz", classe: "pf-pilula--atencao" },
  trancada: { texto: "🔒 Trancado", classe: "" },
};

function periodo(t) {
  if (!t.inicio) return "";
  return t.inicio === t.fim ? formatarDia(t.inicio, { comSemana: true }) : `${formatarDia(t.inicio)} a ${formatarDia(t.fim)}`;
}

/**
 * Um assunto do dia: o card do quadro STUDY, com as checklists para marcar ali mesmo — e o quiz que
 * conclui o assunto junto com a teoria (src/dominio/avanco.js). Assunto de semana trancada (o projeto
 * da semana anterior ainda não foi aprovado) aparece, mas não se marca.
 *
 * Marcar é OTIMISTA: a caixa muda no clique e o servidor confirma depois. Esperar a ida até o
 * banco do iMac a cada item faria a checklist parecer travada — e, se o servidor recusar, a
 * caixa volta e o erro aparece no próprio card.
 */
export default function Assunto({ tarefa, aoMudar }) {
  const router = useRouter();
  const [checklists, setChecklists] = useState(tarefa.checklists);
  const [ocupado, setOcupado] = useState(new Set());
  const [erro, setErro] = useState("");
  const [explicacao, setExplicacao] = useState(null); // null = fechada; string = aberta
  const [pedindo, setPedindo] = useState("");

  const itens = checklists.flatMap((c) => c.itens);
  const feitos = itens.filter((i) => i.feito).length;
  const trancado = Boolean(tarefa.bloqueada);
  const faltaQuiz = !trancado && Boolean(tarefa.faltaQuiz);
  const situacao = SITUACOES[trancado ? "trancada" : faltaQuiz ? "quiz" : tarefa.situacao] || SITUACOES.hoje;
  const concluido = tarefa.situacao === "feita" || tarefa.situacao === "concluida";
  // o quiz do assunto: o aprovado conclui o assunto (com a teoria); o dispensado já veio concluído
  const precisaDoQuiz = !concluido && !trancado && !tarefa.quiz && !tarefa.dispensa && Boolean(tarefa.trilhaId);
  const teoriaFeita = concluido || Boolean(tarefa.teoria);

  async function fazerQuiz() {
    setPedindo("quiz");
    setErro("");
    try {
      const r = await criar("/api/desafios", { trilhaId: tarefa.trilhaId, tipo: "quiz", cardId: tarefa.cardId });
      router.push(`/pratica/${r.desafio.id}`);
    } catch (e) {
      setErro(e.message);
      setPedindo("");
    }
  }

  function trocarLocal(itemId, feito) {
    setChecklists((atual) => atual.map((c) => ({ ...c, itens: c.itens.map((i) => (i.id === itemId ? { ...i, feito } : i)) })));
  }

  async function marcar(item) {
    if (ocupado.has(item.id) || trancado) return;
    const feito = !item.feito;
    setErro("");
    trocarLocal(item.id, feito);
    setOcupado((s) => new Set(s).add(item.id));
    try {
      const r = await mudar(`/api/itens/${item.id}`, { feito });
      aoMudar?.(r);
    } catch (e) {
      trocarLocal(item.id, !feito);
      setErro(e.message);
    } finally {
      setOcupado((s) => {
        const n = new Set(s);
        n.delete(item.id);
        return n;
      });
    }
  }

  async function concluirSemTarefas() {
    setPedindo("concluir");
    setErro("");
    try {
      const r = await mudar(`/api/cards/${tarefa.cardId}`, { concluido: !teoriaFeita });
      aoMudar?.(r);
    } catch (e) {
      setErro(e.message);
    } finally {
      setPedindo("");
    }
  }

  async function montarTarefas() {
    setPedindo("tarefas");
    setErro("");
    try {
      await criar(`/api/cards/${tarefa.cardId}/tarefas`, {});
      aoMudar?.(null);
    } catch (e) {
      setErro(e.message);
    } finally {
      setPedindo("");
    }
  }

  async function alternarExplicacao({ refazer = false } = {}) {
    if (explicacao !== null && !refazer) {
      setExplicacao(null);
      return;
    }
    setPedindo("explicar");
    setErro("");
    try {
      let texto = null;
      if (!refazer && tarefa.temExplicacao) texto = (await obter(`/api/cards/${tarefa.cardId}/explicacao`)).texto;
      if (!texto) texto = (await pedir(`/api/cards/${tarefa.cardId}/explicacao`, { metodo: "POST" })).texto;
      setExplicacao(texto);
    } catch (e) {
      setErro(e.message);
    } finally {
      setPedindo("");
    }
  }

  return (
    <article className={`pf-cartao pf-assunto${concluido ? " pf-assunto--feito" : ""}`}>
      <div className="pf-assunto__chips">
        <span className="pf-pilula pf-pilula--tema">{tarefa.tema}</span>
        <span className={`pf-pilula ${situacao.classe}`}>{situacao.texto}</span>
        {tarefa.nivel && <span className="pf-pilula">{NOMES_DOS_NIVEIS[tarefa.nivel] || tarefa.nivel}</span>}
        {periodo(tarefa) && <span className="pf-pilula">{periodo(tarefa)}</span>}
      </div>

      <h3 className="pf-assunto__titulo">{tarefa.titulo}</h3>
      {tarefa.objetivo && <p className="pf-assunto__objetivo">Objetivo: {tarefa.objetivo}</p>}
      {trancado && <div className="pf-aviso pf-assunto__aviso">🔒 Este assunto {tarefa.motivo || "está trancado por enquanto"}.</div>}
      {faltaQuiz && (
        <div className="pf-aviso pf-assunto__aviso pf-assunto__aviso--quiz">
          <span>✅ Teoria concluída! Falta o quiz deste assunto ({NOTA_DE_APROVACAO}% ou mais) para concluí-lo.</span>
          <button type="button" className="pf-botao pf-botao--pequeno" onClick={fazerQuiz} disabled={Boolean(pedindo)}>
            {pedindo === "quiz" ? "Preparando o quiz…" : "Fazer o quiz"}
          </button>
        </div>
      )}

      {checklists.map((c) =>
        c.itens.length ? (
          <div key={c.id} className="pf-checklist">
            <p className="pf-checklist__titulo">{c.titulo}</p>
            <ul className="pf-checklist__lista">
              {c.itens.map((i) => (
                <li key={i.id}>
                  <button
                    type="button"
                    className={`pf-item${i.feito ? " pf-item--feito" : ""}`}
                    onClick={() => marcar(i)}
                    disabled={ocupado.has(i.id) || trancado}
                    aria-pressed={i.feito}
                  >
                    <span className="pf-item__caixa"><IconeCerto /></span>
                    <span className="pf-item__texto">{i.texto}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null
      )}

      {!itens.length && (
        <p className="pf-assunto__objetivo">
          Este assunto ainda não tem tarefas. A Lisa pode montar uma checklist de teoria e gravar direto no card do Abacato.
        </p>
      )}

      {explicacao !== null && <Explicacao texto={explicacao} />}
      {erro && <div className="pf-aviso pf-aviso--erro" style={{ marginTop: 12 }}>{erro}</div>}

      <div className="pf-assunto__rodape">
        {!itens.length && !concluido && (
          <button type="button" className="pf-botao pf-botao--pequeno" onClick={montarTarefas} disabled={Boolean(pedindo)}>
            {pedindo === "tarefas" ? "Montando…" : "Montar tarefas com a Lisa"}
          </button>
        )}
        <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={() => alternarExplicacao()} disabled={Boolean(pedindo)}>
          {pedindo === "explicar" ? "A Lisa está escrevendo…" : explicacao !== null ? "Fechar explicação" : "Explicar com a Lisa"}
        </button>
        {explicacao !== null && (
          <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={() => alternarExplicacao({ refazer: true })} disabled={Boolean(pedindo)}>
            Explicar de novo
          </button>
        )}
        {!itens.length && !tarefa.recorrente && (
          <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={concluirSemTarefas} disabled={Boolean(pedindo)}>
            {teoriaFeita ? "Reabrir assunto" : tarefa.dispensa || !tarefa.trilhaId ? "Concluir assunto" : "Concluir a teoria"}
          </button>
        )}
        {precisaDoQuiz && !faltaQuiz && (
          <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={fazerQuiz} disabled={Boolean(pedindo)}
            title={`O assunto conclui com a teoria e um quiz dele com ${NOTA_DE_APROVACAO}% ou mais`}>
            {pedindo === "quiz" ? "Preparando o quiz…" : "❓ Quiz do assunto"}
          </button>
        )}
        {tarefa.quiz && !concluido && <span className="pf-pilula pf-pilula--verde">quiz aprovado ✓</span>}
        {itens.length > 0 && <span className="pf-pilula">{feitos}/{itens.length} tarefas</span>}
        <a className="pf-assunto__link" href={tarefa.link} target="_blank" rel="noreferrer">Abrir no Abacato ↗</a>
      </div>
    </article>
  );
}
