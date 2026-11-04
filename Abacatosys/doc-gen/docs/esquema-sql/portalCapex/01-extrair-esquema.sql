/* =============================================================================
   portalCapex - EXTRACAO DO ESQUEMA REAL DO BANCO   (saida em CSV)
   Gerado por delp-docgen em 2026-09-05 12:21:22
   -----------------------------------------------------------------------------
   PARA QUE SERVE
     O docgen deduziu 0 tabela(s) a partir do codigo-fonte.
     Deducao nao e documentacao. Rode este script para obter o esquema REAL e
     devolve-lo ao portal.

   UMA EXECUCAO SO, UM CSV SO - RODE EM QUALQUER BASE
     Nao e preciso escolher a base na barra do SSMS nem rodar duas vezes. O
     script le o catalogo de cada banco pelo nome qualificado
     ([FLUIG].sys.objects), entao uma execucao ja traz todas as bases numa
     grade unica. Cada linha diz em qual banco ela foi encontrada.

     Bases que este script vai ler:
       - CORPORE   (19 tabela(s) atribuidas a esta base pelo codigo)
       - FLUIG   (13 tabela(s) atribuidas a esta base pelo codigo)

     Base que nao existir nesta instancia, ou onde o login nao tiver acesso,
     e pulada com uma linha tipo=ERRO. O resto continua normalmente.

   COMO USAR (SQL Server Management Studio)
     1. Abra este arquivo e execute com F5. A base selecionada na barra NAO
        importa - o script qualifica cada banco pelo nome.
     2. O resultado sai em UMA grade so, com todas as bases juntas.
     3. Clique com o botao direito na grade > "Save Results As..."
        > tipo "CSV" > salve DENTRO DESTA MESMA PASTA.
        O nome do arquivo nao importa. O cabecalho de colunas tambem e
        opcional ("Include column headers" ligado ou desligado).
     4. Rode o delp-docgen de novo sobre a mesma pasta de saida. As tabelas
        deixam de aparecer como "inferido" e passam a constar como
        "declarado (banco)", cada uma na sua base.

   O QUE VEM NO CSV
     tipo=COLUNA   uma linha por coluna de tabela/view encontrada
     tipo=FK       uma linha por coluna de chave estrangeira
     tipo=AUSENTE  objeto da lista que NAO existe naquela base
                   (normal: ele provavelmente esta em outra da lista)
     tipo=ERRO     base que nao pode ser lida; a mensagem vai na ultima coluna

   OBSERVACAO
     Somente LEITURA. Este script nao altera nada: consulta apenas o catalogo
     do SQL Server (sys.objects, sys.columns, sys.foreign_keys) e uma tabela
     temporaria propria (#esquema), descartada no fim.
============================================================================= */

SET NOCOUNT ON;

/* ---------------------------------------------------------------------------
   1. Objetos de interesse (detectados no codigo). Acrescente/remova a vontade.
   Sao nomes SEM banco e SEM esquema: a busca e pelo nome do objeto.
   --------------------------------------------------------------------------- */
DECLARE @alvo TABLE (nome sysname PRIMARY KEY);
INSERT INTO @alvo (nome) VALUES
    ('CCONTA'),
    ('CGERENCIA'),
    ('CLANCAMENTO'),
    ('CLOTE'),
    ('CODLOTE'),
    ('COLUMNS'),
    ('CPARTIDA'),
    ('CRATEIOLC'),
    ('CRATEIOLCCC'),
    ('DBO'),
    ('DM_DB_PARTITION_STATS'),
    ('FCFO'),
    ('FDN_COLLEAGUE'),
    ('FDN_USERTENANT'),
    ('FOREIGN_KEYS'),
    ('FOREIGN_KEY_COLUMNS'),
    ('GCCUSTO'),
    ('GUSUARIO'),
    ('INDEXES'),
    ('INDEX_COLUMNS'),
    ('OBJECTS'),
    ('PPESSOA'),
    ('PRIMEIRA_VERSAO'),
    ('STRING_SPLIT'),
    ('TABLES'),
    ('TITMMOV'),
    ('TITMORCAMENTO'),
    ('TMOV'),
    ('TMOVORCAMENTO'),
    ('TMOVRELAC'),
    ('TORCAMENTO'),
    ('TPERIODOORCAMENTO'),
    ('TTBORCAMENTO'),
    ('TYPES'),
    ('ZMD_CAPEX_INICIAL'),
    ('Z_DELP_CAPEX_APROVACAO'),
    ('Z_DELP_CAPEX_APROVACAO_PLANO'),
    ('Z_DELP_CAPEX_APROVADOR'),
    ('Z_DELP_CAPEX_APROVADOR_CC'),
    ('Z_DELP_CAPEX_CONTINGENCIA'),
    ('Z_DELP_CAPEX_GERENTE_USUARIO'),
    ('Z_DELP_CAPEX_INTEGRACAO_LOG'),
    ('Z_DELP_CAPEX_LOG'),
    ('Z_DELP_CAPEX_PLANO'),
    ('Z_DELP_CAPEX_SOLICITACAO'),
    ('Z_DELP_CAPEX_SOLICITACAO_ITEM');

/* ---------------------------------------------------------------------------
   2. Bases a ler. Vieram dos nomes qualificados encontrados no codigo.
   --------------------------------------------------------------------------- */
DECLARE @bases TABLE (nome sysname PRIMARY KEY, feito bit NOT NULL DEFAULT 0);
INSERT INTO @bases (nome) VALUES
    ('CORPORE'),
    ('FLUIG');

/* TODAS AS BASES: descomente para varrer a instancia inteira. */
-- INSERT INTO @bases (nome)
-- SELECT name FROM sys.databases
-- WHERE database_id > 4 AND state = 0 AND name NOT IN (SELECT nome FROM @bases);

/* Base inexistente ou sem acesso para este login sai da lista antes de rodar. */
DELETE FROM @bases WHERE DB_ID(nome) IS NULL;
IF NOT EXISTS (SELECT 1 FROM @bases) INSERT INTO @bases (nome) VALUES (DB_NAME());

/* Lista de alvos em texto, para viajar ate a consulta montada em tempo de execucao. */
DECLARE @lista nvarchar(max) = CAST(N'' AS nvarchar(max));
SELECT @lista = @lista + CASE WHEN @lista = N'' THEN N'' ELSE N',' END + QUOTENAME(nome, '''')
FROM @alvo;

/* ---------------------------------------------------------------------------
   3. Bloco lido em cada base. {{DB}} vira [FLUIG], {{DBLIT}} vira 'FLUIG' e
   {{ALVO}} vira a lista de objetos acima.
   --------------------------------------------------------------------------- */
DECLARE @tpl nvarchar(max) = CAST(N'' AS nvarchar(max));
SET @tpl = @tpl + N'/* COLUNAS de tabelas e views */
SELECT
    CAST(''COLUNA'' AS nvarchar(20))                     AS tipo,
    CAST({{DBLIT}} AS nvarchar(128))                   AS banco,
    CAST(s.name AS nvarchar(128))                      AS esquema,
    CAST(o.name AS nvarchar(128))                      AS objeto,
    CAST(CASE o.type WHEN ''V'' THEN ''VIEW'' ELSE ''TABELA'' END AS nvarchar(20)) AS objeto_tipo,
    CAST(c.name AS nvarchar(128))                      AS coluna,
    CAST(c.column_id AS nvarchar(10))                  AS ordem,
    CAST(ty.name AS nvarchar(128))                     AS tipo_dado,
    CAST(CASE
        WHEN c.max_length = -1 THEN ''MAX''
        WHEN ty.name IN (''nvarchar'',''nchar'') THEN CAST(c.max_length / 2 AS nvarchar(10))
        ELSE CAST(c.max_length AS nvarchar(10))
    END AS nvarchar(20))                               AS tamanho,
    CAST(c.precision AS nvarchar(10))                  AS precisao,
    CAST(c.scale AS nvarchar(10))                      AS escala,
    CAST(CASE WHEN c.is_nullable = 1 THEN ''SIM'' ELSE ''NAO'' END AS nvarchar(3)) AS nulo,
    CAST(CASE WHEN EXISTS (
        SELECT 1
        FROM {{DB}}.sys.index_columns ic
';
SET @tpl = @tpl + N'        INNER JOIN {{DB}}.sys.indexes ix ON ix.object_id = ic.object_id AND ix.index_id = ic.index_id
        WHERE ic.object_id = c.object_id AND ic.column_id = c.column_id AND ix.is_primary_key = 1
    ) THEN ''SIM'' ELSE ''NAO'' END AS nvarchar(3))        AS pk,
    CAST(CASE WHEN c.is_identity = 1 THEN ''SIM'' ELSE ''NAO'' END AS nvarchar(3)) AS identidade,
    CAST('''' AS nvarchar(128))                          AS ref_banco,
    CAST('''' AS nvarchar(128))                          AS ref_esquema,
    CAST('''' AS nvarchar(128))                          AS ref_objeto,
    CAST('''' AS nvarchar(128))                          AS ref_coluna,
    CAST('''' AS nvarchar(256))                          AS restricao
FROM {{DB}}.sys.objects o
INNER JOIN {{DB}}.sys.schemas s  ON s.schema_id = o.schema_id
INNER JOIN {{DB}}.sys.columns c  ON c.object_id = o.object_id
INNER JOIN {{DB}}.sys.types ty   ON ty.user_type_id = c.user_type_id
WHERE o.type IN (''U'',''V'')
  AND o.name IN ({{ALVO}})

UNION ALL

/* CHAVES ESTRANGEIRAS -> viram relacionamentos DECLARADOS no portal */
SELECT
    CAST(''FK'' AS nvarchar(20)),
    CAST({{DBLIT}} AS nvarchar(128)),
    CAST(sp.name AS nvarchar(128)),
';
SET @tpl = @tpl + N'    CAST(tp.name AS nvarchar(128)),
    CAST(''TABELA'' AS nvarchar(20)),
    CAST(cp.name AS nvarchar(128)),
    CAST(fkc.constraint_column_id AS nvarchar(10)),
    CAST('''' AS nvarchar(128)),
    CAST('''' AS nvarchar(20)),
    CAST('''' AS nvarchar(10)),
    CAST('''' AS nvarchar(10)),
    CAST('''' AS nvarchar(3)),
    CAST('''' AS nvarchar(3)),
    CAST('''' AS nvarchar(3)),
    CAST({{DBLIT}} AS nvarchar(128)),
    CAST(sr.name AS nvarchar(128)),
    CAST(tr.name AS nvarchar(128)),
    CAST(cr.name AS nvarchar(128)),
    CAST(fk.name AS nvarchar(256))
FROM {{DB}}.sys.foreign_keys fk
INNER JOIN {{DB}}.sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
INNER JOIN {{DB}}.sys.tables tp   ON tp.object_id = fk.parent_object_id
INNER JOIN {{DB}}.sys.schemas sp  ON sp.schema_id = tp.schema_id
INNER JOIN {{DB}}.sys.tables tr   ON tr.object_id = fk.referenced_object_id
INNER JOIN {{DB}}.sys.schemas sr  ON sr.schema_id = tr.schema_id
INNER JOIN {{DB}}.sys.columns cp  ON cp.object_id = fkc.parent_object_id     AND cp.column_id = fkc.parent_column_id
';
SET @tpl = @tpl + N'INNER JOIN {{DB}}.sys.columns cr  ON cr.object_id = fkc.referenced_object_id AND cr.column_id = fkc.referenced_column_id
WHERE tp.name IN ({{ALVO}})
   OR tr.name IN ({{ALVO}})
';

/* ---------------------------------------------------------------------------
   4. Uma passada por base -> uma unica grade no fim.
   --------------------------------------------------------------------------- */
IF OBJECT_ID('tempdb..#esquema') IS NOT NULL DROP TABLE #esquema;
CREATE TABLE #esquema (
    tipo nvarchar(20) NOT NULL DEFAULT N'',
    banco nvarchar(128) NOT NULL DEFAULT N'',
    esquema nvarchar(128) NOT NULL DEFAULT N'',
    objeto nvarchar(128) NOT NULL DEFAULT N'',
    objeto_tipo nvarchar(20) NOT NULL DEFAULT N'',
    coluna nvarchar(128) NOT NULL DEFAULT N'',
    ordem nvarchar(10) NOT NULL DEFAULT N'',
    tipo_dado nvarchar(128) NOT NULL DEFAULT N'',
    tamanho nvarchar(20) NOT NULL DEFAULT N'',
    precisao nvarchar(10) NOT NULL DEFAULT N'',
    escala nvarchar(10) NOT NULL DEFAULT N'',
    nulo nvarchar(3) NOT NULL DEFAULT N'',
    pk nvarchar(3) NOT NULL DEFAULT N'',
    identidade nvarchar(3) NOT NULL DEFAULT N'',
    ref_banco nvarchar(128) NOT NULL DEFAULT N'',
    ref_esquema nvarchar(128) NOT NULL DEFAULT N'',
    ref_objeto nvarchar(128) NOT NULL DEFAULT N'',
    ref_coluna nvarchar(128) NOT NULL DEFAULT N'',
    restricao nvarchar(256) NOT NULL DEFAULT N''
);

DECLARE @base sysname, @sql nvarchar(max);
WHILE EXISTS (SELECT 1 FROM @bases WHERE feito = 0)
BEGIN
    SELECT TOP 1 @base = nome FROM @bases WHERE feito = 0 ORDER BY nome;
    SET @sql = REPLACE(REPLACE(REPLACE(@tpl,
        N'{{DB}}',    QUOTENAME(@base)),
        N'{{DBLIT}}', QUOTENAME(@base, '''')),
        N'{{ALVO}}',  @lista);

    BEGIN TRY
        INSERT INTO #esquema (tipo, banco, esquema, objeto, objeto_tipo, coluna, ordem, tipo_dado, tamanho, precisao, escala, nulo, pk, identidade, ref_banco, ref_esquema, ref_objeto, ref_coluna, restricao)
        EXEC sp_executesql @sql;
    END TRY
    BEGIN CATCH
        /* A base existe mas nao pode ser lida (permissao, offline, outra
           instancia). Vira uma linha na propria saida, em vez de derrubar tudo. */
        INSERT INTO #esquema (tipo, banco, restricao)
        VALUES (N'ERRO', @base, LEFT(ERROR_MESSAGE(), 250));
    END CATCH

    UPDATE @bases SET feito = 1 WHERE nome = @base;
END

/* O que a lista pede e a base nao tem. Nao e erro: a tabela pode viver em
   outra base da lista. So vira problema se faltar em TODAS - o portal avisa.
   Base que deu ERRO nao entra aqui: dela nao se sabe nada. */
INSERT INTO #esquema (tipo, banco, objeto)
SELECT N'AUSENTE', b.nome, a.nome
FROM @alvo a
CROSS JOIN @bases b
WHERE NOT EXISTS (
    SELECT 1 FROM #esquema e
    WHERE e.tipo = N'COLUNA' AND e.banco = b.nome AND e.objeto = a.nome
)
AND NOT EXISTS (
    SELECT 1 FROM #esquema x WHERE x.tipo = N'ERRO' AND x.banco = b.nome
);

/* ---------------------------------------------------------------------------
   5. A grade unica. Botao direito nela > "Save Results As..." > CSV,
   salvando nesta mesma pasta.
   --------------------------------------------------------------------------- */
SELECT tipo, banco, esquema, objeto, objeto_tipo, coluna, ordem, tipo_dado, tamanho, precisao, escala, nulo, pk, identidade, ref_banco, ref_esquema, ref_objeto, ref_coluna, restricao
FROM #esquema
ORDER BY banco, tipo, objeto,
    CASE WHEN ordem <> N'' AND ordem NOT LIKE N'%[^0-9]%' THEN CAST(ordem AS int) ELSE 0 END,
    coluna;

DROP TABLE #esquema;
