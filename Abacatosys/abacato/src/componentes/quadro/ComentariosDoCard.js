"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Usuario } from "@/dominio/Quadro.js";
import { obter, mudar, remover } from "@/lib/api.js";
import { MAXIMO_DE_IMAGENS, TIPOS_DE_IMAGEM, conferirComentario } from "@/dominio/comentarios.js";

// Um print de tela cheia sai do Ctrl+V como PNG de 3–8 MB. Reduzido a ~2400 px em WEBP ele
// fica com algumas centenas de KB e continua legível — e é isso que atravessa o servidor.
const LADO_MAXIMO = 2400;
const REDUZIR_ACIMA_DE = 1.5 * 1024 * 1024;

/** Encolhe a imagem no navegador quando ela é grande demais. GIF fica como está (perderia a
 *  animação), e qualquer falha devolve o arquivo original — reduzir é conforto, não regra. */
async function reduzir(arquivo) {
  if (arquivo.type === "image/gif" || typeof createImageBitmap !== "function") return arquivo;
  try {
    const bitmap = await createImageBitmap(arquivo);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
    if (escala === 1 && arquivo.size <= REDUZIR_ACIMA_DE) { bitmap.close?.(); return arquivo; }
    const tela = document.createElement("canvas");
    tela.width = Math.round(bitmap.width * escala);
    tela.height = Math.round(bitmap.height * escala);
    tela.getContext("2d").drawImage(bitmap, 0, 0, tela.width, tela.height);
    bitmap.close?.();
    const blob = await new Promise((ok) => tela.toBlob(ok, "image/webp", 0.86));
    // Navegador sem WEBP no canvas devolve PNG — que pode sair MAIOR que o original.
    if (!blob || blob.type !== "image/webp" || blob.size >= arquivo.size) return arquivo;
    const base = (arquivo.name || "imagem").replace(/\.[^.]+$/, "");
    return new File([blob], `${base}.webp`, { type: "image/webp" });
  } catch {
    return arquivo;
  }
}

/** "agora", "há 5 min", "há 3 h", depois a data. */
function quando(iso) {
  const d = new Date(iso);
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).replace(".", "");
}

/** Envia o formulário com as imagens. O `pedir` de api.js manda JSON; aqui vai multipart, com
 *  as mesmas duas conferências (status e `ok`) e o mesmo desvio para o login no 401. */
async function enviar(url, form) {
  let res;
  try {
    res = await fetch(url, { method: "POST", body: form });
  } catch {
    throw new Error("sem resposta do servidor");
  }
  if (res.status === 401) {
    window.location.href = `/entrar?de=${encodeURIComponent(window.location.pathname)}`;
    throw new Error("sessão expirada");
  }
  const dados = await res.json().catch(() => ({}));
  if (!res.ok || dados.ok === false) throw new Error(dados.error || `falha ${res.status}`);
  return dados;
}

/**
 * Os comentários do card aberto.
 *
 * Imagem entra de três jeitos: Ctrl+V com o card aberto (mesmo fora do campo, desde que não
 * se esteja digitando em outro campo), o botão "Anexar imagem", ou arrastando o arquivo para a
 * caixa de comentário. Antes de enviar, ela aparece em miniatura e pode ser tirada.
 */
export default function ComentariosDoCard({ cardId }) {
  const [comentarios, setComentarios] = useState(null);
  const [podeComentar, setPodeComentar] = useState(false);
  const [texto, setTexto] = useState("");
  const [pendentes, setPendentes] = useState([]); // [{ arquivo, previa }]
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [editando, setEditando] = useState(null); // { id, texto }
  const seletor = useRef(null);
  const caixa = useRef(null);

  const carregar = useCallback(async () => {
    try {
      const r = await obter(`/api/cards/${cardId}/comentarios`);
      setComentarios(r.comentarios);
      setPodeComentar(r.podeComentar);
    } catch (e) {
      setErro(e.message);
      setComentarios([]);
    }
  }, [cardId]);

  useEffect(() => {
    setComentarios(null);
    setTexto("");
    setPendentes([]);
    setErro("");
    setEditando(null);
    carregar();
  }, [carregar]);

  // As prévias são endereços `blob:` — sem revogar, cada print colado fica preso na memória
  // da aba até ela fechar.
  const pendentesRef = useRef(pendentes);
  pendentesRef.current = pendentes;
  useEffect(() => () => pendentesRef.current.forEach((p) => URL.revokeObjectURL(p.previa)), []);

  const adicionar = useCallback(async (arquivos) => {
    const imagens = [...arquivos].filter((a) => a && TIPOS_DE_IMAGEM[a.type]);
    if (!imagens.length) {
      if (arquivos.length) setErro("só imagens (JPG, PNG, WEBP, GIF ou AVIF)");
      return;
    }
    setErro("");
    const prontas = await Promise.all(imagens.map(reduzir));
    setPendentes((atuais) => {
      const cabem = Math.max(0, MAXIMO_DE_IMAGENS - atuais.length);
      if (prontas.length > cabem) setErro(`no máximo ${MAXIMO_DE_IMAGENS} imagens por comentário`);
      return [...atuais, ...prontas.slice(0, cabem).map((arquivo) => ({ arquivo, previa: URL.createObjectURL(arquivo) }))];
    });
  }, []);

  // Ctrl+V com o card aberto. Dentro da caixa de comentário o evento chega por ela mesma; em
  // qualquer OUTRO campo (título, descrição, checklist) a colagem é daquele campo e fica lá.
  useEffect(() => {
    if (!podeComentar) return;
    const colar = (e) => {
      const alvo = document.activeElement;
      const emCampo = ["INPUT", "TEXTAREA", "SELECT"].includes(alvo?.tagName) || alvo?.isContentEditable;
      if (emCampo && alvo !== caixa.current) return;
      const imagens = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith("image/"));
      if (!imagens.length) return;
      e.preventDefault();
      adicionar(imagens);
      caixa.current?.focus();
    };
    document.addEventListener("paste", colar);
    return () => document.removeEventListener("paste", colar);
  }, [podeComentar, adicionar]);

  function tirar(i) {
    setPendentes((atuais) => {
      URL.revokeObjectURL(atuais[i].previa);
      return atuais.filter((_, j) => j !== i);
    });
  }

  async function comentar() {
    const conferido = conferirComentario({
      texto,
      imagens: pendentes.map((p) => ({ tipo: p.arquivo.type, tamanho: p.arquivo.size, nome: p.arquivo.name })),
    });
    if (!conferido.ok) { setErro(conferido.erro); return; }
    setEnviando(true);
    setErro("");
    try {
      const form = new FormData();
      form.append("texto", conferido.texto);
      for (const p of pendentes) form.append("imagem", p.arquivo, p.arquivo.name || "imagem");
      const r = await enviar(`/api/cards/${cardId}/comentarios`, form);
      pendentes.forEach((p) => URL.revokeObjectURL(p.previa));
      setPendentes([]);
      setTexto("");
      setComentarios(r.comentarios);
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  }

  async function salvarEdicao() {
    const conferido = conferirComentario({ texto: editando.texto });
    if (!conferido.ok) { setErro(conferido.erro); return; }
    try {
      await mudar(`/api/comentarios/${editando.id}`, { texto: conferido.texto });
      setEditando(null);
      await carregar();
    } catch (e) {
      setErro(e.message);
    }
  }

  async function apagar(c) {
    const imagens = c.anexos.length ? ` e ${c.anexos.length} imagem(ns)` : "";
    if (!window.confirm(`Apagar este comentário${imagens}? Não dá para desfazer.`)) return;
    try {
      await remover(`/api/comentarios/${c.id}`);
      await carregar();
    } catch (e) {
      setErro(e.message);
    }
  }

  return (
    <section className="abacato-secao abacato-comentarios">
      <h3 className="abacato-secao__titulo"><span aria-hidden="true">💬</span> Comentários</h3>

      {podeComentar ? (
        <div
          className="abacato-comentarios__nova"
          onDragOver={(e) => { if ([...e.dataTransfer.types].includes("Files")) e.preventDefault(); }}
          onDrop={(e) => {
            if (!e.dataTransfer.files?.length) return;
            e.preventDefault();
            adicionar(e.dataTransfer.files);
          }}
        >
          <textarea
            ref={caixa}
            className="abacato-campo__entrada abacato-comentarios__caixa"
            placeholder="Escreva um comentário… (Ctrl+V cola um print)"
            value={texto}
            rows={texto || pendentes.length ? 3 : 1}
            disabled={enviando}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); comentar(); }
            }}
          />

          {pendentes.length > 0 && (
            <div className="abacato-comentarios__imagens">
              {pendentes.map((p, i) => (
                <div key={p.previa} className="abacato-comentarios__miniatura">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.previa} alt={p.arquivo.name || "imagem a enviar"} />
                  <button type="button" className="abacato-comentarios__tirar" aria-label="tirar imagem" onClick={() => tirar(i)} disabled={enviando}>✕</button>
                </div>
              ))}
            </div>
          )}

          <div className="abacato-comentarios__acoes">
            <button type="button" className="abacato-botao abacato-botao--pequeno" onClick={comentar}
              disabled={enviando || (!texto.trim() && !pendentes.length)}>
              {enviando ? "Enviando…" : "Comentar"}
            </button>
            <button type="button" className="abacato-botao abacato-botao--fantasma abacato-botao--pequeno"
              onClick={() => seletor.current?.click()} disabled={enviando || pendentes.length >= MAXIMO_DE_IMAGENS}>
              🖼 Anexar imagem
            </button>
            <input ref={seletor} type="file" accept={Object.keys(TIPOS_DE_IMAGEM).join(",")} multiple hidden
              onChange={(e) => { adicionar(e.target.files || []); e.target.value = ""; }} />
            <span className="abacato-dica">Ctrl+Enter envia</span>
          </div>
        </div>
      ) : comentarios && (
        <span className="abacato-dica">Seu papel neste quadro permite ler os comentários, mas não escrever.</span>
      )}

      {erro && <div className="abacato-campo__erro">⚠ {erro}</div>}

      {comentarios == null ? (
        <span className="abacato-dica">carregando comentários…</span>
      ) : comentarios.length === 0 ? (
        <span className="abacato-dica">Nenhum comentário ainda.</span>
      ) : (
        <ol className="abacato-comentarios__lista">
          {comentarios.map((c) => {
            const autor = c.autor ? new Usuario(c.autor) : null;
            return (
              <li key={c.id} className="abacato-comentario">
                <span className="abacato-avatar" title={autor?.nome || "conta removida"}>{autor ? autor.iniciais : "?"}</span>
                <div className="abacato-comentario__corpo">
                  <div className="abacato-comentario__topo">
                    <strong>{autor?.nome || autor?.email || "Conta removida"}</strong>
                    <span className="abacato-dica" title={new Date(c.criadoEm).toLocaleString("pt-BR")}>
                      {quando(c.criadoEm)}{c.editadoEm ? " · editado" : ""}
                    </span>
                  </div>

                  {editando?.id === c.id ? (
                    <div className="abacato-comentario__edicao">
                      <textarea className="abacato-campo__entrada" rows={3} autoFocus value={editando.texto}
                        onChange={(e) => setEditando({ id: c.id, texto: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); salvarEdicao(); }
                          if (e.key === "Escape") setEditando(null);
                        }} />
                      <div className="abacato-comentarios__acoes">
                        <button type="button" className="abacato-botao abacato-botao--pequeno" onClick={salvarEdicao}>Salvar</button>
                        <button type="button" className="abacato-botao abacato-botao--fantasma abacato-botao--pequeno" onClick={() => setEditando(null)}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    c.texto && <p className="abacato-comentario__texto">{c.texto}</p>
                  )}

                  {c.anexos.length > 0 && (
                    <div className="abacato-comentarios__imagens">
                      {c.anexos.map((a) => (
                        a.url ? (
                          // Abre a imagem inteira numa aba nova. O endereço é assinado e vence
                          // em uma hora; reabrir o card gera outro.
                          <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" className="abacato-comentarios__miniatura" title={a.nome}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={a.url} alt={a.nome || "imagem do comentário"} loading="lazy" />
                          </a>
                        ) : (
                          <span key={a.id} className="abacato-comentarios__miniatura abacato-comentarios__miniatura--falha">imagem indisponível</span>
                        )
                      ))}
                    </div>
                  )}

                  {(c.podeEditar || c.podeApagar) && editando?.id !== c.id && (
                    <div className="abacato-comentario__opcoes">
                      {c.podeEditar && <button type="button" className="abacato-comentario__opcao" onClick={() => setEditando({ id: c.id, texto: c.texto })}>Editar</button>}
                      {c.podeApagar && <button type="button" className="abacato-comentario__opcao" onClick={() => apagar(c)}>Apagar</button>}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
