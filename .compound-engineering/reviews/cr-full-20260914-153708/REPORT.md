# Code Review Completo — Integrallys
**Run:** `cr-full-20260914-153708`  
**Escopo:** programa inteiro (86 API routes + features + migrations 001–106)  
**Personas:** correctness · security · data-migration · ui-frontend · api-reliability-standards  
**Independência:** 5 contextos Task separados (cross-model peer não disponível neste harness)  
**Verificação:** `tsc --noEmit` OK · vitest **244/247** (3 flaky CEP/timeout)

---

## Verdict

**NO-GO para acesso da cliente** até fechar o bloco P0 abaixo.  
Há falhas de segurança multi-tenant, perda silenciosa de dados, portal com UX falsa (pagamento), e migrations 101–106 ainda fora do contrato DB rastreado.

---

## Actionable Findings (deduplicados)

### P0 — Bloqueantes

| # | Título | Área | Evidência | Reviewers |
|---|--------|------|-----------|-----------|
| 1 | Paciente pode ler/alterar `/api/configuracoes` (sem `forbidPatientRole`) | Segurança | `configuracoes/route.ts:40` + grant em `004` | security |
| 2 | DELETE configuracoes devolve **secrets sem máscara** | Segurança | `configuracoes/route.ts:125` vs GET com `maskConfigValue` | security |
| 3 | Caixa confia em `unitId` do client (cross-unit) | Segurança/$$ | `caixa/route.ts:23` | security, correctness |
| 4 | Prontuário / anamnese / evoluções PUT por id sem ownership | Segurança/PHI | `prontuarios/:117`, `anamnese/:119`, `evolucoes/:97` | security |
| 5 | Portal stripa `urlOnline` no remap final | Função/UI | `portal/agendamentos/route.ts:93-100` | correctness, api |
| 6 | Cancelar NÃO libera slot (`Cancelado` ≠ `Disponível`) | Agenda | `agenda/route.ts:788-794` | fast-pass + audit prévia |
| 7 | Edit paciente zera JSON `financeiro` | Dados | `pacientes-view` omit + API `financeiro: null` | audit prévia |
| 8 | Venda Rx: falha caixa apaga Rx mas estoque fica baixado | $$/estoque | `prescricoes/route.ts:522` | correctness, api |
| 9 | Convertida: status commitado antes do loop de estoque | Estoque | `prescricoes/route.ts:593` | correctness |
| 10 | Portal “Finalizar e Pagar” **não cobra** + redirect `/agenda` | UI portal | `novo-agendamento-view.tsx:391-399` | ui |
| 11 | Bucket fotos `public=true` sem policies | DB/PHI | `104_pacientes_fotos_bucket.sql:12` | data-migration |

### P1 — Altos (antes do reteste Camila)

| # | Título | Evidência |
|---|--------|-----------|
| 12 | Middleware bloqueia webhooks/cron (só `/login` + login API) | `middleware.ts:5` |
| 13 | Webhooks Cielo sem shared-secret (não abrir PUBLIC sem HMAC) | `pagamentos/webhook/cielo` |
| 14 | Portal booking sem `ocuparSlotDisponivel` → double-book | `portal/agendamentos` POST insert |
| 15 | Pacote/série 2..N sem pagamento | `agenda/route.ts` série |
| 16 | Compromisso: título perdido; adiar não atualiza bloqueio | `agenda-view` handlers |
| 17 | Financeiro: parse data `14/09/2026, 09:00` → inválida | `use-lancamento-form.ts:88` |
| 18 | Estoque RMW não atômico + estorno fora de ordem | `estoque/route.ts` |
| 19 | Pagamento online: updates sem checar `error` | `pagamentos/online` + webhooks |
| 20 | Financeiro/cartões/bloqueios aceitam `unidadeId` do body | várias rotas |
| 21 | Exames DELETE sem ownership | `pacientes/exames` |
| 22 | Portal alert PUT com grant paciente | `portal/alert` |
| 23 | CEP race sobrescreve endereço | `use-consulta-cep.ts` |
| 24 | Portal calendário `toISOString()` shift BRT | `novo-agendamento-view.tsx:20` |
| 25 | Prescrições portal: Cancelada → Ativo | `portal/prescricoes:46` |
| 26 | Migration 106: unique SKU quebra se houver duplicata | `106:...:45` |
| 27 | `estoque_categorias` / pagamentos sem RLS pós-072 | migrations 013/106 |
| 28 | CRM inadimplência agenda: query global + limit 300 | `crm/inadimplencia` |

### P2 — Gaps / AGENTS / UX

- `role === 'especialista'` na agenda e configurações (AGENTS)
- Erro de API no portal → lista vazia “sem dados”
- Foto portal stub; Reagendar sem contexto
- Erros sem `code` em pagamentos/whatsapp
- `db-contract.json` desatualizado vs 099–106
- Categorias estoque desconectadas do texto livre em produtos
- 3 testes flaky (CEP / timeout 5s)

---

## Coverage

| Lente | Status |
|-------|--------|
| Correctness | OK — 12 findings |
| Security | OK — 12 findings |
| Data-migration | OK — 12 findings (101–106 + drift) |
| UI / races | OK — 12 findings |
| API / reliability / AGENTS | OK — 12 findings |
| Adversarial cross-model peer | **Não rodou** (sem peer allowlisted neste harness) — residual risk |
| Testing suite | 244 pass / 3 fail flaky |

**Preliminary fast-pass:** itens 5–7 sobrevivem com corroboração persona; demais fundidos na tabela.

---

## DB — resumo executivo

| Migration | Risco |
|-----------|--------|
| 101–103 | Relativamente seguros (defaults / grants) — **aplicar antes do go-live** |
| 104 | Bucket público → fotos PHI por URL previsível |
| 105 | FK conta ok; falta validar unidade no API |
| 106 | Unique SKU pode falhar; categorias sem RLS; CHECK drop/recreate frágil |
| Contrato | `scripts/db-contract.json` **stale** |

App usa **service_role** → RLS bypass; authz **tem** que estar completa em cada rota (não está).

---

## Ordem de remediação sugerida

1. Security P0 (config + caixa + IDOR clínico)  
2. Portal P0 (urlOnline + pagamento falso + redirect)  
3. Agenda P0 (liberar slot + série pagamento + financeiro paciente)  
4. Rx/estoque atomicidade  
5. Middleware webhooks **somente após** HMAC  
6. Migrations 101–106 + fechar bucket fotos + RLS  
7. P1 UI/CEP/datas + P2 AGENTS  

---

*Report-only — nenhuma correção aplicada neste review.*
