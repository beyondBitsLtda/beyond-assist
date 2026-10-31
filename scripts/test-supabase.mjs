// Importa o cliente Supabase exportado do módulo de conexão da aplicação
import { supabase } from "../src/lib/supabase.js";

// Função assíncrona que orquestra a checagem de variáveis e a consulta ao banco
async function main() {
  // 1. Tenta obter a URL do banco dando prioridade para a variável privada e usando a pública como fallback
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

  // 2. Tenta obter a chave de API, priorizando a service_role e usando a anon_key como fallback
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  // 3. Valida se ambas as credenciais existem antes de gastar rede tentando conectar
  if (!url || !key) {
    console.error("FALHA: Variáveis de ambiente do Supabase não foram encontradas.");
    process.exit(1); // Aborta o processo do Node apontando falha com código 1
  }

  try {
    // 4. Executa a leitura do primeiro registro da tabela 'documents' para testar a comunicação real
    const { data, error } = await supabase
      .from("documents")
      .select("id")
      .limit(1);

    // 5. Verifica se o Supabase retornou algum erro na resposta da consulta SQL
    if (error) {
      console.error("Falha ao realizar consulta na tabela 'documents':", error.message);
      process.exit(1); // Aborta com código de erro se a query falhar
    }

    // 6. Exibe a mensagem de sucesso no terminal se a consulta respondeu com êxito
    console.log("SUCESSO: Conexão com o Supabase estabelecida e consulta realizada!");
    process.exit(0); // Finaliza a execução do script indicando sucesso com código 0

  } catch (err) {
    // 7. Captura erros de execução do JavaScript ou falhas graves de conexão de rede
    console.error("FALHA: Exceção inesperada durante o teste de conexão:", err?.message || err);
    process.exit(1); // Aborta a execução em caso de exceção capturada
  }
}

// Invocação da função principal para rodar o teste
main();