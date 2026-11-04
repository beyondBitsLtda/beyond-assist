"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { EditorState, Compartment, EditorSelection } from "@codemirror/state";
import {
  EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor,
  rectangularSelection, crosshairCursor, highlightSpecialChars, highlightWhitespace, placeholder as dica,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab, undo, redo, indentMore, indentLess } from "@codemirror/commands";
import { indentOnInput, bracketMatching, foldGutter, foldKeymap, syntaxHighlighting, indentUnit } from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap } from "@codemirror/autocomplete";
import { searchKeymap, highlightSelectionMatches, openSearchPanel, search } from "@codemirror/search";
import { classHighlighter } from "@lezer/highlight";
import { carregarLinguagem } from "../codigo/linguagens.js";

/**
 * O editor do caderno (25/10/2026): "tipo Notepad++, com identificação de sintaxe".
 *
 * Números de linha, cor pela linguagem da página (Markdown colore também os blocos ```js de
 * dentro), quebra de linha que liga e desliga, tamanho da letra, espaços visíveis, várias
 * seleções (Ctrl+clique, Alt+arrastar em coluna), dobrar blocos, buscar e substituir (Ctrl+F,
 * Ctrl+H), desfazer/refazer e Ctrl+S para gravar na hora. As cores são as mesmas classes tok-* do
 * editor da prática.
 *
 * Um editor por aba: cada página aberta guarda o próprio histórico de desfazer.
 */
// Texto corrido (Markdown, texto puro) ganha o corretor e a maiúscula no começo da frase do teclado do
// celular; código fica sem eles (o corretor trocaria "def" por "de").
const ehProsa = (linguagem) => linguagem === "markdown" || linguagem === "texto";
const atributosDa = (linguagem) => EditorView.contentAttributes.of(ehProsa(linguagem)
  ? { spellcheck: "true", autocorrect: "on", autocapitalize: "sentences" }
  : { spellcheck: "false", autocorrect: "off", autocapitalize: "off" });

const EditorDoCaderno = forwardRef(function EditorDoCaderno(
  { valor, aoMudar, linguagem, quebrarLinha = true, tamanhoDaLetra = 15, espacosVisiveis = false, somenteLeitura = false, semMargem = false, aoGravar, aoCursor, rotulo = "Página do caderno" },
  ref,
) {
  const caixa = useRef(null);
  const vista = useRef(null);
  const travas = useRef({ linguagem: new Compartment(), quebra: new Compartment(), espacos: new Compartment(), leitura: new Compartment(), letra: new Compartment(), atributos: new Compartment(), margem: new Compartment() });
  const ultimo = useRef({ aoMudar, aoGravar, aoCursor });
  ultimo.current = { aoMudar, aoGravar, aoCursor };

  useImperativeHandle(ref, () => ({
    focar: () => vista.current?.focus(),
    buscar: () => { if (vista.current) openSearchPanel(vista.current); },
    irParaLinha: (n) => {
      const v = vista.current;
      if (!v) return;
      const linha = v.state.doc.line(Math.min(Math.max(1, n), v.state.doc.lines));
      v.dispatch({ selection: EditorSelection.cursor(linha.from), effects: EditorView.scrollIntoView(linha.from, { y: "center" }) });
      v.focus();
    },
    inserir: (texto) => {
      const v = vista.current;
      if (!v) return;
      v.dispatch(v.state.replaceSelection(texto));
      v.focus();
    },
    // a barra de atalhos do celular (Atalhos.js): o que o teclado virtual não tem à mão
    /** Põe `antes` e `depois` em volta de cada seleção (sem seleção, em volta do `exemplo`, que fica selecionado). */
    envolver: (antes, depois = "", exemplo = "") => {
      const v = vista.current;
      if (!v) return;
      v.dispatch(v.state.changeByRange((r) => {
        const miolo = v.state.sliceDoc(r.from, r.to) || exemplo;
        const inicio = r.from + antes.length;
        return { changes: { from: r.from, to: r.to, insert: antes + miolo + depois }, range: EditorSelection.range(inicio, inicio + miolo.length) };
      }), { scrollIntoView: true, userEvent: "input" });
      v.focus();
    },
    /** Liga e desliga um começo de linha (# título, - lista, > citação) em todas as linhas da seleção. */
    prefixar: (prefixo) => {
      const v = vista.current;
      if (!v) return;
      const { state } = v;
      const numeros = new Set();
      for (const r of state.selection.ranges) {
        for (let n = state.doc.lineAt(r.from).number; n <= state.doc.lineAt(r.to).number; n++) numeros.add(n);
      }
      const linhas = [...numeros].map((n) => state.doc.line(n));
      const todasTem = linhas.every((l) => l.text.startsWith(prefixo));
      v.dispatch({
        changes: linhas.map((l) => (todasTem ? { from: l.from, to: l.from + prefixo.length } : { from: l.from, insert: prefixo })),
        scrollIntoView: true, userEvent: "input",
      });
      v.focus();
    },
    /** desfazer, refazer, recuar, desrecuar */
    comando: (nome) => {
      const v = vista.current;
      const fazer = { desfazer: undo, refazer: redo, recuar: indentMore, desrecuar: indentLess }[nome];
      if (!v || !fazer) return;
      fazer(v);
      v.focus();
    },
  }), []);

  useEffect(() => {
    const t = travas.current;
    const avisarCursor = (state) => {
      const pos = state.selection.main.head;
      const linha = state.doc.lineAt(pos);
      const selecionados = state.selection.ranges.reduce((s, r) => s + (r.to - r.from), 0);
      ultimo.current.aoCursor?.({ linha: linha.number, coluna: pos - linha.from + 1, selecionados });
    };
    const view = new EditorView({
      parent: caixa.current,
      state: EditorState.create({
        doc: valor || "",
        extensions: [
          // a margem (números de linha e dobras) sai no celular, nas páginas de texto: é espaço de escrever
          t.margem.of(semMargem ? [] : [lineNumbers(), highlightActiveLineGutter(), foldGutter()]),
          highlightSpecialChars(),
          history(),
          drawSelection(),
          dropCursor(),
          EditorState.allowMultipleSelections.of(true),
          indentOnInput(),
          indentUnit.of("  "),
          syntaxHighlighting(classHighlighter),
          bracketMatching(),
          closeBrackets(),
          autocompletion(),
          rectangularSelection(),
          crosshairCursor(),
          highlightActiveLine(),
          highlightSelectionMatches(),
          search({ top: true }),
          dica("Escreva aqui… (Markdown: # título, - lista, ```js para código)"),
          keymap.of([
            { key: "Mod-s", preventDefault: true, run: () => { ultimo.current.aoGravar?.(); return true; } },
            { key: "Mod-h", preventDefault: true, run: (v) => openSearchPanel(v) },
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...searchKeymap,
            ...historyKeymap,
            ...foldKeymap,
            ...completionKeymap,
            indentWithTab,
          ]),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) ultimo.current.aoMudar?.(u.state.doc.toString());
            if (u.docChanged || u.selectionSet) avisarCursor(u.state);
          }),
          EditorView.contentAttributes.of({ "aria-label": rotulo }),
          t.atributos.of(atributosDa(linguagem)),
          t.linguagem.of([]),
          t.quebra.of(quebrarLinha ? EditorView.lineWrapping : []),
          t.espacos.of(espacosVisiveis ? highlightWhitespace() : []),
          t.letra.of(EditorView.theme({ "&": { fontSize: `${tamanhoDaLetra}px` } })),
          t.leitura.of([EditorState.readOnly.of(Boolean(somenteLeitura)), EditorView.editable.of(!somenteLeitura)]),
        ],
      }),
    });
    vista.current = view;
    avisarCursor(view.state);
    return () => { view.destroy(); vista.current = null; };
    // nasce uma vez por aba; o resto entra pelos efeitos abaixo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let vivo = true;
    vista.current?.dispatch({ effects: travas.current.atributos.reconfigure(atributosDa(linguagem)) });
    const chave = linguagem === "texto" ? null : linguagem;
    (chave ? carregarLinguagem(chave) : Promise.resolve(null)).then((lang) => {
      if (vivo && vista.current) vista.current.dispatch({ effects: travas.current.linguagem.reconfigure(lang || []) });
    });
    return () => { vivo = false; };
  }, [linguagem]);

  useEffect(() => {
    vista.current?.dispatch({ effects: travas.current.quebra.reconfigure(quebrarLinha ? EditorView.lineWrapping : []) });
  }, [quebrarLinha]);
  useEffect(() => {
    vista.current?.dispatch({ effects: travas.current.margem.reconfigure(semMargem ? [] : [lineNumbers(), highlightActiveLineGutter(), foldGutter()]) });
  }, [semMargem]);
  useEffect(() => {
    vista.current?.dispatch({ effects: travas.current.espacos.reconfigure(espacosVisiveis ? highlightWhitespace() : []) });
  }, [espacosVisiveis]);
  useEffect(() => {
    vista.current?.dispatch({ effects: travas.current.letra.reconfigure(EditorView.theme({ "&": { fontSize: `${tamanhoDaLetra}px` } })) });
  }, [tamanhoDaLetra]);
  useEffect(() => {
    vista.current?.dispatch({
      effects: travas.current.leitura.reconfigure([EditorState.readOnly.of(Boolean(somenteLeitura)), EditorView.editable.of(!somenteLeitura)]),
    });
  }, [somenteLeitura]);

  // conteúdo trocado de fora (a página foi recarregada do servidor)
  useEffect(() => {
    const v = vista.current;
    if (v && (valor || "") !== v.state.doc.toString()) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: valor || "" } });
    }
  }, [valor]);

  return <div ref={caixa} className="pf-editor cd-editor" />;
});

export default EditorDoCaderno;
