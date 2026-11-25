'use client'

import { forwardRef, useMemo, type CSSProperties } from 'react'
import type {
  DocumentoTemplate,
  LayoutDocumento,
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

  const layout = template.conteudo.layout
  const pagina = layout ? ESTILO_LAYOUT[layout] : null

  return (
    <div
      ref={ref}
      className="document-preview bg-white text-black mx-auto"
      style={{
        width: '210mm',
        minHeight: '297mm',
        boxSizing: 'border-box',
        padding: '18mm',
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '11pt',
        lineHeight: 1.5,
        color: '#1f2937',
        ...(pagina ? { height: '297mm', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontSize: pagina.fonte, lineHeight: pagina.altura } : {}),
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

      <main style={pagina?.corpo}>
        {template.conteudo.secoes.map((secao, index) => (
          <SecaoRenderer key={index} secao={secao} valor={valores[index]} resolve={resolve} compacto={!!layout} ultimo={index === template.conteudo.secoes.length - 1} />
        ))}
      </main>

      <footer style={{ marginTop: pagina ? 0 : '28px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
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

const ESTILO_LAYOUT: Record<LayoutDocumento, { fonte: string; altura: number; corpo: CSSProperties }> = {
  // Corpo no meio da folha: o <main> ocupa o espaço entre o título e a assinatura e centraliza o texto na vertical.
  pagina_centrada: { fonte: '14pt', altura: 1.9, corpo: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' } },
  pagina_cheia: { fonte: '14pt', altura: 1.6, corpo: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', padding: '6mm 0' } },
}

function SecaoRenderer({
  secao,
  valor,
  resolve,
  compacto,
  ultimo,
}: {
  secao: Secao
  valor: unknown
  resolve: (text: string) => string
  /** Documento com layout de página: tamanhos maiores e espaçamento fixo entre os blocos. */
  compacto: boolean
  ultimo: boolean
}) {
  const labelStyle = { fontSize: compacto ? '15pt' : '10pt', fontWeight: 600, color: '#374151', marginBottom: compacto ? '8px' : '4px' }
  const blockStyle = { marginBottom: compacto && !ultimo ? '10mm' : '14px' }
  const campoPt = compacto ? '14pt' : '11pt'

  switch (secao.tipo) {
    case 'paragrafo': {
      const s = secao as SecaoParagrafo
      // Com layout de página, as quebras de linha em branco que a cliente digitava no fim do texto não contam.
      const texto = compacto ? resolve(s.conteudo).trimEnd() : resolve(s.conteudo)
      return <p style={{ ...blockStyle, textAlign: 'justify', whiteSpace: 'pre-wrap', margin: compacto ? 0 : undefined, marginBottom: blockStyle.marginBottom }}>{texto}</p>
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
          <div style={{ fontSize: campoPt }}>{valorFinal}</div>
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
          <div style={{ fontSize: campoPt, whiteSpace: 'pre-wrap', minHeight: '1.5em' }}>
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
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: campoPt }}>
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: compacto ? '10px 24px' : '8px 16px', fontSize: campoPt }}>
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
