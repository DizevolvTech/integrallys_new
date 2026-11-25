import type { EtiquetaConfig, EtiquetaDados } from './etiqueta-config'
import { calcularLayout, type Medidor } from './etiqueta-layout'

const MARGEM = 3

function slug(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'etiqueta'
}

/** Gera um PDF no tamanho da etiqueta, uma por página. Texto vetorial (nítido em térmica). */
export async function gerarEtiquetasPdf(itens: EtiquetaDados[], marca: string, cfg: EtiquetaConfig): Promise<{ blob: Blob; filename: string }> {
  const { jsPDF } = await import('jspdf')
  const orientacao = cfg.larguraMm > cfg.alturaMm ? 'landscape' : 'portrait'
  const pdf = new jsPDF({ unit: 'mm', format: [cfg.larguraMm, cfg.alturaMm], orientation: orientacao })
  const medir: Medidor = (texto, pt, negrito) => {
    pdf.setFont('helvetica', negrito ? 'bold' : 'normal')
    pdf.setFontSize(pt)
    return pdf.getTextWidth(texto)
  }
  itens.forEach((item, indice) => {
    if (indice > 0) pdf.addPage([cfg.larguraMm, cfg.alturaMm], orientacao)
    const lay = calcularLayout(item, cfg, medir)
    const x = MARGEM + cfg.margemEsquerdaMm
    let y = MARGEM + cfg.margemSuperiorMm
    pdf.setTextColor(17, 17, 17)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(lay.marcaPt)
    pdf.text(marca, x, y + 3, { baseline: 'alphabetic' })
    y += 4.5
    pdf.setDrawColor(59, 130, 246)
    pdf.setLineWidth(0.25)
    pdf.line(x, y, x + lay.areaLarguraMm, y)
    y += 3
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    for (const l of lay.linhasPaciente) { pdf.text(l, x, y, { baseline: 'alphabetic' }); y += 3 }
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7.5)
    for (const l of lay.linhasProduto) { pdf.text(l, x, y, { baseline: 'alphabetic' }); y += 3.2 }
    y += 0.8
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(lay.corpoPt)
    for (const l of lay.linhasUso) { pdf.text(l, x, y, { baseline: 'alphabetic' }); y += lay.passoUsoMm }
  })
  const nome = itens.length === 1 ? `etiqueta-${slug(itens[0].produto)}` : `etiquetas-${itens.length}`
  return { blob: pdf.output('blob'), filename: `${nome}.pdf` }
}

/** Imprime o PDF no diálogo do navegador (página do tamanho da etiqueta), num quadro oculto. */
export function imprimirEtiquetas(itens: EtiquetaDados[], marca: string, cfg: EtiquetaConfig): boolean {
  const esc = (v: string) => v.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
  // Medida aproximada só para escolher o corpo; o navegador quebra as linhas de fato.
  const aprox: Medidor = (t, pt) => t.length * pt * 0.3528 * 0.5
  const paginas = itens
    .map((item) => {
      const lay = calcularLayout(item, cfg, aprox)
      return `<section><b class="m">${esc(marca)}</b><div class="p">${esc(item.paciente)}</div><div class="n">${esc(item.produto)}</div><div class="u" style="font-size:${lay.corpoPt}pt">${esc(item.modoDeUso)}</div></section>`
    })
    .join('')
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(frame)
  const doc = frame.contentDocument
  const win = frame.contentWindow
  if (!doc || !win) { frame.remove(); return false }
  doc.open()
  doc.write(`<!doctype html><html><head><title>Etiqueta</title><style>
@page{size:${cfg.larguraMm}mm ${cfg.alturaMm}mm;margin:0}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html,body{margin:0;font-family:Helvetica,Arial,sans-serif;color:#111}
section{width:${cfg.larguraMm}mm;height:${cfg.alturaMm}mm;overflow:hidden;break-after:page;page-break-after:always;padding:${MARGEM + cfg.margemSuperiorMm}mm ${MARGEM}mm ${MARGEM}mm ${MARGEM + cfg.margemEsquerdaMm}mm}
section:last-child{break-after:auto;page-break-after:auto}
.m{display:block;font-size:9pt;border-bottom:.25mm solid #3b82f6;padding-bottom:1mm;margin-bottom:1.5mm}
.p{font-size:7pt}.n{font-size:7.5pt;font-weight:bold;margin-bottom:.8mm}
.u{white-space:pre-line;overflow-wrap:anywhere;line-height:1.25}
</style></head><body>${paginas}</body></html>`)
  doc.close()
  setTimeout(() => { win.focus(); win.print(); setTimeout(() => frame.remove(), 1000) }, 150)
  return true
}
