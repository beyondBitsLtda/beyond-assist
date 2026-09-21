"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { obter, criar, mudar, remover } from "@/lib/api.js";
import ImportarDoTrello from "@/componentes/ImportarDoTrello.js";
import QuadroGen from "@/componentes/QuadroGen.js";
import AvisoDeLimite from "@/componentes/AvisoDeLimite.js";

const PAPEL_EM_PALAVRAS = {
  dono: "seu",
  editor: "pode editar",
  comentarista: "pode comentar",
  leitor: "só leitura",
};

/** A primeira tela de quem entra: os quadros dele. */
export default function Quadros() {
  const [quadros, setQuadros] = useState(null);
  const [arquivados, setArquivados] = useState(0);
  const [vendoArquivados, setVendoArquivados] = useState(false);
  const [erro, setErro] = useState("");
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [temLisa, setTemLisa] = useState(false);
  const [menuAberto, setMenuAberto] = useState(null);
  const campo = useRef(null);
  const router = useRouter();

  const carregar = useCallback(async (arquivados = false) => {
    try {
      const d = await obter(`/api/quadros${arquivados ? "?arquivados=1" : ""}`);
      setQuadros(d.quadros);
      setVendoArquivados(Boolean(d.mostrandoArquivados));
      if (!d.mostrandoArquivados) setArquivados(d.arquivados || 0);
      setErro("");
    } catch (e) {
      setErro(e.message);
    }
  }, []);

  useEffect(() => { carregar(false); }, [carregar]);

  // O Quadro Gen é a Lisa, então segue a mesma liberação dela. Esconder o botão é conforto:
  // quem decide é a rota, que recusa com 403.
  useEffect(() => {
    let vivo = true;
    fetch("/api/lisa")
      .then((r) => (r.ok ? r.json() : { podeUsar: false }))
      .then((d) => { if (vivo) setTemLisa(Boolean(d?.podeUsar)); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);
  useEffect(() => { if (criando) campo.current?.focus(); }, [criando]);

  async function enviar(e) {
    e?.preventDefault();
    const t = nome.trim();
    if (!t || enviando) return;
    setEnviando(true);
    setErro("");
    try {
      const d = await criar("/api/quadros", { nome: t });
      // Vai direto para o quadro novo. Voltar para a lista obrigaria a procurá-lo e clicar de
      // novo — e quem acabou de criar um quadro quer usá-lo, não admirá-lo na lista.
      router.push(`/quadros/${d.quadro.id}`);
    } catch (x) {
      setErro(x.message);
      setEnviando(false);
    }
  }

  async function arquivar(quadro) {
    setMenuAberto(null);
    // O aviso diz o que acontece E o que NÃO acontece. "Arquivar" assusta porque parece
    // apagar, e a única coisa que tira o susto é dizer que dá para trazer de volta.
    if (!window.confirm(
      `Arquivar "${quadro.nome}"?\n\nEle sai desta lista, mas nada é apagado: as colunas, os cards e as checklists continuam guardados, e dá para restaurar quando quiser.`
    )) return;
    try {
      await remover(`/api/quadros/${quadro.id}`);
      await carregar(vendoArquivados);
    } catch (e) { setErro(e.message); }
  }

  async function restaurar(quadro) {
    setMenuAberto(null);
    try {
      await mudar(`/api/quadros/${quadro.id}`, { arquivado: false });
      await carregar(true);
    } catch (e) { setErro(e.message); }
  }

  const vazio = quadros?.length === 0;

  return (
    <>
      <header className="abacato-conteudo__cabecalho">
        <h1 className="abacato-conteudo__titulo">
          {vendoArquivados ? "Quadros arquivados" : "Quadros"}
        </h1>
        {!criando && (
          <div className="abacato-bloco__acoes">
            {vendoArquivados ? (
              <button className="abacato-botao abacato-botao--fantasma" onClick={() => carregar(false)}>
                ← Voltar aos quadros
              </button>
            ) : (
              <>
                {arquivados > 0 && (
                  <button className="abacato-botao abacato-botao--fantasma" onClick={() => carregar(true)}>
                    Arquivados ({arquivados})
                  </button>
                )}
                {/* Só aparece para quem tem a assistente liberada — o Quadro Gen é ela. */}
                {temLisa && (
                  <button className="abacato-botao abacato-botao--fantasma" onClick={() => setGerando(true)}>
                    ✦ Montar com a Lisa
                  </button>
                )}
                <button className="abacato-botao abacato-botao--fantasma" onClick={() => setImportando(true)}>
                  Trazer do Trello
                </button>
                <button className="abacato-botao" onClick={() => setCriando(true)}>+ Novo quadro</button>
              </>
            )}
          </div>
        )}
      </header>

      <AvisoDeLimite qual="quadros" nome="quadros" />

      {criando && (
        <form className="abacato-criar-quadro" onSubmit={enviar}>
          <input
            ref={campo}
            className="abacato-campo__entrada"
            placeholder="Nome do quadro — ex.: Obra Delp, Comercial 2026"
            value={nome}
            maxLength={120}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") { setNome(""); setCriando(false); } }}
          />
          <button className="abacato-botao" type="submit" disabled={!nome.trim() || enviando}>
            {enviando ? "Criando…" : "Criar"}
          </button>
          <button type="button" className="abacato-icone" aria-label="cancelar"
            onClick={() => { setNome(""); setCriando(false); }}>✕</button>
        </form>
      )}

      {erro && <div className="abacato-campo__erro" style={{ marginBottom: 16 }}>⚠ {erro}</div>}

      {quadros === null && <div className="abacato-vazio">carregando…</div>}

      {vazio && vendoArquivados && (
        <div className="abacato-vazio">
          <p className="abacato-vazio__titulo">Nenhum quadro arquivado</p>
          <p>Tudo que você tem está na lista principal.</p>
        </div>
      )}

      {vazio && !vendoArquivados && !criando && (
        <div className="abacato-vazio">
          <p className="abacato-vazio__titulo">Nenhum quadro ainda</p>
          <p>Crie o primeiro. Ele já nasce com as colunas A fazer, Fazendo e Feito.</p>
          <p style={{ marginTop: 18 }} className="abacato-vazio__acoes">
            <button className="abacato-botao" onClick={() => setCriando(true)}>+ Criar o primeiro quadro</button>
            <button className="abacato-botao abacato-botao--fantasma" onClick={() => setImportando(true)}>
              Trazer um do Trello
            </button>
          </p>
        </div>
      )}

      {importando && (
        <ImportarDoTrello aoFechar={() => setImportando(false)} aoTerminar={() => carregar(false)} />
      )}

      {gerando && <QuadroGen aoFechar={() => setGerando(false)} />}

      {quadros?.length > 0 && (
        <div className="abacato-grade">
          {quadros.map((q) => (
            <div key={q.id} className="abacato-quadro-cartao">
              {/* A capa usa o MESMO valor do papel de parede do quadro — que pode ser um
                  gradiente ou uma imagem. Os dois entram como `background` e o CSS resolve o
                  enquadramento, sem a tela precisar saber qual dos dois veio. */}
              <span
                className="abacato-quadro-cartao__faixa"
                style={{ background: q.papel_de_parede || "linear-gradient(135deg, #0F2A1D, #1B4332)" }}
              />

              {/* O link cobre o cartão inteiro por baixo, e o menu fica POR CIMA. Um <button>
                  dentro de um <a> é HTML inválido e o clique fica imprevisível — foi por isso
                  que o cartão deixou de ser um link e virou uma caixa com um link dentro. */}
              <Link href={`/quadros/${q.id}`} className="abacato-quadro-cartao__area" aria-label={`Abrir ${q.nome}`} />

              <div className="abacato-quadro-cartao__nome">{q.nome}</div>
              {q.descricao && <div className="abacato-quadro-cartao__descricao">{q.descricao}</div>}

              <div className="abacato-quadro-cartao__rodape">
                <span className="abacato-etiqueta abacato-etiqueta--ok">{PAPEL_EM_PALAVRAS[q.papel] || q.papel}</span>
                {vendoArquivados && <span className="abacato-dica">arquivado</span>}
              </div>

              {/* Só o dono arquiva e restaura — é o que a rota exige, e mostrar o botão para
                  quem vai levar 403 é pior que não mostrar. */}
              {q.papel === "dono" && (
                <div className="abacato-menu abacato-quadro-cartao__menu">
                  <button
                    type="button"
                    className="abacato-icone"
                    aria-label={`opções de ${q.nome}`}
                    onClick={() => setMenuAberto(menuAberto === q.id ? null : q.id)}
                  >⋯</button>
                  {menuAberto === q.id && (
                    <>
                      <div className="abacato-menu__fundo" onClick={() => setMenuAberto(null)} />
                      <div className="abacato-menu__caixa abacato-menu__caixa--direita" role="menu">
                        {vendoArquivados ? (
                          <button type="button" className="abacato-menu__item" onClick={() => restaurar(q)}>
                            ↩ Restaurar quadro
                          </button>
                        ) : (
                          <button type="button" className="abacato-menu__item abacato-menu__item--perigo"
                            onClick={() => arquivar(q)}>
                            Arquivar quadro
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
