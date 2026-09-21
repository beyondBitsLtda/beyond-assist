"use client";

import { useCallback, useEffect, useState } from "react";
import { obter, criar, mudar } from "@/lib/api.js";
import { guardarSenha } from "@/lib/abacatoAuth.js";
import { sortearSenha, emailValido } from "@/dominio/papeis.js";
import { Usuario } from "@/dominio/Quadro.js";

/**
 * As contas do Abacato.
 *
 * A senha é sorteada e esticada AQUI, no navegador de quem está criando — o servidor recebe só
 * o selo, como num login. Ela aparece uma vez na tela, para ser entregue à pessoa, e depois
 * ninguém mais consegue lê-la: nem quem criou, nem o banco, nem eu.
 *
 * É por isso que a tela insiste tanto em copiá-la antes de fechar. Perder essa senha não é
 * grave — dá para sortear outra — mas é um retrabalho que uma frase evita.
 */
function quando(iso) {
  if (!iso) return "nunca entrou";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function Pessoas() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [ehAdmin, setEhAdmin] = useState(false);
  const [comLisa, setComLisa] = useState(false);
  const [tipo, setTipo] = useState("interno");
  const [convites, setConvites] = useState(null);
  const [rotuloDoConvite, setRotuloDoConvite] = useState("");
  // O endereço do sistema, para montar o link inteiro que se copia. Vem de um efeito, e não de
  // `window.location` direto: este componente também é desenhado no servidor, onde `window` não
  // existe — e ler ali quebraria a hidratação além de estourar o render.
  const [origem, setOrigem] = useState("");
  const [trabalhando, setTrabalhando] = useState(false);
  const [senhaNova, setSenhaNova] = useState(null);   // { nome, email, senha }
  const [copiado, setCopiado] = useState(false);

  const carregar = useCallback(async () => {
    try { setDados(await obter("/api/usuarios?tudo=1")); setErro(""); }
    catch (e) { setErro(e.message); }
  }, []);

  // Os links de cadastro vêm numa chamada separada, e a falha dela não derruba a tela: sem
  // convite ainda dá para criar contas à mão, que é como o sistema funcionou até aqui.
  const carregarConvites = useCallback(async () => {
    try { setConvites((await obter("/api/convites")).convites); }
    catch { setConvites([]); }
  }, []);

  useEffect(() => { carregar(); carregarConvites(); }, [carregar, carregarConvites]);
  useEffect(() => { setOrigem(window.location.origin); }, []);

  async function criarPessoa(e) {
    e?.preventDefault();
    if (trabalhando) return;
    if (!emailValido(email)) return setErro("esse e-mail não parece certo");
    if (!nome.trim()) return setErro("falta o nome");

    setTrabalhando(true);
    setErro("");
    try {
      const senha = sortearSenha();
      // O cálculo pesado acontece aqui. Numa máquina lenta são alguns décimos de segundo — por
      // isso o botão já diz "Criando…" desde o clique.
      const guardada = await guardarSenha(email.trim(), senha);
      await criar("/api/usuarios", {
        email: email.trim(),
        nome: nome.trim(),
        hash: guardada.hash,
        sal: guardada.sal,
        iteracoes: guardada.iteracoes,
        tipo,
        // Conta de cliente não administra e não fala com a assistente. A trava real está no
        // servidor e no banco; aqui é só não mandar o que seria recusado.
        admin: tipo === "cliente" ? false : ehAdmin,
        lisa: tipo === "cliente" ? false : comLisa,
      });
      setSenhaNova({ nome: nome.trim(), email: email.trim().toLowerCase(), senha });
      setNome(""); setEmail(""); setEhAdmin(false); setComLisa(false); setTipo("interno"); setCriando(false);
      await carregar();
    } catch (x) {
      setErro(x.message);
    } finally {
      setTrabalhando(false);
    }
  }

  async function novaSenhaPara(pessoa) {
    if (!window.confirm(
      `Sortear uma senha nova para ${pessoa.nome}?\n\nA senha atual dela para de funcionar na hora, e a nova aparece aqui uma única vez.`
    )) return;
    setTrabalhando(true);
    setErro("");
    try {
      const senha = sortearSenha();
      const guardada = await guardarSenha(pessoa.email, senha);
      await mudar(`/api/usuarios/${pessoa.id}`, {
        hash: guardada.hash, sal: guardada.sal, iteracoes: guardada.iteracoes,
      });
      setSenhaNova({ nome: pessoa.nome, email: pessoa.email, senha });
    } catch (x) { setErro(x.message); }
    finally { setTrabalhando(false); }
  }

  async function alternar(pessoa, campo) {
    setErro("");
    try {
      await mudar(`/api/usuarios/${pessoa.id}`, { [campo]: !pessoa[campo] });
      await carregar();
    } catch (x) { setErro(x.message); }
  }

  /** Aprovar ou recusar um cadastro que veio de fora. Recusar pede confirmação porque desliga a
   *  conta junto — e a pessoa do outro lado já escolheu uma senha. */
  async function decidir(pessoa, aprovado) {
    if (!aprovado && !window.confirm(
      `Recusar o cadastro de ${pessoa.nome} (${pessoa.email})?

A conta fica desligada e a pessoa não consegue entrar.`
    )) return;
    setErro("");
    try {
      await mudar(`/api/usuarios/${pessoa.id}`, { aprovado });
      await carregar();
    } catch (x) { setErro(x.message); }
  }

  async function novoConvite(e) {
    e?.preventDefault();
    setErro("");
    try {
      await criar("/api/convites", { rotulo: rotuloDoConvite.trim() || null, tipo: "cliente" });
      setRotuloDoConvite("");
      await carregarConvites();
    } catch (x) { setErro(x.message); }
  }

  async function ligarConvite(convite, ativo) {
    setErro("");
    try {
      await mudar(`/api/convites/${convite.id}`, { ativo });
      await carregarConvites();
    } catch (x) { setErro(x.message); }
  }

  if (erro && !dados) {
    return (
      <div className="abacato-vazio">
        <p className="abacato-vazio__titulo">Não deu para abrir esta tela</p>
        <p>{erro}</p>
      </div>
    );
  }
  if (!dados) return <div className="abacato-vazio">carregando…</div>;

  if (!dados.souAdmin) {
    return (
      <div className="abacato-vazio">
        <p className="abacato-vazio__titulo">Esta tela é de quem administra</p>
        <p>Peça a um administrador do Abacato para criar ou mudar contas.</p>
      </div>
    );
  }

  // Quem pediu conta e ainda espera fica numa lista separada, e não misturado com quem já
  // entra. Um cartão de "esperando" no meio de vinte contas ativas é um cartão que ninguém vê.
  const aguardando = dados.usuarios.filter((p) => p.aprovado === false);
  const jaEntram = dados.usuarios.filter((p) => p.aprovado !== false);

  return (
    <>
      <header className="abacato-conteudo__cabecalho">
        <h1 className="abacato-conteudo__titulo">Pessoas</h1>
        {!criando && (
          <button className="abacato-botao" onClick={() => setCriando(true)}>+ Nova pessoa</button>
        )}
      </header>

      {erro && <div className="abacato-campo__erro" style={{ marginBottom: 14 }}>⚠ {erro}</div>}

      {/* ----------------------------------------- quem se cadastrou e ainda não entra
          Fica em PRIMEIRO na tela, e só aparece quando há alguém: é a única coisa aqui que
          alguém do lado de fora está esperando. No meio da lista, passaria dias despercebida. */}
      {aguardando.length > 0 && (
        <section className="abacato-bloco" style={{ marginBottom: 16 }}>
          <h3 className="abacato-bloco__titulo">
            Aguardando aprovação ({aguardando.length})
          </h3>
          <p className="abacato-dica abacato-dica--bloco">
            Estas pessoas se cadastraram por um link de convite e <strong>ainda não conseguem
            entrar</strong>. Aprovar libera a entrada; não dá acesso a quadro nenhum.
          </p>
          <div className="abacato-pessoas">
            {aguardando.map((p) => (
              <div key={p.id} className="abacato-pessoa-cartao">
                <span className="abacato-avatar">{new Usuario(p).iniciais}</span>
                <div className="abacato-pessoa-cartao__meio">
                  <strong>
                    {p.nome}
                    <span className={`abacato-selo abacato-selo--${p.tipo}`}>{p.tipo}</span>
                  </strong>
                  <span className="abacato-dica">{p.email} · pediu em {quando(p.criado_em)}</span>
                </div>
                <div className="abacato-pessoa-cartao__acoes">
                  <button type="button" className="abacato-botao abacato-botao--pequeno"
                    onClick={() => decidir(p, true)}>Aprovar</button>
                  <button type="button" className="abacato-botao abacato-botao--perigo abacato-botao--pequeno"
                    onClick={() => decidir(p, false)}>Recusar</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ----------------------------------------- os links de cadastro */}
      <section className="abacato-bloco" style={{ marginBottom: 16 }}>
        <h3 className="abacato-bloco__titulo">Links de cadastro</h3>
        <p className="abacato-dica abacato-dica--bloco">
          Um link deixa alguém de fora criar a própria conta de cliente — que nasce esperando a
          sua aprovação e <strong>não alcança nada</strong> do que já existe aqui. Cada link vale
          14 dias e 20 cadastros.
        </p>

        <form className="abacato-rapido" onSubmit={novoConvite}>
          <input className="abacato-campo__entrada" value={rotuloDoConvite}
            onChange={(e) => setRotuloDoConvite(e.target.value)}
            placeholder="para que serve este link? ex.: clientes da obra Sul" />
          <button className="abacato-botao abacato-botao--pequeno" type="submit">Gerar link</button>
        </form>

        {convites === null ? (
          <p className="abacato-dica">carregando…</p>
        ) : convites.length === 0 ? (
          <p className="abacato-dica">Nenhum link ainda.</p>
        ) : (
          <div style={{ marginTop: 10 }}>
            {convites.map((c) => {
              const venceu = c.expira_em && new Date(c.expira_em) < new Date();
              const gasto = c.usos >= c.max_usos;
              const morto = !c.ativo || venceu || gasto;
              const endereco = `${origem}/cadastro/${c.token}`;
              return (
                <div key={c.id} className={`abacato-convite${morto ? " abacato-convite__morto" : ""}`}>
                  <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                    <strong style={{ fontSize: 13 }}>{c.rotulo || "sem descrição"}</strong>
                    <div className="abacato-dica">
                      {c.usos} de {c.max_usos} usos ·{" "}
                      {venceu ? "venceu" : `vale até ${quando(c.expira_em)}`}
                      {!c.ativo && " · desligado"}
                    </div>
                  </div>
                  <code className="abacato-convite__link">{endereco}</code>
                  <button type="button" className="abacato-botao abacato-botao--fantasma abacato-botao--pequeno"
                    onClick={() => navigator.clipboard?.writeText(endereco)}>Copiar</button>
                  <button type="button"
                    className={`abacato-botao abacato-botao--pequeno ${c.ativo ? "abacato-botao--perigo" : "abacato-botao--fantasma"}`}
                    onClick={() => ligarConvite(c, !c.ativo)}>
                    {c.ativo ? "Desligar" : "Religar"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ------------------------------------------------ a senha, uma vez só */}
      {senhaNova && (
        <section className="abacato-bloco abacato-senha-nova">
          <h3 className="abacato-bloco__titulo">Senha de {senhaNova.nome}</h3>
          <p className="abacato-dica abacato-dica--bloco">
            Copie agora e entregue à pessoa. <strong>Ela não aparece de novo</strong> — nem para
            você: o que fica guardado não permite voltar à senha.
          </p>
          <div className="abacato-rapido">
            <input className="abacato-campo__entrada abacato-senha-nova__campo" readOnly
              value={senhaNova.senha} onFocus={(e) => e.target.select()} />
            <button type="button" className="abacato-botao abacato-botao--pequeno"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(`Abacato — ${senhaNova.email}\nsenha: ${senhaNova.senha}`);
                  setCopiado(true);
                  setTimeout(() => setCopiado(false), 2500);
                } catch {
                  setErro("seu navegador não deixou copiar; o texto está selecionado, use Ctrl+C");
                }
              }}>
              {copiado ? "✓ Copiado" : "Copiar e-mail + senha"}
            </button>
          </div>
          <button type="button" className="abacato-botao abacato-botao--fantasma abacato-botao--pequeno"
            onClick={() => setSenhaNova(null)}>Já entreguei, pode fechar</button>
        </section>
      )}

      {criando && (
        <form className="abacato-bloco" onSubmit={criarPessoa} style={{ marginBottom: 16 }}>
          <h3 className="abacato-bloco__titulo">Nova pessoa</h3>
          <div className="abacato-datas">
            <label className="abacato-campo">
              <span className="abacato-campo__rotulo">Nome</span>
              <input className="abacato-campo__entrada" value={nome} autoFocus
                onChange={(e) => setNome(e.target.value)} placeholder="Maria Silva" />
            </label>
            <label className="abacato-campo">
              <span className="abacato-campo__rotulo">E-mail</span>
              <input className="abacato-campo__entrada" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="maria@beyond.dev.br" />
            </label>
          </div>

          <label className="abacato-campo">
            <span className="abacato-campo__rotulo">Tipo de conta</span>
            <select className="abacato-campo__entrada" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="interno">Interna — da casa, sem limites</option>
              <option value="cliente">Cliente — de fora, com limites de uso</option>
            </select>
          </label>

          {tipo === "cliente" ? (
            <p className="abacato-dica">
              A conta de cliente cria até <strong>10 quadros</strong> e{" "}
              <strong>10 projetos</strong>, compartilha <strong>3</strong> de cada com até{" "}
              <strong>3 pessoas</strong>, e guarda até <strong>4 GB</strong> de arquivos. Não
              administra o Abacato, não fala com a Lisa e não enxerga nenhum quadro que já
              exista — só o que ela criar e o que alguém compartilhar com ela.
            </p>
          ) : (
            <>
              <label className="abacato-concluir">
                <input type="checkbox" checked={ehAdmin} onChange={(e) => setEhAdmin(e.target.checked)} />
                Também administra o Abacato
              </label>
              <label className="abacato-concluir">
                <input type="checkbox" checked={comLisa} onChange={(e) => setComLisa(e.target.checked)} />
                Pode conversar com a Lisa
              </label>
              <p className="abacato-dica">
                Quem administra pode criar e desligar contas. Não dá acesso a quadro nenhum —
                isso continua vindo de convite, um a um. A Lisa também não: ela só alcança o que
                a própria pessoa alcança.
              </p>
            </>
          )}

          <div className="abacato-rapido">
            <button className="abacato-botao" type="submit" disabled={trabalhando}>
              {trabalhando ? "Criando…" : "Criar e sortear a senha"}
            </button>
            <button type="button" className="abacato-botao abacato-botao--fantasma"
              onClick={() => { setCriando(false); setErro(""); }}>Cancelar</button>
          </div>
        </form>
      )}

      {/* ------------------------------------------------ a lista */}
      <div className="abacato-pessoas">
        {jaEntram.map((p) => {
          const u = new Usuario(p);
          const souEu = p.id === dados.eu;
          return (
            <div key={p.id} className={`abacato-pessoa-cartao${p.ativo ? "" : " abacato-pessoa-cartao--fora"}`}>
              <span className="abacato-avatar">{u.iniciais}</span>
              <div className="abacato-pessoa-cartao__meio">
                <strong>
                  {p.nome}
                  {souEu && <span className="abacato-etiqueta abacato-etiqueta--ok">você</span>}
                  {p.tipo === "cliente" && <span className="abacato-selo abacato-selo--cliente">cliente</span>}
                  {p.admin && <span className="abacato-etiqueta">administra</span>}
                  {p.lisa && <span className="abacato-etiqueta abacato-etiqueta--ok">Lisa</span>}
                  {!p.ativo && <span className="abacato-etiqueta abacato-etiqueta--alerta">desativada</span>}
                </strong>
                <span className="abacato-dica">
                  {p.email} · entrou pela última vez em {quando(p.ultimo_login)}
                </span>
              </div>

              <div className="abacato-pessoa-cartao__acoes">
                {/* A Lisa se liga para QUALQUER pessoa, inclusive para si mesmo: diferente de
                    "administra", desligar a própria assistente não tranca ninguém para fora
                    de nada — é só uma ferramenta a menos. */}
                {/* Conta de cliente não tem este botão: a assistente não é dela, e um botão que
                    sempre devolve erro é pior que botão nenhum. O servidor recusa de qualquer
                    jeito, e o banco também. */}
                {p.tipo !== "cliente" && (
                  <button type="button"
                    className={`abacato-botao abacato-botao--pequeno ${p.lisa ? "abacato-botao--fantasma" : ""}`}
                    onClick={() => alternar(p, "lisa")}
                    title={p.lisa
                      ? "Tirar o acesso à assistente desta conta"
                      : "Liberar a assistente para esta conta"}>
                    {p.lisa ? "Tirar a Lisa" : "Liberar a Lisa"}
                  </button>
                )}
                <button type="button" className="abacato-botao abacato-botao--fantasma abacato-botao--pequeno"
                  disabled={trabalhando} onClick={() => novaSenhaPara(p)}>
                  Nova senha
                </button>
                {/* Um administrador não se desliga nem se rebaixa sozinho: a tela nem oferece,
                    e o servidor recusa de qualquer jeito. Um sistema sem ninguém que possa
                    criar contas só volta pelo terminal do servidor. */}
                {!souEu && (
                  <>
                    {p.tipo !== "cliente" && (
                      <button type="button" className="abacato-botao abacato-botao--fantasma abacato-botao--pequeno"
                        onClick={() => alternar(p, "admin")}>
                        {p.admin ? "Tirar administração" : "Tornar administrador"}
                      </button>
                    )}
                    <button type="button"
                      className={`abacato-botao abacato-botao--pequeno ${p.ativo ? "abacato-botao--perigo" : "abacato-botao--fantasma"}`}
                      onClick={() => alternar(p, "ativo")}>
                      {p.ativo ? "Desativar" : "Reativar"}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
