import * as vscode from "vscode";

/**
 * O editor de texto que o usuário está realmente usando.
 *
 * `vscode.window.activeTextEditor` fica **undefined** quando o foco está num webview — e o
 * painel da Lisa Code É um webview. Ou seja: no exato momento em que ela mais precisa saber
 * qual arquivo você está mexendo, o VS Code responde "nenhum".
 *
 * Foi isso que fez o chip mostrar "nenhum arquivo" enquanto um index.html estava aberto ao
 * lado, e a Lisa pedir de volta o caminho do arquivo que ela deveria ter descoberto sozinha.
 *
 * A saída é lembrar do último editor de verdade e só esquecê-lo quando ele fecha. `undefined`
 * do VS Code passa a significar "o foco saiu do texto", que é o que ele realmente quer dizer.
 */
let ultimo: vscode.TextEditor | undefined;

export function registrarEditorAtual(): vscode.Disposable[] {
  ultimo = vscode.window.activeTextEditor;
  return [
    vscode.window.onDidChangeActiveTextEditor((ed) => {
      // Só atualiza quando há um editor DE VERDADE. O undefined aqui é o foco indo para o
      // painel da Lisa, não o arquivo tendo sido fechado.
      if (ed) ultimo = ed;
    }),
    vscode.workspace.onDidCloseTextDocument((doc) => {
      // Fechou o arquivo que estávamos lembrando: aí sim esquecer é o certo — continuar
      // apontando para um arquivo que não existe mais seria pior que não apontar para nada.
      if (ultimo && ultimo.document === doc) ultimo = undefined;
    }),
  ];
}

/** O editor ativo, ou o último que esteve ativo enquanto ele ainda estiver aberto. */
export function editorAtual(): vscode.TextEditor | undefined {
  const agora = vscode.window.activeTextEditor;
  if (agora) return agora;
  if (ultimo && !ultimo.document.isClosed) return ultimo;
  // Último recurso: qualquer editor visível. Acontece quando o painel abre já com o foco nele
  // e nenhuma troca de aba chegou a ser registrada.
  return vscode.window.visibleTextEditors[0];
}
