-- 232_encaminhamento_profissional_recomendado.sql
-- Cartão 1427 (vídeo 23/11, 03:10-03:49): no Encaminhamento, a especialidade aceita
-- "Qualquer especialidade" e, logo abaixo, o campo "Profissional recomendado" para
-- escolher um especialista da clínica ou deixar "À escolha do paciente".
-- Vale para o modelo da clínica (todas as unidades) e para os modelos pessoais já salvos.
-- Idempotente: só mexe no modelo que ainda não tem o campo novo.

create or replace function public._enc_1427_secoes(secoes jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(jsonb_agg(item order by ord, sub), '[]'::jsonb)
  from (
    select e.ord, 0 as sub,
      case
        when e.secao->>'label' = 'Especialidade de destino' and not (e.secao ? 'opcoes')
          then e.secao || '{"opcoes": ["Qualquer especialidade"]}'::jsonb
        else e.secao
      end as item
    from jsonb_array_elements(secoes) with ordinality as e(secao, ord)
    union all
    select e.ord, 1,
      '{"tipo": "campo_texto", "label": "Profissional recomendado", "opcoes": ["À escolha do paciente"], "opcoes_profissionais": true, "valor_padrao": "À escolha do paciente"}'::jsonb
    from jsonb_array_elements(secoes) with ordinality as e(secao, ord)
    where e.secao->>'label' = 'Especialidade de destino'
  ) t
$$;

update public.documento_templates
set conteudo = jsonb_set(conteudo, '{secoes}', public._enc_1427_secoes(conteudo->'secoes')),
    updated_at = now()
where slug = 'encaminhamento'
  and jsonb_typeof(conteudo->'secoes') = 'array'
  and not exists (select 1 from jsonb_array_elements(conteudo->'secoes') s where s->>'label' = 'Profissional recomendado')
  and exists (select 1 from jsonb_array_elements(conteudo->'secoes') s where s->>'label' = 'Especialidade de destino');

update public.documento_modelos_pessoais
set conteudo = jsonb_set(conteudo, '{secoes}', public._enc_1427_secoes(conteudo->'secoes')),
    updated_at = now()
where slug = 'encaminhamento'
  and jsonb_typeof(conteudo->'secoes') = 'array'
  and not exists (select 1 from jsonb_array_elements(conteudo->'secoes') s where s->>'label' = 'Profissional recomendado')
  and exists (select 1 from jsonb_array_elements(conteudo->'secoes') s where s->>'label' = 'Especialidade de destino');

drop function public._enc_1427_secoes(jsonb);
