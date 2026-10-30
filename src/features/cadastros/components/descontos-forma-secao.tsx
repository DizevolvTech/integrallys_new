'use client'

import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDescontosForma } from '@/features/formas-pagamento/hooks/use-descontos-forma'
import {
  FORMAS_COM_DESCONTO,
  ROTULO_FORMA_COM_DESCONTO,
  type DescontosPorForma,
} from '@/lib/desconto-forma'

/** Cadastro do gestor: percentual de desconto de cada forma de pagamento. A venda aplica e trava. */
export function DescontosFormaSecao() {
  const { descontos, isLoading, error, salvar } = useDescontosForma()
  const [form, setForm] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    setForm(Object.fromEntries(FORMAS_COM_DESCONTO.map((forma) => [forma, String(descontos[forma])])))
  }, [descontos])

  const handleSalvar = async () => {
    const proximo = {} as DescontosPorForma
    for (const forma of FORMAS_COM_DESCONTO) {
      const valor = Number(form[forma])
      if (form[forma] === '' || !Number.isFinite(valor) || valor < 0 || valor > 100) {
        toast.error(`${ROTULO_FORMA_COM_DESCONTO[forma]}: informe um percentual de 0 a 100.`)
        return
      }
      proximo[forma] = valor
    }
    setSalvando(true)
    try {
      await salvar(proximo)
      toast.success('Descontos por forma de pagamento salvos.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar os descontos.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-medium text-app-text-primary dark:text-white">Descontos por forma de pagamento</h2>
        <p className="text-sm text-app-text-muted">
          Percentual aplicado automaticamente em Prescrição/Vendas conforme a forma escolhida. Na venda o desconto vem
          travado: ninguém altera na tela de venda, só aqui.
        </p>
      </div>
      {error && <p className="text-sm text-[var(--app-danger-text)]">{error}</p>}
      <div className="grid max-w-3xl grid-cols-1 gap-4 rounded-[18px] border border-app-border p-5 dark:border-app-border-dark sm:grid-cols-2">
        {FORMAS_COM_DESCONTO.map((forma) => (
          <div key={forma} className="space-y-2">
            <Label htmlFor={`desconto-${forma}`} className="font-normal text-app-text-primary dark:text-white/80">
              {ROTULO_FORMA_COM_DESCONTO[forma]}
            </Label>
            <div className="relative">
              <Input
                id={`desconto-${forma}`}
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step="0.01"
                disabled={isLoading}
                value={form[forma] ?? ''}
                onChange={(event) => setForm((atual) => ({ ...atual, [forma]: event.target.value }))}
                className="h-12 rounded-2xl pr-10"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-app-text-muted">%</span>
            </div>
          </div>
        ))}
        <div className="flex sm:col-span-2 sm:justify-end">
          <Button
            onClick={() => void handleSalvar()}
            disabled={salvando || isLoading}
            className="h-11 w-full rounded-xl bg-app-primary px-6 font-normal text-white sm:w-auto"
          >
            <Save className="mr-2 h-4 w-4" />
            {salvando ? 'Salvando...' : 'Salvar descontos'}
          </Button>
        </div>
      </div>
    </section>
  )
}
