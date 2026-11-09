/** ZIP sem compressão ("stored") com CRC-32: o suficiente para montar um .xlsx sem dependência externa. */

const TABELA_CRC = (() => {
  const tabela = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    tabela[n] = c >>> 0
  }
  return tabela
})()

export function crc32(dados: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < dados.length; i++) c = TABELA_CRC[(c ^ dados[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export interface EntradaZip {
  nome: string
  conteudo: Uint8Array
}

// 01/01/2026 00:00 (campos de data/hora do formato MS-DOS)
const DOS_HORA = 0
const DOS_DATA = ((2026 - 1980) << 9) | (1 << 5) | 1
const FLAG_UTF8 = 0x0800

export function montarZip(entradas: EntradaZip[]): Uint8Array {
  const codificador = new TextEncoder()
  const partes: Uint8Array[] = []
  const central: Uint8Array[] = []
  let deslocamento = 0

  for (const entrada of entradas) {
    const nome = codificador.encode(entrada.nome)
    const crc = crc32(entrada.conteudo)
    const tamanho = entrada.conteudo.length

    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true)
    local.setUint16(6, FLAG_UTF8, true)
    local.setUint16(8, 0, true) // stored
    local.setUint16(10, DOS_HORA, true)
    local.setUint16(12, DOS_DATA, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, tamanho, true)
    local.setUint32(22, tamanho, true)
    local.setUint16(26, nome.length, true)
    local.setUint16(28, 0, true)
    partes.push(new Uint8Array(local.buffer), nome, entrada.conteudo)

    const dir = new DataView(new ArrayBuffer(46))
    dir.setUint32(0, 0x02014b50, true)
    dir.setUint16(4, 20, true)
    dir.setUint16(6, 20, true)
    dir.setUint16(8, FLAG_UTF8, true)
    dir.setUint16(10, 0, true)
    dir.setUint16(12, DOS_HORA, true)
    dir.setUint16(14, DOS_DATA, true)
    dir.setUint32(16, crc, true)
    dir.setUint32(20, tamanho, true)
    dir.setUint32(24, tamanho, true)
    dir.setUint16(28, nome.length, true)
    dir.setUint32(42, deslocamento, true)
    central.push(new Uint8Array(dir.buffer), nome)

    deslocamento += 30 + nome.length + tamanho
  }

  const tamanhoCentral = central.reduce((soma, p) => soma + p.length, 0)
  const fim = new DataView(new ArrayBuffer(22))
  fim.setUint32(0, 0x06054b50, true)
  fim.setUint16(8, entradas.length, true)
  fim.setUint16(10, entradas.length, true)
  fim.setUint32(12, tamanhoCentral, true)
  fim.setUint32(16, deslocamento, true)

  const todas = [...partes, ...central, new Uint8Array(fim.buffer)]
  const saida = new Uint8Array(todas.reduce((soma, p) => soma + p.length, 0))
  let posicao = 0
  for (const parte of todas) {
    saida.set(parte, posicao)
    posicao += parte.length
  }
  return saida
}
