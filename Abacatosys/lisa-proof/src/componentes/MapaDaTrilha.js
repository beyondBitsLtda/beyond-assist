"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { criar } from "@/lib/api.js";
import { diaDe, formatarDia } from "@/dominio/datas.js";
import { mapaDaTrilha, NOTA_DE_APROVACAO, fimDoPeriodo } from "@/dominio/pratica.js";
import Neuro, { reagir, reagirAoResultado } from "./Neuro.js";
import Folha from "./Folha.js";
import Assunto from "./Assunto.js";

/** O zigue-zague do caminho, em % da largura a partir do centro. Contínuo entre as semanas. */
const ONDA = [0, 17, 25, 17, 0, -17, -25, -17];
const LINHA = 128; // altura de cada parada, em px

const ICONES = {
  feito: <path d="M6 12.5l4 4L18 8" />,
  livro: <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" />,
  alerta: <path d="M12 6v8M12 18h.01" />,
  cadeado: <path d="M6 11h12v10H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3" />,
  bau: <path d="M3 10h18v10H3zM3 10a9 5 0 0 1 18 0M12 13v3M3 14h18" />,
  trofeu: <path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6v4H9z" />,
  bandeira: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
};

function Icone({ nome }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONES[nome]}
    </svg>
  );
}

function iconeDo(no) {
  if (no.tipo === "projeto_semanal") return no.estado === "bloqueado" ? "cadeado" : "bau";
  if (no.tipo === "projeto_mensal") return no.estado === "bloqueado" ? "cadeado" : "trofeu";
  if (no.tipo === "chegada") return "bandeira";
  return { feito: "feito", atrasado: "alerta", bloqueado: "cadeado" }[no.estado] || "livro";
}

function rotuloDo(no) {
  if (no.tipo === "assunto") return no.etapa.titulo;
  if (no.tipo === "projeto_semanal") return no.desafio?.titulo || "Projeto da semana";
  if (no.tipo === "projeto_mensal") return no.desafio?.titulo || "Projeto do mês";
  return no.estado === "feito" ? "Trilha concluída!" : "Chegada";
}

/** Caminho suave pelos pontos: curvas com controles na vertical, como uma estrada de mapa. */
function caminho(pontos) {
  if (pontos.length < 2) return "";
  let d = `M ${pontos[0].x} ${pontos[0].y}`;
  for (let i = 1; i < pontos.length; i++) {
    const a = pontos[i - 1];
    const b = pontos[i];
    const meio = (a.y + b.y) / 2;
    d += ` C ${a.x} ${meio}, ${b.x} ${meio}, ${b.x} ${b.y}`;
  }
  return d;
}

/** Agrupa os nós em unidades (semanas): cabeçalho + paradas. A chegada vai na última. */
function emUnidades(nos, escala) {
  const unidades = [];
  let indice = 0;
  for (const no of nos) {
    if (no.tipo === "unidade") {
      unidades.push({ cabecalho: no, paradas: [] });
      continue;
    }
    if (!unidades.length) unidades.push({ cabecalho: null, paradas: [] });
    unidades.at(-1).paradas.push({ ...no, onda: ONDA[indice++ % ONDA.length] * escala });
  }
  return unidades;
}

/**
 * Celular estreito pede um zigue-zague mais contido: com a amplitude do computador, o rótulo da
 * parada da ponta passava da borda e a página inteira ganhava rolagem lateral.
 */
function useEscalaDaOnda() {
  const [escala, setEscala] = useState(1);
  useEffect(() => {
    const consulta = window.matchMedia("(max-width: 639px)");
    const aplicar = () => setEscala(consulta.matches ? 0.68 : 1);
    aplicar();
    consulta.addEventListener("change", aplicar);
    return () => consulta.removeEventListener("change", aplicar);
  }, []);
  return escala;
}

const limitarX = (x) => Math.min(84, Math.max(16, x));

const SITUACAO_DO_ESTADO = { feito: "concluida", atual: "hoje", disponivel: "disponivel", atrasado: "atrasada", bloqueado: "futuro" };

function Unidade({ unidade, aoEscolher, temNeuro }) {
  const { cabecalho, paradas } = unidade;
  const altura = paradas.length * LINHA + 40;
  const pontos = paradas.map((p, i) => ({ x: 50 + p.onda, y: i * LINHA + 56 }));
  let feitos = 0;
  while (feitos < paradas.length && paradas[feitos].estado === "feito") feitos++;

  const assuntos = paradas.filter((p) => p.tipo === "assunto");
  const assuntosFeitos = assuntos.filter((p) => p.estado === "feito").length;
  const completa = assuntos.length > 0 && assuntosFeitos === assuntos.length;

  return (
    <section className="mapa__unidade">
      {cabecalho && (
        <header className={`mapa__faixa${completa ? " mapa__faixa--completa" : ""}`}>
          <div>
            <strong>{cabecalho.titulo}</strong>
            {cabecalho.de && <span>{formatarDia(cabecalho.de)} – {formatarDia(cabecalho.ate)}</span>}
          </div>
          {assuntos.length > 0 && <span className="mapa__faixa-conta">{completa ? "✓ " : ""}{assuntosFeitos}/{assuntos.length}</span>}
        </header>
      )}

      <div className="mapa__trecho" style={{ height: altura }}>
        <svg className="mapa__caminho" viewBox={`0 0 100 ${altura}`} preserveAspectRatio="none" aria-hidden="true">
          <path d={caminho(pontos)} className="mapa__estrada" vectorEffect="non-scaling-stroke" />
          {feitos > 1 && <path d={caminho(pontos.slice(0, feitos))} className="mapa__estrada mapa__estrada--feita" vectorEffect="non-scaling-stroke" />}
          <path d={caminho(pontos)} className="mapa__faixa-central" vectorEffect="non-scaling-stroke" />
        </svg>

        {paradas.map((p, i) => {
          const x = 50 + p.onda;
          const y = i * LINHA + 56;
          const atual = p.estado === "atual" || (p.tipo === "chegada" && p.estado === "feito");
          return (
            <div key={p.chave}>
              {p.estado === "atual" && (
                <span className="mapa__comecar" style={{ left: `${x}%`, top: y - 66 }}>Começar</span>
              )}
              <button
                type="button"
                className={`mapa__no mapa__no--${p.tipo} mapa__no--${p.estado}`}
                style={{ left: `${x}%`, top: y }}
                onClick={() => aoEscolher(p)}
                aria-label={`${rotuloDo(p)} — ${p.estado}`}
              >
                <Icone nome={iconeDo(p)} />
              </button>
              <span className={`mapa__rotulo${atual ? " mapa__rotulo--atual" : ""}`} style={{ left: `${x}%`, top: y + 46 }}>
                {rotuloDo(p)}
              </span>
              {atual && temNeuro && (
                <div className="mapa__neuro" style={{ left: `${limitarX(p.onda >= 0 ? x - 32 : x + 32)}%`, top: y - 58 }}>
                  <Neuro humor={p.tipo === "chegada" ? "comemorando" : "normal"} tamanho={92} ouvir lado="cima" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * O mapa da trilha, no espírito do Duolingo: um caminho desenhado que desce em zigue-zague, com
 * cada assunto como uma parada, o baú do projeto no fim de cada semana, o troféu do mês e a
 * bandeira de chegada. O Neuro fica parado no assunto de agora.
 *
 * Tocar numa parada abre a folha com o conteúdo dela: o assunto (com as tarefas para marcar ali
 * mesmo) ou o projeto.
 */
export default function MapaDaTrilha({ trilha, etapas, projetos, aoMudar }) {
  const router = useRouter();
  const hoje = diaDe();
  const [aberta, setAberta] = useState(null);
  const [preparando, setPreparando] = useState(false);
  const [erro, setErro] = useState("");

  const escala = useEscalaDaOnda();
  const unidades = useMemo(
    () => emUnidades(mapaDaTrilha({ etapas, desafios: projetos, hoje, base: trilha.inicioEm }), escala),
    [etapas, projetos, hoje, trilha.inicioEm, escala]
  );
  const temAtual = unidades.some((u) => u.paradas.some((p) => p.estado === "atual" || (p.tipo === "chegada" && p.estado === "feito")));

  // Estável entre renderizações: a Folha usa isto como dependência para ouvir o Esc.
  const fechar = useCallback(() => {
    setAberta(null);
    setErro("");
  }, []);

  async function abrirProjeto(no) {
    if (no.desafio?.id) return router.push(`/pratica/${no.desafio.id}`);
    setPreparando(true);
    setErro("");
    reagir("pensando", "Deixa eu pensar num projeto bem legal pra você…", 20000);
    try {
      const r = await criar("/api/desafios", { trilhaId: trilha.id, tipo: no.tipo, periodo: no.periodo });
      router.push(`/pratica/${r.desafio.id}`);
    } catch (e) {
      setErro(e.message);
      reagir("triste", "Não consegui montar o projeto agora. Tenta de novo?");
      setPreparando(false);
    }
  }

  // A etapa aberta, sempre a versão mais nova (depois de marcar algo, `etapas` muda).
  const etapaAberta = aberta?.tipo === "assunto" ? etapas.find((e) => e.cardId === aberta.etapa.cardId) : null;

  return (
    <div className="mapa">
      {unidades.map((u, i) => (
        <Unidade key={u.cabecalho?.chave || `u${i}`} unidade={u} aoEscolher={setAberta} temNeuro={temAtual} />
      ))}

      <Folha aberta={Boolean(aberta)} aoFechar={fechar} titulo={aberta ? rotuloDo(aberta) : ""}>
        {aberta?.tipo === "assunto" && etapaAberta && (
          <Assunto
            key={`${etapaAberta.cardId}:${etapaAberta.checklists.map((c) => c.id).join(",")}`}
            tarefa={{
              ...etapaAberta,
              tema: trilha.tema,
              situacao: SITUACAO_DO_ESTADO[aberta.estado] || "disponivel",
              temExplicacao: false,
            }}
            aoMudar={(r) => {
              reagirAoResultado(r);
              aoMudar?.();
            }}
          />
        )}

        {(aberta?.tipo === "projeto_semanal" || aberta?.tipo === "projeto_mensal") && (
          <div className="folha__conteudo">
            <span className="pf-pilula">{aberta.tipo === "projeto_semanal" ? "Projeto da semana" : "Projeto do mês"}</span>
            <h2>{rotuloDo(aberta)}</h2>
            <p className="pf-estat__nota">
              {formatarDia(aberta.periodo)} a {formatarDia(fimDoPeriodo(aberta.tipo, aberta.periodo))}
              {aberta.desafio?.nota != null ? ` · nota ${aberta.desafio.nota}` : ""}
            </p>
            {aberta.estado === "bloqueado" ? (
              <p>Trancado. Libera em {formatarDia(aberta.periodo)}, quando o período começar.</p>
            ) : (
              <>
                <p>
                  {aberta.estado === "feito"
                    ? "Aprovado! Você pode rever a avaliação da Lisa."
                    : aberta.estado === "entregue"
                      ? `Entregue, mas abaixo de ${NOTA_DE_APROVACAO}. Veja o que a Lisa sugeriu.`
                      : aberta.desafio
                        ? "Projeto em andamento. Entregue o link do repositório no GitHub para a Lisa avaliar."
                        : "A Lisa monta um projeto com os assuntos deste período. Você entrega pelo GitHub e ela avalia."}
                </p>
                {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
                <button type="button" className="pf-botao" onClick={() => abrirProjeto(aberta)} disabled={preparando}>
                  {preparando ? "A Lisa está preparando…" : aberta.desafio ? "Abrir projeto" : "Gerar projeto"}
                </button>
              </>
            )}
          </div>
        )}

        {aberta?.tipo === "chegada" && (
          <div className="folha__conteudo folha__conteudo--centro">
            <Neuro humor={aberta.estado === "feito" ? "comemorando" : "pensando"} tamanho={120} />
            <h2>{aberta.estado === "feito" ? "Trilha concluída! 🏆" : "A chegada"}</h2>
            <p>
              {aberta.estado === "feito"
                ? `Você terminou todos os assuntos de ${trilha.tema}. Que orgulho!`
                : "Conclua todos os assuntos da trilha para chegar aqui."}
            </p>
          </div>
        )}

        {aberta?.tipo === "assunto" && aberta.estado === "bloqueado" && (
          <p className="pf-estat__nota" style={{ marginTop: 12 }}>
            Este assunto está planejado para {formatarDia(aberta.etapa.inicio)}. Dá para adiantar, se quiser.
          </p>
        )}
      </Folha>
    </div>
  );
}
