/* =============================================================================
   highlight.js - Realce de sintaxe offline, no estilo VS Code (Dark+)
   -----------------------------------------------------------------------------
   Nao ha dependencia externa: o tokenizador roda no proprio navegador, embutido
   no HTML. A funcao 'runtime' abaixo e serializada com Function.toString() e
   injetada na pagina - por isso ela precisa ser AUTOCONTIDA (nada de fechar
   sobre variaveis deste modulo).

   Estrategia: uma unica regex alternada por linguagem, varrida com lastIndex.
   Cada regra usa SOMENTE grupos nao-capturantes, senao os indices quebram.
============================================================================= */
'use strict';

/* --------------------------------------------------------- runtime (client) */
function runtime() {
    var LINGUAS = {};

    /* --- JavaScript ------------------------------------------------------- */
    LINGUAS.js = [
        ['com', '/\\*[\\s\\S]*?\\*/|//[^\\n]*'],
        ['str', '`(?:\\\\[\\s\\S]|[^`\\\\])*`|\'(?:\\\\[\\s\\S]|[^\'\\\\\\n])*\'|"(?:\\\\[\\s\\S]|[^"\\\\\\n])*"'],
        ['num', '\\b0[xX][0-9a-fA-F]+\\b|\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b'],
        ['ctl', '\\b(?:return|if|else|for|while|switch|case|default|break|continue|do|throw|try|catch|finally|yield|await)\\b'],
        ['kw', '\\b(?:var|let|const|function|new|delete|typeof|instanceof|in|of|void|this|class|extends|super|static|import|export|from|as)\\b'],
        ['lit', '\\b(?:true|false|null|undefined|NaN|Infinity)\\b'],
        ['dotfn', '\\.[A-Za-z_$][\\w$]*(?=\\s*\\()'],
        ['dotprop', '\\.[A-Za-z_$][\\w$]*'],
        ['fn', '\\b[A-Za-z_$][\\w$]*(?=\\s*\\()'],
        ['typ', '\\b[A-Z][\\w$]*\\b'],
        ['op', '[=+\\-*/%<>!&|^~?:]+']
    ];

    /* --- SQL / T-SQL ------------------------------------------------------ */
    LINGUAS.sql = [
        ['com', '/\\*[\\s\\S]*?\\*/|--[^\\n]*'],
        ['str', '\'(?:\'\'|[^\'])*\''],
        ['brk', '\\[[^\\]\\n]*\\]'],
        ['var', '@@?[\\w]+|#{1,2}[\\w]+'],
        ['num', '\\b\\d+(?:\\.\\d+)?\\b'],
        ['ctl', '\\b(?:SELECT|INSERT|UPDATE|DELETE|MERGE|FROM|WHERE|GROUP|ORDER|HAVING|UNION|JOIN|INNER|LEFT|RIGHT|FULL|OUTER|CROSS|APPLY|ON|INTO|VALUES|SET|AS|CASE|WHEN|THEN|ELSE|END|BEGIN|COMMIT|ROLLBACK|IF|WHILE|RETURN|EXEC|EXECUTE|GO|WITH|OVER|PARTITION|BY|TOP|DISTINCT|OFFSET|FETCH|NEXT|ROWS|ONLY)\\b'],
        ['kw', '\\b(?:CREATE|ALTER|DROP|TABLE|VIEW|PROCEDURE|PROC|FUNCTION|INDEX|TRIGGER|CONSTRAINT|PRIMARY|FOREIGN|KEY|REFERENCES|UNIQUE|CHECK|DEFAULT|IDENTITY|NOT|NULL|AND|OR|IN|EXISTS|BETWEEN|LIKE|IS|ALL|ANY|SOME|ASC|DESC|DECLARE|NOCOUNT|CAST|CONVERT|COLLATE|ADD|COLUMN|SCHEMA|DATABASE|USE|TRUNCATE|GRANT|OUTPUT|STUFF|ISNULL|COALESCE)\\b'],
        ['typ', '\\b(?:INT|BIGINT|SMALLINT|TINYINT|BIT|DECIMAL|NUMERIC|MONEY|FLOAT|REAL|DATE|DATETIME|DATETIME2|SMALLDATETIME|TIME|CHAR|VARCHAR|NCHAR|NVARCHAR|TEXT|NTEXT|BINARY|VARBINARY|IMAGE|UNIQUEIDENTIFIER|XML|SYSNAME|MAX)\\b'],
        ['fn', '\\b[A-Za-z_][\\w]*(?=\\s*\\()'],
        ['op', '[=+\\-*/%<>!&|^~]+']
    ];

    /* --- CSS -------------------------------------------------------------- */
    LINGUAS.css = [
        ['com', '/\\*[\\s\\S]*?\\*/'],
        ['str', '\'(?:\\\\.|[^\'\\\\\\n])*\'|"(?:\\\\.|[^"\\\\\\n])*"'],
        ['ctl', '@[\\w-]+'],
        ['var', '--[\\w-]+'],
        ['num', '#[0-9a-fA-F]{3,8}\\b|\\b\\d+(?:\\.\\d+)?(?:px|em|rem|%|vh|vw|s|ms|deg|fr|pt|ch)?\\b'],
        ['prop', '[-a-zA-Z]+(?=\\s*:)'],
        ['sel', '\\.[-\\w]+|#[-\\w]+|::?[-a-z]+(?![\\w(])'],
        ['fn', '\\b[a-zA-Z-]+(?=\\()'],
        ['typ', '\\b[A-Z][\\w-]*\\b']
    ];

    /* --- HTML / XML / FreeMarker ------------------------------------------ */
    LINGUAS.html = [
        ['com', '<!--[\\s\\S]*?-->|<#--[\\s\\S]*?-->'],
        ['ctl', '</?[#@][\\w.]+(?:[^>]*)?>'],
        ['var', '[$]\\{[^}]*\\}'],
        ['str', '"(?:[^"\\\\\\n]|\\\\.)*"|\'(?:[^\'\\\\\\n]|\\\\.)*\''],
        ['tag', '</?[A-Za-z][\\w:-]*|/?>'],
        ['attr', '\\b[A-Za-z_:][-\\w:.]*(?=\\s*=)'],
        ['num', '\\b\\d+(?:\\.\\d+)?\\b']
    ];

    /* --- .properties / .info ---------------------------------------------- */
    LINGUAS.props = [
        ['com', '(?:^|\\n)[ \\t]*[#!][^\\n]*'],
        ['prop', '(?:^|\\n)[ \\t]*[^=:#!\\n]+(?=[=:])'],
        ['op', '[=:]'],
        ['num', '\\b\\d+(?:\\.\\d+)?\\b']
    ];

    /* --- Markdown --------------------------------------------------------- */
    LINGUAS.md = [
        ['com', '(?:^|\\n)>[^\\n]*'],
        ['ctl', '(?:^|\\n)#{1,6}[^\\n]*'],
        ['str', '```[\\s\\S]*?```|`[^`\\n]*`'],
        ['typ', '\\*\\*[^*\\n]+\\*\\*'],
        ['fn', '\\[[^\\]\\n]*\\]\\([^)\\n]*\\)'],
        ['prop', '(?:^|\\n)[ \\t]*[-*+|][ \\t]']
    ];

    var COMPILADO = {};
    function compilar(lang) {
        if (COMPILADO[lang]) return COMPILADO[lang];
        var regras = LINGUAS[lang];
        if (!regras) return null;
        var re = new RegExp(regras.map(function (r) { return '(' + r[1] + ')'; }).join('|'), 'g');
        COMPILADO[lang] = { re: re, regras: regras };
        return COMPILADO[lang];
    }

    function esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function realce(codigo, lang) {
        var c = compilar(lang);
        if (!c) return esc(codigo);
        var out = '', pos = 0, m;
        c.re.lastIndex = 0;
        while ((m = c.re.exec(codigo))) {
            if (m[0] === '') { c.re.lastIndex++; continue; }
            if (m.index > pos) out += esc(codigo.slice(pos, m.index));
            var gi = 1;
            while (gi < m.length && m[gi] === undefined) gi++;
            var cls = c.regras[gi - 1][0];
            var txt = m[0];
            /* o ponto de "obj.metodo" fica fora do span, como no VS Code */
            if ((cls === 'dotfn' || cls === 'dotprop') && txt.charAt(0) === '.') {
                out += '.';
                txt = txt.slice(1);
                cls = cls === 'dotfn' ? 'fn' : 'prop';
            }
            out += '<span class="t-' + cls + '">' + esc(txt) + '</span>';
            pos = c.re.lastIndex;
        }
        out += esc(codigo.slice(pos));
        return out;
    }

    function porExtensao(ext) {
        ext = String(ext || '').toLowerCase().replace(/^\./, '');
        if (ext === 'js' || ext === 'json' || ext === 'ts') return 'js';
        if (ext === 'sql') return 'sql';
        if (ext === 'css') return 'css';
        if (ext === 'html' || ext === 'htm' || ext === 'ftl' || ext === 'xml' ||
            ext === 'svg' || ext === 'process') return 'html';
        if (ext === 'properties' || ext === 'info' || ext === 'project') return 'props';
        if (ext === 'md') return 'md';
        return '';
    }

    window.dgHl = realce;
    window.dgLang = porExtensao;
}

/* --------------------------------------------------------------- exportacao */
function clientJs() {
    return '<script>(' + runtime.toString() + ')();</script>';
}

/* O MESMO tokenizador, rodando aqui no Node, em tempo de geracao.
   -----------------------------------------------------------------------------
   Antes o codigo-fonte ia para a pagina cru, dentro de um blob JSON, e era
   colorido pelo navegador. Isso deixou de servir quando o portal passou a ser
   lido dentro do visor do Abacato: la ele abre num <iframe sandbox=""> sem
   permissao nenhuma, o script nao roda, e a biblioteca de codigo aparecia VAZIA
   — sem erro, sem aviso, so um painel em branco.

   Colorir aqui resolve, e sem uma segunda copia do tokenizador: a funcao
   `runtime` acima ja e autocontida (foi escrita para ser serializada), entao
   basta dar a ela um `window` de mentira e pegar o que ela pendura la. Duas
   implementacoes do mesmo realce divergiriam na primeira correcao. */
var _realce = null;
function realcar(codigo, lang) {
    if (!_realce) {
        var janelaAnterior = globalThis.window;
        globalThis.window = globalThis.window || {};
        runtime();
        _realce = globalThis.window.dgHl;
        if (janelaAnterior === undefined) delete globalThis.window;
    }
    return _realce(String(codigo == null ? '' : codigo), lang || '');
}

/* Paleta VS Code Dark+ para os tokens. */
function css() {
    return [
        '.dg-vs{background:#1E1E1E;color:#D4D4D4}',
        '.dg-vs .t-com{color:#6A9955;font-style:italic}',
        '.dg-vs .t-str{color:#CE9178}',
        '.dg-vs .t-brk{color:#9CDCFE}',
        '.dg-vs .t-num{color:#B5CEA8}',
        '.dg-vs .t-ctl{color:#C586C0}',
        '.dg-vs .t-kw{color:#569CD6}',
        '.dg-vs .t-lit{color:#569CD6}',
        '.dg-vs .t-typ{color:#4EC9B0}',
        '.dg-vs .t-fn{color:#DCDCAA}',
        '.dg-vs .t-prop{color:#9CDCFE}',
        '.dg-vs .t-var{color:#9CDCFE}',
        '.dg-vs .t-tag{color:#569CD6}',
        '.dg-vs .t-attr{color:#9CDCFE}',
        '.dg-vs .t-sel{color:#D7BA7D}',
        '.dg-vs .t-op{color:#D4D4D4}'
    ].join('');
}

/* Mesma deteccao de linguagem, do lado do Node (para o modelo). */
function langDe(ext) {
    ext = String(ext || '').toLowerCase().replace(/^\./, '');
    if (ext === 'js' || ext === 'json' || ext === 'ts') return 'js';
    if (ext === 'sql') return 'sql';
    if (ext === 'css') return 'css';
    if (ext === 'html' || ext === 'htm' || ext === 'ftl' || ext === 'xml' ||
        ext === 'svg' || ext === 'process') return 'html';
    if (ext === 'properties' || ext === 'info' || ext === 'project') return 'props';
    if (ext === 'md') return 'md';
    return '';
}

module.exports = { clientJs: clientJs, css: css, langDe: langDe, realcar: realcar };
