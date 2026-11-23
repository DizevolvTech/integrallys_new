'use client'

import { useLayoutEffect, useRef } from 'react'

import type {
  DocumentoTemplate,
  Secao,
  SecaoChecklist,
  SecaoCheckboxGrupo,
  SecaoCheckboxLista,
  SecaoCampoData,
  SecaoCampoNumero,
  SecaoCampoTexto,
  SecaoCampoTextoLongo,
} from '@/lib/documentos'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { CampoTextoOpcoes } from './campo-texto-opcoes'
import type {
  ValoresForm,
  ValorChecklist,
  ValorCheckboxGrupo,
  ValorCheckboxLista,
} from './types'

interface Props {
  template: Pick<DocumentoTemplate, 'conteudo'>
  valores: ValoresForm
  onChange: (next: ValoresForm) => void
  /** Quando informado, os parágrafos do modelo viram texto editável (atendimento do especialista). */
  onParagrafoChange?: (index: number, texto: string) => void
  disabled?: boolean
}

export function TemplateForm({ template, valores, onChange, onParagrafoChange, disabled }: Props) {
  const setValor = (index: number, valor: unknown) => {
    onChange({ ...valores, [index]: valor as ValoresForm[number] })
  }

  const secoesEditaveis = template.conteudo.secoes
    .map((secao, index) => ({ secao, index }))
    .filter(({ secao }) => secao.tipo !== 'paragrafo' || !!onParagrafoChange)

  if (secoesEditaveis.length === 0) {
    return (
      <p className="text-sm text-app-text-secondary dark:text-white/60">
        Este documento não requer preenchimento manual — apenas variáveis automáticas.
      </p>
    )
  }

  return (
    <div className="space-y-5">
      {secoesEditaveis.map(({ secao, index }) => (
        <CampoRenderer
          key={index}
          secao={secao}
          valor={valores[index]}
          onValorChange={(next) => setValor(index, next)}
          onParagrafoChange={onParagrafoChange ? (texto) => onParagrafoChange(index, texto) : undefined}
          disabled={disabled}
        />
      ))}
    </div>
  )
}

function CampoRenderer({
  secao,
  valor,
  onValorChange,
  onParagrafoChange,
  disabled,
}: {
  secao: Secao
  valor: unknown
  onValorChange: (next: unknown) => void
  onParagrafoChange?: (texto: string) => void
  disabled?: boolean
}) {
  const bloqueio = disabled ? 'pointer-events-none opacity-60' : ''
  switch (secao.tipo) {
    case 'paragrafo':
      if (!onParagrafoChange) return null
      return <ParagrafoEditavel texto={secao.conteudo} disabled={disabled} onChange={onParagrafoChange} />

    case 'campo_data': {
      const s = secao as SecaoCampoData
      return (
        <div className="space-y-2">
          <label className="text-sm font-normal dark:text-white/70">{s.label}</label>
          <Input
            type="date"
            value={typeof valor === 'string' ? valor : ''}
            onChange={(event) => onValorChange(event.target.value)}
            disabled={disabled}
            className="h-11 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-xl"
          />
        </div>
      )
    }

    case 'campo_texto': {
      const s = secao as SecaoCampoTexto
      return (
        <div className="space-y-2">
          <label className="text-sm font-normal dark:text-white/70">
            {s.label}
            {s.obrigatorio && <span className="text-[var(--app-danger-text)]"> *</span>}
          </label>
          {s.opcoes_profissionais || s.opcoes?.length ? (
            <CampoTextoOpcoes
              secao={s}
              valor={typeof valor === 'string' ? valor : s.valor_padrao ?? ''}
              onChange={onValorChange}
              disabled={disabled}
            />
          ) : (
            <Input
              value={typeof valor === 'string' ? valor : s.valor_padrao ?? ''}
              placeholder={s.placeholder}
              onChange={(event) => onValorChange(event.target.value)}
              disabled={disabled}
              className="h-11 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-xl"
            />
          )}
        </div>
      )
    }

    case 'campo_numero': {
      const s = secao as SecaoCampoNumero
      return (
        <div className="space-y-2">
          <label className="text-sm font-normal dark:text-white/70">{s.label}</label>
          <Input
            type="number"
            step="any"
            value={typeof valor === 'string' ? valor : ''}
            onChange={(event) => onValorChange(event.target.value)}
            disabled={disabled}
            className="h-11 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-xl"
          />
        </div>
      )
    }

    case 'campo_texto_longo': {
      const s = secao as SecaoCampoTextoLongo
      return (
        <div className="space-y-2">
          <label className="text-sm font-normal dark:text-white/70">{s.label}</label>
          <Textarea
            value={typeof valor === 'string' ? valor : s.valor_padrao ?? ''}
            onChange={(event) => onValorChange(event.target.value)}
            disabled={disabled}
            className="min-h-[100px] bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-xl font-normal resize-none"
          />
        </div>
      )
    }

    case 'checklist': {
      const s = secao as SecaoChecklist
      const respostas = (valor as ValorChecklist | undefined) ?? {}
      return (
        <div className="space-y-2">
          <div className="text-sm font-medium dark:text-white/80">{s.label}</div>
          <div className={`space-y-2 rounded-xl border border-app-border dark:border-app-border-dark p-3 ${bloqueio}`}>
            {s.itens.map((item, idx) => {
              const resp = respostas[idx] ?? { sim: false, obs: '' }
              return (
                <div
                  key={idx}
                  className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center text-sm"
                >
                  <span className="dark:text-white/80">{item.label}</span>
                  <label className="flex items-center gap-2 text-xs text-app-text-secondary dark:text-white/60">
                    <Switch
                      checked={resp.sim}
                      onCheckedChange={(checked) => {
                        onValorChange({
                          ...respostas,
                          [idx]: { ...resp, sim: checked },
                        })
                      }}
                    />
                    <span>{resp.sim ? 'Sim' : 'Não'}</span>
                  </label>
                  {item.com_obs ? (
                    <Input
                      value={resp.obs}
                      disabled={!resp.sim}
                      placeholder={item.obs_label ?? 'Qual?'}
                      onChange={(event) => {
                        onValorChange({
                          ...respostas,
                          [idx]: { ...resp, obs: event.target.value },
                        })
                      }}
                      className="h-9 bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-lg text-xs"
                    />
                  ) : (
                    <span />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    case 'checkbox_lista': {
      const s = secao as SecaoCheckboxLista
      const marcados = new Set<number>((valor as ValorCheckboxLista | undefined) ?? [])
      const toggle = (idx: number) => {
        const next = new Set(marcados)
        if (next.has(idx)) next.delete(idx)
        else next.add(idx)
        onValorChange(Array.from(next).sort((a, b) => a - b))
      }
      return (
        <div className="space-y-2">
          <div className="text-sm font-medium dark:text-white/80">{s.label}</div>
          <div className={`rounded-xl border border-app-border dark:border-app-border-dark p-3 space-y-1 ${bloqueio}`}>
            {s.itens.map((item, idx) => (
              <label
                key={idx}
                className="flex items-center gap-2 text-sm cursor-pointer dark:text-white/80 py-1"
              >
                <input
                  type="checkbox"
                  checked={marcados.has(idx)}
                  onChange={() => toggle(idx)}
                  className="h-4 w-4 accent-[var(--app-primary)]"
                />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </div>
      )
    }

    case 'checkbox_grupo': {
      const s = secao as SecaoCheckboxGrupo
      const selecionados = new Set<number>((valor as ValorCheckboxGrupo | undefined) ?? [])
      const toggle = (idx: number) => {
        const next = new Set(selecionados)
        if (next.has(idx)) next.delete(idx)
        else next.add(idx)
        onValorChange(Array.from(next).sort((a, b) => a - b))
      }
      return (
        <div className="space-y-2">
          <div className="text-sm font-medium dark:text-white/80">{s.label}</div>
          <div className={`flex flex-wrap gap-2 rounded-xl border border-app-border dark:border-app-border-dark p-3 ${bloqueio}`}>
            {s.opcoes.map((opcao, idx) => (
              <label
                key={idx}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs cursor-pointer border ${
                  selecionados.has(idx)
                    ? 'bg-app-primary/10 border-app-primary text-app-primary'
                    : 'border-app-border dark:border-app-border-dark dark:text-white/80'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selecionados.has(idx)}
                  onChange={() => toggle(idx)}
                  className="h-3.5 w-3.5 accent-[var(--app-primary)]"
                />
                <span>{opcao}</span>
              </label>
            ))}
          </div>
        </div>
      )
    }
  }
}

/** Texto do modelo editável; a caixa cresce com o conteúdo (sem barra de rolagem interna, também no celular). */
function ParagrafoEditavel({
  texto,
  disabled,
  onChange,
}: {
  texto: string
  disabled?: boolean
  onChange: (texto: string) => void
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [texto])
  return (
    <Textarea
      ref={ref}
      value={texto}
      rows={2}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="min-h-0 overflow-hidden bg-app-bg-secondary border-app-border dark:bg-app-hover dark:border-app-border-dark rounded-xl font-normal leading-relaxed resize-none"
    />
  )
}
