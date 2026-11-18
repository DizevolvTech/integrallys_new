'use client'

import { Loader2 } from 'lucide-react'
import type { TemplateConteudo } from '@/lib/documentos'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { TemplateForm } from './template-form'
import type { OrigemModelo } from './use-documentos-atendimento'
import type { ValoresForm } from './types'

const ROTULO_ORIGEM: Record<OrigemModelo, string> = {
  pessoal: 'Seu modelo pessoal',
  clinica: 'Modelo da clínica',
  padrao: 'Texto padrão (a clínica ainda não cadastrou modelo)',
}

interface Props {
  conteudo: TemplateConteudo
  valores: ValoresForm
  origem: OrigemModelo
  disabled?: boolean
  ocupado?: boolean
  onConteudoChange: (conteudo: TemplateConteudo) => void
  onValoresChange: (valores: ValoresForm) => void
  onSalvarModelo: () => void
  onRestaurarPadrao: () => void
}

/** Editor amigável do documento do atendimento: textos editáveis, itens marcáveis e campos do modelo. */
export function DocumentoAtendimentoEditor({
  conteudo,
  valores,
  origem,
  disabled,
  ocupado,
  onConteudoChange,
  onValoresChange,
  onSalvarModelo,
  onRestaurarPadrao,
}: Props) {
  const editarParagrafo = (index: number, texto: string) =>
    onConteudoChange({
      ...conteudo,
      secoes: conteudo.secoes.map((s, i) => (i === index && s.tipo === 'paragrafo' ? { ...s, conteudo: texto } : s)),
    })

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <Label className="font-normal text-app-text-primary dark:text-white">Modelo do documento (editável)</Label>
          <p className="text-xs text-app-text-muted">{ROTULO_ORIGEM[origem]}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSalvarModelo}
            disabled={disabled || ocupado}
            className="h-9 px-3 rounded-full text-xs font-normal"
          >
            {ocupado && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
            Salvar modelo
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRestaurarPadrao}
            disabled={disabled || ocupado}
            className="h-9 px-3 rounded-full text-xs font-normal text-app-text-muted"
          >
            Restaurar padrão
          </Button>
        </div>
      </div>
      <p className="text-sm font-medium text-app-text-primary dark:text-white">{conteudo.cabecalho.titulo}</p>
      <TemplateForm
        template={{ conteudo }}
        valores={valores}
        onChange={onValoresChange}
        onParagrafoChange={editarParagrafo}
        disabled={disabled}
      />
      {conteudo.rodape.texto_fixo && (
        <p className="text-xs italic text-app-text-muted">{conteudo.rodape.texto_fixo}</p>
      )}
    </div>
  )
}
