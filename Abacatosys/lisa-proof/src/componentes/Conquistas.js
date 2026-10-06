"use client";

import { formatarDia } from "@/dominio/datas.js";
import { Barra } from "./Pecas.js";

/** A vitrine de conquistas da conta: medalhas por categoria, com progresso nas que faltam. */
export default function Conquistas({ lista, pontos }) {
  const desbloqueadas = lista.filter((c) => c.desbloqueada).length;
  const categorias = [...new Set(lista.map((c) => c.categoria))];

  return (
    <section className="pf-secao">
      <h2 className="pf-secao__titulo">
        Conquistas
        <small>{desbloqueadas} de {lista.length} · {pontos} pts em conquistas</small>
      </h2>
      <div className="pf-cartao conquistas">
        {categorias.map((cat) => (
          <div key={cat} className="conquistas__grupo">
            <p className="pf-campo__rotulo">{cat}</p>
            <ul className="conquistas__grade">
              {lista.filter((c) => c.categoria === cat).map((c) => (
                <li key={c.codigo} className={`conquista${c.desbloqueada ? " conquista--ok" : ""}`} title={c.descricao}>
                  <span className="conquista__medalha" aria-hidden="true">{c.icone}</span>
                  <strong className="conquista__nome">{c.nome}</strong>
                  <small className="conquista__descricao">{c.descricao}</small>
                  {c.desbloqueada ? (
                    <small className="conquista__quando">+{c.pontos} pts · {formatarDia(c.dia)}</small>
                  ) : (
                    <>
                      <Barra valor={c.atual} total={c.alvo} rotulo={`Progresso de ${c.nome}`} />
                      <small className="conquista__quando">{c.atual}/{c.alvo} · vale {c.pontos} pts</small>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
