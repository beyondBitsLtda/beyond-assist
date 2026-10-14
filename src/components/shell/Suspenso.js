"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";

/**
 * Menu suspenso discreto — o mesmo em todo o app (Painéis, status, Modos, ajustes, escopo).
 *
 * `rotulo` é o conteúdo do botão; `children` é o miolo do menu (use <GrupoDoMenu>, <ItemDoMenu>,
 * <ChaveDoMenu>). Fecha clicando fora, com Escape, ou quando um item chama `fechar()` (pelo
 * contexto). `lado` alinha o painel à direita ou à esquerda do botão; `paraCima` abre acima
 * (usado no campo de mensagem, que fica no pé da tela).
 */
const ContextoDoSuspenso = createContext({ fechar: () => {} });
export const useSuspenso = () => useContext(ContextoDoSuspenso);

export default function Suspenso({
  rotulo, titulo, children, lado = "direita", paraCima = false, largura = 280,
  classeDoBotao = "bb-menu-botao", estiloDoBotao, aberto: abertoControlado, aoMudar,
}) {
  const [abertoInterno, setAbertoInterno] = useState(false);
  const aberto = abertoControlado ?? abertoInterno;
  const mudar = useCallback((v) => { setAbertoInterno(v); aoMudar?.(v); }, [aoMudar]);
  const raiz = useRef(null);
  const id = useId();

  useEffect(() => {
    if (!aberto) return;
    const fora = (e) => { if (raiz.current && !raiz.current.contains(e.target)) mudar(false); };
    const tecla = (e) => { if (e.key === "Escape") mudar(false); };
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto, mudar]);

  return (
    <div ref={raiz} style={{ position: "relative", flex: "none" }}>
      <button
        type="button"
        className={classeDoBotao}
        style={estiloDoBotao}
        aria-expanded={aberto}
        aria-controls={id}
        aria-label={titulo}
        title={titulo}
        onClick={() => mudar(!aberto)}
      >
        {rotulo}
      </button>
      {aberto && (
        <div
          id={id}
          className="bb-suspenso"
          style={{
            width: largura,
            [lado === "direita" ? "right" : "left"]: 0,
            ...(paraCima ? { bottom: "calc(100% + 8px)" } : { top: "calc(100% + 6px)" }),
          }}
        >
          <ContextoDoSuspenso.Provider value={{ fechar: () => mudar(false) }}>{children}</ContextoDoSuspenso.Provider>
        </div>
      )}
    </div>
  );
}

export function GrupoDoMenu({ titulo, children }) {
  return (
    <div className="bb-grupo">
      {titulo && <div className="bb-grupo-titulo">{titulo}</div>}
      {children}
    </div>
  );
}

/** Item clicável. `atual` marca com um ponto; `detalhe` é a linha pequena de baixo. */
export function ItemDoMenu({ children, detalhe, atual = false, onClick, disabled, title, fecharAoClicar = true }) {
  const { fechar } = useSuspenso();
  return (
    <button
      type="button"
      className={`bb-item${atual ? " bb-item--atual" : ""}`}
      disabled={disabled}
      title={title}
      onClick={(e) => { onClick?.(e); if (fecharAoClicar) fechar(); }}
    >
      <span className="bb-item-texto">{children}{detalhe && <small>{detalhe}</small>}</span>
    </button>
  );
}

/** Liga/desliga. Não fecha o menu: costuma-se ligar mais de um modo de uma vez. */
export function ChaveDoMenu({ children, detalhe, ligado, onChange, disabled, title, cor }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!ligado}
      className="bb-item"
      disabled={disabled}
      title={title}
      onClick={() => onChange?.(!ligado)}
    >
      <span className="bb-item-texto">{children}{detalhe && <small>{detalhe}</small>}</span>
      <i className="bb-chave" style={cor && ligado ? { "--bb-chave-cor": cor } : undefined} />
    </button>
  );
}

/** Escolha entre poucas opções, em pílulas. */
export function SegmentosDoMenu({ opcoes, valor, onChange, rotulo }) {
  return (
    <div className="bb-segmentos" role="group" aria-label={rotulo}>
      {opcoes.map((o) => (
        <button key={o.valor} type="button" aria-pressed={valor === o.valor} onClick={() => onChange(o.valor)} title={o.titulo}>
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

/** Item que navega para outro painel. */
export function LinkDoMenu({ href, children, detalhe, atual = false }) {
  const { fechar } = useSuspenso();
  return (
    <Link href={href} className={`bb-item${atual ? " bb-item--atual" : ""}`} onClick={fechar} aria-current={atual ? "page" : undefined}>
      <span className="bb-item-texto">{children}{detalhe && <small>{detalhe}</small>}</span>
    </Link>
  );
}
