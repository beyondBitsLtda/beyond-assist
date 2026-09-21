# Abacato System

Quadros, documentação e acompanhamento da Beyond Bits. Substitui o Trello.

Mora no **mesmo Postgres da Lisa**, em tabelas com prefixo `abacato_`, mas o **login é
próprio**: nenhuma conta do Abacato é uma conta da Lisa, e o cookie tem outro nome
(`abacato_sessao`). Isso é exigência, não detalhe — os dois sistemas vivem em subdomínios
vizinhos e uma sessão não pode valer no outro.

## Rodar aqui na máquina

As três variáveis abaixo ficam no `.env.local`, que o git ignora. A chave de serviço é a
**chave-mestra do banco** — ela sai do `~/lisa/.env` do iMac e não vai para lugar nenhum além
desse arquivo.

```bash
# .env.local
SUPABASE_URL=https://banco.beyond.dev.br
SUPABASE_SERVICE_ROLE_KEY=<a service_role do ~/lisa/.env no iMac>
ABACATO_SESSAO_SECRET=<qualquer texto longo; troca invalida todas as sessões>
```

```bash
npm install
npm run dev          # http://localhost:3000
```

O cookie de sessão é `Secure`, e navegador nenhum manda cookie `Secure` por HTTP — **exceto
para `localhost`**, que os navegadores tratam como contexto seguro. Por isso funciona em
`localhost` e só ali; em qualquer outro endereço o sistema precisa de HTTPS.

## Criar um usuário

```bash
node scripts/criar-usuario.mjs "alguem@beyond.dev.br" "Nome"
```

Não fala com o banco: sorteia a senha, grava em `~/senha-abacato.txt` (modo 600) e imprime o
SQL para aplicar onde o banco estiver. A senha não passa pela tela nem pela rede junto de uma
conexão que talvez não esteja cifrada.

Depois, para provar que o usuário criado realmente entra:

```bash
npm run login-check
```

## No ar

**https://abacato.beyond.dev.br**

Cloudflare Worker, na conta `beyondbitsLisa` — a mesma da Lisa, em projeto separado. O banco
continua sendo o Postgres do iMac, alcançado pelo túnel em `banco.beyond.dev.br`. O quadro
inteiro carrega em 0,3–0,5s por esse caminho.

Publicar de novo:

```bash
npm run publicar        # empacota e sobe
```

As três variáveis do servidor são segredos do Worker, gravadas uma vez:

```bash
printf '%s' "https://banco.beyond.dev.br" | wrangler secret put SUPABASE_URL
printf '%s' "<a service_role>"            | wrangler secret put SUPABASE_SERVICE_ROLE_KEY
printf '%s' "<texto longo e aleatório>"   | wrangler secret put ABACATO_SESSAO_SECRET
```

O `ABACATO_SESSAO_SECRET` que está valendo ficou em `~/abacato-segredos.txt`. Perdê-lo não é
fatal (só derruba quem estiver logado), mas é ele que permitiria um segundo servidor aceitar o
mesmo login.

Depois de cada publicação, o primeiro lugar para olhar é `/api/saude`:

```json
{"configurado": true, "banco": true, "sessao": true, "selo": {"ok": true, "ms": 0}}
```

São quatro coisas que quebram de forma independente e com sintomas parecidos. O `selo` é o
trabalho de criptografia que o SERVIDOR faz por login, e ele custa microssegundos — se esse
número começar a subir, alguém devolveu trabalho pesado para o servidor sem perceber.

`/api/saude?cripto=1` testa também a esticada completa da senha, aquela que hoje acontece no
navegador. Ela não é testada por padrão porque custa CPU de verdade, e uma rota de saúde que
derruba o servidor que deveria vigiar não serve para nada.

## O login é calculado no navegador

Esta é a decisão menos óbvia do sistema, e ela veio de uma medição.

Com o cálculo no servidor, o Worker respondia `error code: 1102` — estouro de CPU — depois de
três ou quatro logins seguidos. Cada login custava ~150ms de CPU e o orçamento de um Worker no
plano gratuito é de ~10ms: ele tolera rajadas curtas e depois corta. Pior: como o login calcula
a senha **mesmo para e-mail inexistente** (senão o tempo de resposta diria quem tem conta),
qualquer pessoa de fora derrubava o sistema mandando logins errados, de graça.

Então o trabalho pesado mudou de lado. O navegador estica a senha (210 mil iterações de
PBKDF2) e manda a **chave derivada**; o servidor guarda um HMAC dela e compara. É o desenho do
Bitwarden e do 1Password.

| | |
| --- | --- |
| banco vazado | igual de difícil: achar a senha ainda exige passar pelas 210 mil iterações por tentativa |
| em trânsito | igual: a chave viaja no lugar da senha e vale o mesmo, sob o mesmo HTTPS |
| CPU do servidor | de ~150ms para microssegundos, e o ataque de queimar CPU deixou de existir |
| senha no servidor | ele nunca mais a vê em texto puro |

Depois da mudança: **20 logins seguidos, sem pausa, 20 entraram.** Antes quebrava no quarto.

Duas consequências práticas:

**O e-mail é o sal.** O navegador precisa do sal antes de falar com o servidor, e uma rota que
entregasse o sal de cada e-mail seria uma lista de quem tem conta aqui. Por isso ele é derivado
do próprio e-mail, e não sorteado.

**`crypto.subtle` só existe em página segura** — HTTPS ou `localhost`. Abrir o sistema por um
endereço de rede local tipo `http://192.168.x.x` faz o login falhar com o servidor perfeitamente
no ar. A tela de login detecta esse caso e diz exatamente isso, em vez de "sem resposta do
servidor".

O número de iterações é uma **constante** no código, não um valor por usuário: o navegador
precisa dele antes de qualquer ida ao servidor. Mudá-lo obriga todo mundo a cadastrar a senha de
novo.

## Quem acessa o quê

Duas perguntas diferentes, e o sistema não as mistura.

**Ter conta** é entrar no Abacato, e só. Quem administra (`/pessoas`) cria contas, sorteia
senhas, promove outros administradores e desliga quem saiu. Uma conta recém-criada não enxerga
quadro nenhum — nem os que já existem.

**Ter acesso a alguma coisa** é ser convidado para ela, uma a uma, pelo botão *Quem acessa*.
Quadros e projetos de documentação têm listas **separadas** de gente: convidar alguém para o
quadro do CRM não abre a documentação do CRM. Os papéis:

| papel | vê | comenta | edita, cria, arquiva | convida | arquiva a coisa inteira |
| --- | :-: | :-: | :-: | :-: | :-: |
| dono | ✓ | ✓ | ✓ | ✓ | ✓ |
| editor | ✓ | ✓ | ✓ | | |
| comentarista | ✓ | ✓ | | | |
| leitor | ✓ | | | | |

Três decisões que valem a explicação:

**Quem não foi convidado recebe 404, não 403.** Um 403 confirmaria que aquele quadro existe
para quem só tinha um palpite de URL.

**A permissão é conferida na subida, não na rota.** Um card não sabe quem pode editá-lo — isso
depende do quadro, três tabelas acima. Esse caminho existe num lugar só (`src/lib/acesso.js`),
porque bastaria *uma* rota esquecer de subir para o sistema inteiro ter um buraco — e seria a
rota menos usada, que ninguém testa.

**Ninguém se desliga nem rebaixa o último administrador.** Um Abacato sem ninguém que possa
criar contas só volta pelo terminal do servidor. As duas travas ficam no servidor, não na tela.

O sinalizador de administrador é lido do **banco** a cada pedido, nunca do cookie: o cookie vale
uma semana, e tirar o acesso de alguém precisa valer no mesmo instante.

## A Lisa

Um botão no canto de qualquer tela do sistema abre uma janela de conversa. Ela lê os quadros, os
documentos e os prazos de quem está falando, e **cria tarefa, muda prazo, move de coluna, abre
quadro, projeto e pasta** a partir da conversa. Toda ação aparece marcada na conversa.

**A liberação é por pessoa**, em `/pessoas`. Uma conta nova nasce **sem** a assistente: cada
conversa custa cota do modelo, e uma assistente ligada para todo mundo é uma conta que ninguém
decidiu abrir. Ligar é um clique; descobrir que a cota acabou, não. O sinalizador é lido do
banco a cada pedido — tirar vale na hora, sem esperar o cookie vencer.

**Ela não tem poder próprio.** Toda ferramenta passa pelo mesmo `exigir()` das rotas normais,
com a sessão de quem está conversando: se você não pode editar aquele quadro, pedir a ela também
não edita. É por isso que o laço do agente roda **dentro do Abacato**, e não na Lisa de fora —
executado lá, ele usaria a credencial do serviço e qualquer pessoa com acesso à assistente
passaria a ter acesso a tudo.

**E ela não apaga nada.** Não existe ferramenta de apagar, arquivar ou remover, nem de dar e
tirar acesso. Criar e editar se desfaz olhando; apagar por engano, a partir de uma frase mal
entendida, não.

O modelo é falado pela API REST (a biblioteca do Google não roda no runtime da Cloudflare), com
o mesmo pool de chaves da Lisa em `GEMINI_API_KEYS`. Sem essa variável o botão simplesmente não
aparece.

## Migrações

Os arquivos em `db/` são aplicados por:

```bash
npm run migrar db/008-lisa.sql
```

Não é um sistema de migração: não guarda o que já rodou nem desfaz nada. Por isso **todo arquivo
do `db/` é escrito para poder rodar duas vezes** (`add column if not exists`, `create table if
not exists`). Ele usa o endpoint `/pg/query` do Supabase, que é o mesmo caminho do Studio e
aceita DDL — coisa que a API REST não faz.

## Conferências

Todas falham alto. As sete primeiras rodam sem banco e sem rede:

| comando | o que garante |
| --- | --- |
| `npm run auth-check` | senha, assinatura de sessão, payload forjado, rota livre vs. protegida |
| `npm run dominio-check` | posições, prazos, checklists, papéis — papel desconhecido não ganha poder nenhum |
| `npm run recorrencia-check` | regras de repetição e colagem de listas: dia 31 em fevereiro, ano bissexto, virada de ano |
| `npm run trello-check` | a leitura da exportação do Trello: cores, arquivados, anexos, cards órfãos |
| `npm run parede-check` | papéis de parede: gradiente, imagem e o valor torto que viraria CSS injetado |
| `npm run arrastar-check` | a leitura de uma pasta arrastada do computador, com subpastas |
| `npm run estilo-check` | toda classe `abacato-*` usada nas telas existe no CSS — o defeito que só aparece na tela |
| `npm run login-check` | o caminho inteiro do login contra o banco de verdade (precisa do `.env.local`) |
| `npm run quadro-check` | o quadro de ponta a ponta por HTTP: arrastar, copiar, permissões, fronteiras entre quadros |
| `npm run importar-check` | a importação gravando de verdade — e reimportando sem duplicar |
| `npm run documento-check` | projetos, pastas, revisões e como cada tipo de arquivo abre |
| `npm run painel-check` | os números do painel e o link público do cliente, com as dez travas de vazamento |
| `npm run pessoas-check` | contas, papéis e permissões: 67 pedidos feitos com a sessão de outra pessoa |
| `npm run cliente-check` | o painel do cliente: o que ele vê e o que o link público nunca entrega |
| `npm run lisa-check` | a assistente: quem pode usá-la, e que ela não alcança nem apaga nada além do seu |

Os cinco últimos precisam do servidor no ar, e criam coisas de teste que eles mesmos limpam
no fim:

```bash
ABACATO_URL=http://localhost:3000 npm run quadro-check
ABACATO_URL=http://localhost:3000 npm run importar-check
ABACATO_URL=http://localhost:3000 npm run documento-check
ABACATO_URL=http://localhost:3000 npm run painel-check
ABACATO_URL=http://localhost:3000 npm run pessoas-check
```

O `pessoas-check` merece uma palavra: ele cria duas contas descartáveis, entra com cada uma e
tenta fazer, com a sessão delas, o que aquele papel **não** deveria poder. Cada recusa está
pareada com a mesma chamada dando certo sob outro papel — a leitora recebe 403 ao criar um
card e a editora recebe 201 no mesmo endereço. É o que impede o teste de passar por engano,
com um sistema que recusa tudo. No fim ele apaga as contas, o quadro e o projeto que criou.

**Nunca rode `npm run build` com o `npm run dev` ligado.** Os dois escrevem na mesma pasta
`.next/`, e o build apaga os arquivos que o servidor de desenvolvimento está usando — ele
passa a responder 500 em tudo, com erros de módulo que não têm nada a ver com o código. Se
acontecer: pare o servidor, apague `.next/` e suba de novo.

## Trazer um quadro do Trello

Na tela de Quadros, **Trazer do Trello**. No Trello: abra o quadro, menu ⋯ ▸ Mais ▸ Imprimir e
exportar ▸ **Exportar como JSON**. Um quadro por arquivo.

O arquivo é lido no navegador antes de subir, e você vê a prévia — quantas colunas, cards,
checklists, prazos — e o que **não** vem, antes de confirmar. O servidor lê o mesmo arquivo com
a mesma função: a prévia é conveniência, a decisão é sempre do servidor.

O que não vem junto, e por quê:

| | |
| --- | --- |
| o histórico de movimentos | é o que faz o arquivo ter dezenas de megabytes, e é histórico de um sistema que você está deixando |
| as pessoas | os ids do Trello não são contas daqui. A importação **diz os nomes** de quem estava nos cards, para você atribuir depois |
| arquivos enviados ao Trello | só abrem com a sessão do Trello. Links externos vêm normalmente |

O que foi arquivado no Trello vem junto, **arquivado aqui também**: é histórico, e a migração é
a última chance de trazê-lo antes de a conta de lá ser fechada.

**Reimportar o mesmo quadro não duplica nada.** A regra é: *cria o que falta e não mexe no que
já entrou*. Um card que você moveu de coluna aqui não volta; um item que você marcou aqui não
desmarca. Serve para terminar uma importação que falhou no meio ou buscar cards que entraram no
Trello depois — não para ressuscitar o Trello por cima do trabalho de cá.

## Um quadro para olhar

```bash
ABACATO_URL=http://localhost:3000 npm run quadro-exemplo -- "Nome do quadro"
```

Monta um quadro com card atrasado, card vencendo hoje, checklists pela metade, capas,
etiquetas, papel de parede e uma tarefa recorrente — cada recurso aparecendo pelo menos uma
vez. Serve para olhar o resultado, conferir um deploy novo e mostrar o sistema a alguém.
É descartável: arquive quando não precisar mais.

## Onde fica o quê

```
db/schema.sql               as 12 tabelas abacato_* (como o banco nasce)
db/002-*.sql                o que mudou depois (origem das coisas, card concluído)
src/lib/abacatoAuth.js      senha (PBKDF2), sessão assinada, quais rotas são livres
src/lib/acesso.js           quem é você e o que você pode mexer — a porta única das rotas
src/dominio/                as regras do negócio em objetos, sem banco e sem HTTP no meio
src/dominio/trello.js       a leitura da exportação do Trello (a mesma no navegador e no servidor)
src/lib/supabase.js         cliente do Postgres (só servidor — usa a chave de serviço)
src/app/globals.css         o design system: cores, botões, campos, moldura
src/app/quadro.css          só a tela do quadro
src/componentes/quadro/     colunas, cards, painel do card, arrastar
scripts/                    criação de usuário, conferências e o quadro de exemplo
```

Três decisões que valem saber antes de mexer:

**As permissões ficam num lugar só.** `src/dominio/Quadro.js` diz o que cada papel pode, e
`src/lib/acesso.js` é por onde toda rota pergunta. Um card não carrega consigo quem pode
editá-lo — isso depende do quadro, três tabelas acima. Se cada rota descobrisse esse caminho
sozinha, bastaria uma esquecer para o sistema ter um buraco, e seria a rota menos usada. O RLS
do Postgres está ligado como rede de segurança, mas a chave de serviço passa por cima dele de
propósito: duas camadas de permissão que precisam concordar é como uma delas acaba errada sem
ninguém notar.

**A posição de um card é um número real, não um índice.** Soltar entre 1024 e 2048 vira 1536 —
uma linha alterada. Com índices inteiros, mover o primeiro card de uma lista de duzentos
reescreveria duzentas linhas a cada arrastar. E quem calcula a posição é o **servidor**, no
instante da solta: a tela sabe as posições de quando carregou, e se outra pessoa mexeu na
coluna nesse meio-tempo, uma conta feita no navegador cai no lugar errado.

**O arrasto é feito com eventos de ponteiro, não com a API de arrastar do HTML.** Aquela
simplesmente não existe no toque: `dragstart` e `drop` nunca disparam num celular. No mouse o
arrasto começa com alguns pixels de movimento; no dedo, com uma pressão de 220ms parada — sem
essa espera, rolar a coluna com o dedo em cima de um card viraria um arrasto.
