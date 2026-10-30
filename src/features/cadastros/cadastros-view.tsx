'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { SegmentedControl } from '@/components/shared/segmented-control'
import { Card } from '@/components/ui/card'
import { BASES_DOCUMENTO, LINHAS_DRE } from '@/lib/cadastros'
import { CadastroSecao, type CampoCadastro } from './components/cadastro-secao'
import { DescontosFormaSecao } from './components/descontos-forma-secao'
import { useCadastro } from './hooks/use-cadastro'

const ABAS = [
  { value: 'bancos', label: 'Bancos' },
  { value: 'categorias-dre', label: 'Categorias de DRE' },
  { value: 'tipos-documento', label: 'Tipos de documento' },
  { value: 'descontos-forma', label: 'Descontos por forma' },
  { value: 'outros', label: 'Outros cadastros' },
]

const CAMPOS_BANCO: CampoCadastro[] = [{ chave: 'codigo', rotulo: 'Código', tipo: 'texto' }]
const CAMPOS_DRE: CampoCadastro[] = [
  {
    chave: 'tipo',
    rotulo: 'Tipo',
    tipo: 'opcoes',
    soNaCriacao: true,
    obrigatorio: true,
    opcoes: [
      { value: 'receita', label: 'Receita' },
      { value: 'despesa', label: 'Despesa' },
    ],
  },
  {
    chave: 'linhaDre',
    rotulo: 'Aparece no DRE como',
    tipo: 'opcoes',
    obrigatorio: true,
    opcoes: LINHAS_DRE.map(({ value, label }) => ({ value, label })),
  },
]
const CAMPOS_DOCUMENTO: CampoCadastro[] = [
  {
    chave: 'base',
    rotulo: 'Modelo base',
    tipo: 'opcoes',
    obrigatorio: true,
    opcoes: BASES_DOCUMENTO.map(({ value, label }) => ({ value, label })),
  },
]

const ATALHOS = [
  { href: '/formas-pagamento', titulo: 'Formas de pagamento e recebimento', texto: 'PIX, dinheiro, débito, crédito, boleto e outras.' },
  { href: '/procedimentos', titulo: 'Procedimentos', texto: 'Valores, duração e retorno de cada procedimento.' },
  { href: '/profissionais', titulo: 'Profissionais', texto: 'Especialistas, horários e procedimentos atendidos.' },
  { href: '/fornecedores', titulo: 'Fornecedores', texto: 'Credores usados em Pagamentos.' },
]

export function CadastrosView() {
  const [aba, setAba] = useState('bancos')
  const bancos = useCadastro('bancos')
  const categorias = useCadastro('categorias-dre')
  const tipos = useCadastro('tipos-documento')

  return (
    <div className="app-page app-page-loose">
      <PageHeader
        title="Cadastros"
        description="Itens que mudam de clínica para clínica: edite aqui e as telas passam a usar a lista atualizada."
      />
      <SegmentedControl options={ABAS} value={aba} onChange={setAba} fullWidth={false} />

      {aba === 'bancos' && (
        <CadastroSecao
          titulo="Bancos"
          descricao="Usados ao cadastrar contas em Gestão Bancária."
          textoNovo="Novo banco"
          campos={CAMPOS_BANCO}
          linhas={bancos.data.map((item) => ({ ...item }))}
          carregando={bancos.isLoading}
          erro={bancos.error}
          podeEditar
          onCriar={bancos.criar}
          onAtualizar={bancos.atualizar}
        />
      )}
      {aba === 'categorias-dre' && (
        <CadastroSecao
          titulo="Categorias de DRE"
          descricao="Escolhidas em Novo recebimento e Nova despesa. Cada uma cai numa linha do DRE."
          textoNovo="Nova categoria"
          campos={CAMPOS_DRE}
          linhas={categorias.data.map((item) => ({ ...item }))}
          carregando={categorias.isLoading}
          erro={categorias.error}
          podeEditar
          onCriar={categorias.criar}
          onAtualizar={categorias.atualizar}
        />
      )}
      {aba === 'tipos-documento' && (
        <CadastroSecao
          titulo="Tipos de documento"
          descricao="Atestado, laudo, encaminhamento e outros. Aparecem ao criar modelos em Templates de Documentos."
          textoNovo="Novo tipo"
          campos={CAMPOS_DOCUMENTO}
          linhas={tipos.data.map((item) => ({ ...item }))}
          carregando={tipos.isLoading}
          erro={tipos.error}
          podeEditar
          onCriar={tipos.criar}
          onAtualizar={tipos.atualizar}
        />
      )}
      {aba === 'descontos-forma' && <DescontosFormaSecao />}
      {aba === 'outros' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {ATALHOS.map((atalho) => (
            <Link key={atalho.href} href={atalho.href}>
              <Card className="flex h-full items-start justify-between gap-3 rounded-[18px] p-5 transition-shadow hover:shadow-md">
                <div>
                  <p className="font-medium text-app-text-primary dark:text-white">{atalho.titulo}</p>
                  <p className="mt-1 text-sm text-app-text-muted">{atalho.texto}</p>
                </div>
                <ArrowUpRight className="h-5 w-5 shrink-0 text-app-text-muted" />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
