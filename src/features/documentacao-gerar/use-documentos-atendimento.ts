'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useApi } from '@/hooks/use-api'
import {
  comLayoutPadrao,
  conteudoDeTexto,
  resolverConteudo,
  tokenizarConteudo,
  type ContextoVariaveis,
  type TemplateConteudo,
} from '@/lib/documentos'
import type { DocumentosAtendimentoPayload } from '@/app/api/documentos/atendimento/route'
import type { PreenchimentoContexto, ValoresForm } from './types'

export type OrigemModelo = 'pessoal' | 'clinica' | 'padrao'

export interface EstadoDocumento {
  conteudo: TemplateConteudo
  valores: ValoresForm
  origem: OrigemModelo
}

interface Params {
  pacienteId?: string | null
  agendamentoId?: string | null
  pacienteNome: string
  pacienteCpf?: string
  /** Texto padrão de cada documento (usado só quando a clínica não tem modelo). */
  padroes: Record<string, string>
}

/**
 * Estado da etapa Documentos do atendimento: texto inicial = modelo da clínica (ou o pessoal do especialista)
 * com paciente/profissional/data/clínica já preenchidos; edição amigável; Salvar modelo / Restaurar padrão.
 */
export function useDocumentosAtendimento({ pacienteId, agendamentoId, pacienteNome, pacienteCpf, padroes }: Params) {
  const api = useApi()
  const [payload, setPayload] = useState<DocumentosAtendimentoPayload | null>(null)
  const [pessoalSalvo, setPessoalSalvo] = useState<Record<string, TemplateConteudo | null>>({})
  const [edicoes, setEdicoes] = useState<Record<string, { conteudo?: TemplateConteudo; valores?: ValoresForm }>>({})
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [agora] = useState(() => new Date())

  useEffect(() => {
    let ativo = true
    const params = new URLSearchParams()
    if (pacienteId) params.set('pacienteId', pacienteId)
    if (agendamentoId) params.set('agendamentoId', agendamentoId)
    api
      .get<{ data: DocumentosAtendimentoPayload }>(`/api/documentos/atendimento?${params}`)
      .then((res) => ativo && setPayload(res.data))
      .catch(() => {
        if (ativo) {
          setPayload({ modelos: {}, contexto: {} })
          toast.error('Não foi possível carregar os modelos da clínica. Usando o texto padrão.')
        }
      })
    return () => {
      ativo = false
    }
  }, [api, pacienteId, agendamentoId])

  const contextoVariaveis = useMemo<ContextoVariaveis>(() => {
    const c = payload?.contexto ?? {}
    return {
      ...c,
      agora,
      cliente: { nome: c.cliente?.nome || pacienteNome, cpf: c.cliente?.cpf || (pacienteCpf && /\d{11}/.test(pacienteCpf.replace(/\D/g, '')) ? pacienteCpf : undefined) },
    }
  }, [payload, agora, pacienteNome, pacienteCpf])

  const contextoPreview = useMemo<PreenchimentoContexto>(
    () => ({
      cliente: contextoVariaveis.cliente,
      agendamento: contextoVariaveis.agendamento,
      profissional: contextoVariaveis.profissional,
      clinica: payload?.contexto.clinica
        ? { ...contextoVariaveis.clinica, cor_primaria: payload.contexto.clinica.cor_primaria ?? undefined }
        : undefined,
    }),
    [contextoVariaveis, payload],
  )

  /** Modelo inicial do documento, com as variáveis já preenchidas. */
  const modeloInicial = useCallback(
    (docId: string): { conteudo: TemplateConteudo; origem: OrigemModelo } => {
      const m = payload?.modelos[docId]
      const pessoal = docId in pessoalSalvo ? pessoalSalvo[docId] : m?.pessoal
      const escolhido = pessoal ?? m?.clinica ?? null
      const origem: OrigemModelo = pessoal ? 'pessoal' : m?.clinica ? 'clinica' : 'padrao'
      const conteudo = comLayoutPadrao(docId, escolhido ?? conteudoDeTexto(padroes[docId] ?? ''))
      return { conteudo: resolverConteudo(conteudo, contextoVariaveis), origem }
    },
    [payload, pessoalSalvo, padroes, contextoVariaveis],
  )

  const estadoDe = useCallback(
    (docId: string): EstadoDocumento => {
      const inicial = modeloInicial(docId)
      const e = edicoes[docId]
      return { conteudo: e?.conteudo ?? inicial.conteudo, valores: e?.valores ?? {}, origem: inicial.origem }
    },
    [modeloInicial, edicoes],
  )

  const editar = useCallback((docId: string, parcial: { conteudo?: TemplateConteudo; valores?: ValoresForm }) => {
    setEdicoes((prev) => ({ ...prev, [docId]: { ...prev[docId], ...parcial } }))
  }, [])

  const salvarModelo = useCallback(
    async (docId: string, titulo: string) => {
      setOcupado(docId)
      try {
        const conteudo = tokenizarConteudo(estadoDe(docId).conteudo, contextoVariaveis)
        await api.put('/api/documentos/modelos-pessoais', { slug: docId, conteudo })
        setPessoalSalvo((prev) => ({ ...prev, [docId]: conteudo }))
        setEdicoes((prev) => ({ ...prev, [docId]: { ...prev[docId], conteudo: undefined } }))
        toast.success(`Modelo "${titulo}" salvo. Ele vai abrir assim nos próximos atendimentos.`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Não foi possível salvar o modelo.')
      } finally {
        setOcupado(null)
      }
    },
    [api, estadoDe, contextoVariaveis],
  )

  const restaurarPadrao = useCallback(
    async (docId: string, titulo: string) => {
      setOcupado(docId)
      try {
        await api.delete('/api/documentos/modelos-pessoais', { slug: docId })
        setPessoalSalvo((prev) => ({ ...prev, [docId]: null }))
        setEdicoes((prev) => ({ ...prev, [docId]: {} }))
        toast.success(`"${titulo}" voltou ao modelo da clínica.`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Não foi possível restaurar o modelo padrão.')
      } finally {
        setOcupado(null)
      }
    },
    [api],
  )

  return {
    carregando: payload === null,
    contextoVariaveis,
    contextoPreview,
    estadoDe,
    editar,
    salvarModelo,
    restaurarPadrao,
    ocupado,
  }
}
