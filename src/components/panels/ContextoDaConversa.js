"use client";

import { useEffect, useRef, useState } from "react";
import Suspenso from "@/components/shell/Suspenso.js";
import { lerRepositorio, branchValida } from "@/lib/enderecoDoRepositorio.js";

/**
 * O contexto da conversa com a Lisa (25/10/2026): o + da barra de mensagem (anexar imagem do
 * computador, vincular repositório) e a faixa logo acima dela, com o que está vinculado agora —
 * as imagens anexadas e os repositórios. Vale em qualquer conversa, em qualquer escopo: tudo vai
 * junto de cada pergunta até a pessoa tirar (o ✕ de cada um, ou "limpar").
 *
 * Colar com Ctrl+V e arrastar uma imagem para a tela são tratados pela página da assistente.
 */

const Mais = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
);

/** O + da barra de mensagem. */
export function BotaoMais({ aoEscolherImagens, aoVincular, classeDoBotao = "bb-redondo", estiloDoBotao, desabilitado = false }) {
  const entrada = useRef(null);
  const [aberto, setAberto] = useState(false);
  const [modo, setModo] = useState("menu"); // "menu" | "repositorio"

  const mudar = (v) => { setAberto(v); if (!v) setModo("menu"); };
  return (
    <>
      <input
        ref={entrada} type="file" accept="image/*" multiple hidden
        onChange={(e) => { const arquivos = [...(e.target.files || [])]; e.target.value = ""; if (arquivos.length) aoEscolherImagens(arquivos); }}
      />
      <Suspenso
        titulo="Anexar ao contexto da conversa"
        paraCima lado="esquerda" largura={330}
        classeDoBotao={`${classeDoBotao}${desabilitado ? " bb-desabilitado" : ""}`}
        estiloDoBotao={estiloDoBotao}
        aberto={aberto} aoMudar={mudar}
        rotulo={<Mais />}
      >
        {modo === "menu" ? (
          <div className="bb-mais" role="menu">
            <button type="button" role="menuitem" className="bb-mais__item" onClick={() => { mudar(false); entrada.current?.click(); }}>
              <span className="bb-mais__icone" aria-hidden="true">🖼️</span>
              <span><b>Imagem do computador</b><small>Um print, uma foto, um diagrama. Também dá para colar com Ctrl+V ou arrastar para a tela.</small></span>
            </button>
            <button type="button" role="menuitem" className="bb-mais__item" onClick={() => setModo("repositorio")}>
              <span className="bb-mais__icone" aria-hidden="true">🔗</span>
              <span><b>Vincular repositório</b><small>A Lisa lê o código do GitHub e usa junto com a conversa e a tela.</small></span>
            </button>
          </div>
        ) : (
          <FormDoRepositorio aoVoltar={() => setModo("menu")} aoVincular={(r) => { aoVincular(r); mudar(false); }} />
        )}
      </Suspenso>
    </>
  );
}

/** Vincular um repositório: o link (ou dono/repo) e, se quiser, a branch. */
function FormDoRepositorio({ aoVincular, aoVoltar }) {
  const [texto, setTexto] = useState("");
  const [branch, setBranch] = useState("");
  const [erro, setErro] = useState("");
  const [conhecidos, setConhecidos] = useState([]);
  const campo = useRef(null);

  useEffect(() => {
    campo.current?.focus();
    // os repositórios que a Lisa já conhece (o painel de Repositórios) viram sugestões
    fetch("/api/code-repos").then((r) => r.json()).then((d) => setConhecidos((d.repos || []).map((r) => r.full_name).filter(Boolean))).catch(() => {});
  }, []);

  function vincular(e) {
    e.preventDefault();
    const r = lerRepositorio(texto);
    if (!r) return setErro("Use https://github.com/dono/repositorio ou dono/repositorio.");
    const b = branch.trim();
    if (b && !branchValida(b)) return setErro("Nome de branch inválido.");
    aoVincular({ repo: r.repo, branch: b || r.branch || null });
  }

  return (
    <form className="bb-mais bb-mais__form" onSubmit={vincular}>
      <div className="bb-mais__topo">
        <button type="button" className="bb-mais__voltar" onClick={aoVoltar} aria-label="Voltar">←</button>
        <b>Vincular repositório</b>
      </div>
      <label className="bb-mais__campo">
        <span>Repositório do GitHub</span>
        <input ref={campo} value={texto} onChange={(e) => { setTexto(e.target.value); setErro(""); }} list="bb-repos-conhecidos" placeholder="https://github.com/dono/repo" spellCheck={false} />
        <datalist id="bb-repos-conhecidos">{conhecidos.map((n) => <option key={n} value={n} />)}</datalist>
      </label>
      <label className="bb-mais__campo">
        <span>Branch <small>(vazio = a principal)</small></span>
        <input value={branch} onChange={(e) => { setBranch(e.target.value); setErro(""); }} placeholder="main" spellCheck={false} />
      </label>
      {erro && <p className="bb-mais__erro" role="alert">{erro}</p>}
      <button type="submit" className="bb-mais__vincular" disabled={!texto.trim()}>Vincular</button>
      <small className="bb-mais__nota">Dica: colar o link de um repositório do GitHub na mensagem também vincula.</small>
    </form>
  );
}

/** O que a Lisa leu de cada repositório na última pergunta ("6 arquivos lidos"), ou o aviso de erro. */
function situacaoDoRepo(r, leitura) {
  if (!leitura) return "será lido na próxima pergunta";
  const aviso = (leitura.avisos || []).find((a) => a.toLowerCase().includes(r.repo.toLowerCase()));
  if (aviso) return `⚠ ${aviso.replace(/^Não consegui ler [^:]+: /, "")}`;
  const lidos = (leitura.lidos || []).filter((l) => l.repo.toLowerCase() === r.repo.toLowerCase());
  const info = (leitura.repos || []).find((x) => x.repo.toLowerCase() === r.repo.toLowerCase());
  if (!info) return "será lido na próxima pergunta";
  return `${lidos.length} arquivo${lidos.length === 1 ? "" : "s"} lido${lidos.length === 1 ? "" : "s"} · ${info.branch}`;
}

/** A faixa acima da barra: as imagens anexadas e os repositórios vinculados, cada um com o ✕. */
export function FaixaDoContexto({ anexos = [], repos = [], leitura = null, preparando = 0, aoRemoverAnexo, aoDesvincular, aoLimpar }) {
  if (!anexos.length && !repos.length && !preparando) return null;
  const lidosPorRepo = (repo) => (leitura?.lidos || []).filter((l) => l.repo.toLowerCase() === repo.toLowerCase()).map((l) => l.path);
  return (
    <div className="bb-contexto" aria-label="Contexto da conversa">
      <span className="bb-contexto__rotulo">Contexto</span>
      {anexos.map((a) => (
        <figure key={a.id} className="bb-contexto__imagem" title={`${a.nome} · ${a.largura}×${a.altura}`}>
          <img src={a.previa} alt={a.nome} />
          <button type="button" className="bb-contexto__tirar" onClick={() => aoRemoverAnexo(a.id)} aria-label={`Tirar ${a.nome} do contexto`}>×</button>
        </figure>
      ))}
      {preparando > 0 && <span className="bb-contexto__preparando">preparando {preparando > 1 ? `${preparando} imagens` : "a imagem"}…</span>}
      {repos.map((r) => (
        <span key={r.repo} className="bb-contexto__repo" title={lidosPorRepo(r.repo).join("\n") || r.repo}>
          <span aria-hidden="true">🔗</span>
          <span className="bb-contexto__repo-textos">
            <b>{r.repo}{r.branch ? <small>@{r.branch}</small> : null}</b>
            <small>{situacaoDoRepo(r, leitura)}</small>
          </span>
          <button type="button" className="bb-contexto__tirar bb-contexto__tirar--repo" onClick={() => aoDesvincular(r.repo)} aria-label={`Desvincular ${r.repo}`}>×</button>
        </span>
      ))}
      {(anexos.length + repos.length) > 1 && <button type="button" className="bb-contexto__limpar" onClick={aoLimpar}>limpar</button>}
    </div>
  );
}
