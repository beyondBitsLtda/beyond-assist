"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { obter, mudar, remover } from "@/lib/api.js";
import { selo, tamanhoEmPalavras, CATEGORIAS } from "@/dominio/documentos.js";

/**
 * Abrir um documento sem sair do sistema, e ver a história dele.
 *
 * Cada tipo abre do jeito que dá: o navegador desenha PDF e imagem sozinho, texto a gente
 * mostra, HTML vai numa moldura isolada, e o resto oferece baixar em vez de prometer o que não
 * consegue entregar.
 */
function quando(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) +
    " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function VisorDeDocumento({ documentoId, poderes, aoFechar, aoMudar }) {
  const [dados, setDados] = useState(null);
  const [aberto, setAberto] = useState(null);   // { jeito, url, urlBaixar, conteudo, revisao }
  const [erro, setErro] = useState("");
  const [revisaoVendo, setRevisaoVendo] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [nota, setNota] = useState("");
  const campo = useRef(null);

  const carregar = useCallback(async () => {
    try { setDados(await obter(`/api/documentos/${documentoId}`)); }
    catch (e) { setErro(e.message); }
  }, [documentoId]);

  useEffect(() => { carregar(); }, [carregar]);

  const abrir = useCallback(async (revisaoId) => {
    setErro("");
    setAberto(null);
    try {
      const q = revisaoId ? `?revisao=${revisaoId}` : "";
      setAberto(await obter(`/api/documentos/${documentoId}/abrir${q}`));
      setRevisaoVendo(revisaoId || null);
    } catch (e) { setErro(e.message); }
  }, [documentoId]);

  // Abre a versão atual assim que o documento carrega: quem clicou no documento quer VER o
  // documento, e um clique a mais para isso é um clique sem propósito.
  useEffect(() => { if (dados && !aberto) abrir(null); }, [dados, aberto, abrir]);

  useEffect(() => {
    const tecla = (e) => {
      if (e.key !== "Escape") return;
      if (!["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) aoFechar();
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [aoFechar]);

  async function novaRevisao(arquivo) {
    if (!arquivo) return;
    setEnviando(true);
    setErro("");
    try {
      const form = new FormData();
      form.append("arquivo", arquivo);
      if (nota.trim()) form.append("nota", nota.trim());
      const res = await fetch(`/api/documentos/${documentoId}/revisoes`, { method: "POST", body: form });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) throw new Error(d.error || `falha ${res.status}`);
      setNota("");
      await carregar();
      await abrir(null);
      aoMudar?.();
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
      if (campo.current) campo.current.value = "";
    }
  }

  async function voltarPara(revisao) {
    if (!window.confirm(
      `Tornar a versão ${revisao.numero} a atual?\n\nNada é apagado — a versão ${dados.revisoes[0]?.numero} continua na lista e dá para voltar a ela.`
    )) return;
    try {
      await mudar(`/api/documentos/${documentoId}`, { revisaoAtualId: revisao.id });
      await carregar();
      await abrir(null);
      aoMudar?.();
    } catch (e) { setErro(e.message); }
  }

  const doc = dados?.documento;
  const revisoes = dados?.revisoes || [];
  const podeEditar = poderes?.editar;

  return (
    <div className="abacato-painel abacato-painel--largo" role="dialog" aria-modal="true" aria-label={doc?.nome || "Documento"}>
      <div className="abacato-painel__fundo" onClick={aoFechar} />
      <div className="abacato-painel__caixa abacato-painel__caixa--larga">
        <header className="abacato-painel__cabecalho">
          <input
            className="abacato-painel__titulo"
            defaultValue={doc?.nome || ""}
            key={doc?.id}
            disabled={!podeEditar}
            onBlur={(e) => {
              const t = e.target.value.trim();
              if (t && t !== doc?.nome) mudar(`/api/documentos/${documentoId}`, { nome: t }).then(() => { carregar(); aoMudar?.(); });
            }}
            onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
          />
          {aberto && (
            <a className="abacato-botao abacato-botao--fantasma abacato-botao--pequeno"
               href={aberto.urlBaixar} download={doc?.nome}>⤓ Baixar</a>
          )}
          <button type="button" className="abacato-icone" onClick={aoFechar} aria-label="fechar">✕</button>
        </header>

        {erro && <div className="abacato-campo__erro">⚠ {erro}</div>}

        <div className="abacato-documento">
          {/* ------------------------------------------------ o arquivo */}
          <div className="abacato-documento__visor">
            {!aberto && <div className="abacato-vazio">abrindo…</div>}

            {aberto?.jeito === "proprio" && (
              <object data={aberto.url} type={aberto.revisao.tipo} className="abacato-visor__moldura">
                {/* O `object` cai neste conteúdo quando o navegador não sabe desenhar o tipo —
                    no celular, quase sempre, com PDF. Oferecer o download aqui é melhor que
                    uma moldura cinza e vazia. */}
                <div className="abacato-vazio">
                  <p className="abacato-vazio__titulo">Seu navegador não abre este tipo aqui dentro</p>
                  <p><a className="abacato-botao" href={aberto.urlBaixar}>⤓ Baixar {doc?.nome}</a></p>
                </div>
              </object>
            )}

            {aberto?.jeito === "html" && (
              // `sandbox` sem nenhuma permissão: o HTML enviado é CÓDIGO de outra pessoa, e
              // isto desliga o script dele. O endereço ainda aponta para outro domínio, então
              // são duas travas — esta é a única parte do sistema que desenha conteúdo que
              // alguém mandou.
              <iframe
                src={aberto.url}
                className="abacato-visor__moldura"
                sandbox=""
                referrerPolicy="no-referrer"
                title={doc?.nome}
              />
            )}

            {aberto?.jeito === "texto" && (
              aberto.conteudo !== null
                ? <pre className="abacato-visor__texto">{aberto.conteudo}</pre>
                : (
                  <div className="abacato-vazio">
                    <p className="abacato-vazio__titulo">Arquivo grande demais para mostrar aqui</p>
                    <p>{aberto.truncado ? "Acima de 400 KB o navegador trava ao desenhar o texto." : "Não consegui ler o conteúdo."}</p>
                    <p><a className="abacato-botao" href={aberto.urlBaixar}>⤓ Baixar</a></p>
                  </div>
                )
            )}

            {aberto?.jeito === "baixar" && (
              <div className="abacato-vazio">
                <p className="abacato-vazio__titulo">{selo({ tipo: aberto.revisao.tipo, nome: doc?.nome })}</p>
                <p>Este tipo não abre dentro do navegador — planilhas e documentos do Word precisam do programa deles.</p>
                <p style={{ marginTop: 16 }}>
                  <a className="abacato-botao" href={aberto.urlBaixar} download={doc?.nome}>
                    ⤓ Baixar ({tamanhoEmPalavras(aberto.revisao.tamanho)})
                  </a>
                </p>
              </div>
            )}

            {revisaoVendo && (
              <div className="abacato-aviso" style={{ margin: 0 }}>
                Você está vendo a versão {aberto?.revisao?.numero}, que não é a atual.
                <button type="button" className="abacato-botao abacato-botao--fantasma abacato-botao--pequeno"
                  style={{ marginLeft: "auto" }} onClick={() => abrir(null)}>Ver a atual</button>
              </div>
            )}
          </div>

          {/* ------------------------------------------------ a história */}
          <aside className="abacato-documento__lado">
            <section className="abacato-bloco">
              <h3 className="abacato-bloco__titulo">Sobre</h3>
              <label className="abacato-campo">
                <span className="abacato-campo__rotulo">Categoria</span>
                <input
                  className="abacato-campo__entrada"
                  list="abacato-categorias"
                  defaultValue={doc?.categoria || ""}
                  key={`c-${doc?.id}`}
                  disabled={!podeEditar}
                  placeholder="Contrato, Proposta…"
                  onBlur={(e) => mudar(`/api/documentos/${documentoId}`, { categoria: e.target.value })
                    .then(() => { carregar(); aoMudar?.(); }).catch((x) => setErro(x.message))}
                />
                <datalist id="abacato-categorias">
                  {CATEGORIAS.map((c) => <option key={c} value={c} />)}
                </datalist>
              </label>
              <label className="abacato-campo">
                <span className="abacato-campo__rotulo">Descrição</span>
                <textarea
                  className="abacato-campo__entrada"
                  defaultValue={doc?.descricao || ""}
                  key={`d-${doc?.id}`}
                  rows={3}
                  disabled={!podeEditar}
                  placeholder="O que é este documento, para quem for procurá-lo depois."
                  onBlur={(e) => mudar(`/api/documentos/${documentoId}`, { descricao: e.target.value })
                    .then(() => { carregar(); aoMudar?.(); }).catch((x) => setErro(x.message))}
                />
              </label>
            </section>

            <section className="abacato-bloco">
              <div className="abacato-bloco__linha">
                <h3 className="abacato-bloco__titulo">Versões ({revisoes.length})</h3>
              </div>

              {podeEditar && (
                <>
                  <input
                    className="abacato-campo__entrada"
                    placeholder="O que mudou nesta versão?"
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                  />
                  <label className={`abacato-solte${enviando ? " abacato-solte--ativo" : ""}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); novaRevisao(e.dataTransfer.files?.[0]); }}>
                    <input ref={campo} type="file" className="abacato-solte__campo" disabled={enviando}
                      onChange={(e) => novaRevisao(e.target.files?.[0])} />
                    <span className="abacato-solte__icone">↥</span>
                    <strong>{enviando ? "Enviando…" : "Nova versão"}</strong>
                    <span className="abacato-dica">a anterior continua guardada</span>
                  </label>
                </>
              )}

              {revisoes.map((r) => (
                <div key={r.id} className={`abacato-revisao${r.atual ? " abacato-revisao--atual" : ""}`}>
                  <button type="button" className="abacato-revisao__abrir" onClick={() => abrir(r.atual ? null : r.id)}>
                    <strong>v{r.numero}</strong>
                    {r.atual && <span className="abacato-etiqueta abacato-etiqueta--ok">atual</span>}
                    <span className="abacato-dica">{tamanhoEmPalavras(r.tamanho)}</span>
                  </button>
                  <div className="abacato-dica">
                    {quando(r.criadoEm)}{r.quem ? ` · ${r.quem}` : ""}
                  </div>
                  {r.nota && <div className="abacato-revisao__nota">{r.nota}</div>}
                  {podeEditar && !r.atual && (
                    <button type="button" className="abacato-botao abacato-botao--fantasma abacato-botao--pequeno"
                      onClick={() => voltarPara(r)}>Tornar atual</button>
                  )}
                </div>
              ))}
            </section>

            {poderes?.apagar && (
              <button
                type="button"
                className="abacato-botao abacato-botao--perigo"
                onClick={async () => {
                  if (!window.confirm(`Arquivar "${doc?.nome}"?\n\nSai da lista; o arquivo e todas as versões continuam guardados.`)) return;
                  try { await remover(`/api/documentos/${documentoId}`); aoMudar?.(); aoFechar(); }
                  catch (e) { setErro(e.message); }
                }}
              >
                Arquivar documento
              </button>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
