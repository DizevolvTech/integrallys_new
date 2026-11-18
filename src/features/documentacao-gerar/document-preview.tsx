'use client'

import { forwardRef, useMemo } from 'react'
import type {
  DocumentoTemplate,
  Secao,
  SecaoChecklist,
  SecaoCheckboxGrupo,
  SecaoCheckboxLista,
  SecaoCampoData,
  SecaoCampoNumero,
  SecaoCampoTexto,
  SecaoCampoTextoLongo,
  SecaoParagrafo,
} from '@/lib/documentos'
import { resolverVariaveisEmTexto } from '@/lib/documentos'
import type {
  PreenchimentoContexto,
  ValoresForm,
  ValorChecklist,
  ValorCheckboxGrupo,
  ValorCheckboxLista,
} from './types'

interface Props {
  template: Pick<DocumentoTemplate, 'conteudo'>
  valores: ValoresForm
  contexto: PreenchimentoContexto
  /** Imagem da assinatura manuscrita (atendimento): aparece acima da linha do profissional. */
  assinaturaUrl?: string | null
}

export const DocumentPreview = forwardRef<HTMLDivElement, Props>(function DocumentPreview(
  { template, valores, contexto, assinaturaUrl },
  ref,
) {
  const corPrimaria = contexto.clinica?.cor_primaria ?? '#111827'

  const resolve = useMemo(
    () =>
      (text: string) =>
        resolverVariaveisEmTexto(text, {
          cliente: contexto.cliente,
          agendamento: contexto.agendamento,
          profissional: contexto.profissional,
          clinica: contexto.clinica,
          agora: new Date(),
        }),
    [contexto],
  )

  return (
    <div
      ref={ref}
      className="document-preview bg-white text-black mx-auto"
      style={{
        width: '210mm',
        minHeight: '297mm',
        padding: '18mm',
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '11pt',
        lineHeight: 1.5,
        color: '#1f2937',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          paddingBottom: '12px',
          borderBottom: `2px solid ${corPrimaria}`,
          marginBottom: '18px',
        }}
      >
        {template.conteudo.cabecalho.logo && contexto.clinica?.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={contexto.clinica.logo_url}
            alt="Logo"
            style={{ height: '56px', width: 'auto', objectFit: 'contain' }}
          />
        )}
        <div>
          <h1 style={{ color: corPrimaria, fontSize: '16pt', fontWeight: 700, margin: 0 }}>
            {resolve(template.conteudo.cabecalho.titulo)}
          </h1>
          {contexto.clinica?.nome && (
            <div style={{ fontSize: '10pt', color: '#6b7280' }}>{contexto.clinica.nome}</div>
          )}
        </div>
      </header>

      <main>
        {template.conteudo.secoes.map((secao, index) => (
          <SecaoRenderer key={index} secao={secao} valor={valores[index]} resolve={resolve} />
        ))}
      </main>

      <footer style={{ marginTop: '28px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
        {template.conteudo.rodape.assinatura && (
          <div style={{ margin: '32px 0', textAlign: 'center' }}>
            {assinaturaUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={assinaturaUrl}
                alt="Assinatura"
                style={{ height: '56px', width: 'auto', objectFit: 'contain', margin: '0 auto', filter: 'grayscale(1)' }}
              />
            )}
            <div
              style={{
                borderTop: '1px solid #374151',
                width: '240px',
                margin: '0 auto 6px',
              }}
            />
            <div style={{ fontSize: '10pt' }}>
              {resolve('#PROFISSIONAL_NOME#') || 'Profissional responsável'}
            </div>
            {template.conteudo.rodape.conselho && resolve('#PROFISSIONAL_CONSELHO#') && (
              <div style={{ fontSize: '9pt', color: '#6b7280' }}>
                {resolve('#PROFISSIONAL_CONSELHO#')}
              </div>
            )}
          </div>
        )}

        {template.conteudo.rodape.texto_fixo && (
          <p style={{ fontSize: '9pt', color: '#6b7280', fontStyle: 'italic', marginBottom: '10px' }}>
            {resolve(template.conteudo.rodape.texto_fixo)}
          </p>
        )}

        {template.conteudo.rodape.dados_clinica && (
          <div style={{ fontSize: '8pt', color: '#6b7280', textAlign: 'center' }}>
            {[
              contexto.clinica?.endereco,
              contexto.clinica?.cep,
              contexto.clinica?.cidade_uf,
              contexto.clinica?.telefone,
            ]
              .filter((entry): entry is string => Boolean(entry && entry.trim()))
              .join(' · ')}
          </div>
        )}
      </footer>
    </div>
  )
})

function SecaoRenderer({
  secao,
  valor,
  resolve,
}: {
  secao: Secao
  valor: unknown
  resolve: (text: string) => string
}) {
  const labelStyle = { fontSize: '10pt', fontWeight: 600, color: '#374151', marginBottom: '4px' }
  const blockStyle = { marginBottom: '14px' }

  switch (secao.tipo) {
    case 'paragrafo': {
      const s = secao as SecaoParagrafo
      return <p style={{ ...blockStyle, textAlign: 'justify', whiteSpace: 'pre-wrap' }}>{resolve(s.conteudo)}</p>
    }

    case 'campo_data':
    case 'campo_texto':
    case 'campo_numero': {
      const s = secao as SecaoCampoData | SecaoCampoTexto | SecaoCampoNumero
      const valorFinal = (typeof valor === 'string' && valor.trim() !== '')
        ? valor
        : 'valor_padrao' in s && s.valor_padrao
        ? resolve(s.valor_padrao)
        : '____________'
      return (
        <div style={blockStyle}>
          <div style={labelStyle}>{s.label}</div>
          <div style={{ fontSize: '11pt' }}>{valorFinal}</div>
        </div>
      )
    }

    case 'campo_texto_longo': {
      const s = secao as SecaoCampoTextoLongo
      const valorFinal =
        (typeof valor === 'string' && valor.trim() !== '')
          ? valor
          : s.valor_padrao
          ? resolve(s.valor_padrao)
          : ''
      return (
        <div style={blockStyle}>
          <div style={labelStyle}>{s.label}</div>
          <div style={{ fontSize: '11pt', whiteSpace: 'pre-wrap', minHeight: '1.5em' }}>
            {valorFinal || '____________________________________________'}
          </div>
        </div>
      )
    }

    case 'checklist': {
      const s = secao as SecaoChecklist
      const respostas = (valor as ValorChecklist | undefined) ?? {}
      return (
        <div style={blockStyle}>
          <div style={labelStyle}>{s.label}</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
            <tbody>
              {s.itens.map((item, idx) => {
                const resp = respostas[idx]
                return (
                  <tr key={idx}>
                    <td style={{ padding: '2px 6px 2px 0', width: '60%' }}>{item.label}</td>
                    <td style={{ padding: '2px 6px' }}>
                      {resp?.sim ? '☒ Sim' : '☐ Sim'} &nbsp; {resp?.sim === false ? '☒ Não' : '☐ Não'}
                    </td>
                    <td style={{ padding: '2px 0', fontStyle: 'italic', color: '#4b5563' }}>
                      {item.com_obs && resp?.obs ? `${item.obs_label ?? 'Obs.:'} ${resp.obs}` : ''}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )
    }

    case 'checkbox_lista': {
      const s = secao as SecaoCheckboxLista
      const marcados = new Set<number>((valor as ValorCheckboxLista | undefined) ?? [])
      return (
        <div style={blockStyle}>
          <div style={labelStyle}>{s.label}</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {s.itens.map((item, idx) => (
              <li key={idx} style={{ padding: '2px 0' }}>
                {marcados.has(idx) ? '☒' : '☐'} {item}
              </li>
            ))}
          </ul>
        </div>
      )
    }

    case 'checkbox_grupo': {
      const s = secao as SecaoCheckboxGrupo
      const selecionados = new Set<number>((valor as ValorCheckboxGrupo | undefined) ?? [])
      return (
        <div style={blockStyle}>
          <div style={labelStyle}>{s.label}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
            {s.opcoes.map((opcao, idx) => (
              <span key={idx}>
                {selecionados.has(idx) ? '☒' : '☐'} {opcao}
              </span>
            ))}
          </div>
        </div>
      )
    }
  }
}
