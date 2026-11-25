-- 003_documento_templates.sql
-- Seed dos 9 templates clínicos base (IMPL_DOCUMENTOS_EDITAVEIS.md).
-- Popula 1 conjunto por unidade existente. Idempotente via
-- UNIQUE (unidade_id, slug) + ON CONFLICT DO NOTHING.
--
-- Estrutura do JSONB `conteudo`:
--   {
--     "cabecalho": { "titulo": string, "logo": bool },
--     "secoes":   [ { "tipo": string, ...campos específicos } ],
--     "rodape":   { "assinatura": bool, "dados_clinica": bool,
--                   "conselho": bool, "texto_fixo": string }
--   }
--
-- Tipos de seção suportados:
--   - "paragrafo"          → conteudo (texto livre, pode ter variáveis)
--   - "campo_data"         → label, valor_padrao
--   - "campo_texto"        → label, placeholder, obrigatorio, valor_padrao
--   - "campo_texto_longo"  → label, valor_padrao (textarea)
--   - "campo_numero"       → label
--   - "checklist"          → label, itens[{label,com_obs,obs_label}]
--   - "checkbox_lista"     → label, itens[string]  (lista simples de marcar)
--   - "checkbox_grupo"     → label, opcoes[string] (grupo de opções)
--
-- Variáveis reconhecidas pelo resolver:
--   #CLIENTE_NOME#, #CLIENTE_CPF#, #AGENDA_DATA_HORA#, #PROFISSIONAL_NOME#,
--   #PROFISSIONAL_CONSELHO#, #DATA_ATUAL#, #CLINICA_NOME#,
--   #CLINICA_CIDADE_UF#, #CLINICA_ENDERECO#, #CLINICA_CEP#, #CLINICA_TELEFONE#

begin;

insert into public.documento_templates
  (unidade_id, slug, nome, tipo, conteudo, editavel_pelo_especialista, disponivel_portal_paciente)
select u.id, t.slug, t.nome, t.tipo, t.conteudo::jsonb,
       t.editavel_pelo_especialista, t.disponivel_portal_paciente
from public.unidades u
cross join (values

  -- 1. ANAMNESE — 1ª CONSULTA
  ('anamnese_consulta', 'Anamnese (1ª consulta)', 'formulario', $json$
{
  "cabecalho": { "titulo": "ANAMNESE — 1ª CONSULTA", "logo": true },
  "secoes": [
    { "tipo": "campo_data", "label": "Data", "valor_padrao": "#DATA_ATUAL#" },
    { "tipo": "paragrafo", "conteudo": "Paciente: #CLIENTE_NOME#" },
    { "tipo": "campo_numero", "label": "Peso (kg)" },
    { "tipo": "campo_numero", "label": "Altura (m)" },
    { "tipo": "campo_texto_longo", "label": "QUEIXA PRINCIPAL" },
    { "tipo": "checklist", "label": "HISTÓRICOS DIÁRIOS", "itens": [
      { "label": "Tabagismo?", "com_obs": true, "obs_label": "Qual?" },
      { "label": "Etilismo?", "com_obs": true, "obs_label": "Qual?" },
      { "label": "Uso de drogas?", "com_obs": true, "obs_label": "Qual?" },
      { "label": "Atividade física?", "com_obs": true, "obs_label": "Qual?" },
      { "label": "Anticoncepcional?", "com_obs": true, "obs_label": "Qual?" },
      { "label": "Antidepressivo?", "com_obs": true, "obs_label": "Qual?" },
      { "label": "Ansiolítico?", "com_obs": true, "obs_label": "Qual?" },
      { "label": "Sonífero?", "com_obs": true, "obs_label": "Qual?" },
      { "label": "Diurético?", "com_obs": true, "obs_label": "Qual?" },
      { "label": "Insulina?", "com_obs": true, "obs_label": "Qual?" },
      { "label": "Hipertensivos?", "com_obs": true, "obs_label": "Qual?" },
      { "label": "Colesterol?", "com_obs": true, "obs_label": "Qual?" },
      { "label": "Triglicerídeos?", "com_obs": true, "obs_label": "Qual?" },
      { "label": "Tireoide?", "com_obs": true, "obs_label": "Qual?" },
      { "label": "Cirurgia?", "com_obs": true, "obs_label": "Qual?" },
      { "label": "Metal no corpo?", "com_obs": true, "obs_label": "Qual?" },
      { "label": "Câncer?", "com_obs": true, "obs_label": "Qual?" },
      { "label": "Histórico familiar de câncer?", "com_obs": true, "obs_label": "Qual?" }
    ]},
    { "tipo": "campo_texto_longo", "label": "DIAGNOSE" }
  ],
  "rodape": { "assinatura": true, "dados_clinica": true, "conselho": true }
}
  $json$, true, false),

  -- 2. ANAMNESE — RECONSULTA
  ('anamnese_reconsulta', 'Anamnese (Reconsulta)', 'formulario', $json$
{
  "cabecalho": { "titulo": "ANAMNESE — RECONSULTA", "logo": true },
  "secoes": [
    { "tipo": "campo_data", "label": "Data", "valor_padrao": "#DATA_ATUAL#" },
    { "tipo": "paragrafo", "conteudo": "Paciente: #CLIENTE_NOME#" },
    { "tipo": "campo_numero", "label": "Peso (kg)" },
    { "tipo": "campo_numero", "label": "Altura (m)" },
    { "tipo": "campo_texto_longo", "label": "AVALIAÇÃO DO CLIENTE" },
    { "tipo": "campo_texto_longo", "label": "RESULTADOS" },
    { "tipo": "campo_texto_longo", "label": "INDICAÇÃO PARA OS PRÓXIMOS TRATAMENTOS" }
  ],
  "rodape": { "assinatura": true, "dados_clinica": true, "conselho": true }
}
  $json$, true, false),

  -- 3. DECLARAÇÃO DE COMPARECIMENTO
  ('declaracao_comparecimento', 'Declaração de Comparecimento', 'declaracao', $json$
{
  "layout": "pagina_centrada",
  "cabecalho": { "titulo": "DECLARAÇÃO DE COMPARECIMENTO", "logo": true },
  "secoes": [
    { "tipo": "paragrafo", "conteudo": "Declaro, para os devidos fins, que o(a) Sr(a). #CLIENTE_NOME#, portador(a) do CPF nº #CLIENTE_CPF#, compareceu à #CLINICA_NOME# no dia #AGENDA_DATA_HORA# para atendimento profissional com #PROFISSIONAL_NOME#." },
    { "tipo": "paragrafo", "conteudo": "#CLINICA_CIDADE_UF#, #DATA_ATUAL#." }
  ],
  "rodape": { "assinatura": true, "dados_clinica": true, "conselho": true }
}
  $json$, true, true),

  -- 4. ENCAMINHAMENTO
  ('encaminhamento', 'Encaminhamento', 'encaminhamento', $json$
{
  "cabecalho": { "titulo": "ENCAMINHAMENTO", "logo": true },
  "secoes": [
    { "tipo": "paragrafo", "conteudo": "Encaminho o(a) paciente #CLIENTE_NOME# para avaliação e/ou tratamento em:" },
    { "tipo": "campo_texto", "label": "Especialidade de destino", "placeholder": "Ex.: Liberação Miofascial", "obrigatorio": true, "opcoes": ["Qualquer especialidade"] },
    { "tipo": "campo_texto", "label": "Profissional recomendado", "opcoes": ["À escolha do paciente"], "opcoes_profissionais": true, "valor_padrao": "À escolha do paciente" },
    { "tipo": "campo_texto_longo", "label": "Motivo do encaminhamento" },
    { "tipo": "paragrafo", "conteudo": "#CLINICA_CIDADE_UF#, #DATA_ATUAL#." }
  ],
  "rodape": { "assinatura": true, "dados_clinica": true, "conselho": true }
}
  $json$, true, true),

  -- 5. LAUDO (em branco)
  ('laudo', 'Laudo (em branco)', 'laudo', $json$
{
  "cabecalho": { "titulo": "LAUDO CLÍNICO", "logo": true },
  "secoes": [
    { "tipo": "paragrafo", "conteudo": "Paciente: #CLIENTE_NOME#  |  Data: #DATA_ATUAL#" },
    { "tipo": "campo_texto_longo", "label": "Exames" },
    { "tipo": "campo_texto_longo", "label": "Diagnose" },
    { "tipo": "campo_texto_longo", "label": "Possíveis causas" },
    { "tipo": "campo_texto_longo", "label": "Exames sugeridos" },
    { "tipo": "campo_texto_longo", "label": "Cuidados" },
    { "tipo": "campo_texto_longo", "label": "Tratamento sugerido" },
    { "tipo": "campo_texto_longo", "label": "Observações" }
  ],
  "rodape": {
    "assinatura": true,
    "dados_clinica": true,
    "conselho": true,
    "texto_fixo": "Objetivo do laudo descritivo é o esclarecimento de patologias e transtornos de ordem contínua. Este documento será somente fornecido, após avaliação e acompanhamento mensal de no mínimo 6 meses."
  }
}
  $json$, true, true),

  -- 6. LAUDO EDITÁVEL (texto base pré-preenchido)
  ('laudo_editavel', 'Laudo (com texto base)', 'laudo', $json$
{
  "cabecalho": { "titulo": "LAUDO CLÍNICO", "logo": true },
  "secoes": [
    { "tipo": "paragrafo", "conteudo": "Paciente: #CLIENTE_NOME#  |  Data: #DATA_ATUAL#" },
    { "tipo": "campo_texto_longo", "label": "Exames", "valor_padrao": "Bioressonância Quântica: Com finalidade de análise investigativa das frequências do corpo do paciente." },
    { "tipo": "campo_texto_longo", "label": "Diagnose", "valor_padrao": "" },
    { "tipo": "campo_texto_longo", "label": "Possíveis causas", "valor_padrao": "Sinais compatíveis com Transtorno de Ansiedade Generalizada (TAG) e Transtorno de Ansiedade Social (TAS)." },
    { "tipo": "campo_texto_longo", "label": "Tratamento", "valor_padrao": "Acompanhamento mensal e reavaliação periódica da resposta ao protocolo terapêutico." },
    { "tipo": "campo_texto_longo", "label": "Observações", "valor_padrao": "Sugestões de encaminhamento complementar conforme evolução clínica." }
  ],
  "rodape": {
    "assinatura": true,
    "dados_clinica": true,
    "conselho": true,
    "texto_fixo": "Objetivo do laudo descritivo é o esclarecimento de patologias e transtornos de ordem contínua. Este documento será somente fornecido, após avaliação e acompanhamento mensal de no mínimo 6 meses."
  }
}
  $json$, true, true),

  -- 7. PROCEDIMENTO — BIOMODULADOR INFRA-RED
  ('procedimento_biomodulador', 'Biomodulador Infra-Red', 'procedimento', $json$
{
  "layout": "pagina_cheia",
  "cabecalho": { "titulo": "PROTOCOLO — BIOMODULADOR INFRA-RED", "logo": true },
  "secoes": [
    { "tipo": "paragrafo", "conteudo": "Paciente: #CLIENTE_NOME#  |  Data: #DATA_ATUAL#" },
    { "tipo": "checkbox_grupo", "label": "Quantidade de aplicação", "opcoes": [
      "1 aplicação","2 aplicações","3 aplicações","4 aplicações","5 aplicações",
      "6 aplicações","7 aplicações","8 aplicações","9 aplicações","10 aplicações"
    ]},
    { "tipo": "checkbox_grupo", "label": "Tempo de cada aplicação", "opcoes": [
      "15 minutos","30 minutos","45 minutos","60 minutos"
    ]},
    { "tipo": "checkbox_grupo", "label": "Intervalo de cada aplicação", "opcoes": [
      "10 dias","12 dias","15 dias","20 dias"
    ]}
  ],
  "rodape": { "assinatura": true, "dados_clinica": true }
}
  $json$, true, false),

  -- 8. PROCEDIMENTO — FOTOTERAPY
  ('procedimento_fototerapy', 'Fototerapy', 'procedimento', $json$
{
  "layout": "pagina_cheia",
  "cabecalho": { "titulo": "PROTOCOLO — FOTOTERAPY", "logo": true },
  "secoes": [
    { "tipo": "paragrafo", "conteudo": "Paciente: #CLIENTE_NOME#  |  Data/Hora: #AGENDA_DATA_HORA#" },
    { "tipo": "campo_texto", "label": "Local de aplicação" },
    { "tipo": "checkbox_grupo", "label": "Quantidade de aplicação", "opcoes": [
      "1 aplicação","2 aplicações","3 aplicações","4 aplicações","5 aplicações",
      "6 aplicações","7 aplicações","8 aplicações","9 aplicações","10 aplicações"
    ]},
    { "tipo": "checkbox_grupo", "label": "Tempo de cada aplicação", "opcoes": [
      "15 minutos","30 minutos","45 minutos","60 minutos"
    ]},
    { "tipo": "checkbox_grupo", "label": "Intervalo de cada aplicação", "opcoes": [
      "10 dias","12 dias","15 dias","20 dias"
    ]}
  ],
  "rodape": { "assinatura": true, "dados_clinica": true }
}
  $json$, true, false),

  -- 9. DIETA — ORIENTAÇÕES ALIMENTARES
  ('dieta', 'Orientações Alimentares', 'dieta', $json$
{
  "cabecalho": { "titulo": "ORIENTAÇÕES ALIMENTARES", "logo": true },
  "secoes": [
    { "tipo": "paragrafo", "conteudo": "Paciente: #CLIENTE_NOME#  |  Data: #DATA_ATUAL#" },
    { "tipo": "checkbox_lista", "label": "Restrições alimentares", "itens": [
      "Evitar arroz",
      "Evitar feijão",
      "Evitar derivados de trigo (massas, pães, lanches)",
      "Evitar derivados de soja (margarina, óleo e outros)",
      "Evitar industrializados (embutidos, refrigerantes, etc.)",
      "Evitar frutas e doces entre 19h e 7h do dia seguinte",
      "Evitar bebidas alcoólicas",
      "Evitar açúcares refinados e adoçantes",
      "Usar o mínimo de açúcar ou usar açúcar mascavo",
      "Ingerir de 3 a 4 litros de água diariamente"
    ]},
    { "tipo": "checkbox_grupo", "label": "Evitar carnes", "opcoes": [
      "Bovinas","Suína","Frango","Peixe"
    ]}
  ],
  "rodape": {
    "dados_clinica": true,
    "texto_fixo": "A saúde é a essência do corpo, cuide do seu bem-estar! Dúvidas entre em contato conosco: #CLINICA_TELEFONE#"
  }
}
  $json$, true, true)

) as t(slug, nome, tipo, conteudo, editavel_pelo_especialista, disponivel_portal_paciente)
on conflict (unidade_id, slug) do nothing;

commit;
