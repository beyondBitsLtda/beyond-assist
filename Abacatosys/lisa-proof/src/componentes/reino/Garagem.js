"use client";

import { Moedas, Botao } from "./pecas.js";
import { urlDoVeiculo } from "./veiculosDePapel.js";

/** O tanque de hoje: um tracinho por carga (cheio = ainda tem). */
export function Tanque({ tanque, compacto = false }) {
  return (
    <span className={`rn-tanque${compacto ? " rn-tanque--compacto" : ""}`} role="img"
      aria-label={`combustível: ${tanque.restantes} de ${tanque.cargas} expedições hoje`}>
      <span aria-hidden="true">⛽</span>
      {Array.from({ length: tanque.cargas }, (_, i) => <span key={i} className={i < tanque.restantes ? "rn-tanque__carga rn-tanque__carga--cheia" : "rn-tanque__carga"} aria-hidden="true" />)}
      <small>{tanque.restantes}/{tanque.cargas}</small>
    </span>
  );
}

/**
 * A garagem: os veículos do reino. Cada um leva a um tipo de expedição e tem o seu tanque — 3
 * expedições por dia, e mais se abastecer (com o tanque vazio).
 */
export default function Garagem({ garagem, ocupado, aoComprar, aoAbastecer, aoVerExpedicoes }) {
  if (!garagem) return null;
  return (
    <section className="pf-secao" id="garagem">
      <h2 className="pf-secao__titulo">🚗 Garagem <small>cada veículo leva a um tipo de expedição · ⛽ 3 por dia cada</small></h2>
      <div className="rn-garagem">
        {garagem.map((v) => (
          <article key={v.id} className={`pf-cartao rn-veiculo${v.tem ? " rn-veiculo--meu" : ""}`}>
            <img className="rn-veiculo__arte" src={urlDoVeiculo(v.id)} alt="" width="96" height="96" />
            <div className="rn-veiculo__info">
              <h3>{v.emoji} {v.nome}</h3>
              <span className="rn-veiculo__destino">{v.destino}</span>
              <p className="pf-estat__nota">{v.descricao}</p>
              {v.tem ? (
                <div className="rn-veiculo__rodape">
                  <Tanque tanque={v.tanque} />
                  {v.tanque.restantes > 0 ? (
                    <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={() => aoVerExpedicoes(v.id)}>🗺️ Expedições</button>
                  ) : (
                    <Botao ok={v.abastecer?.ok} motivo={v.abastecer?.motivo} ocupado={ocupado === `abastecer:${v.id}`} aoClicar={() => aoAbastecer(v)}>
                      ⛽ Abastecer +1 · <Moedas n={v.abastecer?.custo} />
                    </Botao>
                  )}
                </div>
              ) : (
                <div className="rn-veiculo__rodape">
                  <span className="pf-pilula">Torre {v.torreMinima}+</span>
                  <Botao ok={v.pode} motivo={v.motivo} ocupado={ocupado === `veiculo:${v.id}`} aoClicar={() => aoComprar(v)}>
                    Comprar · <Moedas n={v.preco} />
                  </Botao>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
