"use client";

import { useCallback, useEffect, useState } from "react";
import { emTamanho } from "@/dominio/planos.js";

/**
 * O painel de quem administra: contas, o que existe e o diário de uso.
 *
 * ==========================================================================================
 * MOSTRA QUE EXISTE, E NÃO O QUE TEM DENTRO
 *
 * A lista de quadros traz nome, dono, data e quantos cards. Nenhum nome de card, nenhuma
 * descrição, nenhum documento. É a diferença entre administrar o sistema e ler o trabalho
 * alheio: para saber se uma conta está usando o Abacato basta saber que ela tem sete quadros.
 *
 * Quem administra e precisa MESMO abrir um quadro se põe como membro dele — o que fica
 * registrado no diário, com nome e hora. É a versão que deixa rastro.
 * ==========================================================================================
 *
 * A rota faz as contas; aqui só se desenha. Somar de novo no navegador daria a chance de as
 * duas contas discordarem, e a discussão sobre qual está certa não tem fim.
 */

const NOME_DO_EVENTO = {
  entrou: "entrou",
  criou_conta: "criou uma conta",
  pediu_cadastro: "pediu cadastro",
  aprovou_conta: "aprovou uma conta",
  recusou_conta: "recusou uma conta",
  criou_quadro: "criou um quadro",
  criou_projeto: "criou um projeto",
  enviou_documento: "enviou um documento",
  compartilhou: "compartilhou",
  bateu_limite: "esbarrou num limite",
};

export default function PainelDeUso() {
  const [aba, setAba] = useState("resumo");
  const [dias, setDias] = useState(30);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    setErro("");
    try {
      const r = await fetch(`/api/admin/uso?dias=${dias}`);
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "não consegui abrir o painel");
      setDados(d);
    } catch (x) {
      setErro(x.message);
    }
  }, [dias]);

  useEffect(() => { carregar(); }, [carregar]);

  if (erro) {
    return (
      <div className="abacato-vazio">
        <p className="abacato-vazio__titulo">Não deu para abrir esta tela</p>
        <p>{erro}</p>
      </div>
    );
  }
  if (!dados) return <div className="abacato-vazio">carregando…</div>;

  const r = dados.resumo;
  const maiorDia = Math.max(1, ...dados.porDia.map((d) => d.quantos));

  return (
    <>
      <header className="abacato-conteudo__cabecalho">
        <h1 className="abacato-conteudo__titulo">Uso do sistema</h1>
        <label className="abacato-campo" style={{ margin: 0 }}>
          <select className="abacato-campo__entrada" value={dias}
                  onChange={(e) => setDias(Number(e.target.value))}>
            <option value={7}>últimos 7 dias</option>
            <option value={30}>últimos 30 dias</option>
            <option value={90}>últimos 90 dias</option>
          </select>
        </label>
      </header>

      <div className="abacato-uso__cartoes">
        <div className="abacato-uso__cartao">
          <div className="abacato-uso__numero">{r.contas}</div>
          <div className="abacato-uso__rotulo">contas</div>
        </div>
        <div className="abacato-uso__cartao">
          <div className="abacato-uso__numero">{r.clientes}</div>
          <div className="abacato-uso__rotulo">clientes</div>
        </div>
        {/* Só fica laranja quando há fila. Um número de destaque permanente vira paisagem. */}
        <div className={`abacato-uso__cartao${r.aguardando ? " abacato-uso__cartao--atencao" : ""}`}>
          <div className="abacato-uso__numero">{r.aguardando}</div>
          <div className="abacato-uso__rotulo">aguardando aprovação</div>
        </div>
        <div className="abacato-uso__cartao">
          <div className="abacato-uso__numero">{r.quadros}</div>
          <div className="abacato-uso__rotulo">quadros</div>
        </div>
        <div className="abacato-uso__cartao">
          <div className="abacato-uso__numero">{r.projetos}</div>
          <div className="abacato-uso__rotulo">projetos</div>
        </div>
        <div className="abacato-uso__cartao">
          <div className="abacato-uso__numero">{r.tamanho}</div>
          <div className="abacato-uso__rotulo">em {r.documentos} arquivos</div>
        </div>
      </div>

      <div className="abacato-uso__abas">
        {[
          ["resumo", "Atividade"],
          ["pessoas", `Contas (${dados.pessoas.length})`],
          ["quadros", `Quadros (${dados.quadros.length})`],
          ["projetos", `Projetos (${dados.projetos.length})`],
          ["diario", `Diário (${dados.eventos.length})`],
        ].map(([chave, rotulo]) => (
          <button key={chave} type="button"
                  className={`abacato-uso__aba${aba === chave ? " abacato-uso__aba--ativa" : ""}`}
                  onClick={() => setAba(chave)}>
            {rotulo}
          </button>
        ))}
      </div>

      {aba === "resumo" && (
        <>
          <div className="abacato-barras" title="eventos por dia">
            {dados.porDia.map((d) => (
              <div key={d.dia} className="abacato-barras__col" title={`${d.dia}: ${d.quantos}`}>
                <div className="abacato-barras__barra"
                     style={{ "--altura": `${Math.round((d.quantos / maiorDia) * 100)}%` }} />
              </div>
            ))}
            {!dados.porDia.length && <p className="abacato-uso__fraco">nada registrado no período</p>}
          </div>

          <div className="abacato-uso__tabela-caixa" style={{ marginTop: 16 }}>
            <table className="abacato-uso__tabela">
              <thead>
                <tr><th>O que aconteceu</th><th className="abacato-uso__num">vezes</th></tr>
              </thead>
              <tbody>
                {dados.porTipo.map((t) => (
                  <tr key={t.tipo}>
                    <td>{NOME_DO_EVENTO[t.tipo] || t.tipo}</td>
                    <td className="abacato-uso__num">{t.quantos}</td>
                  </tr>
                ))}
                {!dados.porTipo.length && <tr><td colSpan={2} className="abacato-uso__fraco">nada ainda</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {aba === "pessoas" && (
        <div className="abacato-uso__tabela-caixa">
          <table className="abacato-uso__tabela">
            <thead>
              <tr>
                <th>Pessoa</th><th>Tipo</th>
                <th className="abacato-uso__num">quadros</th>
                <th className="abacato-uso__num">projetos</th>
                <th className="abacato-uso__num">arquivos</th>
                <th>Último acesso</th>
              </tr>
            </thead>
            <tbody>
              {dados.pessoas.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.nome}
                    <div className="abacato-uso__fraco">{p.email}</div>
                  </td>
                  <td>
                    <span className={`abacato-selo abacato-selo--${p.tipo}`}>{p.plano}</span>
                    {p.aprovado === false && <> <span className="abacato-selo abacato-selo--espera">esperando</span></>}
                    {!p.ativo && <> <span className="abacato-selo">desligada</span></>}
                  </td>
                  <td className="abacato-uso__num">
                    {p.quadros.usado}{p.quadros.ilimitado ? "" : ` / ${p.quadros.teto}`}
                  </td>
                  <td className="abacato-uso__num">
                    {p.projetos.usado}{p.projetos.ilimitado ? "" : ` / ${p.projetos.teto}`}
                  </td>
                  <td className="abacato-uso__num">
                    {p.tamanho}{p.armazenamento.ilimitado ? "" : ` / ${emTamanho(p.armazenamento.teto)}`}
                  </td>
                  <td className="abacato-uso__fraco">{quando(p.ultimo_login) || "nunca entrou"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {aba === "quadros" && (
        <div className="abacato-uso__tabela-caixa">
          <table className="abacato-uso__tabela">
            <thead>
              <tr><th>Quadro</th><th>Dono</th><th className="abacato-uso__num">cards</th><th>Criado</th></tr>
            </thead>
            <tbody>
              {dados.quadros.map((q) => (
                <tr key={q.id} className={q.arquivado ? "abacato-convite__morto" : undefined}>
                  <td>{q.nome}{q.arquivado && <> <span className="abacato-selo">arquivado</span></>}</td>
                  <td>
                    {q.dono}
                    <div className="abacato-uso__fraco">{q.donoEmail}</div>
                  </td>
                  <td className="abacato-uso__num">{q.cards}</td>
                  <td className="abacato-uso__fraco">{quando(q.criado_em)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {aba === "projetos" && (
        <div className="abacato-uso__tabela-caixa">
          <table className="abacato-uso__tabela">
            <thead>
              <tr><th>Projeto</th><th>Dono</th><th className="abacato-uso__num">arquivos</th><th>Criado</th></tr>
            </thead>
            <tbody>
              {dados.projetos.map((p) => (
                <tr key={p.id} className={p.arquivado ? "abacato-convite__morto" : undefined}>
                  <td>{p.nome}{p.arquivado && <> <span className="abacato-selo">arquivado</span></>}</td>
                  <td>{p.dono}</td>
                  <td className="abacato-uso__num">{p.tamanho}</td>
                  <td className="abacato-uso__fraco">{quando(p.criado_em)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {aba === "diario" && (
        <div className="abacato-uso__tabela-caixa">
          <table className="abacato-uso__tabela">
            <thead>
              <tr><th>Quando</th><th>Quem</th><th>O quê</th><th>Sobre</th></tr>
            </thead>
            <tbody>
              {dados.eventos.map((e) => (
                <tr key={e.id}>
                  <td className="abacato-uso__fraco">{quando(e.criado_em)}</td>
                  <td>{e.quem}</td>
                  <td>{NOME_DO_EVENTO[e.tipo] || e.tipo}</td>
                  <td className="abacato-uso__fraco">{e.alvo || "—"}</td>
                </tr>
              ))}
              {!dados.eventos.length && (
                <tr><td colSpan={4} className="abacato-uso__fraco">nada registrado no período</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/** Data e hora no fuso de quem está olhando. O servidor roda em UTC — escrever a data crua
 *  mostraria "ontem às 21h" para uma coisa que aconteceu hoje de manhã. */
function quando(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
