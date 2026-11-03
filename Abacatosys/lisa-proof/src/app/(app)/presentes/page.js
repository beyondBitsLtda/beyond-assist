"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { obter, criar } from "@/lib/api.js";
import { useAviso } from "@/componentes/Pecas.js";
import Neuro, { comemorar } from "@/componentes/Neuro.js";

const quando = (iso) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });

/**
 * Presentes (03/11/2026): o que foi guardado para você — hoje, personagens. Fechado, mostra a caixa; ao
 * abrir, o personagem entra na sua coleção sem custar nada, e é só vestir em Reino → Personagens.
 */
export default function Presentes() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [abrindo, setAbrindo] = useState(null);
  const [Aviso, avisar] = useAviso();

  const carregar = useCallback(() => obter("/api/presentes").then(setDados).catch((e) => setErro(e.message)), []);
  useEffect(() => { carregar(); }, [carregar]);

  async function abrir(p) {
    setAbrindo(p.id);
    try {
      const r = await criar(`/api/presentes/${p.id}`, {});
      comemorar(`🎁 ${r.presente.personagem?.nome || "Presente"} é seu!`);
      await carregar();
    } catch (e) {
      avisar(`Não deu: ${e.message}`);
    } finally {
      setAbrindo(null);
    }
  }

  return (
    <>
      <div className="pf-cabecalho">
        <div>
          <h1>🎁 Presentes</h1>
          <p>O que foi guardado para você. Abra o presente e o personagem entra na sua coleção, sem custar nada — depois é só vestir em Reino → Personagens.</p>
        </div>
      </div>
      {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
      {!dados && !erro && <p className="pf-estat__nota">Procurando os seus presentes…</p>}
      {dados && !dados.presentes.length && (
        <div className="pf-cartao pr-vazio"><p className="pf-estat__nota">Nenhum presente por enquanto. Quando alguém guardar um para você, ele aparece aqui.</p></div>
      )}
      {dados?.presentes.length > 0 && (
        <ul className="pr-lista">
          {dados.presentes.map((p) => (
            <li key={p.id} className="pf-cartao pr-presente" data-aberto={Boolean(p.abertoEm) || undefined}>
              <div className="pr-presente__figura" aria-hidden="true">
                {p.abertoEm && p.personagem ? <Neuro personagem={p.personagem.id} humor="feliz" tamanho={110} /> : <span className="pr-presente__caixa">🎁</span>}
              </div>
              <div className="pr-presente__texto">
                <h2 className="pr-presente__titulo">{p.titulo}</h2>
                {p.mensagem && <p className="pr-presente__mensagem">{p.mensagem}</p>}
                <p className="pf-estat__nota">De: {p.de} · {quando(p.criadoEm)}{p.abertoEm ? ` · aberto em ${quando(p.abertoEm)}` : ""}</p>
                {p.abertoEm ? (
                  <p className="pf-estat__nota">{p.personagem ? `${p.personagem.emoji} ${p.personagem.nome} já está na sua coleção. ` : ""}<Link href="/reino">Vestir no Reino →</Link></p>
                ) : (
                  <button type="button" className="pf-botao" disabled={abrindo === p.id} onClick={() => abrir(p)}>{abrindo === p.id ? "Abrindo…" : "🎁 Abrir o presente"}</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {Aviso}
    </>
  );
}
