'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Building2, Upload } from 'lucide-react'
import { AcessoNegadoState } from '@/components/shared/acesso-negado-state'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useCadastro } from '@/features/cadastros/hooks/use-cadastro'
import { useContasBancarias, type ContaBancariaInput, type ContaTipo } from './hooks/use-contas-bancarias'
import { ImportarOfxModal } from './modals/importar-ofx-modal'
import { ContaExtrato } from './components/conta-extrato'

const TIPO_LABEL: Record<ContaTipo, string> = {
  corrente: 'Corrente',
  poupanca: 'Poupança',
  investimento: 'Investimento',
  dinheiro: 'Dinheiro',
}

export function GestaoBancariaView() {
  const { data, isLoading, error, accessDenied, create } = useContasBancarias()
  const { data: bancos } = useCadastro('bancos')
  const [isCreating, setIsCreating] = useState(false)
  const [isOfxOpen, setIsOfxOpen] = useState(false)
  const [selectedContaId, setSelectedContaId] = useState<string | null>(null)
  const [form, setForm] = useState<ContaBancariaInput>({
    nome: '',
    banco: '',
    agencia: '',
    conta: '',
    tipo: 'corrente',
    saldoInicial: 0,
  })
  const [isSaving, setIsSaving] = useState(false)
  const selectedConta = data.find((c) => c.id === selectedContaId) ?? null

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const handleSubmit = async () => {
    if (isSaving) return
    if (!form.nome.trim()) {
      toast.error('Informe o nome da conta')
      return
    }
    setIsSaving(true)
    try {
      await create({
        ...form,
        saldoInicial: Number(form.saldoInicial) || 0,
      })
      toast.success('Conta bancária criada.')
      setIsCreating(false)
      setForm({ nome: '', banco: '', bancoId: undefined, agencia: '', conta: '', tipo: 'corrente', saldoInicial: 0 })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao criar conta')
    } finally {
      setIsSaving(false)
    }
  }

  // 403: perfil sem permissão (ex.: recepção). Mostra SÓ o estado de acesso
  // negado — sem "Nova conta"/"Importar OFX", sem card de erro cru e sem o
  // estado de "nenhuma conta cadastrada". É a tela mais sensível das três.
  if (accessDenied) {
    return (
      <div className="app-page app-page-loose pb-10">
        <PageHeader
          title="Gestão Bancária"
          description="Contas bancárias da clínica e conciliação manual via OFX."
        />
        <AcessoNegadoState />
      </div>
    )
  }

  return (
    <div className="app-page app-page-loose pb-10">
      <PageHeader
        title="Gestão Bancária"
        description="Contas bancárias da clínica e conciliação manual via OFX."
        actions={
          <>
            <Button
              variant="outline"
              className="h-11 rounded-xl border-app-border dark:border-app-border-dark"
              onClick={() => setIsOfxOpen(true)}
              disabled={data.length === 0}
            >
              <Upload className="h-4 w-4 mr-2" />
              Importar OFX
            </Button>
            <Button
              className="h-11 rounded-xl bg-app-primary text-white hover:bg-app-primary-hover"
              onClick={() => setIsCreating(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova conta
            </Button>
          </>
        }
      />

      {error && (
        <Card className="rounded-integrallys-lg border-[var(--app-danger-border)] bg-[var(--app-danger-bg)] p-4 text-sm text-[var(--app-danger-text)]">
          {error}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {data.map((conta) => {
          const pctConciliado =
            conta.movimentosTotal > 0
              ? Math.round((conta.movimentosConciliados / conta.movimentosTotal) * 100)
              : 0
          const pendentes = conta.movimentosTotal - conta.movimentosConciliados
          const totalmenteConciliado = conta.movimentosTotal > 0 && pendentes === 0
          return (
            <Card
              key={conta.id}
              onClick={() => setSelectedContaId((prev) => (prev === conta.id ? null : conta.id))}
              className={`cursor-pointer rounded-[24px] border-app-border bg-app-card p-6 shadow-sm transition-shadow hover:shadow-md dark:border-app-border-dark dark:bg-app-card-dark ${
                selectedContaId === conta.id ? 'ring-2 ring-app-primary/40' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-app-text-secondary" />
                  <h3 className="font-medium text-app-text-primary dark:text-white">
                    {conta.nome}
                  </h3>
                </div>
                <span className="text-xs text-app-text-muted">{TIPO_LABEL[conta.tipo]}</span>
              </div>
              <p className="text-xs text-app-text-muted">
                {[
                  conta.banco,
                  conta.agencia ? `Ag. ${conta.agencia}` : null,
                  conta.conta ? `Cc. ${conta.conta}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </p>
              <div className="mt-6 space-y-1">
                <p className="text-xs uppercase tracking-wider text-app-text-secondary dark:text-white/60">
                  Saldo atual{' '}
                  <span className="normal-case tracking-normal text-app-text-muted">· extrato</span>
                </p>
                <p className="text-2xl font-normal tabular-nums text-app-text-primary dark:text-white">
                  {formatCurrency(conta.saldoAtual)}
                </p>
                <p className="text-xs text-app-text-muted">
                  Inicial: {formatCurrency(conta.saldoInicial)}
                </p>
              </div>

              <div className="mt-4 rounded-2xl border border-app-border/70 bg-app-bg-secondary/40 p-3 dark:border-app-border-dark dark:bg-white/[0.03]">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-medium text-app-text-secondary dark:text-white/70">
                    Saldo conciliado
                  </span>
                  <span className="text-sm font-medium tabular-nums text-app-text-primary dark:text-white">
                    {formatCurrency(conta.saldoConciliado)}
                  </span>
                </div>
                {conta.movimentosTotal > 0 ? (
                  <>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-app-border/60 dark:bg-white/10">
                      <div
                        className={`h-full rounded-full transition-[width] duration-500 ${
                          totalmenteConciliado ? 'bg-[var(--app-success-text)]' : 'bg-app-primary'
                        }`}
                        style={{ width: `${pctConciliado}%` }}
                      />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-app-text-muted">
                      <span>
                        {conta.movimentosConciliados}/{conta.movimentosTotal} conciliados
                      </span>
                      {totalmenteConciliado ? (
                        <span className="font-medium text-[var(--app-success-text)]">100%</span>
                      ) : (
                        <span>{pendentes} a conciliar</span>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="mt-1.5 text-[11px] text-app-text-muted">
                    Sem movimentos importados
                  </p>
                )}
              </div>
            </Card>
          )
        })}

        {!isLoading && data.length === 0 && (
          <Card className="md:col-span-3 rounded-integrallys-lg border border-dashed border-app-border bg-app-bg-secondary/40 p-8 text-center text-sm text-app-text-muted dark:border-app-border-dark">
            Nenhuma conta bancária cadastrada. Use o botão "Nova conta" para criar a primeira.
          </Card>
        )}
      </div>

      {data.length > 0 && (
        <Card className="overflow-hidden rounded-[24px] border-app-border bg-app-card shadow-sm dark:border-app-border-dark dark:bg-app-card-dark">
          <div className="p-6 border-b border-app-border dark:border-app-border-dark">
            <h3 className="font-normal text-app-text-primary dark:text-white">
              Contas cadastradas
            </h3>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-app-bg-secondary/50 dark:bg-app-hover">
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Banco</TableHead>
                  <TableHead>Agência</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Saldo atual</TableHead>
                  <TableHead className="text-right">Saldo conciliado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((conta) => (
                  <TableRow
                    key={conta.id}
                    className={`cursor-pointer ${selectedContaId === conta.id ? 'bg-app-primary/5' : ''}`}
                    onClick={() =>
                      setSelectedContaId((prev) => (prev === conta.id ? null : conta.id))
                    }
                  >
                    <TableCell className="font-normal text-app-text-primary dark:text-white">
                      {conta.nome}
                    </TableCell>
                    <TableCell>{conta.banco ?? '—'}</TableCell>
                    <TableCell>{conta.agencia ?? '—'}</TableCell>
                    <TableCell>{conta.conta ?? '—'}</TableCell>
                    <TableCell>{TIPO_LABEL[conta.tipo]}</TableCell>
                    <TableCell className="text-right font-normal tabular-nums">
                      {formatCurrency(conta.saldoAtual)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-normal tabular-nums text-app-text-primary dark:text-white">
                        {formatCurrency(conta.saldoConciliado)}
                      </div>
                      {conta.movimentosTotal - conta.movimentosConciliados > 0 && (
                        <div className="text-[11px] text-app-text-muted">
                          {conta.movimentosTotal - conta.movimentosConciliados} a conciliar
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <ContaExtrato conta={selectedConta} onClose={() => setSelectedContaId(null)} />

      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="rounded-[24px]">
          <DialogHeader>
            <DialogTitle>Nova conta ou caixa</DialogTitle>
            <DialogDescription>
              Conta bancária (com banco/agência/conta) ou caixa em dinheiro (cofre, recepção — só
              nome e saldo). O saldo inicial é o ponto de partida do saldo atual.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome da conta</Label>
              <Input
                placeholder="Ex.: Conta principal"
                value={form.nome}
                onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                value={form.tipo}
                onValueChange={(value: ContaTipo) =>
                  setForm((prev) => ({
                    ...prev,
                    tipo: value,
                    // caixa em dinheiro (cofre/recepção) não tem dados bancários
                    ...(value === 'dinheiro' ? { banco: '', bancoId: undefined, agencia: '', conta: '' } : {}),
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="corrente">Corrente</SelectItem>
                  <SelectItem value="poupanca">Poupança</SelectItem>
                  <SelectItem value="investimento">Investimento</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.tipo !== 'dinheiro' && (
              <>
                <div className="space-y-1.5">
                  <Label>Banco</Label>
                  <Select
                    value={form.bancoId ?? 'none'}
                    onValueChange={(value) =>
                      setForm((prev) => ({ ...prev, bancoId: value === 'none' ? undefined : value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o banco" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não informado</SelectItem>
                      {bancos
                        .filter((banco) => banco.ativo)
                        .map((banco) => (
                          <SelectItem key={banco.id} value={banco.id}>
                            {banco.codigo ? `${banco.codigo} · ${banco.nome}` : banco.nome}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-app-text-muted">Lista editável em Cadastros › Bancos.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Agência</Label>
                    <Input
                      value={form.agencia ?? ''}
                      onChange={(e) => setForm((prev) => ({ ...prev, agencia: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Conta</Label>
                    <Input
                      value={form.conta ?? ''}
                      onChange={(e) => setForm((prev) => ({ ...prev, conta: e.target.value }))}
                    />
                  </div>
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label>Saldo inicial (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.saldoInicial}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, saldoInicial: Number(e.target.value) || 0 }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreating(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Criar conta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportarOfxModal
        open={isOfxOpen}
        onOpenChange={setIsOfxOpen}
        contas={data.map((c) => ({
          id: c.id,
          nome: c.nome,
          banco: c.banco,
          conta: c.conta,
          tipo: c.tipo,
        }))}
        defaultContaId={selectedContaId ?? data[0]?.id ?? null}
      />
    </div>
  )
}
