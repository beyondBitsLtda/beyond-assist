"use client";

import { useRef, useState } from "react";
import { GRADIENTES, urlDaParede } from "@/dominio/paredes.js";
import { mudar } from "@/lib/api.js";

/**
 * Escolher o fundo do quadro: um dos prontos, ou uma imagem sua.
 *
 * Os prontos são gradientes escuros, e não fotos. Não é falta de opção: o quadro escreve em
 * branco por cima do fundo, e uma foto clara — ou com um céu claro num canto e uma sombra no
 * outro — apaga o nome do quadro em metade da tela. Os gradientes garantem o contraste; a
 * imagem enviada é escolha sua, e por isso vem com um véu escuro por cima.
 */
export default function PapelDeParede({ quadroId, atual, aoMudar, aoFechar }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const campo = useRef(null);

  const imagemAtual = urlDaParede(atual);

  async function escolher(valor) {
    setErro("");
    try {
      await mudar(`/api/quadros/${quadroId}`, { papelDeParede: valor });
      await aoMudar();
    } catch (e) { setErro(e.message); }
  }

  async function enviar(arquivo) {
    if (!arquivo) return;
    setErro("");
    setEnviando(true);
    try {
      const form = new FormData();
      form.append("arquivo", arquivo);
      // Sem `content-type` no cabeçalho: quem precisa montar o limite do multipart é o
      // navegador, e escrevê-lo à mão quebra o envio de um jeito que só aparece no servidor.
      const res = await fetch(`/api/quadros/${quadroId}/parede`, { method: "POST", body: form });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) throw new Error(d.error || `falha ${res.status}`);
      await aoMudar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
      if (campo.current) campo.current.value = "";
    }
  }

  return (
    <div className="abacato-painel" role="dialog" aria-modal="true" aria-label="Papel de parede">
      <div className="abacato-painel__fundo" onClick={aoFechar} />
      <div className="abacato-painel__caixa abacato-painel__caixa--estreita">
        <header className="abacato-painel__cabecalho">
          <h2 className="abacato-painel__titulo abacato-painel__titulo--fixo">Papel de parede</h2>
          <button type="button" className="abacato-icone" onClick={aoFechar} aria-label="fechar">✕</button>
        </header>

        {erro && <div className="abacato-campo__erro">⚠ {erro}</div>}

        <div className="abacato-painel__corpo">
          <section className="abacato-bloco">
            <h3 className="abacato-bloco__titulo">Sua imagem</h3>

            {imagemAtual && (
              <div className="abacato-parede-atual" style={{ backgroundImage: `url("${imagemAtual}")` }}>
                <span className="abacato-parede-atual__marca">em uso</span>
              </div>
            )}

            <label className={`abacato-solte${enviando ? " abacato-solte--ativo" : ""}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); enviar(e.dataTransfer.files?.[0]); }}>
              <input
                ref={campo}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="abacato-solte__campo"
                disabled={enviando}
                onChange={(e) => enviar(e.target.files?.[0])}
              />
              <span className="abacato-solte__icone">🖼</span>
              <strong>{enviando ? "Enviando…" : imagemAtual ? "Trocar a imagem" : "Solte uma imagem aqui"}</strong>
              <span className="abacato-dica">JPG, PNG, WEBP ou AVIF · até 10 MB</span>
            </label>

            <p className="abacato-dica abacato-dica--bloco">
              A imagem fica guardada no servidor de casa, e recebe um véu escuro por cima — sem
              ele, o nome do quadro e os contadores somem em cima das partes claras da foto.
            </p>
          </section>

          <section className="abacato-bloco">
            <h3 className="abacato-bloco__titulo">Prontos</h3>
            <div className="abacato-paredes">
              {GRADIENTES.map((p) => (
                <button
                  key={p.nome}
                  type="button"
                  className={`abacato-parede${atual === p.valor ? " abacato-parede--ativa" : ""}`}
                  onClick={() => escolher(p.valor)}
                  title={p.nome}
                >
                  <span className="abacato-parede__amostra" style={p.valor ? { background: p.valor } : undefined}>
                    {!p.valor && "∅"}
                  </span>
                  {p.nome}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
