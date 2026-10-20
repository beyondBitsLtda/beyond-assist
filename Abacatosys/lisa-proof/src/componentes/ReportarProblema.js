"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Folha from "./Folha.js";
import { reagir } from "./Neuro.js";

const LARGURA_MAXIMA = 1600; // o print é reduzido antes de subir: legível, e leve no celular

/**
 * "Reportar problema": uma ouvidoria dentro do app. A pessoa conta o que aconteceu, junta um
 * print (capturando a tela, anexando ou colando com Ctrl+V) e manda — vira um chamado para quem
 * administra o Proof, como card no Abacato (ver src/lib/chamados.js).
 *
 * Junto vão, sem a pessoa precisar escrever: a tela em que ela estava, o navegador, o tamanho da
 * janela, o tema e o horário. É o que mais falta quando alguém diz "deu erro".
 */
export default function ReportarProblema({ className = "", comTexto = true }) {
  const caminho = usePathname() || "/";
  const [aberta, setAberta] = useState(false);
  const [capturando, setCapturando] = useState(false);
  const [texto, setTexto] = useState("");
  const [print, setPrint] = useState(null); // { blob, url }
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [enviado, setEnviado] = useState(null); // null, ou { comPrint }
  const arquivo = useRef(null);
  const podeCapturar = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getDisplayMedia);

  const trocarPrint = useCallback((novo) => {
    setPrint((antigo) => { if (antigo?.url) URL.revokeObjectURL(antigo.url); return novo; });
  }, []);
  useEffect(() => () => trocarPrint(null), [trocarPrint]);

  function abrir() {
    setErro("");
    setEnviado(null);
    setAberta(true);
  }
  const fechar = useCallback(() => setAberta(false), []);

  async function guardarImagem(origem) {
    setErro("");
    try {
      const blob = await reduzir(origem);
      trocarPrint({ blob, url: URL.createObjectURL(blob) });
    } catch (e) {
      setErro(e.message || "não consegui usar essa imagem");
    }
  }

  async function capturar() {
    setErro("");
    setCapturando(true); // a janela some para não sair no próprio print
    await new Promise((r) => setTimeout(r, 250));
    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: false,
        preferCurrentTab: true,
        selfBrowserSurface: "include",
      });
      const video = document.createElement("video");
      video.muted = true;
      video.srcObject = stream;
      await video.play();
      await new Promise((r) => setTimeout(r, 350)); // o primeiro quadro às vezes chega preto
      const tela = document.createElement("canvas");
      tela.width = video.videoWidth;
      tela.height = video.videoHeight;
      tela.getContext("2d").drawImage(video, 0, 0);
      await guardarImagem(tela);
    } catch (e) {
      if (e?.name !== "NotAllowedError") setErro("não deu para capturar a tela — anexe um print pelo botão ao lado");
    } finally {
      stream?.getTracks().forEach((t) => t.stop());
      setCapturando(false);
    }
  }

  function colar(e) {
    const imagem = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith("image/"));
    if (!imagem) return;
    e.preventDefault();
    guardarImagem(imagem);
  }

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    setErro("");
    try {
      const corpo = new FormData();
      corpo.set("texto", texto);
      corpo.set("pagina", caminho);
      corpo.set("contexto", JSON.stringify({
        navegador: navigator.userAgent,
        tela: `${window.innerWidth}×${window.innerHeight}`,
        tema: document.documentElement.dataset.tema || "",
        idioma: navigator.language || "",
      }));
      if (print) corpo.set("imagem", print.blob, "print.jpg");
      const res = await fetch("/api/chamados", { method: "POST", body: corpo });
      const dados = await res.json().catch(() => ({}));
      if (!res.ok || dados.ok === false) throw new Error(dados.error || `falha ${res.status}`);
      setEnviado({ comPrint: Boolean(print) });
      setTexto("");
      trocarPrint(null);
      reagir("feliz", "Valeu por avisar! Já mandei para a equipe.", 5000);
    } catch (falha) {
      setErro(falha.message === "Failed to fetch" ? "sem resposta do servidor — tente de novo em instantes" : falha.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <button type="button" className={`pf-reportar ${className}`} onClick={abrir} title="Reportar um problema" aria-label="Reportar um problema">
        <span aria-hidden="true">🐞</span>
        {comTexto && <span>Reportar problema</span>}
      </button>

      <Folha aberta={aberta && !capturando} aoFechar={fechar} titulo="Reportar problema">
        {enviado ? (
          <div className="pf-reporte">
            <h2 className="pf-reporte__titulo">Recebido! 🐞</h2>
            <p>Seu relato virou um chamado para a equipe, com a tela em que você estava{enviado.comPrint ? " e o print" : ""}. Obrigado por avisar.</p>
            <div className="pf-acoes">
              <button type="button" className="pf-botao" onClick={fechar}>Fechar</button>
              <button type="button" className="pf-botao pf-botao--sec" onClick={() => setEnviado(null)}>Reportar outra coisa</button>
            </div>
          </div>
        ) : (
          <form className="pf-reporte" onSubmit={enviar} onPaste={colar}>
            <h2 className="pf-reporte__titulo">Reportar problema</h2>
            <p className="pf-reporte__dica">Conte o que você estava fazendo e o que deu errado. Um print ajuda muito.</p>

            <label className="pf-campo">
              <span className="pf-campo__rotulo">O que aconteceu?</span>
              <textarea className="pf-campo__entrada pf-reporte__texto" value={texto} onChange={(e) => setTexto(e.target.value)}
                placeholder="Ex.: no quiz de C, a pergunta 5 dizia “observe o código abaixo”, mas não tinha código nenhum."
                rows={5} maxLength={4000} required disabled={enviando} />
            </label>

            <div className="pf-reporte__print">
              {print ? (
                <figure className="pf-reporte__previa">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={print.url} alt="Print que vai junto com o relato" />
                  <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={() => trocarPrint(null)} disabled={enviando}>Tirar o print</button>
                </figure>
              ) : (
                <div className="pf-acoes">
                  {podeCapturar && (
                    <button type="button" className="pf-botao pf-botao--sec" onClick={capturar} disabled={enviando}>📸 Capturar esta tela</button>
                  )}
                  <button type="button" className="pf-botao pf-botao--sec" onClick={() => arquivo.current?.click()} disabled={enviando}>Anexar imagem</button>
                  <input ref={arquivo} type="file" accept="image/png,image/jpeg,image/webp" hidden
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) guardarImagem(f); e.target.value = ""; }} />
                </div>
              )}
              {!print && <p className="pf-reporte__dica">Você também pode colar um print aqui com Ctrl+V.</p>}
            </div>

            <p className="pf-reporte__dica">
              Vai junto: a tela em que você está ({caminho}), o navegador e o horário. O print pode mostrar o que
              estiver na sua tela — ele só é visto por quem administra o Proof.
            </p>

            {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
            <div className="pf-acoes">
              <button type="submit" className="pf-botao" disabled={enviando || texto.trim().length < 5}>
                {enviando ? "Enviando…" : "Enviar chamado"}
              </button>
              <button type="button" className="pf-botao pf-botao--sec" onClick={fechar} disabled={enviando}>Cancelar</button>
            </div>
          </form>
        )}
      </Folha>
    </>
  );
}

/** Imagem (File, Blob ou canvas) → JPEG de no máximo LARGURA_MAXIMA de largura. */
async function reduzir(origem) {
  let fonte = origem;
  if (!(origem instanceof HTMLCanvasElement)) {
    if (!/^image\/(png|jpeg|webp|gif)$/.test(origem.type)) throw new Error("use uma imagem PNG, JPG ou WebP");
    fonte = await createImageBitmap(origem);
  }
  const escala = Math.min(1, LARGURA_MAXIMA / fonte.width);
  const tela = document.createElement("canvas");
  tela.width = Math.round(fonte.width * escala);
  tela.height = Math.round(fonte.height * escala);
  tela.getContext("2d").drawImage(fonte, 0, 0, tela.width, tela.height);
  const blob = await new Promise((ok) => tela.toBlob(ok, "image/jpeg", 0.85));
  if (!blob) throw new Error("não consegui preparar a imagem");
  return blob;
}
