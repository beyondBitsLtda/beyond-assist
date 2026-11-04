/* =========================================================================
   SyntaxHighlighter.js — REALCE DE SINTAXE DO BLOCO DE CÓDIGO
   -------------------------------------------------------------------------
   PAPEL NA ARQUITETURA
   Recebe um texto de código e uma linguagem e devolve HTML com cada pedaço
   ("token") dentro de um <span class="tk-..."> — o CSS pinta cada classe.
   Não depende de biblioteca nem de internet (o ProcessMap roda offline).

   COMO FUNCIONA (um "tokenizador" simples)
   Percorre o texto da esquerda para a direita e, em cada posição, pergunta
   na ordem: começa um comentário? uma string? um número? uma palavra?
   O primeiro "sim" consome aquele pedaço e o laço continua de onde parou.
   Palavras são comparadas com a lista de palavras-chave da linguagem; uma
   palavra seguida de "(" é tratada como chamada de função.

   CLASSES GERADAS
     tk-k palavra-chave   tk-s string     tk-c comentário   tk-n número
     tk-f função          tk-t tag (HTML) tk-a atributo     tk-p propriedade
     tk-v variável ($VAR, @param)

   SEGURANÇA: todo texto passa por esc() — o código é exibido, nunca executado.
   ========================================================================= */
window.PM = window.PM || {}; // namespace global do sistema

PM.SyntaxHighlighter = (function () {
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const set = (s) => new Set(s.split(/\s+/).filter(Boolean));

  const JS = 'break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof let new return super switch this throw try typeof var void while with yield async await of static get set null undefined true false';
  // Cada linguagem: rótulo, palavras-chave, comentários e delimitadores de string.
  const LANGS = {
    javascript: { label: 'JavaScript', kw: set(JS), line: ['//'], block: [['/*', '*/']], str: ['"', "'", '`'] },
    typescript: { label: 'TypeScript', kw: set(JS + ' interface type enum implements private public protected readonly declare namespace abstract as any number string boolean never unknown'), line: ['//'], block: [['/*', '*/']], str: ['"', "'", '`'] },
    java: { label: 'Java', kw: set('abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for if implements import instanceof int interface long native new package private protected public return short static super switch synchronized this throw throws transient try void volatile while true false null var record'), line: ['//'], block: [['/*', '*/']], str: ['"', "'"] },
    csharp: { label: 'C#', kw: set('abstract as base bool break byte case catch char class const continue decimal default delegate do double else enum event explicit extern false finally float for foreach if implicit in int interface internal is lock long namespace new null object operator out override params private protected public readonly ref return sealed short static string struct switch this throw true try typeof uint ulong using var virtual void while async await get set'), line: ['//'], block: [['/*', '*/']], str: ['"', "'"] },
    python: { label: 'Python', kw: set('and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield self print'), line: ['#'], block: [['"""', '"""'], ["'''", "'''"]], str: ['"', "'"] },
    sql: { label: 'SQL', ci: true, kw: set('select from where and or not insert into values update set delete create table alter drop index view join inner left right full outer cross on group by order having distinct as is null like in between exists union all case when then else end begin commit rollback transaction primary key foreign references default constraint top limit offset with declare exec execute procedure function returns return go use if while nvarchar varchar char int bigint smallint tinyint datetime datetime2 date bit decimal numeric float text identity count sum avg min max cast convert coalesce isnull getdate sysdatetime asc desc truncate merge output'), line: ['--'], block: [['/*', '*/']], str: ["'"] },
    html: { label: 'HTML / XML', markup: true },
    css: { label: 'CSS', kw: set('important media keyframes from to import'), line: [], block: [['/*', '*/']], str: ['"', "'"], css: true },
    json: { label: 'JSON', kw: set('true false null'), line: [], block: [], str: ['"'], json: true },
    bash: { label: 'Shell / Bash', kw: set('if then else elif fi for while until do done case esac function in return export local echo exit set unset source cd'), line: ['#'], block: [], str: ['"', "'"], vars: true },
    plain: { label: 'Texto puro', plain: true },
  };

  const span = (cls, t) => `<span class="tk-${cls}">${esc(t)}</span>`;

  // Tokenizador das linguagens "de código" (tudo menos HTML e texto puro).
  function code(src, L) {
    let out = '', i = 0;
    const n = src.length;
    const starts = (tok) => tok && src.startsWith(tok, i);
    while (i < n) {
      const ch = src[i];
      // comentário de bloco
      const b = (L.block || []).find((p) => starts(p[0]));
      if (b) { let j = src.indexOf(b[1], i + b[0].length); j = j < 0 ? n : j + b[1].length; out += span(L.str.includes(b[0][0]) ? 's' : 'c', src.slice(i, j)); i = j; continue; }
      // comentário de linha
      if ((L.line || []).some(starts)) { let j = src.indexOf('\n', i); if (j < 0) j = n; out += span('c', src.slice(i, j)); i = j; continue; }
      // string (respeita a barra invertida de escape)
      if (L.str.includes(ch)) {
        let j = i + 1;
        while (j < n && src[j] !== ch) { if (src[j] === '\\') j++; if (src[j] === '\n' && ch !== '`') break; j++; }
        j = Math.min(n, j + 1);
        const t = src.slice(i, j);
        // JSON: string seguida de ":" é CHAVE (propriedade), não valor
        const isKey = L.json && /^\s*:/.test(src.slice(j, j + 20));
        out += span(isKey ? 'p' : 's', t); i = j; continue;
      }
      // variável de shell ($HOME, ${X}) ou anotação (@Override)
      if ((L.vars && ch === '$') || (ch === '@' && !L.css)) {
        const m = /^[$@]\{?[A-Za-z_][\w]*\}?/.exec(src.slice(i));
        if (m) { out += span('v', m[0]); i += m[0].length; continue; }
      }
      // número (não pode estar grudado numa palavra: "x1" é identificador)
      if (/[0-9]/.test(ch) && !/[\w$]/.test(src[i - 1] || '')) {
        const m = /^(0x[0-9a-fA-F]+|\d+(\.\d+)?([eE][+-]?\d+)?)(px|em|rem|%|s|ms|vh|vw)?/.exec(src.slice(i));
        out += span('n', m[0]); i += m[0].length; continue;
      }
      // CSS: cor hexadecimal e propriedade (palavra antes de ":")
      if (L.css && ch === '#' && /^#[0-9a-fA-F]{3,8}\b/.test(src.slice(i))) { const m = /^#[0-9a-fA-F]{3,8}/.exec(src.slice(i)); out += span('n', m[0]); i += m[0].length; continue; }
      // palavra
      if (/[A-Za-z_$]/.test(ch) || (L.css && ch === '-')) {
        const m = (L.css ? /^-?[A-Za-z_][\w-]*/ : /^[A-Za-z_$][\w$]*/).exec(src.slice(i));
        if (m) {
          const w = m[0], after = src.slice(i + w.length);
          const kw = L.kw && L.kw.has(L.ci ? w.toLowerCase() : w);
          if (L.css && /^\s*:(?!:)/.test(after) && !/[{]/.test(after.split(/[;}]/)[0] || '')) out += span('p', w);
          else if (kw) out += span('k', w);
          else if (/^\s*\(/.test(after)) out += span('f', w);
          else out += esc(w);
          i += w.length; continue;
        }
      }
      out += esc(ch); i++;
    }
    return out;
  }

  // HTML / XML: comentários, tags, atributos e valores.
  function markup(src) {
    let out = '', i = 0;
    const n = src.length;
    while (i < n) {
      if (src.startsWith('<!--', i)) { let j = src.indexOf('-->', i); j = j < 0 ? n : j + 3; out += span('c', src.slice(i, j)); i = j; continue; }
      if (src[i] === '<' && /[A-Za-z/!?]/.test(src[i + 1] || '')) {
        const m = /^<\/?[!?]?[\w:.-]*/.exec(src.slice(i));
        out += span('t', m[0]); i += m[0].length;
        // dentro da tag: atributos até o ">"
        while (i < n && src[i] !== '>') {
          const a = /^[\w:.-]+/.exec(src.slice(i));
          if (a) { out += span('a', a[0]); i += a[0].length; continue; }
          if (src[i] === '"' || src[i] === "'") { const q = src[i]; let j = src.indexOf(q, i + 1); j = j < 0 ? n : j + 1; out += span('s', src.slice(i, j)); i = j; continue; }
          if (src[i] === '/' && src[i + 1] === '>') break;
          out += esc(src[i]); i++;
        }
        if (src[i] === '/' && src[i + 1] === '>') { out += span('t', '/>'); i += 2; } else if (src[i] === '>') { out += span('t', '>'); i++; }
        continue;
      }
      out += esc(src[i]); i++;
    }
    return out;
  }

  return {
    languages: LANGS,
    has(id) { return Object.prototype.hasOwnProperty.call(LANGS, id); },
    label(id) { return (LANGS[id] || LANGS.plain).label; },
    /** Devolve o HTML realçado (sempre escapado) */
    highlight(src, lang) {
      const L = LANGS[lang] || LANGS.javascript;
      src = String(src ?? '');
      if (L.plain) return esc(src);
      if (L.markup) return markup(src);
      return code(src, L);
    },
  };
})();
