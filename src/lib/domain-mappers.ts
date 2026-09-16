type Nullable<T> = T | null | undefined

function formatDate(value: Nullable<string>) {
  if (!value) return ''
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch
    return `${day}/${month}/${year}`
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('pt-BR')
}

function formatTime(value: Nullable<string>) {
  if (!value) return ''
  const timeOnlyMatch = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value)
  if (timeOnlyMatch) {
    const [, hour, minute] = timeOnlyMatch
    return `${hour}:${minute}`
  }
  return String(value)
}

function formatDateTime(value: Nullable<string>) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('pt-BR')
}

export function mapAgendaItem(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? ''),
    pacienteId: row.paciente_id ? String(row.paciente_id) : undefined,
    paciente: String(row.paciente_nome ?? ''),
    profissionalId: row.profissional_id ? String(row.profissional_id) : undefined,
    profissional: String(row.profissional_nome ?? ''),
    horario: formatTime(String(row.horario ?? '')),
    horarioFim: row.horario_fim ? formatTime(String(row.horario_fim)) : undefined,
    status: String(row.status ?? ''),
    data: formatDate(String(row.data_agendamento ?? '')),
    tipo: row.tipo ? String(row.tipo) : undefined,
    titulo: row.titulo ? String(row.titulo) : undefined,
    local: row.local ? String(row.local) : undefined,
    participantes: row.participantes ? String(row.participantes) : undefined,
    modalidade: row.modalidade_atendimento ? String(row.modalidade_atendimento) : undefined,
    plataformaOnline: row.plataforma_online ? String(row.plataforma_online) : undefined,
    urlOnline: row.url_online ? String(row.url_online) : undefined,
    valorProcedimento: row.valor_procedimento != null ? Number(row.valor_procedimento) : undefined,
    procedimentoId: row.procedimento_id ? String(row.procedimento_id) : undefined,
    procedimento: row.procedimento_nome ? String(row.procedimento_nome) : undefined,
    observacoes: row.observacoes ? String(row.observacoes) : undefined,
    pagamento: row.pagamento_situacao ? String(row.pagamento_situacao) : undefined,
    totalPago: row.total_pago != null ? Number(row.total_pago) : undefined,
    dataPagamentoAnterior: row.data_ultimo_pagamento
      ? String(row.data_ultimo_pagamento)
      : undefined,
    tipoEncaixe: row.tipo_encaixe ? String(row.tipo_encaixe) : undefined,
    foraJanela: row.fora_janela === true,
    motivoEncaixe: row.motivo_encaixe ? String(row.motivo_encaixe) : undefined,
  }
}

export function mapPacienteItem(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? ''),
    nome: String(row.nome ?? ''),
    telefone: String(row.telefone ?? ''),
    email: String(row.email ?? ''),
    status: String(row.status ?? ''),
  }
}

export function mapPrescricaoItem(row: Record<string, unknown>) {
  const rawDescontoTipo = row.desconto_tipo
  const descontoTipo: 'value' | 'percent' | undefined =
    rawDescontoTipo === 'value' || rawDescontoTipo === 'percent' ? rawDescontoTipo : undefined
  return {
    id: String(row.id ?? ''),
    pacienteId: row.paciente_id ? String(row.paciente_id) : undefined,
    numero: String(row.numero ?? ''),
    paciente: String(row.paciente_nome ?? ''),
    valorTotal: Number(row.valor_total ?? 0),
    valorBruto: row.valor_bruto != null ? Number(row.valor_bruto) : undefined,
    numeroParcelas: row.numero_parcelas != null ? Number(row.numero_parcelas) : undefined,
    valorParcela: row.valor_parcela != null ? Number(row.valor_parcela) : undefined,
    descontoTipo,
    descontoPercentual:
      row.desconto_percentual != null ? Number(row.desconto_percentual) : undefined,
    descontoValor: row.desconto_valor != null ? Number(row.desconto_valor) : undefined,
    justificativaDesconto: row.justificativa_desconto
      ? String(row.justificativa_desconto)
      : undefined,
    vendedorId: row.vendedor_id ? String(row.vendedor_id) : undefined,
    status: String(row.status ?? ''),
    data: formatDate(String(row.data_prescricao ?? '')),
    tipo: row.tipo ? String(row.tipo) : undefined,
    validade: formatDate(String(row.validade ?? '')),
    observacoes: row.observacoes ? String(row.observacoes) : undefined,
    items: Array.isArray(row.items) ? row.items : [],
  }
}

export function mapEstoqueItem(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? ''),
    produto: String(row.nome ?? ''),
    categoria: String(row.categoria ?? ''),
    sku: row.sku ? String(row.sku) : undefined,
    quantidade: Number(row.quantidade ?? 0),
    estoqueMinimo: Number(row.estoque_minimo ?? 0),
    lote: row.lote ? String(row.lote) : undefined,
    validade: row.validade ? formatDate(String(row.validade)) : undefined,
    precoCusto: row.preco_custo != null ? Number(row.preco_custo) : undefined,
    precoVenda: row.preco_venda != null ? Number(row.preco_venda) : undefined,
    unidadeMedida: row.unidade_medida ? String(row.unidade_medida) : undefined,
    status: String(row.status ?? ''),
  }
}

export function mapListaEsperaItem(row: Record<string, unknown>) {
  const procedimentoNome = row.procedimento_nome
    ? String(row.procedimento_nome)
    : row.procedimento
      ? String(row.procedimento)
      : undefined
  const especialistaNome = row.especialista_nome
    ? String(row.especialista_nome)
    : row.especialista
      ? String(row.especialista)
      : undefined
  return {
    id: String(row.id ?? ''),
    pacienteId: row.paciente_id ? String(row.paciente_id) : undefined,
    paciente: String(row.paciente_nome ?? ''),
    prioridade: String(row.prioridade ?? ''),
    especialistaId: row.especialista_id ? String(row.especialista_id) : undefined,
    especialista: especialistaNome,
    procedimentoId: row.procedimento_id ? String(row.procedimento_id) : undefined,
    procedimento: procedimentoNome,
    procedimentoValor: row.procedimento_valor != null ? Number(row.procedimento_valor) : undefined,
    preferenciaHorario: row.preferencia_horario ? String(row.preferencia_horario) : undefined,
    entradaEm: formatDateTime(String(row.entrada_em ?? '')),
    observacoes: row.observacoes ? String(row.observacoes) : undefined,
  }
}

export function mapCaixaItem(row: Record<string, unknown>) {
  const dateTime = formatDateTime(String(row.data_movimento ?? ''))
  return {
    id: String(row.id ?? ''),
    descricao: String(row.descricao ?? ''),
    tipo: row.tipo === 'saida' ? 'saida' : 'entrada',
    valor: Number(row.valor ?? 0),
    data: dateTime,
    hora: dateTime.split(' ')[1] ?? '',
    forma: row.forma ? String(row.forma) : 'Dinheiro',
    operador: row.operador_nome ? String(row.operador_nome) : 'Sistema',
    sessaoId: row.sessao_id ? String(row.sessao_id) : undefined,
    bandeira: row.bandeira ? String(row.bandeira) : null,
    parcelas: row.parcelas != null ? Number(row.parcelas) : null,
    valorParcela: row.valor_parcela != null ? Number(row.valor_parcela) : null,
    formaPagamentoId: row.forma_pagamento_id ? String(row.forma_pagamento_id) : undefined,
  }
}

export function mapFinanceiroItem(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? ''),
    descricao: String(row.descricao ?? ''),
    categoria: String(row.categoria ?? ''),
    valor: Number(row.valor ?? 0),
    tipo: row.tipo === 'despesa' ? 'despesa' : 'receita',
    data: formatDateTime(String(row.data_lancamento ?? row.created_at ?? '')),
    status: row.status ? String(row.status) : 'Pendente',
    metodo: row.metodo ? String(row.metodo) : undefined,
    observacoes: row.observacoes ? String(row.observacoes) : undefined,
    formaPagamentoId: row.forma_pagamento_id ? String(row.forma_pagamento_id) : undefined,
    contaBancariaId: row.conta_bancaria_id ? String(row.conta_bancaria_id) : undefined,
    beneficiario: row.beneficiario ? String(row.beneficiario) : undefined,
    parcelas: row.parcelas != null ? Number(row.parcelas) : undefined,
    parcelaAtual: row.parcela_atual != null ? Number(row.parcela_atual) : undefined,
    centroCustoId: row.centro_custo_id ? String(row.centro_custo_id) : undefined,
  }
}

export function mapUsuarioItem(row: Record<string, unknown>) {
  const especialistasPermitidosRaw = row.especialistas_permitidos
  const especialistasPermitidos = Array.isArray(especialistasPermitidosRaw)
    ? (especialistasPermitidosRaw as unknown[]).map((value) => String(value))
    : null
  return {
    id: String(row.id ?? ''),
    nome: String(row.nome ?? ''),
    email: String(row.email ?? ''),
    perfil: row.perfil ? String(row.perfil) : undefined,
    status: String(row.status ?? ''),
    unidadeId: row.unidade_id ? String(row.unidade_id) : null,
    tipoVinculo:
      row.tipo_vinculo === 'parceiro' || row.tipo_vinculo === 'interno'
        ? (row.tipo_vinculo as 'parceiro' | 'interno')
        : 'interno',
    especialistasPermitidos,
  }
}

export function mapProfissionalHorario(row: Record<string, unknown>) {
  const horaInicio = String(row.hora_inicio ?? '')
  const horaFim = String(row.hora_fim ?? '')
  return {
    id: row.id ? String(row.id) : undefined,
    diaSemana: Number(row.dia_semana ?? 0),
    turno: row.turno === 'tarde' ? ('tarde' as const) : ('manha' as const),
    // Postgres time vem como "HH:MM:SS"; o form usa "HH:MM".
    horaInicio: horaInicio.slice(0, 5),
    horaFim: horaFim.slice(0, 5),
    duracaoMin: Number(row.duracao_min ?? 0),
    ativo: row.ativo !== false,
  }
}

export function mapProfissionalItem(
  row: Record<string, unknown>,
  horarioRows: Array<Record<string, unknown>> = [],
  procedimentoIds: string[] = [],
  unidadesAtuacaoIds: string[] = [],
  repasse: { percentual: number | null; valorFixo: number | null } | null = null,
) {
  return {
    id: String(row.id ?? ''),
    nome: String(row.nome ?? ''),
    email: String(row.email ?? ''),
    telefone: row.telefone ? String(row.telefone) : null,
    conselho: row.conselho ? String(row.conselho) : null,
    crm: row.crm ? String(row.crm) : null,
    cpf: row.cpf ? String(row.cpf) : null,
    dataNascimento: row.data_nascimento ? String(row.data_nascimento) : null,
    rg: row.rg ? String(row.rg) : null,
    estadoCivil: row.estado_civil ? String(row.estado_civil) : null,
    endereco: row.endereco ? String(row.endereco) : null,
    bairro: row.bairro ? String(row.bairro) : null,
    cidade: row.cidade ? String(row.cidade) : null,
    cep: row.cep ? String(row.cep) : null,
    estado: row.estado ? String(row.estado) : null,
    tipoVinculo:
      row.tipo_vinculo === 'parceiro' || row.tipo_vinculo === 'interno'
        ? (row.tipo_vinculo as 'parceiro' | 'interno')
        : 'interno',
    status: String(row.status ?? ''),
    unidadeId: row.unidade_id ? String(row.unidade_id) : null,
    unidadesAtuacaoIds,
    repassePercentual: repasse?.percentual ?? null,
    repasseValorFixo: repasse?.valorFixo ?? null,
    horarios: horarioRows.map((horario) => mapProfissionalHorario(horario)),
    procedimentoIds,
  }
}

export function mapPermissaoItem(row: Record<string, unknown>) {
  return {
    id: `${row.perfil ?? 'perfil'}-${row.unidadeId ?? 'global'}-${row.recurso ?? 'recurso'}`,
    recurso: String(row.recurso ?? ''),
    perfil: String(row.perfil ?? ''),
    acoes: Array.isArray(row.acoes) ? row.acoes.map(String) : [],
    unidadeId: row.unidadeId ? String(row.unidadeId) : undefined,
    unidadeNome: row.unidadeNome ? String(row.unidadeNome) : undefined,
  }
}

export function mapUnidadeItem(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? ''),
    nome: String(row.nome ?? ''),
    cidade: String(row.cidade ?? ''),
    status: String(row.status ?? ''),
    cnpj: row.cnpj ? String(row.cnpj) : undefined,
    endereco: row.endereco ? String(row.endereco) : undefined,
    bairro: row.bairro ? String(row.bairro) : undefined,
    cep: row.cep ? String(row.cep) : undefined,
    estado: row.estado ? String(row.estado) : undefined,
    gestor: row.gestor_nome ? String(row.gestor_nome) : undefined,
  }
}

export function mapAuditoriaItem(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? ''),
    acao: String(row.acao ?? ''),
    usuario: String(row.usuario_nome ?? 'Sistema'),
    data: formatDateTime(String(row.created_at ?? '')),
    descricao: row.descricao ? String(row.descricao) : undefined,
    modulo: row.recurso ? String(row.recurso) : undefined,
    ip: row.ip ? String(row.ip) : undefined,
  }
}

export function mapRelatorioItem(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? ''),
    nome: String(row.nome ?? ''),
    descricao: String(row.descricao ?? ''),
    atualizadoEm: formatDateTime(String(row.atualizado_em ?? row.updated_at ?? '')),
    categoria: String(row.categoria ?? row.nome ?? ''),
  }
}

export function mapRepasseItem(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? ''),
    profissionalId: row.profissional_id ? String(row.profissional_id) : undefined,
    profissional: String(row.profissional_nome ?? ''),
    unidadeId: row.unidade_id ? String(row.unidade_id) : undefined,
    unidade: row.unidade_nome ? String(row.unidade_nome) : undefined,
    periodo: `${formatDate(String(row.periodo_inicio ?? ''))} - ${formatDate(String(row.periodo_fim ?? ''))}`,
    valor: Number(row.valor ?? 0),
    status: String(row.status ?? ''),
    pagoEm: row.pago_em ? formatDateTime(String(row.pago_em)) : undefined,
    tipoVinculo:
      row.tipo_vinculo === 'parceiro' || row.tipo_vinculo === 'interno'
        ? (row.tipo_vinculo as 'parceiro' | 'interno')
        : 'interno',
  }
}

export function mapRegraRepasseItem(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? ''),
    profissionalId: String(row.profissional_id ?? ''),
    profissional: String(row.profissional_nome ?? ''),
    unidadeId: row.unidade_id ? String(row.unidade_id) : undefined,
    unidade: row.unidade_nome ? String(row.unidade_nome) : undefined,
    percentual: row.percentual == null ? null : Number(row.percentual),
    valorFixo: row.valor_fixo == null ? null : Number(row.valor_fixo),
    ativo: Boolean(row.ativo),
    observacoes: row.observacoes ? String(row.observacoes) : undefined,
  }
}

export function mapTarefaItem(row: Record<string, unknown>) {
  const vencimentoIso = row.vencimento_em ? String(row.vencimento_em) : ''
  let data = ''
  let horario = ''
  if (vencimentoIso) {
    const d = new Date(vencimentoIso)
    if (!Number.isNaN(d.getTime())) {
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      data = `${yyyy}-${mm}-${dd}`
      horario = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    }
  }

  const diasSemana = Array.isArray(row.dias_semana)
    ? row.dias_semana.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    : []

  return {
    id: String(row.id ?? ''),
    titulo: String(row.titulo ?? ''),
    descricao: row.descricao ? String(row.descricao) : '',
    responsavel: String(row.responsavel_nome ?? ''),
    responsavelId: row.responsavel_id ? String(row.responsavel_id) : '',
    status: String(row.status ?? ''),
    recorrencia: String(row.recorrencia ?? 'nenhuma'),
    diasSemana,
    alerta: Boolean(row.alerta),
    prioridade: row.prioridade ? String(row.prioridade) : '',
    categoria: row.categoria ? String(row.categoria) : '',
    vencimentoEm: vencimentoIso,
    data,
    horario,
  }
}

export function mapDisparoItem(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? ''),
    tipo: String(row.tipo ?? ''),
    status: String(row.status ?? ''),
    telefone: String(row.telefone ?? ''),
    paciente: String(row.paciente_nome ?? ''),
    pacienteId: row.paciente_id ? String(row.paciente_id) : undefined,
    agendamentoId: row.agendamento_id ? String(row.agendamento_id) : undefined,
    mensagem: String(row.mensagem ?? ''),
    erroDetalhe: row.erro_detalhe ? String(row.erro_detalhe) : undefined,
    agendadoPara: formatDateTime(String(row.agendado_para ?? '')),
    agendadoParaIso: String(row.agendado_para ?? ''),
    enviadoEm: row.enviado_em ? formatDateTime(String(row.enviado_em)) : undefined,
    criadoEm: formatDateTime(String(row.created_at ?? '')),
  }
}

export function mapPagamentoOnlineItem(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? ''),
    agendamentoId: row.agendamento_id ? String(row.agendamento_id) : undefined,
    lancamentoId: row.lancamento_id ? String(row.lancamento_id) : undefined,
    gateway: String(row.gateway ?? ''),
    gatewayId: row.gateway_id ? String(row.gateway_id) : undefined,
    tipo: String(row.tipo ?? ''),
    valor: Number(row.valor ?? 0),
    status: String(row.status ?? 'pendente'),
    qrCode: row.qr_code ? String(row.qr_code) : undefined,
    qrCodeCopiaECola: row.qr_code_copia_cola ? String(row.qr_code_copia_cola) : undefined,
    linkPagamento: row.link_pagamento ? String(row.link_pagamento) : undefined,
    pagoEm: row.pago_em ? formatDateTime(String(row.pago_em)) : undefined,
    criadoEm: formatDateTime(String(row.created_at ?? '')),
  }
}

export function mapChatbotSessaoItem(row: Record<string, unknown>) {
  const contexto = (row.contexto ?? {}) as Record<string, unknown>
  const resumoParts: string[] = []
  if (contexto.nome) resumoParts.push(`Nome: ${String(contexto.nome)}`)
  if (contexto.especialistaNome) resumoParts.push(`Esp.: ${String(contexto.especialistaNome)}`)
  if (contexto.data) resumoParts.push(`Data: ${String(contexto.data)}`)
  if (contexto.hora) resumoParts.push(`Hora: ${String(contexto.hora)}`)
  return {
    id: String(row.id ?? ''),
    telefone: String(row.telefone ?? ''),
    paciente: String(row.paciente_nome ?? ''),
    pacienteId: row.paciente_id ? String(row.paciente_id) : undefined,
    estado: String(row.estado ?? ''),
    contextoResumo: resumoParts.join(' · '),
    ultimaInteracao: formatDateTime(String(row.ultima_interacao ?? '')),
    ultimaInteracaoIso: String(row.ultima_interacao ?? ''),
    criadoEm: formatDateTime(String(row.created_at ?? '')),
  }
}

export function mapConfiguracaoItem(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? ''),
    chave: String(row.chave ?? ''),
    valor: String(row.valor ?? ''),
    categoria: String(row.categoria ?? ''),
  }
}

export function mapProcedimentoItem(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? ''),
    nome: String(row.nome ?? ''),
    codigo: row.codigo ? String(row.codigo) : undefined,
    descricao: row.descricao ? String(row.descricao) : undefined,
    valor: row.valor != null ? Number(row.valor) : undefined,
    duracaoMin: row.duracao_min != null ? Number(row.duracao_min) : undefined,
    temRetorno: Boolean(row.tem_retorno),
    prazoRetornoDias: row.prazo_retorno_dias != null ? Number(row.prazo_retorno_dias) : undefined,
    valorRetorno: row.valor_retorno != null ? Number(row.valor_retorno) : undefined,
    temPacote: Boolean(row.tem_pacote),
    intervaloRecorrenciaDias:
      row.intervalo_recorrencia_dias != null ? Number(row.intervalo_recorrencia_dias) : undefined,
    quantidadeSugeridaPacote:
      row.quantidade_sugerida_pacote != null ? Number(row.quantidade_sugerida_pacote) : undefined,
    ativo: Boolean(row.ativo),
  }
}

export function mapFormaPagamentoItem(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? ''),
    nome: String(row.nome ?? ''),
    tipo: String(row.tipo ?? 'outro'),
    cartaoId: row.cartao_id ? String(row.cartao_id) : undefined,
    ativo: Boolean(row.ativo),
  }
}

export function mapAnamneseItem(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? ''),
    pacienteId: row.paciente_id ? String(row.paciente_id) : undefined,
    paciente: String(row.paciente_nome ?? ''),
    data: formatDate(String(row.data_anamnese ?? '')),
    tipo: String(row.tipo ?? ''),
    queixa: String(row.queixa ?? ''),
    imc: row.imc ? Number(row.imc) : undefined,
    peso: row.peso ? Number(row.peso) : undefined,
    gordura: row.gordura ? Number(row.gordura) : undefined,
    altura: row.altura ? Number(row.altura) : undefined,
    massaMuscular: row.massa_muscular ? Number(row.massa_muscular) : undefined,
    gorduraVisceral: row.gordura_visceral ? Number(row.gordura_visceral) : undefined,
    massaOssea: row.massa_ossea ? Number(row.massa_ossea) : undefined,
    aguaCorporal: row.agua_corporal ? Number(row.agua_corporal) : undefined,
    camposExtras:
      row.campos_extras && typeof row.campos_extras === 'object' && !Array.isArray(row.campos_extras)
        ? (row.campos_extras as Record<string, string | number | boolean>)
        : {},
  }
}

export function mapProntuarioItem(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? ''),
    pacienteId: row.paciente_id ? String(row.paciente_id) : undefined,
    paciente: String(row.paciente_nome ?? ''),
    data: formatDate(String(row.data_registro ?? '')),
    tipo: String(row.tipo ?? ''),
    status: String(row.status ?? ''),
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
    updatedBy: row.updated_by ? String(row.updated_by) : undefined,
  }
}

export function mapEvolucaoItem(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? ''),
    pacienteId: row.paciente_id ? String(row.paciente_id) : undefined,
    paciente: String(row.paciente_nome ?? ''),
    data: formatDate(String(row.data_evolucao ?? '')),
    tipo: String(row.tipo ?? ''),
    resumo: String(row.resumo ?? ''),
    retornoRecepcao: row.retorno_recepcao ? String(row.retorno_recepcao) : undefined,
    docsCount: row.docs_count ? Number(row.docs_count) : undefined,
  }
}

export function mapDocumentoClinicoItem(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? ''),
    pacienteId: row.paciente_id ? String(row.paciente_id) : undefined,
    paciente: String(row.paciente_nome ?? ''),
    nome: row.nome ? String(row.nome) : undefined,
    categoria: row.categoria ? String(row.categoria) : undefined,
    descricao: row.descricao ? String(row.descricao) : undefined,
    template: row.template ? String(row.template) : undefined,
    especialista: row.especialista ? String(row.especialista) : undefined,
    tipo: String(row.tipo ?? ''),
    atualizadoEm: formatDateTime(String(row.atualizado_em ?? '')),
    meio: row.meio ? String(row.meio) : undefined,
    recebido: typeof row.recebido === 'boolean' ? row.recebido : undefined,
    anexoUrl: row.anexo_url ? String(row.anexo_url) : undefined,
  }
}

export function mapHistoricoItem(row: Record<string, unknown>) {
  const rawStatus = String(row.status ?? '')
  const mappedStatus =
    rawStatus === 'Cancelado'
      ? 'Cancelado'
      : rawStatus === 'Concluído' || rawStatus === 'Finalizado' || rawStatus === 'Check-out'
        ? 'Concluído'
        : 'Concluído'
  const procedimento = String(row.tipo ?? 'Consulta')
  const medico = String(row.profissional_nome ?? '')
  return {
    id: String(row.id ?? ''),
    data: formatDate(String(row.data_agendamento ?? row.created_at ?? '')),
    tipo: procedimento,
    profissional: medico,
    medico,
    local: row.unidade_nome ? String(row.unidade_nome) : 'Consultório Centro',
    status: mappedStatus,
    especialidade: procedimento,
  }
}

export function mapCartaoItem(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? ''),
    bandeira: String(row.bandeira ?? ''),
    final: String(row.final ?? ''),
    titular: String(row.titular ?? ''),
  }
}

export function mapPagamentoPortalItem(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? ''),
    descricao: String(row.descricao ?? ''),
    valor: Number(row.valor ?? 0),
    status: String(row.status ?? ''),
    vencimento: row.vencimento_em ? formatDate(String(row.vencimento_em)) : undefined,
    pagamento: row.pago_em ? formatDate(String(row.pago_em)) : undefined,
    doutor: row.profissional_nome ? String(row.profissional_nome) : undefined,
  }
}
