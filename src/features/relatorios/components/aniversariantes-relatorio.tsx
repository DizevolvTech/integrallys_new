'use client'

import { useState } from 'react'
import { CheckSquare, Square } from 'lucide-react'
import { DateInput } from '@/components/shared/date-input'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatData, hojeIso } from '@/features/relatorios/format'
import { useAniversariantes } from '@/features/relatorios/hooks/use-aniversariantes'

/** Relatório de aniversariantes (gestor/administrador) com o envio da mensagem gravado no banco. */
export function AniversariantesRelatorio() {
  const [modo, setModo] = useState<'dia' | 'mes'>('mes')
  const [data, setData] = useState(hojeIso())
  const [q, setQ] = useState('')
  const [enviado, setEnviado] = useState('todos')
  const { linhas, total, isLoading, error, marcar } = useAniversariantes({ modo, data, q, enviado })
  const enviados = linhas.filter((l) => l.enviado).length

  return (
    <div className="space-y-5">
      <p className="text-sm text-app-text-secondary dark:text-white/60">
        Clientes que fazem aniversário no dia ou no mês escolhido e se a mensagem de felicitação já foi enviada.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Select value={modo} onValueChange={(v) => setModo(v as 'dia' | 'mes')}>
          <SelectTrigger className="h-10 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dia">Aniversariantes do dia</SelectItem>
            <SelectItem value="mes">Aniversariantes do mês</SelectItem>
          </SelectContent>
        </Select>
        <DateInput value={data} onChange={setData} className="h-10" />
        <Input placeholder="Buscar por nome" value={q} onChange={(e) => setQ(e.target.value)} className="h-10 rounded-xl" />
        <Select value={enviado} onValueChange={setEnviado}>
          <SelectTrigger className="h-10 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Mensagem: todos</SelectItem>
            <SelectItem value="sim">Mensagem enviada</SelectItem>
            <SelectItem value="nao">Mensagem pendente</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {error && <p className="text-sm text-[var(--app-danger-text)]">{error}</p>}
      <div className="overflow-x-auto rounded-xl border border-app-border dark:border-app-border-dark">
        <Table className="min-w-[620px]">
          <TableHeader className="bg-app-bg-secondary/50 dark:bg-app-hover">
            <TableRow>
              <TableHead className="text-xs font-normal uppercase">Cliente</TableHead>
              <TableHead className="text-xs font-normal uppercase">Nascimento</TableHead>
              <TableHead className="text-xs font-normal uppercase">Idade</TableHead>
              <TableHead className="text-xs font-normal uppercase">Telefone</TableHead>
              <TableHead className="text-center text-xs font-normal uppercase">Ok, mensagem enviada</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && linhas.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-app-text-secondary">Carregando...</TableCell>
              </TableRow>
            )}
            {!isLoading && linhas.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-app-text-secondary">
                  Nenhum aniversariante para o filtro selecionado.
                </TableCell>
              </TableRow>
            )}
            {linhas.map((l) => (
              <TableRow key={l.id}>
                <TableCell>{l.nome}</TableCell>
                <TableCell>{formatData(l.nascimento)}</TableCell>
                <TableCell>{l.idade}</TableCell>
                <TableCell>{l.telefone}</TableCell>
                <TableCell className="text-center">
                  <button
                    type="button"
                    onClick={() => void marcar(l.id, !l.enviado)}
                    title={l.enviado ? 'Desmarcar envio' : 'Marcar mensagem como enviada'}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-app-bg-secondary dark:hover:bg-app-hover"
                  >
                    {l.enviado ? (
                      <CheckSquare className="h-5 w-5 text-[var(--app-primary)]" />
                    ) : (
                      <Square className="h-5 w-5 text-app-text-muted" />
                    )}
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-app-text-secondary">
        {total} aniversariante(s) · {enviados} com mensagem enviada
      </p>
    </div>
  )
}
