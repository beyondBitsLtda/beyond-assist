"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { obter, criar } from "@/lib/api.js";
import { diaDe } from "@/dominio/datas.js";
import { DIAS_PADRAO } from "@/dominio/plano.js";
import { Barra, DiasDeEstudo } from "@/componentes/Pecas.js";

/** O formulário de montar a trilha de um quadro, aberto dentro do próprio cartão. */
function MontarTrilha({ quadro, iaDisponivel, aoCancelar }) {
  const router = useRouter();
  const [dias, setDias] = useState(DIAS_PADRAO);
  const [inicio, setInicio] = useState(diaDe());
  const [usarIa, setUsarIa] = useState(iaDisponivel);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  async function montar(e) {
    e.preventDefault();
    setEnviando(true);
    setErro("");
    try {
      const r = await criar("/api/trilhas", { quadroId: quadro.id, diasDeEstudo: dias, inicio, usarIa });
      router.push(`/trilhas/${r.trilhaId}${r.aviso ? `?aviso=${encodeURIComponent(r.aviso)}` : ""}`);
    } catch (falha) {
      setErro(falha.message);
      setEnviando(false);
    }
  }

  return (
    <form className="pf-form" onSubmit={montar}>
      <div className="pf-campo">
        <span className="pf-campo__rotulo">Em que dias você estuda?</span>
        <DiasDeEstudo valor={dias} aoMudar={setDias} />
      </div>
      <label className="pf-campo">
        <span className="pf-campo__rotulo">Começar em</span>
        <input className="pf-campo__entrada" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} required />
      </label>
      <label className="pf-marcar">
        <input type="checkbox" checked={usarIa} disabled={!iaDisponivel} onChange={(e) => setUsarIa(e.target.checked)} />
        <span>
          A Lisa organiza a ordem dos assuntos (IA)
          {!iaDisponivel && <small style={{ display: "block", color: "var(--pf-tinta-2)" }}>IA não configurada: segue a ordem do quadro.</small>}
        </span>
      </label>
      {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
      <div className="pf-acoes">
        <button className="pf-botao" type="submit" disabled={enviando}>
          {enviando ? (usarIa ? "A Lisa está montando a trilha…" : "Montando…") : "Montar trilha"}
        </button>
        <button className="pf-botao pf-botao--sec" type="button" onClick={aoCancelar} disabled={enviando}>Cancelar</button>
      </div>
    </form>
  );
}

export default function Trilhas() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [aberto, setAberto] = useState(null);

  useEffect(() => {
    obter("/api/trilhas").then(setDados).catch((e) => setErro(e.message));
  }, []);

  if (!dados) {
    return erro ? <div className="pf-aviso pf-aviso--erro">{erro}</div> : <div className="pf-carregando">Procurando seus quadros STUDY…</div>;
  }

  return (
    <>
      <div className="pf-cabecalho">
        <div>
          <h1>Trilhas</h1>
          <p>Cada quadro do Abacato com o nome começando por STUDY vira uma trilha de estudo.</p>
        </div>
        <a className="pf-botao pf-botao--sec pf-botao--pequeno" href={`${dados.abacato}/quadros`} target="_blank" rel="noreferrer">
          Abrir o Abacato ↗
        </a>
      </div>

      {dados.quadros.length === 0 ? (
        <div className="pf-cartao pf-vazio">
          <h2>Nenhum quadro STUDY encontrado</h2>
          <p>
            No Abacato, crie um quadro com o nome começando por <strong>STUDY</strong> — por exemplo
            “STUDY JavaScript”. Cada card é um assunto (ex.: “Lógica de programação em JavaScript”) e
            as checklists são as tarefas de teoria. As colunas podem ser as que você quiser.
          </p>
          <a className="pf-botao" href={`${dados.abacato}/quadros`} target="_blank" rel="noreferrer">Criar no Abacato ↗</a>
        </div>
      ) : (
        <div className="pf-quadros">
          {dados.quadros.map((q) => (
            <article key={q.id} className="pf-cartao">
              <h2 className="pf-quadro__tema">{q.tema}</h2>
              <p className="pf-quadro__nome">{q.nome}</p>
              <div className="pf-estat__nota">
                {q.assuntos.feitos} de {q.assuntos.total} assunto(s) concluído(s)
              </div>
              <Barra valor={q.assuntos.feitos} total={q.assuntos.total} rotulo={`Progresso de ${q.tema}`} />

              {q.trilha ? (
                <div className="pf-acoes" style={{ marginTop: 14 }}>
                  <Link className="pf-botao" href={`/trilhas/${q.trilha.id}`}>Abrir trilha</Link>
                  <span className="pf-pilula">{q.trilha.geradaPor === "ia" ? "Montada pela Lisa" : "Ordem do quadro"}</span>
                </div>
              ) : aberto === q.id ? (
                <MontarTrilha quadro={q} iaDisponivel={dados.iaDisponivel} aoCancelar={() => setAberto(null)} />
              ) : (
                <div className="pf-acoes" style={{ marginTop: 14 }}>
                  <button
                    className="pf-botao"
                    type="button"
                    disabled={q.assuntos.total === 0}
                    onClick={() => setAberto(q.id)}
                  >
                    Montar trilha
                  </button>
                  {q.assuntos.total === 0 && <span className="pf-pilula pf-pilula--atencao">Quadro sem cards</span>}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
