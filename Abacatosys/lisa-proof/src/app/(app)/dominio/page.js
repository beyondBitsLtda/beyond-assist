"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { obter, criar } from "@/lib/api.js";
import { Barra } from "@/componentes/Pecas.js";
import Neuro from "@/componentes/Neuro.js";
import { NIVEIS, MIN_ANDARES, chefaoPorId } from "@/dominio/modoDominio.js";
import { urlDoMonstro } from "@/componentes/reino/monstrosDePapel.js";

const NOMES_DOS_PREMIOS = { moedas: "🪙 moedas", tropas: "⚔️ tropas", defesas: "🛡️ defesas", veiculo: "🚀 veículo", avatar: "👑 chefão-avatar" };

/** O Modo Domínio: escolher um repositório, ver se ele dá uma torre e escalar. */
export default function PaginaDoDominio() {
  const router = useRouter();
  const [torres, setTorres] = useState(null);
  const [repo, setRepo] = useState("");
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState("");
  const [recusa, setRecusa] = useState(null);

  useEffect(() => {
    obter("/api/dominio").then((r) => setTorres(r.torres)).catch((e) => setErro(e.message));
  }, []);

  async function analisar(e) {
    e.preventDefault();
    if (!repo.trim() || lendo) return;
    setLendo(true);
    setErro("");
    setRecusa(null);
    try {
      const r = await criar("/api/dominio", { repo: repo.trim() });
      if (r.id) return router.push(`/dominio/${r.id}`);
      setRecusa(r);
    } catch (e2) {
      setErro(e2.message);
    } finally {
      setLendo(false);
    }
  }

  return (
    <div className="dm">
      <div className="pf-cabecalho">
        <div>
          <h1>🗼 Modo Domínio</h1>
          <p>Traga um repositório e escale a torre dele: do básico ao difícil, até dominar o código e as tecnologias.</p>
        </div>
      </div>

      <section className="pf-cartao dm-novo">
        <div className="dm-novo__neuro" aria-hidden="true">
          <Neuro humor={lendo ? "pensando" : "feliz"} tamanho={100} />
        </div>
        <form className="dm-novo__form" onSubmit={analisar}>
          <label className="pf-campo">
            <span className="pf-campo__rotulo">Link do repositório (GitHub ou GitLab, público)</span>
            <input className="pf-campo__entrada" type="url" inputMode="url" placeholder="https://github.com/usuario/repositorio"
              value={repo} onChange={(e) => setRepo(e.target.value)} disabled={lendo} required />
          </label>
          <div className="dm-novo__acoes">
            <button type="submit" className="pf-botao" disabled={lendo || !repo.trim()}>{lendo ? "A Lisa está lendo…" : "Analisar repositório"}</button>
            <small>A Lisa lê o código, diz se ele aguenta um desafio e de que nível ele é. Só repositórios públicos: nenhum código privado passa pela IA.</small>
          </div>
          {lendo && <p className="dm-espera" role="status"><span className="dm-espera__ponto" aria-hidden="true" />Lendo o código do repositório — leva uns 30 segundos.</p>}
        </form>
      </section>

      {erro && <div className="pf-aviso pf-aviso--erro" style={{ marginTop: 12 }}>{erro}</div>}
      {recusa && (
        <div className="pf-cartao dm-recusa" role="status">
          <strong>🤔 {recusa.repo?.caminho} ainda não dá uma torre</strong>
          <p>{recusa.analise?.motivo}</p>
          <small>Tente um repositório com mais código: a torre precisa de pelo menos {MIN_ANDARES} desafios diferentes.</small>
        </div>
      )}

      <section className="pf-secao">
        <h2 className="pf-secao__titulo">Suas torres {torres?.length ? <small>{torres.length}</small> : null}</h2>
        {!torres ? <div className="pf-carregando">Carregando…</div>
          : !torres.length ? <p className="pf-vazio">Nenhuma torre ainda. Cole o link de um repositório acima para começar.</p>
          : (
            <div className="dm-lista">
              {torres.map((t) => (
                <Link key={t.id} href={`/dominio/${t.id}`} className={`pf-cartao dm-cartao dm-cartao--${t.status}`}>
                  <div className="dm-cartao__arte" aria-hidden="true">
                    {t.chefaoFinal ? <img src={urlDoMonstro(t.chefaoFinal)} alt="" width="64" height="64" /> : <span>🗼</span>}
                  </div>
                  <div className="dm-cartao__textos">
                    {t.status === "concluido" && <span className="pf-pilula pf-pilula--verde dm-cartao__selo">🏆 Conquistada</span>}
                    <strong className="dm-cartao__repo">{t.repo}</strong>
                    <span className="dm-cartao__meta">
                      Nível {t.nivel} · {t.nomeDoNivel}
                      {t.status === "analisado" ? " · falta montar a torre" : t.status === "montando" ? " · montando…" : ` · ${t.vencidos} de ${t.andares} andares`}
                    </span>
                    {t.andares ? <Barra valor={t.vencidos} total={t.andares} rotulo={`${t.vencidos} de ${t.andares} andares`} /> : null}
                    {t.chefaoFinal && <small>Guardião do topo: {chefaoPorId(t.chefaoFinal)?.nome}</small>}
                  </div>
                </Link>
              ))}
            </div>
          )}
      </section>

      <section className="pf-secao">
        <h2 className="pf-secao__titulo">Como funciona</h2>
        <div className="dm-como">
          <ol>
            <li><strong>A Lisa lê o repositório</strong> e decide o nível dele (1 a 5) — é o nível que manda no tamanho da torre e nos prêmios.</li>
            <li><strong>Você escolhe quantos andares</strong> (de {MIN_ANDARES} até o teto do nível): cada andar é um desafio, do básico ao difícil, com um chefão.</li>
            <li><strong>Crie uma branch</strong> para o desafio e, a cada andar, faça o commit e o push. A Lisa lê o que mudou e dá a nota.</li>
            <li><strong>O Neuro luta com o chefão</strong>: nota 60 ou mais vence e sobe; abaixo disso, melhore e tente de novo. Cada entrega dá atributos ao Neuro.</li>
            <li><strong>No topo</strong>, o certificado em PDF com tudo o que você dominou.</li>
          </ol>
          <table className="dm-niveis">
            <caption>Os níveis e o que cada um pode dar</caption>
            <thead><tr><th scope="col">Nível</th><th scope="col">Andares</th><th scope="col">Prêmios</th></tr></thead>
            <tbody>
              {Object.entries(NIVEIS).map(([n, v]) => (
                <tr key={n}><td>{n} · {v.nome}</td><td>{MIN_ANDARES}–{v.maxAndares}</td><td>{v.recompensas.map((r) => NOMES_DOS_PREMIOS[r]).join(", ")}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="dm-nota">Os pontos de cada andar viram moedas, sobem no ranking e contam para a ofensiva do dia.</p>
      </section>
    </div>
  );
}
