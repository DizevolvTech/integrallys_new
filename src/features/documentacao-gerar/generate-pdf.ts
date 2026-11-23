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

/**
 * Imprime só o documento renderizado, num quadro oculto (sem abrir janela, então o bloqueador de pop-up não atrapalha
 * nem depois de uma chamada assíncrona). Retorna false se o navegador não deu acesso ao quadro.
 */
export function imprimirElemento(element: HTMLElement): boolean {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(frame)
  const doc = frame.contentDocument
  const win = frame.contentWindow
  if (!doc || !win) {
    frame.remove()
    return false
  }
  doc.open()
  doc.write(
    `<!doctype html><html><head><title>Documento</title><style>@page{size:A4;margin:0}body{margin:0}</style></head><body>${element.outerHTML}</body></html>`,
  )
  doc.close()
  const imprimir = () => {
    win.focus()
    win.print()
    setTimeout(() => frame.remove(), 1000)
  }
  const imagens = Array.from(doc.images).filter((img) => !img.complete)
  if (imagens.length === 0) setTimeout(imprimir, 100)
  else void Promise.all(imagens.map((img) => new Promise((ok) => { img.onload = img.onerror = ok }))).then(imprimir)
  return true
}
