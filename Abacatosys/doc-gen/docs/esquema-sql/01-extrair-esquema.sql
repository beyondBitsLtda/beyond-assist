/* =============================================================================
   aplicacao - EXTRACAO DO ESQUEMA REAL DO BANCO
   Gerado por delp-docgen em 2026-08-31 12:55:22
   -----------------------------------------------------------------------------
   PARA QUE SERVE
     O docgen deduziu 0 tabela(s) a partir do codigo-fonte.
     Deducao nao e documentacao. Rode este script no banco da aplicacao para
     obter o DDL REAL e devolve-lo ao portal.

   COMO USAR (SQL Server Management Studio)
     1. Conecte na base da aplicacao Fluig (a mesma do datasource JNDI).
     2. Menu Query > Results To > Results to Text   (Ctrl+T)
     3. Tools > Options > Query Results > SQL Server > Results to Text:
          "Maximum number of characters displayed in each column" = 8192
     4. Execute (F5).
     5. Salve o resultado como um arquivo .sql DENTRO DESTA MESMA PASTA,
        por exemplo: esquema-aplicacao.sql
     6. Rode o delp-docgen novamente. As tabelas deixam de aparecer como
        "inferido" e passam a constar como "declarado (banco)".

   OBSERVACAO
     Somente LEITURA. Este script nao altera nada: consulta apenas o catalogo
     do SQL Server (sys.tables, sys.columns, sys.foreign_keys).
============================================================================= */

SET NOCOUNT ON;

/* ---------------------------------------------------------------------------
   Tabelas de interesse (detectadas no codigo). Acrescente/remova a vontade.
   --------------------------------------------------------------------------- */
DECLARE @alvo TABLE (nome sysname PRIMARY KEY);
INSERT INTO @alvo (nome) VALUES
    ('COLOQUE_AQUI_O_NOME_DA_TABELA');

/* ---------------------------------------------------------------------------
   1) CREATE TABLE de cada tabela encontrada
   --------------------------------------------------------------------------- */
SELECT
    'CREATE TABLE [' + s.name + '].[' + t.name + '] (' + CHAR(13) + CHAR(10) +
    STUFF((
        SELECT ',' + CHAR(13) + CHAR(10) + '    [' + c.name + '] ' + ty.name +
            CASE
                WHEN ty.name IN ('varchar','char','varbinary','binary')
                    THEN '(' + CASE WHEN c.max_length = -1 THEN 'MAX' ELSE CAST(c.max_length AS varchar(10)) END + ')'
                WHEN ty.name IN ('nvarchar','nchar')
                    THEN '(' + CASE WHEN c.max_length = -1 THEN 'MAX' ELSE CAST(c.max_length / 2 AS varchar(10)) END + ')'
                WHEN ty.name IN ('decimal','numeric')
                    THEN '(' + CAST(c.precision AS varchar(10)) + ',' + CAST(c.scale AS varchar(10)) + ')'
                WHEN ty.name IN ('datetime2','time','datetimeoffset')
                    THEN '(' + CAST(c.scale AS varchar(10)) + ')'
                ELSE ''
            END +
            CASE WHEN c.is_identity = 1 THEN ' IDENTITY(1,1)' ELSE '' END +
            CASE WHEN c.is_nullable = 1 THEN ' NULL' ELSE ' NOT NULL' END
        FROM sys.columns c
        INNER JOIN sys.types ty ON ty.user_type_id = c.user_type_id
        WHERE c.object_id = t.object_id
        ORDER BY c.column_id
        FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 3, '')
    + CHAR(13) + CHAR(10) + ');' + CHAR(13) + CHAR(10) AS [ddl]
FROM sys.tables t
INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
WHERE t.name IN (SELECT nome FROM @alvo)
ORDER BY t.name;

/* ---------------------------------------------------------------------------
   2) Chaves primarias
   --------------------------------------------------------------------------- */
SELECT
    'ALTER TABLE [' + s.name + '].[' + t.name + '] ADD CONSTRAINT [' + k.name + '] PRIMARY KEY (' +
    STUFF((
        SELECT ', [' + c2.name + ']'
        FROM sys.index_columns ic
        INNER JOIN sys.columns c2 ON c2.object_id = ic.object_id AND c2.column_id = ic.column_id
        WHERE ic.object_id = t.object_id AND ic.index_id = i.index_id
        ORDER BY ic.key_ordinal
        FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 2, '')
    + ');' AS [ddl]
FROM sys.key_constraints k
INNER JOIN sys.tables t ON t.object_id = k.parent_object_id
INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
INNER JOIN sys.indexes i ON i.object_id = t.object_id AND i.name = k.name
WHERE k.type = 'PK' AND t.name IN (SELECT nome FROM @alvo)
ORDER BY t.name;

/* ---------------------------------------------------------------------------
   3) Chaves estrangeiras  ->  viram RELACIONAMENTOS DECLARADOS no portal
   --------------------------------------------------------------------------- */
SELECT
    'ALTER TABLE [' + sp.name + '].[' + tp.name + '] ADD CONSTRAINT [' + fk.name + ']' +
    ' FOREIGN KEY ([' + cp.name + ']) REFERENCES [' + sr.name + '].[' + tr.name + '] ([' + cr.name + ']);' AS [ddl]
FROM sys.foreign_keys fk
INNER JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
INNER JOIN sys.tables tp ON tp.object_id = fk.parent_object_id
INNER JOIN sys.schemas sp ON sp.schema_id = tp.schema_id
INNER JOIN sys.tables tr ON tr.object_id = fk.referenced_object_id
INNER JOIN sys.schemas sr ON sr.schema_id = tr.schema_id
INNER JOIN sys.columns cp ON cp.object_id = fkc.parent_object_id AND cp.column_id = fkc.parent_column_id
INNER JOIN sys.columns cr ON cr.object_id = fkc.referenced_object_id AND cr.column_id = fkc.referenced_column_id
WHERE tp.name IN (SELECT nome FROM @alvo) OR tr.name IN (SELECT nome FROM @alvo)
ORDER BY tp.name, fk.name;

/* ---------------------------------------------------------------------------
   4) VIEWS - colunas e definicao
      Views entram no @alvo como qualquer objeto: o codigo le delas do mesmo
      jeito que le de uma tabela.
   --------------------------------------------------------------------------- */
SELECT
    '/* VIEW [' + s.name + '].[' + v.name + '] */' + CHAR(13) + CHAR(10) +
    'CREATE VIEW [' + s.name + '].[' + v.name + '] AS  -- colunas: ' +
    STUFF((
        SELECT ', ' + c.name
        FROM sys.columns c
        WHERE c.object_id = v.object_id
        ORDER BY c.column_id
        FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 2, '')
    + CHAR(13) + CHAR(10) + OBJECT_DEFINITION(v.object_id) AS [ddl]
FROM sys.views v
INNER JOIN sys.schemas s ON s.schema_id = v.schema_id
WHERE v.name IN (SELECT nome FROM @alvo)
ORDER BY v.name;

/* ---------------------------------------------------------------------------
   5) Objetos do codigo que NAO existem neste banco
      (nome errado no codigo, base errada, ou objeto ainda nao criado)
   --------------------------------------------------------------------------- */
SELECT '-- AUSENTE NESTE BANCO: ' + a.nome AS [ddl]
FROM @alvo a
WHERE NOT EXISTS (SELECT 1 FROM sys.objects o WHERE o.name = a.nome
                    AND o.type IN ('U','V'));
