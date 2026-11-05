"use client";

// O terminal da IDE livre (05/11/2026). Os comandos moram em src/dominio/shell.js; quem roda os programas, em
// ./executores.js. Aqui fica a tela: as linhas (com as cores ANSI que os programas mandam), o prompt, o histórico
// (↑ ↓), o Tab que completa, o Ctrl+C que interrompe, o Ctrl+L que limpa, os modos interativos (node, python,
// sqlite3) e o pedido da entrada para o programa que lê input()/scanf.

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { executarLinha, promptDe, completar, precisaDeEntrada, ESTADO_INICIAL } from "@/dominio/shell.js";
import { diferencaDoProjeto, aplicarDiferenca, caminhoParaMostrar } from "@/dominio/ide.js";
import { rodarPedido, abrirModoInterativo } from "./executores.js";

const MAX_PEDACOS = 3000;
const CHAVE_DO_HISTORICO = "proof-ide-historico";

// ---- as cores ANSI (\x1b[31m...) viram classes; os outros códigos de controle saem
const CORES = { 30: "preto", 31: "vermelho", 32: "verde", 33: "amarelo", 34: "azul", 35: "magenta", 36: "ciano", 37: "branco", 90: "cinza", 91: "vermelho", 92: "verde", 93: "amarelo", 94: "azul", 95: "magenta", 96: "ciano", 97: "branco" };
function pedacosAnsi(texto, estadoInicial = {}) {
  const saida = [];
  let estilo = { ...estadoInicial };
  const limpo = String(texto).replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\x1b\[[0-9;?]*[A-HJKSTfhlnsu]/g, "");
  let i = 0;
  for (const m of limpo.matchAll(/\x1b\[([0-9;]*)m/g)) {
    if (m.index > i) saida.push({ texto: limpo.slice(i, m.index), ...estilo });
    for (const c of (m[1] || "0").split(";").map(Number)) {
      if (c === 0) estilo = {};
      else if (c === 1) estilo = { ...estilo, negrito: true };
      else if (c === 22) estilo = { ...estilo, negrito: false };
      else if (c === 39) estilo = { ...estilo, cor: undefined };
      else if (CORES[c]) estilo = { ...estilo, cor: CORES[c] };
    }
    i = m.index + m[0].length;
  }
  if (i < limpo.length) saida.push({ texto: limpo.slice(i), ...estilo });
  return saida;
}

function lerHistorico() {
  try { const h = JSON.parse(localStorage.getItem(CHAVE_DO_HISTORICO) || "[]"); return Array.isArray(h) ? h.slice(-300) : []; } catch { return []; }
}
function guardarHistorico(h) {
  try { localStorage.setItem(CHAVE_DO_HISTORICO, JSON.stringify(h.slice(-300))); } catch { /* sem espaço: o histórico vale só nesta aba */ }
}

const BOAS_VINDAS = [
  ["info", "Terminal do Proof — digite help para ver os comandos.\n"],
  ["info", "JavaScript, Python e SQL rodam aqui no navegador; C, C++, Java, Go, Rust, Lua, Ruby, PHP e outras, no compilador on-line.\n"],
];

/**
 * Props: `projeto` (o de agora), `aoMudarProjeto(fn)` (recebe uma função p => novo p), `aoAbrir(caminho)`,
 * `aoPrevia(caminho)`. Pela ref: `rodar(linha)` (o botão ▶ da IDE), `focar()`, `limpar()`.
 */
const Terminal = forwardRef(function Terminal({ projeto, aoMudarProjeto, aoAbrir, aoPrevia, nomeDoProjeto }, ref) {
  const [pedacos, setPedacos] = useState(() => BOAS_VINDAS.map(([tipo, texto], n) => ({ n, tipo, texto })));
  const [linha, setLinha] = useState("");
  const [rodando, setRodando] = useState(false);
  const [modo, setModo] = useState(null); // null | { tipo: "repl", ... } | { tipo: "entrada", ... }
  const [shell, setShell] = useState(() => { const e = ESTADO_INICIAL(null); return { cwd: e.cwd, env: e.env }; });
  const historico = useRef([]);
  const posicao = useRef(-1);
  const rascunho = useRef("");
  const contador = useRef(BOAS_VINDAS.length);
  const fim = useRef(null);
  const campo = useRef(null);
  const tela = useRef(null);
  const parar = useRef(null);
  const atual = useRef({ projeto, shell });
  atual.current = { projeto, shell };
  const sessao = useRef(null);
  const ocupado = useRef(false);

  useEffect(() => { historico.current = lerHistorico(); }, []);
  useEffect(() => () => sessao.current?.fechar?.(), []);

  // a pasta atual sumiu (rm -r, outro projeto): volta para a raiz
  useEffect(() => {
    if (shell.cwd !== "/" && projeto && !Object.keys(projeto.arquivos).some((a) => a.startsWith(shell.cwd + "/")) && !projeto.pastas.some((d) => d === shell.cwd || d.startsWith(shell.cwd + "/"))) {
      setShell((s) => ({ ...s, cwd: "/" }));
    }
  }, [projeto, shell.cwd]);

  const escrever = useCallback((tipo, texto) => {
    if (!texto) return;
    setPedacos((p) => {
      const n = contador.current++;
      const ultimo = p[p.length - 1];
      // pedaços seguidos do mesmo tipo viram um só (a saída que chega aos poucos)
      const novo = ultimo && ultimo.tipo === tipo && tipo !== "comando" && ultimo.texto.length < 4000
        ? [...p.slice(0, -1), { ...ultimo, texto: ultimo.texto + texto }]
        : [...p, { n, tipo, texto }];
      return novo.length > MAX_PEDACOS ? novo.slice(novo.length - MAX_PEDACOS) : novo;
    });
  }, []);

  useEffect(() => { fim.current?.scrollIntoView({ block: "end" }); }, [pedacos, modo, rodando]);

  const limpar = useCallback(() => setPedacos([]), []);

  const promptAtual = modo?.tipo === "repl" ? (modo.mais ? modo.promptMais : modo.prompt)
    : modo?.tipo === "entrada" ? "entrada>"
    : promptDe({ cwd: shell.cwd });

  /** O que um comando/programa fez no projeto entra no projeto de AGORA (sem desfazer a edição do meio). */
  const aplicarNoProjeto = useCallback((antes, depois) => {
    const d = diferencaDoProjeto(antes, depois);
    if (d) aoMudarProjeto((p) => aplicarDiferenca(p, d));
  }, [aoMudarProjeto]);

  async function abrirRepl(efeito) {
    try {
      const s = abrirModoInterativo(efeito.linguagem, {
        projeto: () => atual.current.projeto, banco: efeito.banco, cwd: atual.current.shell.cwd,
        aoEscrever: escrever, aoMudarProjeto,
      });
      sessao.current = s;
      escrever("info", s.titulo + "\n");
      setModo({ tipo: "repl", linguagem: efeito.linguagem, prompt: s.prompt, promptMais: s.promptMais, mais: false });
    } catch (e) {
      escrever("erro", `${e.message}\n`);
    }
  }

  function sairDoRepl() {
    sessao.current?.fechar?.();
    sessao.current = null;
    setModo(null);
  }

  async function rodarNoShell(texto, entradaPadrao = null) {
    const antes = atual.current.projeto;
    const controle = new AbortController();
    parar.current = controle;
    setRodando(true);
    try {
      const estado = { projeto: antes, cwd: atual.current.shell.cwd, env: atual.current.shell.env, historico: historico.current };
      const r = await executarLinha(texto, estado, { rodar: rodarPedido, aoEscrever: escrever, sinal: controle.signal, entradaPadrao });
      if (r.saida) escrever("saida", r.saida);
      if (r.erro) escrever("erro", r.erro);
      setShell({ cwd: r.estado.cwd, env: r.estado.env });
      if (r.estado.projeto !== antes) aplicarNoProjeto(antes, r.estado.projeto);
      for (const ef of r.efeitos) {
        if (ef.tipo === "limpar") limpar();
        else if (ef.tipo === "abrir") aoAbrir?.(ef.caminho);
        else if (ef.tipo === "previa") aoPrevia?.(ef.caminho);
        else if (ef.tipo === "repl") await abrirRepl(ef);
        else if (ef.tipo === "historico-limpo") { historico.current = []; guardarHistorico([]); }
      }
    } catch (e) {
      escrever("erro", `${e.message || e}\n`);
    } finally {
      parar.current = null;
      setRodando(false);
      setTimeout(() => campo.current?.focus({ preventScroll: true }), 0);
    }
  }

  async function executar(texto) {
    // o modo de pedir a entrada: cada Enter é uma linha; linha vazia (ou Ctrl+D) roda
    if (modo?.tipo === "entrada") {
      escrever("comando", `entrada> ${texto}\n`);
      if (texto === "") { const { linhas, comando } = modo; setModo(null); await rodarNoShell(comando, linhas.length ? linhas.join("\n") + "\n" : ""); return; }
      setModo({ ...modo, linhas: [...modo.linhas, texto] });
      return;
    }
    if (modo?.tipo === "repl") {
      escrever("comando", `${modo.mais ? modo.promptMais : modo.prompt}${texto}\n`);
      if (texto.trim()) { historico.current = [...historico.current, texto]; guardarHistorico(historico.current); }
      const t = texto.trim();
      if (!modo.mais && (t === ".exit" || t === "exit()" || t === "quit()" || t === ".quit" || (modo.linguagem === "python" && (t === "exit" || t === "quit")))) { sairDoRepl(); return; }
      if (!modo.mais && t === ".clear") { limpar(); return; }
      if (!modo.mais && t === ".help" && modo.linguagem === "javascript") { escrever("info", ".exit sai · .clear limpa · as variáveis ficam vivas entre as linhas · await funciona direto\n"); return; }
      setRodando(true);
      try {
        const r = await sessao.current.enviar(texto);
        if (r.sair) sairDoRepl();
        else setModo((m) => (m ? { ...m, mais: Boolean(r.mais) } : m));
      } catch (e) {
        escrever("erro", `${e.message || e}\n`);
      } finally {
        setRodando(false);
        setTimeout(() => campo.current?.focus({ preventScroll: true }), 0);
      }
      return;
    }
    escrever("comando", `${promptDe({ cwd: shell.cwd })} ${texto}\n`);
    if (!texto.trim()) return;
    historico.current = [...historico.current.filter((h, i, a) => !(i === a.length - 1 && h === texto)), texto];
    guardarHistorico(historico.current);
    // !! repete o último comando; !n, o de número n do history
    if (/^!(!|\d+)$/.test(texto.trim())) {
      const h = historico.current.slice(0, -1);
      const alvo = texto.trim() === "!!" ? h[h.length - 1] : h[Number(texto.trim().slice(1)) - 1];
      if (!alvo) { escrever("erro", "proof: evento não encontrado\n"); return; }
      escrever("info", `${alvo}\n`);
      return executar(alvo);
    }
    const estado = { projeto: atual.current.projeto, cwd: shell.cwd, env: shell.env, historico: historico.current };
    if (precisaDeEntrada(texto, estado)) {
      escrever("info", "Este programa lê a entrada. Digite as linhas, uma por vez; Enter numa linha vazia roda (ou Ctrl+D).\n");
      setModo({ tipo: "entrada", comando: texto, linhas: [] });
      return;
    }
    await rodarNoShell(texto);
  }

  useImperativeHandle(ref, () => ({
    rodar: (texto) => {
      // a trava é uma ref (vale na hora): dois pedidos no mesmo instante não rodam juntos
      if (rodando || ocupado.current) { escrever("erro", "Espere o programa de agora terminar (ou Ctrl+C no terminal).\n"); return; }
      ocupado.current = true;
      setTimeout(() => { ocupado.current = false; }, 400);
      if (modo?.tipo === "repl") sairDoRepl();
      if (modo?.tipo === "entrada") setModo(null);
      setTimeout(() => executar(texto), 0);
    },
    focar: () => campo.current?.focus(),
    limpar,
    // o console da prévia da página e outros avisos de fora entram como linhas do terminal
    escrever: (tipo, texto) => escrever(tipo === "aviso" ? "aviso" : tipo === "erro" ? "erro" : "saida", texto),
  }));

  function teclas(e) {
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key.toLowerCase() === "c") {
      // com texto selecionado no terminal, Ctrl+C copia (o navegador cuida); sem, interrompe
      if (window.getSelection()?.toString()) return;
      e.preventDefault();
      if (rodando && parar.current) { parar.current.abort(); return; }
      escrever("comando", `${promptAtual}${modo?.tipo === "repl" ? "" : " "}${linha}^C\n`);
      setLinha("");
      if (modo?.tipo === "entrada") { setModo(null); return; }
      if (modo?.tipo === "repl" && modo.mais) { sessao.current?.enviar?.(""); setModo({ ...modo, mais: false }); }
      return;
    }
    if (ctrl && e.key.toLowerCase() === "l") { e.preventDefault(); limpar(); return; }
    if (ctrl && e.key.toLowerCase() === "d") {
      e.preventDefault();
      if (modo?.tipo === "repl") { escrever("comando", `${promptAtual}\n`); sairDoRepl(); }
      else if (modo?.tipo === "entrada") executar("");
      return;
    }
    if (rodando) { if (e.key === "Enter") e.preventDefault(); return; }
    if (e.key === "Enter") {
      e.preventDefault();
      const t = linha;
      setLinha("");
      posicao.current = -1;
      executar(t);
      return;
    }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const h = historico.current;
      if (!h.length) return;
      e.preventDefault();
      if (posicao.current === -1) rascunho.current = linha;
      let p = posicao.current === -1 ? h.length : posicao.current;
      p = e.key === "ArrowUp" ? Math.max(0, p - 1) : p + 1;
      if (p >= h.length) { posicao.current = -1; setLinha(rascunho.current); return; }
      posicao.current = p;
      setLinha(h[p]);
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      if (modo) { setLinha((l) => l + "  "); return; }
      const estado = { projeto: atual.current.projeto, cwd: shell.cwd, env: shell.env };
      const r = completar(linha, estado);
      if (r.opcoes.length > 1) escrever("info", `${r.opcoes.join("   ")}\n`);
      setLinha(r.linha);
    }
  }

  return (
    <div className="ide-term" ref={tela} onMouseUp={() => { if (!window.getSelection()?.toString()) campo.current?.focus({ preventScroll: true }); }} role="region" aria-label="Terminal">
      <div className="ide-term__saida" aria-live="polite">
        {pedacos.map((p) => (
          <span key={p.n} className={`ide-term__pedaco ide-term__pedaco--${p.tipo}`}>
            {p.tipo === "saida" || p.tipo === "erro" ? pedacosAnsi(p.texto).map((s, i) => (
              <span key={i} className={[s.cor ? `ide-ansi--${s.cor}` : "", s.negrito ? "ide-ansi--negrito" : ""].filter(Boolean).join(" ") || undefined}>{s.texto}</span>
            )) : p.texto}
          </span>
        ))}
        <div className={`ide-term__linha${rodando ? " ide-term__linha--rodando" : ""}`}>
          {/* o campo fica sempre na tela (só leitura enquanto roda): é nele que o Ctrl+C chega */}
          {rodando ? (
            <span className="ide-term__rodando">rodando… <kbd>Ctrl</kbd>+<kbd>C</kbd> interrompe</span>
          ) : (
            <span className={`ide-term__prompt${modo ? " ide-term__prompt--modo" : ""}`}>
              {modo ? promptAtual : <><span className="ide-term__usuario">aluno@proof</span>:<span className="ide-term__pasta">{caminhoParaMostrar(shell.cwd)}</span>$</>}
            </span>
          )}
          <input
            ref={campo}
            className={`ide-term__campo${rodando ? " ide-term__campo--rodando" : ""}`}
            value={rodando ? "" : linha}
            readOnly={rodando}
            onChange={(e) => setLinha(e.target.value)}
            onKeyDown={teclas}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            aria-label={`Comando do terminal${nomeDoProjeto ? ` do projeto ${nomeDoProjeto}` : ""}`}
          />
        </div>
        <div ref={fim} />
      </div>
    </div>
  );
});

export default Terminal;
