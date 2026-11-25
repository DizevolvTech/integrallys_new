-- 240_documentos_layout_pagina.sql
-- #1645 W1: diagramação A4 por layout do documento (sem Enter no texto).
--  - Declaração de Comparecimento: layout 'pagina_centrada' (título no alto, corpo no meio, cidade/data abaixo, assinatura embaixo).
--  - Protocolos Biomodulador Infra-Red e Fototerapy: layout 'pagina_cheia' (fonte maior, ocupa a folha, 1 página).
-- Cobre o modelo da clínica (documento_templates, todas as unidades) E as cópias pessoais (documento_modelos_pessoais).
-- Idempotente: só grava quando o conteúdo ainda não tem "layout"; não mexe no texto.
update public.documento_templates
   set conteudo = jsonb_set(conteudo, '{layout}', to_jsonb(
         case when slug = 'declaracao_comparecimento' then 'pagina_centrada' else 'pagina_cheia' end::text), true)
 where slug in ('declaracao_comparecimento', 'procedimento_biomodulador', 'procedimento_fototerapy')
   and jsonb_typeof(conteudo) = 'object'
   and conteudo ? 'secoes'
   and not (conteudo ? 'layout');

update public.documento_modelos_pessoais
   set conteudo = jsonb_set(conteudo, '{layout}', to_jsonb(
         case when slug in ('declaracao', 'declaracao_comparecimento') then 'pagina_centrada' else 'pagina_cheia' end::text), true)
 where slug in ('declaracao', 'declaracao_comparecimento', 'biomodular', 'fototerapy', 'procedimento_biomodulador', 'procedimento_fototerapy')
   and jsonb_typeof(conteudo) = 'object'
   and conteudo ? 'secoes'
   and not (conteudo ? 'layout');
