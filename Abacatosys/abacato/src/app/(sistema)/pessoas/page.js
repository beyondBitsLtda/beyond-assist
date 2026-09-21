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
  const [trabalhando, setTrabalhando] = useState(false);
  const [senhaNova, setSenhaNova] = useState(null);   // { nome, email, senha }
  const [copiado, setCopiado] = useState(false);

  const carregar = useCallback(async () => {
    try { setDados(await obter("/api/usuarios?tudo=1")); setErro(""); }
    catch (e) { setErro(e.message); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

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
        admin: ehAdmin,
        lisa: comLisa,
      });
      setSenhaNova({ nome: nome.trim(), email: email.trim().toLowerCase(), senha });
      setNome(""); setEmail(""); setEhAdmin(false); setComLisa(false); setCriando(false);
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

  return (
    <>
      <header className="abacato-conteudo__cabecalho">
        <h1 className="abacato-conteudo__titulo">Pessoas</h1>
        {!criando && (
          <button className="abacato-botao" onClick={() => setCriando(true)}>+ Nova pessoa</button>
        )}
      </header>

      {erro && <div className="abacato-campo__erro" style={{ marginBottom: 14 }}>⚠ {erro}</div>}

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

          <label className="abacato-concluir">
            <input type="checkbox" checked={ehAdmin} onChange={(e) => setEhAdmin(e.target.checked)} />
            Também administra o Abacato
          </label>
          <label className="abacato-concluir">
            <input type="checkbox" checked={comLisa} onChange={(e) => setComLisa(e.target.checked)} />
            Pode conversar com a Lisa
          </label>
          <p className="abacato-dica">
            Quem administra pode criar e desligar contas. Não dá acesso a quadro nenhum — isso
            continua vindo de convite, um a um. A Lisa também não: ela só alcança o que a
            própria pessoa alcança.
          </p>

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
        {dados.usuarios.map((p) => {
          const u = new Usuario(p);
          const souEu = p.id === dados.eu;
          return (
            <div key={p.id} className={`abacato-pessoa-cartao${p.ativo ? "" : " abacato-pessoa-cartao--fora"}`}>
              <span className="abacato-avatar">{u.iniciais}</span>
              <div className="abacato-pessoa-cartao__meio">
                <strong>
                  {p.nome}
                  {souEu && <span className="abacato-etiqueta abacato-etiqueta--ok">você</span>}
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
                <button type="button"
                  className={`abacato-botao abacato-botao--pequeno ${p.lisa ? "abacato-botao--fantasma" : ""}`}
                  onClick={() => alternar(p, "lisa")}
                  title={p.lisa
                    ? "Tirar o acesso à assistente desta conta"
                    : "Liberar a assistente para esta conta"}>
                  {p.lisa ? "Tirar a Lisa" : "Liberar a Lisa"}
                </button>
                <button type="button" className="abacato-botao abacato-botao--fantasma abacato-botao--pequeno"
                  disabled={trabalhando} onClick={() => novaSenhaPara(p)}>
                  Nova senha
                </button>
                {/* Um administrador não se desliga nem se rebaixa sozinho: a tela nem oferece,
                    e o servidor recusa de qualquer jeito. Um sistema sem ninguém que possa
                    criar contas só volta pelo terminal do servidor. */}
                {!souEu && (
                  <>
                    <button type="button" className="abacato-botao abacato-botao--fantasma abacato-botao--pequeno"
                      onClick={() => alternar(p, "admin")}>
                      {p.admin ? "Tirar administração" : "Tornar administrador"}
                    </button>
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
