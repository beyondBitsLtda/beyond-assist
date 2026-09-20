"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { obter, criar } from "@/lib/api.js";
import { Barras, Rosca, Agenda, Pilulas } from "@/componentes/painel/Graficos.js";

/**
 * O painel: como vai o trabalho, em números.
 *
 * A ordem da tela é a ordem em que as perguntas aparecem na cabeça: primeiro "estou bem ou
 * mal" (o geral), depois "onde está o problema" (por quadro, os mais atrasados primeiro), e só
 * então os detalhes de cada quadro.
 */
function dataCurta(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export default function Dashboards() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [abertos, setAbertos] = useState({});
  const [compartilhando, setCompartilhando] = useState(null);

  const carregar = useCallback(async () => {
    try { setDados(await obter("/api/paineis")); setErro(""); }
    catch (e) { setErro(e.message); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  if (erro && !dados) {
    return (
      <div className="abacato-vazio">
        <p className="abacato-vazio__titulo">Não deu para montar os painéis</p>
        <p>{erro}</p>
      </div>
    );
  }
  if (!dados) return <div className="abacato-vazio">somando…</div>;

  const { geral, quadros } = dados;

  if (!quadros.length) {
    return (
      <>
        <header className="abacato-conteudo__cabecalho">
          <h1 className="abacato-conteudo__titulo">Dashboards</h1>
        </header>
        <div className="abacato-vazio">
          <p className="abacato-vazio__titulo">Nenhum quadro para medir ainda</p>
          <p>Crie ou importe um quadro e os números aparecem aqui.</p>
          <p style={{ marginTop: 16 }}>
            <Link href="/quadros" className="abacato-botao">Ir para os quadros</Link>
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="abacato-conteudo__cabecalho">
        <h1 className="abacato-conteudo__titulo">Dashboards</h1>
        <button className="abacato-botao abacato-botao--fantasma" onClick={carregar}>↻ Atualizar</button>
      </header>

      {erro && <div className="abacato-campo__erro" style={{ marginBottom: 12 }}>⚠ {erro}</div>}

      {/* ---------------------------------------------- o geral */}
      <section className="abacato-painel-geral">
        <Rosca pct={geral.progresso} rotulo="concluído" />
        <div className="abacato-painel-geral__lado">
          <p className="abacato-painel-geral__linha">
            <strong>{geral.abertos}</strong> tarefa(s) abertas em <strong>{geral.quadros}</strong> quadro(s)
            {geral.porEstado.atrasado > 0 && (
              <> · <span className="abacato-vermelho">{geral.porEstado.atrasado} atrasada(s)</span></>
            )}
          </p>
          <Pilulas porEstado={geral.porEstado} />
        </div>
      </section>

      {/* ---------------------------------------------- um bloco por quadro */}
      {quadros.map((q) => {
        const aberto = abertos[q.id];
        return (
          <section key={q.id} className="abacato-quadro-painel">
            <header className="abacato-quadro-painel__topo">
              <button
                type="button"
                className="abacato-quadro-painel__nome"
                onClick={() => setAbertos((a) => ({ ...a, [q.id]: !a[q.id] }))}
                aria-expanded={Boolean(aberto)}
              >
                <span className="abacato-ramo__seta">{aberto ? "▾" : "▸"}</span>
                {q.nome}
              </button>

              <span className="abacato-quadro-painel__numeros">
                {q.porEstado.atrasado > 0 && (
                  <span className="abacato-conta-pill abacato-conta-pill--alerta">{q.porEstado.atrasado} atrasado(s)</span>
                )}
                {q.porEstado.hoje > 0 && (
                  <span className="abacato-conta-pill abacato-conta-pill--atencao">{q.porEstado.hoje} hoje</span>
                )}
                <span className="abacato-conta-pill">{q.abertos} aberto(s)</span>
                <span className="abacato-conta-pill">{q.progresso}%</span>
              </span>

              <div className="abacato-bloco__acoes">
                <button type="button" className="abacato-botao abacato-botao--fantasma abacato-botao--pequeno"
                  onClick={() => setCompartilhando(q)}>
                  Link para o cliente
                </button>
                <Link href={`/quadros/${q.id}`} className="abacato-botao abacato-botao--fantasma abacato-botao--pequeno">
                  Abrir quadro
                </Link>
              </div>
            </header>

            {/* A barra de andamento aparece SEMPRE, fechado ou aberto: é o número que resume o
                quadro, e ele não pode depender de um clique. */}
            <div className="abacato-barra-progresso">
              <span style={{ width: `${q.progresso}%` }} />
            </div>

            {aberto && (
              <div className="abacato-quadro-painel__corpo">
                <div className="abacato-bloco abacato-bloco--largo">
                  <h3 className="abacato-bloco__titulo">Próximas duas semanas</h3>
                  <Agenda baldes={q.semana} />
                </div>

                <div className="abacato-bloco">
                  <h3 className="abacato-bloco__titulo">Por coluna</h3>
                  <Barras itens={q.colunas} cor="var(--abacato-verde-fundo)" />
                </div>

                <div className="abacato-bloco">
                  <h3 className="abacato-bloco__titulo">Por etiqueta</h3>
                  <Barras itens={q.etiquetas} vazio="nenhuma etiqueta em uso" />
                </div>

                <div className="abacato-bloco">
                  <h3 className="abacato-bloco__titulo">Por pessoa</h3>
                  <Barras itens={q.pessoas} cor="var(--abacato-verde-fundo)" vazio="ninguém atribuído" />
                </div>

                {q.atrasadosDetalhe.length > 0 && (
                  <div className="abacato-bloco abacato-bloco--largo">
                    <h3 className="abacato-bloco__titulo">O que está mais atrasado</h3>
                    {q.atrasadosDetalhe.map((c) => (
                      <div key={c.id} className="abacato-atrasado">
                        <span className="abacato-atrasado__dias">{c.diasAtrasado}d</span>
                        <span className="abacato-atrasado__titulo">{c.titulo}</span>
                        <span className="abacato-atrasado__etiquetas">
                          {c.etiquetas.map((e, i) => (
                            <span key={i} className="abacato-card__etiqueta" style={{ background: e.cor }} title={e.nome} />
                          ))}
                          {c.responsaveis.map((r, i) => <span key={i} className="abacato-avatar">{r}</span>)}
                        </span>
                        <span className="abacato-dica">venceu {dataCurta(c.fimEm)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })}

      {compartilhando && (
        <LinkDoCliente quadro={compartilhando} aoFechar={() => setCompartilhando(null)} />
      )}
    </>
  );
}

/** Criar e copiar o endereço que o cliente abre sem login. */
function LinkDoCliente({ quadro, aoFechar }) {
  const [titulo, setTitulo] = useState(quadro.nome);
  const [comTitulos, setComTitulos] = useState(true);
  const [dias, setDias] = useState(90);
  const [link, setLink] = useState(null);
  const [erro, setErro] = useState("");
  const [copiado, setCopiado] = useState(false);

  async function gerar() {
    setErro("");
    try {
      const d = await criar("/api/paineis", { quadroId: quadro.id, titulo, comTitulos, dias: Number(dias) || 0 });
      setLink(`${window.location.origin}/publico/${d.painel.token}`);
    } catch (e) { setErro(e.message); }
  }

  return (
    <div className="abacato-painel" role="dialog" aria-modal="true" aria-label="Link para o cliente">
      <div className="abacato-painel__fundo" onClick={aoFechar} />
      <div className="abacato-painel__caixa abacato-painel__caixa--estreita">
        <header className="abacato-painel__cabecalho">
          <h2 className="abacato-painel__titulo abacato-painel__titulo--fixo">Link para o cliente</h2>
          <button type="button" className="abacato-icone" onClick={aoFechar} aria-label="fechar">✕</button>
        </header>

        <div className="abacato-painel__corpo">
          {erro && <div className="abacato-campo__erro">⚠ {erro}</div>}

          {!link ? (
            <section className="abacato-bloco">
              <p className="abacato-dica abacato-dica--bloco">
                Um endereço que o cliente abre sem conta e sem senha. Ele vê <strong>andamento,
                contagens e nomes de coluna</strong> — nunca descrições, checklists, anexos ou
                quem é responsável pelo quê.
              </p>

              <label className="abacato-campo">
                <span className="abacato-campo__rotulo">Título que o cliente vê</span>
                <input className="abacato-campo__entrada" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
              </label>

              <label className="abacato-concluir">
                <input type="checkbox" checked={comTitulos} onChange={(e) => setComTitulos(e.target.checked)} />
                Mostrar os títulos das tarefas atrasadas
              </label>
              <p className="abacato-dica">
                Desmarque se os títulos deste quadro não são para olhos de fora — o painel
                continua útil só com os números.
              </p>

              <label className="abacato-campo">
                <span className="abacato-campo__rotulo">Vence em (dias)</span>
                <input type="number" min={0} max={3650} className="abacato-campo__entrada"
                  value={dias} onChange={(e) => setDias(e.target.value)} />
                <span className="abacato-dica">
                  0 = não vence. Um link que vence sozinho é melhor que um eterno que ninguém
                  lembra de desligar.
                </span>
              </label>

              <button type="button" className="abacato-botao" onClick={gerar}>Gerar o link</button>
            </section>
          ) : (
            <section className="abacato-bloco">
              <h3 className="abacato-bloco__titulo">Pronto</h3>
              <div className="abacato-rapido">
                <input className="abacato-campo__entrada" readOnly value={link}
                  onFocus={(e) => e.target.select()} />
                <button type="button" className="abacato-botao abacato-botao--pequeno"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(link);
                      setCopiado(true);
                      setTimeout(() => setCopiado(false), 2000);
                    } catch {
                      // Sem permissão de área de transferência — o campo já está selecionado,
                      // e dizer isso é melhor que um botão que não faz nada.
                      setErro("seu navegador não deixou copiar; o endereço está selecionado, use Ctrl+C");
                    }
                  }}>
                  {copiado ? "✓ Copiado" : "Copiar"}
                </button>
              </div>
              <p className="abacato-dica abacato-dica--bloco">
                Qualquer pessoa com este endereço vê o painel. Guarde-o como guardaria uma senha.
              </p>
              <a className="abacato-botao abacato-botao--fantasma" href={link} target="_blank" rel="noopener noreferrer">
                Abrir para conferir
              </a>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
