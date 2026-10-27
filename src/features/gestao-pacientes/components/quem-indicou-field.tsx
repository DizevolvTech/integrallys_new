'use client'

import { Link2 } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useApi } from '@/hooks/use-api'

type Sugestao = { id: string; nome: string; telefone: string }

interface QuemIndicouFieldProps {
    nome: string
    indicadoPorId: string | null
    /** Paciente em edição: não sugere ele mesmo. */
    excluirId?: string
    /** Falso no portal do paciente: texto livre, sem listar outros cadastros (privacidade). */
    buscar?: boolean
    onChange: (next: { nome: string; indicadoPorId: string | null }) => void
}

const LABEL = 'text-xs font-bold text-[var(--app-text-primary)] dark:text-white/70 uppercase tracking-tight'

/**
 * Vídeo de 26/10: ao digitar o nome de quem indicou, a recepção escolhe um
 * paciente/cliente já cadastrado e o vínculo fica salvo. Texto livre continua
 * aceito para quem indicou e não é cliente.
 */
export function QuemIndicouField({ nome, indicadoPorId, excluirId, buscar = true, onChange }: QuemIndicouFieldProps) {
    const api = useApi()
    const listId = useId()
    const [sugestoes, setSugestoes] = useState<Sugestao[]>([])
    const [aberto, setAberto] = useState(false)
    const [ativo, setAtivo] = useState(-1)
    const ultimaBusca = useRef('')

    useEffect(() => {
        const termo = nome.trim()
        if (!buscar || indicadoPorId || termo.length < 2) {
            setSugestoes([])
            return
        }
        const timer = setTimeout(async () => {
            ultimaBusca.current = termo
            try {
                const res = await api.get<{ data: Sugestao[] }>(`/api/pacientes?busca=${encodeURIComponent(termo)}`)
                if (ultimaBusca.current !== termo) return
                setSugestoes((res.data ?? []).filter((s) => s.id !== excluirId))
                setAtivo(-1)
            } catch {
                setSugestoes([])
            }
        }, 250)
        return () => clearTimeout(timer)
    }, [api, buscar, excluirId, indicadoPorId, nome])

    const escolher = (s: Sugestao) => {
        onChange({ nome: s.nome, indicadoPorId: s.id })
        setAberto(false)
        setSugestoes([])
    }

    const mostrarLista = aberto && sugestoes.length > 0 && !indicadoPorId

    return (
        <div className="md:col-span-2 space-y-2 relative">
            <Label htmlFor={`${listId}-input`} className={LABEL}>Quem indicou?</Label>
            <Input
                id={`${listId}-input`}
                value={nome}
                autoComplete="off"
                role="combobox"
                aria-expanded={mostrarLista}
                aria-controls={`${listId}-lista`}
                aria-autocomplete="list"
                placeholder="Digite o nome de quem indicou"
                className="h-11 rounded-xl border-app-border dark:border-app-border-dark"
                onFocus={() => setAberto(true)}
                onBlur={() => setTimeout(() => setAberto(false), 150)}
                onChange={(e) => {
                    // Digitar de novo desfaz o vínculo com o paciente escolhido antes.
                    onChange({ nome: e.target.value, indicadoPorId: null })
                    setAberto(true)
                }}
                onKeyDown={(e) => {
                    if (!mostrarLista) return
                    if (e.key === 'ArrowDown') {
                        e.preventDefault()
                        setAtivo((i) => Math.min(i + 1, sugestoes.length - 1))
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault()
                        setAtivo((i) => Math.max(i - 1, 0))
                    } else if (e.key === 'Enter' && ativo >= 0) {
                        e.preventDefault()
                        escolher(sugestoes[ativo])
                    } else if (e.key === 'Escape') {
                        setAberto(false)
                    }
                }}
            />
            {mostrarLista && (
                <div
                    id={`${listId}-lista`}
                    role="listbox"
                    className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-xl border border-app-border bg-white shadow-lg dark:border-app-border-dark dark:bg-app-card-dark"
                >
                    {sugestoes.map((s, i) => (
                        <div
                            key={s.id}
                            role="option"
                            tabIndex={-1}
                            aria-selected={i === ativo}
                            onMouseDown={(e) => {
                                e.preventDefault()
                                escolher(s)
                            }}
                            className={`cursor-pointer px-3 py-2 text-sm ${i === ativo ? 'bg-app-bg-secondary dark:bg-app-hover' : 'hover:bg-app-bg-secondary dark:hover:bg-app-hover'}`}
                        >
                            <span className="text-[var(--app-text-primary)] dark:text-white">{s.nome}</span>
                            {s.telefone && <span className="ml-2 text-xs text-app-text-muted">{s.telefone}</span>}
                        </div>
                    ))}
                </div>
            )}
            {indicadoPorId ? (
                <p className="flex items-center gap-1 text-xs text-[var(--app-success-text)]">
                    <Link2 className="h-3 w-3" aria-hidden="true" /> Vinculado ao cadastro do paciente
                </p>
            ) : (
                nome.trim().length >= 2 && (
                    <p className="text-xs text-app-text-muted">Escolha um nome da lista para vincular ao cadastro.</p>
                )
            )}
        </div>
    )
}
