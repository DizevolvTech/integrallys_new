// Leitura e validação dos detalhes de um movimento de caixa (forma, cartão, conta do PIX e "Vinculado a").
import { normalizarFormaCaixa, type FormaCaixaCanonica } from '@/features/caixa/resumo-caixa'

export const VINCULO_TIPOS = ['paciente', 'fornecedor', 'prestador', 'colaborador', 'outro'] as const
export type VinculoTipo = (typeof VINCULO_TIPOS)[number]

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NOME_MAX = 120

export interface DetalhesMovimento {
  forma: FormaCaixaCanonica
  bandeira: string | null
  parcelas: number | null
  valorParcela: number | null
  contaBancariaId: string | null
  vinculoTipo: VinculoTipo | null
  vinculoId: string | null
  /** Só preenchido na entrada para "outro"; nos demais o servidor busca o nome no cadastro. */
  vinculoNome: string | null
}

type Resultado = { ok: true; value: DetalhesMovimento } | { ok: false; error: string; code: string }

const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export function lerDetalhesMovimento(body: Record<string, unknown>): Resultado {
  const forma = normalizarFormaCaixa(typeof body.forma === 'string' ? body.forma : null)
  const cartao = forma === 'cartao_credito' || forma === 'cartao_debito'

  const bandeira = cartao && texto(body.bandeira) ? texto(body.bandeira).slice(0, 40) : null
  const parcelas =
    forma === 'cartao_credito' && typeof body.parcelas === 'number' && body.parcelas >= 1 && body.parcelas <= 12
      ? Math.round(body.parcelas)
      : null
  const valorParcela =
    parcelas !== null && typeof body.valorParcela === 'number' && body.valorParcela >= 0
      ? Number(body.valorParcela.toFixed(2))
      : null

  let contaBancariaId: string | null = null
  if (forma === 'pix' && body.contaBancariaId != null && body.contaBancariaId !== '') {
    const id = texto(body.contaBancariaId)
    if (!UUID_RE.test(id)) return { ok: false, error: 'Conta do PIX inválida', code: 'CAIXA_CONTA_PIX_INVALIDA' }
    contaBancariaId = id
  }

  let vinculoTipo: VinculoTipo | null = null
  let vinculoId: string | null = null
  let vinculoNome: string | null = null
  const tipoBruto = texto(body.vinculoTipo)
  if (tipoBruto) {
    if (!(VINCULO_TIPOS as readonly string[]).includes(tipoBruto)) {
      return { ok: false, error: 'Tipo de vínculo inválido', code: 'CAIXA_VINCULO_INVALIDO' }
    }
    vinculoTipo = tipoBruto as VinculoTipo
    if (vinculoTipo === 'outro') {
      vinculoNome = texto(body.vinculoNome).slice(0, NOME_MAX)
      if (!vinculoNome) return { ok: false, error: 'Informe o nome em "Outro"', code: 'CAIXA_VINCULO_NOME_OBRIGATORIO' }
    } else {
      vinculoId = texto(body.vinculoId)
      if (!UUID_RE.test(vinculoId)) return { ok: false, error: 'Escolha a pessoa vinculada', code: 'CAIXA_VINCULO_PESSOA_OBRIGATORIA' }
    }
  }

  return { ok: true, value: { forma, bandeira, parcelas, valorParcela, contaBancariaId, vinculoTipo, vinculoId, vinculoNome } }
}
