export type RecursoCadastro = 'bancos' | 'categorias-dre' | 'tipos-documento'

/** Linhas do DRE onde uma categoria pode cair (valores do enum legado `dre_categoria`). */
export const LINHAS_DRE = [
  { value: 'receita_consultas', label: 'Receita de consultas e procedimentos', tipo: 'receita' },
  { value: 'receita_produtos', label: 'Receita de produtos', tipo: 'receita' },
  { value: 'receita_outros', label: 'Outras receitas', tipo: 'receita' },
  { value: 'despesa_fixa', label: 'Despesas fixas', tipo: 'despesa' },
  { value: 'despesa_pessoal', label: 'Despesas com pessoal (fixas)', tipo: 'despesa' },
  { value: 'despesa_administrativa', label: 'Despesas administrativas', tipo: 'despesa' },
  { value: 'despesa_comercial', label: 'Despesas comerciais', tipo: 'despesa' },
  { value: 'despesa_depreciacao', label: 'Depreciação e amortização', tipo: 'despesa' },
  { value: 'cancelamento', label: 'Deduções / cancelamentos', tipo: 'despesa' },
  { value: 'outros', label: 'Despesas variáveis e demais', tipo: 'despesa' },
] as const

export const BASES_DOCUMENTO = [
  { value: 'declaracao', label: 'Declaração / atestado' },
  { value: 'laudo', label: 'Laudo' },
  { value: 'encaminhamento', label: 'Encaminhamento' },
  { value: 'formulario', label: 'Formulário' },
  { value: 'procedimento', label: 'Procedimento' },
  { value: 'dieta', label: 'Dieta' },
  { value: 'contrato', label: 'Contrato' },
] as const

type Resultado = { ok: true; data: Record<string, unknown> } | { ok: false; error: string; code: string }

const texto = (valor: unknown, max: number) => (typeof valor === 'string' ? valor.trim().slice(0, max) : '')

/** Valida o corpo de criação/edição de cada cadastro. Na edição (`parcial`) só valida o que veio. */
export function validarCadastro(recurso: RecursoCadastro, body: Record<string, unknown>, parcial: boolean): Resultado {
  const data: Record<string, unknown> = {}
  const nome = texto(body.nome, 120)
  if (!parcial || body.nome !== undefined) {
    if (!nome) return { ok: false, error: 'Informe o nome', code: 'INVALID_NOME' }
    data.nome = nome
  }
  if (typeof body.ativo === 'boolean') data.ativo = body.ativo

  if (recurso === 'bancos') {
    if (body.codigo !== undefined) data.codigo = texto(body.codigo, 10) || null
  }

  if (recurso === 'categorias-dre') {
    if (!parcial) {
      if (body.tipo !== 'receita' && body.tipo !== 'despesa') {
        return { ok: false, error: 'Escolha receita ou despesa', code: 'INVALID_TIPO' }
      }
      data.tipo = body.tipo
    }
    if (!parcial || body.linhaDre !== undefined) {
      const linha = LINHAS_DRE.find((item) => item.value === body.linhaDre)
      const tipo = (data.tipo ?? body.tipo) as string | undefined
      if (!linha || (tipo && linha.tipo !== tipo)) {
        return { ok: false, error: 'Escolha a linha do DRE compatível com o tipo', code: 'INVALID_LINHA_DRE' }
      }
      data.linha_dre = linha.value
    }
    if (typeof body.ordem === 'number' && Number.isFinite(body.ordem)) data.ordem = Math.trunc(body.ordem)
  }

  if (recurso === 'tipos-documento') {
    if (!parcial || body.base !== undefined) {
      const base = BASES_DOCUMENTO.find((item) => item.value === body.base)
      if (!base) return { ok: false, error: 'Escolha o modelo base do documento', code: 'INVALID_BASE' }
      data.base = base.value
    }
  }
  return { ok: true, data }
}
