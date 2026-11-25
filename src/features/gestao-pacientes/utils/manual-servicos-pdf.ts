import jsPDF from 'jspdf'
import { formatarDataHoraClinica, hojeIsoClinica } from '@/lib/fuso-clinica'
import { formatarCPF } from '@/lib/validacao-br'
import type { Patient } from '@/types/patient'
import { descreverOrigem } from './origem'

export interface ClinicaManual {
  nome: string
  cidadeUf?: string | null
}

const MARGEM = 20
const LARGURA_UTIL = 210 - MARGEM * 2
const ALTURA_MAX = 297 - 25

function dataBr(iso?: string): string {
  const [ano, mes, dia] = (iso ?? '').slice(0, 10).split('-')
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : '-'
}

function nomeArquivo(nome: string): string {
  const limpo = nome
    .normalize('NFD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
  return `manual_servicos_${limpo || 'paciente'}_${hojeIsoClinica()}.pdf`
}

/** Mensagem do WhatsApp do Manual de Serviços: o PDF baixa antes e segue em anexo na conversa. */
export function mensagemWhatsAppManual(nomePaciente: string, nomeClinica: string): string {
  return `Olá ${nomePaciente}! Segue o Manual de Serviços da ${nomeClinica}. O documento vai em anexo nesta conversa.`
}

/** Monta o PDF (texto selecionável): cadastro + manual + assinaturas. Quebra de página automática. */
export function montarManualPdf(paciente: Patient, clinica: ClinicaManual, manual: string): jsPDF {
  const pdf = new jsPDF('p', 'mm', 'a4')
  let y = MARGEM

  const garantir = (altura: number) => {
    if (y + altura > ALTURA_MAX) {
      pdf.addPage()
      y = MARGEM
    }
  }
  const linhas = (
    texto: string,
    tamanho: number,
    estilo: 'normal' | 'bold' = 'normal',
    justificar = false,
  ) => {
    pdf.setFont('helvetica', estilo)
    pdf.setFontSize(tamanho)
    const passo = tamanho * 0.5
    for (const bloco of texto.split('\n')) {
      const partes: string[] = bloco.trim() === '' ? [''] : pdf.splitTextToSize(bloco, LARGURA_UTIL)
      for (const parte of partes) {
        garantir(passo)
        pdf.text(
          parte,
          MARGEM,
          y,
          justificar && parte ? { maxWidth: LARGURA_UTIL, align: 'justify' } : undefined,
        )
        y += passo
      }
    }
  }
  const titulo = (texto: string) => {
    garantir(16)
    y += 4
    linhas(texto.toUpperCase(), 12, 'bold')
    pdf.setDrawColor(150)
    pdf.line(MARGEM, y - 3, MARGEM + LARGURA_UTIL, y - 3)
    y += 1
  }
  const campo = (rotulo: string, valor?: string | number | null) =>
    linhas(`${rotulo}: ${valor === undefined || valor === null || valor === '' ? '-' : valor}`, 10)

  linhas(clinica.nome, 18, 'bold')
  if (clinica.cidadeUf) linhas(clinica.cidadeUf, 10)
  linhas(`Ficha Cadastral e Manual de Serviços - ${dataBr(hojeIsoClinica())}`, 10)
  y += 2

  titulo('1. Dados do paciente')
  campo('Nome', paciente.name)
  campo('CPF', paciente.cpf ? formatarCPF(paciente.cpf) : '')
  campo('RG', paciente.rg)
  campo('Data de nascimento', dataBr(paciente.birthDate))
  campo('Idade', paciente.age)
  campo('Telefone', paciente.phone)
  campo('E-mail', paciente.email)
  campo('Origem', descreverOrigem(paciente.source, paciente.origemDetalhe))
  const cidade = [paciente.addressDetails?.city, paciente.addressDetails?.state]
    .filter(Boolean)
    .join('/')
  campo(
    'Endereço',
    [
      paciente.address,
      cidade,
      paciente.addressDetails?.zipCode && `CEP ${paciente.addressDetails.zipCode}`,
    ]
      .filter(Boolean)
      .join(' - '),
  )

  if (paciente.responsible) {
    titulo('2. Dados do responsável')
    campo('Nome', paciente.responsible.name)
    campo('CPF', paciente.responsible.cpf ? formatarCPF(paciente.responsible.cpf) : '')
    campo('Telefone', paciente.responsible.phone)
    campo('Vínculo', paciente.responsible.relationship)
  }

  titulo(`${paciente.responsible ? '3' : '2'}. Manual de serviços e termos`)
  linhas(manual, 10, 'normal', true)

  garantir(40)
  y += 22
  const meio = MARGEM + LARGURA_UTIL / 2
  pdf.setDrawColor(0)
  pdf.line(MARGEM, y, meio - 8, y)
  pdf.line(meio + 8, y, MARGEM + LARGURA_UTIL, y)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.text(paciente.name ?? '', MARGEM + (meio - 8 - MARGEM) / 2, y + 5, {
    align: 'center',
    maxWidth: meio - 8 - MARGEM,
  })
  pdf.text(clinica.nome, meio + 8 + (MARGEM + LARGURA_UTIL - meio - 8) / 2, y + 5, {
    align: 'center',
    maxWidth: meio - 8 - MARGEM,
  })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.text('Paciente / Responsável', MARGEM + (meio - 8 - MARGEM) / 2, y + 10, { align: 'center' })
  pdf.text('Administração', meio + 8 + (MARGEM + LARGURA_UTIL - meio - 8) / 2, y + 10, {
    align: 'center',
  })
  pdf.setFontSize(8)
  pdf.text(`Gerado em ${formatarDataHoraClinica(new Date())}`, MARGEM, 290)
  return pdf
}

export function baixarManualPdf(paciente: Patient, clinica: ClinicaManual, manual: string): void {
  montarManualPdf(paciente, clinica, manual).save(nomeArquivo(paciente.name ?? ''))
}

/** Imprime o mesmo PDF por um iframe oculto (o diálogo de impressão abre com o conteúdo). */
export function imprimirManualPdf(paciente: Patient, clinica: ClinicaManual, manual: string): void {
  const url = URL.createObjectURL(montarManualPdf(paciente, clinica, manual).output('blob'))
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
