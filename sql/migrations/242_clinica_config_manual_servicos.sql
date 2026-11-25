-- #1645: texto do Manual de Serviços e Termos cadastrado uma vez por unidade (Config. da Clínica)
alter table public.clinica_config add column if not exists manual_servicos text;
