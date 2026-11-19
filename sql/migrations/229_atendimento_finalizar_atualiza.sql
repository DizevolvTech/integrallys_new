-- 229: finalizar de novo o mesmo atendimento (cartao #1073, rodada D40) atualiza o registro em vez de
-- devolver o primeiro sem mudar nada: anamnese, prontuario e evolucao sao atualizados; a prescricao
-- Pendente e refeita com os itens atuais (ou criada, se nao havia); a ja convertida em venda nao muda.
-- Continua sem duplicar (uma linha por agendamento + trava consultiva). Idempotente (create or replace).

create or replace function public.atendimento_finalizar(
  p_agendamento_id uuid,
  p_profissional_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ag record;
  v_fin record;
  v_reconsulta boolean := coalesce(p_payload #>> '{anamnese,tipo}', '') = 'reconsulta';
  v_anamnese jsonb := coalesce(p_payload -> 'anamnese', '{}'::jsonb);
  v_queixa text;
  v_evolucao text := nullif(btrim(coalesce(p_payload ->> 'evolucao', '')), '');
  v_anamnese_id uuid;
  v_prontuario_id uuid;
  v_evolucao_id uuid;
  v_prescricao_id uuid;
  v_itens jsonb := coalesce(p_payload #> '{prescricao,itens}', '[]'::jsonb);
  v_total numeric := 0;
  v_docs integer := 0;
  v_doc jsonb;
  v_template uuid;
  v_base text;
  v_ja boolean := false;
  v_presc_status text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_agendamento_id::text, 1073));

  select id, paciente_id, unidade_id into v_ag from agendamentos where id = p_agendamento_id;
  if not found or v_ag.paciente_id is null then
    return jsonb_build_object('ok', false, 'code', 'AGENDAMENTO_NOT_FOUND', 'message', 'Agendamento não encontrado');
  end if;

  select * into v_fin from atendimento_finalizacoes where agendamento_id = p_agendamento_id;
  v_ja := found;
  if v_ja then
    v_anamnese_id := v_fin.anamnese_id;
    v_prontuario_id := v_fin.prontuario_id;
    v_evolucao_id := v_fin.evolucao_id;
    v_prescricao_id := v_fin.prescricao_id;
  end if;

  v_queixa := coalesce(
    nullif(btrim(v_anamnese ->> 'queixa'), ''),
    nullif(btrim(v_anamnese #>> '{camposExtras,avaliacao_cliente}'), ''),
    'Não informada');

  if v_anamnese_id is not null and exists (select 1 from anamneses where id = v_anamnese_id) then
    update anamneses set
      tipo = case when v_reconsulta then 'Reconsulta' else 'Consulta' end,
      queixa = v_queixa,
      peso = nullif(replace(btrim(coalesce(v_anamnese ->> 'peso', '')), ',', '.'), '')::numeric,
      altura = nullif(replace(btrim(coalesce(v_anamnese ->> 'altura', '')), ',', '.'), '')::numeric,
      campos_extras = coalesce(v_anamnese -> 'camposExtras', '{}'::jsonb)
    where id = v_anamnese_id;
  else
    insert into anamneses (paciente_id, profissional_id, data_anamnese, tipo, queixa, peso, altura, imc, campos_extras)
    values (
      v_ag.paciente_id, p_profissional_id, v_hoje,
      case when v_reconsulta then 'Reconsulta' else 'Consulta' end,
      v_queixa,
      nullif(replace(btrim(coalesce(v_anamnese ->> 'peso', '')), ',', '.'), '')::numeric,
      nullif(replace(btrim(coalesce(v_anamnese ->> 'altura', '')), ',', '.'), '')::numeric,
      null,
      coalesce(v_anamnese -> 'camposExtras', '{}'::jsonb))
    returning id into v_anamnese_id;
  end if;

  if v_prontuario_id is not null and exists (select 1 from prontuarios where id = v_prontuario_id) then
    update prontuarios set
      tipo = case when v_reconsulta then 'Retorno' else 'Consulta' end,
      conteudo = coalesce(p_payload -> 'prontuario', '{}'::jsonb)
        || jsonb_build_object('agendamentoId', p_agendamento_id, 'origem', 'atendimento')
    where id = v_prontuario_id;
  else
    insert into prontuarios (paciente_id, profissional_id, data_registro, tipo, status, conteudo)
    values (v_ag.paciente_id, p_profissional_id, v_hoje,
      case when v_reconsulta then 'Retorno' else 'Consulta' end, 'Fechado',
      coalesce(p_payload -> 'prontuario', '{}'::jsonb)
        || jsonb_build_object('agendamentoId', p_agendamento_id, 'origem', 'atendimento'))
    returning id into v_prontuario_id;
  end if;

  if v_evolucao is not null and v_evolucao_id is not null and exists (select 1 from evolucoes where id = v_evolucao_id) then
    update evolucoes set resumo = v_evolucao,
      tipo = case when v_reconsulta then 'Reavaliação' else 'Acompanhamento' end
    where id = v_evolucao_id;
  elsif v_evolucao is not null then
    insert into evolucoes (paciente_id, profissional_id, data_evolucao, tipo, resumo)
    values (v_ag.paciente_id, p_profissional_id, v_hoje,
      case when v_reconsulta then 'Reavaliação' else 'Acompanhamento' end, v_evolucao)
    returning id into v_evolucao_id;
  end if;

  if v_prescricao_id is not null then
    select status into v_presc_status from prescricoes where id = v_prescricao_id;
    if not found then v_prescricao_id := null; end if;
  end if;

  -- Prescricao ja convertida em venda nao muda; pendente e refeita com os itens atuais.
  if v_prescricao_id is not null and v_presc_status is distinct from 'Pendente' then
    null;
  elsif jsonb_typeof(v_itens) = 'array' and jsonb_array_length(v_itens) > 0 then
    if v_prescricao_id is not null then
      delete from prescricao_itens where prescricao_id = v_prescricao_id;
      update prescricoes set observacoes = nullif(btrim(coalesce(p_payload #>> '{prescricao,observacoes}', '')), '')
        where id = v_prescricao_id;
    else
    insert into prescricoes (paciente_id, profissional_id, numero, status, tipo, valor_total, data_prescricao, validade, observacoes)
    values (v_ag.paciente_id, p_profissional_id,
      'PRESC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
      'Pendente', 'Prescrição', 0, v_hoje, v_hoje + 30,
      nullif(btrim(coalesce(p_payload #>> '{prescricao,observacoes}', '')), ''))
    returning id into v_prescricao_id;
    end if;

    insert into prescricao_itens (prescricao_id, produto_id, descricao, quantidade, valor_unitario, custo_unitario, posologia)
    select v_prescricao_id, pe.id,
      coalesce(nullif(btrim(i ->> 'descricao'), ''), pe.nome),
      greatest(coalesce((i ->> 'quantidade')::int, 1), 1),
      pe.preco_venda, pe.preco_custo,
      nullif(btrim(coalesce(i ->> 'posologia', '')), '')
    from jsonb_array_elements(v_itens) i
    left join produtos_estoque pe on pe.id = nullif(i ->> 'produtoId', '')::uuid;

    select coalesce(sum(quantidade * coalesce(valor_unitario, 0)), 0) into v_total
      from prescricao_itens where prescricao_id = v_prescricao_id;
    update prescricoes set valor_total = v_total, valor_bruto = v_total where id = v_prescricao_id;
  end if;

  -- Documentos do atendimento: grava o que ainda nao foi emitido (Gerar documento ja grava o seu).
  for v_doc in select * from jsonb_array_elements(coalesce(p_payload -> 'documentos', '[]'::jsonb)) loop
    v_base := case v_doc ->> 'tipo'
      when 'atestado' then 'declaracao' when 'declaracao' then 'declaracao'
      when 'dieta' then 'dieta' when 'encaminhamento' then 'encaminhamento' when 'laudo' then 'laudo'
      when 'fototerapy' then 'procedimento' when 'biomodular' then 'procedimento'
      else null end;
    continue when v_base is null;
    select id into v_template from documento_templates
      where unidade_id = v_ag.unidade_id and ativo and tipo = v_base
        and (v_base <> 'procedimento'
             or nome ilike case v_doc ->> 'tipo' when 'fototerapy' then 'Fototerapy%' else 'Biomodulador%' end)
      order by (nome not ilike '%em branco%') desc, created_at limit 1;
    continue when v_template is null;
    continue when exists (select 1 from documentos_gerados
      where agendamento_id = p_agendamento_id and template_id = v_template);
    insert into documentos_gerados (template_id, agendamento_id, paciente_id, profissional_id, conteudo_preenchido, gerado_por)
    values (v_template, p_agendamento_id, v_ag.paciente_id, p_profissional_id,
      jsonb_build_object('cabecalho', jsonb_build_object('titulo', coalesce(v_doc ->> 'titulo', 'Documento')),
                         'texto', coalesce(v_doc ->> 'texto', ''), 'origem', 'atendimento'),
      p_profissional_id);
    v_docs := v_docs + 1;
  end loop;

  insert into atendimento_finalizacoes (agendamento_id, paciente_id, profissional_id, anamnese_id, prontuario_id, evolucao_id, prescricao_id)
  values (p_agendamento_id, v_ag.paciente_id, p_profissional_id, v_anamnese_id, v_prontuario_id, v_evolucao_id, v_prescricao_id)
  on conflict (agendamento_id) do update set
    anamnese_id = excluded.anamnese_id, prontuario_id = excluded.prontuario_id,
    evolucao_id = excluded.evolucao_id, prescricao_id = excluded.prescricao_id;

  return jsonb_build_object('ok', true, 'jaSalvo', v_ja,
    'anamneseId', v_anamnese_id, 'prontuarioId', v_prontuario_id, 'evolucaoId', v_evolucao_id,
    'prescricaoId', v_prescricao_id, 'documentos', v_docs);
end;
$$;

revoke all on function public.atendimento_finalizar(uuid, uuid, jsonb) from public;
grant execute on function public.atendimento_finalizar(uuid, uuid, jsonb) to service_role;
