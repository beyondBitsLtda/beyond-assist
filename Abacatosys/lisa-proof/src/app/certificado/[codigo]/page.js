"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { obter } from "@/lib/api.js";
import { urlDoMonstro } from "@/componentes/reino/monstrosDePapel.js";
import { chefaoPorId } from "@/dominio/modoDominio.js";

/**
 * A conferência de um certificado do Modo Domínio (24/10/2026), SEM login: quem recebe o PDF
 * digita o endereço impresso nele e vê se é autêntico. Só o nome público (apelido ou "Primeiro
 * I."), o repositório e as notas — nada de e-mail nem nome completo.
 */
export default function ConferenciaDoCertificado() {
  const { codigo } = useParams();
  const [c, setC] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    obter(`/api/certificado/${encodeURIComponent(codigo)}`).then((r) => setC(r.certificado)).catch((e) => setErro(e.message));
  }, [codigo]);

  return (
    <main className="dm-conferencia">
      <div className="pf-cartao dm-conferencia__cartao">
        <p className="dm-conferencia__marca">Lisa_Proof · Modo Domínio</p>
        {!c && !erro && <p className="pf-carregando">Conferindo o certificado…</p>}
        {erro && (
          <>
            <h1>❌ Certificado não encontrado</h1>
            <p>O código <code>{String(codigo).toUpperCase()}</code> não corresponde a nenhum certificado emitido. Confira se foi digitado igual ao do PDF.</p>
          </>
        )}
        {c && (
          <>
            <h1>✅ Certificado autêntico</h1>
            <p className="dm-conferencia__quem"><strong>{c.nome}</strong> conquistou os <strong>{c.andares} andares</strong> da torre do repositório</p>
            <p className="dm-conferencia__repo"><a href={c.url} target="_blank" rel="noreferrer">{c.repo}</a> <small>({c.provedor === "gitlab" ? "GitLab" : "GitHub"})</small></p>
            <dl className="dm-conferencia__dados">
              <div><dt>Nível</dt><dd>{c.nivel} — {c.nomeDoNivel}</dd></div>
              <div><dt>Média final</dt><dd>{c.media}/100</dd></div>
              <div><dt>Concluído em</dt><dd>{new Date(c.concluidoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "long", year: "numeric" })}</dd></div>
              <div><dt>Código</dt><dd><code>{c.codigo}</code></dd></div>
            </dl>
            {c.chefaoFinal && (
              <div className="dm-conferencia__guardiao">
                <img src={urlDoMonstro(c.chefaoFinal)} alt="" width="64" height="64" />
                <span>Guardião do topo vencido: <strong>{chefaoPorId(c.chefaoFinal)?.nome}</strong></span>
              </div>
            )}
            {c.tecnologias?.length > 0 && <div className="dm-chips">{c.tecnologias.map((t) => <span key={t} className="dm-chip">{t}</span>)}</div>}
            {c.assuntos?.length > 0 && (
              <>
                <h2>Assuntos dominados</h2>
                <ul className="dm-conferencia__assuntos">{c.assuntos.map((s) => <li key={s}>{s}</li>)}</ul>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
