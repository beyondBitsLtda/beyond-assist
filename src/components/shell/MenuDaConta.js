"use client";

// A conta (01/11/2026: "faltou um botão de poder sair da Lisa, sair do login, e poder ver as
// informações da conta"). Um menu no topo (MenuDaConta) e o mesmo conteúdo nas configurações do
// Assistente no celular, que é tela cheia e não tem topo (ContaNoCelular): o e-mail, o tipo de
// acesso, e — para o usuário do MVP — o uso de hoje e o perfil da entrevista (com "apagar"). E Sair:
// encerra a sessão no Supabase e no navegador (/api/auth/logout) e volta para o login.

import { useCallback, useEffect, useState } from "react";
import Suspenso, { GrupoDoMenu, ItemDoMenu } from "./Suspenso.js";

const NOMES_DO_USO = { pergunta: "Perguntas", desenho: "Desenhos", tela: "Comentários de tela", voz: "Falas" };

/** Lê a conta (e o perfil, para o usuário) quando o menu abre. */
function useConta() {
  const [conta, setConta] = useState(null);
  const [perfil, setPerfil] = useState(undefined); // undefined: não lido; null: sem perfil
  const carregar = useCallback(async () => {
    try {
      const c = await fetch("/api/auth/eu").then((r) => r.json());
      setConta(c);
      if (c?.papel === "usuario") {
        const p = await fetch("/api/perfil").then((r) => r.json()).catch(() => ({}));
        setPerfil(p?.ok ? p.perfil || null : undefined);
      }
    } catch { /* o menu mostra o que tiver */ }
  }, []);
  return { conta, perfil, setPerfil, carregar };
}

async function sair() {
  try { await fetch("/api/auth/logout", { method: "POST" }); } catch { /* sai mesmo assim */ }
  try { sessionStorage.clear(); } catch { /* sem armazenamento */ }
  window.location.href = "/login";
}

/** O conteúdo da conta, igual no menu do topo e no celular. `Linha` e `Botao` vêm de cada lugar. */
function Conteudo({ conta, perfil, setPerfil, Linha, Botao, Titulo }) {
  const [confirmarApagar, setConfirmarApagar] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const usuario = conta?.papel === "usuario";
  const apagarPerfil = async () => {
    if (!confirmarApagar) { setConfirmarApagar(true); return; }
    const r = await fetch("/api/perfil", { method: "DELETE" }).then((x) => x.json()).catch(() => ({}));
    setConfirmarApagar(false);
    if (r.ok) setPerfil(null);
  };
  return (
    <>
      <Titulo>Conta</Titulo>
      <Linha rotulo="E-mail" valor={conta?.email || (conta ? "—" : "…")} />
      <Linha rotulo="Acesso" valor={!conta ? "…" : usuario ? "Usuário · versão MVP" : "Administrador · completo"} />
      {usuario && conta?.uso && (
        <>
          <Titulo>Uso de hoje</Titulo>
          {Object.entries(conta.uso).map(([tipo, u]) => <Linha key={tipo} rotulo={NOMES_DO_USO[tipo] || tipo} valor={`${u.usados} de ${u.limite}`} />)}
        </>
      )}
      {usuario && (
        <>
          <Titulo>Perfil da entrevista</Titulo>
          {perfil === undefined ? <Linha rotulo="Perfil" valor="…" /> : perfil ? (
            <>
              {perfil.nome && <Linha rotulo="Nome" valor={perfil.nome} />}
              {perfil.area && <Linha rotulo="Área" valor={perfil.area} />}
              {perfil.nivel && <Linha rotulo="Nível" valor={perfil.nivel} />}
              <Botao onClick={apagarPerfil} detalhe={confirmarApagar ? "Clique de novo para confirmar — não tem volta" : "Apaga o que você contou na entrevista"} perigo>
                {confirmarApagar ? "Confirmar: apagar meu perfil" : "Apagar meu perfil"}
              </Botao>
            </>
          ) : (
            <Linha rotulo="Perfil" valor="ainda não fez a entrevista" />
          )}
        </>
      )}
      <Botao onClick={() => { setSaindo(true); sair(); }} detalhe="Encerra a sessão neste aparelho" disabled={saindo}>
        {saindo ? "Saindo…" : "Sair da Lisa"}
      </Botao>
    </>
  );
}

// ---- no topo (computador e painéis) ----

const LinhaDoMenu = ({ rotulo, valor }) => (
  <div className="bb-linha-de-status"><span>{rotulo}</span><em className="bb-conta-valor">{valor}</em></div>
);
const BotaoDoMenu = ({ children, onClick, detalhe, disabled, perigo }) => (
  <ItemDoMenu onClick={onClick} detalhe={detalhe} disabled={disabled} fecharAoClicar={false}>
    <span className={perigo ? "bb-conta-perigo" : undefined}>{children}</span>
  </ItemDoMenu>
);
const TituloDoMenu = ({ children }) => <div className="bb-grupo-titulo">{children}</div>;

export default function MenuDaConta() {
  const { conta, perfil, setPerfil, carregar } = useConta();
  return (
    <Suspenso
      titulo="Conta"
      largura={300}
      aoMudar={(aberto) => { if (aberto) carregar(); }}
      rotulo={
        <>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="8" cy="5.5" r="2.8" /><path d="M2.8 14c.6-2.8 2.7-4.3 5.2-4.3s4.6 1.5 5.2 4.3" /></svg>
          <span className="bb-rotulo">Conta</span>
        </>
      }
    >
      <GrupoDoMenu>
        <Conteudo conta={conta} perfil={perfil} setPerfil={setPerfil} Linha={LinhaDoMenu} Botao={BotaoDoMenu} Titulo={TituloDoMenu} />
      </GrupoDoMenu>
    </Suspenso>
  );
}

// ---- nas configurações do Assistente no celular ----

const LinhaDoCelular = ({ rotulo, valor }) => (
  <div className="bb-conta-celular-linha"><span>{rotulo}</span><b>{valor}</b></div>
);
const BotaoDoCelular = ({ children, onClick, detalhe, disabled, perigo }) => (
  <button type="button" className={`bb-conta-celular-botao${perigo ? " bb-conta-celular-botao--perigo" : ""}`} onClick={onClick} disabled={disabled} title={detalhe}>
    {children}
  </button>
);
const TituloDoCelular = ({ children }) => <div className="bb-conta-celular-titulo">{children}</div>;

export function ContaNoCelular() {
  const { conta, perfil, setPerfil, carregar } = useConta();
  // (as configurações do celular abrem este bloco já visível: lê ao montar)
  useEffect(() => { carregar(); }, [carregar]);
  return (
    <div className="bb-conta-celular">
      <Conteudo conta={conta} perfil={perfil} setPerfil={setPerfil} Linha={LinhaDoCelular} Botao={BotaoDoCelular} Titulo={TituloDoCelular} />
    </div>
  );
}
