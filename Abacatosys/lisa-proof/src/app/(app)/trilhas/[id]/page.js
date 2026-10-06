"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { obter, criar, remover } from "@/lib/api.js";
import { formatarDia, NOMES_DOS_DIAS } from "@/dominio/datas.js";
import { Barra, DiasDeEstudo } from "@/componentes/Pecas.js";
import MapaDaTrilha from "@/componentes/MapaDaTrilha.js";
import { comemorar } from "@/componentes/Neuro.js";

export default function Trilha() {
  const { id } = useParams();
  const router = useRouter();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState("");
  const [dias, setDias] = useState(null);
  const festejou = useRef(false);

  const carregar = useCallback(async () => {
    try {
      const d = await obter(`/api/trilhas/${id}`);
      setDados(d);
      setDias((atual) => atual || d.trilha.diasDeEstudo);
      setErro("");
    } catch (e) {
      setErro(e.message);
    }
  }, [id]);

  useEffect(() => {
    // O aviso vem da criação (ex.: "a IA não respondeu"). Lido uma vez e tirado da URL.
    const vindo = new URLSearchParams(window.location.search).get("aviso");
    if (vindo) {
      setAviso(vindo);
      window.history.replaceState(null, "", window.location.pathname);
    }
    carregar();
  }, [carregar]);

  // Trilha terminada: festa uma vez por sessão, não a cada visita.
  useEffect(() => {
    const p = dados?.progresso;
    if (!p || festejou.current || p.total === 0 || p.feitos !== p.total) return;
    festejou.current = true;
    const chave = `proof-festa-${id}`;
    try {
      if (sessionStorage.getItem(chave)) return;
      sessionStorage.setItem(chave, "1");
    } catch { /* sem armazenamento: festeja assim mesmo */ }
    setTimeout(() => comemorar(`Trilha de ${dados.trilha.tema} concluída! 🏆`), 400);
  }, [dados, id]);

  async function replanejar({ usarIa = false, comDias = false } = {}) {
    setOcupado(usarIa ? "ia" : comDias ? "dias" : "replanejar");
    setErro("");
    setAviso("");
    try {
      const r = await criar(`/api/trilhas/${id}/replanejar`, { usarIa, ...(comDias ? { diasDeEstudo: dias } : {}) });
      setAviso(r.aviso || (usarIa ? "A Lisa reorganizou a trilha." : "Trilha replanejada a partir de hoje."));
      await carregar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setOcupado("");
    }
  }

  async function apagar() {
    if (!window.confirm("Apagar esta trilha? O quadro no Abacato e os pontos que você já ganhou continuam.")) return;
    setOcupado("apagar");
    try {
      await remover(`/api/trilhas/${id}`);
      router.push("/trilhas");
    } catch (e) {
      setErro(e.message);
      setOcupado("");
    }
  }

  if (!dados) {
    return erro ? <div className="pf-aviso pf-aviso--erro">{erro}</div> : <div className="pf-carregando">Desenhando a trilha…</div>;
  }

  const { trilha, etapas, projetos, progresso } = dados;
  const terminou = progresso.total > 0 && progresso.feitos === progresso.total;

  return (
    <>
      <div className="pf-cabecalho">
        <div>
          <h1>{trilha.tema}</h1>
          <p>
            {trilha.geradaPor === "ia" ? "Montada pela Lisa" : "Na ordem do quadro"} · desde {formatarDia(trilha.inicioEm)} ·{" "}
            {trilha.diasDeEstudo.map((d) => NOMES_DOS_DIAS[d]).join(", ")}
          </p>
        </div>
        <a className="pf-botao pf-botao--sec pf-botao--pequeno" href={trilha.link} target="_blank" rel="noreferrer">Abrir quadro ↗</a>
      </div>

      {aviso && <div className="pf-aviso" style={{ marginBottom: 12 }}>{aviso}</div>}
      {erro && <div className="pf-aviso pf-aviso--erro" style={{ marginBottom: 12 }}>{erro}</div>}

      <div className="pf-cartao">
        <div className="pf-estat__rotulo">Progresso da trilha</div>
        <div className="pf-estat__valor">
          {progresso.feitos}<small>/{progresso.total} assuntos{terminou ? " · concluída 🏆" : ""}</small>
        </div>
        <Barra valor={progresso.feitos} total={progresso.total} rotulo="Progresso da trilha" />
        {trilha.resumo && <p className="pf-estat__nota" style={{ marginTop: 12 }}>{trilha.resumo}</p>}

        <details className="pf-ajuste" style={{ marginTop: 8 }}>
          <summary>Ajustes da trilha</summary>
          <div className="pf-acoes">
            <button className="pf-botao pf-botao--sec pf-botao--pequeno" type="button" disabled={Boolean(ocupado)} onClick={() => replanejar()}>
              {ocupado === "replanejar" ? "Replanejando…" : "Replanejar a partir de hoje"}
            </button>
            <button className="pf-botao pf-botao--sec pf-botao--pequeno" type="button" disabled={Boolean(ocupado)} onClick={() => replanejar({ usarIa: true })}>
              {ocupado === "ia" ? "A Lisa está reorganizando…" : "Refazer a ordem com a Lisa"}
            </button>
          </div>
          <p className="pf-campo__rotulo" style={{ margin: "14px 0 6px" }}>Dias de estudo</p>
          {dias && <DiasDeEstudo valor={dias} aoMudar={setDias} />}
          <div className="pf-acoes" style={{ marginTop: 10 }}>
            <button className="pf-botao pf-botao--pequeno" type="button" disabled={Boolean(ocupado)} onClick={() => replanejar({ comDias: true })}>
              {ocupado === "dias" ? "Salvando…" : "Salvar dias e replanejar"}
            </button>
            <button className="pf-botao pf-botao--perigo pf-botao--pequeno" type="button" disabled={Boolean(ocupado)} onClick={apagar}>
              Apagar trilha
            </button>
          </div>
        </details>
      </div>

      <MapaDaTrilha trilha={trilha} etapas={etapas} projetos={projetos} aoMudar={carregar} />
    </>
  );
}
