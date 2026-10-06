"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { obter } from "@/lib/api.js";
import { diaDe, somarDias, formatarDia, NOMES_DOS_DIAS, diaDaSemana } from "@/dominio/datas.js";
import { itensDoDia, gradeDoMes, mesVizinho, nomeDoMes, textoDaEtiqueta, ROTULOS_DA_AGENDA, ROTULOS_DA_SITUACAO } from "@/dominio/agenda.js";
import Neuro from "@/componentes/Neuro.js";

const ICONES = { assunto: "📘", quiz: "❓", exercicio: "⌨️", projeto_semanal: "🎁", projeto_mensal: "🏆" };
const CLASSE_DA_SITUACAO = {
  feito: "pf-pilula--verde", agora: "pf-pilula--atencao", atrasado: "pf-pilula--alerta",
  entregue: "pf-pilula--atencao", futuro: "", perdido: "",
};
const CABECALHO_DA_SEMANA = [1, 2, 3, 4, 5, 6, 0].map((d) => NOMES_DOS_DIAS[d]);
const DIAS_NA_LISTA = 14;

function quando(item) {
  if (item.exibir === "prazo") return item.tipo.startsWith("projeto") ? `entrega ${formatarDia(item.fim, { comSemana: true })}` : formatarDia(item.fim, { comSemana: true });
  return item.inicio === item.fim ? formatarDia(item.inicio, { comSemana: true }) : `${formatarDia(item.inicio)} a ${formatarDia(item.fim)}`;
}

function Item({ item }) {
  return (
    <li>
      <Link href={item.href} className={`agenda__item agenda__item--${item.situacao}`} style={{ "--cor": item.cor }}>
        <span className="agenda__icone" aria-hidden="true">{ICONES[item.tipo]}</span>
        <span className="agenda__textos">
          <strong>{item.titulo}</strong>
          <small>
            {/* O tipo só aparece quando o título não é o próprio tipo ("Entrega do projeto da semana" duas vezes não informa nada). */}
            {[item.tema, item.titulo !== ROTULOS_DA_AGENDA[item.tipo] && ROTULOS_DA_AGENDA[item.tipo], quando(item)].filter(Boolean).join(" · ")}
          </small>
        </span>
        <span className={`pf-pilula ${CLASSE_DA_SITUACAO[item.situacao]}`}>{ROTULOS_DA_SITUACAO[item.situacao]}</span>
      </Link>
    </li>
  );
}

function Mes({ dados, itens, selecionado, aoSelecionar }) {
  const grade = gradeDoMes(dados.mes);
  const estudados = new Set(dados.diasEstudados);
  const mesAtual = dados.mes.slice(0, 7);
  return (
    <div className="pf-cartao agenda__mes">
      <div className="agenda__grade" role="grid" aria-label={`Calendário de ${nomeDoMes(dados.mes)}`}>
        {CABECALHO_DA_SEMANA.map((d) => <div key={d} className="agenda__cabeca" role="columnheader">{d}</div>)}
        {grade.dias.map((d) => {
          const doDia = itensDoDia(itens, d);
          const atrasado = doDia.some((x) => x.situacao === "atrasado");
          const classes = [
            "agenda__dia",
            d.slice(0, 7) !== mesAtual && "agenda__dia--fora",
            d === dados.hoje && "agenda__dia--hoje",
            d === selecionado && "agenda__dia--selecionado",
            atrasado && "agenda__dia--atrasado",
          ].filter(Boolean).join(" ");
          return (
            <button key={d} type="button" role="gridcell" className={classes} onClick={() => aoSelecionar(d)}
              aria-label={`${formatarDia(d, { comSemana: true })}: ${doDia.length} compromisso(s)${estudados.has(d) ? ", dia estudado" : ""}`}>
              <span className="agenda__numero">
                {Number(d.slice(8))}
                {estudados.has(d) && <span className="agenda__fogo" aria-hidden="true">🔥</span>}
              </span>
              <span className="agenda__chips" aria-hidden="true">
                {doDia.slice(0, 3).map((x) => (
                  <span key={x.chave} className={`agenda__chip agenda__chip--${x.situacao}`} style={{ "--cor": x.cor }}>
                    <span className="agenda__chip-texto">{ICONES[x.tipo]} {textoDaEtiqueta(x)}</span>
                  </span>
                ))}
                {doDia.length > 3 && <span className="agenda__mais">+{doDia.length - 3}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Lista({ dados, itens }) {
  const atrasados = itens.filter((x) => x.situacao === "atrasado");
  const dias = Array.from({ length: DIAS_NA_LISTA }, (_, i) => somarDias(dados.hoje, i));
  const blocos = dias.map((d) => ({ dia: d, itens: itensDoDia(itens, d).filter((x) => x.situacao !== "atrasado") })).filter((b) => b.itens.length);

  return (
    <>
      {atrasados.length > 0 && (
        <section className="pf-secao">
          <h2 className="pf-secao__titulo agenda__titulo-atrasado">Atrasados <small>{atrasados.length}</small></h2>
          <ul className="agenda__lista">{atrasados.map((x) => <Item key={x.chave} item={x} />)}</ul>
        </section>
      )}
      {blocos.map((b) => (
        <section key={b.dia} className="pf-secao">
          <h2 className="pf-secao__titulo">
            {b.dia === dados.hoje ? "Hoje" : b.dia === somarDias(dados.hoje, 1) ? "Amanhã" : formatarDia(b.dia, { comSemana: true })}
            <small>{b.dia === dados.hoje || b.dia === somarDias(dados.hoje, 1) ? formatarDia(b.dia, { comSemana: true }) : ""}</small>
          </h2>
          <ul className="agenda__lista">{b.itens.map((x) => <Item key={`${b.dia}-${x.chave}`} item={x} />)}</ul>
        </section>
      ))}
      {!atrasados.length && !blocos.length && (
        <div className="pf-cartao pf-vazio" style={{ marginTop: 16 }}>
          <h2>Nada nos próximos {DIAS_NA_LISTA} dias</h2>
          <p>Quando você montar uma trilha, os assuntos e as entregas aparecem aqui.</p>
          <Link className="pf-botao" href="/trilhas">Ver trilhas</Link>
        </div>
      )}
    </>
  );
}

/**
 * A agenda: os compromissos de todas as trilhas num lugar só — assuntos nos dias planejados,
 * entregas de projeto, quiz e exercício do dia —, em mês (calendário) ou lista (atrasados e
 * próximos 14 dias).
 */
export default function Agenda() {
  const hoje = diaDe();
  const [modo, setModo] = useState("mes");
  const [mes, setMes] = useState(hoje.slice(0, 8) + "01");
  const [selecionado, setSelecionado] = useState(hoje);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [ocultas, setOcultas] = useState(new Set());

  useEffect(() => {
    try {
      const salvo = localStorage.getItem("proof-agenda-modo");
      if (salvo === "lista" || salvo === "mes") setModo(salvo);
    } catch { /* sem armazenamento: começa no mês */ }
  }, []);

  const carregar = useCallback(async () => {
    const intervalo = modo === "mes" ? gradeDoMes(mes) : { de: somarDias(hoje, -120), ate: somarDias(hoje, DIAS_NA_LISTA) };
    try {
      setErro("");
      const r = await obter(`/api/agenda?de=${intervalo.de}&ate=${intervalo.ate}`);
      setDados({ ...r, mes });
    } catch (e) {
      setErro(e.message);
    }
  }, [modo, mes, hoje]);

  useEffect(() => { carregar(); }, [carregar]);

  function trocarModo(m) {
    setModo(m);
    try { localStorage.setItem("proof-agenda-modo", m); } catch { /* ok */ }
  }

  function alternarTrilha(id) {
    setOcultas((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  const itens = useMemo(() => (dados?.itens || []).filter((x) => !ocultas.has(x.trilhaId)), [dados, ocultas]);
  const doSelecionado = dados ? itensDoDia(itens, selecionado) : [];
  const atrasados = itens.filter((x) => x.situacao === "atrasado").length;

  return (
    <>
      <div className="pf-cabecalho">
        <div>
          <h1>Agenda</h1>
          <p>Assuntos, entregas e prática de todas as trilhas.</p>
        </div>
        <div className="agenda__modos" role="tablist" aria-label="Modo da agenda">
          <button type="button" role="tab" aria-selected={modo === "mes"} className="agenda__modo" onClick={() => trocarModo("mes")}>Mês</button>
          <button type="button" role="tab" aria-selected={modo === "lista"} className="agenda__modo" onClick={() => trocarModo("lista")}>Lista</button>
        </div>
      </div>

      {erro && <div className="pf-aviso pf-aviso--erro" style={{ marginBottom: 12 }}>{erro}</div>}

      {dados?.trilhas?.length > 0 && (
        <div className="agenda__filtros" role="group" aria-label="Trilhas na agenda">
          {dados.trilhas.map((t) => (
            <button key={t.id} type="button" className="agenda__filtro" aria-pressed={!ocultas.has(t.id)}
              style={{ "--cor": t.cor }} onClick={() => alternarTrilha(t.id)}>
              <span className="agenda__bolinha" aria-hidden="true" />{t.tema}
            </button>
          ))}
        </div>
      )}

      {!dados ? (
        !erro && <div className="pf-carregando">Abrindo a agenda…</div>
      ) : modo === "lista" ? (
        <>
          {atrasados > 0 && (
            <div className="pf-cartao agenda__neuro">
              <Neuro humor="triste" tamanho={80} fala={`Você tem ${atrasados} compromisso(s) atrasado(s). Bora tirar um da frente hoje?`} />
            </div>
          )}
          <Lista dados={dados} itens={itens} />
        </>
      ) : (
        <div className="agenda__layout">
          <div>
            <div className="agenda__navegacao">
              <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={() => setMes(mesVizinho(mes, -1))} aria-label="Mês anterior">‹</button>
              <strong className="agenda__mes-nome">{nomeDoMes(mes)}</strong>
              <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={() => setMes(mesVizinho(mes, 1))} aria-label="Próximo mês">›</button>
              <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={() => { setMes(hoje.slice(0, 8) + "01"); setSelecionado(hoje); }}>Hoje</button>
            </div>
            {dados.mes === mes && <Mes dados={dados} itens={itens} selecionado={selecionado} aoSelecionar={setSelecionado} />}
          </div>

          <aside className="agenda__painel">
            <h2 className="pf-secao__titulo">
              {selecionado === hoje ? "Hoje" : formatarDia(selecionado, { comSemana: true })}
              <small>{doSelecionado.length} compromisso(s)</small>
            </h2>
            {doSelecionado.length ? (
              <ul className="agenda__lista">{doSelecionado.map((x) => <Item key={x.chave} item={x} />)}</ul>
            ) : (
              <p className="pf-estat__nota">
                {diaDaSemana(selecionado) === 0 || diaDaSemana(selecionado) === 6 ? "Dia livre. Descansar também faz parte." : "Nada marcado para este dia."}
              </p>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
