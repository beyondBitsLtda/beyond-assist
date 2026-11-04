"use client";

// "O que há de novo": um modal caprichado que aparece assim que a pessoa entra no Proof (pedido de 22/10/2026).
// Desde 05/11/2026 ele é uma sequência de banners ("ponha esses banners para serem exibidos logo depois do anúncio
// do banner da 1.0"): a 1.0, o Bootcamp e as Grandes Expedições, um depois do outro. Cada banner visto fica
// guardado neste navegador — quem já tinha visto a 1.0 vê só os novos; em outro aparelho, aparecem de novo uma vez,
// o que não faz mal. Enquanto ele está aberto, o aviso de vale espera (os dois juntos brigavam pela tela).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

/** Os banners, na ordem em que aparecem. `imagem`: o nome em /public/novidades (a versão -900 é a do celular). */
export const BANNERS_DAS_NOVIDADES = [
  {
    id: "versao-1",
    imagem: "lisa-proof-1-0",
    alt: "Lisa Proof 1.0 — agora ainda mais completo para suas necessidades! A Lisa, de óculos e prancheta, apresenta a versão nova.",
    titulo: "Bem-vindo ao Lisa Proof 1.0",
    texto: "O seu lugar para estudar todo dia: a Lisa monta as trilhas, você pratica com quiz, exercícios e minigames, e cada ponto vira moeda para construir o seu reino — agora com visual novo e as ilhas para conquistar.",
    link: { href: "/reino", rotulo: "Ver o meu reino" },
  },
  {
    id: "bootcamp",
    imagem: "bootcamp-desafio",
    alt: "Bootcamp — código, criatividade e grandes desafios! A Lisa, de chef de cozinha, apresenta o reality de programação, com os competidores nas bancadas.",
    titulo: "Chegou o Bootcamp",
    texto: "O reality show de programação do Proof: temporadas com provas de imunidade, em equipe e de eliminação, três jurados fazendo code review ao vivo e a grande final numa arena com torcida. Mostre o seu código e conquiste a vaga na próxima fase.",
    link: { href: "/bootcamp", rotulo: "Entrar no Bootcamp" },
  },
  {
    id: "grandes-expedicoes",
    imagem: "grandes-expedicoes",
    alt: "Prepare-se para as Grandes Expedições! A Lisa, de capitã pirata no leme do navio, aponta para a ilha da caveira.",
    titulo: "Prepare-se para as Grandes Expedições",
    texto: "Monte o seu exército, zarpe para as ilhas e enfrente os guardas de cada uma: as Grandes Expedições do reino estão à sua espera, com tesouros para quem conquistar.",
    link: { href: "/reino#grandes-expedicoes", rotulo: "Ver as expedições" },
  },
];

// a edição antiga (um banner só): quem a viu já viu a 1.0
const EDICAO_ANTIGA = "2026-11-03-versao-1-grande";
const CHAVE_ANTIGA = "proof-novidades-vistas";
const CHAVE = "proof-novidades-banners-vistos";
/** (para quem importa) a edição de agora: muda quando entra um banner novo */
export const EDICAO_DAS_NOVIDADES = `2026-11-05-${BANNERS_DAS_NOVIDADES.map((b) => b.id).join("+")}`;

function bannersVistos() {
  try {
    const vistos = new Set(JSON.parse(localStorage.getItem(CHAVE) || "[]"));
    if (localStorage.getItem(CHAVE_ANTIGA) === EDICAO_ANTIGA) vistos.add("versao-1");
    return vistos;
  } catch {
    return null;
  }
}

/** Os banners que ainda faltam ver neste navegador (sem armazenamento: nenhum, para não aparecer toda vez). */
function bannersPendentes() {
  const vistos = bannersVistos();
  return vistos ? BANNERS_DAS_NOVIDADES.filter((b) => !vistos.has(b.id)) : [];
}

/** Ainda há novidade para mostrar neste navegador? */
export function novidadesPendentes() {
  return bannersPendentes().length > 0;
}

function marcarComoVistos(ids) {
  try {
    const vistos = bannersVistos() || new Set();
    for (const id of ids) vistos.add(id);
    localStorage.setItem(CHAVE, JSON.stringify([...vistos]));
  } catch { /* sem armazenamento: aparece de novo na próxima visita */ }
  window.dispatchEvent(new CustomEvent("proof-novidades-fechou"));
}

export default function Novidades() {
  const [fila, setFila] = useState(null); // os banners desta visita (os que faltavam ver)
  const [indice, setIndice] = useState(0);
  const principal = useRef(null);

  useEffect(() => {
    const pendentes = bannersPendentes();
    if (!pendentes.length) return undefined;
    const t = setTimeout(() => setFila(pendentes), 500);
    return () => clearTimeout(t);
  }, []);

  // fechar (o X, o Esc, o fundo ou um link) marca a fila inteira como vista: a pessoa escolheu sair
  const fechar = useCallback(() => {
    if (fila) marcarComoVistos(fila.map((b) => b.id));
    setFila(null);
  }, [fila]);
  const ultimo = fila ? indice >= fila.length - 1 : true;
  const proximo = useCallback(() => { if (ultimo) fechar(); else setIndice((i) => i + 1); }, [ultimo, fechar]);

  useEffect(() => {
    if (!fila) return undefined;
    // foco no botão sem rolar: no celular, rolar até ele escondia o banner
    const t = setTimeout(() => principal.current?.focus({ preventScroll: true }), 250);
    const tecla = (e) => {
      if (e.key === "Escape") fechar();
      if (e.key === "ArrowRight" && !ultimo) setIndice((i) => i + 1);
      if (e.key === "ArrowLeft") setIndice((i) => Math.max(0, i - 1));
    };
    document.addEventListener("keydown", tecla);
    return () => { clearTimeout(t); document.removeEventListener("keydown", tecla); };
  }, [fila, fechar, ultimo, indice]);

  const banner = useMemo(() => fila?.[indice] || null, [fila, indice]);
  if (!fila || !banner) return null;

  return (
    <div className="novidades" role="dialog" aria-modal="true" aria-labelledby="novidades-titulo"
      onClick={(e) => { if (e.target === e.currentTarget) fechar(); }}>
      <div className="novidades__caixa">
        <button type="button" className="novidades__fechar" onClick={fechar} aria-label="Fechar as novidades">✕</button>
        {/* a chave troca a cada banner: a imagem e o texto entram de novo, com a transição */}
        <div className="novidades__slide" key={banner.id}>
          <picture className="novidades__banner">
            <source media="(min-width: 700px)" srcSet={`/novidades/${banner.imagem}.webp`} />
            <img src={`/novidades/${banner.imagem}-900.webp`} width={1672} height={941} decoding="async" alt={banner.alt} />
          </picture>
          <div className="novidades__corpo novidades__corpo--curto">
            <div className="novidades__texto">
              <h2 id="novidades-titulo" className="novidades__titulo">{banner.titulo}</h2>
              <p className="novidades__sub">{banner.texto}</p>
            </div>
            <div className="novidades__acoes">
              <button ref={principal} type="button" className="pf-botao novidades__principal" onClick={proximo}>
                {ultimo ? "Vamos lá!" : "Próximo →"}
              </button>
              <Link href={banner.link.href} className="pf-botao pf-botao--sec" onClick={fechar}>{banner.link.rotulo}</Link>
            </div>
          </div>
        </div>
        {fila.length > 1 && (
          <div className="novidades__pontos" role="tablist" aria-label="As novidades">
            {fila.map((b, i) => (
              <button key={b.id} type="button" role="tab" aria-selected={i === indice} aria-label={b.titulo}
                className={`novidades__ponto${i === indice ? " novidades__ponto--atual" : ""}`} onClick={() => setIndice(i)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
