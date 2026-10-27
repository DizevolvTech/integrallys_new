export type DocumentoTipo =
  | 'formulario'
  | 'declaracao'
  | 'laudo'
  | 'encaminhamento'
  | 'procedimento'
  | 'dieta'
  | 'contrato'

export interface Cabecalho {
  titulo: string
  logo?: boolean
}

export interface Rodape {
  assinatura?: boolean
  dados_clinica?: boolean
  conselho?: boolean
  texto_fixo?: string
}

export interface SecaoParagrafo {
  tipo: 'paragrafo'
  conteudo: string
}
export interface SecaoCampoData {
  tipo: 'campo_data'
  label: string
  valor_padrao?: string
}
export interface SecaoCampoTexto {
  tipo: 'campo_texto'
  label: string
  placeholder?: string
  obrigatorio?: boolean
  valor_padrao?: string
}
export interface SecaoCampoTextoLongo {
  tipo: 'campo_texto_longo'
  label: string
  valor_padrao?: string
}
export interface SecaoCampoNumero {
  tipo: 'campo_numero'
  label: string
}
export interface ItemChecklist {
  label: string
  com_obs?: boolean
  obs_label?: string
}
export interface SecaoChecklist {
  tipo: 'checklist'
  label: string
  itens: ItemChecklist[]
}
export interface SecaoCheckboxLista {
  tipo: 'checkbox_lista'
  label: string
  itens: string[]
}
export interface SecaoCheckboxGrupo {
  tipo: 'checkbox_grupo'
  label: string
  opcoes: string[]
}

export type Secao =
  | SecaoParagrafo
  | SecaoCampoData
  | SecaoCampoTexto
  | SecaoCampoTextoLongo
  | SecaoCampoNumero
  | SecaoChecklist
  | SecaoCheckboxLista
  | SecaoCheckboxGrupo

export interface TemplateConteudo {
  cabecalho: Cabecalho
  secoes: Secao[]
  rodape: Rodape
}

export interface DocumentoTemplate {
  id: string
  unidade_id: string
  slug: string
  nome: string
  tipo: DocumentoTipo
  /** Tipo do cadastro (Cadastros › Tipos de documento); `tipo` segue como modelo base. */
  tipo_documento_id?: string | null
  conteudo: TemplateConteudo
  ativo: boolean
  editavel_pelo_especialista: boolean
  disponivel_portal_paciente: boolean
  created_at: string
  updated_at: string
}

export interface DocumentoGerado {
  id: string
  template_id: string
  agendamento_id: string | null
  paciente_id: string | null
  profissional_id: string | null
  conteudo_preenchido: TemplateConteudo
  gerado_por: string
  gerado_em: string
  disponivel_no_portal: boolean
  pdf_url: string | null
}

export interface ContextoVariaveis {
  cliente?: { nome?: string; cpf?: string }
  agendamento?: { data_hora?: string | Date | null }
  profissional?: {
    nome?: string
    conselho?: string | null
    cpf?: string | null
    rg?: string | null
    endereco?: string | null
    estado_civil?: string | null
  }
  repasse?: {
    percentual?: number | null
    valor_fixo?: number | null
  }
  clinica?: {
    nome?: string
    cidade_uf?: string
    endereco?: string
    cep?: string
    telefone?: string
  }
  agora?: Date
}
