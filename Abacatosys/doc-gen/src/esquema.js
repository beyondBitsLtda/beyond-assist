/* =============================================================================
   esquema.js - Ponte entre o esquema INFERIDO do codigo e o esquema REAL do banco
   -----------------------------------------------------------------------------
   Fluxo previsto:

     1. O docgen roda e infere tabelas/colunas a partir do codigo.
     2. Para tudo que ficou "inferido", ele grava em <saida>/esquema-sql/:
          01-extrair-esquema.sql     -> script que o tecnico roda no SQL Server
          02-ddl-inferido.sql        -> DDL best-effort do que foi deduzido
          03-esquema-consolidado.sql -> tudo que ja e declarado hoje
          00-LEIA-ME.md              -> instrucoes
     3. O tecnico roda o 01 UMA VEZ (ele cobre todas as bases sozinho) e salva a
        grade de resultados dentro da MESMA pasta. Nome e extensao sao livres.
     4. Na proxima geracao o docgen le os arquivos dessa pasta - reconhecendo-os
        pelo conteudo, nao pela extensao - e passa a tratar aquelas tabelas como
        DECLARADAS (some o selo "inferido").
     5. Arquivo que nao produzir nada vira AVISO, no terminal e no portal. Falhar
        em silencio aqui e o pior erro possivel: quem salvou fica sem saber se o
        problema foi o arquivo, a pasta ou a ferramenta.

   Regra do projeto: "dado sem fonte nao e dado". Aqui a fonte passa a ser o
   proprio catalogo do banco (sys.tables / sys.columns / sys.foreign_keys).
============================================================================= */
'use strict';

var fs = require('fs');
var path = require('path');
var P = require('./parse');

var NOME_PASTA = 'esquema-sql';

/* Arquivos que a ferramenta gera (nao sao lidos de volta como esquema do banco). */
var GERADOS = ['01-extrair-esquema.sql', '02-ddl-inferido.sql', '03-esquema-consolidado.sql'];

/* Extensoes que a caixa "Save Results As" do SSMS oferece, mais as que o
   tecnico acaba digitando. A extensao nao decide nada — ela so diz quais
   arquivos vale a pena abrir. */
var EXTENSOES = /\.(csv|sql|txt|tsv|rpt|dat|out)$/i;

/* A pasta de esquema e POR APLICACAO.
   Uma pasta esquema-sql/ compartilhada era o motivo de toda documentacao gerada
   no mesmo diretorio herdar as tabelas da aplicacao anterior: o portal de um
   formulario aparecia com o esquema inteiro de outro sistema. */
function pasta(saidaHtml, slug) {
    var base = path.join(path.dirname(saidaHtml), NOME_PASTA);
    return slug ? path.join(base, slug) : base;
}

/* .sql soltos na raiz de esquema-sql/ (formato antigo, comum a todas as apps).
   Nao sao mais lidos — seriam atribuidos a aplicacao errada. */
function legado(saidaHtml) {
    var dir = path.join(path.dirname(saidaHtml), NOME_PASTA);
    var itens;
    try { itens = fs.readdirSync(dir); } catch (e) { return []; }
    return itens.filter(function (n) {
        if (!EXTENSOES.test(n)) return false;
        if (GERADOS.indexOf(n) >= 0) return false;
        try { return fs.statSync(path.join(dir, n)).isFile(); } catch (e2) { return false; }
    });
}

/* Saida do catalogo salva na pasta de OUTRA aplicacao.
   "Salvei e continua inferido" quase sempre e isto: o Save Results As abre na
   ultima pasta usada, que e a da aplicacao gerada antes. O arquivo existe, esta
   correto, e so nao esta sendo lido por ninguem — o que, sem este aviso,
   acontece em silencio. */
function perdidos(saidaHtml, slug) {
    var base = path.join(path.dirname(saidaHtml), NOME_PASTA);
    var out = [];
    var pastas;
    try { pastas = fs.readdirSync(base); } catch (e) { return out; }
    pastas.forEach(function (p) {
        if (p === slug) return;
        var dir = path.join(base, p);
        var itens;
        try {
            if (!fs.statSync(dir).isDirectory()) return;
            itens = fs.readdirSync(dir);
        } catch (e2) { return; }
        itens.forEach(function (n) {
            if (!EXTENSOES.test(n) || GERADOS.indexOf(n) >= 0) return;
            var full = path.join(dir, n);
            try {
                if (!fs.statSync(full).isFile()) return;
                if (!P.pareceEsquemaCatalogo(fs.readFileSync(full, 'utf8'))) return;
            } catch (e3) { return; }
            out.push(NOME_PASTA + '/' + p + '/' + n);
        });
    });
    return out;
}

/* ------------------------------------------------------------------ leitura */
/* Le o que o tecnico salvou na pasta desta aplicacao (ignora o que a ferramenta
   gera).

   O formato e decidido pelo CONTEUDO, nao pela extensao. A mesma grade do
   01-extrair-esquema.sql sai salva como .csv, .txt ou .sql conforme o dia e a
   maquina; quando a decisao era pela extensao, um arquivo certo salvo como .sql
   entrava no leitor de DDL, nao achava nenhum CREATE TABLE, devolvia zero
   tabelas — e o portal continuava inteiro em "inferido" sem dizer por que. */
function ler(dir) {
    var out = [];
    var itens;
    try { itens = fs.readdirSync(dir); } catch (e) { return out; }
    itens.sort();
    for (var i = 0; i < itens.length; i++) {
        var nome = itens[i];
        if (!EXTENSOES.test(nome)) continue;
        if (GERADOS.indexOf(nome) >= 0) continue;
        var full = path.join(dir, nome);
        var conteudo = '';
        try {
            var st = fs.statSync(full);
            if (!st.isFile()) continue;
            conteudo = fs.readFileSync(full, 'utf8');
        } catch (e2) { continue; }
        if (!conteudo.trim()) continue;
        out.push({
            nome: nome, path: full, conteudo: conteudo, tamanho: conteudo.length,
            formato: P.pareceEsquemaCatalogo(conteudo) ? 'csv' : 'sql',
            extensao: (nome.match(EXTENSOES) || [''])[0].replace('.', '').toLowerCase()
        });
    }
    return out;
}

/* ------------------------------------------------- 01 - script de extracao */
/* Lista de tabelas que interessam: proprias + externas efetivamente usadas. */
function tabelasAlvo(modelo) {
    var set = {};
    modelo.dataModel.entidades.forEach(function (e) {
        var seg = String(e.nome).split('.').pop().replace(/[\[\]]/g, '');
        if (seg) set[seg.toUpperCase()] = seg;
    });
    modelo.rastreabilidade.tabelas.forEach(function (t) {
        var seg = String(t).split('.').pop();
        if (seg) set[seg.toUpperCase()] = seg;
    });
    return Object.keys(set).sort().map(function (k) { return set[k]; });
}

function agora() {
    return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

/* Bancos que o codigo da aplicacao menciona explicitamente (FLUIG.dbo.X). */
function bancosAlvo(modelo) {
    var lista = (modelo.dataModel.bancos || [])
        .filter(function (b) { return b.identificado; })
        .map(function (b) { return b.nome; });
    return lista;
}

/* -----------------------------------------------------------------------------
   UMA EXECUCAO PARA TODAS AS BASES

   O catalogo do SQL Server (sys.objects, sys.columns) e por banco, mas ele pode
   ser lido de fora: [FLUIG].sys.objects responde de qualquer base da mesma
   instancia. E isso que permite UMA execucao so, cobrindo todas as bases, em vez
   de trocar a base na barra do SSMS e salvar um CSV por vez.

   O nome do banco entra na consulta como IDENTIFICADOR, e identificador nao
   aceita parametro. Por isso o bloco de leitura e um template montado em tempo
   de execucao (sp_executesql), uma vez por base. O efeito colateral e bom: uma
   base que nao existe nesta instancia - ou onde o login nao tem acesso - e
   pulada com uma linha tipo=ERRO, em vez de derrubar o lote inteiro com
   "Invalid object name".
   ----------------------------------------------------------------------------- */

/* As 19 colunas da grade, na ordem. E o contrato com o leitor de CSV: sem
   cabecalho, ele le por posicao. */
var COLUNAS_GRADE = ['tipo', 'banco', 'esquema', 'objeto', 'objeto_tipo', 'coluna', 'ordem',
    'tipo_dado', 'tamanho', 'precisao', 'escala', 'nulo', 'pk', 'identidade',
    'ref_banco', 'ref_esquema', 'ref_objeto', 'ref_coluna', 'restricao'];

/* Bloco que le UMA base. {{DB}} vira [FLUIG], {{DBLIT}} vira 'FLUIG' e {{ALVO}}
   vira a lista de objetos - os tres substituidos em tempo de execucao. */
function blocoPorBase() {
    return [
        '/* COLUNAS de tabelas e views */',
        'SELECT',
        "    CAST('COLUNA' AS nvarchar(20))                     AS tipo,",
        '    CAST({{DBLIT}} AS nvarchar(128))                   AS banco,',
        '    CAST(s.name AS nvarchar(128))                      AS esquema,',
        '    CAST(o.name AS nvarchar(128))                      AS objeto,',
        "    CAST(CASE o.type WHEN 'V' THEN 'VIEW' ELSE 'TABELA' END AS nvarchar(20)) AS objeto_tipo,",
        '    CAST(c.name AS nvarchar(128))                      AS coluna,',
        '    CAST(c.column_id AS nvarchar(10))                  AS ordem,',
        '    CAST(ty.name AS nvarchar(128))                     AS tipo_dado,',
        '    CAST(CASE',
        "        WHEN c.max_length = -1 THEN 'MAX'",
        "        WHEN ty.name IN ('nvarchar','nchar') THEN CAST(c.max_length / 2 AS nvarchar(10))",
        '        ELSE CAST(c.max_length AS nvarchar(10))',
        '    END AS nvarchar(20))                               AS tamanho,',
        '    CAST(c.precision AS nvarchar(10))                  AS precisao,',
        '    CAST(c.scale AS nvarchar(10))                      AS escala,',
        "    CAST(CASE WHEN c.is_nullable = 1 THEN 'SIM' ELSE 'NAO' END AS nvarchar(3)) AS nulo,",
        '    CAST(CASE WHEN EXISTS (',
        '        SELECT 1',
        '        FROM {{DB}}.sys.index_columns ic',
        '        INNER JOIN {{DB}}.sys.indexes ix ON ix.object_id = ic.object_id AND ix.index_id = ic.index_id',
        '        WHERE ic.object_id = c.object_id AND ic.column_id = c.column_id AND ix.is_primary_key = 1',
        "    ) THEN 'SIM' ELSE 'NAO' END AS nvarchar(3))        AS pk,",
        "    CAST(CASE WHEN c.is_identity = 1 THEN 'SIM' ELSE 'NAO' END AS nvarchar(3)) AS identidade,",
        "    CAST('' AS nvarchar(128))                          AS ref_banco,",
        "    CAST('' AS nvarchar(128))                          AS ref_esquema,",
        "    CAST('' AS nvarchar(128))                          AS ref_objeto,",
        "    CAST('' AS nvarchar(128))                          AS ref_coluna,",
        "    CAST('' AS nvarchar(256))                          AS restricao",
        'FROM {{DB}}.sys.objects o',
        'INNER JOIN {{DB}}.sys.schemas s  ON s.schema_id = o.schema_id',
        'INNER JOIN {{DB}}.sys.columns c  ON c.object_id = o.object_id',
        'INNER JOIN {{DB}}.sys.types ty   ON ty.user_type_id = c.user_type_id',
        "WHERE o.type IN ('U','V')",
        '  AND o.name IN ({{ALVO}})',
        '',
        'UNION ALL',
        '',
        '/* CHAVES ESTRANGEIRAS -> viram relacionamentos DECLARADOS no portal */',
        'SELECT',
        "    CAST('FK' AS nvarchar(20)),",
        '    CAST({{DBLIT}} AS nvarchar(128)),',
        '    CAST(sp.name AS nvarchar(128)),',
        '    CAST(tp.name AS nvarchar(128)),',
        "    CAST('TABELA' AS nvarchar(20)),",
        '    CAST(cp.name AS nvarchar(128)),',
        '    CAST(fkc.constraint_column_id AS nvarchar(10)),',
        "    CAST('' AS nvarchar(128)),",
        "    CAST('' AS nvarchar(20)),",
        "    CAST('' AS nvarchar(10)),",
        "    CAST('' AS nvarchar(10)),",
        "    CAST('' AS nvarchar(3)),",
        "    CAST('' AS nvarchar(3)),",
        "    CAST('' AS nvarchar(3)),",
        '    CAST({{DBLIT}} AS nvarchar(128)),',
        '    CAST(sr.name AS nvarchar(128)),',
        '    CAST(tr.name AS nvarchar(128)),',
        '    CAST(cr.name AS nvarchar(128)),',
        '    CAST(fk.name AS nvarchar(256))',
        'FROM {{DB}}.sys.foreign_keys fk',
        'INNER JOIN {{DB}}.sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id',
        'INNER JOIN {{DB}}.sys.tables tp   ON tp.object_id = fk.parent_object_id',
        'INNER JOIN {{DB}}.sys.schemas sp  ON sp.schema_id = tp.schema_id',
        'INNER JOIN {{DB}}.sys.tables tr   ON tr.object_id = fk.referenced_object_id',
        'INNER JOIN {{DB}}.sys.schemas sr  ON sr.schema_id = tr.schema_id',
        'INNER JOIN {{DB}}.sys.columns cp  ON cp.object_id = fkc.parent_object_id     AND cp.column_id = fkc.parent_column_id',
        'INNER JOIN {{DB}}.sys.columns cr  ON cr.object_id = fkc.referenced_object_id AND cr.column_id = fkc.referenced_column_id',
        'WHERE tp.name IN ({{ALVO}})',
        '   OR tr.name IN ({{ALVO}})'
    ];
}

/* Linhas do template -> varios "SET @tpl = @tpl + N'...';".
   Em pedacos curtos de proposito: literal de string longo tem regra propria de
   tipo no SQL Server, e concatenar pedacos sobre uma variavel JA declarada
   nvarchar(max) nao depende dessa regra. */
function embutirTemplate(linhas) {
    var out = [], buf = [], tam = 0;
    function fechar() {
        if (!buf.length) return;
        out.push("SET @tpl = @tpl + N'" + buf.join('\r\n').replace(/'/g, "''") + "\r\n';");
        buf = []; tam = 0;
    }
    linhas.forEach(function (l) {
        if (tam + l.length > 1200) fechar();
        buf.push(l); tam += l.length + 2;
    });
    fechar();
    return out;
}

/* Tamanho de cada coluna da tabela temporaria, igual ao CAST do template. */
function tamanhoColuna(c) {
    if (c === 'restricao') return 256;
    if (/^(ordem|precisao|escala)$/.test(c)) return 10;
    if (/^(nulo|pk|identidade)$/.test(c)) return 3;
    if (/^(tipo|objeto_tipo|tamanho)$/.test(c)) return 20;
    return 128;
}

function scriptExtracao(modelo) {
    var alvo = tabelasAlvo(modelo);
    var app = modelo.meta.appCode || 'aplicacao';
    var bancos = bancosAlvo(modelo);
    var inferidas = modelo.dataModel.entidades.filter(function (e) { return e.fonte !== 'declarado'; });
    var semBanco = modelo.dataModel.entidades.filter(function (e) { return !e.bancoNome; });

    var valores = alvo.length
        ? alvo.map(function (t) { return "    ('" + t.replace(/'/g, "''") + "')"; }).join(',\r\n')
        : "    ('COLOQUE_AQUI_O_NOME_DA_TABELA')";

    var L = [];
    L.push('/* =============================================================================');
    L.push('   ' + app + ' - EXTRACAO DO ESQUEMA REAL DO BANCO   (saida em CSV)');
    L.push('   Gerado por delp-docgen em ' + agora());
    L.push('   -----------------------------------------------------------------------------');
    L.push('   PARA QUE SERVE');
    L.push('     O docgen deduziu ' + inferidas.length + ' tabela(s) a partir do codigo-fonte.');
    L.push('     Deducao nao e documentacao. Rode este script para obter o esquema REAL e');
    L.push('     devolve-lo ao portal.');
    L.push('');
    L.push('   UMA EXECUCAO SO, UM CSV SO - RODE EM QUALQUER BASE');
    L.push('     Nao e preciso escolher a base na barra do SSMS nem rodar duas vezes. O');
    L.push('     script le o catalogo de cada banco pelo nome qualificado');
    L.push('     ([FLUIG].sys.objects), entao uma execucao ja traz todas as bases numa');
    L.push('     grade unica. Cada linha diz em qual banco ela foi encontrada.');
    if (bancos.length) {
        L.push('');
        L.push('     Bases que este script vai ler:');
        bancos.forEach(function (b) {
            var qtd = (modelo.dataModel.bancos.filter(function (x) { return x.nome === b; })[0] || {}).tabelas || 0;
            L.push('       - ' + b + '   (' + qtd + ' tabela(s) atribuidas a esta base pelo codigo)');
        });
        L.push('');
        L.push('     Base que nao existir nesta instancia, ou onde o login nao tiver acesso,');
        L.push('     e pulada com uma linha tipo=ERRO. O resto continua normalmente.');
    } else {
        L.push('');
        L.push('     Nenhuma base foi identificada no codigo: os nomes de tabela aparecem sem');
        L.push('     o prefixo do banco. O script le a base em que voce estiver conectado.');
        L.push('     Para varrer a instancia inteira, descomente o INSERT "TODAS AS BASES".');
    }
    if (semBanco.length) {
        L.push('');
        L.push('     ' + semBanco.length + ' tabela(s) aparecem no codigo SEM o nome da base.');
        L.push('     Elas sao procuradas em TODAS as bases da lista: a base em que forem');
        L.push('     encontradas passa a ser a base delas.');
    }
    L.push('');
    L.push('   COMO USAR (SQL Server Management Studio)');
    L.push('     1. Abra este arquivo e execute com F5. A base selecionada na barra NAO');
    L.push('        importa - o script qualifica cada banco pelo nome.');
    L.push('     2. O resultado sai em UMA grade so, com todas as bases juntas.');
    L.push('     3. Clique com o botao direito na grade > "Save Results As..."');
    L.push('        > tipo "CSV" > salve DENTRO DESTA MESMA PASTA.');
    L.push('        O nome do arquivo nao importa. O cabecalho de colunas tambem e');
    L.push('        opcional ("Include column headers" ligado ou desligado).');
    L.push('     4. Rode o delp-docgen de novo sobre a mesma pasta de saida. As tabelas');
    L.push('        deixam de aparecer como "inferido" e passam a constar como');
    L.push('        "declarado (banco)", cada uma na sua base.');
    L.push('');
    L.push('   O QUE VEM NO CSV');
    L.push('     tipo=COLUNA   uma linha por coluna de tabela/view encontrada');
    L.push('     tipo=FK       uma linha por coluna de chave estrangeira');
    L.push('     tipo=AUSENTE  objeto da lista que NAO existe naquela base');
    L.push('                   (normal: ele provavelmente esta em outra da lista)');
    L.push('     tipo=ERRO     base que nao pode ser lida; a mensagem vai na ultima coluna');
    L.push('');
    L.push('   OBSERVACAO');
    L.push('     Somente LEITURA. Este script nao altera nada: consulta apenas o catalogo');
    L.push('     do SQL Server (sys.objects, sys.columns, sys.foreign_keys) e uma tabela');
    L.push('     temporaria propria (#esquema), descartada no fim.');
    L.push('============================================================================= */');
    L.push('');
    L.push('SET NOCOUNT ON;');
    L.push('');
    L.push('/* ---------------------------------------------------------------------------');
    L.push('   1. Objetos de interesse (detectados no codigo). Acrescente/remova a vontade.');
    L.push('   Sao nomes SEM banco e SEM esquema: a busca e pelo nome do objeto.');
    L.push('   --------------------------------------------------------------------------- */');
    L.push('DECLARE @alvo TABLE (nome sysname PRIMARY KEY);');
    L.push('INSERT INTO @alvo (nome) VALUES');
    L.push(valores + ';');
    L.push('');
    L.push('/* ---------------------------------------------------------------------------');
    L.push('   2. Bases a ler. Vieram dos nomes qualificados encontrados no codigo.');
    L.push('   --------------------------------------------------------------------------- */');
    L.push('DECLARE @bases TABLE (nome sysname PRIMARY KEY, feito bit NOT NULL DEFAULT 0);');
    if (bancos.length) {
        L.push('INSERT INTO @bases (nome) VALUES');
        L.push(bancos.map(function (b) { return "    ('" + String(b).replace(/'/g, "''") + "')"; }).join(',\r\n') + ';');
    } else {
        L.push('/* Nenhuma base identificada no codigo: cai na base da conexao (abaixo). */');
    }
    L.push('');
    L.push('/* TODAS AS BASES: descomente para varrer a instancia inteira. */');
    L.push('-- INSERT INTO @bases (nome)');
    L.push('-- SELECT name FROM sys.databases');
    L.push('-- WHERE database_id > 4 AND state = 0 AND name NOT IN (SELECT nome FROM @bases);');
    L.push('');
    L.push('/* Base inexistente ou sem acesso para este login sai da lista antes de rodar. */');
    L.push('DELETE FROM @bases WHERE DB_ID(nome) IS NULL;');
    L.push('IF NOT EXISTS (SELECT 1 FROM @bases) INSERT INTO @bases (nome) VALUES (DB_NAME());');
    L.push('');
    L.push('/* Lista de alvos em texto, para viajar ate a consulta montada em tempo de execucao. */');
    L.push("DECLARE @lista nvarchar(max) = CAST(N'' AS nvarchar(max));");
    L.push("SELECT @lista = @lista + CASE WHEN @lista = N'' THEN N'' ELSE N',' END + QUOTENAME(nome, '''')");
    L.push('FROM @alvo;');
    L.push('');
    L.push('/* ---------------------------------------------------------------------------');
    L.push("   3. Bloco lido em cada base. {{DB}} vira [FLUIG], {{DBLIT}} vira 'FLUIG' e");
    L.push('   {{ALVO}} vira a lista de objetos acima.');
    L.push('   --------------------------------------------------------------------------- */');
    L.push("DECLARE @tpl nvarchar(max) = CAST(N'' AS nvarchar(max));");
    embutirTemplate(blocoPorBase()).forEach(function (s) { L.push(s); });
    L.push('');
    L.push('/* ---------------------------------------------------------------------------');
    L.push('   4. Uma passada por base -> uma unica grade no fim.');
    L.push('   --------------------------------------------------------------------------- */');
    L.push("IF OBJECT_ID('tempdb..#esquema') IS NOT NULL DROP TABLE #esquema;");
    L.push('CREATE TABLE #esquema (');
    L.push(COLUNAS_GRADE.map(function (c) {
        return '    ' + c + ' nvarchar(' + tamanhoColuna(c) + ") NOT NULL DEFAULT N''";
    }).join(',\r\n'));
    L.push(');');
    L.push('');
    L.push('DECLARE @base sysname, @sql nvarchar(max);');
    L.push('WHILE EXISTS (SELECT 1 FROM @bases WHERE feito = 0)');
    L.push('BEGIN');
    L.push('    SELECT TOP 1 @base = nome FROM @bases WHERE feito = 0 ORDER BY nome;');
    L.push('    SET @sql = REPLACE(REPLACE(REPLACE(@tpl,');
    L.push("        N'{{DB}}',    QUOTENAME(@base)),");
    L.push("        N'{{DBLIT}}', QUOTENAME(@base, '''')),");
    L.push("        N'{{ALVO}}',  @lista);");
    L.push('');
    L.push('    BEGIN TRY');
    L.push('        INSERT INTO #esquema (' + COLUNAS_GRADE.join(', ') + ')');
    L.push('        EXEC sp_executesql @sql;');
    L.push('    END TRY');
    L.push('    BEGIN CATCH');
    L.push('        /* A base existe mas nao pode ser lida (permissao, offline, outra');
    L.push('           instancia). Vira uma linha na propria saida, em vez de derrubar tudo. */');
    L.push('        INSERT INTO #esquema (tipo, banco, restricao)');
    L.push("        VALUES (N'ERRO', @base, LEFT(ERROR_MESSAGE(), 250));");
    L.push('    END CATCH');
    L.push('');
    L.push('    UPDATE @bases SET feito = 1 WHERE nome = @base;');
    L.push('END');
    L.push('');
    L.push('/* O que a lista pede e a base nao tem. Nao e erro: a tabela pode viver em');
    L.push('   outra base da lista. So vira problema se faltar em TODAS - o portal avisa.');
    L.push('   Base que deu ERRO nao entra aqui: dela nao se sabe nada. */');
    L.push('INSERT INTO #esquema (tipo, banco, objeto)');
    L.push("SELECT N'AUSENTE', b.nome, a.nome");
    L.push('FROM @alvo a');
    L.push('CROSS JOIN @bases b');
    L.push('WHERE NOT EXISTS (');
    L.push('    SELECT 1 FROM #esquema e');
    L.push("    WHERE e.tipo = N'COLUNA' AND e.banco = b.nome AND e.objeto = a.nome");
    L.push(')');
    L.push('AND NOT EXISTS (');
    L.push("    SELECT 1 FROM #esquema x WHERE x.tipo = N'ERRO' AND x.banco = b.nome");
    L.push(');');
    L.push('');
    L.push('/* ---------------------------------------------------------------------------');
    L.push('   5. A grade unica. Botao direito nela > "Save Results As..." > CSV,');
    L.push('   salvando nesta mesma pasta.');
    L.push('   --------------------------------------------------------------------------- */');
    L.push('SELECT ' + COLUNAS_GRADE.join(', '));
    L.push('FROM #esquema');
    L.push('ORDER BY banco, tipo, objeto,');
    L.push("    CASE WHEN ordem <> N'' AND ordem NOT LIKE N'%[^0-9]%' THEN CAST(ordem AS int) ELSE 0 END,");
    L.push('    coluna;');
    L.push('');
    L.push('DROP TABLE #esquema;');
    L.push('');
    return L.join('\r\n');
}

/* ------------------------------------------- 02 - DDL do que foi inferido */
function tipoSugerido(col) {
    if (col.tipo && col.tipo !== '?') return col.tipo;
    var n = String(col.nome || '').toUpperCase();
    if (n === 'ID' || /_ID$/.test(n) || /^ID_/.test(n)) return 'INT';
    if (/^(DT_|DATA|DATE)/.test(n) || /_DT$/.test(n) || /DATA$/.test(n)) return 'DATETIME';
    if (/^(VL_|VALOR)/.test(n) || /VALOR$/.test(n) || /^QTD/.test(n)) return 'DECIMAL(18,2)';
    if (/^(FL_|IND_|ATIVO|FLAG)/.test(n)) return 'BIT';
    return 'VARCHAR(255)';
}

/* Agrupa entidades pela base de dados em que vivem. As de base desconhecida
   ficam num grupo proprio, no fim, explicitamente marcado como tal — juntar
   tudo num bloco so daria a entender que rodam no mesmo lugar. */
function porBaseDeDados(entidades) {
    var mapa = {};
    entidades.forEach(function (e) {
        var b = e.bancoNome || '';
        var g = mapa[b] = mapa[b] || { banco: b || '(base nao identificada)', identificado: !!b, itens: [] };
        g.itens.push(e);
    });
    return Object.keys(mapa).sort(function (a, b) {
        if (!a !== !b) return a ? -1 : 1;      /* identificadas primeiro */
        return a < b ? -1 : 1;
    }).map(function (k) { return mapa[k]; });
}

function ddlInferido(modelo) {
    var alvos = modelo.dataModel.entidades.filter(function (e) {
        return e.fonte !== 'declarado' && e.origem === 'propria';
    });
    var L = [];
    L.push('/* =============================================================================');
    L.push('   ' + (modelo.meta.appCode || 'aplicacao') + ' - DDL INFERIDO (RASCUNHO, NAO AUTORITATIVO)');
    L.push('   Gerado por delp-docgen em ' + agora());
    L.push('   -----------------------------------------------------------------------------');
    L.push('   ATENCAO: este arquivo foi DEDUZIDO do codigo-fonte (constantes de tabela,');
    L.push('   grupos de colunas e SQL embutido). Os TIPOS sao chute educado, nao verdade.');
    L.push('');
    L.push('   NAO EXECUTE em producao. Use como:');
    L.push('     - ponto de partida para criar a tabela num ambiente novo, ou');
    L.push('     - checklist para conferir contra o esquema real (01-extrair-esquema.sql).');
    L.push('');
    L.push('   O DDL esta separado POR BASE DE DADOS. Rodar o bloco inteiro numa base so');
    L.push('   criaria, no lugar errado, tabelas que pertencem a outra.');
    L.push('============================================================================= */');
    L.push('');
    if (!alvos.length) {
        L.push('-- Nenhuma tabela propria ficou apenas inferida: o esquema ja esta declarado');
        L.push('-- (ou nenhuma tabela propria foi identificada no codigo).');
        return L.join('\r\n');
    }
    porBaseDeDados(alvos).forEach(function (grupo) {
        L.push('/* =============================================================================');
        L.push('   BASE: ' + grupo.banco + '   (' + grupo.itens.length + ' tabela(s))');
        if (grupo.identificado) {
            L.push('   Conecte nesta base antes de executar o bloco abaixo.');
            L.push('   USE [' + grupo.banco + '];');
        } else {
            L.push('   A base destas tabelas NAO foi identificada: o codigo as referencia sem');
            L.push('   o prefixo do banco. Confirme onde elas vivem antes de usar este DDL.');
        }
        L.push('============================================================================= */');
        L.push('');
        grupo.itens.forEach(function (e) {
        var seg = String(e.nome).split('.').pop();
        var ehView = /^V(W)?_/i.test(seg);
        L.push('/* ---------------------------------------------------------------------------');
        L.push('   ' + e.chave + '   (' + e.colunas.length + ' colunas deduzidas)');
        L.push('   Nome completo no codigo: ' + e.nome);
        L.push('   --------------------------------------------------------------------------- */');
        if (ehView) {
            /* o nome indica VIEW: gerar CREATE TABLE aqui seria mentira */
            L.push('-- O nome sugere uma VIEW, nao uma tabela. Nenhum DDL foi gerado.');
            L.push('-- Traga a definicao real com a secao 4 de 01-extrair-esquema.sql.');
            if (e.colunas.length) {
                L.push('-- Colunas usadas pelo codigo: ' + e.colunas.map(function (c) { return c.nome; }).join(', '));
            }
            L.push('');
            return;
        }
        if (!e.colunas.length) {
            L.push('-- Nenhuma coluna pode ser deduzida para esta tabela.');
            L.push('-- CREATE TABLE [' + seg + '] ( ... );');
            L.push('');
            return;
        }
        var pk = e.colunas.filter(function (c) { return c.pk; }).map(function (c) { return '[' + c.nome + ']'; });
        var linhas = e.colunas.map(function (c) {
            var tipo = tipoSugerido(c);
            var nulo = c.pk ? ' IDENTITY(1,1) NOT NULL' : (c.nulo === false ? ' NOT NULL' : ' NULL');
            return '    [' + c.nome + '] ' + tipo + nulo;
        });
        if (pk.length) linhas.push('    CONSTRAINT [PK_' + seg + '] PRIMARY KEY (' + pk.join(', ') + ')');
        L.push('CREATE TABLE [' + seg + '] (');
        L.push(linhas.join(',\r\n'));
        L.push(');');
        L.push('');
        });
    });

    var rels = modelo.dataModel.relacoes.filter(function (r) { return r.fonte !== 'declarado'; });
    if (rels.length) {
        L.push('/* ---------------------------------------------------------------------------');
        L.push('   Relacionamentos deduzidos (coluna XXX_ID apontando para a tabela XXX).');
        L.push('   Descomente somente depois de confirmar contra o banco real.');
        L.push('   --------------------------------------------------------------------------- */');
        rels.forEach(function (r) {
            var de = String(r.de).split('.').pop();
            var para = String(r.para).split('.').pop();
            L.push('-- ALTER TABLE [' + de + '] ADD CONSTRAINT [FK_' + de + '_' + para + ']');
            L.push('--     FOREIGN KEY ([' + r.deColuna + ']) REFERENCES [' + para + '] ([ID]);');
        });
        L.push('');
    }
    return L.join('\r\n');
}

/* ------------------------------------ 03 - consolidado do que ja e declarado */
function consolidado(modelo) {
    var L = [];
    L.push('/* =============================================================================');
    L.push('   ' + (modelo.meta.appCode || 'aplicacao') + ' - ESQUEMA CONSOLIDADO (somente o DECLARADO)');
    L.push('   Gerado por delp-docgen em ' + agora());
    L.push('   -----------------------------------------------------------------------------');
    L.push('   Reune tudo que tem fonte: DDL da pasta /sql da aplicacao + esquema extraido');
    L.push('   do banco e salvo nesta pasta. Nada aqui foi deduzido.');
    L.push('');
    L.push('   Separado POR BASE DE DADOS: esta aplicacao le de mais de uma.');
    L.push('============================================================================= */');
    L.push('');
    var decl = modelo.dataModel.entidades.filter(function (e) { return e.fonte === 'declarado'; });
    if (!decl.length) {
        L.push('-- Nenhuma tabela declarada ainda.');
        L.push('-- Rode 01-extrair-esquema.sql em cada base e salve os CSV nesta pasta.');
        return L.join('\r\n');
    }
    porBaseDeDados(decl).forEach(function (grupo) {
        L.push('/* =============================================================================');
        L.push('   BASE: ' + grupo.banco + '   (' + grupo.itens.length + ' objeto(s))');
        if (grupo.identificado) L.push('   USE [' + grupo.banco + '];');
        L.push('============================================================================= */');
        L.push('');
        grupo.itens.forEach(function (e) {
            var seg = String(e.nome).split('.').pop();
            var esq = e.esquema ? '[' + e.esquema + '].' : '';
            L.push('/* ' + e.chave + '  --  fonte: ' + (e.fonteArquivo || 'sql') +
                (e.banco ? '  (catalogo do SQL Server)' : '') + ' */');
            if (e.ehView) {
                L.push('-- OBJETO E UMA VIEW. Colunas: ' + e.colunas.map(function (c) { return c.nome; }).join(', '));
                L.push('');
                return;
            }
            L.push('CREATE TABLE ' + esq + '[' + seg + '] (');
            L.push(e.colunas.map(function (c) {
                return '    [' + c.nome + '] ' + (c.tipo && c.tipo !== '?' ? c.tipo : 'VARCHAR(255)') +
                    (c.identidade ? ' IDENTITY(1,1)' : '') + (c.nulo ? ' NULL' : ' NOT NULL');
            }).join(',\r\n'));
            L.push(');');
            L.push('');
        });

        /* As FKs entram DENTRO da base a que pertencem. O SQL Server nao tem
           foreign key entre bancos, entao um bloco solto no fim do arquivo
           daria a entender que as constraints valem para a ultima base listada. */
        var daBase = {};
        grupo.itens.forEach(function (e) { daBase[e.chave] = 1; });
        var fks = modelo.dataModel.relacoes.filter(function (r) {
            return r.fonte === 'declarado' && daBase[r.de];
        });
        if (fks.length) {
            L.push('/* Chaves estrangeiras declaradas em ' + grupo.banco + ' */');
            fks.forEach(function (r) {
                var de = String(r.de).split('.').pop(), para = String(r.para).split('.').pop();
                L.push('ALTER TABLE [' + de + '] ADD CONSTRAINT [' + (r.constraint || ('FK_' + de + '_' + para)) + ']');
                L.push('    FOREIGN KEY ([' + r.deColuna + ']) REFERENCES [' + para + '] ([' + (r.paraColuna || 'ID') + ']);');
            });
            L.push('');
        }
    });

    /* FK declarada cuja tabela de origem nao entrou em nenhum grupo acima */
    var orfas = modelo.dataModel.relacoes.filter(function (r) {
        if (r.fonte !== 'declarado') return false;
        return !decl.some(function (e) { return e.chave === r.de; });
    });
    if (orfas.length) {
        L.push('/* Chaves estrangeiras cuja tabela de origem nao esta declarada aqui */');
        orfas.forEach(function (r) {
            L.push('-- ' + r.de + '.' + r.deColuna + ' -> ' + r.para + '.' + (r.paraColuna || 'ID') +
                (r.constraint ? '   (' + r.constraint + ')' : ''));
        });
    }
    return L.join('\r\n');
}

/* --------------------------------------------------------------- 00 - LEIA-ME */
function leiaMe(modelo, lidos) {
    lidos = lidos || [];
    var inf = modelo.dataModel.entidades.filter(function (e) { return e.fonte !== 'declarado'; });
    var dec = modelo.dataModel.entidades.filter(function (e) { return e.fonte === 'declarado'; });
    var bancos = modelo.dataModel.bancos || [];
    var lidosBancos = (modelo.esquemaBanco && modelo.esquemaBanco.bancos) || [];
    var app = modelo.meta.appCode || 'aplicacao';

    var L = [];
    L.push('# Esquema SQL — ' + app);
    L.push('');
    L.push('Esta pasta e a **ponte entre o codigo e o banco**. Ela existe para tirar do');
    L.push('portal os selos de *inferido* / *deduzido*.');
    L.push('');
    L.push('## Bases de dados desta aplicacao');
    L.push('');
    L.push('Uma aplicacao Fluig raramente fala com um banco so: as tabelas proprias ficam');
    L.push('no FLUIG e as de ERP no CORPORE, muitas vezes na mesma consulta.');
    L.push('');
    L.push('O `01-extrair-esquema.sql` le **todas as bases numa execucao so**: ele qualifica');
    L.push('o catalogo pelo nome do banco (`[FLUIG].sys.objects`), o que funciona de');
    L.push('qualquer base da mesma instancia. Nao e preciso trocar a base na barra do SSMS');
    L.push('nem salvar um arquivo por vez.');
    L.push('');
    L.push('| Base | Tabelas atribuidas | Ja declaradas | Confirmadas no catalogo |');
    L.push('|---|---|---|---|');
    if (bancos.length) {
        bancos.forEach(function (b) {
            L.push('| ' + (b.identificado ? '`' + b.nome + '`' : '_' + b.nome + '_') +
                ' | ' + b.tabelas + ' | ' + b.declaradas + ' | ' + b.confirmadas + ' |');
        });
    } else {
        L.push('| _nenhuma tabela identificada_ | 0 | 0 | 0 |');
    }
    L.push('');
    var naoId = bancos.filter(function (b) { return !b.identificado; })[0];
    if (naoId) {
        L.push('> ' + naoId.tabelas + ' tabela(s) aparecem no codigo **sem o nome da base**');
        L.push('> (`dbo.X` em vez de `FLUIG.dbo.X`). Elas entram na lista de todas as');
        L.push('> execucoes: a base em que forem encontradas passa a ser a base delas.');
        L.push('');
    }

    L.push('## Situacao atual');
    L.push('');
    L.push('| Indicador | Valor |');
    L.push('|---|---|');
    L.push('| Tabelas com esquema **declarado** | ' + dec.length + ' |');
    L.push('| Tabelas ainda **inferidas** do codigo | ' + inf.length + ' |');
    L.push('| Arquivos de esquema lidos desta pasta | ' + lidos.length + ' |');
    L.push('| Bases ja extraidas | ' + (lidosBancos.length ? lidosBancos.join(', ') : 'nenhuma') + ' |');
    if (lidos.length) {
        L.push('');
        L.push('Arquivos lidos: ' + lidos.map(function (x) { return '`' + x.nome + '`'; }).join(', '));
    }
    L.push('');

    L.push('## Como remover os selos de "inferido"');
    L.push('');
    L.push('Uma execucao, um arquivo.');
    L.push('');
    L.push('1. Abra `01-extrair-esquema.sql` no SSMS e execute com `F5`.');
    L.push('   A base selecionada na barra **nao importa**.');
    L.push('2. O resultado sai em **uma grade so**, com todas as bases juntas.');
    L.push('3. Botao direito na grade > **Save Results As...** > salve **nesta pasta**.');
    L.push('4. Rode o `delp-docgen` novamente sobre a mesma pasta de saida.');
    L.push('');
    L.push('> **Salve dentro desta pasta**, nao na pasta de outra aplicacao. E o motivo');
    L.push('> numero um de "salvei e continua inferido": o dialogo do SSMS reabre na');
    L.push('> ultima pasta usada. O caminho exato esta no fim deste arquivo.');
    L.push('');
    L.push('Nao e preciso ajustar nada no SSMS. O leitor decide o formato pelo conteudo do');
    L.push('arquivo, entao ele lida sozinho com as variacoes de maquina para maquina:');
    L.push('');
    L.push('- **nome e extensao livres** — `.csv`, `.txt`, `.sql`, `.rpt`, `resultado3.csv`;');
    L.push('- separador `,`, `;`, tab ou `|` (Windows pt-BR usa `;`);');
    L.push('- com ou sem BOM;');
    L.push('- **com ou sem a linha de cabecalho** (a opcao *Include column headers* pode');
    L.push('  estar desligada) — sem cabecalho a leitura e posicional, na ordem que o');
    L.push('  `01-extrair-esquema.sql` produz;');
    L.push('- grade (`Ctrl+D`) **ou** texto de largura fixa (`Ctrl+T`).');
    L.push('');
    L.push('Cada linha carrega a coluna `banco`, entao o portal sabe de qual base cada');
    L.push('tabela veio mesmo com varios arquivos na pasta.');
    L.push('');
    L.push('Se depois de gerar de novo ainda aparecer "inferido", o portal passa a dizer o');
    L.push('motivo: procure a secao de avisos, no rodape.');
    L.push('');

    L.push('## O que vem no CSV');
    L.push('');
    L.push('| Coluna `tipo` | Significado |');
    L.push('|---|---|');
    L.push('| `COLUNA` | uma linha por coluna de tabela ou view encontrada |');
    L.push('| `FK` | uma linha por coluna de chave estrangeira (vira relacionamento **declarado**) |');
    L.push('| `AUSENTE` | objeto da lista que **nao existe naquela base** — normal, ele deve estar em outra |');
    L.push('| `ERRO` | base que nao pode ser lida; a mensagem do SQL Server vem na ultima coluna |');
    L.push('');
    L.push('Linhas `AUSENTE` so viram alerta no portal quando o objeto falta em **todas**');
    L.push('as bases extraidas. Linhas `ERRO` viram aviso sempre: aquela base nao foi lida,');
    L.push('e as tabelas dela continuam inferidas.');
    L.push('');

    L.push('## Arquivos gerados automaticamente');
    L.push('');
    L.push('| Arquivo | O que e | Rodar no banco? |');
    L.push('|---|---|---|');
    L.push('| `01-extrair-esquema.sql` | Consulta o catalogo do SQL Server e devolve o esquema real. Somente leitura. | **Sim — uma vez so** |');
    L.push('| `02-ddl-inferido.sql` | Rascunho do DDL deduzido do codigo, separado por base. Tipos sao estimativa. | Nao (rascunho) |');
    L.push('| `03-esquema-consolidado.sql` | Tudo que ja tem fonte declarada, separado por base. | Nao (referencia) |');
    L.push('');
    L.push('> Esses tres arquivos sao **reescritos a cada execucao** do delp-docgen.');
    L.push('> Nao edite. Qualquer outro arquivo com outro nome e preservado e lido');
    L.push('> como esquema.');
    L.push('');
    L.push('Pasta que o portal le (salve aqui):');
    L.push('');
    L.push('```');
    L.push(String((modelo.esquemaBanco && modelo.esquemaBanco.pasta) || '').replace(/\\/g, '/'));
    L.push('```');
    L.push('');
    L.push('O portal passa a exibir essas tabelas como **declarado (banco)**, com tipos,');
    L.push('nulidade, chaves primarias, a **base em que cada uma vive** e — o mais');
    L.push('importante — os **relacionamentos reais** vindos das foreign keys, em vez de');
    L.push('relacoes adivinhadas por sufixo `_ID`.');
    L.push('');
    return L.join('\r\n');
}

/* --------------------------------------------------------------------- gravar */
function gravar(dir, modelo, lidos) {
    var escritos = [];
    try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
    var pares = [
        ['00-LEIA-ME.md', leiaMe(modelo, lidos)],
        ['01-extrair-esquema.sql', scriptExtracao(modelo)],
        ['02-ddl-inferido.sql', ddlInferido(modelo)],
        ['03-esquema-consolidado.sql', consolidado(modelo)]
    ];
    pares.forEach(function (p) {
        try {
            fs.writeFileSync(path.join(dir, p[0]), p[1], 'utf8');
            escritos.push(p[0]);
        } catch (e) {}
    });
    return escritos;
}

module.exports = {
    NOME_PASTA: NOME_PASTA,
    GERADOS: GERADOS,
    pasta: pasta,
    legado: legado,
    perdidos: perdidos,
    ler: ler,
    gravar: gravar,
    scriptExtracao: scriptExtracao,
    ddlInferido: ddlInferido,
    consolidado: consolidado,
    leiaMe: leiaMe
};
