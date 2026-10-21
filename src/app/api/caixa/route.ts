import { calcularDinheiroNaGaveta, validarTransferenciaCofre } from "@/features/caixa/fechamento";
import { NextResponse, type NextRequest } from "next/server";
import {
  getAppSupabase,
  serverErrorResponse,
  supabaseErrorResponse,
} from "@/lib/app-api";
import { requirePermission } from "@/lib/authz";
import { mapCaixaItem } from "@/lib/domain-mappers";
import {
  authErrorResponse,
  getRequestAuth,
  getScopedUnitId,
  isScopedRole,
} from "@/lib/request-auth";

function getTodayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function resolveUnitId(
  session: NonNullable<Awaited<ReturnType<typeof getRequestAuth>>>,
  requestedUnitId: unknown,
) {
  const scoped = await getScopedUnitId(session);
  if (scoped.error) {
    return { unitId: null as string | null, error: scoped.error };
  }

  // Perfis escopados: nunca confiar no unitId do client.
  if (isScopedRole(session.role)) {
    if (scoped.unidadeId) {
      return { unitId: scoped.unidadeId, error: null as null };
    }
    // Escopado sem unidade no cadastro — não escolher unidade arbitrária.
    return { unitId: null, error: null };
  }

  const supabase = getAppSupabase();
  const requested =
    typeof requestedUnitId === "string" && requestedUnitId.trim() !== ""
      ? requestedUnitId.trim()
      : null;
  if (requested) {
    return { unitId: requested, error: null };
  }

  if (session.user?.unidadeId) {
    return { unitId: String(session.user.unidadeId), error: null };
  }

  const firstUnitResult = await supabase
    .from("unidades")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (firstUnitResult.error) {
    return { unitId: null, error: firstUnitResult.error };
  }

  return {
    unitId: firstUnitResult.data?.id ? String(firstUnitResult.data.id) : null,
    error: null,
  };
}

async function getCaixaPayload(
  request: NextRequest,
  session: Awaited<ReturnType<typeof getRequestAuth>>,
  preferredUnitId?: string | null,
) {
  const supabase = getAppSupabase();
  const todayKey = getTodayKey();

  const { unitId, error: unitError } = await resolveUnitId(
    session!,
    preferredUnitId ?? request.nextUrl.searchParams.get("unitId"),
  );
  if (unitError) {
    return {
      response: supabaseErrorResponse(
        unitError as never,
        "Falha ao resolver unidade do caixa",
      ),
    };
  }

  const sessionQuery = await supabase
    .from("caixa_sessoes")
    .select(
      "id,status,saldo_inicial,saldo_final,valor_transferido,saldo_restante,aberto_em,fechado_em,unidade_id",
    )
    .eq("data_operacao", todayKey)
    .eq("unidade_id", unitId)
    .order("aberto_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sessionQuery.error) {
    return {
      response: supabaseErrorResponse(
        sessionQuery.error,
        "Falha ao carregar sessão de caixa",
      ),
    };
  }

  const caixaSession = sessionQuery.data;
  const sessionId = caixaSession?.id ? String(caixaSession.id) : null;

  const movimentosQuery = await supabase
    .from("caixa_movimentos")
    .select(
      "id,descricao,tipo,valor,data_movimento,forma,operador_nome,sessao_id,bandeira,parcelas,valor_parcela,forma_pagamento_id",
    )
    .eq("unidade_id", unitId)
    .gte("data_movimento", `${todayKey}T00:00:00`)
    .lte("data_movimento", `${todayKey}T23:59:59.999`)
    .order("data_movimento", { ascending: false });

  if (movimentosQuery.error) {
    return {
      response: supabaseErrorResponse(
        movimentosQuery.error,
        "Falha ao carregar movimentos de caixa",
      ),
    };
  }

  const movimentos = (movimentosQuery.data ?? []).map((row) =>
    mapCaixaItem(row),
  );
  const entradas = movimentos
    .filter((item) => item.tipo === "entrada")
    .reduce((acc, item) => acc + item.valor, 0);
  const saidas = movimentos
    .filter((item) => item.tipo === "saida")
    .reduce((acc, item) => acc + item.valor, 0);
  const saldoInicial = Number(caixaSession?.saldo_inicial ?? 0);
  const saldoAtual =
    (caixaSession?.status ?? "fechado") === "aberto"
      ? saldoInicial + entradas - saidas
      : Number(caixaSession?.saldo_final ?? saldoInicial + entradas - saidas);

  return {
    response: NextResponse.json({
      data: movimentos,
      meta: {
        ...session,
        caixa: {
          sessionId,
          unitId,
          isOpen: caixaSession?.status === "aberto",
          saldoInicial,
          saldoAtual,
          entradas,
          saidas,
          movimentos: movimentos.length,
          valorTransferido: Number(caixaSession?.valor_transferido ?? 0),
          saldoRestante: Number(caixaSession?.saldo_restante ?? 0),
          openedAt: caixaSession?.aberto_em ?? null,
          closedAt: caixaSession?.fechado_em ?? null,
        },
      },
    }),
  };
}

export async function GET(request: NextRequest) {
  const session = await getRequestAuth(request);
  if (!session) return authErrorResponse();
  const denied = await requirePermission(session.userId, "caixa", "read");
  if (denied) return denied;

  const payload = await getCaixaPayload(request, session);
  return payload.response;
}

export async function POST(request: NextRequest) {
  const session = await getRequestAuth(request);
  if (!session) return authErrorResponse();
  const denied = await requirePermission(session.userId, "caixa", "create");
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body?.action) {
    return serverErrorResponse(
      "Ação de caixa inválida",
      "INVALID_CAIXA_ACTION",
      400,
    );
  }

  const supabase = getAppSupabase();
  const todayKey = getTodayKey();
  const { unitId, error: unitError } = await resolveUnitId(
    session,
    body.unidadeId,
  );
  if (unitError) {
    return supabaseErrorResponse(
      unitError as never,
      "Falha ao resolver unidade do caixa",
    );
  }

  if (!unitId) {
    return serverErrorResponse(
      "Nenhuma unidade disponível para operação de caixa",
      "CAIXA_UNIT_REQUIRED",
      400,
    );
  }

  const currentSessionQuery = await supabase
    .from("caixa_sessoes")
    .select("id,status,saldo_inicial")
    .eq("data_operacao", todayKey)
    .eq("unidade_id", unitId)
    .order("aberto_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (currentSessionQuery.error) {
    return supabaseErrorResponse(
      currentSessionQuery.error,
      "Falha ao carregar sessão atual de caixa",
    );
  }

  const currentSession = currentSessionQuery.data;
  const action = String(body.action);

  if (action === "open") {
    if (currentSession?.status === "aberto") {
      return serverErrorResponse(
        "Já existe um caixa aberto para esta unidade hoje",
        "CAIXA_ALREADY_OPEN",
        409,
      );
    }

    const saldoInicial =
      typeof body.saldoInicial === "number" ? body.saldoInicial : 0;
    const { error } = await supabase.from("caixa_sessoes").upsert(
      {
        unidade_id: unitId,
        opened_by_id: session.userId,
        operador_id: session.userId,
        closed_by_id: null,
        data_operacao: todayKey,
        status: "aberto",
        saldo_inicial: saldoInicial,
        saldo_final: null,
        valor_transferido: null,
        saldo_restante: null,
        observacoes: body.observacoes ?? null,
        aberto_em: new Date().toISOString(),
        fechado_em: null,
      },
      { onConflict: "unidade_id,data_operacao" },
    );

    if (error) {
      return supabaseErrorResponse(error, "Falha ao abrir caixa");
    }
  } else if (action === "entrada" || action === "saida") {
    if (currentSession?.status !== "aberto" || !currentSession.id) {
      return serverErrorResponse(
        "Não existe caixa aberto para registrar movimentação",
        "CAIXA_NOT_OPEN",
        409,
      );
    }

    if (!body.descricao || typeof body.valor !== "number" || body.valor <= 0) {
      return serverErrorResponse(
        "Movimentação de caixa inválida",
        "INVALID_CAIXA_MOVIMENTO",
        400,
      );
    }

    const formaUsada = body.forma ?? "dinheiro";
    const isCardForma = formaUsada === "cartao_credito" || formaUsada === "cartao_debito";
    const bandeira =
      isCardForma && typeof body.bandeira === "string" && body.bandeira.trim().length > 0
        ? body.bandeira.trim()
        : null;
    const parcelas =
      formaUsada === "cartao_credito" && typeof body.parcelas === "number" && body.parcelas >= 1 && body.parcelas <= 12
        ? Math.round(body.parcelas)
        : null;
    const valorParcela =
      parcelas !== null && typeof body.valorParcela === "number" && body.valorParcela >= 0
        ? Number(body.valorParcela.toFixed(2))
        : null;

    // Item 9b — auto-vincula ao catálogo de formas pela forma controlada
    // (não-cartão). Determinístico: valor de select, não texto livre. Cartões
    // geram sua própria forma no item 9c, então ficam null aqui.
    const formaTipo = String(formaUsada);
    let formaPagamentoId: string | null = null;
    if (formaTipo === "dinheiro" || formaTipo === "pix" || formaTipo === "transferencia") {
      const { data: formaCatalogo } = await supabase
        .from("formas_pagamento")
        .select("id")
        .eq("tipo", formaTipo)
        .is("cartao_id", null)
        .eq("ativo", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      formaPagamentoId = formaCatalogo?.id ? String(formaCatalogo.id) : null;
    }

    const { error } = await supabase.from("caixa_movimentos").insert({
      unidade_id: unitId,
      usuario_id: session.userId,
      operador_id: session.userId,
      sessao_id: currentSession.id,
      descricao: body.descricao,
      tipo: action,
      valor: body.valor,
      forma: formaUsada,
      origem: "manual",
      operador_nome: session.user.name || null,
      data_movimento: new Date().toISOString(),
      bandeira,
      parcelas,
      valor_parcela: valorParcela,
      forma_pagamento_id: formaPagamentoId,
    });

    if (error) {
      return supabaseErrorResponse(
        error,
        `Falha ao registrar ${action === "entrada" ? "suprimento" : "sangria"}`,
      );
    }
  } else if (action === "close") {
    if (currentSession?.status !== "aberto" || !currentSession.id) {
      return serverErrorResponse(
        "Não existe caixa aberto para fechamento",
        "CAIXA_NOT_OPEN",
        409,
      );
    }

    const movimentosQuery = await supabase
      .from("caixa_movimentos")
      .select("tipo,valor,forma")
      .eq("sessao_id", currentSession.id);

    if (movimentosQuery.error) {
      return supabaseErrorResponse(
        movimentosQuery.error,
        "Falha ao calcular fechamento de caixa",
      );
    }

    const entradas = (movimentosQuery.data ?? [])
      .filter((item) => item.tipo === "entrada")
      .reduce((acc, item) => acc + Number(item.valor ?? 0), 0);
    const saidas = (movimentosQuery.data ?? [])
      .filter((item) => item.tipo === "saida")
      .reduce((acc, item) => acc + Number(item.valor ?? 0), 0);

    const saldoInicial = Number(currentSession.saldo_inicial ?? 0);
    const saldoFinal = saldoInicial + entradas - saidas;
    const valorTransferido =
      typeof body.valorTransferido === "number" ? body.valorTransferido : 0;
    const dinheiroNaGaveta = calcularDinheiroNaGaveta(
      saldoInicial,
      (movimentosQuery.data ?? []).map((item) => ({
        tipo: String(item.tipo),
        valor: Number(item.valor ?? 0),
        forma: item.forma as string | null,
      })),
    );
    const transferError = validarTransferenciaCofre(
      valorTransferido,
      dinheiroNaGaveta,
    );
    if (transferError) {
      return serverErrorResponse(
        transferError,
        "CAIXA_TRANSFER_INVALID",
        400,
      );
    }
    // O que fica na gaveta é dinheiro: PIX e cartão não passam pelo cofre.
    const saldoRestante = Math.max(0, Math.round((dinheiroNaGaveta - valorTransferido) * 100) / 100);

    const fechadoEm = new Date().toISOString();
    const resumoFromBody =
      body.resumo && typeof body.resumo === "object" && !Array.isArray(body.resumo)
        ? (body.resumo as Record<string, unknown>)
        : null;
    const resumoFechamento = {
      ...(resumoFromBody ?? {}),
      saldoInicial,
      entradas,
      saidas,
      saldoFinal,
      valorTransferido,
      saldoRestante,
      dinheiroNaGaveta,
      dinheiroRestante: Math.round((dinheiroNaGaveta - valorTransferido) * 100) / 100,
      fechadoEm,
    };

    const { error } = await supabase
      .from("caixa_sessoes")
      .update({
        status: "fechado",
        closed_by_id: session.userId,
        saldo_final: saldoFinal,
        valor_transferido: valorTransferido,
        saldo_restante: saldoRestante,
        observacoes: body.observacoes ?? null,
        fechado_em: fechadoEm,
        resumo_fechamento: resumoFechamento,
      })
      .eq("id", currentSession.id);

    if (error) {
      return supabaseErrorResponse(error, "Falha ao fechar caixa");
    }
  } else {
    return serverErrorResponse(
      "Ação de caixa não suportada",
      "UNSUPPORTED_CAIXA_ACTION",
      400,
    );
  }

  const payload = await getCaixaPayload(request, session, unitId);
  return payload.response;
}

export async function PUT(request: NextRequest) {
  const session = await getRequestAuth(request);
  if (!session) return authErrorResponse();
  const denied = await requirePermission(session.userId, "caixa", "update");
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (
    !body?.id ||
    !body?.descricao ||
    typeof body.valor !== "number" ||
    !body?.tipo
  ) {
    return serverErrorResponse(
      "Movimentação inválida",
      "INVALID_CAIXA_MOVIMENTO",
      400,
    );
  }

  const supabase = getAppSupabase();
  const { data: existing, error: existingError } = await supabase
    .from("caixa_movimentos")
    .select("unidade_id")
    .eq("id", String(body.id))
    .maybeSingle();

  if (existingError) {
    return supabaseErrorResponse(
      existingError,
      "Falha ao carregar movimentação de caixa",
    );
  }

  const scoped = await getScopedUnitId(session);
  if (scoped.error) {
    return supabaseErrorResponse(scoped.error, "Falha ao validar unidade");
  }
  if (
    isScopedRole(session.role) &&
    scoped.unidadeId &&
    existing?.unidade_id &&
    String(existing.unidade_id) !== scoped.unidadeId
  ) {
    return serverErrorResponse(
      "Movimentação fora do escopo da unidade",
      "CAIXA_UNIT_FORBIDDEN",
      403,
    );
  }

  const { error } = await supabase
    .from("caixa_movimentos")
    .update({
      descricao: String(body.descricao),
      valor: Number(body.valor),
      tipo: body.tipo === "saida" ? "saida" : "entrada",
      forma: body.forma ? String(body.forma) : "dinheiro",
      updated_at: new Date().toISOString(),
    })
    .eq("id", String(body.id));

  if (error) {
    return supabaseErrorResponse(
      error,
      "Falha ao atualizar movimentação de caixa",
    );
  }

  const payload = await getCaixaPayload(
    request,
    session,
    existing?.unidade_id ? String(existing.unidade_id) : undefined,
  );
  return payload.response;
}

export async function DELETE(request: NextRequest) {
  const session = await getRequestAuth(request);
  if (!session) return authErrorResponse();
  const denied = await requirePermission(session.userId, "caixa", "delete");
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body?.id) {
    return serverErrorResponse(
      "Movimentação inválida",
      "INVALID_CAIXA_MOVIMENTO",
      400,
    );
  }

  const supabase = getAppSupabase();
  const { data: existing, error: existingError } = await supabase
    .from("caixa_movimentos")
    .select("unidade_id")
    .eq("id", String(body.id))
    .maybeSingle();

  if (existingError) {
    return supabaseErrorResponse(
      existingError,
      "Falha ao carregar movimentação de caixa",
    );
  }

  const scoped = await getScopedUnitId(session);
  if (scoped.error) {
    return supabaseErrorResponse(scoped.error, "Falha ao validar unidade");
  }
  if (
    isScopedRole(session.role) &&
    scoped.unidadeId &&
    existing?.unidade_id &&
    String(existing.unidade_id) !== scoped.unidadeId
  ) {
    return serverErrorResponse(
      "Movimentação fora do escopo da unidade",
      "CAIXA_UNIT_FORBIDDEN",
      403,
    );
  }

  const { error } = await supabase
    .from("caixa_movimentos")
    .delete()
    .eq("id", String(body.id));

  if (error) {
    return supabaseErrorResponse(
      error,
      "Falha ao excluir movimentação de caixa",
    );
  }

  const payload = await getCaixaPayload(
    request,
    session,
    existing?.unidade_id ? String(existing.unidade_id) : undefined,
  );
  return payload.response;
}
