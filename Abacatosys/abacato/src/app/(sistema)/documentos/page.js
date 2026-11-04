"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { obter, criar, mudar, definir, remover } from "@/lib/api.js";
import { CORES } from "@/dominio/cores.js";
import AvisoDeLimite from "@/componentes/AvisoDeLimite.js";
import { useWorkspaces, NovoWorkspace, SecoesPorWorkspace, MoverParaWorkspace } from "@/componentes/Workspaces.js";

const PAPEL_EM_PALAVRAS = { dono: "seu", editor: "pode editar", comentarista: "pode comentar", leitor: "só leitura" };

/** Os projetos de documentação. Mesma forma da lista de quadros, de propósito: são duas listas
 *  de caixas com um menu no canto, e aprender duas telas para a mesma tarefa é trabalho à toa.
 *
 *  Os workspaces são os MESMOS da lista de quadros (ver db/011-workspaces-documentos.sql):
 *  "Delp" aqui é o mesmo "Delp" de lá. */
export default function Documentos() {
  const [projetos, setProjetos] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  // Em qual workspace o projeto novo vai nascer; `null` = solto, em "Sem workspace".
  const [destinoDoNovo, setDestinoDoNovo] = useState(null);
  const [arquivados, setArquivados] = useState(0);
  const [vendoArquivados, setVendoArquivados] = useState(false);
  const [erro, setErro] = useState("");
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState(CORES[0].cor);
  const [enviando, setEnviando] = useState(false);
  const [menuAberto, setMenuAberto] = useState(null);
  const campo = useRef(null);
  const router = useRouter();

  const carregar = useCallback(async (verArquivados = false) => {
    try {
      const d = await obter(`/api/projetos${verArquivados ? "?arquivados=1" : ""}`);
      setProjetos(d.projetos);
      setWorkspaces(d.workspaces || []);
      setVendoArquivados(Boolean(d.mostrandoArquivados));
      if (!d.mostrandoArquivados) setArquivados(d.arquivados || 0);
      setErro("");
    } catch (e) { setErro(e.message); }
  }, []);

  useEffect(() => { carregar(false); }, [carregar]);
  const ws = useWorkspaces({ aoMudar: () => carregar(false), aoErro: setErro });
  useEffect(() => { if (criando) campo.current?.focus(); }, [criando]);

  async function enviar(e) {
    e?.preventDefault();
    const t = nome.trim();
    if (!t || enviando) return;
    setEnviando(true);
    setErro("");
    try {
      const d = await criar("/api/projetos", { nome: t, cor, workspaceId: destinoDoNovo });
      router.push(`/documentos/${d.projeto.id}`);
    } catch (x) {
      setErro(x.message);
      setEnviando(false);
    }
  }

  async function arquivar(p) {
    setMenuAberto(null);
    if (!window.confirm(
      `Arquivar "${p.nome}"?\n\nEle sai desta lista, mas nada é apagado: as pastas, os documentos e todas as versões continuam guardados.`
    )) return;
    try { await remover(`/api/projetos/${p.id}`); await carregar(vendoArquivados); }
    catch (e) { setErro(e.message); }
  }

  async function restaurar(p) {
    setMenuAberto(null);
    try { await mudar(`/api/projetos/${p.id}`, { arquivado: false }); await carregar(true); }
    catch (e) { setErro(e.message); }
  }

  async function moverParaWorkspace(projeto, workspaceId) {
    setMenuAberto(null);
    // Otimista, como na lista de quadros: o cartão muda de seção no clique.
    setProjetos((ps) => ps.map((p) => (p.id === projeto.id ? { ...p, workspace_id: workspaceId } : p)));
    try { await definir(`/api/projetos/${projeto.id}/workspace`, { workspaceId }); }
    catch (e) { setErro(e.message); await carregar(false); }
  }

  function abrirCriacao(workspaceId) {
    setDestinoDoNovo(workspaceId);
    setCriando(true);
  }

  const vazio = projetos?.length === 0;
  const agrupar = !vendoArquivados && workspaces.length > 0;
  const nomeDoDestino = workspaces.find((w) => w.id === destinoDoNovo)?.nome;

  /** Um cartão de projeto. Função, e não componente, pelo mesmo motivo da lista de quadros:
   *  depende do menu aberto, dos workspaces e do modo arquivado. */
  function cartao(p) {
    return (
      <div key={p.id} className="abacato-quadro-cartao">
        <span className="abacato-quadro-cartao__faixa" style={{ background: p.cor || "#22C55E" }} />
        <Link href={`/documentos/${p.id}`} className="abacato-quadro-cartao__area" aria-label={`Abrir ${p.nome}`} />
        <div className="abacato-quadro-cartao__nome">{p.nome}</div>
        {p.descricao && <div className="abacato-quadro-cartao__descricao">{p.descricao}</div>}
        <div className="abacato-quadro-cartao__rodape">
          <span className="abacato-etiqueta abacato-etiqueta--ok">{PAPEL_EM_PALAVRAS[p.papel] || p.papel}</span>
          <span className="abacato-dica">
            {p.documentos === 0 ? "vazio" : `${p.documentos} documento(s)`}
          </span>
        </div>

        {/* Mover de workspace vale para quem vê o projeto (é a lista DELE); arquivar e
            restaurar, só o dono — é o que a rota exige. */}
        {(p.papel === "dono" || (!vendoArquivados && workspaces.length > 0)) && (
          <div className="abacato-menu abacato-quadro-cartao__menu">
            <button type="button" className="abacato-icone" aria-label={`opções de ${p.nome}`}
              onClick={() => setMenuAberto(menuAberto === p.id ? null : p.id)}>⋯</button>
            {menuAberto === p.id && (
              <>
                <div className="abacato-menu__fundo" onClick={() => setMenuAberto(null)} />
                <div className="abacato-menu__caixa abacato-menu__caixa--direita" role="menu">
                  {!vendoArquivados && (
                    <MoverParaWorkspace workspaces={workspaces} atual={p.workspace_id}
                      aoMover={(w) => moverParaWorkspace(p, w)} />
                  )}
                  {p.papel === "dono" && (vendoArquivados ? (
                    <button type="button" className="abacato-menu__item" onClick={() => restaurar(p)}>
                      ↩ Restaurar projeto
                    </button>
                  ) : (
                    <button type="button" className="abacato-menu__item abacato-menu__item--perigo"
                      onClick={() => arquivar(p)}>Arquivar projeto</button>
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
          {vendoArquivados ? "Projetos arquivados" : "Documentos"}
        </h1>
        {!criando && (
          <div className="abacato-bloco__acoes">
            {vendoArquivados ? (
              <button className="abacato-botao abacato-botao--fantasma" onClick={() => carregar(false)}>
                ← Voltar aos projetos
              </button>
            ) : (
              <>
                {arquivados > 0 && (
                  <button className="abacato-botao abacato-botao--fantasma" onClick={() => carregar(true)}>
                    Arquivados ({arquivados})
                  </button>
                )}
                <button className="abacato-botao abacato-botao--fantasma" onClick={() => ws.setNovo(true)}>
                  + Workspace
                </button>
                <button className="abacato-botao" onClick={() => abrirCriacao(null)}>+ Novo projeto</button>
              </>
            )}
          </div>
        )}
      </header>

      <AvisoDeLimite qual="projetos" nome="projetos de documentação" />

      {criando && (
        <form className="abacato-criar-quadro" onSubmit={enviar}>
          <input
            ref={campo}
            className="abacato-campo__entrada"
            placeholder={nomeDoDestino ? `Novo projeto em ${nomeDoDestino}` : "Nome do projeto — ex.: Obra Delp, Contratos 2026"}
            value={nome}
            maxLength={120}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") { setNome(""); setCriando(false); } }}
          />
          <div className="abacato-menu__cores">
            {CORES.map((c) => (
              <button key={c.cor} type="button" title={c.nome} aria-label={c.nome}
                className={`abacato-bolinha${cor === c.cor ? " abacato-bolinha--ativa" : ""}`}
                style={{ background: c.cor }} onClick={() => setCor(c.cor)} />
            ))}
          </div>
          <button className="abacato-botao" type="submit" disabled={!nome.trim() || enviando}>
            {enviando ? "Criando…" : "Criar"}
          </button>
          <button type="button" className="abacato-icone" aria-label="cancelar"
            onClick={() => { setNome(""); setCriando(false); }}>✕</button>
        </form>
      )}

      <NovoWorkspace ws={ws} />

      {erro && <div className="abacato-campo__erro" style={{ marginBottom: 16 }}>⚠ {erro}</div>}

      {projetos === null && <div className="abacato-vazio">carregando…</div>}

      {vazio && vendoArquivados && (
        <div className="abacato-vazio">
          <p className="abacato-vazio__titulo">Nenhum projeto arquivado</p>
        </div>
      )}

      {vazio && !vendoArquivados && !criando && (
        <div className="abacato-vazio">
          <p className="abacato-vazio__titulo">Nenhum projeto de documentação ainda</p>
          <p>Um projeto guarda pastas, subpastas e documentos — com o histórico de versões de cada um.</p>
          <p style={{ marginTop: 18 }}>
            <button className="abacato-botao" onClick={() => abrirCriacao(null)}>+ Criar o primeiro</button>
          </p>
        </div>
      )}

      {projetos?.length > 0 && !agrupar && (
        <div className="abacato-grade">{projetos.map(cartao)}</div>
      )}

      {projetos && agrupar && (
        <SecoesPorWorkspace
          itens={projetos}
          workspaces={workspaces}
          cartao={cartao}
          ws={ws}
          oQue="projeto"
          rotuloAqui="+ Projeto aqui"
          aoCriarAqui={abrirCriacao}
        />
      )}
    </>
  );
}
