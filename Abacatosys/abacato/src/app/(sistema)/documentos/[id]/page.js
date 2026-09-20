"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { obter, criar, mudar, remover } from "@/lib/api.js";
import { montarArvore, caminhoAte, selo, tamanhoEmPalavras, comoAbrir } from "@/dominio/documentos.js";
import VisorDeDocumento from "@/componentes/documentos/VisorDeDocumento.js";

const ICONE = { html: "◫", proprio: "▤", texto: "≡", baixar: "⤓" };

/** Uma pasta e as filhas dela, na árvore da esquerda. */
function Ramo({ pasta, nivel, selecionada, aoSelecionar, contar }) {
  const [aberta, setAberta] = useState(nivel < 1);
  const temFilhas = pasta.filhas.length > 0;
  return (
    <>
      <div className={`abacato-ramo${selecionada === pasta.id ? " abacato-ramo--ativo" : ""}`}
           style={{ paddingLeft: 8 + nivel * 14 }}>
        <button
          type="button"
          className="abacato-ramo__seta"
          onClick={() => setAberta((a) => !a)}
          // A seta existe sempre, mesmo sem filhas, e fica invisível quando não há — assim os
          // nomes das pastas ficam todos alinhados em vez de dançarem 14px para os lados.
          style={{ visibility: temFilhas ? "visible" : "hidden" }}
          aria-label={aberta ? "fechar" : "abrir"}
        >{aberta ? "▾" : "▸"}</button>
        <button type="button" className="abacato-ramo__nome" onClick={() => aoSelecionar(pasta.id)}>
          <span aria-hidden="true">🗀</span>
          {pasta.nome}
          <span className="abacato-ramo__conta">{contar(pasta.id) || ""}</span>
        </button>
      </div>
      {aberta && pasta.filhas.map((f) => (
        <Ramo key={f.id} pasta={f} nivel={nivel + 1} selecionada={selecionada}
              aoSelecionar={aoSelecionar} contar={contar} />
      ))}
    </>
  );
}

export default function PaginaDoProjeto() {
  const { id } = useParams();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [pastaAtual, setPastaAtual] = useState(null);   // null = raiz do projeto
  const [documentoAberto, setDocumentoAberto] = useState(null);
  const [novaPasta, setNovaPasta] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const [aviso, setAviso] = useState("");
  const campoArquivo = useRef(null);

  const carregar = useCallback(async () => {
    try { setDados(await obter(`/api/projetos/${id}`)); setErro(""); }
    catch (e) { setErro(e.message); }
  }, [id]);

  useEffect(() => { carregar(); }, [carregar]);

  const poderes = dados?.poderes || { ver: false, editar: false, criar: false, apagar: false };
  const pastas = dados?.pastas || [];
  const arvore = montarArvore(pastas);
  const documentos = (dados?.documentos || []).filter((d) => (d.pasta_id || null) === pastaAtual);
  const caminho = pastaAtual ? caminhoAte(pastaAtual, pastas) : [];

  const contarNaPasta = useCallback((pastaId) => {
    return (dados?.documentos || []).filter((d) => d.pasta_id === pastaId).length;
  }, [dados]);

  async function enviarArquivos(lista) {
    const arquivos = [...(lista || [])];
    if (!arquivos.length) return;
    setEnviando(true);
    setErro("");
    setAviso("");
    try {
      const form = new FormData();
      for (const a of arquivos) form.append("arquivo", a);
      if (pastaAtual) form.append("pastaId", pastaAtual);

      const res = await fetch(`/api/projetos/${id}/documentos`, { method: "POST", body: form });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) throw new Error(d.error || `falha ${res.status}`);

      await carregar();
      if (d.falharam?.length) {
        // O que não entrou é DITO com o nome. Um envio que diz "8 arquivos" quando eram 10 é
        // um envio em que os dois que faltam só aparecem semanas depois.
        setAviso(`${d.documentos.length} entrou(entraram). Não entraram: ${d.falharam.map((f) => f.nome).join(", ")}`);
      }
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
      if (campoArquivo.current) campoArquivo.current.value = "";
    }
  }

  if (erro && !dados) {
    return (
      <div className="abacato-vazio">
        <p className="abacato-vazio__titulo">Não deu para abrir este projeto</p>
        <p>{erro}</p>
        <p><Link href="/documentos" className="abacato-botao abacato-botao--fantasma">Voltar aos projetos</Link></p>
      </div>
    );
  }
  if (!dados) return <div className="abacato-vazio">carregando o projeto…</div>;

  return (
    <>
      <header className="abacato-conteudo__cabecalho">
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <Link href="/documentos" className="abacato-icone" aria-label="voltar aos projetos">←</Link>
          <span className="abacato-quadro-cartao__faixa" style={{
            background: dados.projeto.cor || "#22C55E", height: 22, width: 6, margin: 0, borderRadius: 3,
          }} />
          <h1 className="abacato-conteudo__titulo">{dados.projeto.nome}</h1>
        </div>
        {poderes.criar && (
          <div className="abacato-bloco__acoes">
            <button className="abacato-botao abacato-botao--fantasma" onClick={() => setNovaPasta(true)}>
              + Pasta
            </button>
            <button className="abacato-botao" onClick={() => campoArquivo.current?.click()} disabled={enviando}>
              {enviando ? "Enviando…" : "+ Documento"}
            </button>
            <input ref={campoArquivo} type="file" multiple hidden
              onChange={(e) => enviarArquivos(e.target.files)} />
          </div>
        )}
      </header>

      {erro && <div className="abacato-campo__erro" style={{ marginBottom: 12 }}>⚠ {erro}</div>}
      {aviso && (
        <div className="abacato-aviso" style={{ margin: "0 0 12px" }}>
          ⚠ {aviso}
          <button type="button" className="abacato-icone" onClick={() => setAviso("")} aria-label="dispensar">✕</button>
        </div>
      )}

      <div className="abacato-arquivo">
        {/* ------------------------------------------------ a árvore */}
        <aside className="abacato-arquivo__arvore">
          <div className={`abacato-ramo${pastaAtual === null ? " abacato-ramo--ativo" : ""}`} style={{ paddingLeft: 8 }}>
            <span className="abacato-ramo__seta" />
            <button type="button" className="abacato-ramo__nome" onClick={() => setPastaAtual(null)}>
              <span aria-hidden="true">▣</span>
              Raiz do projeto
              <span className="abacato-ramo__conta">{contarNaPasta(null) || ""}</span>
            </button>
          </div>

          {arvore.map((p) => (
            <Ramo key={p.id} pasta={p} nivel={1} selecionada={pastaAtual}
                  aoSelecionar={setPastaAtual} contar={contarNaPasta} />
          ))}

          {novaPasta && (
            <div className="abacato-rapido" style={{ padding: 8 }}>
              <input
                className="abacato-campo__entrada"
                placeholder={pastaAtual ? "Subpasta de " + (caminho.at(-1)?.nome || "") : "Nome da pasta"}
                autoFocus
                onBlur={() => setNovaPasta(false)}
                onKeyDown={async (e) => {
                  if (e.key === "Escape") return setNovaPasta(false);
                  if (e.key !== "Enter") return;
                  const nome = e.target.value.trim();
                  if (!nome) return setNovaPasta(false);
                  try {
                    // A pasta nasce DENTRO da que está selecionada. É o que torna subpasta
                    // natural: você entra onde ela deve ficar e cria ali.
                    await criar(`/api/projetos/${id}/pastas`, { nome, paiId: pastaAtual });
                    setNovaPasta(false);
                    await carregar();
                  } catch (x) { setErro(x.message); }
                }}
              />
            </div>
          )}
        </aside>

        {/* ------------------------------------------------ os documentos */}
        <section
          className={`abacato-arquivo__lista${arrastando ? " abacato-arquivo__lista--soltando" : ""}`}
          onDragOver={(e) => { if (poderes.criar) { e.preventDefault(); setArrastando(true); } }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => {
            if (!poderes.criar) return;
            e.preventDefault();
            setArrastando(false);
            enviarArquivos(e.dataTransfer.files);
          }}
        >
          <div className="abacato-migalhas">
            <button type="button" onClick={() => setPastaAtual(null)}>{dados.projeto.nome}</button>
            {caminho.map((p) => (
              <span key={p.id}>
                <span className="abacato-migalhas__seta">›</span>
                <button type="button" onClick={() => setPastaAtual(p.id)}>{p.nome}</button>
              </span>
            ))}
            {pastaAtual && poderes.apagar && (
              <button
                type="button"
                className="abacato-icone"
                style={{ marginLeft: "auto" }}
                title="arquivar esta pasta"
                onClick={async () => {
                  const dentro = contarNaPasta(pastaAtual);
                  if (!window.confirm(
                    `Arquivar a pasta "${caminho.at(-1)?.nome}"?\n\nAs subpastas e os ${dentro} documento(s) dentro dela vão junto. Nada é apagado.`
                  )) return;
                  try {
                    await remover(`/api/pastas/${pastaAtual}`);
                    setPastaAtual(caminho.at(-2)?.id || null);
                    await carregar();
                  } catch (x) { setErro(x.message); }
                }}
              >🗑</button>
            )}
          </div>

          {documentos.length === 0 && (
            <div className="abacato-vazio">
              <p className="abacato-vazio__titulo">Nada nesta pasta</p>
              <p>{poderes.criar ? "Solte arquivos aqui, ou use o botão “+ Documento”." : "Nenhum documento por aqui."}</p>
            </div>
          )}

          <div className="abacato-documentos">
            {documentos.map((d) => {
              const jeito = comoAbrir({ tipo: d.revisao?.tipo, nome: d.nome });
              return (
                <button key={d.id} type="button" className="abacato-doc" onClick={() => setDocumentoAberto(d.id)}>
                  <span className="abacato-doc__selo" aria-hidden="true">{ICONE[jeito]}</span>
                  <span className="abacato-doc__meio">
                    <span className="abacato-doc__nome">{d.nome}</span>
                    <span className="abacato-dica">
                      {selo({ tipo: d.revisao?.tipo, nome: d.nome })}
                      {d.revisao ? ` · ${tamanhoEmPalavras(d.revisao.tamanho)}` : ""}
                      {d.revisoes > 1 ? ` · ${d.revisoes} versões` : ""}
                      {d.origem === "doc-gen" ? " · gerado" : ""}
                    </span>
                  </span>
                  {d.categoria && <span className="abacato-etiqueta abacato-etiqueta--ok">{d.categoria}</span>}
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {documentoAberto && (
        <VisorDeDocumento
          documentoId={documentoAberto}
          poderes={poderes}
          aoFechar={() => setDocumentoAberto(null)}
          aoMudar={carregar}
        />
      )}
    </>
  );
}
