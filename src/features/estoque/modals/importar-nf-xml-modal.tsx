'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ApiClientError } from '@/lib/api-client'
import { useEstoque, type EstoqueItem, type MovimentacaoEstoqueInput } from '../hooks/use-estoque'
import { formatarMoeda } from '@/lib/moeda'

interface BodyProps {
  items: EstoqueItem[]
  onConfirm: (payload: MovimentacaoEstoqueInput) => Promise<void>
  onClose: (open: boolean) => void
}

interface NfHeader {
  cnpjEmitente: string
  nomeEmitente: string
  fantasiaEmitente: string
  numeroNF: string
  dataEmissao: string
}

interface NfProduto {
  cProd: string
  nome: string
  unidade: string
  quantidade: number
  valorUnitario: number
  produtoId: string
  lote: string
  dataFabricacao: string
  validade: string
  loteFromXml: boolean
  dataFabricacaoFromXml: boolean
  validadeFromXml: boolean
  nfOrigem: string
}

const NFE_NS = 'http://www.portalfiscal.inf.br/nfe'

/**
 * Parser de NF-e 4.00 com namespace fixo `xmlns="http://www.portalfiscal.inf.br/nfe"`.
 * Extrai cabeçalho (emit, ide) e múltiplos produtos (det/prod) usando
 * `getElementsByTagNameNS` para cobrir corretamente o XML real da Receita.
 *
 * Campos por produto (det/prod): cProd, xProd, qCom, vUnCom, uCom.
 * Rastreabilidade (det/prod/rastro): nLote, dFab, dVal — opcional na NF-e mas
 * comum em medicamentos/produtos sujeitos a controle. Fallback para vazio
 * quando ausente, permitindo edição manual.
 */
export function parseNFe(
  xmlText: string,
): { header: NfHeader; produtos: NfProduto[] } | null {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'application/xml')
  const parserError = doc.getElementsByTagName('parsererror')[0]
  if (parserError) return null

  const get = (parent: Element | null | undefined, tag: string) => {
    if (!parent) return ''
    const node = parent.getElementsByTagNameNS(NFE_NS, tag)[0]
    return node?.textContent?.trim() ?? ''
  }

  const emit = doc.getElementsByTagNameNS(NFE_NS, 'emit')[0]
  const ide = doc.getElementsByTagNameNS(NFE_NS, 'ide')[0]
  if (!emit || !ide) return null

  const dhEmi = get(ide, 'dhEmi')
  const dataEmissao = dhEmi.length >= 10 ? dhEmi.slice(0, 10) : ''

  const header: NfHeader = {
    cnpjEmitente: get(emit, 'CNPJ'),
    nomeEmitente: get(emit, 'xNome'),
    fantasiaEmitente: get(emit, 'xFant'),
    numeroNF: get(ide, 'nNF'),
    dataEmissao,
  }

  const detEls = Array.from(doc.getElementsByTagNameNS(NFE_NS, 'det'))
  const produtos: NfProduto[] = []
  for (const det of detEls) {
    const prod = det.getElementsByTagNameNS(NFE_NS, 'prod')[0]
    if (!prod) continue
    const quantidade = parseFloat(get(prod, 'qCom').replace(',', '.')) || 0
    const valorUnitario = parseFloat(get(prod, 'vUnCom').replace(',', '.')) || 0
    const rastro = prod.getElementsByTagNameNS(NFE_NS, 'rastro')[0]
    const loteValue = get(rastro, 'nLote')
    const dFabValue = get(rastro, 'dFab')
    const dValValue = get(rastro, 'dVal')
    produtos.push({
      cProd: get(prod, 'cProd'),
      nome: get(prod, 'xProd'),
      unidade: get(prod, 'uCom'),
      quantidade,
      valorUnitario,
      produtoId: '',
      lote: loteValue,
      dataFabricacao: dFabValue,
      validade: dValValue,
      loteFromXml: !!loteValue,
      dataFabricacaoFromXml: !!dFabValue,
      validadeFromXml: !!dValValue,
      nfOrigem: header.numeroNF,
    })
  }

  return { header, produtos }
}

interface CadastrarProdutoState {
  open: boolean
  index: number | null
  nome: string
  categoria: string
}

interface DuplicateNfState {
  open: boolean
  message: string
}

export function EntradaXmlBody({ items, onConfirm, onClose }: BodyProps) {
  const { createProduto } = useEstoque()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [headers, setHeaders] = useState<NfHeader[]>([])
  const [produtos, setProdutos] = useState<NfProduto[]>([])
  const [fileNames, setFileNames] = useState<string[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [localItems, setLocalItems] = useState<EstoqueItem[]>(items)
  const [cadastrar, setCadastrar] = useState<CadastrarProdutoState>({
    open: false,
    index: null,
    nome: '',
    categoria: '',
  })
  const [isCadastrando, setIsCadastrando] = useState(false)
  const [duplicateNf, setDuplicateNf] = useState<DuplicateNfState>({ open: false, message: '' })

  // Use the most up-to-date list (locally created products + props)
  const availableItems = localItems.length >= items.length ? localItems : items

  const matchProdutoId = (nome: string, list: EstoqueItem[]) => {
    const matched = list.find(
      (i) => i.produto.trim().toLowerCase() === nome.trim().toLowerCase(),
    )
    return matched?.id ?? ''
  }

  const handleFile = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    const filesArr = Array.from(fileList)
    const newHeaders: NfHeader[] = []
    const newProdutos: NfProduto[] = []
    const newFileNames: string[] = []

    for (const file of filesArr) {
      try {
        const text = await file.text()
        const parsed = parseNFe(text)
        if (!parsed || parsed.produtos.length === 0) {
          toast.error(`Não foi possível extrair produtos de ${file.name}.`)
          continue
        }
        newHeaders.push(parsed.header)
        newFileNames.push(file.name)
        for (const p of parsed.produtos) {
          newProdutos.push({ ...p, produtoId: matchProdutoId(p.nome, availableItems) })
        }
      } catch (err) {
        toast.error(err instanceof Error ? `${file.name}: ${err.message}` : `Falha ao ler ${file.name}`)
      }
    }

    if (newHeaders.length === 0) return

    setHeaders((prev) => [...prev, ...newHeaders])
    setProdutos((prev) => [...prev, ...newProdutos])
    setFileNames((prev) => [...prev, ...newFileNames])
    toast.success(`${newProdutos.length} produto(s) extraído(s) de ${newHeaders.length} XML(s).`)
  }

  const updateProduto = (index: number, patch: Partial<NfProduto>) => {
    setProdutos((current) =>
      current.map((p, idx) => {
        if (idx !== index) return p
        const updated = { ...p, ...patch }
        if ('lote' in patch) updated.loteFromXml = false
        if ('dataFabricacao' in patch) updated.dataFabricacaoFromXml = false
        if ('validade' in patch) updated.validadeFromXml = false
        return updated
      }),
    )
  }

  const handleClear = () => {
    setHeaders([])
    setProdutos([])
    setFileNames([])
    if (fileRef.current) fileRef.current.value = ''
  }

  const openCadastrar = (index: number) => {
    const p = produtos[index]
    if (!p) return
    setCadastrar({ open: true, index, nome: p.nome, categoria: '' })
  }

  const closeCadastrar = () => {
    setCadastrar({ open: false, index: null, nome: '', categoria: '' })
  }

  const handleConfirmCadastrar = async () => {
    if (!cadastrar.nome.trim() || !cadastrar.categoria.trim()) {
      toast.error('Informe nome e categoria do produto.')
      return
    }
    setIsCadastrando(true)
    try {
      const updatedList = await createProduto({
        produto: cadastrar.nome.trim(),
        categoria: cadastrar.categoria.trim(),
        quantidade: 0,
      })
      setLocalItems(updatedList)
      const novoId = matchProdutoId(cadastrar.nome.trim(), updatedList)
      if (cadastrar.index != null && novoId) {
        updateProduto(cadastrar.index, { produtoId: novoId })
      }
      // Re-match other rows that may share the same name
      setProdutos((current) =>
        current.map((p) => (p.produtoId ? p : { ...p, produtoId: matchProdutoId(p.nome, updatedList) })),
      )
      toast.success('Produto cadastrado e vinculado.')
      closeCadastrar()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao cadastrar produto.')
    } finally {
      setIsCadastrando(false)
    }
  }

  const submitProdutos = async (force: boolean) => {
    const headerForProduto = (produto: NfProduto) =>
      headers.find((h) => h.numeroNF === produto.nfOrigem) ?? headers[0] ?? null

    const isFirstOfNf = new Set<string>()
    for (const produto of produtos) {
      const header = headerForProduto(produto)
      const key = `${header?.numeroNF ?? ''}|${header?.cnpjEmitente ?? ''}`
      if (!isFirstOfNf.has(key)) {
        isFirstOfNf.add(key)
      }
    }
    const consumedKeys = new Set<string>()

    for (const produto of produtos) {
      const header = headerForProduto(produto)
      const fornecedor = header?.fantasiaEmitente || header?.nomeEmitente
      const observacoes = [
        header?.numeroNF ? `Compra: ${header.numeroNF}` : null,
        fornecedor ? `Fornecedor: ${fornecedor}` : null,
        header?.cnpjEmitente ? `CNPJ: ${header.cnpjEmitente}` : null,
        header?.dataEmissao ? `Data: ${header.dataEmissao}` : null,
        produto.unidade ? `Un: ${produto.unidade}` : null,
        produto.valorUnitario > 0 ? `Custo: ${formatarMoeda(produto.valorUnitario)}` : null,
        produto.lote ? `Lote: ${produto.lote}` : null,
        produto.dataFabricacao ? `Fabricação: ${produto.dataFabricacao}` : null,
        produto.validade ? `Validade: ${produto.validade}` : null,
      ]
        .filter(Boolean)
        .join(' • ')

      const key = `${header?.numeroNF ?? ''}|${header?.cnpjEmitente ?? ''}`
      const isFirst = !consumedKeys.has(key)
      consumedKeys.add(key)

      await onConfirm({
        produtoId: produto.produtoId,
        quantidade: produto.quantidade,
        observacoes: observacoes || undefined,
        numeroNf: header?.numeroNF || undefined,
        cnpjEmitente: header?.cnpjEmitente || undefined,
        force: force || !isFirst,
      })
    }
  }

  const handleConfirm = async () => {
    const incompletos = produtos.filter((p) => !p.produtoId)
    if (incompletos.length > 0) {
      toast.error('Vincule todos os produtos a itens do estoque antes de confirmar.')
      return
    }
    const semLoteOuValidade = produtos.filter((p) => !p.lote || !p.validade)
    if (semLoteOuValidade.length > 0) {
      toast.error('Informe lote e validade para todos os produtos.')
      return
    }

    setIsImporting(true)
    try {
      await submitProdutos(false)
      toast.success(`${produtos.length} entrada(s) registrada(s) a partir de ${headers.length} XML(s).`)
      setHeaders([])
      setProdutos([])
      setFileNames([])
      if (fileRef.current) fileRef.current.value = ''
      onClose(false)
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'NF_DUPLICADA') {
        setDuplicateNf({ open: true, message: err.error })
      } else {
        toast.error(err instanceof Error ? err.message : 'Falha ao registrar entradas da compra')
      }
    } finally {
      setIsImporting(false)
    }
  }

  const handleForceImport = async () => {
    setDuplicateNf({ open: false, message: '' })
    setIsImporting(true)
    try {
      await submitProdutos(true)
      toast.success(`${produtos.length} entrada(s) registrada(s) a partir de ${headers.length} XML(s).`)
      setHeaders([])
      setProdutos([])
      setFileNames([])
      if (fileRef.current) fileRef.current.value = ''
      onClose(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao registrar entradas da compra')
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        <div className="flex items-center gap-3">
          <Input
            ref={fileRef}
            id="entrada-xml-file"
            type="file"
            multiple
            accept=".xml,text/xml,application/xml"
            onChange={(e) => void handleFile(e.target.files)}
            className="max-w-md"
          />
          {fileNames.length > 0 && (
            <span className="text-xs text-app-text-muted truncate">
              {fileNames.length === 1 ? fileNames[0] : `${fileNames.length} arquivos`}
            </span>
          )}
          {(headers.length > 0 || produtos.length > 0 || fileNames.length > 0) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={isImporting}
              className="ml-auto h-9 gap-2 text-app-text-secondary hover:text-[var(--app-danger-text)]"
            >
              <Trash2 className="h-4 w-4" />
              Limpar
            </Button>
          )}
        </div>

        <p className="text-xs text-app-text-muted">
          Envie o(s) XML(s) de compra — pode importar múltiplos de uma vez. Lote, fabricação e validade são lidos do bloco{' '}
          <code className="font-mono">&lt;rastro&gt;</code> quando presente — caso contrário,
          preencha manualmente antes de confirmar.
        </p>

        {headers.length > 0 && (
          <div className="rounded-xl border border-[color:var(--app-info-text)]/30 bg-[color:var(--app-info-bg)]/50 px-4 py-3 dark:bg-[color:var(--app-info-bg)]/20 space-y-2">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="text-xs uppercase tracking-wider text-app-text-muted">
                {headers.length} XML(s) importado(s)
              </span>
              <span className="text-app-text-muted">·</span>
              <span className="text-sm tabular-nums text-app-text-secondary">
                {produtos.length} produto(s) no total
              </span>
            </div>
            <div className="space-y-1">
              {headers.map((h, i) => (
                <div key={`${h.numeroNF}-${i}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                  <span className="font-medium text-app-text-primary dark:text-white">nº {h.numeroNF || '—'}</span>
                  <span className="text-app-text-muted">·</span>
                  <span className="text-app-text-primary dark:text-white">
                    {h.fantasiaEmitente || h.nomeEmitente || '—'}
                  </span>
                  {h.dataEmissao && (
                    <>
                      <span className="text-app-text-muted">·</span>
                      <span className="text-xs tabular-nums text-app-text-secondary">
                        {h.dataEmissao.split('-').reverse().join('/')}
                      </span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {produtos.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-app-border dark:border-app-border-dark">
            <Table>
              <TableHeader className="bg-app-bg-secondary/50 dark:bg-app-hover">
                <TableRow>
                  <TableHead>Doc.</TableHead>
                  <TableHead>cProd</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Un.</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Preço un.</TableHead>
                  <TableHead>Produto do estoque</TableHead>
                  <TableHead>Lote *</TableHead>
                  <TableHead>Fabricação</TableHead>
                  <TableHead>Validade *</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {produtos.map((p, idx) => (
                  <TableRow key={`${p.nfOrigem}-${p.cProd}-${idx}`}>
                    <TableCell className="text-xs text-app-text-muted">{p.nfOrigem || '—'}</TableCell>
                    <TableCell className="text-xs text-app-text-muted">{p.cProd}</TableCell>
                    <TableCell className="text-sm">{p.nome}</TableCell>
                    <TableCell className="text-xs text-app-text-muted">{p.unidade || '—'}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        step="0.01"
                        className="h-9 w-[80px] text-right"
                        value={p.quantidade}
                        onChange={(e) =>
                          updateProduto(idx, { quantidade: Number(e.target.value) || 0 })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        step="0.01"
                        className="h-9 w-[100px] text-right"
                        value={p.valorUnitario}
                        onChange={(e) =>
                          updateProduto(idx, { valorUnitario: Number(e.target.value) || 0 })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Select
                          value={p.produtoId}
                          onValueChange={(value) => updateProduto(idx, { produtoId: value })}
                        >
                          <SelectTrigger className="h-9 w-[180px]">
                            <SelectValue placeholder="Vincular..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableItems.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.produto}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {!p.produtoId && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openCadastrar(idx)}
                            className="h-9 px-2 gap-1 text-xs whitespace-nowrap"
                            disabled={isImporting}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Cadastrar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Input
                          className="h-9 w-[120px]"
                          value={p.lote}
                          onChange={(e) => updateProduto(idx, { lote: e.target.value })}
                        />
                        {p.loteFromXml && (
                          <span className="ml-1.5 text-[9px] uppercase tracking-wider text-[color:var(--app-info-text)]">XML</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Input
                          type="date"
                          className="h-9 w-[150px]"
                          value={p.dataFabricacao}
                          onChange={(e) => updateProduto(idx, { dataFabricacao: e.target.value })}
                        />
                        {p.dataFabricacaoFromXml && (
                          <span className="ml-1.5 text-[9px] uppercase tracking-wider text-[color:var(--app-info-text)]">XML</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Input
                          type="date"
                          className="h-9 w-[150px]"
                          value={p.validade}
                          onChange={(e) => updateProduto(idx, { validade: e.target.value })}
                        />
                        {p.validadeFromXml && (
                          <span className="ml-1.5 text-[9px] uppercase tracking-wider text-[color:var(--app-info-text)]">XML</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <DialogFooter className="px-6 py-4 border-t border-app-border dark:border-app-border-dark">
        <Button variant="outline" onClick={() => onClose(false)} disabled={isImporting}>
          Cancelar
        </Button>
        <Button
          onClick={() => void handleConfirm()}
          disabled={isImporting || produtos.length === 0}
        >
          {isImporting ? 'Registrando...' : `Confirmar entrada (${produtos.length})`}
        </Button>
      </DialogFooter>

      <Dialog open={duplicateNf.open} onOpenChange={(open) => { if (!open) setDuplicateNf({ open: false, message: '' }) }}>
        <DialogContent size="sm" className="rounded-[20px]">
          <DialogTitle className="text-lg font-normal text-app-text-primary dark:text-white">
            NF já importada
          </DialogTitle>
          <div className="rounded-integrallys-lg border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
            {duplicateNf.message || 'Esta nota fiscal já foi registrada anteriormente.'}
          </div>
          <p className="text-xs text-app-text-muted">
            Você pode importar mesmo assim — uma nova movimentação será criada, mas o sistema marcará essa nota como já vista.
          </p>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setDuplicateNf({ open: false, message: '' })} disabled={isImporting}>
              Cancelar
            </Button>
            <Button
              className="bg-[var(--app-danger-text)] text-white hover:opacity-90"
              onClick={() => void handleForceImport()}
              disabled={isImporting}
            >
              {isImporting ? 'Importando...' : 'Importar mesmo assim'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cadastrar.open} onOpenChange={(open) => { if (!open) closeCadastrar() }}>
        <DialogContent size="sm" className="rounded-[20px]">
          <DialogTitle className="text-lg font-normal text-app-text-primary dark:text-white">
            Cadastrar produto no estoque
          </DialogTitle>
          <p className="text-xs text-app-text-muted -mt-3">
            Cria um item de estoque com quantidade 0 e vincula a esta linha.
          </p>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="cadastrar-nome">Nome *</Label>
              <Input
                id="cadastrar-nome"
                value={cadastrar.nome}
                onChange={(e) => setCadastrar((c) => ({ ...c, nome: e.target.value }))}
                placeholder="Nome do produto"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cadastrar-categoria">Categoria *</Label>
              <Input
                id="cadastrar-categoria"
                value={cadastrar.categoria}
                onChange={(e) => setCadastrar((c) => ({ ...c, categoria: e.target.value }))}
                placeholder="Ex: Suprimento, Medicamento..."
              />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={closeCadastrar} disabled={isCadastrando}>
              Cancelar
            </Button>
            <Button
              className="bg-app-primary hover:bg-app-primary-hover text-white"
              onClick={() => void handleConfirmCadastrar()}
              disabled={isCadastrando}
            >
              {isCadastrando ? 'Cadastrando...' : 'Cadastrar e vincular'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
