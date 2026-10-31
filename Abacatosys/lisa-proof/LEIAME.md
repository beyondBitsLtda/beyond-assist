# Lisa_Proof

Estudo no estilo Duolingo, em cima dos quadros **STUDY** do Abacato. Nasceu para programação; desde
30/10/2026 cada curso tem um **perfil** (programação, música, idiomas, matemática ou livre) e a
prática acompanha o tema — ver "Cursos que não são de programação", abaixo.

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
| — | Perfis de curso: música, idiomas, matemática e livre, com motores de prática e entrega por evidências | feito (30/10/2026) |

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
- **Previsões no gráfico.** O gráfico de cada ação mostra as previsões dos consultores.
  - No gráfico hora a hora, cada um tem uma linha tracejada da abertura até as 17h, terminando no
    fechamento que projetou. O "sobe-e-desce" de cada linha depende do traço do consultor: a Madame
    oscila muito, o Barão quase em linha reta (`caminhoPrevisto`).
  - Nas velas, aparece o fechamento que cada um projetou em cada pregão dos últimos 14 dias.
  - A legenda liga e desliga cada consultor, e a escolha fica guardada no navegador.
  - A cor de cada consultor é a mesma no cartão, no rosto e na linha. É uma paleta validada no fundo
    escuro, longe do verde e do vermelho da cotação. O rosto na ponta da linha garante que a cor
    nunca está sozinha.
- **Servidor e navegador.** `src/dominio/projecoes.js` (o segredo) só pode ser importado pelo
  servidor; o `dominio-check` barra o import em qualquer tela. O que a tela mostra de cada
  personagem está em `src/dominio/consultores.js`. Os retratos de papel estão em
  `src/componentes/bolsa/consultoresDePapel.js`.

## Biblioteca Colaborativa (Acervo)

Em `/acervo`, todo mundo pode trazer material para um acervo comum:

- livro em PDF;
- artigo científico, em PDF ou por link (DOI ou página);
- videoaula ou vídeo teórico, por link do YouTube ou do Vimeo.

Cada envio tem nome, capa, categoria, assunto e uma descrição opcional. A capa de um PDF é a 1ª
página, mas a pessoa pode escolher outra imagem.

**Quem é o bibliotecário.** São dois: o administrador (a conta de `PROOF_ADMIN_EMAIL`, a mesma
da Lisa) e o líder do ranking da semana. Ninguém aprova o próprio envio, a não ser quando é o
único bibliotecário. Para recusar, o motivo é obrigatório, e o PDF recusado sai do disco.

**Moedas.** As recompensas são do Reino de verdade (livro-caixa) e o mundo de teste não tem
acervo.

| Quem | O que ganha | Tipo no livro-caixa |
|---|---|---|
| Quem trouxe, quando o material é aprovado | 🪙 300 (livro), 250 (artigo), 150 (videoaula), 120 (vídeo teórico), mais 10% a cada nível da biblioteca | `acervo` |
| O bibliotecário, por revisão (aprovada ou recusada), menos nos próprios envios | 🪙 25 | `acervo_revisao` |
| Quem trouxe, quando alguém agradece | gorjeta de 🪙 10, 25 ou 50, uma por material por pessoa | `gorjeta_dada` / `gorjeta_recebida` |

**Limites e duplicados.** Cada pessoa manda até 5 envios por dia. Duplicado é o mesmo vídeo, o
mesmo PDF (pelo SHA-256) ou o mesmo título no mesmo tipo. Índices únicos no banco barram os
duplicados que estão na fila ou no acervo.

**O mundo.** É uma ilha 3D no papel recortado do Reino, com quatro construções:

| Construção | Funcionário | Acervo |
|---|---|---|
| Torre dos Livros | Dona Celeste, a Bibliotecária | livros |
| Observatório dos Artigos | Doutora Íris, a Cientista | artigos |
| Auditório das Videoaulas | Mestre Tobias, o Professor | videoaulas |
| Cinema dos Vídeos | Pipoca, o Projecionista | vídeos teóricos |

- Cada construção cresce com o nível do seu acervo (10 níveis), e a biblioteca toda tem um nível,
  que aumenta as recompensas.
- Os avatares de quem mais contribuiu andam entre as construções do que trouxeram. Clicando num
  deles, aparece o que a pessoa trouxe. É a interação "sem ser ao vivo" que foi escolhida; ver os
  outros andando ao mesmo tempo ficou para uma segunda etapa.
- O terreno tem relevo de verdade (`altura()` em `MundoDaBiblioteca.js`). É uma malha polar com:
  - colinas, e um lago cujo riacho vira cachoeira na borda;
  - o penhasco em camadas por baixo;
  - árvores, pedras e flores;
  - caminhos de pedra com postes de luz, e bancos na praça.

  O chão fica plano onde estão a praça, os caminhos e os lotes das construções. As construções
  são 35% maiores e projetam sombra.

**A tela.** A tela é organizada assim:
- o mundo grande, com o painel do nível por cima (no celular ele desce para o rodapé do mundo);
- a faixa das quatro construções, com a barra até o próximo nível e quanto cada tipo vale agora;
- o acervo em prateleiras: "Chegaram agora" e uma prateleira por tipo. Procurando ou filtrando, as
  prateleiras viram uma grade.

Clicar num cartão abre a ficha do material, com a capa, os dados, quem trouxe, as ações e a
gorjeta. Na aba de envio, uma prévia mostra o cartão como vai aparecer no acervo.

**Modo cinema.** `SalaDeCinema.js` monta uma sala 3D: tela com moldura dourada, cortinas,
poltronas em degraus (instanciadas), arandelas e o facho do projetor com poeira.
- **O vídeo na tela.** O vídeo é um iframe do YouTube ou do Vimeo desenhado pelo `CSS3DRenderer`
  atrás do WebGL. A tela 3D é um buraco transparente (`NoBlending` com opacidade 0), por isso a
  perspectiva bate e quem está na frente tapa o vídeo.
- **A plateia.** Você, quem trouxe o vídeo e os contribuidores, até 16. Da poltrona, a plateia
  aparece em silhueta; em "Ver a plateia", a câmera vai para o palco e mostra os rostos com os
  nomes. Não é ao vivo.
- **Controles.** "Acender as luzes", tela cheia e Esc para sair.
- **Sem WebGL.** O vídeo abre no modo normal.

**Ler.** "Ler na minha biblioteca" cria o livro na estante da pessoa apontando para o PDF do acervo
(`proof_livros.acervo_id`). O arquivo não é copiado, não ocupa o espaço dela e não é apagado
quando ela tira o livro da estante. Marcações, busca e cursos funcionam como num PDF próprio.

**Direitos autorais.** O dono do Proof decidiu aceitar qualquer PDF, depois de ser alertado
sobre os livros com direitos. "Retirar do acervo" (só o bibliotecário) é o caminho para atender
a uma reclamação. O material sai da lista, e quem já tinha levado o livro para a própria estante
continua com ele.

**Arquivos.**
- Banco: `db/020-biblioteca-colaborativa.sql`. Os PDFs ficam no bucket privado `proof-acervo`.
- Regras: `src/dominio/acervo.js`.
- Servidor: `src/lib/acervo.js` e as rotas em `/api/acervo`.
- Tela: `src/componentes/acervo/`.

## Cursos que não são de programação (perfis)

Pedido de 30/10/2026; proposta em https://claude.ai/artifact/ELisFtpFs9CtmDW53QKy96. Migração
`db/022-perfis-de-curso.sql` (a coluna `proof_trilhas.perfil`; toda trilha antiga fica `programacao`).

**O perfil** (`src/dominio/perfis.js`) não muda a trilha, a teoria, a agenda, os pontos nem o Reino.
Ele troca três peças da prática: o **motor** do exercício do dia, a **evidência** do projeto no
lugar do GitHub e o jeito de a Lisa falar (`personaDo`, em `src/lib/ia.js`; programação continua com
a PERSONA de sempre). Quem escolhe: a IA, ao propor o curso (a pessoa troca na revisão); o quadro
STUDY que vira trilha sem passar pela IA, pelo nome do tema (`perfilPeloTema`); e a pessoa, a
qualquer hora, em **Ajustes da trilha → Tipo de curso** (vale para a prática que vier depois).

| Perfil | Exercício do dia (motores) | Projeto: o que se entrega |
|---|---|---|
| Programação | código (o de sempre) | repositório no GitHub |
| Música | treino de ouvido, ritmo e afinação (pelo assunto, `motoresDaMusica`) e desafio aberto | áudio, vídeo do YouTube, texto |
| Idiomas | ditado e desafio aberto (redação, tradução, pronúncia) | texto, áudio |
| Matemática e exatas | lista de cálculo e desafio aberto (resolução no caderno) | texto, fotos |
| Livre (qualquer tema) | desafio aberto (missão prática) | texto, fotos, áudio, vídeo do YouTube |

Nos perfis com dois motores, eles se alternam de um dia para o outro e na rodada extra
(`motorDoExercicio`).

**Os motores** (`src/dominio/motores.js`). O desafio continua `tipo: "exercicio"` — períodos,
rodadas, agenda e pontos não mudam —, com o motor em `conteudo.motor` (exercício antigo, sem motor,
é código):

- **aberto** — tarefa ou missão; a IA gera os critérios (a rubrica) e corrige a entrega por eles. 5 tentativas, vale a melhor.
- **calculo** — 3 a 6 itens de número ou expressão. O **servidor** corrige, sem IA: o analisador de
  `src/dominio/expressao.js` lê a escrita do dia a dia (`2x²`, `√2`, vírgula), confere a equivalência
  em 8 valores de x e a forma pedida (fatorada, expandida, simplificada). Item que a IA mandou com
  resposta ilegível é descartado antes de chegar à pessoa.
- **ditado** — a voz do navegador fala; a correção compara palavra a palavra (acento errado vale meio,
  palavra a mais custa). A frase vai para a tela **embaralhada** (não é segredo, só não fica à vista).
- **ouvido** — intervalos ou acordes montados pelo código (sem IA, semente fixa), tocados pelo Web Audio.
- **ritmo** — 6 compassos de 4 tempos (`src/dominio/musica.js`): o metrônomo conta 4 e a pessoa bate
  no botão grande (ou na barra de espaço). Vão os instantes dos toques em ms; o servidor casa cada
  batida com o toque mais perto (até 60 ms vale inteiro, até 200 ms um pouco) e **desconta o atraso
  fixo do aparelho** (a mediana dos desvios, até 180 ms — toque na tela, fone Bluetooth). Toque a
  mais custa meia batida.
- **afinacao** — 6 notas: ouvir a referência e cantar (ou tocar) a mesma nota, ou o intervalo pedido
  (assunto de solfejo). O navegador detecta a altura no microfone (`detectarAltura`, um YIN
  simplificado, testado com seno sintético) e mostra a agulha ao vivo; vai só a frequência, e o
  servidor mede os cents **em qualquer oitava** (até 20 cents é afinado). O som não é gravado nem enviado.

Música escolhe o motor pelo assunto (`motoresDaMusica`, em `src/dominio/perfis.js`): ritmo/compasso →
ritmo; canto/voz/afinação → afinação; intervalos/acordes/teoria → ouvido e afinação; o resto (uma
peça, a postura) → desafio aberto e ritmo.

Os cinco corrigidos no servidor têm **uma tentativa só** (`tentativasDe`, em `src/dominio/pratica.js`),
como o quiz, e o gabarito só vai para a tela depois da correção (`exercicioParaTela`).

**A entrega por evidências** (`EntregaComEvidencias`, em `src/componentes/pratica/Motores.js`):

- Fotos reduzidas no navegador (1600 px, JPEG) e uma miniatura de 240 px; áudio gravado (ou um
  arquivo) convertido no navegador para **WAV mono de 16 kHz** — o Gemini não lê o WebM do Chrome.
  Até 3 fotos, 90 s de áudio no exercício e 180 s no projeto (`LIMITES_DA_EVIDENCIA`).
- Vai como **formulário multipart** (`src/lib/entregas.js`), em binário: base64 dentro de JSON pesaria
  um terço a mais e gastaria CPU do Worker. O corpo do pedido ao Gemini é montado uma vez só
  (`gemini.js`), não a cada chave tentada.
- **Nada é guardado**: as fotos e o áudio vão para a IA e somem. O desafio guarda o texto, o link, a
  duração do áudio e as miniaturas (LGPD: o mínimo para a pessoa rever o que mandou).
- Vídeo do YouTube vai como `fileData` para o Gemini assistir. Se ele não abrir (privado, removido), a
  avaliação é refeita sem o vídeo e o servidor avisa no comentário.
- A avaliação (`avaliarEntrega`, em `src/lib/iaPratica.js`) devolve o mesmo formato da avaliação de
  código: os projetos continuam pontuando **por requisito**.

### Cartões com repetição espaçada

Pedido de 31/10/2026. Migração `db/023-cartoes-turma-e-torres-de-tema.sql` (`proof_cartoes`). Regras
em `src/dominio/cartoes.js`; banco em `src/lib/cartoes.js`; tela em `/cartoes` (atalho na Prática).

- Frente, verso e exemplo, por trilha (qualquer perfil, programação também). **A Lisa cria** de 6 a 10
  do assunto da vez (`gerarCartoes`, prompt por perfil: em idiomas, a palavra na língua e a tradução);
  **a pessoa escreve** os dela. Até 400 por trilha; a Lisa cria até 60 por dia.
- A agenda é a do **SM-2** com quatro respostas (esqueci, difícil, lembrei, fácil): esqueceu, volta
  amanhã (e na mesma sessão, no fim da fila); lembrou, o intervalo cresce (1, 3 dias, depois × a
  facilidade, até 1 ano). Os botões mostram quando cada resposta faz o cartão voltar.
- A revisão do dia: os vencidos (os mais atrasados primeiro) e até 15 novos, no máximo 40.
- **Pontos**: 2 por cartão diferente revisado no dia, até 20, numa chave do dia (`cartoes:AAAA-MM-DD`,
  tipo `cartoes` no livro de pontos) — contam para a ofensiva e viram moedas.

### Revisão da turma

Pedido de 31/10/2026. Migração 023 (`proof_revisoes`). Regras em `src/dominio/revisoes.js`; banco em
`src/lib/revisoes.js`; telas no desafio (`PedirRevisao`) e em `/revisoes` (atalho na Prática).

- Depois da avaliação de um **desafio aberto** ou de um **projeto por evidências**, quem entregou pode
  **contestar** os critérios que a Lisa deu como não cumpridos, com uma justificativa para cada um, e
  consentir que a entrega apareça **sem o nome** para um colega. Um pedido por desafio.
- O pedido guarda uma cópia do que já ficava no desafio: o texto, o link do vídeo, as miniaturas das
  fotos e a duração do áudio. **Nenhuma foto inteira, nenhum áudio** — critério que só o áudio mostra
  a turma não consegue julgar (e pode dizer "não dá para julgar").
- Na fila, um colega dá o veredito de cada critério contestado (cumpriu, não cumpriu, não dá para
  julgar) e um comentário. O pedido fecha primeiro (trava: só quem o encontra "aberta" grava).
- **Para quem pediu**, o que a turma confirmou passa a valer (`aplicarRevisao`): no desafio aberto, a
  nota vira a maior entre a da Lisa e a fração de critérios cumpridos; no projeto, o requisito entra
  nos cumpridos e soma a parte dele. A nota e os pontos **só sobem**.
- **Para quem revisou**: 15 pontos (= moedas) por revisão, até 5 por dia (tipo `revisao` no livro de
  pontos). Ninguém revisa o próprio pedido nem o mesmo colega duas vezes na semana; o pedido vence em
  14 dias.

### Modo Domínio de tema

Pedido de 31/10/2026. Migração 023 (`proof_dominios` ganha `origem`, `perfil` e `tema`; o repositório
fica opcional, com uma checagem que exige um ou outro). Regras em `src/dominio/modoDominio.js`
(seção "a torre de TEMA"); IA em `src/lib/iaDominio.js` (`analisarTema`, `montarTorreDoTema`,
`detalharDesafioDoTema`, `avaliarAndarDoTema`); banco em `src/lib/dominio.js`.

- Em `/dominio`, **Um tema**: o tipo (Torre de repertório, do QECR, de problemas ou de missões, pelos
  perfis música, idiomas, matemática e livre), o tema e, se quiser, o ponto de partida. A Lisa diz se
  o tema dá uma torre e o nível (1 a 5), como faz com o repositório.
- Os andares, os chefões, a luta, os pontos, os marcos, os prêmios do Reino e o certificado são os
  mesmos. Muda a entrega: **cada andar é entregue na própria tela** (`EntregaDoAndar`), por texto,
  fotos, áudio de até 3 min ou vídeo do YouTube — o que o desafio do andar aceitar. Sem branch.
- Os cinco atributos do Neuro ganham o nome do perfil (`atributosDaTorre`: em música, técnica, ritmo,
  afinação, expressão e repertório). A entrega guarda só um resumo (o texto até 600 caracteres, o
  link, a duração do áudio e o número de fotos).
- O certificado e a página de conferência dizem "torre do tema" e mostram o tema no lugar do repositório.

## Mercado de tropas

Pedido de 30/10/2026: vender tropas do exército ou da defesa para liberar espaço, e os outros
jogadores comprarem.

- **Anunciar.** O botão **💱 Vender** de cada tropa abre a folha de venda (quantas e o preço por
  tropa). As tropas anunciadas **saem na hora** da reserva: o espaço e a lotação do Acampamento
  ficam livres, e elas não lutam mais por ninguém até alguém comprar. O preço vai de 20% ao custo
  do treino (`faixaDePreco`): ninguém paga mais do que pagaria para treinar, e moeda não se
  multiplica. Até 10 anúncios abertos por reino e 60 tropas por anúncio.
- **Comprar.** Quem compra escolhe se vão para o exército ou para a defesa e segue as mesmas
  regras do treino (`podeReceber`, em `src/dominio/tropas.js`): a construção no nível da tropa, o
  espaço da reserva e a lotação do Acampamento. Dá para comprar só parte do anúncio. O vendedor
  recebe na hora (`mercado_venda` no livro-caixa; quem compra lança `mercado_compra`).
- **Retirar.** O que não foi vendido volta para a reserva de onde saiu, se ainda couber.
- **Dinheiro em dobro e tropa em dobro.** O anúncio é a tropa fora do reino, então a ordem importa:
  anunciar tira do reino (trava de versão) antes de criar o anúncio; comprar desconta do anúncio
  por "compare e troque" (só grava se o `restante` ainda é o que foi lido) antes de pagar; qualquer
  falha depois disso desfaz os lançamentos e devolve as tropas ao anúncio.
- **Reino de Teste.** A tabela tem a gêmea `proof_teste_mercado_tropas`, e os reinos-robô anunciam
  tropas (`RIVAIS_DE_TESTE[].tropas`), refeitas quando a vitrine fica sem nenhuma.
- **Limite do Worker.** O POST de `/api/reino/mercado` devolve só o reino; a tela pede o mercado de
  novo pelo GET (os dois juntos chegariam perto das 50 chamadas de rede por requisição).

**Arquivos.** Banco: `db/021-mercado-de-tropas.sql`. Regras: `src/dominio/mercadoDeTropas.js`.
Servidor: `src/lib/reino.js` (seção "o mercado de tropas") e `/api/reino/mercado`. Tela:
`src/componentes/reino/MercadoDeTropas.js`.

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
