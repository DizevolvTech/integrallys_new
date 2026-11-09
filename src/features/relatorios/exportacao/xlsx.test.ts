import { writeFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { crc32 } from '@/features/relatorios/exportacao/zip-armazenado'
import { escaparXml, gerarXlsx, letraDaColuna, nomeDeAbaValido } from '@/features/relatorios/exportacao/xlsx'

/** Leitor mínimo de zip pelo diretório central: prova que o arquivo gerado é um zip válido. */
function lerZip(bytes: Uint8Array) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let fim = bytes.length - 22
  while (fim >= 0 && v.getUint32(fim, true) !== 0x06054b50) fim--
  expect(fim).toBeGreaterThanOrEqual(0)
  const total = v.getUint16(fim + 10, true)
  let pos = v.getUint32(fim + 16, true)
  const entradas: Record<string, string> = {}
  for (let i = 0; i < total; i++) {
    expect(v.getUint32(pos, true)).toBe(0x02014b50)
    const metodo = v.getUint16(pos + 10, true)
    const crc = v.getUint32(pos + 16, true)
    const tamanho = v.getUint32(pos + 24, true)
    const nomeLen = v.getUint16(pos + 28, true)
    const extraLen = v.getUint16(pos + 30, true)
    const comentLen = v.getUint16(pos + 32, true)
    const local = v.getUint32(pos + 42, true)
    const nome = new TextDecoder().decode(bytes.slice(pos + 46, pos + 46 + nomeLen))
    expect(v.getUint32(local, true)).toBe(0x04034b50)
    const inicio = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true)
    let conteudo = bytes.slice(inicio, inicio + tamanho)
    if (metodo === 8) conteudo = new Uint8Array(inflateRawSync(conteudo))
    expect(metodo).toBe(0)
    expect(crc32(conteudo)).toBe(crc)
    entradas[nome] = new TextDecoder().decode(conteudo)
    pos += 46 + nomeLen + extraLen + comentLen
  }
  return entradas
}

describe('crc32', () => {
  it('bate com o valor conhecido de "123456789"', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
  })
})

describe('gerarXlsx', () => {
  const bytes = gerarXlsx([
    {
      nome: 'Recebimentos',
      larguras: [20, 12],
      linhas: [
        [{ valor: 'Cliente', estilo: 'cabecalho' }, { valor: 'Bruto', estilo: 'cabecalho' }],
        [{ valor: 'Maria & "Cia" <teste>' }, { valor: 1234.5, estilo: 'dinheiro' }],
        [{ valor: 'João' }, { valor: null }],
      ],
    },
    { nome: 'Resumo', linhas: [[{ valor: 'Pendentes' }, { valor: '4' }]] },
  ])
  const zip = lerZip(bytes)

  it('traz as entradas obrigatórias do pacote', () => {
    expect(Object.keys(zip).sort()).toEqual(
      [
        '[Content_Types].xml',
        '_rels/.rels',
        'xl/_rels/workbook.xml.rels',
        'xl/styles.xml',
        'xl/workbook.xml',
        'xl/worksheets/sheet1.xml',
        'xl/worksheets/sheet2.xml',
      ].sort(),
    )
    expect(zip['[Content_Types].xml']).toContain('/xl/worksheets/sheet2.xml')
    expect(zip['xl/workbook.xml']).toContain('name="Recebimentos"')
    expect(zip['xl/workbook.xml']).toContain('name="Resumo"')
  })

  it('guarda texto como inlineStr escapado e número como número', () => {
    const s1 = zip['xl/worksheets/sheet1.xml']
    expect(s1).toContain('t="inlineStr"><is><t xml:space="preserve">Maria &amp; &quot;Cia&quot; &lt;teste&gt;</t>')
    expect(s1).toContain('<c r="B2" s="2"><v>1234.5</v></c>')
    expect(s1).not.toContain('r="B3"')
    expect(s1).toContain('<c r="A1" s="1" t="inlineStr">')
  })

  it('XML bem formado nas partes', () => {
    for (const [nome, xml] of Object.entries(zip)) {
      expect(xml.startsWith('<?xml'), nome).toBe(true)
    }
  })

  it('grava um arquivo de amostra quando pedido (conferência externa)', () => {
    if (process.env.XLSX_AMOSTRA) writeFileSync(process.env.XLSX_AMOSTRA, bytes)
    expect(bytes[0]).toBe(0x50)
    expect(bytes[1]).toBe(0x4b)
  })
})

describe('apoios do xlsx', () => {
  it('letras de coluna', () => {
    expect([0, 1, 25, 26, 27, 701, 702].map(letraDaColuna)).toEqual(['A', 'B', 'Z', 'AA', 'AB', 'ZZ', 'AAA'])
  })
  it('nome de aba válido e único', () => {
    expect(nomeDeAbaValido('Estoque: posição/saldo?')).toBe('Estoque posição saldo')
    expect(nomeDeAbaValido('x'.repeat(40))).toHaveLength(31)
    expect(nomeDeAbaValido('Resumo', ['resumo'])).toBe('Resumo (2)')
  })
  it('remove caracteres proibidos no XML', () => {
    expect(escaparXml('a\u0001b<')).toBe('ab&lt;')
  })
})
