import { formatMoeda, ROTULO_FORMA } from '@/features/relatorios/format'
import type { FonteOpcoes } from '@/features/relatorios/hooks/use-opcoes-filtro'

export type TipoColuna = 'texto' | 'data' | 'dataHora' | 'dinheiro' | 'pct' | 'numero' | 'badge' | 'forma' | 'dias'

export interface ColunaRelatorio {
  key: string
  label: string
  tipo?: TipoColuna
  direita?: boolean
}

export interface FiltroRelatorio {
  key: string
  label: string
  tipo: 'busca' | 'data' | 'texto' | 'select'
  fonte?: FonteOpcoes
  opcoes?: Array<{ value: string; label: string }>
  /** Valor inicial; 'hoje' e 'ha30dias' são resolvidos na tela. */
  padrao?: string
  /** Escondido nas abas que o servidor já restringe ao próprio usuário. */
  ocultarSeProprio?: boolean
}

export interface CartaoTotal {
  label: string
  valor: string
  tom?: 'sucesso' | 'alerta' | 'perigo' | 'neutro'
}

export interface ResumoLista {
  titulo: string
  itens: Array<{ nome: string; valor: string }>
}

export interface ConfigRelatorio {
  descricao: string
  colunas: ColunaRelatorio[]
  filtros: FiltroRelatorio[]
  cartoes?: (totais: Record<string, unknown>, total: number) => CartaoTotal[]
  resumos?: (totais: Record<string, unknown>) => ResumoLista[]
  /** Linha com botão "Ver produtos" (Minhas comissões). */
  detalheItens?: boolean
  /** Explica em uma frase como os números da tela foram calculados (aparece abaixo dos cartões). */
  legenda?: string
  /** Colunas em destaque no cartão do celular; o resto vira rótulo/valor. Padrão: primeira coluna de texto. */
  mobile?: { titulo?: string; valor?: string; selo?: string }
}

const num = (v: unknown) => Number(v ?? 0)
const obj = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
const lista = (v: unknown) => (Array.isArray(v) ? (v as Array<Record<string, unknown>>) : [])

const SITUACOES_CONSULTA = [
  { value: 'tudo', label: 'Todos' },
  { value: 'agendados', label: 'Agendados' },
  { value: 'cancelados', label: 'Cancelados (com justificativa)' },
  { value: 'faltas', label: 'Não comparecimentos' },
  { value: 'realizados', label: 'Realizados' },
  { value: 'disponiveis', label: 'Disponíveis' },
]

const FORMAS_VENDA = [
  { value: 'todas', label: 'Todas as formas' },
  { value: 'pix', label: 'Pix' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'debito', label: 'Cartão de débito' },
  { value: 'credito', label: 'Cartão de crédito' },
  { value: 'consumo', label: 'Vendas por consumo' },
  { value: 'nao_informado', label: 'Não informada' },
]

const MIDIAS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'radio', label: 'Rádio' },
  { value: 'google', label: 'Google' },
  { value: 'site', label: 'Site' },
  { value: 'indicacao', label: 'Indicação' },
  { value: 'outros', label: 'Outros' },
]

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
].map((label, i) => ({ value: String(i + 1), label }))

const periodo = (padraoInicio?: string, padraoFim?: string): FiltroRelatorio[] => [
  { key: 'inicio', label: 'De', tipo: 'data', padrao: padraoInicio },
  { key: 'fim', label: 'Até', tipo: 'data', padrao: padraoFim },
]
const unidade: FiltroRelatorio = { key: 'unidade_id', label: 'Unidade', tipo: 'select', fonte: 'unidades', ocultarSeProprio: true }
const procedimento: FiltroRelatorio = { key: 'procedimento_id', label: 'Procedimento', tipo: 'select', fonte: 'procedimentos' }
const profissional = (key = 'profissional_id', label = 'Profissional'): FiltroRelatorio => ({
  key, label, tipo: 'select', fonte: 'profissionais', ocultarSeProprio: true,
})
const convenio: FiltroRelatorio = { key: 'convenio', label: 'Plano/convênio', tipo: 'texto' }

const listaResumo = (titulo: string, itens: unknown): ResumoLista => ({
  titulo,
  itens: lista(itens).map((i) => ({ nome: String(i.nome), valor: String(i.qtd) })),
})

export const CONFIG_RELATORIOS: Record<string, ConfigRelatorio> = {
  consultas: {
    descricao: 'Histórico de atendimentos com pagamento, presença e justificativa de cancelamentos.',
    colunas: [
      { key: 'data', label: 'Data', tipo: 'data' },
      { key: 'hora', label: 'Hora' },
      { key: 'paciente', label: 'Paciente' },
      { key: 'presencaPeriodoPct', label: 'Presença no período', tipo: 'pct', direita: true },
      { key: 'realizadasPeriodo', label: 'Realizadas', tipo: 'numero', direita: true },
      { key: 'agendadasPeriodo', label: 'Agendadas', tipo: 'numero', direita: true },
      { key: 'retornos', label: 'Retornos', tipo: 'numero', direita: true },
      { key: 'procedimento', label: 'Procedimento' },
      { key: 'profissional', label: 'Profissional' },
      { key: 'especialistas', label: 'Especialistas que atenderam' },
      { key: 'convenio', label: 'Plano' },
      { key: 'unidade', label: 'Unidade' },
      { key: 'status', label: 'Situação', tipo: 'badge' },
      { key: 'justificativa', label: 'Justificativa' },
      { key: 'presencaPct', label: 'Presença (histórico)', tipo: 'pct', direita: true },
      { key: 'statusPagamento', label: 'Status pagamento', tipo: 'badge' },
      { key: 'formaPagamento', label: 'Forma de pagamento' },
      { key: 'valor', label: 'Valor', tipo: 'dinheiro', direita: true },
      { key: 'pago', label: 'Pago', tipo: 'dinheiro', direita: true },
      { key: 'aberto', label: 'Em aberto', tipo: 'dinheiro', direita: true },
    ],
    filtros: [
      { key: 'q', label: 'Buscar paciente', tipo: 'busca' },
      ...periodo(),
      procedimento,
      profissional(),
      convenio,
      unidade,
      { key: 'situacao', label: 'Situação', tipo: 'select', opcoes: SITUACOES_CONSULTA, padrao: 'tudo' },
      {
        key: 'pagamento', label: 'Status pagamento', tipo: 'select', padrao: 'todos',
        opcoes: [
          { value: 'todos', label: 'Todos' },
          { value: 'pago', label: 'Pago' },
          { value: 'aberto', label: 'Em aberto' },
        ],
      },
    ],
    cartoes: (t, total) => [
      { label: 'Total recebido', valor: formatMoeda(t.recebido), tom: 'sucesso' },
      { label: 'Total em aberto', valor: formatMoeda(t.aberto), tom: 'alerta' },
      { label: 'Registros', valor: String(total), tom: 'neutro' },
      {
        label: `Presença na clínica (${num(t.realizadas)} de ${num(t.agendadas)})`,
        valor: t.presencaPct == null ? '—' : `${num(t.presencaPct).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`,
        tom: 'sucesso',
      },
      { label: `Retornos · ${num(t.pacientes)} pacientes`, valor: String(num(t.retornos)), tom: 'neutro' },
    ],
    legenda:
      'Presença no período = consultas realizadas ÷ consultas agendadas do paciente no período e filtros escolhidos ' +
      '(agendadas = marcadas até hoje, incluindo faltas e cancelamentos; adiadas não contam). ' +
      'Retornos = consultas realizadas além da primeira consulta realizada do paciente. ' +
      '"Presença (histórico)" considera todo o histórico do paciente.',
    mobile: { titulo: 'paciente', valor: 'valor', selo: 'status' },
  },
  agendamentos: {
    descricao: 'Agenda por cliente, procedimento, convênio e unidade.',
    colunas: [
      { key: 'data', label: 'Data', tipo: 'data' },
      { key: 'hora', label: 'Hora' },
      { key: 'paciente', label: 'Cliente' },
      { key: 'procedimento', label: 'Procedimento' },
      { key: 'profissional', label: 'Profissional' },
      { key: 'convenio', label: 'Convênio' },
      { key: 'unidade', label: 'Unidade' },
      { key: 'status', label: 'Situação', tipo: 'badge' },
    ],
    filtros: [
      { key: 'q', label: 'Buscar cliente', tipo: 'busca' },
      ...periodo(),
      procedimento,
      profissional(),
      convenio,
      unidade,
      {
        key: 'situacao', label: 'Situação', tipo: 'select', opcoes: SITUACOES_CONSULTA, padrao: 'agendados',
      },
    ],
    cartoes: (_t, total) => [{ label: 'Agendamentos', valor: String(total), tom: 'neutro' }],
  },
  justificativas: {
    descricao: 'Motivo informado quando o cliente cancelou ou não compareceu.',
    colunas: [
      { key: 'data', label: 'Data', tipo: 'data' },
      { key: 'hora', label: 'Hora' },
      { key: 'paciente', label: 'Cliente' },
      { key: 'profissional', label: 'Profissional' },
      { key: 'procedimento', label: 'Procedimento' },
      { key: 'status', label: 'Situação', tipo: 'badge' },
      { key: 'justificativa', label: 'Motivo / justificativa' },
    ],
    filtros: [
      { key: 'q', label: 'Buscar cliente', tipo: 'busca' },
      ...periodo(),
      profissional(),
      procedimento,
      unidade,
    ],
    cartoes: (_t, total) => [{ label: 'Cancelamentos e faltas', valor: String(total), tom: 'alerta' }],
  },
  pacientes: {
    descricao: 'Mapeamento dos clientes: mídia de captação, cidade, convênio e quem deixou de comparecer.',
    colunas: [
      { key: 'nome', label: 'Cliente' },
      { key: 'telefone', label: 'Telefone' },
      { key: 'sexo', label: 'Sexo' },
      { key: 'cidade', label: 'Cidade' },
      { key: 'nascimento', label: 'Nascimento', tipo: 'data' },
      { key: 'midia', label: 'Mídia/captação' },
      { key: 'convenio', label: 'Convênio' },
      { key: 'visitas', label: 'Atendimentos', tipo: 'numero', direita: true },
      { key: 'faltas', label: 'Faltas', tipo: 'numero', direita: true },
      { key: 'ultimaVisita', label: 'Último atendimento', tipo: 'data' },
      { key: 'diasSemVisita', label: 'Dias sem vir', tipo: 'dias', direita: true },
      { key: 'profissionalMaisAtendido', label: 'Profissional mais atendido' },
      { key: 'procedimentos', label: 'Procedimentos' },
    ],
    filtros: [
      { key: 'q', label: 'Buscar por nome', tipo: 'busca' },
      { key: 'nascimento', label: 'Data de nascimento', tipo: 'data' },
      { key: 'mes_nascimento', label: 'Mês de aniversário', tipo: 'select', opcoes: [{ value: 'todos', label: 'Todos' }, ...MESES], padrao: 'todos' },
      { key: 'midia', label: 'Mídia/captação', tipo: 'select', opcoes: [{ value: 'todos', label: 'Todas' }, ...MIDIAS], padrao: 'todos' },
      {
        key: 'sexo', label: 'Sexo', tipo: 'select', padrao: 'todos',
        opcoes: [
          { value: 'todos', label: 'Todos' },
          { value: 'feminino', label: 'Feminino' },
          { value: 'masculino', label: 'Masculino' },
          { value: 'outro', label: 'Outro' },
        ],
      },
      { key: 'cidade', label: 'Cidade', tipo: 'texto' },
      convenio,
      profissional(),
      procedimento,
      unidade,
      {
        key: 'nao_comparecimento', label: 'Não comparecimento', tipo: 'select', padrao: 'todos',
        opcoes: [
          { value: 'todos', label: 'Todos' },
          { value: 'sim', label: 'Já faltaram' },
          { value: 'nao', label: 'Nunca faltaram' },
        ],
      },
    ],
    cartoes: (_t, total) => [{ label: 'Clientes', valor: String(total), tom: 'neutro' }],
    resumos: (t) => [
      listaResumo('Por mídia', t.porMidia),
      listaResumo('Por cidade', t.porCidade),
      listaResumo('Por convênio', t.porConvenio),
    ],
  },
  vendas: {
    mobile: { titulo: 'cliente', valor: 'valor' },
    descricao: 'Quanto foi vendido no período, quantidade por produto e formas de pagamento.',
    colunas: [
      { key: 'data', label: 'Data', tipo: 'data' },
      { key: 'numero', label: 'Venda' },
      { key: 'cliente', label: 'Cliente' },
      { key: 'produtos', label: 'Produtos' },
      { key: 'profissional', label: 'Profissional' },
      { key: 'usuario', label: 'Usuário (vendedor)' },
      { key: 'unidade', label: 'Unidade' },
      { key: 'forma', label: 'Forma de pagamento', tipo: 'forma' },
      { key: 'valor', label: 'Valor', tipo: 'dinheiro', direita: true },
    ],
    filtros: [
      { key: 'q', label: 'Buscar cliente', tipo: 'busca' },
      ...periodo(),
      unidade,
      { key: 'produto', label: 'Produto', tipo: 'texto' },
      profissional(),
      { key: 'usuario_id', label: 'Usuário', tipo: 'select', fonte: 'usuarios' },
      { key: 'forma', label: 'Forma de pagamento', tipo: 'select', opcoes: FORMAS_VENDA, padrao: 'todas' },
    ],
    cartoes: (t) => [
      { label: `Total vendido (${num(t.qtdVendas)})`, valor: formatMoeda(t.vendido), tom: 'sucesso' },
      { label: `Consumo a preço de custo (${num(t.qtdConsumo)})`, valor: formatMoeda(t.consumo), tom: 'neutro' },
    ],
    resumos: (t) => [
      {
        titulo: 'Por forma de pagamento',
        itens: lista(t.porForma).map((i) => ({
          nome: ROTULO_FORMA[String(i.forma)] ?? String(i.forma),
          valor: `${num(i.qtd)} · ${formatMoeda(i.valor)}`,
        })),
      },
      {
        titulo: 'Quantidade por produto',
        itens: lista(t.porProduto).map((i) => ({ nome: String(i.nome), valor: `${num(i.quantidade)} · ${formatMoeda(i.valor)}` })),
      },
    ],
  },
  recebimentos: {
    descricao:
      'Liquidado x a receber (agenda, vendas e recebimentos lançados no Caixa), com taxa de cartão e data de compensação conforme a configuração de pagamento.',
    colunas: [
      { key: 'data', label: 'Data', tipo: 'data' },
      { key: 'origem', label: 'Origem' },
      { key: 'cliente', label: 'Cliente / descrição' },
      { key: 'forma', label: 'Forma', tipo: 'forma' },
      { key: 'bandeira', label: 'Bandeira' },
      { key: 'parcelas', label: 'Parcelas', tipo: 'numero', direita: true },
      { key: 'situacao', label: 'Situação', tipo: 'badge' },
      { key: 'compensacao', label: 'Compensação', tipo: 'data' },
      { key: 'bruto', label: 'Bruto', tipo: 'dinheiro', direita: true },
      { key: 'taxaPct', label: 'Taxa', tipo: 'pct', direita: true },
      { key: 'desconto', label: 'Desconto', tipo: 'dinheiro', direita: true },
      { key: 'liquido', label: 'Líquido', tipo: 'dinheiro', direita: true },
    ],
    filtros: [
      { key: 'q', label: 'Buscar cliente', tipo: 'busca' },
      ...periodo('ha30dias'),
      unidade,
      { key: 'forma', label: 'Forma', tipo: 'select', opcoes: FORMAS_VENDA.filter((f) => f.value !== 'consumo'), padrao: 'todas' },
      {
        key: 'situacao', label: 'Situação', tipo: 'select', padrao: 'todos',
        opcoes: [
          { value: 'todos', label: 'Liquidado e a receber' },
          { value: 'liquidado', label: 'Liquidado' },
          { value: 'a_receber', label: 'A receber' },
        ],
      },
    ],
    mobile: { titulo: 'cliente', valor: 'bruto', selo: 'situacao' },
    cartoes: (t) => {
      const l = obj(t.liquidado)
      const a = obj(t.aReceber)
      return [
        { label: 'Liquidado · bruto', valor: formatMoeda(l.bruto), tom: 'neutro' },
        { label: 'Liquidado · descontos', valor: formatMoeda(l.desconto), tom: 'alerta' },
        { label: 'Liquidado · líquido', valor: formatMoeda(l.liquido), tom: 'sucesso' },
        { label: 'A receber · bruto', valor: formatMoeda(a.bruto), tom: 'neutro' },
        { label: 'A receber · líquido', valor: formatMoeda(a.liquido), tom: 'alerta' },
      ]
    },
  },
  'estoque-posicao': {
    mobile: { titulo: 'nome', valor: 'venda' },
    descricao: 'Quantidade, validade, lote, mínimo, custo, venda e margem de cada produto.',
    colunas: [
      { key: 'nome', label: 'Produto' },
      { key: 'categoria', label: 'Categoria' },
      { key: 'unidade', label: 'Unidade' },
      { key: 'lote', label: 'Lote' },
      { key: 'validade', label: 'Validade', tipo: 'data' },
      { key: 'quantidade', label: 'Qtd', tipo: 'numero', direita: true },
      { key: 'minimo', label: 'Mínimo', tipo: 'numero', direita: true },
      { key: 'custo', label: 'Custo', tipo: 'dinheiro', direita: true },
      { key: 'venda', label: 'Venda', tipo: 'dinheiro', direita: true },
      { key: 'margem', label: 'Margem R$', tipo: 'dinheiro', direita: true },
      { key: 'margemPct', label: 'Margem %', tipo: 'pct', direita: true },
    ],
    filtros: [
      { key: 'q', label: 'Produto ou lote', tipo: 'busca' },
      unidade,
      { key: 'categoria', label: 'Categoria', tipo: 'texto' },
      {
        key: 'situacao', label: 'Situação', tipo: 'select', padrao: 'todas',
        opcoes: [
          { value: 'todas', label: 'Todas' },
          { value: 'abaixo_minimo', label: 'No mínimo ou abaixo' },
          { value: 'vence_30', label: 'Vence em 30 dias' },
          { value: 'vencido', label: 'Vencidos' },
          { value: 'zerado', label: 'Zerados' },
        ],
      },
    ],
    cartoes: (t) => [
      { label: 'Produtos', valor: String(num(t.produtos)), tom: 'neutro' },
      { label: 'Quantidade total', valor: num(t.quantidade).toLocaleString('pt-BR'), tom: 'neutro' },
      { label: 'Custo total', valor: formatMoeda(t.custo), tom: 'neutro' },
      { label: 'Venda total', valor: formatMoeda(t.venda), tom: 'neutro' },
      { label: 'Margem total', valor: `${formatMoeda(t.margem)} (${num(t.margemPct).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)`, tom: 'sucesso' },
    ],
  },
  'estoque-movimentacao': {
    mobile: { titulo: 'produto', valor: 'quantidade', selo: 'sentido' },
    descricao: 'Entradas e saídas do estoque dia a dia, com nota fiscal, fornecedor/cliente, custo, venda e margem.',
    colunas: [
      { key: 'data', label: 'Data', tipo: 'dataHora' },
      { key: 'sentido', label: 'Movimento', tipo: 'badge' },
      { key: 'unidade', label: 'Unidade' },
      { key: 'usuario', label: 'Usuário' },
      { key: 'nf', label: 'Nota fiscal' },
      { key: 'vinculo', label: 'Fornecedor / cliente' },
      { key: 'produto', label: 'Produto' },
      { key: 'quantidade', label: 'Qtd', tipo: 'numero', direita: true },
      { key: 'custo', label: 'Custo unit.', tipo: 'dinheiro', direita: true },
      { key: 'venda', label: 'Venda unit.', tipo: 'dinheiro', direita: true },
      { key: 'margem', label: 'Margem', tipo: 'dinheiro', direita: true },
    ],
    filtros: [
      { key: 'q', label: 'Produto ou fornecedor/cliente', tipo: 'busca' },
      ...periodo('hoje', 'hoje'),
      unidade,
      { key: 'usuario_id', label: 'Usuário', tipo: 'select', fonte: 'usuarios' },
      {
        key: 'tipo', label: 'Movimento', tipo: 'select', padrao: 'todos',
        opcoes: [
          { value: 'todos', label: 'Entradas e saídas' },
          { value: 'entrada', label: 'Entradas' },
          { value: 'saida', label: 'Saídas' },
          { value: 'consumo_interno', label: 'Consumo interno' },
        ],
      },
      { key: 'nf', label: 'Nota fiscal', tipo: 'texto' },
    ],
    cartoes: (t) => {
      const e = obj(t.entradas)
      const s = obj(t.saidas)
      return [
        { label: `Entradas · ${num(e.quantidade)} un.`, valor: `Custo ${formatMoeda(e.custo)}`, tom: 'sucesso' },
        { label: 'Entradas · venda / margem', valor: `${formatMoeda(e.venda)} / ${formatMoeda(e.margem)}`, tom: 'neutro' },
        { label: `Saídas · ${num(s.quantidade)} un.`, valor: `Custo ${formatMoeda(s.custo)}`, tom: 'perigo' },
        { label: 'Saídas · venda / margem', valor: `${formatMoeda(s.venda)} / ${formatMoeda(s.margem)}`, tom: 'neutro' },
      ]
    },
    resumos: (t) => [
      {
        titulo: 'Movimento por dia (unidades)',
        itens: lista(t.porDia).map((d) => ({
          nome: String(d.dia).split('-').reverse().join('/'),
          valor: `entradas ${num(d.entradas)} · saídas ${num(d.saidas)}`,
        })),
      },
    ],
  },
  repasse: {
    mobile: { titulo: 'paciente', valor: 'repasse', selo: 'situacao' },
    descricao: 'Atendimentos com o percentual de repasse cadastrado para o profissional.',
    colunas: [
      { key: 'data', label: 'Data', tipo: 'data' },
      { key: 'paciente', label: 'Cliente' },
      { key: 'procedimento', label: 'Procedimento' },
      { key: 'profissional', label: 'Profissional' },
      { key: 'unidade', label: 'Unidade' },
      { key: 'situacao', label: 'Situação', tipo: 'badge' },
      { key: 'valor', label: 'Valor do atendimento', tipo: 'dinheiro', direita: true },
      { key: 'percentual', label: 'Percentual', tipo: 'pct', direita: true },
      { key: 'repasse', label: 'Repasse', tipo: 'dinheiro', direita: true },
    ],
    filtros: [
      { key: 'q', label: 'Buscar cliente', tipo: 'busca' },
      ...periodo(),
      unidade,
      procedimento,
      profissional(),
      {
        key: 'situacao', label: 'Situação', tipo: 'select', padrao: 'todos',
        opcoes: [
          { value: 'todos', label: 'Atendido e cancelado' },
          { value: 'atendido', label: 'Atendido' },
          { value: 'cancelado', label: 'Cancelado' },
        ],
      },
    ],
    cartoes: (t) => [
      { label: `Atendimentos (${num(t.atendimentos)})`, valor: formatMoeda(t.valor), tom: 'neutro' },
      { label: 'Repasse total', valor: formatMoeda(t.repasse), tom: 'sucesso' },
    ],
  },
  comissoes: {
    mobile: { titulo: 'cliente', valor: 'comissao' },
    descricao: 'Comissão por Prescrição/Venda: valor bruto vendido e percentual cadastrado do vendedor.',
    colunas: [
      { key: 'data', label: 'Data', tipo: 'data' },
      { key: 'numero', label: 'Prescrição/Venda' },
      { key: 'cliente', label: 'Cliente' },
      { key: 'vendedor', label: 'Vendedor' },
      { key: 'bruto', label: 'Valor bruto', tipo: 'dinheiro', direita: true },
      { key: 'percentual', label: 'Percentual', tipo: 'pct', direita: true },
      { key: 'comissao', label: 'Comissão', tipo: 'dinheiro', direita: true },
    ],
    filtros: [
      { key: 'q', label: 'Buscar cliente', tipo: 'busca' },
      ...periodo(),
      unidade,
      profissional('profissional_id', 'Vendedor'),
    ],
    cartoes: (t) => [
      { label: 'Total bruto vendido', valor: formatMoeda(t.bruto), tom: 'neutro' },
      { label: 'Total de comissão', valor: formatMoeda(t.comissao), tom: 'sucesso' },
    ],
    detalheItens: true,
  },
  financeiro: {
    mobile: { titulo: 'descricao', valor: 'valor', selo: 'status' },
    descricao: 'Lançamentos financeiros por período, tipo e usuário.',
    colunas: [
      { key: 'data', label: 'Data', tipo: 'dataHora' },
      { key: 'descricao', label: 'Descrição' },
      { key: 'categoria', label: 'Categoria' },
      { key: 'tipo', label: 'Tipo', tipo: 'badge' },
      { key: 'usuario', label: 'Usuário' },
      { key: 'unidade', label: 'Unidade' },
      { key: 'metodo', label: 'Método' },
      { key: 'status', label: 'Status', tipo: 'badge' },
      { key: 'valor', label: 'Valor', tipo: 'dinheiro', direita: true },
    ],
    filtros: [
      { key: 'q', label: 'Buscar descrição', tipo: 'busca' },
      ...periodo(),
      unidade,
      { key: 'usuario_id', label: 'Usuário', tipo: 'select', fonte: 'usuarios' },
      {
        key: 'tipo', label: 'Tipo', tipo: 'select', padrao: 'todos',
        opcoes: [
          { value: 'todos', label: 'Receitas e despesas' },
          { value: 'receita', label: 'Receitas' },
          { value: 'despesa', label: 'Despesas' },
        ],
      },
    ],
    cartoes: (t) => [
      { label: 'Receitas', valor: formatMoeda(t.receitas), tom: 'sucesso' },
      { label: 'Despesas', valor: formatMoeda(t.despesas), tom: 'perigo' },
      { label: 'Saldo', valor: formatMoeda(num(t.receitas) - num(t.despesas)), tom: 'neutro' },
    ],
  },
  tarefas: {
    descricao: 'Tarefas por responsável, situação e prazo.',
    colunas: [
      { key: 'titulo', label: 'Tarefa' },
      { key: 'responsavel', label: 'Responsável' },
      { key: 'criador', label: 'Criada por' },
      { key: 'status', label: 'Situação', tipo: 'badge' },
      { key: 'vencimento', label: 'Prazo', tipo: 'dataHora' },
      { key: 'prioridade', label: 'Prioridade' },
      { key: 'categoria', label: 'Categoria' },
      { key: 'motivo', label: 'Motivo do cancelamento' },
    ],
    filtros: [
      { key: 'q', label: 'Buscar tarefa', tipo: 'busca' },
      ...periodo(),
      { key: 'responsavel_id', label: 'Responsável', tipo: 'select', fonte: 'usuarios' },
      unidade,
      {
        key: 'status', label: 'Situação', tipo: 'select', padrao: 'todos',
        opcoes: [
          { value: 'todos', label: 'Todas' },
          { value: 'Pendente', label: 'Pendente' },
          { value: 'Em andamento', label: 'Em andamento' },
          { value: 'Concluída', label: 'Concluída' },
          { value: 'Cancelada', label: 'Cancelada' },
        ],
      },
    ],
    cartoes: (t, total) => [
      { label: 'Tarefas', valor: String(total), tom: 'neutro' },
      { label: 'Pendentes', valor: String(num(t.pendentes)), tom: 'alerta' },
      { label: 'Concluídas', valor: String(num(t.concluidas)), tom: 'sucesso' },
      { label: 'Atrasadas', valor: String(num(t.atrasadas)), tom: 'perigo' },
    ],
  },
  desempenho: {
    descricao: 'Números reais da agenda no período: atendimentos, cancelamentos, faltas e pacientes atendidos.',
    colunas: [
      { key: 'procedimento', label: 'Procedimento mais realizado' },
      { key: 'realizados', label: 'Atendimentos', tipo: 'numero', direita: true },
    ],
    filtros: [...periodo('ha30dias', 'hoje'), unidade, profissional()],
    cartoes: (t) => [
      { label: 'Agendamentos', valor: String(num(t.agendamentos)), tom: 'neutro' },
      { label: 'Realizados', valor: String(num(t.realizados)), tom: 'sucesso' },
      { label: 'Cancelados', valor: String(num(t.cancelados)), tom: 'alerta' },
      { label: 'Não compareceram', valor: String(num(t.faltas)), tom: 'perigo' },
      { label: 'Pacientes atendidos', valor: String(num(t.pacientesUnicos)), tom: 'neutro' },
      { label: 'Taxa de conclusão', valor: `${num(t.taxaConclusaoPct).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`, tom: 'sucesso' },
    ],
  },
}
