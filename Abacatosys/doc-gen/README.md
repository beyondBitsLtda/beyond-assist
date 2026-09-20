# delp-docgen

Gerador de **documentação técnica** para aplicações **Fluig** da DELP Engenharia.
Lê a pasta raiz de uma aplicação (widget + formulários + workflow + datasets + SQL)
e produz um **portal HTML autocontido**, no padrão visual DELP, com:

- **Visão geral** — identificação, **tipo de aplicação detectado com as evidências que o sustentam**, KPIs, README do repositório.
- **Arquitetura do sistema** — **fluxograma de execução renderizado** (SVG, sem Mermaid) e diagrama em camadas **montados conforme o tipo da aplicação**: widget, formulário de processo, ou widget que usa formulário. Camada que não existe no repositório não é desenhada.
- **Mapa de chamadas** — grafo interativo de **quem chama quem**, arquivo por arquivo, dividido em camadas; cada seta traz a evidência no código.
- **Arquitetura de dados** — a estrutura de **todas** as tabelas (colunas, tipos, nulidade, chaves), **a base de dados em que cada uma vive** (FLUIG, CORPORE, …), relacionamentos, procedures e alterações de schema.
- **Datasets** — ações (`_ACAO`), tabelas lidas/gravadas, grupos de colunas, funções e histórico de versão.
- **Formulários** — um bloco por **pasta** em `forms/`: cartão HTML, eventos do cartão (`displayFields`, `validateForm`, `beforeSendValidate`…), scripts auxiliares, estilos, campos, atividades de workflow tratadas e funções.
- **Workflow** — diagrama do processo (SVG), scripts de evento, literais i18n.
- **Widget (JS/CSS)** — classes POO, componentes, design tokens.
- **Internacionalização** — cobertura de idiomas.
- **Rastreabilidade** — matriz tabela × módulo (R / W / RW), base para análise de impacto e auditoria.
- **Biblioteca de código** — todo o código-fonte, indentado e **colorido no estilo VS Code**, navegável dentro do próprio portal.
- **Inventário** — todos os arquivos varridos e seu tipo lógico.

## Características

- **Zero dependências externas.** Só usa módulos nativos do Node (`fs`, `path`). Não precisa de `npm install`, não baixa nada.
- **Saída 100% offline.** Diagramas em **SVG nativo** e realce de sintaxe próprio — sem runtime, sem CDN. Abre em qualquer navegador, pode ser enviado por e-mail ou versionado. A fonte Barlow vem do Google Fonts de forma **não bloqueante**: se o domínio estiver barrado pela rede corporativa, o portal abre na hora com o fallback (Inter/system-ui) em vez de travar esperando o timeout.
- **Não inventa dados.** Cada tabela/coluna/relação é marcada como `declarado (banco)`, `declarado (DDL)` ou `inferido`. "Dado sem fonte não é dado." — e a pasta `esquema-sql/` existe para converter o inferido em declarado.
- **Padrão visual DELP** — Barlow, Delp Red `#CC0F10`, cores de unidade (Subsea/Indústria/Serviços/Mooring).

## Uso

```bash
node bin/delp-docgen.js <pasta-raiz-da-aplicacao> [opcoes]
```

### Opções

| Opção | Descrição |
|---|---|
| `--out <arquivo>` | Caminho do HTML de saída (padrão: `<codigo>.doc.html` no diretório atual). |
| `--json` | Grava também um `<saida>.json` com o modelo extraído (útil para integrar em outros processos). |
| `--sem-codigo` | Não embute o código-fonte. Portal fica ~6× menor, sem a Biblioteca de Código. O resto (inclusive o mapa de chamadas) continua completo. |
| `--forcar` | Sobrescreve um HTML de destino que documenta **outra** aplicação. Sem esta opção, a geração é recusada. |
| `--help` | Ajuda. |

## Identidade da aplicação — nome, tipo e não-sobrescrita

Antes de extrair qualquer metadado, a ferramenta descobre **quem** é a aplicação.
Isso governa três coisas: o nome do arquivo gerado, quais camadas de arquitetura
são desenhadas, e o que pode ou não ser sobrescrito.

**Nome** (`<nome>.doc.html`), na ordem: `application.code` do `application.info`
canônico → `<name>` do `.project` → nome da única pasta em `forms/` → nome da
pasta raiz. O portal mostra de onde o nome veio.

Quando há várias cópias de `application.info` (`.txt`, `- Copia`, `Nova pasta/`),
a ferramenta escolhe a canônica, **avisa quais ignorou** e usa só a escolhida —
antes a última lida vencia, e com ela mudava a ordem de carregamento inteira do
diagrama.

**Tipo**, decidido por evidência no repositório:

| Tipo | Como é reconhecido | O que muda no desenho |
|---|---|---|
| `widget` | `application.info` de widget, `.ftl`, `wcm/widget/`, `resources/js` | bootstrap → controller → domínio → integração → ds\* → DatasetFactory |
| `widget-formulario` | as duas coisas acima **e** um formulário em `forms/` | caminho da widget na coluna central, cartão do formulário como entrada alternativa pelo BPMN |
| `formulario` | nenhuma evidência de widget | cartão HTML → eventos do cartão → validação → eventos do processo → dados |

Na dúvida assume-se **formulário**: é o caso mais comum e o mais conservador —
um formulário não ganha camadas de widget que não existem. A seção *Visão Geral*
do portal lista os arquivos que sustentam a classificação.

**Não-sobrescrita.** Todo portal carrega `<meta name="dg-app">` com a aplicação
que ele documenta. Regerar a **mesma** aplicação é o fluxo normal e sobrescreve
sem perguntar. Apontar `--out` para um HTML que documenta **outra** aplicação
(ou para um arquivo que não foi gerado por esta ferramenta) **interrompe** a
geração com a mensagem do conflito. Para insistir, `--forcar`.

## A pasta `esquema-sql/` — tirando o "inferido" da documentação

Toda execução cria, **ao lado do HTML**, uma pasta `esquema-sql/<aplicacao>/`:

```
docs/
├── portalCapex.doc.html
├── formularioRetrabalho.doc.html
└── esquema-sql/
    ├── portalCapex/
    │   ├── 00-LEIA-ME.md                ← instruções
    │   ├── 01-extrair-esquema.sql       ← RODE ESTE, uma vez só (só leitura)
    │   ├── 02-ddl-inferido.sql          ← rascunho do DDL deduzido, por base
    │   ├── 03-esquema-consolidado.sql   ← tudo que já tem fonte declarada, por base
    │   └── catalogo.csv                 ← saída do banco (nome e extensão livres)
    └── formularioRetrabalho/
        └── …
```

> A subpasta por aplicação é obrigatória. Com uma `esquema-sql/` compartilhada,
> todo portal gerado no mesmo diretório herdava o esquema da aplicação anterior:
> a documentação de um formulário aparecia com as tabelas de outro sistema
> inteiro. Arquivos `.sql` soltos na raiz de `esquema-sql/` (formato antigo) não
> são mais lidos — o portal avisa e pede que sejam movidos para a subpasta certa.

### Várias bases de dados

Uma aplicação Fluig da DELP quase nunca fala com um banco só: as tabelas próprias
ficam no **FLUIG** e as de ERP no **CORPORE**, muitas vezes na mesma consulta.
O nome qualificado no código (`FLUIG.dbo.Z_DELP_CAPEX_SOLICITACAO`,
`CORPORE.dbo.GCCUSTO`) é o que diz onde cada tabela vive, e o portal usa isso:

- cada tabela mostra **em qual base** ela está, e a seção *Arquitetura de Dados*
  abre com um resumo por base;
- o `sys.tables` só enxerga o banco em que a consulta roda, **mas responde
  qualificado**: `[FLUIG].sys.objects` funciona de qualquer base da mesma
  instância. O `01` usa isso e lê **todas as bases numa execução só**, montando o
  bloco de leitura por base com `sp_executesql`. Base inexistente, offline ou sem
  permissão volta como uma linha `tipo=ERRO` e vira aviso, em vez de derrubar o
  lote inteiro com *Invalid object name*;
- `02` e `03` saem **agrupados por base**, com o `USE [BASE]` de cada bloco;
  chaves estrangeiras ficam dentro do grupo da sua base (o SQL Server não tem FK
  entre bancos);
- tabela referenciada sem o prefixo do banco não recebe uma base chutada: fica
  marcada como *base não identificada* e é procurada em todas as bases da lista;
- o mesmo nome de tabela em duas bases vira **aviso**, não uma fusão silenciosa.

### O ciclo

1. O docgen deduz tabelas e colunas do código e marca tudo como **inferido**.
2. Ele grava `01-extrair-esquema.sql`, que consulta o catálogo do SQL Server
   (`sys.objects`, `sys.columns`, `sys.foreign_keys`) e devolve o esquema real
   numa **única grade de resultado**.
3. O técnico roda esse script **uma vez só, em qualquer base** (a caixa de bancos
   da barra do SSMS não importa) e salva o resultado (botão direito na grade →
   *Save Results As...*) dentro de `esquema-sql/<aplicacao>/`.
4. Na próxima geração, o docgen lê o arquivo e aquelas tabelas passam a constar como
   **declarado (banco)**: tipos reais, nulidade, PK, IDENTITY, a base de cada uma
   e — o principal — **relacionamentos vindos de foreign keys de verdade**, em vez
   de adivinhados pelo sufixo `_ID`.

**Nome e extensão do arquivo não importam.** O formato é decidido pelo
**conteúdo**, não pela extensão: a mesma grade salva como `.csv`, `.txt`, `.sql`
ou `.rpt` é reconhecida igual. Cada linha carrega a coluna `banco`, então o portal
sabe de qual base ela veio mesmo com vários arquivos na pasta.

Não é preciso ajustar nada no SSMS — o leitor lida sozinho com o que varia de
máquina para máquina: separador `,`, `;`, tab ou `|` (Windows pt-BR usa `;`), com
ou sem BOM, **com ou sem a linha de cabeçalho** (a opção *Include column headers*
é por estação e vem desligada em muitas) e grade (`Ctrl+D`) **ou** texto de
largura fixa (`Ctrl+T`). Sem cabeçalho a leitura é posicional, na ordem que o
`01-extrair-esquema.sql` produz.

**Arquivo que não produz nada vira aviso**, no terminal e no rodapé do portal,
dizendo qual arquivo foi lido e o que faltou nele. Antes essa falha era silenciosa:
uma grade salva como `.sql` ia parar no leitor de DDL, não achava nenhum
`CREATE TABLE`, devolvia zero tabelas — e o portal voltava inteiro em *inferido*
sem explicar por quê. O portal também avisa quando encontra a saída do catálogo
salva na pasta de **outra** aplicação, que é o engano mais comum (o diálogo do
SSMS reabre na última pasta usada).

O CSV tem uma coluna `tipo` que discrimina as linhas:

| `tipo` | Significado |
|---|---|
| `COLUNA` | uma coluna de tabela ou view encontrada |
| `FK` | uma coluna de chave estrangeira |
| `AUSENTE` | objeto da lista que **não existe naquela base** — normal, deve estar em outra |
| `ERRO` | base que não pôde ser lida; a mensagem do SQL Server vem na última coluna |

Linhas `AUSENTE` só viram alerta quando o objeto falta em **todas** as bases
extraídas. Enquanto só uma base foi lida, "ausente aqui" não significa nada.
Linhas `ERRO` viram aviso sempre: aquela base não foi lida, e as tabelas dela
continuam inferidas.

Os quatro arquivos numerados são reescritos a cada execução; qualquer outro
arquivo na pasta é preservado e lido como esquema — a grade do catálogo em
qualquer formato, ou um DDL escrito à mão.

### Exemplos

```bash
# gera na pasta atual, com o nome da aplicação analisada (portalCapex.doc.html)
node bin/delp-docgen.js "z:\...\Repositorios\...\portalCapex"

# várias aplicações na mesma pasta de saída: cada uma com seu nome, nenhuma
# sobrescreve a outra
cd ./docs
node ../bin/delp-docgen.js "z:\...\portalCapex"
node ../bin/delp-docgen.js "z:\...\formuláriodeRetrabalho"
node ../bin/delp-docgen.js "z:\...\fluxodecaixa"

# define o caminho de saída explicitamente
node bin/delp-docgen.js ./portalCapex --out ./docs/portalCapex.doc.html

# também exporta o modelo em JSON
node bin/delp-docgen.js ./portalCapex --out ./docs/portalCapex.doc.html --json
```

## Estrutura de pasta esperada (padrão Fluig DELP)

A ferramenta reconhece a estrutura canônica **e** funciona sobre uma pasta "achatada" (dump),
classificando por nome/extensão e, quando necessário, por análise do conteúdo.

```
<aplicacao>/
├── application.info
├── datasets/            → ds*.js (server-side, createDataset)
├── forms/
│   └── <id> - <form>/   → <form>.html, events/displayFields.js, validateForm.js,
│                          beforeSendValidate.js, style.css, utils.js…
├── workflow/
│   ├── diagrams/        → *.process
│   ├── .resources/      → *.processimage.svg
│   ├── scripts/         → *.beforeTaskSave.js, *.servicetaskN.js
│   └── literals/        → *_pt_BR.properties ...
├── sql/                 → *.sql (CREATE/ALTER TABLE, PROCEDURE) [autoritativo p/ dados]
└── wcm/widget/.../resources/
    ├── js/              → Objects, Componentes, Controller, main.function, integre*, ds*
    └── css/             → capex.css
```

## Como a análise funciona (resumo técnico)

- **Identidade primeiro** → nome, tipo (widget / formulário / widget+formulário) e prefixos próprios da aplicação (namespace JS, bloco BEM no CSS, `data-*` no markup) são **descobertos no repositório analisado**, não fixados no gerador.
- **A pasta manda no significado do arquivo** → um `utils.js` em `forms/` é script do cartão; o mesmo nome em `wcm/widget/` é módulo da widget. `beforeSendValidate.js` em `forms/` é evento do formulário, não do processo.
- **application.info** → identificação + ordem de carregamento (alimenta o diagrama de arquitetura). Havendo cópias, só a canônica é usada.
- **Datasets/scripts** → resolve variáveis de tabela (`var TB = 'FLUIG.dbo.X'`), **achata o SQL concatenado** (`' + TB + '` vira o literal e colapsa `'A'+'B'`), e extrai FROM/JOIN/INSERT/UPDATE para montar leitura/escrita.
- **Colunas** → grupos `COLS_*` (retorno) + colunas de `INSERT/UPDATE` (atribuíveis a uma única tabela).
- **Relações** → foreign keys reais quando existem (`declarado`); na falta delas, casamento por sufixo `_ID` (`inferido`).
- **Hierarquia de verdade** → `esquema-sql/` (banco) **>** DDL em `/sql` **>** dedução do código. O selo de cada tabela diz qual das três foi usada.
- **Mapa de chamadas** → três tipos de evidência: `getDataset('X')`, símbolo exportado por outro módulo (classe, namespace ou função de topo citada no corpo), e acesso SQL a uma tabela. Símbolos ambíguos (declarados em dois arquivos) são descartados; comentários e strings não contam como uso.
- **Biblioteca** → o código é embutido no HTML e colorido no navegador por um tokenizador próprio (sem CDN). Libs `.min.js` entram truncadas em 48 KB; demais arquivos, em 512 KB.

## Limitações conhecidas

- SQL montado de forma muito dinâmica (colunas em variáveis, `switch` de fragmentos) pode não ser 100% capturado — o portal sinaliza onde revisar.
- Aliases de `JOIN` em SQL concatenado não são resolvidos para relações (usa-se o casamento por nome de coluna, mais conservador).
- A base de dados de uma tabela só é afirmada quando o código a qualifica (`FLUIG.dbo.X`) ou quando o CSV do catálogo a confirma. Nome de 2 partes (`dbo.X`) é tratado como *esquema.objeto*, nunca como *banco.objeto* — não dá para saber qual dos dois é sem adivinhar.
- Duas tabelas com o **mesmo nome em bases diferentes** são documentadas como uma entidade só, com aviso. Separá-las exigiria mudar a chave da tabela e quebraria o casamento com o SQL do código, que muitas vezes cita o nome sem qualificar.
- O mapa de chamadas é análise **estática**: chamadas montadas em runtime (nome de dataset vindo de variável) não aparecem.
- Com a biblioteca embutida, o HTML de uma aplicação grande passa de 8 MB. Não pesa no navegador (medido: interativo em ~230 ms, e o bloco de código parseia em 11 ms), mas atrapalha para anexar em e-mail — nesse caso use `--sem-codigo`.
- Em pasta de rede, a varredura lê os arquivos em paralelo (24 por vez); ainda assim, o tempo é dominado pela latência do compartilhamento. Leituras que falham são tentadas duas vezes e, se ainda falharem, aparecem nos **avisos do portal** — nunca são descartadas em silêncio.

---
DELP Engenharia — TI / Desenvolvimento Fluig
