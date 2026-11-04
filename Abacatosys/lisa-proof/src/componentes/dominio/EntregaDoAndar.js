"use client";

// A entrega de um andar da torre de TEMA (31/10/2026): texto, fotos, áudio gravado na tela e vídeo do
// YouTube, o que o desafio do andar aceitar. O formulário vai para /api/dominio/:id/entregar e a
// página cuida da luta. As fotos e o áudio vão só para a Lisa avaliar e não ficam guardados.

import { useEffect, useRef, useState } from "react";
import { EVIDENCIAS, LIMITES_DA_EVIDENCIA, videoDoYoutube } from "@/dominio/motores.js";
import { NOTA_PARA_VENCER } from "@/dominio/modoDominio.js";
import { reduzirImagem, useGravador } from "@/componentes/pratica/Motores.js";
import { FraseSenha } from "@/componentes/pratica/FraseSenha.js";

const minutos = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function EntregaDoAndar({ numero, desafio, ocupado, lutando, aoEntregar }) {
  const aceitas = desafio.evidencias?.length ? desafio.evidencias : ["texto"];
  const maximoDeAudio = LIMITES_DA_EVIDENCIA.segundosDeAudio.projeto;
  const [texto, setTexto] = useState("");
  const [video, setVideo] = useState("");
  const [fotos, setFotos] = useState([]); // { blob, url, miniatura }
  const [pdf, setPdf] = useState(null);
  const [preparando, setPreparando] = useState(false);
  const [erro, setErro] = useState("");
  const gravador = useGravador(maximoDeAudio);
  const camera = useRef(null);
  const galeria = useRef(null);

  const fotosAgora = useRef(fotos);
  fotosAgora.current = fotos;
  useEffect(() => () => fotosAgora.current.forEach((f) => URL.revokeObjectURL(f.url)), []);
  const tirarFotos = (sai) => {
    sai.forEach((f) => URL.revokeObjectURL(f.url));
    setFotos((fs) => fs.filter((f) => !sai.includes(f)));
  };

  const videoOk = !video.trim() || Boolean(videoDoYoutube(video));
  const temAlgo = texto.trim().length > 0 || fotos.length > 0 || Boolean(gravador.audio) || Boolean(pdf) || (video.trim() && videoOk);
  const parado = Boolean(ocupado) || lutando || preparando || gravador.estado !== "parado";

  function escolherPdf(arquivo) {
    if (!arquivo) return;
    if (arquivo.type !== "application/pdf") { setErro("o arquivo precisa ser um PDF"); return; }
    if (arquivo.size > LIMITES_DA_EVIDENCIA.bytesDoPdf) { setErro(`o PDF passou de ${LIMITES_DA_EVIDENCIA.bytesDoPdf / 1_000_000} MB — exporte menor ou mande fotos das páginas`); return; }
    setErro("");
    setPdf(arquivo);
  }

  async function adicionarFotos(lista) {
    const arquivos = [...(lista || [])].filter((a) => a.type.startsWith("image/")).slice(0, LIMITES_DA_EVIDENCIA.imagens - fotos.length);
    if (!arquivos.length) return;
    setPreparando(true);
    setErro("");
    try {
      const novas = [];
      for (const a of arquivos) {
        const grande = await reduzirImagem(a, 1600, 0.82);
        const pequena = await reduzirImagem(a, 240, 0.6);
        novas.push({ blob: grande.blob, url: URL.createObjectURL(grande.blob), miniatura: pequena.miniatura });
      }
      setFotos((fs) => [...fs, ...novas].slice(0, LIMITES_DA_EVIDENCIA.imagens));
    } catch (e) {
      setErro(e.message);
    } finally {
      setPreparando(false);
    }
  }

  async function enviar(e) {
    e.preventDefault();
    if (!temAlgo || !videoOk) return;
    setErro("");
    const form = new FormData();
    form.set("texto", texto.trim());
    form.set("video", video.trim());
    fotos.forEach((f, i) => { form.append("imagem", f.blob, `foto-${i + 1}.jpg`); form.append("miniatura", f.miniatura || ""); });
    if (gravador.audio) { form.set("audio", gravador.audio.blob, "audio.wav"); form.set("segundos", String(gravador.audio.segundos)); }
    if (pdf) form.set("pdf", pdf, pdf.name || "entrega.pdf");
    const ok = await aoEntregar(form);
    if (ok) {
      // os arquivos já foram: a próxima entrega começa sem eles (o texto fica, para melhorar)
      tirarFotos(fotos);
      gravador.limpar();
      setPdf(null);
    }
  }

  return (
    <form className="dm-entregar evid" onSubmit={enviar}>
      {desafio.entrega && <p style={{ margin: 0 }}><strong>O que mandar:</strong> {desafio.entrega}</p>}
      <p className="pf-campo__rotulo" style={{ margin: 0 }}>Sua entrega · {aceitas.map((a) => `${EVIDENCIAS[a].icone} ${EVIDENCIAS[a].nome}`).join(" · ")}</p>
      <FraseSenha senha={desafio.senha} aceitas={aceitas} />

      {aceitas.includes("texto") && (
        <label className="pf-campo">
          <span className="pf-campo__rotulo">Texto</span>
          <textarea className="pf-campo__entrada" rows={6} value={texto} maxLength={LIMITES_DA_EVIDENCIA.texto} disabled={parado}
            onChange={(ev) => setTexto(ev.target.value)} placeholder="A sua resposta, redação ou resolução" />
        </label>
      )}

      {aceitas.includes("imagens") && (
        <div className="pf-campo">
          <span className="pf-campo__rotulo">Fotos · até {LIMITES_DA_EVIDENCIA.imagens} (o resultado, o caderno — não precisa aparecer você)</span>
          <div className="pf-acoes">
            <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" disabled={parado || fotos.length >= LIMITES_DA_EVIDENCIA.imagens} onClick={() => camera.current?.click()}>📷 Tirar foto</button>
            <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" disabled={parado || fotos.length >= LIMITES_DA_EVIDENCIA.imagens} onClick={() => galeria.current?.click()}>🖼️ Escolher fotos</button>
            {preparando && <span className="pf-estat__nota" style={{ margin: 0 }}>Preparando…</span>}
          </div>
          <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(ev) => { adicionarFotos(ev.target.files); ev.target.value = ""; }} />
          <input ref={galeria} type="file" accept="image/*" multiple hidden onChange={(ev) => { adicionarFotos(ev.target.files); ev.target.value = ""; }} />
          {fotos.length > 0 && (
            <ul className="evid__fotos">
              {fotos.map((f, i) => (
                <li key={f.url}>
                  <img src={f.url} alt={`Foto ${i + 1} da entrega`} />
                  <button type="button" className="evid__tirar" aria-label={`Tirar a foto ${i + 1}`} disabled={parado} onClick={() => tirarFotos([f])}>✕</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {aceitas.includes("audio") && (
        <div className="pf-campo">
          <span className="pf-campo__rotulo">Áudio · até {minutos(maximoDeAudio)}</span>
          <div className="pf-acoes" style={{ alignItems: "center" }}>
            {gravador.estado === "gravando" ? (
              <button type="button" className="pf-botao pf-botao--perigo pf-botao--pequeno" onClick={gravador.parar}>■ Parar · {minutos(gravador.segundos)}</button>
            ) : (
              <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" disabled={parado} onClick={gravador.comecar}>🎙️ {gravador.audio ? "Gravar de novo" : "Gravar"}</button>
            )}
            <label className="pf-botao pf-botao--sec pf-botao--pequeno evid__arquivo">
              📁 Enviar arquivo
              <input type="file" accept="audio/*" hidden disabled={parado} onChange={(ev) => { gravador.carregar(ev.target.files?.[0]); ev.target.value = ""; }} />
            </label>
            {gravador.estado === "convertendo" && <span className="pf-estat__nota" style={{ margin: 0 }}>Preparando o áudio…</span>}
          </div>
          {gravador.audio && (
            <div className="evid__audio">
              <audio controls src={gravador.audio.url} />
              <span className="pf-estat__nota" style={{ margin: 0 }}>{minutos(gravador.audio.segundos)}</span>
              <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" disabled={parado} onClick={gravador.limpar}>Descartar</button>
            </div>
          )}
          {gravador.erro && <small className="motor__aviso">{gravador.erro}</small>}
        </div>
      )}

      {aceitas.includes("video") && (
        <label className="pf-campo">
          <span className="pf-campo__rotulo">Vídeo do YouTube (público ou não listado)</span>
          <input className="pf-campo__entrada" type="url" value={video} disabled={parado} onChange={(ev) => setVideo(ev.target.value)} placeholder="https://youtu.be/…" />
          {!videoOk && <small className="motor__aviso">Use um link do YouTube (youtube.com ou youtu.be).</small>}
        </label>
      )}


      {aceitas.includes("pdf") && (
        <div className="pf-campo">
          <span className="pf-campo__rotulo">PDF · um arquivo de até {LIMITES_DA_EVIDENCIA.bytesDoPdf / 1_000_000} MB (a resolução, o trabalho escrito)</span>
          <div className="pf-acoes" style={{ alignItems: "center" }}>
            <label className="pf-botao pf-botao--sec pf-botao--pequeno evid__arquivo">
              📄 {pdf ? "Trocar o PDF" : "Escolher PDF"}
              <input type="file" accept="application/pdf" hidden disabled={parado} onChange={(ev) => { escolherPdf(ev.target.files?.[0]); ev.target.value = ""; }} />
            </label>
            {pdf && <span className="pf-estat__nota" style={{ margin: 0 }}>{pdf.name} · {Math.round(pdf.size / 1024)} KB</span>}
            {pdf && <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" disabled={parado} onClick={() => setPdf(null)}>Tirar</button>}
          </div>
        </div>
      )}

      {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
      <button type="submit" className="pf-botao dm-entregar__botao" disabled={parado || !temAlgo || !videoOk}>
        {ocupado === "entregar" ? "A Lisa está avaliando…" : lutando ? "⚔️ Lutando…" : `⚔️ Entregar o andar ${numero}`}
      </button>
      <small>A Lisa avalia a entrega e dá a nota. {NOTA_PARA_VENCER}+ vence o chefão. 🔒 As fotos, o áudio e o PDF vão só para a avaliação e não ficam guardados.</small>
    </form>
  );
}
