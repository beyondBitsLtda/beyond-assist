"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { lerExportacaoDoTrello, enxugarExportacao } from "@/dominio/trello.js";
import { criar } from "@/lib/api.js";

/**
 * Trazer um quadro do Trello.
 *
 * O arquivo é lido e conferido AQUI, no navegador, antes de qualquer coisa subir. São três
 * motivos, nessa ordem de importância:
 *
 *   1. A prévia. Você vê quantas colunas, cards, checklists e prazos vão entrar, e o que NÃO
 *      vai, antes de confirmar. Uma migração que só conta o que deu certo é uma migração em
 *      que você descobre o que faltou três semanas depois.
 *
 *   2. O tamanho. Uma exportação com um ano de uso passa de cinquenta megabytes, e quase tudo
 *      é o histórico de movimentos, que não vem. Cortar antes de enviar é a diferença entre um
 *      envio de segundos e um que parece travado.
 *
 *   3. O erro certo na hora certa. Arquivo trocado (o perfil em vez do quadro) é o engano mais
 *      comum, e ele aparece na hora, sem esperar a rede.
 *
 * O servidor lê o arquivo de novo com a MESMA função. A prévia é conveniência; a decisão de
 * como cada coisa vira o quê é sempre dele.
 */
export default function ImportarDoTrello({ aoTerminar, aoFechar }) {
  const [lendo, setLendo] = useState(false);
  const [previa, setPrevia] = useState(null);      // { nome, resumo, avisos, enxuto }
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const campo = useRef(null);
  const router = useRouter();

  async function receber(arquivo) {
    if (!arquivo) return;
    setErro("");
    setPrevia(null);
    setLendo(true);
    try {
      const texto = await arquivo.text();
      let bruto;
      try {
        bruto = JSON.parse(texto);
      } catch {
        throw new Error("esse arquivo não é um JSON válido. No Trello: Menu ▸ Mais ▸ Imprimir e exportar ▸ Exportar como JSON.");
      }
      const { quadro, resumo, avisos } = lerExportacaoDoTrello(bruto);
      setPrevia({ nome: quadro.nome, resumo, avisos, enxuto: enxugarExportacao(bruto), arquivo: arquivo.name });
    } catch (e) {
      setErro(e.message);
    } finally {
      setLendo(false);
    }
  }

  async function confirmar() {
    if (!previa || enviando) return;
    setEnviando(true);
    setErro("");
    try {
      const d = await criar("/api/importar/trello", { trello: previa.enxuto, confirmar: true });
      aoTerminar?.(d);
      router.push(`/quadros/${d.quadroId}`);
    } catch (e) {
      setErro(e.message);
      setEnviando(false);
    }
  }

  const r = previa?.resumo;

  return (
    <div className="abacato-painel" role="dialog" aria-modal="true" aria-label="Importar do Trello">
      <div className="abacato-painel__fundo" onClick={aoFechar} />
      <div className="abacato-painel__caixa abacato-painel__caixa--estreita">
        <header className="abacato-painel__cabecalho">
          <h2 className="abacato-painel__titulo abacato-painel__titulo--fixo">Trazer um quadro do Trello</h2>
          <button type="button" className="abacato-icone" onClick={aoFechar} aria-label="fechar">✕</button>
        </header>

        <div className="abacato-painel__corpo">
          {!previa && (
            <>
              <section className="abacato-bloco">
                <h3 className="abacato-bloco__titulo">Como pegar o arquivo</h3>
                <ol className="abacato-passos">
                  <li>Abra o quadro no Trello.</li>
                  <li>Menu <strong>⋯</strong> ▸ <strong>Mais</strong> ▸ <strong>Imprimir e exportar</strong>.</li>
                  <li>Escolha <strong>Exportar como JSON</strong> e salve o arquivo.</li>
                  <li>Solte o arquivo aqui embaixo.</li>
                </ol>
                <p className="abacato-dica abacato-dica--bloco">
                  É um quadro por arquivo. O histórico de movimentos do Trello não vem — ele é
                  o que faz o arquivo ficar enorme, e é histórico do sistema que você está
                  deixando para trás.
                </p>
              </section>

              <label
                className={`abacato-solte${arrastando ? " abacato-solte--ativo" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
                onDragLeave={() => setArrastando(false)}
                onDrop={(e) => { e.preventDefault(); setArrastando(false); receber(e.dataTransfer.files?.[0]); }}
              >
                <input
                  ref={campo}
                  type="file"
                  accept="application/json,.json"
                  className="abacato-solte__campo"
                  onChange={(e) => receber(e.target.files?.[0])}
                />
                <span className="abacato-solte__icone">⇥</span>
                <strong>{lendo ? "Lendo o arquivo…" : "Solte o JSON aqui"}</strong>
                <span className="abacato-dica">ou clique para procurar no computador</span>
              </label>
            </>
          )}

          {erro && <div className="abacato-campo__erro">⚠ {erro}</div>}

          {previa && (
            <>
              <section className="abacato-bloco">
                <h3 className="abacato-bloco__titulo">O que vai entrar</h3>
                <p className="abacato-previa__nome">{previa.nome}</p>
                <div className="abacato-previa">
                  {[
                    ["colunas", r.colunas], ["cards", r.cards], ["etiquetas", r.etiquetas],
                    ["checklists", r.checklists], ["itens", r.itens], ["links", r.links],
                    ["com prazo", r.comPrazo], ["já concluídos", r.concluidos], ["arquivados", r.arquivados],
                  ].map(([rotulo, valor]) => (
                    <div key={rotulo} className={`abacato-previa__item${valor ? "" : " abacato-previa__item--zero"}`}>
                      <span className="abacato-previa__numero">{valor}</span>
                      <span className="abacato-previa__rotulo">{rotulo}</span>
                    </div>
                  ))}
                </div>
                <p className="abacato-dica">de {previa.arquivo}</p>
              </section>

              {previa.avisos.length > 0 && (
                <section className="abacato-bloco">
                  <h3 className="abacato-bloco__titulo">O que não vem junto</h3>
                  {previa.avisos.map((a) => (
                    <p key={a.tipo} className="abacato-aviso-linha">⚠ {a.texto}</p>
                  ))}
                </section>
              )}

              <section className="abacato-bloco">
                <p className="abacato-dica abacato-dica--bloco">
                  Importar de novo o mesmo quadro <strong>não duplica nada</strong>: cria só o
                  que falta e não mexe no que já está aqui. Serve para terminar uma importação
                  que falhou no meio ou buscar cards que entraram no Trello depois.
                </p>
              </section>
            </>
          )}
        </div>

        <footer className="abacato-painel__rodape">
          {previa && (
            <>
              <button type="button" className="abacato-botao" onClick={confirmar} disabled={enviando}>
                {enviando ? "Importando…" : `Importar ${r.cards} card(s)`}
              </button>
              <button type="button" className="abacato-botao abacato-botao--fantasma" disabled={enviando}
                onClick={() => { setPrevia(null); setErro(""); }}>
                Escolher outro arquivo
              </button>
            </>
          )}
          {!previa && (
            <button type="button" className="abacato-botao abacato-botao--fantasma" onClick={aoFechar}>
              Cancelar
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
