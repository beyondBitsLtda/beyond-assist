"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { obter, criar } from "@/lib/api.js";
import Folha from "./Folha.js";
import { comemorar } from "./Neuro.js";

/**
 * Vales de moedas (src/lib/vales.js). Dois jeitos de aparecer:
 *   AvisoDeVale  — na moldura: assim que a pessoa entra, abre uma janela com o presente.
 *                  "Depois" fecha só nesta visita (sessionStorage); o vale continua esperando.
 *   CartaoDeVale — na tela do Reino: o lembrete com o botão de resgatar, enquanto houver vale.
 * Resgatar avisa as outras partes da tela pelo evento de janela "proof-vale-resgatado".
 */

const ADIADO = "proof-vale-adiado";
const numero = (n) => new Intl.NumberFormat("pt-BR").format(n || 0);

function lerAdiados() {
  try { return JSON.parse(sessionStorage.getItem(ADIADO) || "[]"); } catch { return []; }
}
function adiar(id) {
  try { sessionStorage.setItem(ADIADO, JSON.stringify([...new Set([...lerAdiados(), id])])); } catch { /* sem armazenamento: só fecha */ }
}

/** Os vales pendentes, sempre atualizados depois de um resgate em qualquer parte da tela. */
export function useVales() {
  const [vales, setVales] = useState(null);
  const carregar = useCallback(() => obter("/api/vales").then((r) => setVales(r.vales)).catch(() => setVales([])), []);
  useEffect(() => {
    carregar();
    window.addEventListener("proof-vale-resgatado", carregar);
    return () => window.removeEventListener("proof-vale-resgatado", carregar);
  }, [carregar]);
  return vales;
}

export async function resgatar(vale) {
  const r = await criar("/api/vales/resgatar", { vale: vale.id });
  comemorar(`+${numero(r.moedas)} moedas! 🎁`);
  window.dispatchEvent(new CustomEvent("proof-vale-resgatado", { detail: r }));
  return r;
}

export function AvisoDeVale() {
  const vales = useVales();
  const [aberto, setAberto] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [feito, setFeito] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!vales || aberto || feito) return;
    const adiados = lerAdiados();
    const proximo = vales.find((v) => !adiados.includes(v.id));
    if (proximo) setAberto(proximo);
  }, [vales, aberto, feito]);

  const fechar = useCallback(() => {
    if (aberto && !feito) adiar(aberto.id);
    setAberto(null);
    setFeito(null);
    setErro("");
  }, [aberto, feito]);

  async function aoResgatar() {
    setOcupado(true);
    setErro("");
    try {
      setFeito(await resgatar(aberto));
    } catch (e) {
      setErro(e.message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Folha aberta={Boolean(aberto)} aoFechar={fechar} titulo={aberto?.titulo || "Vale"}>
      {aberto && (
        <div className="vale">
          <div className="vale__presente" aria-hidden="true">{feito ? "🪙" : "🎁"}</div>
          {feito ? (
            <>
              <h2 className="vale__titulo">+{numero(feito.moedas)} moedas no seu Reino!</h2>
              <p className="vale__texto">Agora você tem 🪙 {numero(feito.saldo)}. Que tal construir a primeira torre?</p>
              <div className="vale__acoes">
                <Link href="/reino" className="pf-botao" onClick={fechar}>🏰 Ir para o Reino</Link>
                <button type="button" className="pf-botao pf-botao--sec" onClick={fechar}>Fechar</button>
              </div>
            </>
          ) : (
            <>
              <h2 className="vale__titulo">Você ganhou um vale de {numero(aberto.moedas)} moedas!</h2>
              <p className="vale__texto">{aberto.descricao} As moedas vão direto para o Reino do Neuro — use para construir, treinar o Neuro e se defender.</p>
              <div className="vale__acoes">
                <button type="button" className="pf-botao" onClick={aoResgatar} disabled={ocupado}>
                  {ocupado ? "Resgatando…" : `Resgatar ${numero(aberto.moedas)} moedas`}
                </button>
                <button type="button" className="pf-botao pf-botao--sec" onClick={fechar} disabled={ocupado}>Depois</button>
              </div>
              <p className="vale__nota">Se deixar para depois, o vale fica esperando na tela do Reino.</p>
            </>
          )}
          {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
        </div>
      )}
    </Folha>
  );
}

export function CartaoDeVale() {
  const vales = useVales();
  const [ocupado, setOcupado] = useState("");
  const [erro, setErro] = useState("");
  if (!vales?.length) return null;
  return (
    <div className="vale-cartao-lista">
      {vales.map((v) => (
        <section key={v.id} className="pf-cartao vale-cartao" aria-label={v.titulo}>
          <span className="vale-cartao__icone" aria-hidden="true">🎁</span>
          <div className="vale-cartao__texto">
            <strong>{v.titulo}: {numero(v.moedas)} moedas para resgatar</strong>
            <span>{v.descricao}</span>
          </div>
          <button type="button" className="pf-botao" disabled={Boolean(ocupado)}
            onClick={async () => {
              setOcupado(v.id);
              setErro("");
              try { await resgatar(v); } catch (e) { setErro(e.message); } finally { setOcupado(""); }
            }}>
            {ocupado === v.id ? "Resgatando…" : "Resgatar"}
          </button>
        </section>
      ))}
      {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
    </div>
  );
}
