'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { precisaBarraNoTopo, sincronizarRolagem } from '@/lib/relatorios/sincronizar-scroll'

/** A área que rola na horizontal é o pai direto da <table> (o componente Table já a cria com a barra de baixo). */
function acharAreaRolavel(raiz: HTMLElement): HTMLElement | null {
  return raiz.querySelector('table')?.parentElement ?? null
}

/**
 * Envolve uma tabela larga e repete a barra de rolagem horizontal NO TOPO, sincronizada com a de baixo,
 * para quem olha as primeiras linhas (mais recentes) sem precisar descer até o fim da tabela.
 * Vale para qualquer tabela dos relatórios que passe por aqui.
 */
export function RolagemHorizontalComBarraNoTopo({ children }: { children: ReactNode }) {
  const raiz = useRef<HTMLDivElement>(null)
  const topo = useRef<HTMLDivElement>(null)
  const [larguraConteudo, setLarguraConteudo] = useState(0)
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    const area = raiz.current ? acharAreaRolavel(raiz.current) : null
    const barra = topo.current
    if (!area || !barra) return

    const medir = () => {
      setLarguraConteudo(area.scrollWidth)
      setVisivel(precisaBarraNoTopo(area.scrollWidth, area.clientWidth))
    }
    const deBaixoParaCima = () => {
      if (topo.current) sincronizarRolagem(area, topo.current)
    }
    const deCimaParaBaixo = () => sincronizarRolagem(barra, area)

    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(area)
    if (area.firstElementChild) observador.observe(area.firstElementChild)
    area.addEventListener('scroll', deBaixoParaCima, { passive: true })
    barra.addEventListener('scroll', deCimaParaBaixo, { passive: true })
    return () => {
      observador.disconnect()
      area.removeEventListener('scroll', deBaixoParaCima)
      barra.removeEventListener('scroll', deCimaParaBaixo)
    }
  }, [])

  return (
    <div ref={raiz}>
      <div
        ref={topo}
        data-testid="barra-rolagem-topo"
        aria-hidden="true"
        className={`custom-scrollbar overflow-x-auto overflow-y-hidden border-b border-app-border dark:border-app-border-dark ${visivel ? '' : 'hidden'}`}
      >
        <div style={{ width: larguraConteudo, height: 1 }} />
      </div>
      {children}
    </div>
  )
}
