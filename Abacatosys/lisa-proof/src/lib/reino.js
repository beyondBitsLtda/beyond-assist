// O Reino do Neuro no banco: ler o reino, gastar moedas, coletar a mina e invadir. As regras
// (custos, força, saque, limites) moram em src/dominio/reino.js; aqui é só o caminho até o banco.
//
// O cuidado com dinheiro em dobro. Não há transação entre várias linhas pelo PostgREST, então
// toda operação que mexe no saldo segue a mesma ordem:
//   1. lê o reino (com a `versao`) e calcula o saldo;
//   2. lança o movimento no livro-caixa;
//   3. grava o reino "onde versao = a que eu li" (e sobe a versao);
//   4. se o passo 3 não pegou linha nenhuma, alguém mexeu antes: apaga o movimento e devolve 409.
// Lançar ANTES de gravar faz qualquer leitura concorrente ver o saldo já descontado; o pior caso
// é ela subestimar o saldo por um instante, nunca gastar o que não existe.

import { supabase } from "./supabase.js";
import { ErroDeAcesso } from "./sessao.js";
import { buscarTodas, buscarEmLotes } from "./estudo.js";
import { diaDe } from "@/dominio/datas.js";
import { nomePublico, textoPublicoValido } from "@/dominio/ranking.js";
import {
  CONSTRUCOES, ORDEM_DAS_CONSTRUCOES, NIVEIS_INICIAIS, ATAQUES_POR_DIA, ESCUDO_DE_NOVATO_HORAS,
  niveisDe, poderDo, podeMelhorar, podeSubirNeuro, producaoAcumulada, producaoPorHora, capacidadeDaMina,
  protecaoDoCofre, temEscudo, podeInvadir, batalha, somarTrofeus, saldoDe, faixaDeDefesa,
  custoDoNeuro, nivelMaximoDoNeuro, estagioDoNeuro, taxaDeProducao, HORAS_ATE_ENCHER,
} from "@/dominio/reino.js";
import {
  TROPAS, ORDEM_DAS_TROPAS, RESERVAS, contagens, espacoUsado, capacidadeDoExercito, capacidadeDaGuarnicao,
  podeTreinar, somarTropas, heroiNeuro,
} from "@/dominio/tropas.js";

const CAMPOS = "usuario_id, nome, neuro_nivel, construcoes, exercito, guarnicao, coletado_em, escudo_ate, trofeus, versao, criado_em";
const HORA = 3_600_000;

function falhou(error, onde) {
  if (error) throw new ErroDeAcesso(500, `${onde}: ${error.message}`);
}

const conflito = () => new ErroDeAcesso(409, "o reino mudou enquanto você mexia — tente de novo");

/** A semente da batalha: um sorteio de verdade (não Math.random), que decide a luta inteira. */
function semente() {
  const [n] = crypto.getRandomValues(new Uint32Array(1));
  return n || 1;
}

// ---------------------------------------------------------------- leitura

/** O reino da pessoa; na primeira visita ele nasce, com escudo de novato. */
export async function obterReino(usuarioId) {
  const { data, error } = await supabase.from("proof_reinos").select(CAMPOS).eq("usuario_id", usuarioId).maybeSingle();
  falhou(error, "reino");
  if (data) return data;

  const novo = await supabase.from("proof_reinos").upsert({
    usuario_id: usuarioId,
    construcoes: NIVEIS_INICIAIS,
    escudo_ate: new Date(Date.now() + ESCUDO_DE_NOVATO_HORAS * HORA).toISOString(),
  }, { onConflict: "usuario_id", ignoreDuplicates: true });
  falhou(novo.error, "criar reino");
  const { data: criado, error: e2 } = await supabase.from("proof_reinos").select(CAMPOS).eq("usuario_id", usuarioId).single();
  falhou(e2, "reino");
  return criado;
}

/** Moedas de agora: todos os pontos de estudo (1 ponto = 1 moeda) + o livro-caixa do reino. */
export async function saldoDoUsuario(usuarioId) {
  const [pontos, movimentos] = await Promise.all([
    supabase.from("proof_ranking_total").select("pontos").eq("usuario_id", usuarioId).maybeSingle(),
    buscarTodas(() => supabase.from("proof_reino_movimentos").select("valor").eq("usuario_id", usuarioId).order("criado_em")),
  ]);
  falhou(pontos.error, "pontos");
  return saldoDe({ pontosDeEstudo: pontos.data?.pontos || 0, movimentos });
}

/** Nome público de cada pessoa (apelido ou "Primeiro I."), para quem aparece para os outros. */
export async function nomesPublicos(ids) {
  const unicos = [...new Set(ids.filter(Boolean))];
  if (!unicos.length) return new Map();
  const [usuarios, perfis] = await Promise.all([
    buscarEmLotes("abacato_usuarios", "id, nome", "id", unicos),
    buscarEmLotes("proof_perfis", "usuario_id, apelido, no_ranking", "usuario_id", unicos),
  ]);
  const perfil = new Map(perfis.map((p) => [p.usuario_id, p]));
  return new Map(usuarios.map((u) => {
    const p = perfil.get(u.id);
    return [u.id, nomePublico({ nome: u.nome, apelido: p?.apelido, noRanking: p?.no_ranking })];
  }));
}

async function invasoesDeHoje(usuarioId) {
  const { data, error } = await supabase.from("proof_invasoes").select("defensor_id, numero")
    .eq("atacante_id", usuarioId).eq("dia", diaDe());
  falhou(error, "invasões");
  return data || [];
}

/** Tudo o que a tela do reino precisa. */
export async function estadoDoReino(usuarioId) {
  const reino = await obterReino(usuarioId);
  const [saldo, hoje, batalhasR] = await Promise.all([
    saldoDoUsuario(usuarioId),
    invasoesDeHoje(usuarioId),
    supabase.from("proof_invasoes")
      .select("id, atacante_id, defensor_id, ataque, defesa, venceu, saque, trofeus_atacante, trofeus_defensor, estrelas, destruicao, combate, criado_em")
      .or(`atacante_id.eq.${usuarioId},defensor_id.eq.${usuarioId}`)
      .order("criado_em", { ascending: false }).limit(15),
  ]);
  falhou(batalhasR.error, "batalhas");
  const batalhas = batalhasR.data || [];
  const nomes = await nomesPublicos(batalhas.flatMap((b) => [b.atacante_id, b.defensor_id]));

  const agora = new Date();
  const n = niveisDe(reino);
  return {
    nome: reino.nome,
    saldo,
    trofeus: reino.trofeus,
    escudoAte: temEscudo(reino, agora) ? reino.escudo_ate : null,
    poder: poderDo(reino),
    neuro: {
      nivel: reino.neuro_nivel,
      estagio: estagioDoNeuro(reino.neuro_nivel),
      maximo: nivelMaximoDoNeuro(n.castelo),
      custo: custoDoNeuro(reino.neuro_nivel),
      ...podeSubirNeuro(reino, saldo),
    },
    mina: {
      paraColetar: producaoAcumulada(reino, agora),
      porHora: taxaDeProducao(n),
      capacidade: taxaDeProducao(n) * HORAS_ATE_ENCHER,
    },
    cofre: { protege: protecaoDoCofre(n.cofre) },
    construcoes: ORDEM_DAS_CONSTRUCOES.map((chave) => {
      const def = CONSTRUCOES[chave];
      const nivel = n[chave] || 0;
      const pode = podeMelhorar(reino, chave, saldo);
      return {
        chave, nome: def.nome, emoji: def.emoji, nivel, max: def.max,
        efeitoAtual: nivel > 0 ? def.efeito(nivel) : "ainda não construída",
        efeitoProximo: nivel < def.max ? def.efeito(nivel + 1) : null,
        custo: pode.custo ?? null, pode: pode.ok, motivo: pode.ok ? "" : pode.motivo,
      };
    }),
    invasoes: { feitasHoje: hoje.length, porDia: ATAQUES_POR_DIA },
    exercito: reservaParaTela("exercito", reino, n, saldo),
    guarnicao: reservaParaTela("guarnicao", reino, n, saldo),
    heroi: { ataque: heroiNeuro(reino.neuro_nivel, "ataque"), defesa: heroiNeuro(reino.neuro_nivel, "defesa") },
    batalhas: batalhas.map((b) => {
      const ataquei = b.atacante_id === usuarioId;
      return {
        id: b.id, quando: b.criado_em, ataquei,
        outro: nomes.get(ataquei ? b.defensor_id : b.atacante_id) || "Estudante anônimo",
        ataque: b.ataque, defesa: b.defesa,
        // "ganhei" do ponto de vista de quem está vendo
        ganhei: ataquei ? b.venceu : !b.venceu,
        moedas: b.saque ? (ataquei ? b.saque : -b.saque) : 0,
        trofeus: ataquei ? b.trofeus_atacante : b.trofeus_defensor,
        estrelas: b.estrelas, destruicao: b.destruicao,
        // a receita da batalha (só as novas têm): a tela roda a mesma simulação e mostra a luta
        combate: b.combate || null,
        resultado: b.combate ? { estrelas: b.estrelas, destruicao: b.destruicao, venceu: b.venceu, saque: b.saque } : null,
      };
    }),
  };
}

/** Exército ou guarnição: o que tem, quanto cabe e o que dá para treinar agora. */
function reservaParaTela(destino, reino, n, saldo) {
  const tropas = contagens(reino[destino]);
  const nivel = destino === "exercito" ? n.quartel : n.castelo;
  const capacidade = destino === "exercito" ? capacidadeDoExercito(nivel) : capacidadeDaGuarnicao(nivel);
  const reservas = { exercito: reino.exercito, guarnicao: reino.guarnicao };
  return {
    tropas, capacidade, usado: espacoUsado(tropas),
    catalogo: ORDEM_DAS_TROPAS.map((chave) => {
      const def = TROPAS[chave];
      const um = podeTreinar({ tropa: chave, quantidade: 1, destino, niveis: n, reservas, saldo });
      const cinco = podeTreinar({ tropa: chave, quantidade: 5, destino, niveis: n, reservas, saldo });
      return {
        chave, nome: def.nome, emoji: def.emoji, espaco: def.espaco, custo: def.custo, vida: def.vida, dano: def.dano,
        intervalo: def.intervalo, alcance: def.alcance, voa: def.voa, acertaAr: def.acertaAr, descricao: def.descricao,
        nivelMinimo: def.nivelMinimo, liberada: nivel >= def.nivelMinimo && (destino === "guarnicao" || nivel > 0),
        tem: tropas[chave] || 0, podeUm: um.ok, podeCinco: cinco.ok, motivo: um.ok ? "" : um.motivo,
      };
    }),
  };
}

// ---------------------------------------------------------------- escrita

async function lancar(usuarioId, tipo, valor, detalhe = {}) {
  const { data, error } = await supabase.from("proof_reino_movimentos")
    .insert({ usuario_id: usuarioId, tipo, valor, detalhe }).select("id").single();
  falhou(error, "livro-caixa");
  return data.id;
}

async function desfazerLancamentos(ids) {
  const vivos = ids.filter(Boolean);
  if (vivos.length) await supabase.from("proof_reino_movimentos").delete().in("id", vivos);
}

/** Grava o reino só se ninguém mexeu desde a leitura. Devolve se gravou. */
async function gravarReino(reino, mudancas) {
  const { data, error } = await supabase.from("proof_reinos")
    .update({ ...mudancas, versao: reino.versao + 1, atualizado_em: new Date().toISOString() })
    .eq("usuario_id", reino.usuario_id).eq("versao", reino.versao)
    .select("usuario_id");
  falhou(error, "gravar reino");
  return (data || []).length === 1;
}

/** Lança, grava; se a gravação perder a corrida, desfaz o lançamento. */
async function lancarEGravar(reino, lancamentos, mudancas) {
  const ids = [];
  try {
    for (const l of lancamentos) ids.push(await lancar(reino.usuario_id, l.tipo, l.valor, l.detalhe));
    if (!(await gravarReino(reino, mudancas))) {
      await desfazerLancamentos(ids);
      throw conflito();
    }
  } catch (e) {
    if (!(e instanceof ErroDeAcesso && e.status === 409)) await desfazerLancamentos(ids);
    throw e;
  }
}

/** Construir ou melhorar uma construção. */
export async function melhorarConstrucao(usuarioId, chave) {
  const reino = await obterReino(usuarioId);
  const saldo = await saldoDoUsuario(usuarioId);
  const pode = podeMelhorar(reino, chave, saldo);
  if (!pode.ok) throw new ErroDeAcesso(400, pode.motivo);

  const n = niveisDe(reino);
  const lancamentos = [];
  const mudancas = { construcoes: { ...n, [chave]: (n[chave] || 0) + 1 } };
  // A mina melhorada produz mais por hora: o que ela já tinha juntado é coletado antes, para o
  // nível novo não valer para trás.
  if (chave === "mina" || chave === "biblioteca") {
    const juntado = producaoAcumulada(reino);
    if (juntado > 0) lancamentos.push({ tipo: "coleta", valor: juntado, detalhe: { automatica: true } });
    mudancas.coletado_em = new Date().toISOString();
  }
  lancamentos.push({ tipo: "construcao", valor: -pode.custo, detalhe: { chave, nivel: mudancas.construcoes[chave] } });
  await lancarEGravar(reino, lancamentos, mudancas);
  return { chave, nivel: mudancas.construcoes[chave], custo: pode.custo };
}

export async function subirNeuro(usuarioId) {
  const reino = await obterReino(usuarioId);
  const saldo = await saldoDoUsuario(usuarioId);
  const pode = podeSubirNeuro(reino, saldo);
  if (!pode.ok) throw new ErroDeAcesso(400, pode.motivo);
  const nivel = reino.neuro_nivel + 1;
  await lancarEGravar(reino, [{ tipo: "neuro", valor: -pode.custo, detalhe: { nivel } }], { neuro_nivel: nivel });
  return { nivel, custo: pode.custo, estagio: estagioDoNeuro(nivel) };
}

/** Treinar tropas para o exército (Quartel) ou para a guarnição (Torre do Neuro). */
export async function treinarTropas(usuarioId, { tropa, quantidade, destino }) {
  const reino = await obterReino(usuarioId);
  const saldo = await saldoDoUsuario(usuarioId);
  const n = niveisDe(reino);
  const pode = podeTreinar({ tropa, quantidade, destino, niveis: n, reservas: { exercito: reino.exercito, guarnicao: reino.guarnicao }, saldo });
  if (!pode.ok) throw new ErroDeAcesso(400, pode.motivo);
  const nova = somarTropas(reino[destino], { [tropa]: pode.quantidade });
  await lancarEGravar(reino, [{ tipo: "treino", valor: -pode.custo, detalhe: { tropa, quantidade: pode.quantidade, destino } }], { [destino]: nova });
  return { tropa, quantidade: pode.quantidade, destino: RESERVAS[destino], custo: pode.custo };
}

export async function coletarMina(usuarioId) {
  const reino = await obterReino(usuarioId);
  const agora = new Date();
  const valor = producaoAcumulada(reino, agora);
  if (valor <= 0) throw new ErroDeAcesso(400, "a mina ainda não juntou nenhuma moeda inteira");
  await lancarEGravar(reino, [{ tipo: "coleta", valor }], { coletado_em: agora.toISOString() });
  return { coletou: valor };
}

export async function renomearReino(usuarioId, nome) {
  const r = textoPublicoValido(nome, { min: 3, max: 30, rotulo: "o nome do reino" });
  if (!r.ok) throw new ErroDeAcesso(400, r.motivo);
  if (!r.texto) throw new ErroDeAcesso(400, "dê um nome ao reino");
  const reino = await obterReino(usuarioId);
  if (!(await gravarReino(reino, { nome: r.texto }))) throw conflito();
  return { nome: r.texto };
}

// ---------------------------------------------------------------- invasões

/**
 * Os reinos que dá para invadir: os de troféus mais perto dos meus primeiro (a disputa justa
 * aparece no topo). A defesa aparece em faixa — o número exato só se descobre na batalha.
 */
export async function alvosDe(usuarioId) {
  const eu = await obterReino(usuarioId);
  const [todos, hoje] = await Promise.all([
    buscarTodas(() => supabase.from("proof_reinos").select(CAMPOS).neq("usuario_id", usuarioId).order("usuario_id")),
    invasoesDeHoje(usuarioId),
  ]);
  const jaAtaquei = new Set(hoje.map((i) => i.defensor_id));
  const perto = todos
    .sort((a, b) => Math.abs(a.trofeus - eu.trofeus) - Math.abs(b.trofeus - eu.trofeus))
    .slice(0, 30);
  const nomes = await nomesPublicos(perto.map((r) => r.usuario_id));
  const agora = new Date();
  return {
    invasoes: { feitasHoje: hoje.length, porDia: ATAQUES_POR_DIA },
    meuAtaque: poderDo(eu).ataque,
    alvos: perto.map((r) => {
      const pode = podeInvadir({ atacanteId: usuarioId, atacante: eu, defensor: r, ataquesHoje: hoje.length, jaAtacouHoje: jaAtaquei.has(r.usuario_id), agora });
      return {
        id: r.usuario_id,
        dono: nomes.get(r.usuario_id) || "Estudante anônimo",
        reino: r.nome,
        torre: niveisDe(r).castelo,
        neuro: r.neuro_nivel,
        trofeus: r.trofeus,
        defesa: faixaDeDefesa(poderDo(r).defesa),
        escudoAte: temEscudo(r, agora) ? r.escudo_ate : null,
        pode: pode.ok,
        motivo: pode.ok ? "" : pode.motivo,
      };
    }),
  };
}

export async function invadir(usuarioId, defensorId) {
  if (!defensorId || typeof defensorId !== "string") throw new ErroDeAcesso(400, "qual reino?");
  const eu = await obterReino(usuarioId);
  const { data: alvo, error } = await supabase.from("proof_reinos").select(CAMPOS).eq("usuario_id", defensorId).maybeSingle();
  falhou(error, "reino do alvo");
  const [hoje, saldoDoAlvo] = await Promise.all([invasoesDeHoje(usuarioId), alvo ? saldoDoUsuario(defensorId) : 0]);

  const pode = podeInvadir({
    atacanteId: usuarioId, atacante: eu, defensor: alvo, ataquesHoje: hoje.length,
    jaAtacouHoje: hoje.some((i) => i.defensor_id === defensorId),
  });
  if (!pode.ok) throw new ErroDeAcesso(400, pode.motivo);

  const exercitoUsado = contagens(eu.exercito);
  const r = batalha({ atacante: { exercito: exercitoUsado, neuro_nivel: eu.neuro_nivel }, defensor: alvo, saldoDoDefensor: saldoDoAlvo, semente: semente() });
  const forca = { ataque: poderDo({ ...eu, exercito: exercitoUsado }).ataque, defesa: poderDo(alvo).defesa };

  // 1. a invasão em si — os índices únicos barram a 4ª do dia e a 2ª no mesmo alvo
  const ins = await supabase.from("proof_invasoes").insert({
    atacante_id: usuarioId, defensor_id: defensorId, dia: diaDe(), numero: hoje.length + 1,
    ataque: forca.ataque, defesa: forca.defesa, venceu: r.venceu, saque: r.saque,
    trofeus_atacante: r.trofeusAtacante, trofeus_defensor: r.trofeusDefensor,
    estrelas: r.estrelas, destruicao: r.destruicao, combate: r.entrada,
  }).select("id").single();
  if (ins.error?.code === "23505") throw new ErroDeAcesso(409, "essa invasão já foi feita — atualize a tela");
  falhou(ins.error, "invasão");
  const invasaoId = ins.data.id;

  // 2. o saque, dos dois lados, e o reino do defensor (troféus e escudo) com a trava de versão
  const ids = [];
  try {
    if (r.saque > 0) {
      ids.push(await lancar(defensorId, "saque_perdido", -r.saque, { invasao: invasaoId }));
      ids.push(await lancar(usuarioId, "saque_ganho", r.saque, { invasao: invasaoId }));
    }
    // a guarnição que caiu precisa ser treinada de novo
    const mudancasDoAlvo = { trofeus: somarTrofeus(alvo.trofeus, r.trofeusDefensor), guarnicao: somarTropas(alvo.guarnicao, r.perdasDaGuarnicao, -1) };
    if (r.escudoDoDefensorHoras) mudancasDoAlvo.escudo_ate = new Date(Date.now() + r.escudoDoDefensorHoras * HORA).toISOString();
    if (!(await gravarReino(alvo, mudancasDoAlvo))) throw conflito();
  } catch (e) {
    await desfazerLancamentos(ids);
    await supabase.from("proof_invasoes").delete().eq("id", invasaoId);
    throw e;
  }

  // 3. o meu reino: troféus, o fim do meu escudo (quem ataca perde a proteção) e o exército, que
  // foi gasto na batalha. Sem dinheiro em jogo: em vez de desfazer, tenta de novo com o reino relido.
  let atual = eu;
  for (let i = 0; i < 4; i++) {
    const mudancas = { trofeus: somarTrofeus(atual.trofeus, r.trofeusAtacante), escudo_ate: null, exercito: somarTropas(atual.exercito, exercitoUsado, -1) };
    if (await gravarReino(atual, mudancas)) break;
    atual = await obterReino(usuarioId);
  }

  const nomes = await nomesPublicos([defensorId]);
  return {
    venceu: r.venceu, estrelas: r.estrelas, destruicao: r.destruicao, saque: r.saque,
    trofeus: r.trofeusAtacante, protegido: r.protegido, destruidos: r.destruidos,
    combate: r.entrada,
    alvo: { dono: nomes.get(defensorId) || "Estudante anônimo", reino: alvo.nome },
  };
}
