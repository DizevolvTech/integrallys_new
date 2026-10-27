'use client'

import { useMemo, useState } from 'react'
import {
  ArrowDownLeft,
  CreditCard,
  Plus,
  Receipt,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/shared/page-header'
import { SegmentedControl } from '@/components/shared/segmented-control'
import { StatCard } from '@/components/shared/stat-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useContasBancarias } from '@/features/gestao-bancaria/hooks/use-contas-bancarias'
import {
  useCartoesEmpresariais,
  type CartaoEmpresarial,
  type NovoCartaoInput,
  type NovoMovimentoInput,
} from './hooks/use-cartoes-empresariais'
import { NovoCartaoModal } from './modals/novo-cartao-modal'
import { DetalheCartaoModal } from './modals/detalhe-cartao-modal'
import { RegistrarGastoModal } from './modals/registrar-gasto-modal'

type Aba = 'corporativos' | 'recebiveis'

const ABAS: { value: Aba; label: string }[] = [
  { value: 'corporativos', label: 'Cartões de crédito da clínica' },
  { value: 'recebiveis', label: 'Recebíveis de clientes (maquininha)' },
]

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return '—'
  return `${day}/${month}/${year}`
}

export function CartoesEmpresariaisView() {
  const {
    data,
    isLoading,
    error,
    criarCartao,
    registrarMovimento,
  } = useCartoesEmpresariais()
  const { data: contas } = useContasBancarias()
  const contaNomeById = useMemo(() => new Map(contas.map((conta) => [conta.id, conta.nome])), [contas])

  const [aba, setAba] = useState<Aba>('corporativos')
  const [novoCartaoOpen, setNovoCartaoOpen] = useState(false)
  const [detalheCartaoId, setDetalheCartaoId] = useState<string | null>(null)
  const [registrarGastoCartao, setRegistrarGastoCartao] = useState<CartaoEmpresarial | null>(null)
  const [isSavingCartao, setIsSavingCartao] = useState(false)
  const [isSavingMovimento, setIsSavingMovimento] = useState(false)

  const cartaoSelecionado = useMemo(
    () => data.cartoes.find((cartao) => cartao.id === detalheCartaoId) ?? null,
    [data.cartoes, detalheCartaoId],
  )

  const totaisCorporativos = useMemo(() => {
    return data.cartoes.reduce(
      (acc, cartao) => {
        acc.limiteTotal += cartao.limiteTotal
        acc.limiteUtilizado += cartao.limiteUtilizado
        acc.limiteDisponivel += cartao.limiteDisponivel
        acc.faturasAbertas += cartao.faturasAbertas
        return acc
      },
      { limiteTotal: 0, limiteUtilizado: 0, limiteDisponivel: 0, faturasAbertas: 0 },
    )
  }, [data.cartoes])

  const handleCriarCartao = async (payload: NovoCartaoInput) => {
    setIsSavingCartao(true)
    try {
      await criarCartao(payload)
      toast.success('Cartão cadastrado com sucesso.')
      setNovoCartaoOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao cadastrar cartão.')
    } finally {
      setIsSavingCartao(false)
    }
  }

  const handleRegistrarMovimento = async (payload: NovoMovimentoInput) => {
    setIsSavingMovimento(true)
    try {
      await registrarMovimento(payload)
      toast.success('Movimento registrado.')
      setRegistrarGastoCartao(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao registrar movimento.')
    } finally {
      setIsSavingMovimento(false)
    }
  }

  return (
    <div className="app-page app-page-loose">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <CreditCard className="h-6 w-6 text-[var(--app-primary)] dark:text-white" />
            Cartões Empresariais
          </span>
        }
        description="Cartão de crédito da clínica: compras, parcelas, faturas futuras e limite. Não são os recebimentos de crédito e débito dos clientes (esses estão em Recebíveis de clientes)."
        actions={
          <Button
            onClick={() => setNovoCartaoOpen(true)}
            className="h-11 rounded-xl bg-app-primary px-6 font-normal text-white"
          >
            <Plus className="mr-2 h-5 w-5" />
            Novo cartão
          </Button>
        }
      />

      <SegmentedControl
        options={ABAS}
        value={aba}
        onChange={(value) => setAba(value as Aba)}
        fullWidth={false}
      />

      {error && (
        <p className="text-sm text-[var(--app-danger-text)]">{error}</p>
      )}

      {aba === 'corporativos' ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Limite total"
              value={formatCurrency(totaisCorporativos.limiteTotal)}
              icon={CreditCard}
              iconTone="primary"
            />
            <StatCard
              label="Limite utilizado"
              value={formatCurrency(totaisCorporativos.limiteUtilizado)}
              icon={Receipt}
              iconTone="warning"
            />
            <StatCard
              label="Limite disponível"
              value={formatCurrency(totaisCorporativos.limiteDisponivel)}
              icon={Wallet}
              iconTone="success"
            />
            <StatCard
              label="Faturas futuras em aberto"
              value={formatCurrency(totaisCorporativos.faturasAbertas)}
              icon={ArrowDownLeft}
              iconTone="danger"
            />
          </div>

          {isLoading ? (
            <Card className="rounded-[24px] border-app-border/60 shadow-sm dark:border-app-border-dark">
              <CardContent className="py-12 text-center text-app-text-muted">
                Carregando cartões...
              </CardContent>
            </Card>
          ) : data.cartoes.length === 0 ? (
            <Card className="rounded-[24px] border-app-border/60 shadow-sm dark:border-app-border-dark">
              <CardContent className="py-12 text-center text-app-text-muted">
                Nenhum cartão empresarial cadastrado. Clique em &quot;Novo cartão&quot; para começar.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.cartoes.map((cartao) => {
                const utilizacao = cartao.limiteTotal > 0 ? (cartao.limiteUtilizado / cartao.limiteTotal) * 100 : 0
                return (
                  <button
                    key={cartao.id}
                    type="button"
                    onClick={() => setDetalheCartaoId(cartao.id)}
                    className="text-left transition-transform hover:-translate-y-1"
                  >
                    <Card className="h-full rounded-[24px] border-app-border/60 shadow-sm transition-shadow hover:shadow-md dark:border-app-border-dark">
                      <CardContent className="p-6 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-base font-medium text-app-text-primary dark:text-white">{cartao.nome}</p>
                            <div className="mt-1 flex items-center gap-2 text-xs text-app-text-muted">
                              {cartao.bandeira && (
                                <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px] font-medium">
                                  {cartao.bandeira}
                                </Badge>
                              )}
                              {cartao.ultimosDigitos && <span>•••• {cartao.ultimosDigitos}</span>}
                            </div>
                          </div>
                          <span className="rounded-2xl bg-[color:var(--app-info-bg)] p-2.5 text-[color:var(--app-info-text)]">
                            <CreditCard className="h-5 w-5" />
                          </span>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-baseline justify-between text-xs text-app-text-muted">
                            <span>Limite utilizado</span>
                            <span className="tabular-nums">{utilizacao.toFixed(0)}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-app-bg-secondary dark:bg-app-hover">
                            <div
                              className="h-full rounded-full bg-app-primary"
                              style={{ width: `${Math.min(100, utilizacao)}%` }}
                            />
                          </div>
                          <div className="flex items-baseline justify-between text-sm">
                            <span className="text-app-text-secondary">{formatCurrency(cartao.limiteUtilizado)}</span>
                            <span className="font-medium text-app-text-primary dark:text-white">
                              {formatCurrency(cartao.limiteTotal)}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                          <div>
                            <p className="text-app-text-muted">Disponível</p>
                            <p className="font-medium text-[color:var(--app-success-text)]">
                              {formatCurrency(cartao.limiteDisponivel)}
                            </p>
                          </div>
                          <div>
                            <p className="text-app-text-muted">Próximo vencimento</p>
                            <p className="font-medium text-app-text-primary dark:text-white">
                              {formatDate(cartao.proximoVencimento)}
                            </p>
                          </div>
                        </div>

                        {cartao.contaBancariaId && (
                          <div className="pt-1 text-xs">
                            <p className="text-app-text-muted">Conta de débito da fatura</p>
                            <p className="font-medium text-app-text-primary dark:text-white">
                              {contaNomeById.get(cartao.contaBancariaId) ?? '—'}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </button>
                )
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Crédito bruto (mês)"
              value={formatCurrency(data.totaisRecebiveis.brutoCredito)}
              iconTone="primary"
            />
            <StatCard
              label="Crédito líquido"
              value={formatCurrency(data.totaisRecebiveis.liquidoCredito)}
              iconTone="success"
            />
            <StatCard
              label="Débito bruto (mês)"
              value={formatCurrency(data.totaisRecebiveis.brutoDebito)}
              iconTone="primary"
            />
            <StatCard
              label="Débito líquido"
              value={formatCurrency(data.totaisRecebiveis.liquidoDebito)}
              iconTone="success"
            />
          </div>

          <Card className="rounded-[24px] border-app-border/60 shadow-sm dark:border-app-border-dark">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="py-12 text-center text-app-text-muted">Carregando recebíveis...</div>
              ) : data.recebiveisConsolidado.length === 0 ? (
                <div className="py-12 text-center text-app-text-muted">
                  Nenhum recebível via cartão registrado neste mês.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-app-bg-secondary/50 dark:bg-app-hover">
                      <TableRow>
                        <TableHead className="text-xs font-medium uppercase tracking-wider text-app-text-secondary">
                          Bandeira
                        </TableHead>
                        <TableHead className="text-xs font-medium uppercase tracking-wider text-app-text-secondary">
                          Tipo
                        </TableHead>
                        <TableHead className="text-xs font-medium uppercase tracking-wider text-app-text-secondary">
                          Lançamentos
                        </TableHead>
                        <TableHead className="text-right text-xs font-medium uppercase tracking-wider text-app-text-secondary">
                          Bruto
                        </TableHead>
                        <TableHead className="text-right text-xs font-medium uppercase tracking-wider text-app-text-secondary">
                          Taxa
                        </TableHead>
                        <TableHead className="text-right text-xs font-medium uppercase tracking-wider text-app-text-secondary">
                          Líquido
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.recebiveisConsolidado.map((row) => (
                        <TableRow key={`${row.bandeira}-${row.tipo}`}>
                          <TableCell className="font-normal text-app-text-primary dark:text-white">
                            {row.bandeira}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="rounded-full px-3 py-1 text-xs font-medium capitalize"
                            >
                              {row.tipo}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-app-text-secondary dark:text-white/70">
                            {row.quantidade}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-normal text-app-text-primary dark:text-white">
                            {formatCurrency(row.bruto)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-app-text-secondary dark:text-white/70">
                            {row.taxa.toFixed(2)}% ({formatCurrency(row.taxaValor)})
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium text-[color:var(--app-success-text)]">
                            {formatCurrency(row.liquido)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <NovoCartaoModal
        open={novoCartaoOpen}
        onClose={() => setNovoCartaoOpen(false)}
        onSubmit={handleCriarCartao}
        isSubmitting={isSavingCartao}
      />

      <DetalheCartaoModal
        open={Boolean(cartaoSelecionado)}
        cartao={cartaoSelecionado}
        onClose={() => setDetalheCartaoId(null)}
        onRegistrarGasto={() => {
          if (cartaoSelecionado) {
            setRegistrarGastoCartao(cartaoSelecionado)
            setDetalheCartaoId(null)
          }
        }}
      />

      <RegistrarGastoModal
        open={Boolean(registrarGastoCartao)}
        cartaoId={registrarGastoCartao?.id ?? null}
        cartaoNome={registrarGastoCartao?.nome}
        onClose={() => setRegistrarGastoCartao(null)}
        onSubmit={handleRegistrarMovimento}
        isSubmitting={isSavingMovimento}
      />
    </div>
  )
}
