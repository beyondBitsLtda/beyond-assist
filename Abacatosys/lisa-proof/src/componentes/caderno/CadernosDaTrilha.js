"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { obter, criar } from "@/lib/api.js";
import { anotacoesPorSemana } from "@/dominio/cadernos.js";

/** O texto de um item do menu: a apostila pelo nome; a página, "caderno › página". */
function Item({ a }) {
  const apostila = a.caderno?.categoria === "apostila";
  return (
    <Link href={a.href} className={`cd-trilha__item${apostila ? " cd-trilha__item--apostila" : ""}`}>
      <span aria-hidden="true">{apostila ? "📘" : a.caderno?.icone || "📓"}</span>
      {apostila ? (
        <span className="cd-trilha__nome">Apostila</span>
      ) : (
        <>
          <span className="cd-trilha__nome">{a.caderno?.titulo || "Caderno"}</span>
          {a.pagina && <span className="cd-trilha__pagina">› {a.pagina.titulo}</span>}
        </>
      )}
    </Link>
  );
}

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/**
 * Os cadernos e as apostilas da trilha (06/11/2026: "organize a área atual de estruturas e caderno na
 * trilha, deixe um menu colapsado para o usuário ver por semana as estruturas geradas"). Fechado por
 * padrão; aberto, mostra o que é da trilha inteira e uma gaveta por semana do plano, com cada assunto e o
 * que está ligado a ele (páginas e apostilas). A estrutura do caderno do curso só nasce quando a pessoa
 * pede ("a Lisa só pode gerar estrutura de cadernos se o usuário pedir").
 */
export default function CadernosDaTrilha({ trilha, avanco }) {
  const router = useRouter();
  const [anotacoes, setAnotacoes] = useState(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState("");
  const [anotando, setAnotando] = useState(false);
  const [cadernos, setCadernos] = useState(null);
  const [escolhido, setEscolhido] = useState("");

  const carregar = useCallback(() => {
    obter(`/api/vinculos?tipo=trilha&id=${trilha.id}`).then((r) => setAnotacoes(r.anotacoes || [])).catch((e) => setErro(e.message));
  }, [trilha.id]);
  useEffect(() => { carregar(); }, [carregar]);

  const arrumado = useMemo(() => anotacoesPorSemana(anotacoes || [], avanco), [anotacoes, avanco]);
  // o caderno do curso: o caderno inteiro ligado à trilha (o mesmo critério do servidor, src/lib/cadernoDaTrilha.js)
  const doCurso = arrumado.daTrilha.find((a) => !a.pagina && a.caderno?.categoria !== "apostila");
  const apostilas = (anotacoes || []).filter((a) => a.caderno?.categoria === "apostila").length;
  const semanaDaVez = avanco?.semanaDaVez?.numero ?? null;

  async function criarEstrutura() {
    setOcupado("estrutura");
    setErro("");
    try {
      const r = await criar(`/api/trilhas/${trilha.id}/caderno`, {});
      carregar();
      if (r.caderno?.nova && window.confirm(`A estrutura do caderno está pronta: ${plural(r.caderno.modulos, "semana", "semanas")}, ${plural(r.caderno.paginas, "página", "páginas")}. Abrir agora?`)) {
        router.push(r.caderno.href);
      }
    } catch (e) {
      setErro(e.message);
    } finally {
      setOcupado("");
    }
  }

  async function abrirAnotar() {
    setAnotando((a) => !a);
    if (!cadernos) obter("/api/cadernos").then((r) => setCadernos((r.cadernos || []).filter((c) => c.categoria !== "apostila"))).catch((e) => setErro(e.message));
  }

  async function anotar() {
    setOcupado("anotar");
    setErro("");
    try {
      const r = await criar("/api/anotar", { alvo: { tipo: "trilha", id: trilha.id }, cadernoId: escolhido || null });
      router.push(r.href);
    } catch (e) {
      setErro(e.message);
      setOcupado("");
    }
  }

  const total = arrumado.total;
  return (
    <details className="cd-trilha">
      <summary className="cd-trilha__resumo">
        <span className="cd-trilha__titulo">📓 Cadernos e apostilas da trilha</span>
        <span className="cd-trilha__conta">
          {anotacoes === null ? "…" : total ? `${plural(total, "item", "itens")}${apostilas ? ` · 📘 ${plural(apostilas, "apostila", "apostilas")}` : ""}` : "nada ainda"}
        </span>
      </summary>

      <div className="cd-trilha__corpo">
        <div className="cd-trilha__acoes">
          {doCurso ? (
            <Link className="pf-botao pf-botao--sec pf-botao--pequeno" href={doCurso.href}>📓 Abrir o caderno do curso</Link>
          ) : (
            <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={criarEstrutura} disabled={Boolean(ocupado) || anotacoes === null}>
              {ocupado === "estrutura" ? "Montando a estrutura…" : "🧱 Criar a estrutura do caderno"}
            </button>
          )}
          <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={abrirAnotar} aria-expanded={anotando} disabled={ocupado === "anotar"}>＋ Anotar aqui</button>
          <Link className="pf-botao pf-botao--sec pf-botao--pequeno" href="/cadernos?categoria=apostila">📘 Todas as apostilas</Link>
        </div>
        <p className="cd-trilha__dica">
          {doCurso
            ? "Cada semana abaixo mostra as páginas e as apostilas de cada assunto."
            : "A estrutura do caderno (um módulo por semana, uma página por assunto) só é criada quando você pede."}
          {" "}A apostila de um assunto nasce no botão “Aula completa” dele, no mapa.
        </p>

        {anotando && (
          <div className="cd-anotacoes__nova">
            <label className="pf-campo">
              <span className="pf-campo__rotulo">Em qual caderno (sobre “{trilha.tema}”)?</span>
              <select className="pf-campo__entrada" value={escolhido} onChange={(e) => setEscolhido(e.target.value)} disabled={ocupado === "anotar"}>
                <option value="">＋ Um caderno novo</option>
                {(cadernos || []).map((c) => <option key={c.id} value={c.id}>{c.icone} {c.titulo}</option>)}
              </select>
            </label>
            <div className="pf-acoes">
              <button type="button" className="pf-botao pf-botao--pequeno" onClick={anotar} disabled={ocupado === "anotar"}>{ocupado === "anotar" ? "Criando a página…" : "Criar página e abrir"}</button>
              <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={() => setAnotando(false)} disabled={ocupado === "anotar"}>Cancelar</button>
            </div>
          </div>
        )}
        {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}

        {arrumado.daTrilha.length > 0 && (
          <div className="cd-trilha__grupo">
            <p className="cd-trilha__rotulo">Da trilha inteira</p>
            <ul className="cd-trilha__itens">{arrumado.daTrilha.map((a) => <li key={a.id}><Item a={a} /></li>)}</ul>
          </div>
        )}

        {arrumado.semanas.map((s) => (
          <details key={s.titulo} className="cd-trilha__semana" open={s.semana !== null && s.semana === semanaDaVez}>
            <summary>
              <span>{s.titulo}{s.semana !== null && s.semana === semanaDaVez ? " · agora" : ""}</span>
              <small>{s.total ? plural(s.total, "item", "itens") : "nada ainda"}{s.apostilas ? ` · 📘 ${s.apostilas}` : ""}</small>
            </summary>
            <ul className="cd-trilha__assuntos">
              {s.assuntos.map((a) => (
                <li key={a.cardId}>
                  <Link className="cd-trilha__assunto" href={`/trilhas/${trilha.id}?assunto=${a.cardId}`} onClick={(e) => {
                    // já está na trilha: abre o assunto no mapa sem recarregar
                    if (window.location.pathname === `/trilhas/${trilha.id}`) { e.preventDefault(); window.dispatchEvent(new CustomEvent("proof-abrir-assunto", { detail: a.cardId })); }
                  }}>📌 {a.titulo}</Link>
                  {a.itens.length ? (
                    <ul className="cd-trilha__itens">{a.itens.map((i) => <li key={i.id}><Item a={i} /></li>)}</ul>
                  ) : (
                    <small className="cd-trilha__vazio">sem páginas nem apostila</small>
                  )}
                </li>
              ))}
            </ul>
          </details>
        ))}

        {arrumado.soltas.length > 0 && (
          <div className="cd-trilha__grupo">
            <p className="cd-trilha__rotulo">De assuntos que saíram do plano</p>
            <ul className="cd-trilha__itens">{arrumado.soltas.map((a) => <li key={a.id}><Item a={a} /></li>)}</ul>
          </div>
        )}
      </div>
    </details>
  );
}
