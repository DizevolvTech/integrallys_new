import { type NextRequest, NextResponse } from 'next/server'
import { serverErrorResponse, supabaseErrorResponse } from '@/lib/app-api'
import { acessoEvolucao } from '@/lib/evolucao-acesso'
import { EXAMES_BUCKET, urlDeCaminho } from '@/lib/exames-storage'

const MIMES = new Set(['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'])
const MAX_BYTES = 10 * 1024 * 1024

function texto(valor: FormDataEntryValue | null, max = 500) {
  const t = typeof valor === 'string' ? valor.trim().slice(0, max) : ''
  return t || null
}

/** Documentos da evolução; o que só existe como contagem antiga (sem arquivo) vem como "arquivo não disponível". */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const acesso = await acessoEvolucao(request, id, 'read')
  if (acesso.erro) return acesso.erro
  const { supabase, evolucao } = acesso

  const { data, error } = await supabase
    .from('evolucao_documentos')
    .select('id,nome,tipo,meio,data_envio,recebido,link,observacoes,exame_id,created_at')
    .eq('evolucao_id', id)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) return supabaseErrorResponse(error, 'Falha ao carregar documentos')

  const reais = (data ?? []).map((d) => ({
    id: String(d.id),
    nome: String(d.nome),
    tipo: d.tipo ? String(d.tipo) : null,
    meio: d.meio ? String(d.meio) : null,
    dataEnvio: d.data_envio ? String(d.data_envio) : null,
    recebido: Boolean(d.recebido),
    observacoes: d.observacoes ? String(d.observacoes) : null,
    criadoEm: String(d.created_at),
    url: d.exame_id
      ? `/api/pacientes/exames/${String(d.exame_id)}/arquivo`
      : d.link
        ? String(d.link)
        : null,
    disponivel: Boolean(d.exame_id || d.link),
  }))
  const antigos = Math.max(Number(evolucao.docs_count ?? 0), 0)
  const legado = Array.from({ length: antigos }, (_, i) => ({
    id: `legado-${i + 1}`,
    nome: `Documento ${i + 1} desta evolução`,
    tipo: null,
    meio: null,
    dataEnvio: String(evolucao.data_evolucao),
    recebido: false,
    observacoes: null,
    criadoEm: String(evolucao.data_evolucao),
    url: null,
    disponivel: false,
  }))
  return NextResponse.json({ data: [...reais, ...legado] })
}

/** FormData: nome, tipo, meio, dataEnvio, recebido, link, observacoes e file (PDF/JPG/PNG até 10 MB). */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const acesso = await acessoEvolucao(request, id, 'update')
  if (acesso.erro) return acesso.erro
  const { supabase, evolucao, session } = acesso

  const form = await request.formData().catch(() => null)
  if (!form) return serverErrorResponse('Envio inválido', 'INVALID_UPLOAD', 400)
  const file = form.get('file')
  const link = texto(form.get('link'))
  const tipo = texto(form.get('tipo'), 60)
  const arquivo = file instanceof File && file.size > 0 ? file : null
  if (!arquivo && !link)
    return serverErrorResponse(
      'Anexe um arquivo ou informe o link do documento.',
      'MISSING_FILE',
      400,
    )
  if (link && !/^https?:\/\//i.test(link))
    return serverErrorResponse(
      'O link precisa começar com http:// ou https://',
      'INVALID_LINK',
      400,
    )
  if (arquivo && !MIMES.has(arquivo.type))
    return serverErrorResponse('Envie um arquivo PDF, JPG ou PNG.', 'INVALID_MIME', 400)
  if (arquivo && arquivo.size > MAX_BYTES)
    return serverErrorResponse('Arquivo acima de 10 MB.', 'FILE_TOO_LARGE', 400)

  const pacienteId = String(evolucao.paciente_id)
  const nome = texto(form.get('nome'), 120) ?? arquivo?.name ?? link ?? 'Documento'
  let exameId: string | null = null
  let caminho: string | null = null

  if (arquivo) {
    const seguro = (arquivo.name || 'documento').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80)
    caminho = `${pacienteId}/${Date.now()}-${seguro}`
    const up = await supabase.storage
      .from(EXAMES_BUCKET)
      .upload(caminho, new Uint8Array(await arquivo.arrayBuffer()), {
        contentType: arquivo.type,
        upsert: false,
      })
    if (up.error)
      return serverErrorResponse('Não foi possível guardar o arquivo.', 'UPLOAD_FAILED', 500)
    const { data: exame, error: exameErro } = await supabase
      .from('paciente_exames')
      .insert({
        paciente_id: pacienteId,
        nome,
        tipo,
        url: urlDeCaminho(caminho),
        uploaded_by: session.userId,
      })
      .select('id')
      .single()
    if (exameErro || !exame) {
      await supabase.storage.from(EXAMES_BUCKET).remove([caminho])
      return serverErrorResponse('Não foi possível registrar o documento.', 'INSERT_FAILED', 500)
    }
    exameId = String(exame.id)
  }

  const { error } = await supabase.from('evolucao_documentos').insert({
    evolucao_id: id,
    paciente_id: pacienteId,
    exame_id: exameId,
    nome,
    tipo,
    meio: texto(form.get('meio'), 40),
    data_envio: texto(form.get('dataEnvio'), 10),
    recebido: form.get('recebido') === 'true',
    link: arquivo ? null : link,
    observacoes: texto(form.get('observacoes'), 1000),
    created_by: session.userId,
  })
  if (error) {
    if (exameId) await supabase.from('paciente_exames').delete().eq('id', exameId)
    if (caminho) await supabase.storage.from(EXAMES_BUCKET).remove([caminho])
    return supabaseErrorResponse(error, 'Falha ao salvar documento')
  }
  return NextResponse.json({ ok: true }, { status: 201 })
}
