/** Normaliza resposta do relay para exibir sucesso/erro corretamente. */

export function isSendOrderSuccess(result) {
  const sr = result?.data?.send_result;
  if (!sr) return !!result?.ok && !result?.data?.error;
  const sc = sr.status_code;
  if (sc === 200) return true;
  if (sc === 202 && sr.text === 'pending') return true;
  return false;
}

export function describeSendOrderResult(result) {
  const sr = result?.data?.send_result;
  if (!sr) {
    if (result?.data?.error) return result.data.error;
    return result?.ok ? 'Ordem processada.' : 'Falha ao enviar ordem.';
  }
  if (sr.status_code === 200) {
    const oid = sr.data?.order_id || result?.data?.order?.order_id;
    const placement = sr.placement?.label || result?.data?.placement?.label;
    const parts = ['Ordem enviada com sucesso.'];
    if (oid) parts.push(`ID ${oid}`);
    if (placement) parts.push(`book ${placement}`);
    return parts.join(' · ');
  }
  if (sr.status_code === 202 && sr.text === 'pending') {
    return 'Ordem em spread — aguardando cálculo automático de preço (price monitor).';
  }
  return sr.text || `Falha HTTP ${sr.status_code}`;
}

export function normalizeCommandResult(action, result) {
  if (!result) {
    return { ok: false, data: { error: 'Sem resposta do relay' } };
  }
  if (result.type === 'error' || result?.data?.error) {
    return {
      ok: false,
      data: { error: result?.data?.error || result.message || 'Erro no comando' },
      action,
    };
  }
  if (action === 'send_order') {
    const ok = isSendOrderSuccess(result);
    return {
      ...result,
      ok,
      data: {
        ...result.data,
        summary: describeSendOrderResult(result),
      },
    };
  }
  if (result.ok == null) {
    return { ...result, ok: !result?.data?.error };
  }
  return result;
}

export function findLiveDealer(dealers, pid) {
  return (dealers || []).find((d) => (
    d.pid === pid
    && (d.dealerStatus === 'online' || d.dealerStatus === 'unused')
  ));
}
