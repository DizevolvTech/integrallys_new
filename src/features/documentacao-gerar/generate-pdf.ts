'use client'

/**
 * Gera PDF a partir de um elemento HTML renderizado usando html2canvas +
 * jsPDF. Retorna um Blob para envio/download.
 */
export async function gerarPdfDoElemento(element: HTMLElement, filename: string): Promise<{ blob: Blob; filename: string }> {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
  })

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()

  const imgWidth = pageWidth
  const imgHeight = (canvas.height * pageWidth) / canvas.width

  const imgData = canvas.toDataURL('image/jpeg', 0.92)

  // Paginação simples: corta a imagem total se exceder uma página
  let heightLeft = imgHeight
  let position = 0
  pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight)
  heightLeft -= pageHeight

  while (heightLeft > 0) {
    position = heightLeft - imgHeight
    pdf.addPage()
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight
  }

  const blob = pdf.output('blob')
  return { blob, filename }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** Abre o documento renderizado numa janela própria e dispara a impressão. Retorna false se o pop-up foi bloqueado. */
export function imprimirElemento(element: HTMLElement): boolean {
  const win = window.open('', '_blank', 'width=900,height=1200')
  if (!win) return false
  win.document.write(
    `<!doctype html><html><head><title>Documento</title></head><body style="margin:0">${element.outerHTML}</body></html>`,
  )
  win.document.close()
  win.focus()
  setTimeout(() => {
    win.print()
    win.close()
  }, 300)
  return true
}
