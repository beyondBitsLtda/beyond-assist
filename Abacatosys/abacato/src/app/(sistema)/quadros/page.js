"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { obter, criar, mudar, definir, remover } from "@/lib/api.js";
import ImportarDoTrello from "@/componentes/ImportarDoTrello.js";
import QuadroGen from "@/componentes/QuadroGen.js";
import AvisoDeLimite from "@/componentes/AvisoDeLimite.js";

const PAPEL_EM_PALAVRAS = {
  dono: "seu",
  editor: "pode editar",
  comentarista: "pode comentar",
  leitor: "só leitura",
};

/**
 * A primeira tela de quem entra: os quadros dele, agrupados pelos workspaces DELE.
 *
 * Workspace é organização pessoal (ver db/010-workspaces.sql): quem ainda não criou nenhum vê a
 * lista exatamente como era antes, sem seção nenhuma — um cabeçalho "Sem workspace" em cima de
 * todos os quadros seria ruído para quem nunca pediu workspace.
 */
export default function Quadros() {
  const [quadros, setQuadros] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  // Em qual workspace o quadro novo vai nascer; `null` = solto, em "Sem workspace".
  const [destinoDoNovo, setDestinoDoNovo] = useState(null);
  const [novoWorkspace, setNovoWorkspace] = useState(false);
  const [renomeando, setRenomeando] = useState(null);
  const [menuDoWorkspace, setMenuDoWorkspace] = useState(null);
  const [arquivados, setArquivados] = useState(0);
  const [vendoArquivados, setVendoArquivados] = useState(false);
  const [erro, setErro] = useState("");
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [temLisa, setTemLisa] = useState(false);
  const [menuAberto, setMenuAberto] = useState(null);
  const campo = useRef(null);
  const router = useRouter();

  const carregar = useCallback(async (arquivados = false) => {
    try {
      const d = await obter(`/api/quadros${arquivados ? "?arquivados=1" : ""}`);
      setQuadros(d.quadros);
      setWorkspaces(d.workspaces || []);
      setVendoArquivados(Boolean(d.mostrandoArquivados));
      if (!d.mostrandoArquivados) setArquivados(d.arquivados || 0);
      setErro("");
    } catch (e) {
      setErro(e.message);
    }
  }, []);

  useEffect(() => { carregar(false); }, [carregar]);

  // O Quadro Gen é a Lisa, então segue a mesma liberação dela. Esconder o botão é conforto:
  // quem decide é a rota, que recusa com 403.
  useEffect(() => {
    let vivo = true;
    fetch("/api/lisa")
      .then((r) => (r.ok ? r.json() : { podeUsar: false }))
      .then((d) => { if (vivo) setTemLisa(Boolean(d?.podeUsar)); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);
  useEffect(() => { if (criando) campo.current?.focus(); }, [criando]);

  async function enviar(e) {
    e?.preventDefault();
    const t = nome.trim();
    if (!t || enviando) return;
    setEnviando(true);
    setErro("");
    try {
      const d = await criar("/api/quadros", { nome: t, workspaceId: destinoDoNovo });
      // Vai direto para o quadro novo. Voltar para a lista obrigaria a procurá-lo e clicar de
      // novo — e quem acabou de criar um quadro quer usá-lo, não admirá-lo na lista.
      router.push(`/quadros/${d.quadro.id}`);
    } catch (x) {
      setErro(x.message);
      setEnviando(false);
    }
  }

  async function arquivar(quadro) {
    setMenuAberto(null);
    // O aviso diz o que acontece E o que NÃO acontece. "Arquivar" assusta porque parece
    // apagar, e a única coisa que tira o susto é dizer que dá para trazer de volta.
    if (!window.confirm(
      `Arquivar "${quadro.nome}"?\n\nEle sai desta lista, mas nada é apagado: as colunas, os cards e as checklists continuam guardados, e dá para restaurar quando quiser.`
    )) return;
    try {
      await remover(`/api/quadros/${quadro.id}`);
      await carregar(vendoArquivados);
    } catch (e) { setErro(e.message); }
  }

  async function restaurar(quadro) {
    setMenuAberto(null);
    try {
      await mudar(`/api/quadros/${quadro.id}`, { arquivado: false });
      await carregar(true);
    } catch (e) { setErro(e.message); }
  }

  async function criarWorkspace(nome) {
    try {
      await criar("/api/workspaces", { nome });
      setNovoWorkspace(false);
      await carregar(false);
    } catch (e) { setErro(e.message); }
  }

  async function renomearWorkspace(ws, nome) {
    setRenomeando(null);
    if (!nome || nome === ws.nome) return;
    try { await mudar(`/api/workspaces/${ws.id}`, { nome }); await carregar(false); }
    catch (e) { setErro(e.message); }
  }

  async function apagarWorkspace(ws, quantos) {
    setMenuDoWorkspace(null);
    // O aviso diz o que NÃO se perde: "apagar" com quadros dentro assusta, e o que tira o susto
    // é saber que os quadros ficam, inteiros.
    const aviso = quantos
      ? `Apagar o workspace "${ws.nome}"?\n\nOs ${quantos} quadro(s) dele não são apagados: voltam para "Sem workspace", inteiros.`
      : `Apagar o workspace "${ws.nome}"?`;
    if (!window.confirm(aviso)) return;
    try { await remover(`/api/workspaces/${ws.id}`); await carregar(false); }
    catch (e) { setErro(e.message); }
  }

  async function moverParaWorkspace(quadro, workspaceId) {
    setMenuAberto(null);
    // Otimista: o cartão muda de seção no clique. A ida ao banco de casa leva uns 300ms, e um
    // cartão que fica parado depois do clique parece que não pegou.
    setQuadros((qs) => qs.map((q) => (q.id === quadro.id ? { ...q, workspace_id: workspaceId } : q)));
    try { await definir(`/api/quadros/${quadro.id}/workspace`, { workspaceId }); }
    catch (e) { setErro(e.message); await carregar(false); }
  }

  function abrirCriacao(workspaceId) {
    setDestinoDoNovo(workspaceId);
    setCriando(true);
  }

  const vazio = quadros?.length === 0;
  const agrupar = !vendoArquivados && workspaces.length > 0;
  const nomeDoDestino = workspaces.find((w) => w.id === destinoDoNovo)?.nome;

  /** Um cartão de quadro. Função, e não componente, porque precisa de metade do estado da
   *  tela — o menu aberto, os workspaces, o modo arquivado — e passar tudo por props só
   *  trocaria o lugar da mesma dependência. */
  function cartao(q) {
    return (
      <div key={q.id} className="abacato-quadro-cartao">
        {/* A capa usa o MESMO valor do papel de parede do quadro — que pode ser um
            gradiente ou uma imagem. Os dois entram como `background` e o CSS resolve o
            enquadramento, sem a tela precisar saber qual dos dois veio. */}
        <span
          className="abacato-quadro-cartao__faixa"
          style={{ background: q.papel_de_parede || "linear-gradient(135deg, #0F2A1D, #1B4332)" }}
        />

        {/* O link cobre o cartão inteiro por baixo, e o menu fica POR CIMA. Um <button>
            dentro de um <a> é HTML inválido e o clique fica imprevisível — foi por isso
            que o cartão deixou de ser um link e virou uma caixa com um link dentro. */}
        <Link href={`/quadros/${q.id}`} className="abacato-quadro-cartao__area" aria-label={`Abrir ${q.nome}`} />

        <div className="abacato-quadro-cartao__nome">{q.nome}</div>
        {q.descricao && <div className="abacato-quadro-cartao__descricao">{q.descricao}</div>}

        <div className="abacato-quadro-cartao__rodape">
          <span className="abacato-etiqueta abacato-etiqueta--ok">{PAPEL_EM_PALAVRAS[q.papel] || q.papel}</span>
          {vendoArquivados && <span className="abacato-dica">arquivado</span>}
        </div>

        {/* O menu aparece para quem tem o que fazer nele: mover de workspace vale para
            qualquer um que veja o quadro (é a lista DELE); arquivar e restaurar, só o dono —
            é o que a rota exige, e mostrar o botão para quem vai levar 403 é pior que não
            mostrar. */}
        {(q.papel === "dono" || (!vendoArquivados && workspaces.length > 0)) && (
          <div className="abacato-menu abacato-quadro-cartao__menu">
            <button
              type="button"
              className="abacato-icone"
              aria-label={`opções de ${q.nome}`}
              onClick={() => setMenuAberto(menuAberto === q.id ? null : q.id)}
            >⋯</button>
            {menuAberto === q.id && (
              <>
                <div className="abacato-menu__fundo" onClick={() => setMenuAberto(null)} />
                <div className="abacato-menu__caixa abacato-menu__caixa--direita" role="menu">
                  {!vendoArquivados && workspaces.length > 0 && (
                    <>
                      <div className="abacato-menu__titulo">Mover para workspace</div>
                      {workspaces.map((w) => (
                        <button key={w.id} type="button" className="abacato-menu__item"
                          disabled={q.workspace_id === w.id}
                          onClick={() => moverParaWorkspace(q, w.id)}>
                          {q.workspace_id === w.id ? "✓ " : ""}{w.nome}
                        </button>
                      ))}
                      <button type="button" className="abacato-menu__item"
                        disabled={!q.workspace_id}
                        onClick={() => moverParaWorkspace(q, null)}>
                        {!q.workspace_id ? "✓ " : ""}Sem workspace
                      </button>
                    </>
                  )}
                  {q.papel === "dono" && (vendoArquivados ? (
                    <button type="button" className="abacato-menu__item" onClick={() => restaurar(q)}>
                      ↩ Restaurar quadro
                    </button>
                  ) : (
                    <button type="button" className="abacato-menu__item abacato-menu__item--perigo"
                      onClick={() => arquivar(q)}>
                      Arquivar quadro
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <header className="abacato-conteudo__cabecalho">
        <h1 className="abacato-conteudo__titulo">
          {vendoArquivados ? "Quadros arquivados" : "Quadros"}
        </h1>
        {!criando && (
          <div className="abacato-bloco__acoes">
            {vendoArquivados ? (
              <button className="abacato-botao abacato-botao--fantasma" onClick={() => carregar(false)}>
                ← Voltar aos quadros
              </button>
            ) : (
              <>
                {arquivados > 0 && (
                  <button className="abacato-botao abacato-botao--fantasma" onClick={() => carregar(true)}>
                    Arquivados ({arquivados})
                  </button>
                )}
                {/* Só aparece para quem tem a assistente liberada — o Quadro Gen é ela. */}
                {temLisa && (
                  <button className="abacato-botao abacato-botao--fantasma" onClick={() => setGerando(true)}>
                    ✦ Montar com a Lisa
                  </button>
                )}
                <button className="abacato-botao abacato-botao--fantasma" onClick={() => setImportando(true)}>
                  Trazer do Trello
                </button>
                <button className="abacato-botao abacato-botao--fantasma" onClick={() => setNovoWorkspace(true)}>
                  + Workspace
                </button>
                <button className="abacato-botao" onClick={() => abrirCriacao(null)}>+ Novo quadro</button>
              </>
            )}
          </div>
        )}
      </header>

      <AvisoDeLimite qual="quadros" nome="quadros" />

      {criando && (
        <form className="abacato-criar-quadro" onSubmit={enviar}>
          <input
            ref={campo}
            className="abacato-campo__entrada"
            placeholder={nomeDoDestino
              ? `Novo quadro em ${nomeDoDestino}`
              : "Nome do quadro — ex.: Obra Delp, Comercial 2026"}
            value={nome}
            maxLength={120}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") { setNome(""); setCriando(false); } }}
          />
          <button className="abacato-botao" type="submit" disabled={!nome.trim() || enviando}>
            {enviando ? "Criando…" : "Criar"}
          </button>
          <button type="button" className="abacato-icone" aria-label="cancelar"
            onClick={() => { setNome(""); setCriando(false); }}>✕</button>
        </form>
      )}

      {novoWorkspace && (
        <form
          className="abacato-criar-quadro"
          onSubmit={(e) => {
            e.preventDefault();
            const t = e.currentTarget.elements.nome.value.trim();
            if (t) criarWorkspace(t);
          }}
        >
          <input
            name="nome"
            className="abacato-campo__entrada"
            placeholder="Nome do workspace — ex.: Delp, Pessoal, Clientes"
            maxLength={80}
            autoFocus
            onKeyDown={(e) => { if (e.key === "Escape") setNovoWorkspace(false); }}
          />
          <button className="abacato-botao" type="submit">Criar workspace</button>
          <button type="button" className="abacato-icone" aria-label="cancelar"
            onClick={() => setNovoWorkspace(false)}>✕</button>
        </form>
      )}

      {erro && <div className="abacato-campo__erro" style={{ marginBottom: 16 }}>⚠ {erro}</div>}

      {quadros === null && <div className="abacato-vazio">carregando…</div>}

      {vazio && vendoArquivados && (
        <div className="abacato-vazio">
          <p className="abacato-vazio__titulo">Nenhum quadro arquivado</p>
          <p>Tudo que você tem está na lista principal.</p>
        </div>
      )}

      {vazio && !vendoArquivados && !criando && (
        <div className="abacato-vazio">
          <p className="abacato-vazio__titulo">Nenhum quadro ainda</p>
          <p>Crie o primeiro. Ele já nasce com as colunas A fazer, Fazendo e Feito.</p>
          <p style={{ marginTop: 18 }} className="abacato-vazio__acoes">
            <button className="abacato-botao" onClick={() => abrirCriacao(null)}>+ Criar o primeiro quadro</button>
            <button className="abacato-botao abacato-botao--fantasma" onClick={() => setImportando(true)}>
              Trazer um do Trello
            </button>
          </p>
        </div>
      )}

      {importando && (
        <ImportarDoTrello aoFechar={() => setImportando(false)} aoTerminar={() => carregar(false)} />
      )}

      {gerando && <QuadroGen aoFechar={() => setGerando(false)} />}

      {quadros?.length > 0 && !agrupar && (
        <div className="abacato-grade">{quadros.map(cartao)}</div>
      )}

      {quadros && agrupar && (
        <>
          {workspaces.map((w) => {
            const dele = quadros.filter((q) => q.workspace_id === w.id);
            return (
              <section key={w.id} className="abacato-workspace">
                <header className="abacato-workspace__cabecalho">
                  <span className="abacato-workspace__icone" aria-hidden="true">{(w.nome[0] || "?").toUpperCase()}</span>
                  {renomeando === w.id ? (
                    <input
                      className="abacato-workspace__campo"
                      defaultValue={w.nome}
                      autoFocus
                      maxLength={80}
                      onBlur={(e) => renomearWorkspace(w, e.target.value.trim())}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.target.blur();
                        if (e.key === "Escape") setRenomeando(null);
                      }}
                    />
                  ) : (
                    <button type="button" className="abacato-workspace__nome" title="clique para renomear"
                      onClick={() => setRenomeando(w.id)}>
                      {w.nome}
                    </button>
                  )}
                  <span className="abacato-workspace__conta">{dele.length}</span>

                  <div className="abacato-workspace__acoes">
                    <button type="button" className="abacato-botao abacato-botao--fantasma abacato-botao--pequeno"
                      onClick={() => abrirCriacao(w.id)}>
                      + Quadro aqui
                    </button>
                    <div className="abacato-menu">
                      <button type="button" className="abacato-icone" aria-label={`opções do workspace ${w.nome}`}
                        onClick={() => setMenuDoWorkspace(menuDoWorkspace === w.id ? null : w.id)}>⋯</button>
                      {menuDoWorkspace === w.id && (
                        <>
                          <div className="abacato-menu__fundo" onClick={() => setMenuDoWorkspace(null)} />
                          <div className="abacato-menu__caixa abacato-menu__caixa--direita" role="menu">
                            <button type="button" className="abacato-menu__item"
                              onClick={() => { setMenuDoWorkspace(null); setRenomeando(w.id); }}>
                              Renomear
                            </button>
                            <button type="button" className="abacato-menu__item abacato-menu__item--perigo"
                              onClick={() => apagarWorkspace(w, dele.length)}>
                              Apagar workspace
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </header>

                {dele.length ? (
                  <div className="abacato-grade">{dele.map(cartao)}</div>
                ) : (
                  <p className="abacato-workspace__vazio">
                    Nenhum quadro aqui ainda. Crie um com <strong>+ Quadro aqui</strong>, ou traga um que já
                    existe pelo <strong>⋯</strong> do quadro, em <strong>Mover para workspace</strong>.
                  </p>
                )}
              </section>
            );
          })}

          {(() => {
            const soltos = quadros.filter((q) => !q.workspace_id);
            // "Sem workspace" vazio não aparece: quando tudo já está organizado, a seção só
            // diria que não há nada ali.
            if (!soltos.length) return null;
            return (
              <section className="abacato-workspace abacato-workspace--soltos">
                <header className="abacato-workspace__cabecalho">
                  <span className="abacato-workspace__nome abacato-workspace__nome--fixo">Sem workspace</span>
                  <span className="abacato-workspace__conta">{soltos.length}</span>
                </header>
                <div className="abacato-grade">{soltos.map(cartao)}</div>
              </section>
            );
          })()}
        </>
      )}
    </>
  );
}
