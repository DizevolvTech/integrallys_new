import { describe, expect, it } from 'vitest'
import { montarFiltros, type EscopoRelatorio } from '@/lib/relatorios/filtros'

const UNIDADE = '11111111-1111-4111-8111-111111111111'
const OUTRA = '22222222-2222-4222-8222-222222222222'
const ESPECIALISTA = '33333333-3333-4333-8333-333333333333'
const OUTRO_PROF = '44444444-4444-4444-8444-444444444444'

const recepcao: EscopoRelatorio = { perfil: 'recepcao', userId: 'u1', unidadeId: UNIDADE, perfilRestritoPorUnidade: true }
const especialista: EscopoRelatorio = { perfil: 'especialista', userId: ESPECIALISTA, unidadeId: UNIDADE, perfilRestritoPorUnidade: true }
const admin: EscopoRelatorio = { perfil: 'admin', userId: 'a1', unidadeId: null, perfilRestritoPorUnidade: false }

const qs = (texto: string) => new URLSearchParams(texto)

describe('montarFiltros', () => {
  it('perfil restrito à unidade não consegue trocar a unidade pela query', () => {
    const f = montarFiltros('consultas', qs(`unidade_id=${OUTRA}`), recepcao)
    expect(f.unidade_id).toBe(UNIDADE)
  })

  it('administrador escolhe a unidade livremente', () => {
    expect(montarFiltros('consultas', qs(`unidade_id=${OUTRA}`), admin).unidade_id).toBe(OUTRA)
  })

  it('especialista é forçado ao próprio profissional nos relatórios próprios', () => {
    for (const tipo of ['consultas', 'repasse', 'comissoes', 'desempenho'] as const) {
      expect(montarFiltros(tipo, qs(`profissional_id=${OUTRO_PROF}`), especialista).profissional_id).toBe(ESPECIALISTA)
    }
  })

  it('descarta chaves fora da lista, UUID e data inválidos e texto perigoso', () => {
    const f = montarFiltros(
      'consultas',
      qs(`profissional_id=abc&inicio=2026-13-45x&q=${encodeURIComponent("x'; drop table")}&role=admin&fim=2026-10-31`),
      admin,
    )
    expect(f).not.toHaveProperty('profissional_id')
    expect(f).not.toHaveProperty('inicio')
    expect(f).not.toHaveProperty('q')
    expect(f).not.toHaveProperty('role')
    expect(f.fim).toBe('2026-10-31')
  })

  it('pagina e limita o tamanho da página', () => {
    expect(montarFiltros('vendas', qs('pagina=3&porPagina=20'), admin)).toMatchObject({ limit: 20, offset: 40 })
    expect(montarFiltros('vendas', qs('pagina=1&porPagina=5000'), admin).limit).toBe(100)
    expect(montarFiltros('aniversariantes', qs('porPagina=500'), admin).limit).toBe(500)
    expect(montarFiltros('vendas', qs('pagina=-4&porPagina=0'), admin)).toMatchObject({ limit: 20, offset: 0 })
  })

  it('mantém o filtro de vendas por consumo', () => {
    expect(montarFiltros('vendas', qs('forma=consumo'), recepcao).forma).toBe('consumo')
  })
})
