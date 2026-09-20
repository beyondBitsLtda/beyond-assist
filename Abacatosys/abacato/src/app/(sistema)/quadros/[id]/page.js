"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Quadro } from "@/dominio/Quadro.js";
import { obter, criar, mudar, remover } from "@/lib/api.js";
import { useArrastar } from "@/componentes/quadro/useArrastar.js";
import Coluna from "@/componentes/quadro/Coluna.js";
import CardMini from "@/componentes/quadro/CardMini.js";
import PainelDoCard from "@/componentes/quadro/PainelDoCard.js";
import PainelDeRecorrencias from "@/componentes/quadro/PainelDeRecorrencias.js";
import ColunasArquivadas from "@/componentes/quadro/ColunasArquivadas.js";
import PapelDeParede from "@/componentes/quadro/PapelDeParede.js";
import { urlDaParede } from "@/dominio/paredes.js";
import Compartilhar from "@/componentes/Compartilhar.js";

export default function PaginaDoQuadro() {
  const { id } = useParams();
  const parametros = useSearchParams();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [cardAberto, setCardAberto] = useState(null);
  const [menuDoQuadro, setMenuDoQuadro] = useState(false);
  const [recorrencias, setRecorrencias] = useState(false);
  const [arquivadas, setArquivadas] = useState(false);
  const [parede, setParede] = useState(false);
  const [compartilhar, setCompartilhar] = useState(false);
  const [novaColuna, setNovaColuna] = useState(false);
  const [aviso, setAviso] = useState("");
  const faixa = useRef(null);

  const carregar = useCallback(async (silencioso = false) => {
    try {
      const d = await obter(`/api/quadros/${id}`);
      setDados(d);
      setErro("");
      if (!silencioso && d.recorrenciasCriadas > 0) {
        setAviso(`${d.recorrenciasCriadas} tarefa(s) recorrente(s) entraram no quadro.`);
      }
    } catch (e) {
      setErro(e.message);
    }
  }, [id]);

  useEffect(() => { carregar(); }, [carregar]);

  // `?card=<id>` abre o card direto. É o que faz um link da Lisa — "você tem a proposta do
  // cliente vencendo hoje" — cair NO CARD, e não numa coluna com trinta outros para procurar
  // no meio. Roda uma vez, quando o quadro termina de carregar: antes disso o card ainda não
  // existe na tela, e depois seria roubar o foco de quem já está mexendo em outra coisa.
  const jaAbriuPelaURL = useRef(false);
  useEffect(() => {
    if (jaAbriuPelaURL.current || !dados) return;
    const pedido = parametros.get("card");
    if (!pedido) return;
    jaAbriuPelaURL.current = true;
    const existe = dados.quadro.colunas.some((c) => c.cards.some((k) => k.id === pedido));
    // Card arquivado, ou de outro quadro, ou id inventado: avisa em vez de não fazer nada.
    // Um link que simplesmente não abre nada parece um sistema quebrado.
    if (existe) setCardAberto(pedido);
    else setAviso("O card desse link não está neste quadro — pode ter sido arquivado ou movido.");
  }, [dados, parametros]);

  const quadro = dados ? new Quadro({ ...dados.quadro, colunas: dados.quadro.colunas }) : null;
  const poderes = dados?.poderes || { ver: false, editar: false, criar: false, apagar: false, convidar: false };

  /** Mexe no quadro que está na tela sem esperar o servidor. O arrastar precisa ser instantâneo;
   *  esperar a ida e volta faria o card voltar ao lugar antigo por um instante a cada solta. */
  function mexerNaTela(transformar) {
    setDados((d) => {
      if (!d) return d;
      const colunas = transformar(d.quadro.colunas.map((c) => ({ ...c, cards: [...c.cards] })));
      return { ...d, quadro: { ...d.quadro, colunas } };
    });
  }

  const aoSoltarCard = useCallback(async (cardId, colunaId, indice) => {
    let original = null;
    mexerNaTela((colunas) => {
      for (const col of colunas) {
        const i = col.cards.findIndex((c) => c.id === cardId);
        if (i >= 0) { original = { ...col.cards[i] }; col.cards.splice(i, 1); break; }
      }
      const destino = colunas.find((c) => c.id === colunaId);
      if (destino && original) destino.cards.splice(indice, 0, { ...original, colunaId });
      return colunas;
    });

    try {
      await mudar(`/api/cards/${cardId}`, { mover: { colunaId, indice } });
      // Recarrega em silêncio: as posições de verdade são as do servidor, que leu a coluna no
      // instante da solta. Sem isto, duas pessoas arrastando ao mesmo tempo veem ordens
      // diferentes até alguém recarregar a página na mão.
      carregar(true);
    } catch (e) {
      setErro(e.message);
      carregar(true);
    }
  }, [carregar]);

  const aoSoltarColuna = useCallback(async (colunaId, indice) => {
    const lista = dados?.quadro.colunas || [];
    const atual = lista.findIndex((c) => c.id === colunaId);
    if (atual < 0) return;
    const sem = lista.filter((c) => c.id !== colunaId);
    const antes = indice > 0 ? sem[indice - 1]?.posicao ?? null : null;
    const depois = sem[indice]?.posicao ?? null;
    const posicao = antes == null && depois == null ? 1024
      : antes == null ? depois - 1024
      : depois == null ? antes + 1024
      : (antes + depois) / 2;

    mexerNaTela((colunas) => {
      const i = colunas.findIndex((c) => c.id === colunaId);
      const [movida] = colunas.splice(i, 1);
      movida.posicao = posicao;
      colunas.splice(indice, 0, movida);
      return colunas;
    });

    try {
      await mudar(`/api/colunas/${colunaId}`, { posicao });
    } catch (e) {
      setErro(e.message);
      carregar(true);
    }
  }, [dados, carregar]);

  const { iniciar, arrasto, alvo } = useArrastar({ aoSoltarCard, aoSoltarColuna, refDoQuadro: faixa });

  /** Concluir sem abrir o card. Se a tarefa se repete, ela já volta com a data nova. */
  async function concluirCard(card, marcar) {
    // Otimista: o visto aparece no clique. Uma ida ao banco de casa leva uns 300ms, e nesse
    // tempo a pessoa clica de novo achando que não pegou.
    mexerNaTela((colunas) => {
      for (const col of colunas) {
        const i = col.cards.findIndex((c) => c.id === card.id);
        if (i >= 0) { col.cards[i] = { ...col.cards[i], concluido: marcar }; break; }
      }
      return colunas;
    });

    try {
      const r = await mudar(`/api/cards/${card.id}`, { concluido: marcar });
      if (r?.reprogramado) {
        const quando = new Date(r.reprogramado.fim_em).toLocaleDateString("pt-BR");
        setAviso(`"${card.titulo}" se repete — já reprogramada para ${quando}.`);
      }
      carregar(true);
    } catch (e) {
      setErro(e.message);
      carregar(true);
    }
  }

  async function criarCard(colunaId, titulo) {
    try {
      const d = await criar(`/api/colunas/${colunaId}/cards`, { titulo });
      mexerNaTela((colunas) => {
        colunas.find((c) => c.id === colunaId)?.cards.push(d.card);
        return colunas;
      });
    } catch (e) { setErro(e.message); }
  }

  const cardEmFoco = cardAberto
    ? quadro?.todosOsCards().find((c) => c.id === cardAberto)
    : null;

  // O card foi arquivado ou movido por outra pessoa enquanto estava aberto: fecha o painel em
  // vez de deixar uma caixa vazia na tela.
  useEffect(() => { if (cardAberto && dados && !cardEmFoco) setCardAberto(null); }, [cardAberto, dados, cardEmFoco]);

  if (erro && !dados) {
    return (
      <div className="abacato-vazio">
        <p className="abacato-vazio__titulo">Não deu para abrir este quadro</p>
        <p>{erro}</p>
        <p><Link href="/quadros" className="abacato-botao abacato-botao--fantasma">Voltar aos quadros</Link></p>
      </div>
    );
  }

  if (!dados) return <div className="abacato-vazio">carregando o quadro…</div>;

  const resumo = quadro.resumo();
  const arrastandoCard = arrasto?.tipo === "card"
    ? quadro.todosOsCards().find((c) => c.id === arrasto.id)
    : null;

  return (
    // `data-parede` existe porque o papel de parede chega como estilo em linha, e o CSS não tem
    // como saber que o fundo virou escuro. Sem este aviso, o nome do quadro continuaria escrito
    // em tinta escura sobre um gradiente escuro — some da tela sem nenhum erro aparecer.
    <div
      className="abacato-tela-do-quadro"
      data-parede={!dados.quadro.papelDeParede ? "nao" : urlDaParede(dados.quadro.papelDeParede) ? "imagem" : "sim"}
      style={dados.quadro.papelDeParede ? { background: dados.quadro.papelDeParede } : undefined}
    >
      <header className="abacato-quadro-topo">
        <div className="abacato-quadro-topo__esquerda">
          <Link href="/quadros" className="abacato-icone" aria-label="voltar aos quadros">←</Link>
          <input
            className="abacato-quadro-topo__nome"
            defaultValue={dados.quadro.nome}
            disabled={!poderes.editar}
            onBlur={(e) => {
              const t = e.target.value.trim();
              if (t && t !== dados.quadro.nome) mudar(`/api/quadros/${id}`, { nome: t }).then(() => carregar(true)).catch((x) => setErro(x.message));
            }}
            onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
          />
        </div>

        <div className="abacato-quadro-topo__direita">
          <span className="abacato-conta-pill" title="cards no quadro">{resumo.total} cards</span>
          {resumo.porPrazo.atrasado > 0 && (
            <span className="abacato-conta-pill abacato-conta-pill--alerta" title="cards com a entrega vencida">
              {resumo.porPrazo.atrasado} atrasado(s)
            </span>
          )}
          {resumo.porPrazo.hoje > 0 && (
            <span className="abacato-conta-pill abacato-conta-pill--atencao">{resumo.porPrazo.hoje} para hoje</span>
          )}
          {poderes.criar && (
            <button type="button" className="abacato-botao abacato-botao--fantasma abacato-botao--pequeno" onClick={() => setRecorrencias(true)}>
              ↻ Recorrentes
            </button>
          )}
          {poderes.editar && (
            <div className="abacato-menu">
              <button type="button" className="abacato-icone" onClick={() => setMenuDoQuadro((m) => !m)} aria-label="opções do quadro">⋯</button>
              {menuDoQuadro && (
                <>
                  <div className="abacato-menu__fundo" onClick={() => setMenuDoQuadro(false)} />
                  <div className="abacato-menu__caixa abacato-menu__caixa--direita" role="menu">
                    <button type="button" className="abacato-menu__item"
                      onClick={() => { setMenuDoQuadro(false); setArquivadas(true); }}>
                      Colunas arquivadas
                    </button>
                    <button type="button" className="abacato-menu__item"
                      onClick={() => { setMenuDoQuadro(false); setParede(true); }}>
                      Papel de parede
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {aviso && (
        <div className="abacato-aviso" role="status">
          ↻ {aviso}
          <button type="button" className="abacato-icone" onClick={() => setAviso("")} aria-label="dispensar">✕</button>
        </div>
      )}
      {erro && <div className="abacato-campo__erro abacato-campo__erro--flutuante">⚠ {erro}</div>}

      <div className="abacato-faixa" ref={faixa}>
        {quadro.colunas.map((coluna) => (
          <Coluna
            key={coluna.id}
            coluna={coluna}
            alvo={alvo}
            arrasto={arrasto}
            poderes={poderes}
            aoAbrirCard={setCardAberto}
            aoIniciarArrasto={iniciar}
            aoConcluirCard={concluirCard}
            aoCriarCard={criarCard}
            aoRenomear={(colunaId, nome) => mudar(`/api/colunas/${colunaId}`, { nome }).then(() => carregar(true)).catch((e) => setErro(e.message))}
            aoMudarCapa={(colunaId, capa) => mudar(`/api/colunas/${colunaId}`, { capa }).then(() => carregar(true)).catch((e) => setErro(e.message))}
            aoArquivar={(colunaId) => remover(`/api/colunas/${colunaId}`).then(() => carregar(true)).catch((e) => setErro(e.message))}
          />
        ))}

        {poderes.criar && (
          <div className="abacato-coluna abacato-coluna--nova">
            {novaColuna ? (
              <input
                className="abacato-coluna__nome-campo"
                placeholder="Nome da coluna"
                autoFocus
                onBlur={() => setNovaColuna(false)}
                onKeyDown={async (e) => {
                  if (e.key === "Escape") setNovaColuna(false);
                  if (e.key !== "Enter") return;
                  const nome = e.target.value.trim();
                  if (!nome) return setNovaColuna(false);
                  e.target.value = "";
                  try { await criar(`/api/quadros/${id}/colunas`, { nome }); await carregar(true); }
                  catch (x) { setErro(x.message); }
                }}
              />
            ) : (
              <button type="button" className="abacato-coluna__adicionar" onClick={() => setNovaColuna(true)}>
                + Adicionar coluna
              </button>
            )}
          </div>
        )}
      </div>

      {/* O card que está sendo arrastado, desenhado solto sob o ponteiro. Fica fora da coluna
          de propósito: dentro dela, o `overflow` da coluna cortaria o card na borda. */}
      {arrasto && arrastandoCard && (
        <div
          className="abacato-fantasma"
          style={{ left: arrasto.x - arrasto.dx, top: arrasto.y - arrasto.dy, width: arrasto.largura }}
        >
          <CardMini dados={arrastandoCard} />
        </div>
      )}

      {cardEmFoco && (
        <PainelDoCard
          card={cardEmFoco}
          quadro={dados.quadro}
          poderes={poderes}
          aoFechar={() => setCardAberto(null)}
          aoMudar={() => setDados((d) => ({ ...d }))}
          aoRecarregar={() => carregar(true)}
        />
      )}

      {compartilhar && (
        <Compartilhar tipo="quadro" id={id} nome={dados.quadro.nome} aoFechar={() => setCompartilhar(false)} />
      )}

      {parede && (
        <PapelDeParede
          quadroId={id}
          atual={dados.quadro.papelDeParede}
          aoFechar={() => setParede(false)}
          aoMudar={() => carregar(true)}
        />
      )}

      {arquivadas && (
        <ColunasArquivadas
          quadroId={id}
          poderes={poderes}
          aoFechar={() => setArquivadas(false)}
          aoMudar={() => carregar(true)}
        />
      )}

      {recorrencias && (
        <PainelDeRecorrencias
          quadroId={id}
          colunas={quadro.colunas}
          poderes={poderes}
          aoFechar={() => setRecorrencias(false)}
          aoMudar={() => carregar(true)}
        />
      )}
    </div>
  );
}
