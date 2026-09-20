# Esquema SQL — portalCapex

Esta pasta e a **ponte entre o codigo e o banco**. Ela existe para tirar do
portal os selos de *inferido* / *deduzido*.

## Bases de dados desta aplicacao

Uma aplicacao Fluig raramente fala com um banco so: as tabelas proprias ficam
no FLUIG e as de ERP no CORPORE, muitas vezes na mesma consulta.

O `01-extrair-esquema.sql` le **todas as bases numa execucao so**: ele qualifica
o catalogo pelo nome do banco (`[FLUIG].sys.objects`), o que funciona de
qualquer base da mesma instancia. Nao e preciso trocar a base na barra do SSMS
nem salvar um arquivo por vez.

| Base | Tabelas atribuidas | Ja declaradas | Confirmadas no catalogo |
|---|---|---|---|
| `CORPORE` | 19 | 19 | 19 |
| `FLUIG` | 13 | 13 | 13 |

## Situacao atual

| Indicador | Valor |
|---|---|
| Tabelas com esquema **declarado** | 32 |
| Tabelas ainda **inferidas** do codigo | 0 |
| Arquivos de esquema lidos desta pasta | 1 |
| Bases ja extraidas | CORPORE, FLUIG |

Arquivos lidos: `FLUIG - Portal Capex.csv`

## Como remover os selos de "inferido"

Uma execucao, um arquivo.

1. Abra `01-extrair-esquema.sql` no SSMS e execute com `F5`.
   A base selecionada na barra **nao importa**.
2. O resultado sai em **uma grade so**, com todas as bases juntas.
3. Botao direito na grade > **Save Results As...** > salve **nesta pasta**.
4. Rode o `delp-docgen` novamente sobre a mesma pasta de saida.

> **Salve dentro desta pasta**, nao na pasta de outra aplicacao. E o motivo
> numero um de "salvei e continua inferido": o dialogo do SSMS reabre na
> ultima pasta usada. O caminho exato esta no fim deste arquivo.

Nao e preciso ajustar nada no SSMS. O leitor decide o formato pelo conteudo do
arquivo, entao ele lida sozinho com as variacoes de maquina para maquina:

- **nome e extensao livres** — `.csv`, `.txt`, `.sql`, `.rpt`, `resultado3.csv`;
- separador `,`, `;`, tab ou `|` (Windows pt-BR usa `;`);
- com ou sem BOM;
- **com ou sem a linha de cabecalho** (a opcao *Include column headers* pode
  estar desligada) — sem cabecalho a leitura e posicional, na ordem que o
  `01-extrair-esquema.sql` produz;
- grade (`Ctrl+D`) **ou** texto de largura fixa (`Ctrl+T`).

Cada linha carrega a coluna `banco`, entao o portal sabe de qual base cada
tabela veio mesmo com varios arquivos na pasta.

Se depois de gerar de novo ainda aparecer "inferido", o portal passa a dizer o
motivo: procure a secao de avisos, no rodape.

## O que vem no CSV

| Coluna `tipo` | Significado |
|---|---|
| `COLUNA` | uma linha por coluna de tabela ou view encontrada |
| `FK` | uma linha por coluna de chave estrangeira (vira relacionamento **declarado**) |
| `AUSENTE` | objeto da lista que **nao existe naquela base** — normal, ele deve estar em outra |
| `ERRO` | base que nao pode ser lida; a mensagem do SQL Server vem na ultima coluna |

Linhas `AUSENTE` so viram alerta no portal quando o objeto falta em **todas**
as bases extraidas. Linhas `ERRO` viram aviso sempre: aquela base nao foi lida,
e as tabelas dela continuam inferidas.

## Arquivos gerados automaticamente

| Arquivo | O que e | Rodar no banco? |
|---|---|---|
| `01-extrair-esquema.sql` | Consulta o catalogo do SQL Server e devolve o esquema real. Somente leitura. | **Sim — uma vez so** |
| `02-ddl-inferido.sql` | Rascunho do DDL deduzido do codigo, separado por base. Tipos sao estimativa. | Nao (rascunho) |
| `03-esquema-consolidado.sql` | Tudo que ja tem fonte declarada, separado por base. | Nao (referencia) |

> Esses tres arquivos sao **reescritos a cada execucao** do delp-docgen.
> Nao edite. Qualquer outro arquivo com outro nome e preservado e lido
> como esquema.

Pasta que o portal le (salve aqui):

```
C:/Users/brayan.rodrigues/Documents/Repositórios/WorkSpace/delp-docgen/docs/esquema-sql/portalCapex
```

O portal passa a exibir essas tabelas como **declarado (banco)**, com tipos,
nulidade, chaves primarias, a **base em que cada uma vive** e — o mais
importante — os **relacionamentos reais** vindos das foreign keys, em vez de
relacoes adivinhadas por sufixo `_ID`.
