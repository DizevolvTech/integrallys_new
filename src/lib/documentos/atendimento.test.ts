import { describe, expect, it } from 'vitest'
import {
  conteudoAtestado,
  conteudoDeTexto,
  conteudoParaTexto,
  normalizarConteudo,
  tokenizarConteudo,
} from './atendimento'
import { comLayoutPadrao, resolverConteudo } from './atendimento'

const estrutura = {
  cabecalho: { titulo: 'ORIENTAÇÕES ALIMENTARES', logo: true },
  secoes: [
    { tipo: 'paragrafo', conteudo: 'Paciente: #CLIENTE_NOME#  |  Data: #DATA_ATUAL#' },
    { tipo: 'checkbox_lista', label: 'Restrições', itens: ['Evitar arroz', 'Evitar feijão'] },
    { tipo: 'checkbox_grupo', label: 'Evitar carnes', opcoes: ['Bovinas', 'Frango'] },
  ],
  rodape: { texto_fixo: 'Dúvidas: #CLINICA_TELEFONE#', dados_clinica: true },
}

describe('normalizarConteudo', () => {
  it('aceita a estrutura direta', () => {
    expect(normalizarConteudo(estrutura)?.secoes).toHaveLength(3)
  })
  it('desembrulha { corpo: JSON } gravado pelo antigo "Salvar modelo"', () => {
    const out = normalizarConteudo({ corpo: JSON.stringify(estrutura) })
    expect(out?.cabecalho.titulo).toBe('ORIENTAÇÕES ALIMENTARES')
    expect(out?.secoes[1].tipo).toBe('checkbox_lista')
  })
  it('{ corpo: texto livre } vira título + parágrafos', () => {
    const out = normalizarConteudo({ corpo: 'LAUDO\n\nAvaliação:\n\nConclusão:' })
    expect(out?.cabecalho.titulo).toBe('LAUDO')
    expect(out?.secoes.map((s) => (s as { conteudo: string }).conteudo)).toEqual(['Avaliação:', 'Conclusão:'])
  })
  it('vazio ou inválido → null (cai no texto padrão)', () => {
    expect(normalizarConteudo({ corpo: '' })).toBeNull()
    expect(normalizarConteudo(null)).toBeNull()
    expect(normalizarConteudo({})).toBeNull()
  })
})

describe('resolver e tokenizar', () => {
  const ctx = {
    cliente: { nome: 'Maria Souza' },
    clinica: { telefone: '(11) 3333-4444' },
    agora: new Date(2026, 10, 18),
  }
  it('resolve nome do paciente, data e telefone da clínica', () => {
    const out = resolverConteudo(conteudoDeTexto('X\n\nOlá #CLIENTE_NOME# em #DATA_ATUAL#'), ctx)
    expect((out.secoes[0] as { conteudo: string }).conteudo).toBe('Olá Maria Souza em 18/11/2026')
  })
  it('tokenizar desfaz a resolução (modelo pessoal não guarda o paciente)', () => {
    const resolvido = resolverConteudo(estrutura as never, ctx)
    const volta = tokenizarConteudo(resolvido, ctx)
    expect(volta).toEqual(estrutura)
  })
})

describe('conteudoParaTexto', () => {
  it('lista itens marcados com ☒ e resolve variáveis', () => {
    const texto = conteudoParaTexto(estrutura as never, { 1: [0], 2: [1] }, { cliente: { nome: 'Ana Lima' } })
    expect(texto).toContain('ORIENTAÇÕES ALIMENTARES')
    expect(texto).toContain('Paciente: Ana Lima')
    expect(texto).toContain('☒ Evitar arroz\n☐ Evitar feijão')
    expect(texto).toContain('Evitar carnes: ☐ Bovinas   ☒ Frango')
  })
})

describe('conteudoAtestado', () => {
  it('monta o atestado com dias e motivo', () => {
    const c = conteudoAtestado('3', 'Repouso')
    expect(c.cabecalho.titulo).toBe('ATESTADO MÉDICO')
    expect(JSON.stringify(c)).toContain('por 3 dia(s)')
    expect(JSON.stringify(c)).toContain('Motivo: Repouso')
  })
})

describe('comLayoutPadrao (#1645)', () => {
  const base = { cabecalho: { titulo: 'X' }, secoes: [], rodape: {} }
  it('declaração e protocolos ganham o layout de página quando o modelo não tem', () => {
    expect(comLayoutPadrao('declaracao', base).layout).toBe('pagina_centrada')
    expect(comLayoutPadrao('fototerapy', base).layout).toBe('pagina_cheia')
    expect(comLayoutPadrao('biomodular', base).layout).toBe('pagina_cheia')
  })
  it('o layout do modelo manda e os demais documentos ficam como estão', () => {
    expect(comLayoutPadrao('declaracao', { ...base, layout: 'pagina_cheia' }).layout).toBe('pagina_cheia')
    expect(comLayoutPadrao('laudo', base)).toBe(base)
  })
})
