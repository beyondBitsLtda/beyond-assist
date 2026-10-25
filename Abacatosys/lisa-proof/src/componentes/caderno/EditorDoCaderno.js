"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { EditorState, Compartment, EditorSelection } from "@codemirror/state";
import {
  EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor,
  rectangularSelection, crosshairCursor, highlightSpecialChars, highlightWhitespace, placeholder as dica,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
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
const EditorDoCaderno = forwardRef(function EditorDoCaderno(
  { valor, aoMudar, linguagem, quebrarLinha = true, tamanhoDaLetra = 15, espacosVisiveis = false, somenteLeitura = false, aoGravar, aoCursor, rotulo = "Página do caderno" },
  ref,
) {
  const caixa = useRef(null);
  const vista = useRef(null);
  const travas = useRef({ linguagem: new Compartment(), quebra: new Compartment(), espacos: new Compartment(), leitura: new Compartment(), letra: new Compartment() });
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
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightSpecialChars(),
          history(),
          foldGutter(),
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
          EditorView.contentAttributes.of({ "aria-label": rotulo, spellcheck: "false", autocorrect: "off", autocapitalize: "off" }),
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
