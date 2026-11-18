'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useAtendimento } from '@/contexts/atendimento-context'
import { useApi } from '@/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { camposPersonalizadosVisiveis, type CampoPersonalizadoDef } from './atendimento-finalizar-payload'

const CAMPO_CLASSE =
  'bg-app-bg-secondary/50 dark:bg-app-card-dark/50 border-app-border dark:border-app-border-dark rounded-integrallys font-normal'
const CARTAO_CLASSE =
  'bg-app-card dark:bg-app-card-dark border border-app-border dark:border-app-border-dark p-4 rounded-[12px] space-y-3'

function BotoesSimNao({ sim, onChange, disabled, nome }: { sim: boolean; onChange: (v: boolean) => void; disabled: boolean; nome: string }) {
  const base = 'px-3 py-1 rounded-full text-xs font-normal border transition-all'
  const off = 'border-app-border text-app-text-secondary hover:border-[var(--app-primary)]/40'
  return (
    <div className="flex items-center gap-2" role="group" aria-label={nome}>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={sim}
        onClick={() => onChange(true)}
        className={`${base} ${sim ? 'bg-app-primary border-[var(--app-primary)] text-white' : off} ${disabled ? 'opacity-70 cursor-not-allowed' : ''}`}
      >
        Sim
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={!sim}
        onClick={() => onChange(false)}
        className={`${base} ${!sim ? 'bg-app-bg-secondary/60 border-app-border text-app-text-secondary' : off} ${disabled ? 'opacity-70 cursor-not-allowed' : ''}`}
      >
        Não
      </button>
    </div>
  )
}

/** Pergunta fixa Sim/Não; marcando Sim abre o campo para descrever qual. */
export function PerguntaFixaSimNao({
  titulo,
  sim,
  texto,
  onSim,
  onTexto,
  disabled,
  testId,
}: {
  titulo: string
  sim: boolean
  texto: string
  onSim: (v: boolean) => void
  onTexto: (v: string) => void
  disabled: boolean
  testId: string
}) {
  return (
    <div className={CARTAO_CLASSE} data-testid={testId}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-normal text-app-text-primary dark:text-gray-200">{titulo}?</span>
        <BotoesSimNao sim={sim} onChange={onSim} disabled={disabled} nome={titulo} />
      </div>
      {sim && (
        <div className="space-y-2">
          <Label className="text-xs font-normal text-app-text-muted uppercase tracking-wider">Qual?</Label>
          <Textarea
            value={texto}
            onChange={(e) => onTexto(e.target.value)}
            readOnly={disabled}
            className={`min-h-[80px] resize-none ${CAMPO_CLASSE}`}
            placeholder="Descreva..."
          />
        </div>
      )}
    </div>
  )
}

function CampoPersonalizado({ campo, valor, onChange, disabled }: { campo: CampoPersonalizadoDef; valor: string; onChange: (v: string) => void; disabled: boolean }) {
  if (campo.tipo === 'booleano') {
    return (
      <div className={CARTAO_CLASSE}>
        <div className="flex items-center justify-between gap-3">
          <span className="font-normal text-app-text-primary dark:text-gray-200">{campo.label}?</span>
          <BotoesSimNao sim={valor === 'sim'} onChange={(v) => onChange(v ? 'sim' : 'nao')} disabled={disabled} nome={campo.label} />
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <Label className="font-normal text-app-text-primary dark:text-white">{campo.label}</Label>
      <Input
        type="text"
        inputMode={campo.tipo === 'numero' ? 'decimal' : undefined}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        readOnly={disabled}
        className={`h-11 px-4 ${CAMPO_CLASSE}`}
      />
    </div>
  )
}

/** Campos personalizados cadastrados na tela Anamnese + "Adicionar campo" avulso (só desta anamnese). */
export function CamposPersonalizadosAtendimento({ disabled }: { disabled: boolean }) {
  const { anamneseType, anamneseData, setAnamneseData, camposAnamnese, setCamposAnamnese } = useAtendimento()
  const api = useApi()
  const [novoRotulo, setNovoRotulo] = useState('')
  const [novoValor, setNovoValor] = useState('')
  const [adicionando, setAdicionando] = useState(false)

  useEffect(() => {
    let ativo = true
    api
      .get<{ data: CampoPersonalizadoDef[] }>('/api/anamnese/campos')
      .then((res) => ativo && setCamposAnamnese(res.data ?? []))
      .catch(() => ativo && setCamposAnamnese([]))
    return () => {
      ativo = false
    }
  }, [api, setCamposAnamnese])

  const visiveis = camposPersonalizadosVisiveis(camposAnamnese, anamneseType === 'consulta')

  const adicionar = () => {
    const label = novoRotulo.trim()
    if (!label || !novoValor.trim()) return
    setAnamneseData((p) => ({
      ...p,
      camposAdicionais: [...p.camposAdicionais, { id: `${Date.now()}-${p.camposAdicionais.length}`, label, valor: novoValor.trim() }],
    }))
    setNovoRotulo('')
    setNovoValor('')
    setAdicionando(false)
  }

  const remover = (id: string) =>
    setAnamneseData((p) => ({ ...p, camposAdicionais: p.camposAdicionais.filter((c) => c.id !== id) }))

  return (
    <div className="space-y-4" data-testid="campos-personalizados-atendimento">
      {(visiveis.length > 0 || anamneseData.camposAdicionais.length > 0 || !disabled) && (
        <h3 className="font-normal text-app-text-primary dark:text-white text-lg">Campos personalizados</h3>
      )}
      <div className="grid gap-4">
        {visiveis.map((campo) => (
          <CampoPersonalizado
            key={campo.id}
            campo={campo}
            valor={anamneseData.camposPersonalizados[campo.id] ?? ''}
            disabled={disabled}
            onChange={(v) => setAnamneseData((p) => ({ ...p, camposPersonalizados: { ...p.camposPersonalizados, [campo.id]: v } }))}
          />
        ))}
        {anamneseData.camposAdicionais.map((c) => (
          <div key={c.id} className={`${CARTAO_CLASSE} flex items-start justify-between gap-3`}>
            <div className="min-w-0">
              <p className="text-sm text-app-text-muted">{c.label}</p>
              <p className="font-normal text-app-text-primary dark:text-white break-words">{c.valor}</p>
            </div>
            {!disabled && (
              <Button type="button" variant="ghost" size="icon" aria-label={`Remover ${c.label}`} className="h-10 w-10 shrink-0" onClick={() => remover(c.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
      {!disabled &&
        (adicionando ? (
          <div className={CARTAO_CLASSE}>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="font-normal text-app-text-primary dark:text-white">Nome do campo</Label>
                <Input value={novoRotulo} onChange={(e) => setNovoRotulo(e.target.value)} placeholder="Ex: Gestante" className={`h-11 px-4 ${CAMPO_CLASSE}`} />
              </div>
              <div className="space-y-2">
                <Label className="font-normal text-app-text-primary dark:text-white">Informação</Label>
                <Input value={novoValor} onChange={(e) => setNovoValor(e.target.value)} placeholder="Descreva..." className={`h-11 px-4 ${CAMPO_CLASSE}`} />
              </div>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" className="h-11 font-normal" onClick={() => setAdicionando(false)}>
                Cancelar
              </Button>
              <Button type="button" className="h-11 bg-app-primary text-white font-normal" disabled={!novoRotulo.trim() || !novoValor.trim()} onClick={adicionar}>
                Incluir
              </Button>
            </div>
          </div>
        ) : (
          <Button type="button" variant="outline" className="h-11 rounded-integrallys font-normal gap-2" onClick={() => setAdicionando(true)}>
            <Plus className="h-4 w-4" /> Adicionar campo
          </Button>
        ))}
    </div>
  )
}
