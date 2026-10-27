import type { ReciboDados } from '@/lib/recibo'
import { formatarCPF } from '@/lib/validacao-br'

const reais = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dataBr = (iso?: string | null) => (iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('pt-BR') : '—')

/** Folha do recibo (fundo branco, estilos simples para sair bem no PDF/impressão). */
export function ReciboDocumento({ dados }: { dados: ReciboDados }) {
  return (
    <div id="recibo-documento" style={{ background: '#fff', color: '#111', padding: 32, fontFamily: 'Arial, sans-serif', fontSize: 13, lineHeight: 1.5 }}>
      <div style={{ borderBottom: '2px solid #111', paddingBottom: 12, marginBottom: 16, display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{dados.clinica.nome}</div>
          <div>{[dados.clinica.endereco, dados.clinica.cidadeUf].filter(Boolean).join(' — ')}</div>
          {dados.clinica.telefone && <div>Tel.: {dados.clinica.telefone}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>RECIBO</div>
          <div>Nº {dados.numero}</div>
          <div>Emitido em {dataBr(dados.emitidoEm)}</div>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <strong>Paciente:</strong> {dados.paciente.nome}
        {dados.paciente.cpf && <> &nbsp;·&nbsp; <strong>CPF:</strong> {formatarCPF(dados.paciente.cpf)}</>}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
        <thead>
          <tr style={{ background: '#f0f0f0' }}>
            <th style={{ textAlign: 'left', padding: 6 }}>Descrição</th>
            <th style={{ textAlign: 'center', padding: 6 }}>Qtd</th>
            <th style={{ textAlign: 'right', padding: 6 }}>Valor unit.</th>
            <th style={{ textAlign: 'right', padding: 6 }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {dados.itens.map((item, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #ddd' }}>
              <td style={{ padding: 6 }}>{item.descricao}</td>
              <td style={{ padding: 6, textAlign: 'center' }}>{item.quantidade}</td>
              <td style={{ padding: 6, textAlign: 'right' }}>{reais(item.valorUnitario)}</td>
              <td style={{ padding: 6, textAlign: 'right' }}>{reais(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ textAlign: 'right', marginBottom: 16 }}>
        {dados.desconto > 0 && (
          <>
            <div>Subtotal: {reais(dados.subtotal)}</div>
            <div>Desconto: − {reais(dados.desconto)}</div>
          </>
        )}
        <div style={{ fontSize: 16, fontWeight: 700 }}>Total: {reais(dados.total)}</div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <strong>Forma de pagamento</strong>
        {dados.pagamentos.map((p, i) => (
          <div key={i}>
            {p.forma}
            {p.detalhe ? ` (${p.detalhe})` : ''} — {reais(p.valor)} — {dataBr(p.data)}
          </div>
        ))}
      </div>

      {dados.nf.titular && <div style={{ marginBottom: 8 }}>Nota fiscal em nome de: {dados.nf.titular}</div>}
      <div style={{ marginTop: 32, borderTop: '1px solid #999', paddingTop: 8, fontSize: 11, color: '#555' }}>
        Documento emitido para fins de comprovação de pagamento. Não substitui a nota fiscal.
      </div>
    </div>
  )
}
