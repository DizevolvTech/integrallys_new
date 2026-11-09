'use client'

import { FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { FormatoExportacao } from '@/features/relatorios/exportar-relatorio'

interface Props {
  desabilitado: boolean
  exportando: FormatoExportacao | null
  erro?: string | null
  onExportar: (formato: FormatoExportacao) => void
}

/** Botões "Excel" e "PDF": exportam todas as linhas do filtro, não só a página. */
export function RelatorioExportar({ desabilitado, exportando, erro, onExportar }: Props) {
  return (
    <>
      {(['xlsx', 'pdf'] as const).map((formato) => (
        <Button
          key={formato}
          variant="outline"
          size="sm"
          className="rounded-lg"
          disabled={desabilitado || exportando !== null}
          onClick={() => onExportar(formato)}
          aria-label={formato === 'xlsx' ? 'Exportar em Excel' : 'Exportar em PDF'}
        >
          {exportando === formato ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : formato === 'xlsx' ? (
            <FileSpreadsheet className="mr-1 h-4 w-4" />
          ) : (
            <FileText className="mr-1 h-4 w-4" />
          )}
          {formato === 'xlsx' ? 'Excel' : 'PDF'}
        </Button>
      ))}
      {erro && (
        <p role="alert" className="w-full text-sm text-[var(--app-danger-text)]">
          {erro}
        </p>
      )}
    </>
  )
}
