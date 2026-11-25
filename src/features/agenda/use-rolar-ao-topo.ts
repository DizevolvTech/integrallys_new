import { useLayoutEffect, type RefObject } from 'react'

/**
 * O app rola dentro de <main>, não na janela: ao abrir o atendimento (ou trocar de etapa) o <main> ficava
 * na posição em que a agenda estava. Leva o container rolável ao topo, sem animação.
 */
export function useRolarAoTopo(ref: RefObject<HTMLElement | null>, chave: unknown) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: `chave` só dispara a rolagem a cada troca de etapa
  useLayoutEffect(() => {
    const topo = () => {
      const alvo = ref.current?.closest('main')
      if (alvo) alvo.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    }
    topo()
    // Foco automático de campo e dados que chegam depois do primeiro desenho podem rolar de novo.
    const t = setTimeout(topo, 250)
    return () => clearTimeout(t)
  }, [ref, chave])
}
