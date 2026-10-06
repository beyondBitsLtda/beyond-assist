"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { criar } from "@/lib/api.js";
import { diaDe } from "@/dominio/datas.js";
import { DIAS_PADRAO, NOMES_DOS_NIVEIS } from "@/dominio/plano.js";
import { NIVEIS_DO_CURSO, DURACOES_EM_SEMANAS, resumoDoCurso } from "@/dominio/curso.js";
import { DiasDeEstudo } from "@/componentes/Pecas.js";
import Neuro, { reagir, comemorar } from "@/componentes/Neuro.js";

const ROTULO_DO_NIVEL = { iniciante: "Iniciante", intermediario: "Intermediário", avancado: "Avançado" };

/**
 * Criar um curso com a Lisa: tema e nível → a Lisa propõe módulos e assuntos → a pessoa revisa
 * (tira o que não quer, muda o nome) → o quadro STUDY nasce no Abacato com a trilha pronta.
 */
export default function NovoCurso() {
  const router = useRouter();
  const [tema, setTema] = useState("");
  const [nivel, setNivel] = useState("iniciante");
  const [objetivo, setObjetivo] = useState("");
  const [semanas, setSemanas] = useState(4);
  const [dias, setDias] = useState(DIAS_PADRAO);
  const [inicio, setInicio] = useState(diaDe());
  const [proposta, setProposta] = useState(null);
  const [etapa, setEtapa] = useState("form"); // form | pensando | proposta | criando
  const [erro, setErro] = useState("");

  async function propor(e) {
    e?.preventDefault();
    setErro("");
    setEtapa("pensando");
    reagir("pensando", "Desenhando o seu curso, módulo por módulo… isso leva uns segundinhos.", 90000);
    try {
      const r = await criar("/api/cursos/proposta", { tema, nivel, objetivo, semanas, diasDeEstudo: dias });
      setProposta(r.proposta);
      setEtapa("proposta");
      reagir("feliz", "Prontinho! Dá uma olhada e tira o que não fizer sentido.", 6000);
    } catch (falha) {
      setErro(falha.message);
      setEtapa("form");
      reagir("triste", "Não consegui montar agora. Tenta de novo?");
    }
  }

  function tirarAssunto(m, a) {
    setProposta((p) => ({
      ...p,
      modulos: p.modulos
        .map((mod, i) => (i === m ? { ...mod, assuntos: mod.assuntos.filter((_, j) => j !== a) } : mod))
        .filter((mod) => mod.assuntos.length),
    }));
  }

  async function confirmar() {
    setErro("");
    setEtapa("criando");
    reagir("pensando", "Criando o quadro no Abacato e desenhando a trilha…", 60000);
    try {
      const r = await criar("/api/cursos", { proposta, diasDeEstudo: dias, inicio });
      comemorar(`Curso de ${proposta.tema} criado! 🎉`);
      router.push(`/trilhas/${r.trilhaId}`);
    } catch (falha) {
      setErro(falha.message);
      setEtapa("proposta");
      reagir("triste", "Algo falhou ao criar. Nada ficou pela metade no Abacato — pode tentar de novo.");
    }
  }

  const resumo = proposta ? resumoDoCurso(proposta) : null;
  const ocupado = etapa === "pensando" || etapa === "criando";

  return (
    <>
      <div className="pf-cabecalho">
        <div>
          <p style={{ margin: 0 }}><Link href="/trilhas">← Trilhas</Link></p>
          <h1>Criar curso com a Lisa</h1>
          <p>Diga o tema e o nível. A Lisa monta o quadro STUDY no Abacato e a trilha já pronta.</p>
        </div>
      </div>

      <div className="pf-cartao curso__neuro">
        <Neuro
          humor={ocupado ? "pensando" : proposta ? "feliz" : "normal"}
          fala={proposta ? "" : "O que você quer aprender? Pode ser uma linguagem, um framework, banco de dados…"}
          tamanho={96}
          ouvir
        />
      </div>

      {erro && <div className="pf-aviso pf-aviso--erro" style={{ marginTop: 12 }}>{erro}</div>}

      {(etapa === "form" || etapa === "pensando") && (
        <form className="pf-cartao curso__form" onSubmit={propor}>
          <label className="pf-campo">
            <span className="pf-campo__rotulo">Tema do curso</span>
            <input className="pf-campo__entrada" value={tema} onChange={(e) => setTema(e.target.value)} maxLength={80}
              placeholder="Ex.: JavaScript, SQL para análise de dados, React com TypeScript" required disabled={ocupado} />
          </label>

          <div className="pf-campo">
            <span className="pf-campo__rotulo">Nível</span>
            <div className="pf-dias" role="group" aria-label="Nível">
              {Object.keys(NIVEIS_DO_CURSO).map((n) => (
                <button key={n} type="button" className="pf-dia" aria-pressed={nivel === n} onClick={() => setNivel(n)} disabled={ocupado}>
                  {ROTULO_DO_NIVEL[n]}
                </button>
              ))}
            </div>
            <small className="pf-estat__nota" style={{ margin: 0 }}>{NIVEIS_DO_CURSO[nivel]}</small>
          </div>

          <label className="pf-campo">
            <span className="pf-campo__rotulo">Objetivo (opcional)</span>
            <textarea className="pf-campo__entrada" rows={2} value={objetivo} onChange={(e) => setObjetivo(e.target.value)} maxLength={400}
              placeholder="Ex.: conseguir criar uma API REST e me preparar para vagas júnior" disabled={ocupado} />
          </label>

          <div className="pf-campo">
            <span className="pf-campo__rotulo">Duração</span>
            <div className="pf-dias" role="group" aria-label="Duração">
              {DURACOES_EM_SEMANAS.map((s) => (
                <button key={s} type="button" className="pf-dia" aria-pressed={semanas === s} onClick={() => setSemanas(s)} disabled={ocupado}>
                  {s} semanas
                </button>
              ))}
            </div>
          </div>

          <div className="pf-campo">
            <span className="pf-campo__rotulo">Em que dias você estuda?</span>
            <DiasDeEstudo valor={dias} aoMudar={setDias} />
          </div>

          <label className="pf-campo">
            <span className="pf-campo__rotulo">Começar em</span>
            <input className="pf-campo__entrada" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} required disabled={ocupado} />
          </label>

          <button className="pf-botao" type="submit" disabled={ocupado || tema.trim().length < 2}>
            {etapa === "pensando" ? "A Lisa está montando o curso…" : "✨ Montar proposta"}
          </button>
        </form>
      )}

      {proposta && (etapa === "proposta" || etapa === "criando") && (
        <>
          <section className="pf-cartao curso__resumo">
            <label className="pf-campo">
              <span className="pf-campo__rotulo">Nome do quadro no Abacato</span>
              <input className="pf-campo__entrada" value={proposta.nome} maxLength={80} disabled={ocupado}
                onChange={(e) => setProposta((p) => ({ ...p, nome: e.target.value }))} />
              <small className="pf-estat__nota" style={{ margin: 0 }}>Começa com STUDY: é o que faz o quadro virar trilha.</small>
            </label>
            {proposta.resumo && <p style={{ margin: 0 }}>{proposta.resumo}</p>}
            <div className="pf-assunto__chips">
              <span className="pf-pilula pf-pilula--tema">{ROTULO_DO_NIVEL[proposta.nivel]}</span>
              <span className="pf-pilula">{resumo.modulos} módulos</span>
              <span className="pf-pilula">{resumo.assuntos} assuntos</span>
              <span className="pf-pilula">{resumo.tarefas} tarefas de teoria</span>
              <span className="pf-pilula">~{resumo.dias} dias de estudo</span>
            </div>
          </section>

          {proposta.modulos.map((m, i) => (
            <section key={`${m.nome}-${i}`} className="pf-secao">
              <h2 className="pf-secao__titulo">
                <span>Módulo {i + 1} · {m.nome}</span>
                <small>{m.assuntos.length} assunto(s)</small>
              </h2>
              <ul className="curso__assuntos">
                {m.assuntos.map((a, j) => (
                  <li key={`${a.titulo}-${j}`} className="pf-cartao curso__assunto">
                    <div>
                      <p className="pf-etapa__titulo">{a.titulo}</p>
                      <p className="pf-etapa__meta">
                        <span>{NOMES_DOS_NIVEIS[a.nivel]}</span>
                        <span>{a.dias} dia(s)</span>
                        <span>{a.tarefas.length} tarefa(s)</span>
                      </p>
                      {a.objetivo && <p className="pf-etapa__objetivo">{a.objetivo}</p>}
                      {a.tarefas.length > 0 && (
                        <details className="curso__tarefas">
                          <summary>Ver tarefas</summary>
                          <ul>{a.tarefas.map((t, k) => <li key={k}>{t}</li>)}</ul>
                        </details>
                      )}
                    </div>
                    <button type="button" className="curso__tirar" onClick={() => tirarAssunto(i, j)} disabled={ocupado}
                      aria-label={`Tirar ${a.titulo} do curso`} title="Tirar do curso">✕</button>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <div className="pf-acoes curso__confirmar">
            <button type="button" className="pf-botao" onClick={confirmar} disabled={ocupado || resumo.assuntos < 3}>
              {etapa === "criando" ? "Criando quadro e trilha…" : "Criar quadro e trilha"}
            </button>
            <button type="button" className="pf-botao pf-botao--sec" onClick={() => propor()} disabled={ocupado}>Gerar outra proposta</button>
            <button type="button" className="pf-botao pf-botao--sec" onClick={() => { setProposta(null); setEtapa("form"); }} disabled={ocupado}>
              Mudar tema ou nível
            </button>
          </div>
        </>
      )}
    </>
  );
}
