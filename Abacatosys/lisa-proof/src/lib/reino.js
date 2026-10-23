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
//
// DOIS MUNDOS (23/10/2026): tudo aqui fala com o banco por `db` (src/lib/mundo.js), que no Reino de
// Teste grava nas tabelas gêmeas proof_teste_*. As poucas diferenças do mundo de teste (o reino que
// nasce liberado, os rivais-robô, o saldo sem os pontos de estudo) estão marcadas com emTeste().

import { db, tabela, emTeste, mundoAtual, modoDeTesteLigado } from "./mundo.js";
import { ErroDeAcesso } from "./sessao.js";
import { buscarTodas, buscarEmLotes } from "./estudo.js";
import { diaDe, somarDias } from "@/dominio/datas.js";
import { calcularOfensiva } from "@/dominio/ofensiva.js";
import { nomePublico, textoPublicoValido } from "@/dominio/ranking.js";
import {
  CONSTRUCOES, ORDEM_DAS_CONSTRUCOES, NIVEIS_INICIAIS, ATAQUES_POR_DIA, ESCUDO_DE_NOVATO_HORAS,
  niveisDe, poderDo, podeMelhorar, podeSubirNeuro, producaoAcumulada, producaoPorHora, capacidadeDaMina,
  protecaoDoCofre, temEscudo, podeInvadir, batalha, somarTrofeus, saldoDe, faixaDeDefesa,
  custoDoNeuro, nivelMaximoDoNeuro, estagioDoNeuro, taxaDeProducao, HORAS_ATE_ENCHER,
  HORAS_ENTRE_ATAQUES_AO_MESMO_REINO, batalhaDeExpedicao, exercitoDaExpedicao, caidasNoAtaque,
  exercitoDeTreino, guarnicaoDeTreino,
} from "@/dominio/reino.js";
import {
  DIAS_DE_PAZ, PARTE_DA_EXPEDICAO, OFENSIVA_PARA_VOTAR, termosDaPaz, pazVigente, votacaoAberta, podeProporPaz, podeVotar,
  podeVotarComOfensiva, eleitoresDaVotacao, resultadoDaVotacao, fimDaVotacao, periodoDaPaz, fatorDaMinaNaPaz, parteDaExpedicao,
} from "@/dominio/paz.js";
import {
  EXPEDICOES, TIPOS_DE_LUGAR, MONSTROS, DIFICULDADES, expedicaoPorId, podeExpedicionar, contagensDeMonstros, veiculoDa,
} from "@/dominio/monstros.js";
import { VEICULOS, ORDEM_DOS_VEICULOS, veiculosDe, podeComprarVeiculo, tanqueDoDia, podeAbastecer } from "@/dominio/veiculos.js";
import { planetoideDa, sementeDoPlanetoide, RACAS } from "@/dominio/planetoides.js";
import {
  OPERARIOS_INICIAIS, HORAS_POR_PEPITA, VALOR_DA_PEPITA, HORAS_DE_ALUGUEL, PRECO_MINIMO_DO_ALUGUEL, PRECO_MAXIMO_DO_ALUGUEL,
  vagasDaMina, ouroAcumulado, horasTrabalhadas, equipeDeAgora, podeComprarOperario, podeOfertar, podeAlugar, periodoDoAluguel,
  moedasPorOperarioPorDia, sementeDaMina, chanceDeDiamante, VALOR_DO_DIAMANTE,
} from "@/dominio/ouro.js";
import {
  TROPAS, ORDEM_DAS_TROPAS, RESERVAS, contagens, espacoUsado, capacidadeDoExercito, capacidadeDaGuarnicao,
  podeTreinar, somarTropas, heroiNeuro, lotacaoDoAcampamento, totalDeTropas,
} from "@/dominio/tropas.js";
import { PERSONAGENS, ORDEM_DOS_PERSONAGENS, personagensDe, podeEscolherPersonagem } from "@/dominio/personagens.js";
import {
  MOEDAS_INICIAIS_DE_TESTE, MOEDAS_DE_TESTE, SALDO_DOS_RIVAIS, NOME_DO_REINO_DE_TESTE, RIVAIS_DE_TESTE, FERRAMENTAS_DE_TESTE,
  rivalDeTeste, ehRivalDeTeste, reinoDoRival, reinoLiberado, reinoNovoDeTeste,
} from "@/dominio/mundoDeTeste.js";
import { centavos } from "@/dominio/moedas.js";

const CAMPOS = "usuario_id, nome, neuro_nivel, construcoes, exercito, guarnicao, personagem, personagens, coletado_em, escudo_ate, trofeus, versao, criado_em, veiculos, operarios, ouro_coletado_em";
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
  const { data, error } = await db.from("proof_reinos").select(CAMPOS).eq("usuario_id", usuarioId).maybeSingle();
  falhou(error, "reino");
  if (data) return data;
  if (emTeste()) return criarReinoDeTeste(usuarioId);

  const novo = await db.from("proof_reinos").upsert({
    usuario_id: usuarioId,
    construcoes: NIVEIS_INICIAIS,
    escudo_ate: new Date(Date.now() + ESCUDO_DE_NOVATO_HORAS * HORA).toISOString(),
  }, { onConflict: "usuario_id", ignoreDuplicates: true });
  falhou(novo.error, "criar reino");
  const { data: criado, error: e2 } = await db.from("proof_reinos").select(CAMPOS).eq("usuario_id", usuarioId).single();
  falhou(e2, "reino");
  return criado;
}

/**
 * Moedas de agora: todos os pontos de estudo (1 ponto = 1 moeda) + o livro-caixa do reino. No Reino
 * de Teste, só o livro-caixa do teste (os pontos de estudo são do mundo de verdade).
 */
export async function saldoDoUsuario(usuarioId) {
  const [pontos, movimentos] = await Promise.all([
    emTeste() ? { data: null } : db.from("proof_ranking_total").select("pontos").eq("usuario_id", usuarioId).maybeSingle(),
    buscarTodas(() => db.from("proof_reino_movimentos").select("valor").eq("usuario_id", usuarioId).order("criado_em")),
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
  const nomes = new Map(usuarios.map((u) => {
    const p = perfil.get(u.id);
    return [u.id, nomePublico({ nome: u.nome, apelido: p?.apelido, noRanking: p?.no_ranking })];
  }));
  if (emTeste()) for (const id of unicos) if (ehRivalDeTeste(id)) nomes.set(id, rivalDeTeste(id).dono);
  return nomes;
}

async function invasoesDeHoje(usuarioId) {
  const { data, error } = await db.from("proof_invasoes").select("defensor_id, numero")
    .eq("atacante_id", usuarioId).eq("dia", diaDe());
  falhou(error, "invasões");
  return data || [];
}

/**
 * As invasões das últimas 48 h, para a regra "o mesmo reino só a cada dois dias": as que EU fiz
 * (alvo → último ataque) e as que ME fizeram (atacante → último ataque, para a revanche).
 */
async function invasoesRecentes(usuarioId) {
  const desde = new Date(Date.now() - HORAS_ENTRE_ATAQUES_AO_MESMO_REINO * HORA).toISOString();
  const [minhas, contraMim] = await Promise.all([
    db.from("proof_invasoes").select("defensor_id, criado_em").eq("atacante_id", usuarioId).gte("criado_em", desde),
    db.from("proof_invasoes").select("atacante_id, criado_em").eq("defensor_id", usuarioId).gte("criado_em", desde),
  ]);
  falhou(minhas.error, "invasões recentes");
  falhou(contraMim.error, "invasões recentes");
  const ultimo = (lista, chave) => {
    const m = new Map();
    for (const i of lista || []) if (!m.has(i[chave]) || i.criado_em > m.get(i[chave])) m.set(i[chave], i.criado_em);
    return m;
  };
  return { ataquei: ultimo(minhas.data, "defensor_id"), meAtacaram: ultimo(contraMim.data, "atacante_id") };
}

// ---------------------------------------------------------------- a paz entre os reinos

const CAMPOS_DA_PAZ = "id, proposta_por, dias, status, criado_em, expira_em, inicio, fim, total_reinos";

/** A paz que vale agora (ou null) e a proposta em votação (ou null). */
async function pazDeAgora() {
  const agora = new Date().toISOString();
  const [vigente, votacao] = await Promise.all([
    db.from("proof_pazes").select(CAMPOS_DA_PAZ).eq("status", "aprovada").gt("fim", agora).order("fim", { ascending: false }).limit(1).maybeSingle(),
    db.from("proof_pazes").select(CAMPOS_DA_PAZ).eq("status", "votacao").order("criado_em", { ascending: false }).limit(1).maybeSingle(),
  ]);
  falhou(vigente.error, "paz");
  falhou(votacao.error, "votação da paz");
  const v = votacao.data;
  // votação vencida: fecha agora (ninguém mais vota nela)
  if (v && !votacaoAberta(v)) {
    await db.from("proof_pazes").update({ status: "expirada" }).eq("id", v.id).eq("status", "votacao");
    return { paz: vigente.data || null, votacao: null };
  }
  return { paz: vigente.data || null, votacao: v || null };
}

async function totalDeReinos() {
  const { count, error } = await db.from("proof_reinos").select("usuario_id", { count: "exact", head: true });
  falhou(error, "reinos");
  return count || 0;
}

/**
 * A ofensiva de agora de cada pessoa, para a regra do voto. Só olha os últimos dias que a regra
 * precisa (OFENSIVA_PARA_VOTAR + ontem), então o número sai cortado ali — serve para "tem ou não
 * tem", e para mostrar quanto falta a quem ainda não chegou lá.
 */
async function ofensivasDe(ids) {
  // no Reino de Teste a paz não depende do estudo: todo testador vota; os robôs nunca votam
  if (emTeste()) return new Map(ids.filter(Boolean).map((id) => [id, ehRivalDeTeste(id) ? 0 : OFENSIVA_PARA_VOTAR]));
  const hoje = diaDe();
  const desde = somarDias(hoje, -OFENSIVA_PARA_VOTAR);
  const unicos = [...new Set(ids.filter(Boolean))];
  const diasDe = new Map(unicos.map((id) => [id, []]));
  for (let i = 0; i < unicos.length; i += 80) {
    const lote = unicos.slice(i, i + 80);
    const eventos = await buscarTodas(() =>
      db.from("proof_eventos").select("usuario_id, dia").in("usuario_id", lote).gte("dia", desde).order("criado_em")
    );
    for (const e of eventos) diasDe.get(e.usuario_id)?.push(e.dia);
  }
  return new Map([...diasDe].map(([id, d]) => [id, calcularOfensiva(d, hoje).atual]));
}

/** O placar de uma votação: os votos, os reinos, quem pode votar agora (ofensiva em dia) e o resultado. */
async function placarDa(votacao) {
  const [votosR, reinos] = await Promise.all([
    db.from("proof_paz_votos").select("usuario_id, voto").eq("paz_id", votacao.id),
    buscarTodas(() => db.from("proof_reinos").select("usuario_id").order("usuario_id")),
  ]);
  falhou(votosR.error, "votos");
  const votos = votosR.data || [];
  const ids = reinos.map((r) => r.usuario_id);
  const ofensivas = await ofensivasDe(ids);
  const aptos = ids.filter((id) => podeVotarComOfensiva(ofensivas.get(id)));
  const eleitores = eleitoresDaVotacao({ aptos, votantes: votos.map((v) => v.usuario_id) });
  return { votos, totalDeReinos: ids.length, ofensivas, eleitores, resultado: resultadoDaVotacao(votos.map((v) => v.voto), eleitores.length) };
}

/** A paz como a tela mostra: a vigente (com os vizinhos) ou a votação aberta (com o placar). */
async function pazParaTela(usuarioId, apurou = false) {
  const { paz, votacao } = await pazDeAgora();
  if (paz) {
    const total = await totalDeReinos();
    const { data: outros } = await db.from("proof_reinos").select("usuario_id, nome, construcoes, trofeus").neq("usuario_id", usuarioId).order("trofeus", { ascending: false }).limit(12);
    const nomes = await nomesPublicos((outros || []).map((r) => r.usuario_id));
    return {
      vigente: {
        id: paz.id, dias: paz.dias, inicio: paz.inicio, ate: paz.fim, reinos: paz.total_reinos, fatorDaMina: fatorDaMinaNaPaz(paz),
        parteDaExpedicao: PARTE_DA_EXPEDICAO,
        vizinhos: (outros || []).map((r) => {
          const n = niveisDe(r);
          return { id: r.usuario_id, nome: r.nome, dono: nomes.get(r.usuario_id) || "Estudante anônimo", construcoes: Object.fromEntries(ORDEM_DAS_CONSTRUCOES.map((c) => [c, n[c] || 0])) };
        }),
      },
      votacao: null, podePropor: false, motivo: "o mundo já está em paz", totalDeReinos: total,
    };
  }
  if (votacao) {
    const placar = await placarDa(votacao);
    // a ofensiva de alguém que não votou acabou e todo o resto já disse sim: a paz começa agora
    if (placar.resultado !== "aberta" && !apurou) {
      await apurar(votacao, placar);
      return pazParaTela(usuarioId, true);
    }
    const { votos, ofensivas, eleitores, totalDeReinos: total } = placar;
    const nomes = await nomesPublicos([votacao.proposta_por, ...votos.map((v) => v.usuario_id)]);
    const meu = votos.find((v) => v.usuario_id === usuarioId);
    const voto = podeVotar({ paz: votacao, jaVotou: Boolean(meu), ofensiva: ofensivas.get(usuarioId) });
    return {
      vigente: null,
      votacao: {
        id: votacao.id, dias: votacao.dias, expira: votacao.expira_em, propostaPor: nomes.get(votacao.proposta_por) || "Estudante anônimo",
        souQuemPropos: votacao.proposta_por === usuarioId, totalDeReinos: total,
        eleitores: eleitores.length, semVoto: Math.max(0, total - eleitores.length),
        sims: votos.filter((v) => v.voto).length, meuVoto: meu ? meu.voto : null,
        podeVotar: voto.ok, motivoDoVoto: voto.ok ? "" : voto.motivo,
        votaram: votos.filter((v) => v.voto).map((v) => nomes.get(v.usuario_id) || "Estudante anônimo"),
        termos: termosDaPaz(votacao.dias, total),
      },
      podePropor: false, motivo: "já tem uma proposta de paz em votação", totalDeReinos: total, ofensivaParaVotar: OFENSIVA_PARA_VOTAR,
    };
  }
  const [total, ofensivas] = await Promise.all([totalDeReinos(), ofensivasDe([usuarioId])]);
  const pode = podeProporPaz({ ofensiva: ofensivas.get(usuarioId) });
  return { vigente: null, votacao: null, podePropor: pode.ok, motivo: pode.ok ? "" : pode.motivo, totalDeReinos: total, ofensivaParaVotar: OFENSIVA_PARA_VOTAR };
}

/**
 * Fecha a votação se ela já tem o resultado: um "não" rejeita; todos os eleitores com "sim"
 * aprovam. A paz aprovada vale para todos os reinos — o fator da mina é o total de reinos.
 */
async function apurar(votacao, placar) {
  const { resultado, totalDeReinos: total } = placar || (await placarDa(votacao));
  if (resultado === "rejeitada") await db.from("proof_pazes").update({ status: "rejeitada" }).eq("id", votacao.id).eq("status", "votacao");
  if (resultado === "aprovada") {
    await db.from("proof_pazes").update({ status: "aprovada", total_reinos: total, ...periodoDaPaz(votacao.dias) }).eq("id", votacao.id).eq("status", "votacao");
  }
  return resultado;
}

/** Um jogador propõe a paz por `dias` dias; o voto dele já conta como sim. Precisa da ofensiva em dia. */
export async function proporPaz(usuarioId, dias) {
  const [{ paz, votacao }, ofensivas] = await Promise.all([pazDeAgora(), ofensivasDe([usuarioId])]);
  const pode = podeProporPaz({ dias: Number(dias), votacaoAtual: votacao, pazAtual: paz, ofensiva: ofensivas.get(usuarioId) });
  if (!pode.ok) throw new ErroDeAcesso(400, pode.motivo);
  await obterReino(usuarioId); // quem propõe tem reino (e conta como um dos votantes)
  const { data, error } = await db.from("proof_pazes").insert({ proposta_por: usuarioId, dias: Number(dias), expira_em: fimDaVotacao() }).select(CAMPOS_DA_PAZ).single();
  if (error?.code === "23505") throw new ErroDeAcesso(409, "já tem uma proposta de paz em votação");
  falhou(error, "proposta de paz");
  const { error: e2 } = await db.from("proof_paz_votos").insert({ paz_id: data.id, usuario_id: usuarioId, voto: true });
  falhou(e2, "voto");
  return { resultado: await apurar(data) };
}

/** O voto de um reino: sim ou não. Só vota quem tem a ofensiva em dia. */
export async function votarNaPaz(usuarioId, pazId, voto) {
  const { data: votacao, error } = await db.from("proof_pazes").select(CAMPOS_DA_PAZ).eq("id", String(pazId || "")).maybeSingle();
  falhou(error, "votação");
  const [{ data: meu }, ofensivas] = await Promise.all([
    votacao ? db.from("proof_paz_votos").select("voto").eq("paz_id", votacao.id).eq("usuario_id", usuarioId).maybeSingle() : { data: null },
    ofensivasDe([usuarioId]),
  ]);
  const pode = podeVotar({ paz: votacao, jaVotou: Boolean(meu), ofensiva: ofensivas.get(usuarioId) });
  if (!pode.ok) throw new ErroDeAcesso(400, pode.motivo);
  await obterReino(usuarioId);
  const { error: e2 } = await db.from("proof_paz_votos").insert({ paz_id: votacao.id, usuario_id: usuarioId, voto: Boolean(voto) });
  if (e2?.code === "23505") throw new ErroDeAcesso(409, "você já votou");
  falhou(e2, "voto");
  return { resultado: await apurar(votacao) };
}

/** Quem propôs desiste da proposta (enquanto a votação está aberta). */
export async function cancelarPaz(usuarioId, pazId) {
  const { data, error } = await db.from("proof_pazes").update({ status: "cancelada" })
    .eq("id", String(pazId || "")).eq("proposta_por", usuarioId).eq("status", "votacao").select("id");
  falhou(error, "proposta de paz");
  if (!(data || []).length) throw new ErroDeAcesso(400, "essa proposta não está mais em votação");
  return { cancelou: true };
}

/** Tudo o que a tela do reino precisa. */
export async function estadoDoReino(usuarioId) {
  const reino = await obterReino(usuarioId);
  const [saldo, hoje, batalhasR, paz, tanques, ouro] = await Promise.all([
    saldoDoUsuario(usuarioId),
    invasoesDeHoje(usuarioId),
    db.from("proof_invasoes")
      .select("id, atacante_id, defensor_id, ataque, defesa, venceu, saque, trofeus_atacante, trofeus_defensor, estrelas, destruicao, combate, criado_em")
      .or(`atacante_id.eq.${usuarioId},defensor_id.eq.${usuarioId}`)
      .order("criado_em", { ascending: false }).limit(15),
    pazParaTela(usuarioId),
    tanquesDeHoje(usuarioId),
    ouroDe(reino),
  ]);
  const fatorDaMina = paz.vigente?.fatorDaMina || 1;
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
      paraColetar: producaoAcumulada(reino, agora, fatorDaMina),
      porHora: taxaDeProducao(n) * fatorDaMina,
      capacidade: taxaDeProducao(n) * fatorDaMina * HORAS_ATE_ENCHER,
      dobrada: fatorDaMina > 1,
    },
    paz,
    diasDePaz: DIAS_DE_PAZ,
    mundo: mundoAtual(),
    modoDeTeste: modoDeTesteLigado(),
    garagem: garagemParaTela(reino, saldo, tanques),
    ouro: await ouroParaTela(reino, saldo, ouro),
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
    lotacao: { usado: espacoUsado(reino.exercito) + espacoUsado(reino.guarnicao), capacidade: lotacaoDoAcampamento(n.acampamento) },
    exercito: reservaParaTela("exercito", reino, n, saldo),
    guarnicao: reservaParaTela("guarnicao", reino, n, saldo),
    heroi: { ataque: heroiNeuro(reino.neuro_nivel, "ataque"), defesa: heroiNeuro(reino.neuro_nivel, "defesa") },
    personagem: PERSONAGENS[reino.personagem] ? reino.personagem : "neuro",
    personagens: ORDEM_DOS_PERSONAGENS.map((id) => {
      const pode = podeEscolherPersonagem({ id, possui: reino.personagens, saldo });
      return { id, ...PERSONAGENS[id], tem: personagensDe(reino.personagens).includes(id), pode: pode.ok, motivo: pode.ok ? "" : pode.motivo };
    }),
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
  const { data, error } = await db.from("proof_reino_movimentos")
    .insert({ usuario_id: usuarioId, tipo, valor, detalhe }).select("id").single();
  falhou(error, "livro-caixa");
  return data.id;
}

async function desfazerLancamentos(ids) {
  const vivos = ids.filter(Boolean);
  if (vivos.length) await db.from("proof_reino_movimentos").delete().in("id", vivos);
}

/** Grava o reino só se ninguém mexeu desde a leitura. Devolve se gravou. */
async function gravarReino(reino, mudancas) {
  const { data, error } = await db.from("proof_reinos")
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

/** Vestir um personagem que já é seu, ou comprar (com moedas) e vestir. */
export async function escolherPersonagem(usuarioId, id) {
  const reino = await obterReino(usuarioId);
  const saldo = await saldoDoUsuario(usuarioId);
  const pode = podeEscolherPersonagem({ id, possui: reino.personagens, saldo });
  if (!pode.ok) throw new ErroDeAcesso(400, pode.motivo);
  const mudancas = { personagem: id, personagens: personagensDe([...(reino.personagens || []), id]) };
  const lancamentos = pode.compra ? [{ tipo: "personagem", valor: -pode.custo, detalhe: { personagem: id } }] : [];
  await lancarEGravar(reino, lancamentos, mudancas);
  return { personagem: id, comprou: pode.compra, custo: pode.custo, nome: PERSONAGENS[id].nome };
}

/** Só ler qual personagem a pessoa usa (sem criar reino para quem ainda não abriu o Reino). */
export async function personagemDe(usuarioId) {
  const { data } = await db.from("proof_reinos").select("personagem").eq("usuario_id", usuarioId).maybeSingle();
  return PERSONAGENS[data?.personagem] ? data.personagem : "neuro";
}

export async function coletarMina(usuarioId) {
  const reino = await obterReino(usuarioId);
  const agora = new Date();
  const valor = producaoAcumulada(reino, agora, fatorDaMinaNaPaz((await pazDeAgora()).paz, agora));
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
  // no Reino de Teste, os rivais-robô estão sempre lá (se alguém os apagou, nascem de novo aqui)
  if (emTeste()) {
    const { count } = await db.from("proof_reinos").select("usuario_id", { count: "exact", head: true }).in("usuario_id", RIVAIS_DE_TESTE.map((r) => r.id));
    if ((count || 0) < RIVAIS_DE_TESTE.length) await garantirRivais();
  }
  const [todos, hoje, recentes, { paz }] = await Promise.all([
    buscarTodas(() => db.from("proof_reinos").select(CAMPOS).neq("usuario_id", usuarioId).order("usuario_id")),
    invasoesDeHoje(usuarioId),
    invasoesRecentes(usuarioId),
    pazDeAgora(),
  ]);
  const emPaz = pazVigente(paz);
  const jaAtaquei = new Set(hoje.map((i) => i.defensor_id));
  const perto = todos
    .sort((a, b) => Math.abs(a.trofeus - eu.trofeus) - Math.abs(b.trofeus - eu.trofeus))
    .slice(0, 30);
  const nomes = await nomesPublicos(perto.map((r) => r.usuario_id));
  const agora = new Date();
  return {
    invasoes: { feitasHoje: hoje.length, porDia: ATAQUES_POR_DIA },
    meuAtaque: poderDo(eu).ataque,
    horasEntreAtaques: HORAS_ENTRE_ATAQUES_AO_MESMO_REINO,
    emPaz,
    pazAte: emPaz ? paz.fim : null,
    alvos: perto.map((r) => {
      const pode = podeInvadir({
        atacanteId: usuarioId, atacante: eu, defensor: r, ataquesHoje: hoje.length, jaAtacouHoje: jaAtaquei.has(r.usuario_id),
        ultimoAtaqueAoAlvo: recentes.ataquei.get(r.usuario_id) || null, agora, emPaz,
      });
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
        liberaEm: pode.liberaEm || null,
        // me atacou nas últimas 48 h: dá para revidar (a conta das 48 h é de cada lado)
        revanche: recentes.meAtacaram.has(r.usuario_id),
      };
    }),
  };
}

export async function invadir(usuarioId, defensorId) {
  if (!defensorId || typeof defensorId !== "string") throw new ErroDeAcesso(400, "qual reino?");
  const eu = await obterReino(usuarioId);
  const { data: alvo, error } = await db.from("proof_reinos").select(CAMPOS).eq("usuario_id", defensorId).maybeSingle();
  falhou(error, "reino do alvo");
  const [hoje, saldoDoAlvo, recentes, { paz }] = await Promise.all([
    invasoesDeHoje(usuarioId), alvo ? saldoDoUsuario(defensorId) : 0, invasoesRecentes(usuarioId), pazDeAgora(),
  ]);

  const pode = podeInvadir({
    atacanteId: usuarioId, atacante: eu, defensor: alvo, ataquesHoje: hoje.length,
    jaAtacouHoje: hoje.some((i) => i.defensor_id === defensorId),
    ultimoAtaqueAoAlvo: recentes.ataquei.get(defensorId) || null,
    emPaz: pazVigente(paz),
  });
  if (!pode.ok) throw new ErroDeAcesso(400, pode.motivo);

  const exercitoUsado = contagens(eu.exercito);
  const r = batalha({ atacante: { exercito: exercitoUsado, neuro_nivel: eu.neuro_nivel }, defensor: alvo, saldoDoDefensor: saldoDoAlvo, semente: semente() });
  const forca = { ataque: poderDo({ ...eu, exercito: exercitoUsado }).ataque, defesa: poderDo(alvo).defesa };
  // só quem cai se perde: as tropas que sobreviveram voltam para casa
  const minhasPerdas = caidasNoAtaque(exercitoUsado, r.sobreviventes);
  const perdasDaGuarnicao = r.perdasDaGuarnicao;

  // 1. a invasão em si — os índices únicos barram a 4ª do dia e a 2ª no mesmo alvo
  const ins = await db.from("proof_invasoes").insert({
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
    const mudancasDoAlvo = { trofeus: somarTrofeus(alvo.trofeus, r.trofeusDefensor), guarnicao: somarTropas(alvo.guarnicao, perdasDaGuarnicao, -1) };
    if (r.escudoDoDefensorHoras) mudancasDoAlvo.escudo_ate = new Date(Date.now() + r.escudoDoDefensorHoras * HORA).toISOString();
    if (!(await gravarReino(alvo, mudancasDoAlvo))) throw conflito();
  } catch (e) {
    await desfazerLancamentos(ids);
    await db.from("proof_invasoes").delete().eq("id", invasaoId);
    throw e;
  }

  // 3. o meu reino: troféus, o fim do meu escudo (quem ataca perde a proteção) e o exército: só as
  // tropas que caíram saem (as que sobreviveram voltam para casa). Sem dinheiro em jogo: em vez de
  // desfazer, tenta de novo com o reino relido.
  let atual = eu;
  for (let i = 0; i < 4; i++) {
    const mudancas = { trofeus: somarTrofeus(atual.trofeus, r.trofeusAtacante), escudo_ate: null, exercito: somarTropas(atual.exercito, minhasPerdas, -1) };
    if (await gravarReino(atual, mudancas)) break;
    atual = await obterReino(usuarioId);
  }

  const nomes = await nomesPublicos([defensorId]);
  return {
    venceu: r.venceu, estrelas: r.estrelas, destruicao: r.destruicao, saque: r.saque,
    trofeus: r.trofeusAtacante, protegido: r.protegido, destruidos: r.destruidos,
    combate: r.entrada, perdas: minhasPerdas, voltaram: somarTropas(exercitoUsado, minhasPerdas, -1),
    alvo: { dono: nomes.get(defensorId) || "Estudante anônimo", reino: alvo.nome },
  };
}

// ---------------------------------------------------------------- expedições (contra a CPU)

/**
 * O tanque de cada veículo hoje: as expedições feitas com ele e as cargas extras compradas
 * (lançamentos "combustivel" do dia no livro-caixa).
 */
async function tanquesDeHoje(usuarioId) {
  const dia = diaDe();
  const [exp, comb] = await Promise.all([
    db.from("proof_expedicoes").select("veiculo, expedicao, numero").eq("usuario_id", usuarioId).eq("dia", dia),
    db.from("proof_reino_movimentos").select("detalhe").eq("usuario_id", usuarioId).eq("tipo", "combustivel").eq("detalhe->>dia", dia),
  ]);
  falhou(exp.error, "expedições");
  falhou(comb.error, "combustível");
  const feitas = {}, extras = {};
  for (const x of exp.data || []) feitas[x.veiculo || "barco"] = (feitas[x.veiculo || "barco"] || 0) + 1;
  for (const m of comb.data || []) { const v = m.detalhe?.veiculo; if (VEICULOS[v]) extras[v] = (extras[v] || 0) + 1; }
  return { lista: exp.data || [], feitas, extras, tanque: (v) => tanqueDoDia({ feitas: feitas[v] || 0, extras: extras[v] || 0 }) };
}

/** O planetoide da próxima viagem da Nave hoje (o radar mostra o mesmo que a batalha vai usar). */
const planetoideDaVez = (usuarioId, tanques) => planetoideDa(sementeDoPlanetoide(usuarioId, diaDe(), (tanques.feitas.nave || 0) + 1));

/** A garagem: cada veículo, se é seu, o preço e o tanque de hoje (com o abastecer). */
function garagemParaTela(reino, saldo, tanques) {
  const meus = veiculosDe(reino.veiculos);
  const torre = niveisDe(reino).castelo;
  return ORDEM_DOS_VEICULOS.map((id) => {
    const tem = meus.includes(id);
    const compra = tem ? null : podeComprarVeiculo({ id, possui: reino.veiculos, nivelDaTorre: torre, saldo });
    const tanque = tanques.tanque(id);
    const ab = tem ? podeAbastecer({ id, possui: reino.veiculos, feitas: tanque.usadas, extras: tanque.extras, saldo }) : null;
    return {
      id, ...VEICULOS[id], tem, pode: Boolean(compra?.ok), motivo: compra && !compra.ok ? compra.motivo : "",
      tanque, abastecer: ab ? { ok: ab.ok, custo: ab.custo, motivo: ab.ok ? "" : ab.motivo } : null,
    };
  });
}

/** O mapa das expedições: por veículo, com o tanque de cada um, o planetoide da vez e as melhores estrelas. */
export async function expedicoesDe(usuarioId) {
  const eu = await obterReino(usuarioId);
  const [tanques, historico, saldo] = await Promise.all([
    tanquesDeHoje(usuarioId),
    db.from("proof_expedicoes").select("id, expedicao, veiculo, estrelas, destruicao, saque, combate, detalhe, criado_em")
      .eq("usuario_id", usuarioId).order("criado_em", { ascending: false }).limit(300),
    saldoDoUsuario(usuarioId),
  ]);
  falhou(historico.error, "expedições");
  const todas = historico.data || [];
  const melhor = new Map();
  for (const x of todas) melhor.set(x.expedicao, Math.max(melhor.get(x.expedicao) || 0, x.estrelas));
  const vezesHoje = new Map();
  for (const x of tanques.lista) vezesHoje.set(x.expedicao, (vezesHoje.get(x.expedicao) || 0) + 1);
  const torre = niveisDe(eu).castelo;
  const tropa = exercitoDaExpedicao(eu.exercito, torre);
  const meus = veiculosDe(eu.veiculos);
  const planetoide = planetoideDaVez(usuarioId, tanques);
  const garagem = garagemParaTela(eu, saldo, tanques);
  return {
    // somando os tanques dos veículos que a pessoa tem (para o atalho lá em cima)
    expedicoes: {
      feitasHoje: meus.reduce((s, v) => s + tanques.tanque(v).usadas, 0),
      porDia: meus.reduce((s, v) => s + tanques.tanque(v).cargas, 0),
      restantes: meus.reduce((s, v) => s + tanques.tanque(v).restantes, 0),
    },
    veiculos: garagem,
    // com que exército a pessoa parte: o dela, ou a Tropa da Expedição (emprestada, de graça)
    tropa: { emprestada: tropa.emprestado, tropas: tropa.exercito },
    lugares: [...EXPEDICOES, planetoide].map((x) => {
      const veiculo = veiculoDa(x);
      const pode = podeExpedicionar({ expedicao: x, nivelDaTorre: torre, veiculos: eu.veiculos, tanque: tanques.tanque(veiculo) });
      return {
        id: x.id, nome: x.nome, tipo: x.tipo, lugar: TIPOS_DE_LUGAR[x.tipo].nome, emoji: TIPOS_DE_LUGAR[x.tipo].emoji,
        descricao: x.descricao, torreMinima: x.torreMinima, recompensa: x.recompensa, chefe: x.chefe,
        dificuldade: x.dificuldade, nomeDaDificuldade: DIFICULDADES[x.dificuldade]?.nome || "",
        veiculo, temVeiculo: meus.includes(veiculo),
        ...(x.forca ? { forca: x.forca, raca: x.raca, nomeDaRaca: RACAS[x.raca]?.nome || "", emojiDaRaca: RACAS[x.raca]?.emoji || "" } : {}),
        monstros: Object.entries(contagensDeMonstros(x.monstros)).map(([tipo, quantidade]) => ({ tipo, nome: MONSTROS[tipo].nome, quantidade })),
        melhorEstrelas: melhor.get(x.id) || 0,
        vezesHoje: vezesHoje.get(x.id) || 0,
        liberada: torre >= x.torreMinima,
        pode: pode.ok,
        semCombustivel: Boolean(pode.semCombustivel),
        motivo: pode.ok ? "" : pode.motivo,
      };
    }),
    recentes: todas.slice(0, 6).map((x) => ({
      id: x.id, expedicao: x.expedicao, veiculo: x.veiculo || "barco",
      nome: x.detalhe?.nome || expedicaoPorId(x.expedicao)?.nome || x.expedicao, quando: x.criado_em,
      estrelas: x.estrelas, destruicao: x.destruicao, saque: x.saque, combate: x.combate || null,
      resultado: { estrelas: x.estrelas, destruicao: x.destruicao, saque: x.saque, venceu: x.estrelas > 0 },
    })),
  };
}

/**
 * Parte numa expedição. Como na invasão, o resultado é decidido aqui (com um sorteio de verdade)
 * e a tela roda a mesma simulação para mostrar a luta. Ordem: registra a expedição (o índice único
 * barra a 4ª do dia) e lança o saque. O exército não muda: expedição não gasta tropa nem moeda.
 */
export async function atacarExpedicao(usuarioId, expedicaoId) {
  const eu = await obterReino(usuarioId);
  const tanques = await tanquesDeHoje(usuarioId);
  const id = String(expedicaoId || "");
  // o planetoide é sorteado pela viagem: o mesmo que o radar mostrou
  const expedicao = id === "planetoide" ? planetoideDaVez(usuarioId, tanques) : expedicaoPorId(id);
  if (!expedicao) throw new ErroDeAcesso(400, "essa expedição não existe");
  const veiculo = veiculoDa(expedicao);
  const tanque = tanques.tanque(veiculo);
  const torre = niveisDe(eu).castelo;
  const pode = podeExpedicionar({ expedicao, nivelDaTorre: torre, veiculos: eu.veiculos, tanque });
  if (!pode.ok) throw new ErroDeAcesso(400, pode.motivo);

  const tropa = exercitoDaExpedicao(eu.exercito, torre);
  const r = batalhaDeExpedicao({ atacante: { exercito: tropa.exercito, neuro_nivel: eu.neuro_nivel }, expedicao, semente: semente() });

  const ins = await db.from("proof_expedicoes").insert({
    usuario_id: usuarioId, expedicao: expedicao.id, dia: diaDe(), veiculo, numero: tanque.usadas + 1,
    estrelas: r.estrelas, destruicao: r.destruicao, saque: r.saque, perdas: r.caidas, combate: r.entrada,
    detalhe: expedicao.forca ? { nome: expedicao.nome, raca: expedicao.raca, forca: expedicao.forca, recompensa: expedicao.recompensa, dificuldade: expedicao.dificuldade } : {},
  }).select("id").single();
  if (ins.error?.code === "23505") throw new ErroDeAcesso(409, "essa expedição já foi feita — atualize a tela");
  falhou(ins.error, "expedição");

  try {
    if (r.saque > 0) await lancar(usuarioId, "expedicao", r.saque, { expedicao: expedicao.id, registro: ins.data.id });
  } catch (e) {
    await db.from("proof_expedicoes").delete().eq("id", ins.data.id);
    throw e;
  }

  // na paz, a expedição reparte: cada um dos outros reinos ganha uma parte do saque (moeda nova)
  let repartido = 0;
  const parte = parteDaExpedicao(r.saque);
  if (parte > 0 && pazVigente((await pazDeAgora()).paz)) {
    const { data: outros } = await db.from("proof_reinos").select("usuario_id").neq("usuario_id", usuarioId);
    if (outros?.length) {
      const { error } = await db.from("proof_reino_movimentos").insert(outros.map((o) => ({
        usuario_id: o.usuario_id, tipo: "paz_expedicao", valor: parte, detalhe: { expedicao: expedicao.id, registro: ins.data.id, de: usuarioId },
      })));
      if (!error) repartido = parte;
    }
  }

  return {
    venceu: r.venceu, estrelas: r.estrelas, destruicao: r.destruicao, saque: r.saque,
    caidas: r.caidas, combate: r.entrada, emprestado: tropa.emprestado, repartido,
    expedicao: { id: expedicao.id, nome: expedicao.nome, tipo: expedicao.tipo, chefe: expedicao.chefe, dificuldade: expedicao.dificuldade, veiculo, forca: expedicao.forca || 1 },
  };
}

// ---------------------------------------------------------------- veículos e combustível

/** Comprar um veículo na garagem. */
export async function comprarVeiculo(usuarioId, id) {
  const reino = await obterReino(usuarioId);
  const saldo = await saldoDoUsuario(usuarioId);
  const pode = podeComprarVeiculo({ id, possui: reino.veiculos, nivelDaTorre: niveisDe(reino).castelo, saldo });
  if (!pode.ok) throw new ErroDeAcesso(400, pode.motivo);
  await lancarEGravar(reino, [{ tipo: "veiculo", valor: -pode.custo, detalhe: { veiculo: id } }], { veiculos: veiculosDe([...(reino.veiculos || []), id]) });
  return { veiculo: id, nome: VEICULOS[id].nome, custo: pode.custo };
}

/** Abastecer: mais uma carga no tanque de hoje (a versão do reino trava dois cliques ao mesmo tempo). */
export async function abastecer(usuarioId, id) {
  const reino = await obterReino(usuarioId);
  const [saldo, tanques] = await Promise.all([saldoDoUsuario(usuarioId), tanquesDeHoje(usuarioId)]);
  const tanque = tanques.tanque(id);
  const pode = podeAbastecer({ id, possui: reino.veiculos, feitas: tanque.usadas, extras: tanque.extras, saldo });
  if (!pode.ok) throw new ErroDeAcesso(400, pode.motivo);
  await lancarEGravar(reino, [{ tipo: "combustivel", valor: -pode.custo, detalhe: { veiculo: id, dia: diaDe(), carga: tanque.extras + 1 } }], {});
  return { veiculo: id, nome: VEICULOS[id].nome, custo: pode.custo };
}

// ---------------------------------------------------------------- a Mina de Ouro e os operários

const CAMPOS_DO_ALUGUEL = "id, dono_id, inquilino_id, quantidade, preco, total, inicio, fim";

/** Os aluguéis que tocam o período desde `desde` (os meus para fora e os que eu aluguei de fora). */
async function alugueisDe(usuarioId, desde) {
  const [fora, dentro] = await Promise.all([
    db.from("proof_alugueis").select(CAMPOS_DO_ALUGUEL).eq("dono_id", usuarioId).gt("fim", desde),
    db.from("proof_alugueis").select(CAMPOS_DO_ALUGUEL).eq("inquilino_id", usuarioId).gt("fim", desde),
  ]);
  falhou(fora.error, "aluguéis");
  falhou(dentro.error, "aluguéis");
  return { paraFora: fora.data || [], deFora: dentro.data || [] };
}

/** O que a Mina de Ouro juntou e quem está trabalhando nela agora. */
async function ouroDe(reino, agora = new Date()) {
  const desde = reino.ouro_coletado_em || reino.criado_em || agora.toISOString();
  const alugueis = await alugueisDe(reino.usuario_id, desde);
  const nivel = niveisDe(reino).minaDeOuro || 1;
  const operarios = reino.operarios ?? OPERARIOS_INICIAIS;
  const trabalho = { operarios, desde, agora, alugadosParaFora: alugueis.paraFora, alugadosDeFora: alugueis.deFora };
  const equipe = equipeDeAgora(trabalho);
  // a semente da rodada: a pessoa e a última coleta — os diamantes não mudam até coletar
  const semente = sementeDaMina(reino.usuario_id, new Date(desde).toISOString());
  return { nivel, operarios, desde, alugueis, equipe, ouro: ouroAcumulado({ nivel, semente, ...trabalho }), horas: horasTrabalhadas(trabalho) };
}

/**
 * Depois de coletar, o relógio volta só o que sobrou para a próxima pepita (com quem está
 * trabalhando agora): quem coleta sempre não perde o pedaço de pepita que já estava saindo.
 */
function relogioDepoisDaColeta(info, agora) {
  if (info.ouro.cheia || !info.equipe.trabalhando) return agora.toISOString();
  const resto = Math.max(0, info.horas - info.ouro.pepitas * HORAS_POR_PEPITA);
  return new Date(agora.getTime() - (resto / info.equipe.trabalhando) * HORA).toISOString();
}

async function ouroParaTela(reino, saldo, info) {
  const { data: oferta } = await db.from("proof_operarios_ofertas").select("quantidade, preco").eq("dono_id", reino.usuario_id).maybeSingle();
  const agora = Date.now();
  const ativos = (lista) => lista.filter((a) => new Date(a.inicio).getTime() <= agora && new Date(a.fim).getTime() > agora);
  const fora = ativos(info.alugueis.paraFora), dentro = ativos(info.alugueis.deFora);
  const nomes = await nomesPublicos([...fora.map((a) => a.inquilino_id), ...dentro.map((a) => a.dono_id)]);
  const vagas = vagasDaMina(info.nivel);
  const compra = podeComprarOperario({ operarios: info.operarios, nivel: info.nivel, saldo });
  return {
    nivel: info.nivel, vagas, operarios: info.operarios, equipe: info.equipe,
    vagasLivres: Math.max(0, vagas - info.equipe.emCasa - info.equipe.alugadosDeFora),
    pepitas: info.ouro.pepitas, pepitasDeOuro: info.ouro.ouro, diamantes: info.ouro.diamantes,
    moedas: info.ouro.moedas, capacidade: info.ouro.capacidade, cheia: info.ouro.cheia,
    horasPorPepita: HORAS_POR_PEPITA, valorDaPepita: VALOR_DA_PEPITA,
    valorDoDiamante: VALOR_DO_DIAMANTE, chanceDeDiamante: Math.round(chanceDeDiamante(info.nivel) * 100),
    moedasPorDia: Math.round(info.equipe.trabalhando * moedasPorOperarioPorDia()),
    comprar: { ok: compra.ok, custo: compra.custo, motivo: compra.ok ? "" : compra.motivo },
    oferta: oferta?.quantidade > 0 ? { quantidade: oferta.quantidade, preco: oferta.preco } : null,
    precoDoAluguel: { minimo: PRECO_MINIMO_DO_ALUGUEL, maximo: PRECO_MAXIMO_DO_ALUGUEL, horas: HORAS_DE_ALUGUEL, sugerido: Math.round(moedasPorOperarioPorDia() * 0.6) },
    alugadosParaFora: fora.map((a) => ({ id: a.id, quantidade: a.quantidade, total: a.total, fim: a.fim, com: nomes.get(a.inquilino_id) || "Estudante anônimo" })),
    alugadosDeFora: dentro.map((a) => ({ id: a.id, quantidade: a.quantidade, total: a.total, fim: a.fim, com: nomes.get(a.dono_id) || "Estudante anônimo" })),
  };
}

/** Coletar o ouro: as pepitas viram moedas na hora. */
export async function coletarOuro(usuarioId) {
  const reino = await obterReino(usuarioId);
  const agora = new Date();
  const info = await ouroDe(reino, agora);
  if (info.ouro.pepitas <= 0) throw new ErroDeAcesso(400, `a Mina de Ouro ainda não juntou nenhuma pepita — cada operário tira 1 a cada ${HORAS_POR_PEPITA} h`);
  await lancarEGravar(reino, [{ tipo: "ouro", valor: info.ouro.moedas, detalhe: { pepitas: info.ouro.pepitas, diamantes: info.ouro.diamantes } }], { ouro_coletado_em: relogioDepoisDaColeta(info, agora) });
  return { pepitas: info.ouro.pepitas, ouro: info.ouro.ouro, diamantes: info.ouro.diamantes, coletou: info.ouro.moedas };
}

/** Contratar um operário (o ouro que já juntou é coletado antes: o novo não trabalha para trás). */
export async function comprarOperario(usuarioId) {
  const reino = await obterReino(usuarioId);
  const agora = new Date();
  const [saldo, info] = await Promise.all([saldoDoUsuario(usuarioId), ouroDe(reino, agora)]);
  const pode = podeComprarOperario({ operarios: info.operarios, nivel: info.nivel, saldo });
  if (!pode.ok) throw new ErroDeAcesso(400, pode.motivo);
  const lancamentos = [];
  if (info.ouro.moedas > 0) lancamentos.push({ tipo: "ouro", valor: info.ouro.moedas, detalhe: { pepitas: info.ouro.pepitas, diamantes: info.ouro.diamantes, automatica: true } });
  lancamentos.push({ tipo: "operario", valor: -pode.custo, detalhe: { operarios: info.operarios + 1 } });
  await lancarEGravar(reino, lancamentos, { operarios: info.operarios + 1, ouro_coletado_em: agora.toISOString() });
  return { operarios: info.operarios + 1, custo: pode.custo, coletou: info.ouro.moedas };
}

/** Pôr operários para alugar (quantidade 0 tira a oferta). Quem já está alugado continua até o fim. */
export async function ofertarOperarios(usuarioId, { quantidade, preco }) {
  const reino = await obterReino(usuarioId);
  const pode = podeOfertar({ quantidade: Number(quantidade), preco: Number(preco), operarios: reino.operarios ?? OPERARIOS_INICIAIS });
  if (!pode.ok) throw new ErroDeAcesso(400, pode.motivo);
  const { error } = await db.from("proof_operarios_ofertas").upsert(
    { dono_id: usuarioId, quantidade: pode.quantidade, preco: pode.preco, atualizado_em: new Date().toISOString() }, { onConflict: "dono_id" },
  );
  falhou(error, "oferta de operários");
  return { quantidade: pode.quantidade, preco: pode.preco };
}

/** Quantos operários de cada dono estão alugados agora (para qualquer pessoa). */
async function alugadosAgoraDe(donos) {
  const agora = new Date().toISOString();
  const linhas = await buscarEmLotes(tabela("proof_alugueis"), "dono_id, quantidade", "dono_id", donos, (q) => q.gt("fim", agora).lte("inicio", agora));
  const m = new Map();
  for (const a of linhas) m.set(a.dono_id, (m.get(a.dono_id) || 0) + a.quantidade);
  return m;
}

/** O mercado de operários: quem tem operários para alugar agora (menos eu), do mais barato ao mais caro. */
export async function mercadoDeOperarios(usuarioId) {
  const { data: ofertas, error } = await db.from("proof_operarios_ofertas").select("dono_id, quantidade, preco")
    .gt("quantidade", 0).neq("dono_id", usuarioId).order("preco").limit(60);
  falhou(error, "ofertas de operários");
  const donos = (ofertas || []).map((o) => o.dono_id);
  const [alugados, reinos, nomes] = await Promise.all([
    alugadosAgoraDe(donos),
    buscarEmLotes(tabela("proof_reinos"), "usuario_id, nome, operarios", "usuario_id", donos),
    nomesPublicos(donos),
  ]);
  const reinoDe = new Map(reinos.map((r) => [r.usuario_id, r]));
  return (ofertas || []).map((o) => {
    const r = reinoDe.get(o.dono_id);
    const oferecidos = Math.min(o.quantidade, r?.operarios ?? OPERARIOS_INICIAIS);
    return { dono: o.dono_id, reino: r?.nome || "Reino", nome: nomes.get(o.dono_id) || "Estudante anônimo", preco: o.preco, disponiveis: Math.max(0, oferecidos - (alugados.get(o.dono_id) || 0)) };
  }).filter((o) => o.disponiveis > 0);
}

/**
 * Alugar operários de outro reino por 24 h. Ordem: registra o aluguel e confere de novo se o dono
 * ainda tinha esses operários (dois inquilinos ao mesmo tempo não pegam os mesmos); paga — a
 * versão do meu reino trava o meu saldo —; e só então o dono recebe. Qualquer falha desfaz tudo.
 */
export async function alugarOperarios(usuarioId, donoId, quantidade) {
  if (!donoId || typeof donoId !== "string") throw new ErroDeAcesso(400, "de qual reino?");
  const eu = await obterReino(usuarioId);
  const agora = new Date();
  const [saldo, info, ofertaR, donoR, alugados] = await Promise.all([
    saldoDoUsuario(usuarioId), ouroDe(eu, agora),
    db.from("proof_operarios_ofertas").select("quantidade, preco").eq("dono_id", donoId).maybeSingle(),
    db.from("proof_reinos").select("usuario_id, nome, operarios").eq("usuario_id", donoId).maybeSingle(),
    alugadosAgoraDe([donoId]),
  ]);
  falhou(ofertaR.error, "oferta de operários");
  if (!donoR.data) throw new ErroDeAcesso(404, "esse reino não existe");
  const oferta = ofertaR.data ? { quantidade: Math.min(ofertaR.data.quantidade, donoR.data.operarios ?? OPERARIOS_INICIAIS), preco: ofertaR.data.preco } : null;
  const vagasLivres = Math.max(0, vagasDaMina(info.nivel) - info.equipe.emCasa - info.equipe.alugadosDeFora);
  const pode = podeAlugar({ souODono: donoId === usuarioId, oferta, jaAlugados: alugados.get(donoId) || 0, quantidade: Number(quantidade), vagasLivres, saldo });
  if (!pode.ok) throw new ErroDeAcesso(400, pode.motivo);

  const periodo = periodoDoAluguel(agora);
  const ins = await db.from("proof_alugueis").insert({
    dono_id: donoId, inquilino_id: usuarioId, quantidade: pode.quantidade, preco: oferta.preco, total: pode.custo, ...periodo,
  }).select("id").single();
  falhou(ins.error, "aluguel");
  const desfazer = async (ids = []) => {
    await db.from("proof_alugueis").delete().eq("id", ins.data.id);
    await desfazerLancamentos(ids);
  };
  const depois = (await alugadosAgoraDe([donoId])).get(donoId) || 0;
  if (depois > oferta.quantidade) {
    await desfazer();
    throw new ErroDeAcesso(409, "alguém alugou esses operários agora há pouco — atualize a tela");
  }
  const ids = [];
  try {
    ids.push(await lancar(usuarioId, "aluguel_pago", -pode.custo, { aluguel: ins.data.id, dono: donoId, quantidade: pode.quantidade }));
    if (!(await gravarReino(eu, {}))) throw conflito();
    ids.push(await lancar(donoId, "aluguel_recebido", pode.custo, { aluguel: ins.data.id, inquilino: usuarioId, quantidade: pode.quantidade }));
  } catch (e) {
    await desfazer(ids);
    throw e;
  }
  return { quantidade: pode.quantidade, custo: pode.custo, ate: periodo.fim, reino: donoR.data.nome };
}

// ---------------------------------------------------------------- visitar um reino vizinho (na paz)

/** A visão completa de outro reino: só na paz, quando todos os reinos são vizinhos. */
export async function visitarReino(usuarioId, alvoId) {
  if (!alvoId || typeof alvoId !== "string") throw new ErroDeAcesso(400, "qual reino?");
  if (alvoId === usuarioId) throw new ErroDeAcesso(400, "esse é o seu reino");
  const { paz } = await pazDeAgora();
  if (!pazVigente(paz)) throw new ErroDeAcesso(403, "só dá para visitar os outros reinos durante a paz — aí todos viram vizinhos");
  const { data: alvo, error } = await db.from("proof_reinos").select(CAMPOS).eq("usuario_id", alvoId).maybeSingle();
  falhou(error, "reino vizinho");
  if (!alvo) throw new ErroDeAcesso(404, "esse reino não existe");
  const [nomes, info] = await Promise.all([nomesPublicos([alvoId]), ouroDe(alvo)]);
  const n = niveisDe(alvo);
  return {
    id: alvoId, nome: alvo.nome, dono: nomes.get(alvoId) || "Estudante anônimo", trofeus: alvo.trofeus,
    neuro: { nivel: alvo.neuro_nivel, estagio: estagioDoNeuro(alvo.neuro_nivel) },
    personagem: PERSONAGENS[alvo.personagem] ? alvo.personagem : "neuro",
    poder: poderDo(alvo),
    construcoes: ORDEM_DAS_CONSTRUCOES.map((chave) => ({ chave, nome: CONSTRUCOES[chave].nome, emoji: CONSTRUCOES[chave].emoji, nivel: n[chave] || 0, max: CONSTRUCOES[chave].max })),
    tropas: { exercito: contagens(alvo.exercito), guarnicao: contagens(alvo.guarnicao) },
    veiculos: veiculosDe(alvo.veiculos).map((id) => ({ id, nome: VEICULOS[id].nome, emoji: VEICULOS[id].emoji })),
    ouro: { nivel: info.nivel, operarios: info.operarios, trabalhando: info.equipe.trabalhando },
    personagens: personagensDe(alvo.personagens).length,
  };
}

// ---------------------------------------------------------------- o REINO DE TESTE (23/10/2026)
// O reino de cada pessoa no mundo de teste (src/lib/mundo.js): nasce com tudo liberado e
// MOEDAS_INICIAIS_DE_TESTE moedas, e os rivais-robô nascem junto. As ferramentas abaixo só
// funcionam DENTRO do mundo de teste — no de verdade, recusam (o modo de teste antigo, que dava
// veículos e combustível no reino de verdade, deixou de existir).

/** O reino de teste nasce (liberado ou do zero, sem escudo de novato) e ganha as moedas de teste — uma vez só. */
async function criarReinoDeTeste(usuarioId, { liberado = true } = {}) {
  if (ehRivalDeTeste(usuarioId)) {
    await garantirRivais();
  } else {
    const { data: nasceu, error } = await db.from("proof_reinos").upsert(
      { usuario_id: usuarioId, nome: NOME_DO_REINO_DE_TESTE, ...(liberado ? reinoLiberado() : reinoNovoDeTeste()), escudo_ate: null },
      { onConflict: "usuario_id", ignoreDuplicates: true },
    ).select("usuario_id");
    falhou(error, "criar o reino de teste");
    // só quem criou de fato ganha as moedas (dois pedidos ao mesmo tempo não dobram nada)
    if ((nasceu || []).length) await lancar(usuarioId, "teste", MOEDAS_INICIAIS_DE_TESTE, { nasceu: liberado ? "liberado" : "do zero" });
    // os rivais, sempre: a tela pede o reino e os alvos juntos, e o pedido que perde a corrida da
    // criação também precisa achar os robôs prontos (visto em 23/10/2026: "ainda não há outros reinos")
    await garantirRivais();
  }
  const { data, error: e2 } = await db.from("proof_reinos").select(CAMPOS).eq("usuario_id", usuarioId).single();
  falhou(e2, "reino de teste");
  return data;
}

/** Os reinos-robô existem: os que faltarem nascem inteiros, com o cofre cheio e a oferta de operários. */
async function garantirRivais() {
  const { data: novos, error } = await db.from("proof_reinos").upsert(
    RIVAIS_DE_TESTE.map((r) => ({ usuario_id: r.id, ...reinoDoRival(r) })),
    { onConflict: "usuario_id", ignoreDuplicates: true },
  ).select("usuario_id");
  falhou(error, "rivais de teste");
  for (const { usuario_id: id } of novos || []) await prepararRival(rivalDeTeste(id));
}

/** O cofre do robô cheio de novo e a oferta de operários dele no mercado. */
async function prepararRival(rival) {
  const saldo = await saldoDoUsuario(rival.id);
  if (saldo < SALDO_DOS_RIVAIS) await lancar(rival.id, "teste", centavos(SALDO_DOS_RIVAIS - saldo), { rival: true });
  if (rival.oferta) {
    const { error } = await db.from("proof_operarios_ofertas").upsert(
      { dono_id: rival.id, ...rival.oferta, atualizado_em: new Date().toISOString() }, { onConflict: "dono_id" },
    );
    falhou(error, "oferta do rival");
  }
}

/** Trava a mais: o que apaga ou dá coisas de graça só roda com as tabelas de teste na mão. */
function exigirMundoDeTeste() {
  if (!emTeste() || tabela("proof_reinos") !== "proof_teste_reinos") {
    throw new ErroDeAcesso(403, "as ferramentas de teste só funcionam no Reino de Teste — o seu reino de verdade não muda por elas");
  }
}

/** Apaga tudo o que é meu no mundo de teste (para recomeçar do zero). */
async function apagarReinoDeTeste(usuarioId) {
  exigirMundoDeTeste();
  const apagados = await Promise.all([
    db.from("proof_reino_movimentos").delete().eq("usuario_id", usuarioId),
    db.from("proof_expedicoes").delete().eq("usuario_id", usuarioId),
    db.from("proof_invasoes").delete().or(`atacante_id.eq.${usuarioId},defensor_id.eq.${usuarioId}`),
    db.from("proof_bolsa_posicoes").delete().eq("usuario_id", usuarioId),
    db.from("proof_bolsa_ordens").delete().eq("usuario_id", usuarioId),
    db.from("proof_operarios_ofertas").delete().eq("dono_id", usuarioId),
    db.from("proof_alugueis").delete().or(`dono_id.eq.${usuarioId},inquilino_id.eq.${usuarioId}`),
    db.from("proof_paz_votos").delete().eq("usuario_id", usuarioId),
  ]);
  for (const r of apagados) falhou(r.error, "apagar o reino de teste");
  const { error } = await db.from("proof_reinos").delete().eq("usuario_id", usuarioId);
  falhou(error, "apagar o reino de teste");
}

/** As ferramentas do Reino de Teste (FERRAMENTAS_DE_TESTE, em src/dominio/mundoDeTeste.js). */
export async function acaoDeTeste(usuarioId, acao) {
  exigirMundoDeTeste();
  if (!FERRAMENTAS_DE_TESTE.some((f) => f.id === acao)) throw new ErroDeAcesso(400, "ferramenta de teste desconhecida");
  const reino = await obterReino(usuarioId);
  const gravar = async (mudancas) => { if (!(await gravarReino(reino, mudancas))) throw conflito(); };
  const contar = (r) => { falhou(r.error, "ferramenta de teste"); return (r.data || []).length; };
  switch (acao) {
    case "moedas":
      await lancar(usuarioId, "teste", MOEDAS_DE_TESTE, { acao });
      return { mensagem: `+${MOEDAS_DE_TESTE.toLocaleString("pt-BR")} moedas de teste` };

    case "dia": {
      // os limites do dia voltam: tanques cheios, as 3 invasões e o "mesmo reino só a cada 48 h"
      const dia = diaDe();
      const desde = new Date(Date.now() - HORAS_ENTRE_ATAQUES_AO_MESMO_REINO * HORA).toISOString();
      const robos = RIVAIS_DE_TESTE.map((r) => r.id);
      const [exp, comb, minhas, dosRobos] = await Promise.all([
        db.from("proof_expedicoes").delete().eq("usuario_id", usuarioId).eq("dia", dia).select("id"),
        db.from("proof_reino_movimentos").delete().eq("usuario_id", usuarioId).eq("tipo", "combustivel").eq("detalhe->>dia", dia).select("id"),
        db.from("proof_invasoes").delete().eq("atacante_id", usuarioId).gte("criado_em", desde).select("id"),
        db.from("proof_invasoes").delete().eq("defensor_id", usuarioId).in("atacante_id", robos).gte("criado_em", desde).select("id"),
      ]);
      return { mensagem: `dia recomeçado: ${contar(exp)} expedição(ões), ${contar(comb)} carga(s) e ${contar(minhas) + contar(dosRobos)} batalha(s) apagadas — tanques cheios e invasões de novo` };
    }

    case "rivais": {
      await garantirRivais();
      const agora = new Date().toISOString();
      for (const r of RIVAIS_DE_TESTE) {
        const { error } = await db.from("proof_reinos").update({ ...reinoDoRival(r), coletado_em: agora, atualizado_em: agora }).eq("usuario_id", r.id);
        falhou(error, "restaurar o rival");
        await prepararRival(r);
      }
      // ninguém do mundo de teste fica de escudo
      const { error } = await db.from("proof_reinos").update({ escudo_ate: null }).not("escudo_ate", "is", null);
      falhou(error, "escudos do mundo de teste");
      return { mensagem: "os rivais estão inteiros de novo, com o cofre cheio — e ninguém do mundo de teste está de escudo" };
    }

    case "invasao": {
      // o robô mais forte que ainda pode atacar hoje invade o meu reino (o meu escudo sai antes)
      if (pazVigente((await pazDeAgora()).paz)) throw new ErroDeAcesso(400, "o mundo de teste está em paz — use “Acabar com a paz” antes");
      if (temEscudo(reino)) await gravar({ escudo_ate: null });
      await garantirRivais();
      let motivo = "";
      for (const r of [...RIVAIS_DE_TESTE].reverse()) {
        try {
          const invasao = await invadir(r.id, usuarioId);
          return {
            mensagem: invasao.venceu
              ? `${r.dono} invadiu o seu reino: ${invasao.estrelas}★, ${invasao.destruicao}% destruído${invasao.saque ? ` e levou 🪙 ${invasao.saque}` : ""}`
              : `Você defendeu o reino contra ${r.dono}!`,
            invasao: { ...invasao, atacante: r.dono, reinoDoAtacante: r.nome },
          };
        } catch (e) {
          if (!(e instanceof ErroDeAcesso) || e.status >= 500) throw e;
          motivo = e.message;
        }
      }
      throw new ErroDeAcesso(400, `nenhum rival conseguiu invadir agora (${motivo}) — use “Recomeçar o dia” ou “Restaurar os rivais”`);
    }

    case "minas": {
      const voltar = (iso, horas) => new Date(new Date(iso || Date.now()).getTime() - horas * HORA).toISOString();
      await gravar({ ouro_coletado_em: voltar(reino.ouro_coletado_em, 24), coletado_em: voltar(reino.coletado_em, 12) });
      return { mensagem: "as minas adiantaram 24 h de trabalho" };
    }

    case "guerra": {
      const agora = new Date().toISOString();
      const [paz, votacao] = await Promise.all([
        db.from("proof_pazes").update({ fim: agora }).eq("status", "aprovada").gt("fim", agora).select("id"),
        db.from("proof_pazes").update({ status: "cancelada" }).eq("status", "votacao").select("id"),
      ]);
      return { mensagem: contar(paz) + contar(votacao) ? "a paz do mundo de teste acabou — dá para invadir de novo" : "o mundo de teste já estava em guerra" };
    }

    case "liberado":
      await gravar({ ...reinoLiberado(), escudo_ate: null });
      return { mensagem: "tudo liberado: construções, Neuro, veículos, personagens, tropas e operários no máximo" };

    case "zerar":
      await apagarReinoDeTeste(usuarioId);
      await criarReinoDeTeste(usuarioId, { liberado: false });
      return { mensagem: `Reino de Teste novo em folha (só o Barco, níveis iniciais) com ${MOEDAS_INICIAIS_DE_TESTE.toLocaleString("pt-BR")} moedas` };

    default:
      throw new ErroDeAcesso(400, "ferramenta de teste desconhecida");
  }
}
