"use client";

// O Chefão da Procrastinação no Reino (03/11/2026): tocar no monstro gigante do mundo 3D (Mundo3D.js) abre esta
// folha — a vida que resta, de onde vieram os golpes, a recompensa e os atalhos para bater nele (Prática,
// Cadernos, Cartões). As regras moram em src/dominio/chefoes.js.

import Link from "next/link";
import Folha from "@/componentes/Folha.js";
import { urlDoMonstro } from "@/componentes/reino/monstrosDePapel.js";
import { DANO_POR_PAGINA, HORAS_ATE_O_PROXIMO } from "@/dominio/chefoes.js";

const quando = (iso) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function ChefaoDoReino({ aberta, aoFechar, estado }) {
  const c = estado?.chefao || null;
  const caiu = estado?.caiuAgora || null;
  return (
    <Folha aberta={aberta} aoFechar={aoFechar} titulo="👹 Chefão da Procrastinação">
      {!estado && <p className="pf-estat__nota">Procurando o chefão…</p>}
      {caiu && (
        <div className="pf-aviso pf-aviso--ok ch-caiu" role="status">
          🎉 Você derrubou {caiu.emoji} <strong>{caiu.nome}</strong>! +🪙 {caiu.recompensa} no seu saldo.
        </div>
      )}
      {estado && !c && (
        <p className="pf-estat__nota">
          {estado.descansoAte
            ? `Nenhum chefão de pé. O próximo só pode nascer depois de ${quando(estado.descansoAte)} (${HORAS_ATE_O_PROXIMO} h de descanso depois de cada vitória).`
            : "Nenhum chefão por aqui: o estudo está em dia. Ele nasce quando assuntos da trilha ou revisões de cartões ficam atrasados."}
        </p>
      )}
      {c && (
        <div className="ch-chefao">
          <img className="ch-chefao__arte" src={urlDoMonstro(c.monstro)} alt="" width={140} height={140} />
          <div className="ch-chefao__texto">
            <h3 className="ch-chefao__nome">{c.emoji} {c.nome}</h3>
            <div className="ch-chefao__vida" role="progressbar" aria-label="Vida do chefão" aria-valuemin={0} aria-valuemax={c.vida} aria-valuenow={c.restante}>
              <span style={{ width: `${Math.round(c.parte * 100)}%` }} />
            </div>
            <p className="pf-estat__nota">❤️ {c.restante} de {c.vida} · já levou {c.dano} de dano · derrubou, ganha 🪙 {c.recompensa}</p>
            <p className="pf-estat__nota">Nasceu em {quando(c.nasceuEm)} do seu atraso (peso {c.atraso}: cada assunto atrasado vale 3; cada revisão vencida, 1).</p>
          </div>
          <div className="ch-chefao__golpes">
            <h4>Como bater nele</h4>
            <ul>
              <li><strong>Prática</strong> (quiz, exercício, projeto) e o <strong>diário de estudo</strong>: cada ponto vale 2 de dano.</li>
              <li><strong>Cadernos</strong>: cada página escrita ou editada vale {DANO_POR_PAGINA} (até metade da vida dele).</li>
              <li>Teoria, tarefas e revisões de cartões: cada ponto vale 1.</li>
            </ul>
            <p className="pf-estat__nota">Golpes até agora: {c.golpes.estudos} dos estudos · {c.golpes.cadernos} dos Cadernos.</p>
            <div className="ch-chefao__atalhos">
              <Link className="pf-botao" href="/pratica">⚔️ Ir para a Prática</Link>
              <Link className="pf-botao pf-botao--sec" href="/cadernos">📓 Cadernos</Link>
              <Link className="pf-botao pf-botao--sec" href="/cartoes">🃏 Cartões de revisão</Link>
            </div>
          </div>
        </div>
      )}
      {estado && <p className="pf-estat__nota ch-placar">Chefões derrubados até hoje: {estado.derrotados || 0}</p>}
    </Folha>
  );
}
