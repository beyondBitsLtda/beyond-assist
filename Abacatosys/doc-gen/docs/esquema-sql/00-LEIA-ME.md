# Esquema SQL — aplicacao

Esta pasta e a **ponte entre o codigo e o banco**. Ela existe para tirar do
portal os selos de *inferido* / *deduzido*.

## Situacao atual

| Indicador | Valor |
|---|---|
| Tabelas com esquema **declarado** | 0 |
| Tabelas ainda **inferidas** do codigo | 0 |
| Arquivos de esquema lidos desta pasta | 0 |

## Arquivos gerados automaticamente

| Arquivo | O que e | Rodar no banco? |
|---|---|---|
| `01-extrair-esquema.sql` | Consulta o catalogo do SQL Server e devolve o DDL real. Somente leitura. | **Sim** |
| `02-ddl-inferido.sql` | Rascunho do DDL deduzido do codigo. Tipos sao estimativa. | Nao (rascunho) |
| `03-esquema-consolidado.sql` | Tudo que ja tem fonte declarada. | Nao (referencia) |

> Esses tres arquivos sao **reescritos a cada execucao** do delp-docgen.
> Nao edite. Qualquer arquivo `.sql` com outro nome e preservado e lido como esquema.

## Como remover os selos de "inferido"

1. Abra `01-extrair-esquema.sql` no SSMS, conectado a base da aplicacao.
2. `Ctrl+T` (Results to Text) e execute com `F5`.
3. Salve a saida **nesta pasta**, com qualquer nome — por exemplo
   `esquema-app.sql`.
4. Rode o `delp-docgen` novamente sobre a mesma pasta de saida.

O portal passa a exibir essas tabelas como **declarado (banco)**, com tipos,
nulidade, chaves primarias e — o mais importante — os **relacionamentos reais**
vindos das foreign keys, em vez de relacoes adivinhadas por sufixo `_ID`.
