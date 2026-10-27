'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export type CampoCadastro = {
  chave: string
  rotulo: string
  tipo: 'texto' | 'opcoes'
  opcoes?: Array<{ value: string; label: string }>
  /** Só na criação (ex.: receita/despesa não muda depois). */
  soNaCriacao?: boolean
  obrigatorio?: boolean
}

type Linha = { id: string; nome: string; ativo: boolean; sistema?: boolean } & Record<string, unknown>

interface Props {
  titulo: string
  descricao: string
  textoNovo: string
  campos: CampoCadastro[]
  linhas: Linha[]
  carregando: boolean
  erro: string | null
  podeEditar: boolean
  onCriar: (payload: Record<string, unknown>) => Promise<void>
  onAtualizar: (id: string, payload: Record<string, unknown>) => Promise<void>
  /** Texto exibido na coluna de cada campo (traduz códigos em rótulos). */
  formatar?: (campo: CampoCadastro, linha: Linha) => string
}

export function CadastroSecao({ titulo, descricao, textoNovo, campos, linhas, carregando, erro, podeEditar, onCriar, onAtualizar, formatar }: Props) {
  const [editando, setEditando] = useState<Linha | 'novo' | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)

  const abrir = (linha: Linha | 'novo') => {
    setEditando(linha)
    setForm(
      linha === 'novo'
        ? { nome: '' }
        : Object.fromEntries([['nome', linha.nome], ...campos.map((campo) => [campo.chave, String(linha[campo.chave] ?? '')])]),
    )
  }

  const salvar = async () => {
    if (!form.nome?.trim()) {
      toast.error('Informe o nome')
      return
    }
    const faltando = campos.find((campo) => campo.obrigatorio && !form[campo.chave])
    if (faltando) {
      toast.error(`Informe: ${faltando.rotulo}`)
      return
    }
    setSalvando(true)
    try {
      if (editando === 'novo') await onCriar(form)
      else if (editando) {
        const payload = Object.fromEntries(
          Object.entries(form).filter(([chave]) => !campos.find((campo) => campo.chave === chave)?.soNaCriacao),
        )
        await onAtualizar(editando.id, payload)
      }
      toast.success('Cadastro salvo.')
      setEditando(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar.')
    } finally {
      setSalvando(false)
    }
  }

  const alternarAtivo = async (linha: Linha) => {
    try {
      await onAtualizar(linha.id, { ativo: !linha.ativo })
      toast.success(linha.ativo ? 'Item inativado. O histórico foi mantido.' : 'Item reativado.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível alterar.')
    }
  }

  const texto = (campo: CampoCadastro, linha: Linha) =>
    formatar?.(campo, linha) ?? campo.opcoes?.find((o) => o.value === linha[campo.chave])?.label ?? String(linha[campo.chave] ?? '—')

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-medium text-app-text-primary dark:text-white">{titulo}</h2>
          <p className="text-sm text-app-text-muted">{descricao}</p>
        </div>
        {podeEditar && (
          <Button onClick={() => abrir('novo')} className="h-11 rounded-xl bg-app-primary px-5 font-normal text-white">
            <Plus className="mr-2 h-4 w-4" />
            {textoNovo}
          </Button>
        )}
      </div>

      {erro && <p className="text-sm text-[var(--app-danger-text)]">{erro}</p>}
      <div className="overflow-x-auto rounded-[18px] border border-app-border dark:border-app-border-dark">
        <Table>
          <TableHeader className="bg-app-bg-secondary/50 dark:bg-app-hover">
            <TableRow>
              <TableHead className="text-xs uppercase tracking-wider">Nome</TableHead>
              {campos.map((campo) => (
                <TableHead key={campo.chave} className="text-xs uppercase tracking-wider">{campo.rotulo}</TableHead>
              ))}
              <TableHead className="text-xs uppercase tracking-wider">Situação</TableHead>
              {podeEditar && <TableHead className="text-right text-xs uppercase tracking-wider">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {carregando ? (
              <TableRow><TableCell colSpan={campos.length + 3} className="py-8 text-center text-app-text-muted">Carregando...</TableCell></TableRow>
            ) : linhas.length === 0 ? (
              <TableRow><TableCell colSpan={campos.length + 3} className="py-8 text-center text-app-text-muted">Nada cadastrado ainda.</TableCell></TableRow>
            ) : (
              linhas.map((linha) => (
                <TableRow key={linha.id} className={linha.ativo ? '' : 'opacity-60'}>
                  <TableCell className="font-normal text-app-text-primary dark:text-white">{linha.nome}</TableCell>
                  {campos.map((campo) => (
                    <TableCell key={campo.chave} className="text-app-text-secondary">{texto(campo, linha)}</TableCell>
                  ))}
                  <TableCell>
                    <Badge variant="outline" className="rounded-full">{linha.ativo ? 'Ativo' : 'Inativo'}</Badge>
                  </TableCell>
                  {podeEditar && (
                    <TableCell className="space-x-2 text-right">
                      <Button size="sm" variant="outline" className="rounded-lg" onClick={() => abrir(linha)}>Editar</Button>
                      <Button size="sm" variant="outline" className="rounded-lg" onClick={() => void alternarAtivo(linha)}>
                        {linha.ativo ? 'Inativar' : 'Reativar'}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={editando !== null} onOpenChange={(aberto) => !aberto && setEditando(null)}>
        <DialogContent className="w-[95%] rounded-[24px] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editando === 'novo' ? textoNovo : `Editar ${titulo.toLowerCase()}`}</DialogTitle>
            <DialogDescription>Inativar mantém o histórico dos lançamentos e documentos já feitos.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.nome ?? ''} onChange={(e) => setForm((c) => ({ ...c, nome: e.target.value }))} />
            </div>
            {campos
              .filter((campo) => !(campo.soNaCriacao && editando !== 'novo'))
              .map((campo) => (
                <div key={campo.chave} className="space-y-2">
                  <Label>{campo.rotulo}</Label>
                  {campo.tipo === 'texto' ? (
                    <Input value={form[campo.chave] ?? ''} onChange={(e) => setForm((c) => ({ ...c, [campo.chave]: e.target.value }))} />
                  ) : (
                    <Select value={form[campo.chave] ?? ''} onValueChange={(value) => setForm((c) => ({ ...c, [campo.chave]: value }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {(campo.opcoes ?? []).map((opcao) => (
                          <SelectItem key={opcao.value} value={opcao.value}>{opcao.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ))}
            {editando && editando !== 'novo' && (
              <div className="flex items-center justify-between rounded-xl border border-app-border p-3 dark:border-app-border-dark">
                <span className="text-sm">Ativo</span>
                <Switch checked={editando.ativo} disabled aria-label="Use o botão Inativar/Reativar da lista" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)} className="rounded-xl">Cancelar</Button>
            <Button onClick={() => void salvar()} disabled={salvando} className="rounded-xl bg-app-primary text-white">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
