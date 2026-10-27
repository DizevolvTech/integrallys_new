'use client'

import { CalendarPlus, Search } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { DateInput } from '@/components/shared/date-input'
import { EmptyState } from '@/components/shared/empty-state'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/hooks/use-auth'
import { useUsuarios } from '@/hooks/use-usuarios'
import { useProcedimentos } from '@/features/procedimentos/hooks/use-procedimentos'
import { ROTULO_SITUACAO_RETORNO, SITUACOES_RETORNO, type SituacaoRetorno } from '@/lib/retorno-prazo'
import type { RetornoItem } from '@/types/retorno'
import { useRetornos, type RetornosFiltros } from './hooks/use-retornos'

const TODOS = 'todos'
const PAGE_SIZE = 20

const TOM_SITUACAO: Record<SituacaoRetorno, 'success' | 'warning' | 'danger'> = {
  no_prazo: 'success',
  limite: 'warning',
  vencido: 'danger',
}

export function hrefAgendarRetorno(item: Pick<RetornoItem, 'pacienteId' | 'especialistaId'>) {
  const params = new URLSearchParams({ modal: 'novo', patientId: item.pacienteId, tipo: 'retorno' })
  if (item.especialistaId) params.set('profissionalId', item.especialistaId)
  return `/agenda?${params.toString()}`
}

interface RetornosRelatorioProps {
  /** Situação inicial do filtro (ex.: vinda de ?situacao= na URL). */
  situacaoInicial?: string
}

/** Relatório de retornos a agendar (reutilizável em /retornos e em abas de relatórios). */
export function RetornosRelatorio({ situacaoInicial = '' }: RetornosRelatorioProps) {
  const role = useAuth((s) => s.user?.role)
  const isEspecialista = role === 'especialista'
  const { data: usuarios } = useUsuarios()
  const { data: procedimentos } = useProcedimentos()
  const [filtros, setFiltros] = useState<RetornosFiltros>({
    situacao: SITUACOES_RETORNO.includes(situacaoInicial as SituacaoRetorno) ? situacaoInicial : '',
    q: '',
    profissionalId: '',
    procedimentoId: '',
    de: '',
    ate: '',
    page: 1,
    pageSize: PAGE_SIZE,
  })
  const { data, meta, isLoading, error } = useRetornos(filtros)

  const atualizar = (patch: Partial<RetornosFiltros>) =>
    setFiltros((atual) => ({ ...atual, ...patch, page: patch.page ?? 1 }))

  const especialistas = usuarios.filter((u) => u.perfil === 'especialista')
  const totalPaginas = meta ? Math.max(1, Math.ceil(meta.total / meta.pageSize)) : 1

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {SITUACOES_RETORNO.map((situacao) => {
          const ativo = filtros.situacao === situacao
          return (
            <button
              key={situacao}
              type="button"
              onClick={() => atualizar({ situacao: ativo ? '' : situacao })}
              className={`rounded-integrallys-lg border p-4 text-left transition-colors ${
                ativo
                  ? 'border-[var(--app-primary)] bg-app-bg-secondary'
                  : 'border-app-border bg-app-card hover:bg-app-bg-secondary dark:border-app-border-dark dark:bg-app-card-dark'
              }`}
            >
              <p className="text-xs uppercase tracking-wider text-app-text-muted">
                {ROTULO_SITUACAO_RETORNO[situacao]}
              </p>
              <p className="mt-1 text-2xl font-normal text-app-text-primary dark:text-white">
                {meta?.contagem[situacao] ?? '—'}
              </p>
            </button>
          )
        })}
      </div>

      <Card className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-text-muted" />
          <Input
            aria-label="Buscar cliente"
            placeholder="Buscar cliente"
            className="pl-9"
            value={filtros.q}
            onChange={(e) => atualizar({ q: e.target.value })}
          />
        </div>
        {!isEspecialista && (
          <Select
            value={filtros.profissionalId || TODOS}
            onValueChange={(v) => atualizar({ profissionalId: v === TODOS ? '' : v })}
          >
            <SelectTrigger aria-label="Profissional">
              <SelectValue placeholder="Profissional" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos os profissionais</SelectItem>
              {especialistas.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select
          value={filtros.procedimentoId || TODOS}
          onValueChange={(v) => atualizar({ procedimentoId: v === TODOS ? '' : v })}
        >
          <SelectTrigger aria-label="Especialidade">
            <SelectValue placeholder="Especialidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas as especialidades</SelectItem>
            {procedimentos.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filtros.situacao || TODOS}
          onValueChange={(v) => atualizar({ situacao: v === TODOS ? '' : v })}
        >
          <SelectTrigger aria-label="Situação">
            <SelectValue placeholder="Situação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas as situações</SelectItem>
            {SITUACOES_RETORNO.map((s) => (
              <SelectItem key={s} value={s}>
                {ROTULO_SITUACAO_RETORNO[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-xs text-app-text-muted">Atendimento de</span>
          <DateInput value={filtros.de} onChange={(v) => atualizar({ de: v })} />
        </div>
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-xs text-app-text-muted">até</span>
          <DateInput value={filtros.ate} onChange={(v) => atualizar({ ate: v })} />
        </div>
      </Card>

      {error && (
        <Card className="border-[var(--app-danger-border)] bg-[var(--app-danger-bg)] p-4 text-sm text-[var(--app-danger-text)]">
          {error}
        </Card>
      )}

      <Card className="overflow-hidden">
        {isLoading ? (
          <p className="p-8 text-center text-sm text-app-text-muted">Carregando retornos…</p>
        ) : data.length === 0 ? (
          <EmptyState
            title="Nenhum retorno a agendar"
            description="Os retornos definidos no fim do atendimento aparecem aqui até serem agendados."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Últimos procedimentos</TableHead>
                  <TableHead>Especialista</TableHead>
                  <TableHead>Retorno previsto</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-nowrap">{item.data}</TableCell>
                    <TableCell>{item.paciente}</TableCell>
                    <TableCell>
                      {item.ultimosProcedimentos.length === 0 ? (
                        <span className="text-app-text-muted">—</span>
                      ) : (
                        <ul className="space-y-0.5 text-xs">
                          {item.ultimosProcedimentos.map((p) => (
                            <li key={`${p.data}-${p.nome}`}>
                              {p.nome} <span className="text-app-text-muted">({p.data})</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </TableCell>
                    <TableCell>{item.especialista || '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {item.dataPrevista || <span className="text-app-text-muted">{item.prazo}</span>}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={TOM_SITUACAO[item.situacao]}>
                        {ROTULO_SITUACAO_RETORNO[item.situacao]}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" className="bg-app-primary text-white">
                        <Link href={hrefAgendarRetorno(item)}>
                          <CalendarPlus className="mr-1.5 h-4 w-4" />
                          Agendar retorno
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {meta && meta.total > meta.pageSize && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-app-text-muted">
            Página {meta.page} de {totalPaginas} · {meta.total} retornos
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={filtros.page <= 1}
              onClick={() => atualizar({ page: filtros.page - 1 })}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              disabled={filtros.page >= totalPaginas}
              onClick={() => atualizar({ page: filtros.page + 1 })}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
