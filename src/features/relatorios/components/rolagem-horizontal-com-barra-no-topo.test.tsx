import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'
import { RolagemHorizontalComBarraNoTopo } from '@/features/relatorios/components/rolagem-horizontal-com-barra-no-topo'

function tabela() {
  return (
    <RolagemHorizontalComBarraNoTopo>
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>linha</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </RolagemHorizontalComBarraNoTopo>
  )
}

describe('barra de rolagem no topo da tabela', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} })
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(1800)
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(900)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('aparece quando a tabela é larga e anda junto com a barra de baixo, nos dois sentidos', () => {
    const { container } = render(tabela())
    const topo = screen.getByTestId('barra-rolagem-topo')
    const baixo = container.querySelector('table')?.parentElement as HTMLElement
    expect(topo.classList.contains('hidden')).toBe(false)

    topo.scrollLeft = 300
    fireEvent.scroll(topo)
    expect(baixo.scrollLeft).toBe(300)

    baixo.scrollLeft = 120
    fireEvent.scroll(baixo)
    expect(topo.scrollLeft).toBe(120)
  })

  it('fica escondida quando a tabela cabe na tela', () => {
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(900)
    render(tabela())
    expect(screen.getByTestId('barra-rolagem-topo').classList.contains('hidden')).toBe(true)
  })
})
