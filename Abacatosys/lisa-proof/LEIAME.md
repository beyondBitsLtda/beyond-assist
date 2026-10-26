# Lisa_Proof

Estudo de programação no estilo Duolingo, em cima dos quadros **STUDY** do Abacato.

- **Quadro** do Abacato com nome começando por `STUDY` → **tema** (ex.: `STUDY JavaScript` → JavaScript).
- **Card** → **assunto** (ex.: "Lógica de programação em JavaScript").
- **Checklist** do card → **tarefas de teoria** (ler apostila, discussão de fórum, definição com a IA...).

A Lisa lê o quadro e monta uma **trilha** progressiva, ignorando as colunas, distribuída nos dias
em que a pessoa estuda. A tela **Hoje** mostra os assuntos do dia com as checklists; marcar aqui
marca o mesmo item no Abacato. Cada tarefa vale pontos, e a **ofensiva** conta os dias seguidos com
estudo.

## Fases

| Fase | O que entra | Situação |
|---|---|---|
| 1 | Quadros STUDY, trilha pela IA, parte teórica, pontos, ofensiva, metas de dia, semana e mês | feita |
| 2 | Quiz e exercício diários sobre o assunto atual, gerados e corrigidos pela IA | feita |
| 3 | Projeto da semana e do mês, entregue por repositório público do GitHub e avaliado pela IA | feita |
| — | Mapa da trilha no estilo Duolingo e o mascote Neuro | feito |
| — | Lembretes por notificação push e app instalável | feito (falta ligar no iMac, ver abaixo) |

## Prática

Fica na aba **Prática** e também aparece como paradas no mapa (baú = projeto da semana, troféu =
projeto do mês). Um desafio de cada tipo por trilha e período — pedir de novo devolve o mesmo, não
gasta a IA outra vez (`proof_desafios`, índice único em usuário + trilha + tipo + período).

| Desafio | Período | Como responde | Tentativas |
|---|---|---|---|
| Quiz do dia | o dia | 5 perguntas, uma por vez; correção no servidor | 1 |
| Exercício do dia | o dia | código num editor; a IA corrige lendo | 3 (vale a melhor) |
| Projeto da semana | segunda a domingo | link de repositório **público** no GitHub | 5 (vale a melhor) |
| Projeto do mês | o mês | link de repositório **público** no GitHub | 5 (vale a melhor) |

- O gabarito do quiz nunca vai para a tela antes da resposta (`quizParaTela`).
- A IA **lê** o código, não executa. Nota 60 ou mais aprova (a aprovação sai da nota, não do que o
  modelo disse).
- Repositório privado é recusado mesmo com `GITHUB_TOKEN`: o token só existe para não esbarrar no
  limite da API sem login, e não pode virar uma porta para ler código privado pela avaliação.
- Até 18 arquivos por projeto, para caber no limite de 50 chamadas de rede por requisição do
  Worker gratuito.

## IA: sobrecarga não é cota

`src/lib/gemini.js` (cópia do Abacato, com acréscimos) percorre as chaves de `GEMINI_API_KEYS`:

| Resposta do Google | O que faz |
|---|---|
| 429 (cota) | põe a chave de castigo por 5 min **naquele modelo** e tenta a próxima |
| 503/500/504 (sobrecarga) | não castiga; espera e tenta outra chave; após 2, vai para o **modelo reserva** |
| 404 (modelo inexistente) | vai direto para o modelo reserva |

Modelo principal: `GEMINI_CHAT_MODEL` (padrão `gemini-3.6-flash`). Reserva:
`GEMINI_MODELO_RESERVA` (padrão `gemini-3.5-flash-lite`). No máximo 14 tentativas por chamada (o
Worker aceita 50 chamadas de rede por requisição). Se um dia o reserva for desligado pelo Google
(404), troque a variável — a lista de modelos ativos sai de `GET /v1beta/models`.

## Agenda

A aba **Agenda** (`/agenda`, `GET /api/agenda?de=&ate=`) junta os compromissos de todas as trilhas
ativas: assuntos nos dias planejados, entregas dos projetos (semana no domingo, mês no último
dia), quiz e exercício do dia e os dias estudados (🔥). Dois modos: **Mês** (calendário; tocar no
dia mostra os detalhes) e **Lista** (atrasados e próximos 14 dias).

Não há tabela de agenda: `montarAgenda` (`src/dominio/agenda.js`) calcula tudo a partir das
etapas, dos desafios e dos eventos — por isso ela já reflete qualquer replanejamento. Atrasado
continua aparecendo até ser feito, mesmo fora do período pedido. A cor de cada trilha segue a
ordem de criação, para não mudar entre visitas.

## Criar curso com a Lisa

Em **Trilhas → Criar curso com a Lisa** (`/trilhas/novo`): tema, nível, objetivo opcional, duração
e dias de estudo. A Lisa **propõe** (`/api/cursos/proposta`, nada é gravado) módulos e assuntos com
objetivo, nível, dias e tarefas de teoria; a quantidade acompanha a duração
(`assuntosParaODuracao`, até 40). A pessoa revisa — tira assuntos, muda o nome — e só então
`/api/cursos` cria, conferindo a proposta de novo (`validarCurso`):

- quadro `STUDY <nome>` no Abacato, um **módulo por coluna**, assuntos como cards, checklist
  "Teoria" em cada um (origem `proof`);
- a **trilha** já na ordem do curso (sem pedir outra ordenação à IA).

Se algo falha no meio, o quadro é apagado (o cascade leva cards, checklists e trilha). O limite de
quadros da conta do Abacato vale aqui também (`src/lib/cursos.js`, espelho de
`abacato/src/dominio/planos.js` — se o número mudar lá, mude aqui).

A proposta pede raciocínio baixo ao modelo (`pensarPouco`): de ~100 s para ~12 s, sem perda
visível. Se o modelo não aceitar a opção, a chamada é refeita sem ela.

## Cadernos, Biblioteca e cursos a partir de livros

Pedido de 25/10/2026. Migração `db/019-cadernos-e-biblioteca.sql`; regras puras em
`src/dominio/cadernos.js`, `biblioteca.js`, `cursoDoLivro.js` e `markdown.js` (testadas por
`npm run biblioteca-check`).

**Cadernos** (`/cadernos`): cada caderno tem módulos e páginas (um nível só). O editor
(`src/componentes/caderno/EditorDoCaderno.js`) é o CodeMirror com a linguagem da página — a extensão
do nome escolhe a cor (`rotas.py` vira Python) — e o Markdown colore os blocos ```` ```js ```` de
dentro. Grava 1,2 s depois de parar de digitar (ou Ctrl+S). Cada gravação manda a `versao` que a aba
tem; se outra aba ou o celular gravou antes, o servidor responde 409 e a tela pergunta o que fazer.

**Vínculos** (`proof_vinculos`): o caderno, um módulo ou uma página ligados a uma trilha (os cursos
são trilhas), um assunto (card), uma torre, um andar ou um livro (com a página). Todo alvo é
conferido no servidor (`src/lib/vinculos.js`): só se vincula ao que é da própria pessoa. O bloco
`<AnotacoesDoAlvo>` aparece na trilha, no assunto, na torre e no leitor, com o "Anotar aqui".

**Biblioteca** (`/biblioteca`): o navegador lê o PDF com o pdf.js (páginas, sumário, capa), o servidor
cria o livro e assina um endereço de envio no bucket privado `proof-biblioteca`, e o arquivo vai
direto para o Storage — o PDF não passa pelo Worker. Depois o navegador manda o texto de cada página
em lotes (`proof_livro_paginas`); se a aba fechar no meio, o leitor termina quando o livro abre de
novo. Limites: 50 MB por PDF (o teto do Storage do iMac) e 2 GB por pessoa
(`LIMITES_DA_BIBLIOTECA`). Para ler, o servidor assina um endereço de 3 h.

**Estante virtual** (`src/componentes/biblioteca/Estante.js`, `src/app/estante.css`): a vista padrão
da Biblioteca (a lista continua no botão "Lista"). Cada livro é uma caixa em CSS 3D — sem WebGL — com
lombada, capa, contracapa, topo e corte das páginas; a espessura vem do número de páginas, e a cor da
lombada vem da capa (ou da paleta, quando a capa é branca). As contas moram em `src/dominio/estante.js`.
Cuidado: animar `opacity` (ou pôr `filter`/`overflow`) num elemento 3D faz o navegador achatá-lo.

**Leitor** (`src/componentes/biblioteca/LeitorDePdf.js`): só as páginas perto da tela são
desenhadas. As marcações guardam retângulos em fração da página (certos em qualquer zoom). A camada
de texto do pdf.js precisa das regras `.textLayer` copiadas em `src/app/biblioteca.css`. PDF
escaneado (sem texto) lê e marca por área, mas não gera curso nem entra na busca (não há OCR).

**Curso a partir de um livro** (`/trilhas/novo?livro=`): a rota de proposta junta as seções
escolhidas do sumário e pede ao banco o começo do texto de cada uma
(`proof_trechos_do_livro`, que corta no Postgres para caber no processamento do Worker). A IA monta
módulos = capítulos e assuntos = trechos de páginas; `validarCursoDoLivro` confere as páginas e põe a
leitura como primeira tarefa. Ao criar, `proof_leituras` guarda as páginas de cada card, e a
explicação, o quiz e o exercício do assunto leem esse trecho (`src/lib/leituras.js`).

## Conquistas e comemorações

**Conquistas** são da conta, não do quadro (`src/dominio/conquistas.js`): ofensiva (3, 7, 14, 30,
60, 100 dias), metas do dia batidas, dias estudados, tarefas, assuntos, quizzes, quizzes
gabaritados, exercícios e projetos aprovados — mais uma por trilha concluída (300 pts). Cada uma
vira um evento `conquista:<codigo>` em `proof_eventos`: soma no total e no nível, e a chave única
garante que é desbloqueada uma vez só. Tudo é recalculado a partir dos eventos, sem contador
guardado. Pontos de conquista **não** contam para a meta do dia.

Depois de qualquer ponto ganho, `depoisDePontuar` (em `src/lib/estudo.js`) confere, num lugar só:
bônus da meta, se a ofensiva subiu (primeiro evento do dia), trilha concluída e conquistas novas.
A tela recebe isso e abre a **comemoração em tela cheia** (`src/componentes/Celebracao.js`): a
chama com o número virando, o anel da meta e a medalha da conquista, em fila.

## Tema

Escuro por padrão; o botão da moldura alterna escuro → claro → sistema (guardado no aparelho).
Quem aplica é um script no `<head>`, antes da primeira pintura; o CSS usa
`:root[data-tema="escuro"]` para trocar os tokens.

## Lembretes (push)

Mesmo desenho da Lisa: o Worker só **guarda** as inscrições (`/api/push`, tabela `proof_push`);
quem **envia** é `scripts/lembretes.mjs`, no relógio do iMac — a biblioteca de push precisa do
Node completo, que o Worker não tem.

- A pessoa liga em **Progresso → Lembretes**. No iPhone só funciona com o app instalado na tela
  de início (Compartilhar → Adicionar à Tela de Início); a tela explica isso.
- O script manda **um** lembrete por pessoa: "ofensiva em risco" (tem sequência e não estudou
  hoje) ou "quiz do dia pendente". O mesmo tipo não se repete no mesmo dia por aparelho, e
  inscrição expirada (404/410) é apagada.
- Chaves VAPID: a pública fica no `.env.local` (vai para o Worker, a tela precisa dela); a
  **privada fica só no `.env.lembretes`**, que só o script lê e que o build não carrega.

**Ligar no iMac** (uma vez):

```bash
cd <pasta do repositório>/Abacatosys/lisa-proof
npm install
# copie para esta pasta os arquivos .env.local e .env.lembretes deste projeto (não estão no git)
npm run lembretes -- --simular     # confere sem mandar nada
npm run lembretes -- --teste       # manda um aviso de teste para os aparelhos inscritos
crontab -e
# acrescente:
0 12,20 * * * cd <pasta do repositório>/Abacatosys/lisa-proof && npm run lembretes >> ~/proof-lembretes.log 2>&1
```

## Pontos

| Ação | Pontos |
|---|---|
| Marcar uma tarefa | 10 |
| Concluir um assunto (todas as tarefas, ou à mão se não tiver tarefas) | +30 |
| Bater a meta do dia (uma vez por dia) | +20 |
| Quiz: cada acerto / gabaritar | 15 / +30 |
| Exercício (nota 100) | até 120 |
| Projeto da semana / final ou do mês (nota 100) | até 450 / de 750 a 1.800 (cresce com a trilha) / até 1.200 |
| Modo Domínio: andar vencido · marco · topo | (15 + 10 × dificuldade) × 3 × fator do nível × nota · 30 × nível × (marco) · 120 × nível × √(andares ÷ 10) |

Desde 26/10/2026 a prática e o Modo Domínio valem o **triplo** (`MULTIPLICADOR_DE_RECOMPENSAS`, em
`src/dominio/pontos.js`): o quiz, o exercício, os projetos, os andares, os marcos, o topo e as moedas
dadas no lugar de veículo ou avatar (2.400 e 4.500). As moedas do Reino vêm dos pontos (1 ponto = 1
moeda), então triplicam junto. A teoria (tarefas, assuntos, meta do dia) e as conquistas da conta
ficam como estavam, e o ponto já ganho continua como foi gravado. Projeto final gerado antes não tem
`escalaDoValor` e passa a valer o triplo na hora de pontuar (`valorNaEscalaDeAgora`).

- Desmarcar devolve os pontos **só se foram ganhos hoje**. Ponto de outro dia é história, e
  desmarcar e marcar de novo não gera ponto nem salva a ofensiva.
- O dia é sempre o de São Paulo, mesmo com o Worker rodando em UTC.
- Metas de semana e mês contam **assuntos** planejados para terminar no período, mais os atrasados
  de antes.

## Bolsa: a Mesa dos Consultores

Seis personagens projetam onde cada ação da Bolsa do Reino fecha hoje (às 17h). Cada um tem
retrato, história, personalidade, método e uma "faixa de erro" que **diz** ter. A margem de erro de
verdade é segredo e muda todo dia.

| Consultor | Jeito de errar |
|---|---|
| Madame Ametista, a vidente | Exagera o movimento. Tem dias de visão clara e dias de neblina. Diz ±1% e quase nunca acerta a faixa. |
| Barão Baltazar Cifrão, o banqueiro | Acha que o mercado anda pouco. Acerta o lado com frequência e erra o tamanho. |
| Luna "Foguete" Estrela, a influenciadora | Vê alta em tudo, principalmente em tecnologia e viagem espacial. |
| Professor Corvo, o estatístico | É o mais constante. De vez em quando "o modelo quebra" e ele erra feio. |
| Dona Zuleica, a feirante | Muito irregular. Arredonda tudo e entende de comida. |
| Gorgo, o Urso, o pessimista | Vê crise em tudo. |

Como funciona:

- **Cálculo.** A Lisa decide o fechamento do dia logo no primeiro acesso, e ele fica no servidor.
  Cada projeção sai de `exagero × variação de verdade + viés + ruído`. O tamanho do ruído, o
  exagero e o viés são sorteados por consultor e por dia. Tudo usa semente: todos veem a mesma
  projeção, e nada é gravado no banco.
- **Placar.** O placar dos pregões passados é recalculado a partir dos preços. Por isso, mudar os
  números de `src/dominio/projecoes.js` muda também as projeções antigas.
- **Segredo.** Antes das 17h, `/api/reino/bolsa/consultores` só entrega a projeção, a faixa
  declarada e a fala. Depois das 17h, entrega também o fechamento, o erro de cada um e o placar do
  dia, com nota = 10 − erro médio em pontos percentuais. No Reino de Teste, isso vale para a hora
  simulada.
- **Estreias.** A empresa que estreia no dia fica de fora, porque abre e fecha no preço de
  lançamento.
- **Servidor e navegador.** `src/dominio/projecoes.js` (o segredo) só pode ser importado pelo
  servidor; o `dominio-check` barra o import em qualquer tela. O que a tela mostra de cada
  personagem está em `src/dominio/consultores.js`. Os retratos de papel estão em
  `src/componentes/bolsa/consultoresDePapel.js`.

## Onde as coisas moram

| Caminho | O quê |
|---|---|
| `src/dominio/` | Regras puras: datas, ofensiva, plano/agenda da trilha, metas, pontos. Testadas por `npm run dominio-check`. |
| `src/lib/estudo.js` | Único caminho até as tabelas do Abacato: permissão (dono + STUDY), marcar item, concluir card, pontos. |
| `src/lib/trilhas.js` | Criar, replanejar, apagar e ler trilhas. |
| `src/lib/ia.js` | IA da parte teórica: ordem da trilha, checklist de teoria, explicação. |
| `src/dominio/pratica.js` | Regras puras da prática: períodos, pontos, conferência do que a IA devolve, desenho do mapa. |
| `src/lib/pratica.js` · `src/lib/iaPratica.js` · `src/lib/github.js` | Prática no banco, IA da prática e leitura do GitHub. |
| `src/componentes/Neuro.js` · `src/app/neuro.css` | O mascote: SVG com humores trocados por classe CSS; `reagir()` e `comemorar()` de qualquer tela. |
| `src/componentes/MapaDaTrilha.js` · `src/app/mapa.css` | O mapa da trilha. |
| `src/lib/auth.js` | Cópia do login do Abacato. **Não mude `chaveDeLogin` aqui sem mudar lá.** |
| `db/001-proof.sql` · `db/002-pratica.sql` | Tabelas `proof_`. |

## Colocar no ar

1. **Banco**: aplique a migração (pode rodar duas vezes sem estragar nada).

   ```bash
   cp .env.example .env.local     # e preencha
   npm install
   npm run migrar -- db/001-proof.sql
   npm run migrar -- db/002-pratica.sql
   npm run migrar -- db/003-lembretes.sql
   npm run migrar -- db/004-conquistas.sql
   ```

2. **Worker**: crie as variáveis no painel da Cloudflare (Workers → `lisa-proof` → Settings →
   Variables), como **secret** as que são segredo:

   | Variável | Valor |
   |---|---|
   | `SUPABASE_URL` | o mesmo do Abacato |
   | `SUPABASE_SERVICE_ROLE_KEY` | o mesmo do Abacato (secret) |
   | `PROOF_SESSAO_SECRET` | um valor **novo** sorteado (secret) — não reaproveite o do Abacato |
   | `GEMINI_API_KEYS` | as mesmas chaves do Abacato (secret) |
   | `ABACATO_URL` | `https://abacato.beyond.dev.br` |
   | `GITHUB_TOKEN` | opcional (secret) — só aumenta o limite de leitura de repositórios públicos |
   | `VAPID_PUBLIC_KEY` | a chave pública dos lembretes (a privada NUNCA vai para o Worker) |

3. **Publicar**: `npm run publicar`. O `wrangler.jsonc` já aponta o domínio `proof.beyond.dev.br`
   e tem `keep_vars: true`, para o deploy não apagar as variáveis.

4. **Conferir**: `https://proof.beyond.dev.br/api/saude?banco=1` deve responder
   `"ok": true` e `"tabelas": "ok"`.

Para rodar local: `npm run dev` (porta 3100). O login exige HTTPS ou `localhost`, porque a senha
é calculada com WebCrypto no navegador.

## Decisões que valem lembrar

- **Só o dono** do quadro alcança a trilha, não os membros ("quadros criados pelo meu usuário").
- **Card recorrente** do Abacato não é concluído por aqui: lá, concluir arquiva uma cópia e reabre
  o card com a próxima data, e repetir essa lógica aqui seria ter duas versões dela.
- **Ids curtos para a IA** (`c1`, `c2`...): copiar uuids é onde o modelo erra, e um id errado é um
  assunto perdido. O que a IA esquece ou inventa é corrigido em `validarPlano`.
- **Replanejar** grava o plano novo antes de apagar o antigo; o que já foi concluído mantém as datas.
