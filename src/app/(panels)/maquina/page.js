"use client";

import { useEffect, useRef, useState } from "react";
import { CY, OR, GR, mono } from "@/lib/theme.js";

// O endereço do noVNC. Não é rota do Next: quem serve é o websockify, e quem roteia é o
// Caddy (ver servidor/montar-https-casa.sh). Por isso ele só existe no modo casa — na
// Cloudflare este caminho não leva a lugar nenhum, e o painel nem aparece no menu.
//
// O `path=` é RELATIVO À PASTA DA PÁGINA, não à raiz do site. Como a página vive em /tela/,
// `path=websockify` vira /tela/websockify — que é justamente o que o Caddy roteia (e onde ele
// tira o /tela da frente antes de repassar).
//
// Escrever `path=tela/websockify` parece mais explícito e é o erro: dá /tela/tela/websockify,
// e o sintoma no navegador é só "Falha ao conectar-se ao servidor" — a página carrega inteira,
// o WebSocket é que leva 502.
const TELA = "/tela/vnc.html?path=websockify&resize=scale&reconnect=1&show_dot=1";

const MODO_CASA = process.env.NEXT_PUBLIC_MODO_CASA === "1";

function Aviso({ cor, titulo, children }) {
  return (
    <div style={{ border: `1px solid ${cor}55`, background: `${cor}0f`, borderRadius: 8, padding: "14px 16px" }}>
      <div style={{ ...mono, fontSize: 11, letterSpacing: 1.5, color: cor, marginBottom: 6 }}>{titulo}</div>
      <div style={{ fontSize: 13, lineHeight: 1.65, color: "rgba(207,239,251,0.8)" }}>{children}</div>
    </div>
  );
}

/**
 * A tela do iMac, dentro da Lisa.
 *
 * Isto não é um cliente VNC escrito aqui — é o noVNC, num iframe. Capturar tela e injetar
 * teclado e mouse com desempenho aceitável é problema resolvido há duas décadas; refazer
 * daria algo pior em tudo. O que a Lisa acrescenta é o enquadramento: mesmo endereço, mesmo
 * login, mesmo cadeado.
 */
export default function MaquinaPage() {
  const [estado, setEstado] = useState("checando"); // checando | pronto | ausente
  const [cheia, setCheia] = useState(false);
  const quadro = useRef(null);

  // Antes de mostrar o iframe, confere se o noVNC está mesmo no ar. Sem isso, um x11vnc
  // parado daria uma moldura preta e vazia — que parece a tela do iMac desligada, e não é.
  useEffect(() => {
    if (!MODO_CASA) return setEstado("ausente");
    let vivo = true;
    fetch("/tela/vnc.html", { method: "HEAD", cache: "no-store" })
      .then((r) => vivo && setEstado(r.ok ? "pronto" : "ausente"))
      .catch(() => vivo && setEstado("ausente"));
    return () => { vivo = false; };
  }, []);

  // Sair da tela cheia pelo Esc — dentro do iframe o Esc pertence ao iMac, então o atalho
  // precisa viver aqui fora.
  useEffect(() => {
    if (!cheia) return;
    const aoTeclar = (e) => e.key === "Escape" && setCheia(false);
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [cheia]);

  return (
    <div style={{ padding: cheia ? 0 : "22px 26px", display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
      {!cheia && (
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
          <h1 style={{ ...mono, fontSize: 18, letterSpacing: 3, color: CY, margin: 0 }}>TELA DO SERVIDOR</h1>
          <span style={{ fontSize: 12, color: "rgba(207,239,251,0.5)" }}>
            teclado e mouse do iMac, de dentro da Lisa
          </span>
        </div>
      )}

      {estado === "checando" && !cheia && (
        <div style={{ ...mono, fontSize: 12, color: "rgba(207,239,251,0.5)" }}>procurando a tela…</div>
      )}

      {estado === "ausente" && (
        <Aviso cor={OR} titulo="A TELA NÃO ESTÁ NO AR">
          {MODO_CASA ? (
            <>
              A Lisa está no modo casa, mas o noVNC não respondeu. No iMac, rode{" "}
              <code style={{ ...mono, color: CY }}>~/montar-tela.sh</code> e recarregue esta página.
            </>
          ) : (
            <>
              Este painel só funciona na Lisa de casa (<code style={{ ...mono, color: CY }}>casa.beyond.dev.br</code>),
              porque quem serve a tela é o próprio iMac. Pela Cloudflare não há máquina do outro lado.
            </>
          )}
        </Aviso>
      )}

      {estado === "pronto" && (
        <>
          {!cheia && (
            <Aviso cor={GR} titulo="DUAS TRAVAS">
              O endereço já exigiu o login da Lisa. O noVNC vai pedir uma segunda senha, que é só
              dele — está no iMac, em <code style={{ ...mono, color: CY }}>~/.senha-tela</code>. O
              x11vnc escuta apenas em <code style={{ ...mono, color: CY }}>localhost</code>: nenhum
              outro aparelho da rede alcança a porta 5900 direto.
            </Aviso>
          )}

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              onClick={() => setCheia((v) => !v)}
              style={{ ...mono, fontSize: 11, letterSpacing: 1.5, padding: "7px 14px", cursor: "pointer",
                       background: "transparent", color: CY, border: `1px solid ${CY}66`, borderRadius: 6 }}
            >
              {cheia ? "SAIR DA TELA CHEIA (ESC)" : "TELA CHEIA"}
            </button>
            <button
              onClick={() => { if (quadro.current) quadro.current.src = TELA; }}
              style={{ ...mono, fontSize: 11, letterSpacing: 1.5, padding: "7px 14px", cursor: "pointer",
                       background: "transparent", color: "rgba(207,239,251,0.7)",
                       border: "1px solid rgba(207,239,251,0.25)", borderRadius: 6 }}
            >
              RECONECTAR
            </button>
          </div>

          <iframe
            ref={quadro}
            src={TELA}
            title="Tela do iMac"
            // O iframe precisa de teclado, foco e clipboard para servir de terminal de verdade.
            // É conteúdo da mesma origem, servido pelo mesmo Caddy atrás do mesmo login — não
            // há terceiro aqui de quem se defender com sandbox.
            allow="clipboard-read; clipboard-write; fullscreen"
            style={{ flex: 1, minHeight: cheia ? "100vh" : 460, width: "100%", border: cheia ? "none" : `1px solid ${CY}33`,
                     borderRadius: cheia ? 0 : 8, background: "#000" }}
          />
        </>
      )}
    </div>
  );
}
