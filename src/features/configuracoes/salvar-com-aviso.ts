import { toast } from 'sonner'
import { isForbiddenError } from '@/lib/api-client'

/** Mensagem de erro ao salvar configurações: perfil sem permissão ganha texto claro, não falha silenciosa. */
export function mensagemErroSalvar(err: unknown): string {
  if (isForbiddenError(err))
    return 'Seu perfil não pode alterar estas configurações. Peça ao administrador.'
  return err instanceof Error && err.message
    ? err.message
    : 'Não foi possível salvar. Tente de novo.'
}

/** Roda a ação de salvar e mostra o erro na tela quando o servidor recusa. */
export async function salvarComAviso(acao: () => Promise<unknown>): Promise<void> {
  try {
    await acao()
  } catch (err) {
    toast.error(mensagemErroSalvar(err))
  }
}
