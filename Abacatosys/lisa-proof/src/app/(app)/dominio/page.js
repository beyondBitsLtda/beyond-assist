"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { obter, criar } from "@/lib/api.js";
import { Barra } from "@/componentes/Pecas.js";
import Neuro from "@/componentes/Neuro.js";
import { NIVEIS, MIN_ANDARES, chefaoPorId, PERFIS_DE_TORRE, TORRES_DE_TEMA } from "@/dominio/modoDominio.js";
import { PERFIS } from "@/dominio/perfis.js";
import { urlDoMonstro } from "@/componentes/reino/monstrosDePapel.js";

const NOMES_DOS_PREMIOS = { moedas: "🪙 moedas", tropas: "⚔️ tropas", defesas: "🛡️ defesas", veiculo: "🚀 veículo", avatar: "👑 chefão-avatar" };

/** O Modo Domínio: escolher um repositório (ou um tema), ver se ele dá uma torre e escalar. */
export default function PaginaDoDominio() {
  const router = useRouter();
  const [torres, setTorres] = useState(null);
  const [origem, setOrigem] = useState("repositorio");
  const [repo, setRepo] = useState("");
  const [tema, setTema] = useState("");
  const [perfil, setPerfil] = useState("musica");
  const [ponto, setPonto] = useState("");
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState("");
  const [recusa, setRecusa] = useState(null);

  useEffect(() => {
    obter("/api/dominio").then((r) => setTorres(r.torres)).catch((e) => setErro(e.message));
  }, []);

  const doTema = origem === "tema";
  const pronto = doTema ? tema.trim().length >= 3 : Boolean(repo.trim());

  async function analisar(e) {
    e.preventDefault();
    if (!pronto || lendo) return;
    setLendo(true);
    setErro("");
    setRecusa(null);
    try {
      const r = await criar("/api/dominio", doTema ? { tema: tema.trim(), perfil, ponto: ponto.trim() } : { repo: repo.trim() });
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
          <p>Traga um repositório — ou um tema de música, idiomas, matemática ou qualquer outro — e escale a torre dele: do básico ao difícil, até dominar.</p>
        </div>
      </div>

      <section className="pf-cartao dm-novo">
        <div className="dm-novo__neuro" aria-hidden="true">
          <Neuro humor={lendo ? "pensando" : "feliz"} tamanho={100} />
        </div>
        <form className="dm-novo__form" onSubmit={analisar}>
          <div className="pf-dias" role="radiogroup" aria-label="De onde vem a torre">
            <button type="button" role="radio" className="pf-dia" aria-checked={!doTema} aria-pressed={!doTema} disabled={lendo} onClick={() => setOrigem("repositorio")}>💻 Repositório de código</button>
            <button type="button" role="radio" className="pf-dia" aria-checked={doTema} aria-pressed={doTema} disabled={lendo} onClick={() => setOrigem("tema")}>🎯 Um tema</button>
          </div>
          {doTema ? (
            <>
              <div className="pf-dias" role="radiogroup" aria-label="Tipo da torre">
                {PERFIS_DE_TORRE.map((p) => (
                  <button key={p} type="button" role="radio" className="pf-dia" aria-checked={perfil === p} aria-pressed={perfil === p} disabled={lendo} onClick={() => setPerfil(p)}>
                    {PERFIS[p].emoji} {PERFIS[p].nome}
                  </button>
                ))}
              </div>
              <small className="pf-estat__nota" style={{ margin: 0 }}><strong>{TORRES_DE_TEMA[perfil].nome}:</strong> {TORRES_DE_TEMA[perfil].explicacao}</small>
              <label className="pf-campo">
                <span className="pf-campo__rotulo">Tema</span>
                <input className="pf-campo__entrada" maxLength={80} value={tema} onChange={(e) => setTema(e.target.value)} disabled={lendo} required
                  placeholder={{ musica: "violão popular, canto, piano clássico", idiomas: "inglês, espanhol para viagem", matematica: "cálculo 1, geometria plana", livre: "fotografia, culinária, oratória" }[perfil]} />
              </label>
              <label className="pf-campo">
                <span className="pf-campo__rotulo">De onde você parte (opcional)</span>
                <input className="pf-campo__entrada" maxLength={300} value={ponto} onChange={(e) => setPonto(e.target.value)} disabled={lendo}
                  placeholder="ex.: já toco acordes abertos; nível A2; nunca estudei o assunto" />
              </label>
            </>
          ) : (
            <label className="pf-campo">
              <span className="pf-campo__rotulo">Link do repositório (GitHub ou GitLab, público)</span>
              <input className="pf-campo__entrada" type="url" inputMode="url" placeholder="https://github.com/usuario/repositorio"
                value={repo} onChange={(e) => setRepo(e.target.value)} disabled={lendo} required />
            </label>
          )}
          <div className="dm-novo__acoes">
            <button type="submit" className="pf-botao" disabled={lendo || !pronto}>{lendo ? "A Lisa está pensando…" : doTema ? "Analisar o tema" : "Analisar repositório"}</button>
            <small>{doTema
              ? "A Lisa diz se o tema dá uma torre e de que nível. Cada andar é entregue por texto, fotos, áudio ou vídeo do YouTube."
              : "A Lisa lê o código, diz se ele aguenta um desafio e de que nível ele é. Só repositórios públicos: nenhum código privado passa pela IA."}</small>
          </div>
          {lendo && <p className="dm-espera" role="status"><span className="dm-espera__ponto" aria-hidden="true" />{doTema ? "Planejando a torre do tema — leva uns 20 segundos." : "Lendo o código do repositório — leva uns 30 segundos."}</p>}
        </form>
      </section>

      {erro && <div className="pf-aviso pf-aviso--erro" style={{ marginTop: 12 }}>{erro}</div>}
      {recusa && (
        <div className="pf-cartao dm-recusa" role="status">
          <strong>🤔 {recusa.tema || recusa.repo?.caminho} ainda não dá uma torre</strong>
          <p>{recusa.analise?.motivo}</p>
          <small>{recusa.tema ? "Tente um tema mais concreto (o que você quer saber fazer)" : "Tente um repositório com mais código"}: a torre precisa de pelo menos {MIN_ANDARES} desafios diferentes.</small>
        </div>
      )}

      <section className="pf-secao">
        <h2 className="pf-secao__titulo">Suas torres {torres?.length ? <small>{torres.length}</small> : null}</h2>
        {!torres ? <div className="pf-carregando">Carregando…</div>
          : !torres.length ? <p className="pf-vazio">Nenhuma torre ainda. Cole o link de um repositório ou escreva um tema acima para começar.</p>
          : (
            <div className="dm-lista">
              {torres.map((t) => (
                <Link key={t.id} href={`/dominio/${t.id}`} className={`pf-cartao dm-cartao dm-cartao--${t.status}`}>
                  <div className="dm-cartao__arte" aria-hidden="true">
                    {t.chefaoFinal ? <img src={urlDoMonstro(t.chefaoFinal)} alt="" width="64" height="64" /> : <span>🗼</span>}
                  </div>
                  <div className="dm-cartao__textos">
                    {t.status === "concluido" && <span className="pf-pilula pf-pilula--verde dm-cartao__selo">🏆 Conquistada</span>}
                    <strong className="dm-cartao__repo">{t.origem === "tema" ? `${PERFIS[t.perfil]?.emoji || "🎯"} ${t.titulo}` : t.titulo}</strong>
                    <span className="dm-cartao__meta">
                      {t.origem === "tema" ? `${t.tipoDaTorre} · ` : ""}Nível {t.nivel} · {t.nomeDoNivel}
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
            <li><strong>A Lisa lê o repositório</strong> (ou planeja o tema) e decide o nível dele (1 a 5) — é o nível que manda no tamanho da torre e nos prêmios.</li>
            <li><strong>Você escolhe quantos andares</strong> (de {MIN_ANDARES} até o teto do nível): cada andar é um desafio, do básico ao difícil, com um chefão.</li>
            <li><strong>Repositório:</strong> crie uma branch para o desafio e, a cada andar, faça o commit e o push. A Lisa lê o que mudou e dá a nota. <strong>Tema:</strong> cada andar é entregue na própria tela, por texto, fotos, áudio ou vídeo do YouTube.</li>
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
