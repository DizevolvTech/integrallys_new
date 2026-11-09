import { montarZip } from '@/features/relatorios/exportacao/zip-armazenado'

/** Célula: texto ou número (números ficam como número no Excel). `estilo` escolhe o formato. */
export type EstiloCelula = 'padrao' | 'cabecalho' | 'dinheiro' | 'pct' | 'titulo'
export interface CelulaXlsx {
  valor: string | number | null
  estilo?: EstiloCelula
}
export interface PlanilhaXlsx {
  nome: string
  linhas: CelulaXlsx[][]
  larguras?: number[]
}

const INDICE_ESTILO: Record<EstiloCelula, number> = { padrao: 0, cabecalho: 1, dinheiro: 2, pct: 3, titulo: 4 }
/** Remove os caracteres que o XML 1.0 e o PDF não aceitam (controles, exceto tab, quebra de linha e retorno). */
export function limparControles(texto: string): string {
  let saida = ''
  for (const letra of texto) {
    const c = letra.codePointAt(0) ?? 0
    const proibido = (c < 32 && c !== 9 && c !== 10 && c !== 13) || c === 0xfffe || c === 0xffff
    if (!proibido) saida += letra
  }
  return saida
}

export function escaparXml(texto: string): string {
  return limparControles(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** A, B, ... Z, AA ... a partir do índice 0. */
export function letraDaColuna(indice: number): string {
  let n = indice + 1
  let letras = ''
  while (n > 0) {
    const resto = (n - 1) % 26
    letras = String.fromCharCode(65 + resto) + letras
    n = Math.floor((n - 1) / 26)
  }
  return letras
}

/** Excel limita o nome da aba a 31 caracteres e proíbe : \ / ? * [ ]. */
export function nomeDeAbaValido(nome: string, usados: string[] = []): string {
  const base = nome.replace(/[:\\/?*[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Planilha'
  let candidato = base
  let n = 2
  while (usados.some((u) => u.toLowerCase() === candidato.toLowerCase())) {
    const sufixo = ` (${n++})`
    candidato = base.slice(0, 31 - sufixo.length) + sufixo
  }
  return candidato
}

function xmlDaPlanilha(planilha: PlanilhaXlsx): string {
  const colunas = planilha.larguras?.length
    ? `<cols>${planilha.larguras.map((l, i) => `<col min="${i + 1}" max="${i + 1}" width="${l}" customWidth="1"/>`).join('')}</cols>`
    : ''
  const linhas = planilha.linhas
    .map((linha, r) => {
      const celulas = linha
        .map((celula, c) => {
          if (celula.valor === null || celula.valor === '') return ''
          const ref = `${letraDaColuna(c)}${r + 1}`
          const s = INDICE_ESTILO[celula.estilo ?? 'padrao']
          if (typeof celula.valor === 'number' && Number.isFinite(celula.valor)) {
            return `<c r="${ref}" s="${s}"><v>${celula.valor}</v></c>`
          }
          return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${escaparXml(String(celula.valor))}</t></is></c>`
        })
        .join('')
      return `<row r="${r + 1}">${celulas}</row>`
    })
    .join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${colunas}<sheetData>${linhas}</sheetData></worksheet>`
}

const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;R$&quot;\\ #,##0.00"/><numFmt numFmtId="165" formatCode="0.0&quot;%&quot;"/></numFmts>
<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8EEF2"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`

/** Gera um .xlsx de verdade (SpreadsheetML mínimo dentro de um zip "stored"), sem dependência externa. */
export function gerarXlsx(planilhas: PlanilhaXlsx[]): Uint8Array {
  const codificar = (texto: string) => new TextEncoder().encode(texto)
  const nomes: string[] = []
  for (const p of planilhas) nomes.push(nomeDeAbaValido(p.nome, nomes))

  const tipos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${planilhas
    .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
    .join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`
  const relRaiz = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${nomes
    .map((n, i) => `<sheet name="${escaparXml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join('')}</sheets></workbook>`
  const relWorkbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${planilhas
    .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
    .join('')}<Relationship Id="rId${planilhas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`

  return montarZip([
    { nome: '[Content_Types].xml', conteudo: codificar(tipos) },
    { nome: '_rels/.rels', conteudo: codificar(relRaiz) },
    { nome: 'xl/workbook.xml', conteudo: codificar(workbook) },
    { nome: 'xl/_rels/workbook.xml.rels', conteudo: codificar(relWorkbook) },
    { nome: 'xl/styles.xml', conteudo: codificar(ESTILOS) },
    ...planilhas.map((p, i) => ({ nome: `xl/worksheets/sheet${i + 1}.xml`, conteudo: codificar(xmlDaPlanilha(p)) })),
  ])
}
