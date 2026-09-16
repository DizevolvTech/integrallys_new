'use client'

import { useCallback, useRef, useState } from 'react'
import { validarCEP } from '@/lib/validacao-br'
import { buscarCep, type EnderecoCep } from '@/services/cep.service'

/**
 * Estados da consulta automática, compartilhados por CEP e CNPJ:
 * inativo -> buscando -> (encontrado | nao-encontrado | erro).
 * `invalido` cobre documento com dígito verificador incorreto.
 */
export type StatusConsulta =
  | 'inativo'
  | 'buscando'
  | 'encontrado'
  | 'nao-encontrado'
  | 'invalido'
  | 'erro'

/**
 * Auto-preenchimento de endereço a partir do CEP.
 *
 * Dispara a consulta quando o CEP atinge 8 dígitos e evita repetir a chamada
 * para o mesmo CEP. Nunca bloqueia o formulário: os campos preenchidos seguem
 * editáveis e qualquer falha só muda a mensagem exibida.
 */
export function useConsultaCep(aoEncontrar: (endereco: EnderecoCep) => void) {
  const [status, setStatus] = useState<StatusConsulta>('inativo')
  const ultimoConsultado = useRef('')

  // Mantém o callback atual sem recriar `consultar` a cada render do formulário.
  const aoEncontrarRef = useRef(aoEncontrar)
  aoEncontrarRef.current = aoEncontrar

  const consultar = useCallback(async (valor: string) => {
    const cep = (valor ?? '').replace(/\D/g, '')

    if (!validarCEP(cep)) {
      ultimoConsultado.current = ''
      setStatus('inativo')
      return
    }

    if (ultimoConsultado.current === cep) return
    ultimoConsultado.current = cep

    setStatus('buscando')
    const resultado = await buscarCep(cep)

    // Resposta stale: usuário já digitou outro CEP enquanto a request estava em voo.
    if (ultimoConsultado.current !== cep) return

    if (resultado.status === 'encontrado') {
      aoEncontrarRef.current(resultado.endereco)
      setStatus('encontrado')
      return
    }

    setStatus(resultado.status === 'nao-encontrado' ? 'nao-encontrado' : 'erro')
  }, [])

  const reiniciar = useCallback(() => {
    ultimoConsultado.current = ''
    setStatus('inativo')
  }, [])

  return { status, consultar, reiniciar }
}
