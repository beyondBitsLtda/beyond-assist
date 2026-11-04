-- 025 — o reino cobra e grava num passo só (03/11/2026).
--
-- Até aqui, toda compra do reino eram dois pedidos ao banco: lançar a cobrança no livro-caixa e,
-- depois, gravar o reino "onde versao = a que eu li". Se o pedido morria entre os dois (o celular
-- saiu da tela e o Worker foi cancelado), a cobrança ficava e a melhoria não: em 30/10 uma Mina de
-- Ouro nível 2 foi paga e o reino continuou no nível 1. A função abaixo faz os dois na mesma
-- transação: ou grava o reino E lança as moedas, ou não faz nada (e devolve false se a versão mudou).
--
-- Vale para os dois mundos: p_teste escolhe as tabelas gêmeas do Reino de Teste (db/016).
-- E o tipo 'estorno' no livro-caixa: a devolução de uma cobrança que não virou nada.
-- Pode rodar duas vezes.

alter table public.proof_reino_movimentos drop constraint if exists proof_reino_movimentos_tipo_check;
alter table public.proof_reino_movimentos add constraint proof_reino_movimentos_tipo_check
  check (tipo in ('construcao', 'neuro', 'coleta', 'saque_ganho', 'saque_perdido', 'vale', 'treino', 'personagem', 'expedicao', 'paz_expedicao',
                  'veiculo', 'combustivel', 'operario', 'ouro', 'aluguel_pago', 'aluguel_recebido', 'bolsa_compra', 'bolsa_venda', 'bolsa_resgate',
                  'teste', 'dominio', 'acervo', 'acervo_revisao', 'gorjeta_dada', 'gorjeta_recebida', 'mercado_compra', 'mercado_venda', 'estorno'));

alter table public.proof_teste_reino_movimentos drop constraint if exists proof_reino_movimentos_tipo_check;
alter table public.proof_teste_reino_movimentos drop constraint if exists proof_teste_reino_movimentos_tipo_check;
alter table public.proof_teste_reino_movimentos add constraint proof_teste_reino_movimentos_tipo_check
  check (tipo in ('construcao', 'neuro', 'coleta', 'saque_ganho', 'saque_perdido', 'vale', 'treino', 'personagem', 'expedicao', 'paz_expedicao',
                  'veiculo', 'combustivel', 'operario', 'ouro', 'aluguel_pago', 'aluguel_recebido', 'bolsa_compra', 'bolsa_venda', 'bolsa_resgate',
                  'teste', 'dominio', 'acervo', 'acervo_revisao', 'gorjeta_dada', 'gorjeta_recebida', 'mercado_compra', 'mercado_venda', 'estorno'));

-- p_mudancas: as colunas do reino que mudam ({"construcoes": {...}, "coletado_em": "..."}).
-- p_lancamentos: [{"tipo": "construcao", "valor": -250, "detalhe": {...}}, ...].
create or replace function public.proof_lancar_e_gravar(
  p_teste boolean, p_usuario uuid, p_versao integer, p_mudancas jsonb, p_lancamentos jsonb
) returns boolean
language plpgsql
set search_path = public
as $$
declare
  t_reino text := case when p_teste then 'proof_teste_reinos' else 'proof_reinos' end;
  t_livro text := case when p_teste then 'proof_teste_reino_movimentos' else 'proof_reino_movimentos' end;
  campos text := '';
  campo text;
  gravou integer;
begin
  for campo in select jsonb_object_keys(coalesce(p_mudancas, '{}'::jsonb)) loop
    if campo in ('usuario_id', 'versao', 'criado_em', 'atualizado_em') then
      raise exception 'proof_lancar_e_gravar: o campo % não muda por aqui', campo;
    end if;
    campos := campos || format('%I = m.%I, ', campo, campo);
  end loop;

  execute format(
    'update public.%I r set %s versao = r.versao + 1, atualizado_em = now()
       from jsonb_populate_record(null::public.%I, $1) m
      where r.usuario_id = $2 and r.versao = $3',
    t_reino, campos, t_reino)
  using coalesce(p_mudancas, '{}'::jsonb), p_usuario, p_versao;
  get diagnostics gravou = row_count;
  if gravou <> 1 then
    return false;
  end if;

  execute format(
    'insert into public.%I (usuario_id, tipo, valor, detalhe)
     select $1, l->>''tipo'', (l->>''valor'')::numeric, coalesce(l->''detalhe'', ''{}''::jsonb)
       from jsonb_array_elements($2) l',
    t_livro)
  using p_usuario, coalesce(p_lancamentos, '[]'::jsonb);
  return true;
end;
$$;

-- Só o servidor (chave de serviço) chama; o navegador nunca.
revoke all on function public.proof_lancar_e_gravar(boolean, uuid, integer, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.proof_lancar_e_gravar(boolean, uuid, integer, jsonb, jsonb) to service_role;

-- a API enxerga a função nova na hora
notify pgrst, 'reload schema';
