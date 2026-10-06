"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { obter, criar } from "@/lib/api.js";
import { formatarDia } from "@/dominio/datas.js";
import { NOTA_DE_APROVACAO, PONTOS_DA_PRATICA, fimDoPeriodo } from "@/dominio/pratica.js";
import Neuro, { reagir } from "@/componentes/Neuro.js";

/** O que o Neuro diz ao abrir a prática: a cobrança do dia. */
function falaDoNeuro(trilhas) {
  if (!trilhas.length) return { humor: "surpreso", fala: "Monte uma trilha primeiro, e aí eu preparo a prática para você!" };
  const quizPendente = trilhas.filter((t) => t.quiz?.status !== "concluido").length;
  const exercicioPendente = trilhas.filter((t) => t.exercicio?.status !== "concluido").length;
  if (quizPendente) return { humor: "surpreso", fala: `Ei! ${quizPendente === 1 ? "O quiz de hoje está" : `${quizPendente} quizzes de hoje estão`} te esperando. São só 5 perguntas!` };
  if (exercicioPendente) return { humor: "feliz", fala: "Quiz feito! Que tal o exercício do dia para fechar com chave de ouro?" };
  return { humor: "comemorando", fala: "Prática do dia completa! Você está voando. 🚀" };
}

function situacaoDoDiario(d, tipo) {
  if (!d?.status) return { texto: tipo === "quiz" ? "5 perguntas" : "10 a 20 minutos", acao: "Começar", classe: "" };
  if (d.status === "concluido") {
    const ok = (d.nota ?? 0) >= NOTA_DE_APROVACAO;
    return { texto: `${tipo === "quiz" ? "Acertos" : "Nota"}: ${d.nota}% · +${d.pontos} pts`, acao: "Rever", classe: ok ? "pratica__bloco--feito" : "pratica__bloco--parcial" };
  }
  return { texto: tipo === "quiz" ? "Em andamento" : `Nota até agora: ${d.nota ?? "—"}`, acao: "Continuar", classe: "pratica__bloco--andamento" };
}

function situacaoDoProjeto(p, tipo) {
  const prazo = `até ${formatarDia(fimDoPeriodo(tipo, p.periodo), { comSemana: true })}`;
  if (!p?.status) return { texto: prazo, acao: "Ver projeto", classe: "" };
  if (p.status === "concluido") {
    const ok = (p.nota ?? 0) >= NOTA_DE_APROVACAO;
    return { texto: `Nota ${p.nota} · +${p.pontos} pts`, acao: "Rever", classe: ok ? "pratica__bloco--feito" : "pratica__bloco--parcial" };
  }
  return { texto: `${prazo} · ${p.nota != null ? `nota ${p.nota}` : "aguardando entrega"}`, acao: "Continuar", classe: "pratica__bloco--andamento" };
}

const ROTULOS = {
  quiz: { titulo: "Quiz do dia", icone: "❓", pontos: `até ${5 * PONTOS_DA_PRATICA.acertoNoQuiz + PONTOS_DA_PRATICA.quizPerfeito} pts` },
  exercicio: { titulo: "Exercício do dia", icone: "⌨️", pontos: `até ${PONTOS_DA_PRATICA.exercicio} pts` },
  projeto_semanal: { titulo: "Projeto da semana", icone: "🎁", pontos: `até ${PONTOS_DA_PRATICA.projeto_semanal} pts` },
  projeto_mensal: { titulo: "Projeto do mês", icone: "🏆", pontos: `até ${PONTOS_DA_PRATICA.projeto_mensal} pts` },
};

function Bloco({ tipo, situacao, ocupado, aoAbrir }) {
  const r = ROTULOS[tipo];
  return (
    <button type="button" className={`pratica__bloco ${situacao.classe}`} onClick={aoAbrir} disabled={ocupado}>
      <span className="pratica__icone" aria-hidden="true">{r.icone}</span>
      <span className="pratica__textos">
        <strong>{r.titulo}</strong>
        <small>{situacao.texto}</small>
        <small className="pratica__pontos">{r.pontos}</small>
      </span>
      <span className="pratica__acao">{ocupado ? "Preparando…" : situacao.acao}</span>
    </button>
  );
}

export default function Pratica() {
  const router = useRouter();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState("");

  useEffect(() => {
    obter("/api/pratica").then(setDados).catch((e) => setErro(e.message));
  }, []);

  async function abrir(trilha, tipo, existente, periodo) {
    if (existente?.id) return router.push(`/pratica/${existente.id}`);
    const chave = `${trilha.trilhaId}:${tipo}`;
    setOcupado(chave);
    setErro("");
    reagir("pensando", tipo === "quiz" ? "Preparando perguntas fresquinhas…" : "Pensando num desafio do seu nível…", 30000);
    try {
      const r = await criar("/api/desafios", { trilhaId: trilha.trilhaId, tipo, periodo });
      router.push(`/pratica/${r.desafio.id}`);
    } catch (e) {
      setErro(e.message);
      reagir("triste", "Não consegui preparar agora. Tenta de novo daqui a pouco?");
      setOcupado("");
    }
  }

  if (!dados) {
    return erro ? <div className="pf-aviso pf-aviso--erro">{erro}</div> : <div className="pf-carregando">Preparando a prática…</div>;
  }

  const neuro = falaDoNeuro(dados.trilhas);

  return (
    <>
      <div className="pf-cabecalho">
        <div>
          <h1>Prática</h1>
          <p>Quiz e exercício todo dia, projeto toda semana e todo mês. A Lisa corrige tudo.</p>
        </div>
      </div>

      <div className="pf-cartao pratica__neuro">
        <Neuro humor={neuro.humor} fala={neuro.fala} tamanho={104} ouvir />
      </div>

      {erro && <div className="pf-aviso pf-aviso--erro" style={{ marginTop: 12 }}>{erro}</div>}
      {!dados.iaDisponivel && <div className="pf-aviso" style={{ marginTop: 12 }}>A IA não está configurada neste servidor: a prática precisa dela.</div>}

      {dados.trilhas.length === 0 ? (
        <div className="pf-cartao pf-vazio" style={{ marginTop: 16 }}>
          <h2>Nenhuma trilha ativa</h2>
          <p>A prática usa os assuntos da sua trilha. Monte uma primeiro.</p>
          <Link className="pf-botao" href="/trilhas">Montar trilha</Link>
        </div>
      ) : (
        dados.trilhas.map((t) => (
          <section key={t.trilhaId} className="pf-secao">
            <h2 className="pf-secao__titulo">
              {t.tema}
              <small>{t.assunto ? `Assunto de hoje: ${t.assunto.titulo}` : ""}</small>
            </h2>
            <div className="pratica__grade">
              <Bloco tipo="quiz" situacao={situacaoDoDiario(t.quiz, "quiz")} ocupado={ocupado === `${t.trilhaId}:quiz`}
                aoAbrir={() => abrir(t, "quiz", t.quiz)} />
              <Bloco tipo="exercicio" situacao={situacaoDoDiario(t.exercicio, "exercicio")} ocupado={ocupado === `${t.trilhaId}:exercicio`}
                aoAbrir={() => abrir(t, "exercicio", t.exercicio)} />
              <Bloco tipo="projeto_semanal" situacao={situacaoDoProjeto(t.projetoSemanal, "projeto_semanal")} ocupado={ocupado === `${t.trilhaId}:projeto_semanal`}
                aoAbrir={() => abrir(t, "projeto_semanal", t.projetoSemanal, t.projetoSemanal.periodo)} />
              <Bloco tipo="projeto_mensal" situacao={situacaoDoProjeto(t.projetoMensal, "projeto_mensal")} ocupado={ocupado === `${t.trilhaId}:projeto_mensal`}
                aoAbrir={() => abrir(t, "projeto_mensal", t.projetoMensal, t.projetoMensal.periodo)} />
            </div>
          </section>
        ))
      )}
    </>
  );
}
