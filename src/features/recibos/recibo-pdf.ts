import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

async function montarPdf(elemento: HTMLElement) {
  const canvas = await html2canvas(elemento, { scale: 2, backgroundColor: '#ffffff' })
  const pdf = new jsPDF('p', 'mm', 'a4')
  const largura = pdf.internal.pageSize.getWidth()
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, largura, (canvas.height * largura) / canvas.width)
  return pdf
}

export async function baixarReciboPdf(elemento: HTMLElement, numero: string) {
  const pdf = await montarPdf(elemento)
  pdf.save(`recibo_${numero}.pdf`)
}

/** Imprime via iframe oculto com o PDF (mantém o layout do recibo). */
export async function imprimirRecibo(elemento: HTMLElement) {
  const pdf = await montarPdf(elemento)
  const url = URL.createObjectURL(pdf.output('blob'))
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  iframe.src = url
  iframe.onload = () => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    setTimeout(() => {
      iframe.remove()
      URL.revokeObjectURL(url)
    }, 60_000)
  }
  document.body.appendChild(iframe)
}
