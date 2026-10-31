"use client";

// Os cartões com repetição espaçada (31/10/2026): a revisão de hoje, cartão a cartão (frente, virar,
// esqueci/difícil/lembrei/fácil), e a pilha de cada trilha (a Lisa cria os do assunto da vez; a
// pessoa escreve os dela). As regras moram em src/dominio/cartoes.js.
//
// Visual revisto em 31/10/2026: o cartão da revisão gira de verdade (frente e verso), com o baralho
// empilhado atrás; cada trilha é uma pilha; "Ver todos" mostra mini-cartões em grade.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { obter, criar, remover } from "@/lib/api.js";
import { formatarDia } from "@/dominio/datas.js";
import { PERFIS } from "@/dominio/perfis.js";
import { RESPOSTAS_DO_CARTAO, ORDEM_DAS_RESPOSTAS, LIMITES_DOS_CARTOES, PONTOS_DOS_CARTOES, previsoes, quandoVolta, revisarCartao } from "@/dominio/cartoes.js";
import { reagir, comemorar, celebrar } from "@/componentes/Neuro.js";
import { Barra, useAviso } from "@/componentes/Pecas.js";

const POR_PAGINA = 12;

// ------------------------------------------------------------------ a revisão

function Revisao({ hoje, inicial, aoTerminar, aoSair, avisar }) {
  const [fila, setFila] = useState(inicial);
  const [virado, setVirado] = useState(false);
  const [feitos, setFeitos] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const atual = fila[0];
  const total = inicial.length;

  const responder = useCallback(async (resposta) => {
    if (!atual || enviando || !virado) return;
    setEnviando(true);
    setErro("");
    try {
      const r = await criar(`/api/cartoes/${atual.id}`, { resposta });
      if (r.pontos > 0) { if (!celebrar(r)) avisar(`+${r.pontos} pontos`); }
      // esqueceu: o cartão volta no fim da fila de hoje, com a agenda nova (como no Anki)
      const resto = fila.slice(1);
      const proxima = resposta === "esqueci" ? [...resto, { ...atual, ...revisarCartao(atual, resposta, hoje), revisadoEm: new Date().toISOString() }] : resto;
      if (resposta !== "esqueci") setFeitos((n) => n + 1);
      setVirado(false);
      setFila(proxima);
      if (!proxima.length) {
        comemorar("Revisão do dia completa! 🎉");
        aoTerminar();
      }
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  }, [atual, enviando, virado, fila, hoje, avisar, aoTerminar]);

  useEffect(() => {
    const tecla = (ev) => {
      if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) return;
      if (ev.code === "Space" && !virado) { ev.preventDefault(); setVirado(true); }
      const n = Number(ev.key);
      if (virado && n >= 1 && n <= 4) responder(ORDEM_DAS_RESPOSTAS[n - 1]);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [virado, responder]);

  if (!atual) return null;
  const dias = previsoes(atual, hoje);
  const atras = Math.min(2, fila.length - 1); // quantos cartões aparecem empilhados atrás
  return (
    <section className="rev" aria-label="Revisão de hoje">
      <div className="rev__topo">
        <span className="rev__conta">{feitos}<small>/{total}</small></span>
        <Barra valor={feitos} total={total} rotulo="Cartões revisados hoje" />
        <button type="button" className="rev__sair" onClick={aoSair}>Pausar</button>
      </div>

      <div className={`rev__baralho rev__baralho--${atras}`}>
        {/* a chave nova a cada cartão: o próximo entra de frente, sem girar de volta */}
        <button key={`${atual.id}-${fila.length}`} type="button" className={`flip${virado ? " flip--virado" : ""}`} onClick={() => setVirado((v) => !v)}
          aria-label={virado ? "Mostrar a frente" : "Virar o cartão"}>
          <span className="flip__interno">
            <span className="flip__face flip__face--frente">
              <span className="flip__tag">{atual.tema}</span>
              <span className="flip__texto">{atual.frente}</span>
              <span className="flip__dica">toque para virar · espaço</span>
            </span>
            <span className="flip__face flip__face--verso" aria-live="polite">
              <span className="flip__tag">{atual.frente}</span>
              <span className="flip__texto flip__texto--verso">{virado ? atual.verso : ""}</span>
              {virado && atual.exemplo && <span className="flip__exemplo">{atual.exemplo}</span>}
            </span>
          </span>
        </button>
      </div>

      <div className={`rev__respostas${virado ? " rev__respostas--ativas" : ""}`} role="group" aria-label="Como foi?">
        {ORDEM_DAS_RESPOSTAS.map((r, i) => (
          <button key={r} type="button" className={`rev__resposta rev__resposta--${r}`} disabled={enviando || !virado} onClick={() => responder(r)}>
            <strong>{RESPOSTAS_DO_CARTAO[r].nome}</strong>
            <small>{quandoVolta(dias[r])}</small>
            <kbd>{i + 1}</kbd>
          </button>
        ))}
      </div>
      {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
    </section>
  );
}

// ------------------------------------------------------------------ a pilha de uma trilha

function NovoCartao({ trilha, aoCriar, aoFechar }) {
  const [frente, setFrente] = useState("");
  const [verso, setVerso] = useState("");
  const [exemplo, setExemplo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    setErro("");
    try {
      await criar("/api/cartoes", { trilhaId: trilha.id, frente, verso, exemplo });
      setFrente(""); setVerso(""); setExemplo("");
      aoCriar("Cartão criado — ele entra na revisão de hoje.");
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setEnviando(false);
    }
  }
  const idiomas = trilha.perfil === "idiomas";
  return (
    <form className="novo-cartao" onSubmit={enviar}>
      <div className="novo-cartao__face">
        <span className="novo-cartao__rotulo">Frente</span>
        <input value={frente} maxLength={LIMITES_DOS_CARTOES.frente} onChange={(e) => setFrente(e.target.value)} required aria-label="Frente do cartão"
          placeholder={idiomas ? "a palavra na língua (ex.: to borrow)" : "a pergunta ou o termo"} />
      </div>
      <div className="novo-cartao__face novo-cartao__face--verso">
        <span className="novo-cartao__rotulo">Verso</span>
        <textarea rows={2} value={verso} maxLength={LIMITES_DOS_CARTOES.verso} onChange={(e) => setVerso(e.target.value)} required aria-label="Verso do cartão"
          placeholder={idiomas ? "a tradução (ex.: pegar emprestado)" : "a resposta"} />
        <input value={exemplo} maxLength={LIMITES_DOS_CARTOES.exemplo} onChange={(e) => setExemplo(e.target.value)} aria-label="Exemplo (opcional)"
          placeholder="exemplo (opcional)" className="novo-cartao__exemplo" />
      </div>
      {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
      <div className="pf-acoes">
        <button type="submit" className="pf-botao pf-botao--pequeno" disabled={enviando || !frente.trim() || !verso.trim()}>{enviando ? "Salvando…" : "Salvar cartão"}</button>
        <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={aoFechar}>Fechar</button>
      </div>
    </form>
  );
}

function MiniCartoes({ trilha, aoMudar }) {
  const [cartoes, setCartoes] = useState(null);
  const [mostrar, setMostrar] = useState(POR_PAGINA);
  const [erro, setErro] = useState("");
  useEffect(() => {
    obter(`/api/cartoes?trilha=${trilha.id}`).then((r) => setCartoes(r.cartoes)).catch((e) => setErro(e.message));
  }, [trilha.id, trilha.total]);
  async function apagar(c) {
    if (!window.confirm(`Apagar o cartão "${c.frente}"?`)) return;
    try {
      await remover(`/api/cartoes/${c.id}`);
      setCartoes((cs) => cs.filter((x) => x.id !== c.id));
      aoMudar();
    } catch (e) {
      setErro(e.message);
    }
  }
  if (erro) return <div className="pf-aviso pf-aviso--erro">{erro}</div>;
  if (!cartoes) return <p className="cartoes__nota">Carregando…</p>;
  if (!cartoes.length) return <p className="cartoes__nota">Nenhum cartão ainda.</p>;
  return (
    <>
      <ul className="minis">
        {cartoes.slice(0, mostrar).map((c) => (
          <li key={c.id} className={`mini${c.origem === "pessoa" ? " mini--seu" : ""}`}>
            <p className="mini__frente">{c.frente}</p>
            <p className="mini__verso">{c.verso}</p>
            <footer className="mini__rodape">
              <span>{c.novo ? "novo" : `volta ${formatarDia(c.proximaEm)}`}{c.origem === "pessoa" ? " · seu" : ""}</span>
              <button type="button" className="mini__apagar" aria-label={`Apagar o cartão ${c.frente}`} title="Apagar" onClick={() => apagar(c)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
              </button>
            </footer>
          </li>
        ))}
      </ul>
      {cartoes.length > mostrar && (
        <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno cartoes__mais" onClick={() => setMostrar((m) => m + POR_PAGINA)}>
          Mostrar mais {Math.min(POR_PAGINA, cartoes.length - mostrar)} de {cartoes.length - mostrar}
        </button>
      )}
    </>
  );
}

function Pilha({ trilha, iaDisponivel, aberto, aoAbrir, aoMudar, avisar }) {
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState("");
  async function pedirALisa() {
    setCriando(true);
    setErro("");
    reagir("pensando", "Escolhendo o que vale a pena lembrar…", 30000);
    try {
      const r = await criar("/api/cartoes", { trilhaId: trilha.id });
      comemorar(`${r.criados} cartões novos de ${r.assunto}!`);
      aoMudar();
    } catch (e) {
      setErro(e.message);
      reagir("triste", "Não deu agora. Tenta de novo daqui a pouco?");
    } finally {
      setCriando(false);
    }
  }
  const camadas = Math.min(3, Math.max(1, Math.ceil(trilha.total / 15)));
  return (
    <article className={`pilha${aberto ? " pilha--aberta" : ""}`}>
      <div className="pilha__cabeca">
        <div className={`pilha__monte pilha__monte--${trilha.total ? camadas : 0}`} aria-hidden="true">
          <span>{trilha.total || "+"}</span>
        </div>
        <div className="pilha__info">
          <h3><span aria-hidden="true">{PERFIS[trilha.perfil]?.emoji}</span> {trilha.tema}</h3>
          <p>
            {trilha.total
              ? <>{trilha.hoje > 0 ? <b>{trilha.hoje} para hoje</b> : (trilha.proxima ? `próximo ${formatarDia(trilha.proxima)}` : "em dia")} · {trilha.novos} novos · {trilha.firmes} firmes</>
              : "Nenhum cartão ainda"}
          </p>
        </div>
      </div>
      <div className="pilha__acoes">
        <button type="button" className="pf-botao pf-botao--pequeno" disabled={criando || !iaDisponivel} onClick={pedirALisa}>{criando ? "Criando…" : "✨ Gerar do assunto"}</button>
        <button type="button" className={`pilha__botao${aberto === "novo" ? " pilha__botao--ativo" : ""}`} aria-expanded={aberto === "novo"} onClick={() => aoAbrir(aberto === "novo" ? "" : "novo")}>＋ Novo</button>
        {trilha.total > 0 && (
          <button type="button" className={`pilha__botao${aberto === "lista" ? " pilha__botao--ativo" : ""}`} aria-expanded={aberto === "lista"} onClick={() => aoAbrir(aberto === "lista" ? "" : "lista")}>
            {aberto === "lista" ? "Esconder" : "Ver todos"}
          </button>
        )}
      </div>
      {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
      {aberto === "novo" && <NovoCartao trilha={trilha} aoFechar={() => aoAbrir("")} aoCriar={(t) => { avisar(t); aoMudar(); }} />}
      {aberto === "lista" && <MiniCartoes trilha={trilha} aoMudar={aoMudar} />}
    </article>
  );
}

// ------------------------------------------------------------------ a página

export default function Cartoes() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [revisando, setRevisando] = useState(false);
  const [aberta, setAberta] = useState({ id: null, painel: "" }); // uma pilha aberta por vez
  const [Aviso, avisar] = useAviso();
  const carregar = useCallback(() => obter("/api/cartoes").then(setDados).catch((e) => setErro(e.message)), []);
  useEffect(() => { carregar(); }, [carregar]);

  if (!dados) return erro ? <div className="pf-aviso pf-aviso--erro">{erro}</div> : <div className="pf-carregando">Embaralhando os cartões…</div>;
  const paraHoje = dados.revisao.length;

  return (
    <div className="cartoes">
      <div className="pf-cabecalho">
        <div>
          <h1>Cartões</h1>
          <p>Cada cartão volta no dia em que você ia esquecer.</p>
        </div>
      </div>

      {revisando && paraHoje > 0 ? (
        <Revisao hoje={dados.hoje} inicial={dados.revisao} avisar={avisar}
          aoSair={() => { setRevisando(false); carregar(); }}
          aoTerminar={() => { setRevisando(false); carregar(); }} />
      ) : (
        <section className="hoje-cartoes">
          <div className={`hoje-cartoes__monte${paraHoje ? "" : " hoje-cartoes__monte--vazio"}`} aria-hidden="true">
            <span>{paraHoje || "✓"}</span>
          </div>
          <div className="hoje-cartoes__texto">
            <h2>{paraHoje ? `${paraHoje} ${paraHoje === 1 ? "cartão" : "cartões"} para hoje` : dados.trilhas.some((t) => t.total) ? "Tudo revisado por hoje" : "Comece uma pilha"}</h2>
            <p>
              {paraHoje ? "Leva uns minutos. " : dados.trilhas.some((t) => t.total) ? "Volte amanhã. " : "Gere cartões do assunto da vez numa trilha abaixo. "}
              <span className="cartoes__nota">{dados.revisadosHoje > 0 ? `Hoje: ${dados.revisadosHoje} revisados, +${dados.pontosHoje} pts.` : `${PONTOS_DOS_CARTOES.porCartao} pts por cartão, até ${PONTOS_DOS_CARTOES.tetoPorDia} por dia.`}</span>
            </p>
            {paraHoje > 0 && <button type="button" className="pf-botao" onClick={() => setRevisando(true)}>Revisar agora</button>}
          </div>
        </section>
      )}

      {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
      {!dados.trilhas.length ? (
        <div className="pf-cartao pf-vazio" style={{ marginTop: 16 }}>
          <h2>Nenhuma trilha ativa</h2>
          <p>Os cartões nascem dos assuntos das suas trilhas.</p>
          <Link className="pf-botao" href="/trilhas">Montar trilha</Link>
        </div>
      ) : (
        <section className="pf-secao">
          <h2 className="pf-secao__titulo">Suas pilhas</h2>
          <div className="pilhas">
            {dados.trilhas.map((t) => (
              <Pilha key={t.id} trilha={t} iaDisponivel={dados.iaDisponivel} avisar={avisar} aoMudar={carregar}
                aberto={aberta.id === t.id ? aberta.painel : ""} aoAbrir={(painel) => setAberta({ id: painel ? t.id : null, painel })} />
            ))}
          </div>
        </section>
      )}
      {Aviso}
    </div>
  );
}
