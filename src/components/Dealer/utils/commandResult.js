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
    const followNote = result?.data?.order?.follow_target
      ? ' Modo follow ativo — spread será calculado automaticamente.'
      : '';
    return `Ordem registrada — aguardando cálculo de preço (price monitor).${followNote}`;
  }
  if (sr.text === 'pending_approval') {
    return sr.data?.message || 'Ordem duvidosa bloqueada — aguardando aprovação manual.';
  }
  if (sr.text === 'reserve_block') {
    return sr.data?.message || 'Ordem bloqueada — abaixo da reserva mínima configurada.';
  }
  return sr.text || `Falha HTTP ${sr.status_code}`;
}

/** Extrai dados de aprovação pendente de uma resposta de send_order, ou null. */
export function sendOrderApprovalInfo(result) {
  const sr = result?.data?.send_result;
  if (sr?.text !== 'pending_approval') return null;
  return {
    signature: sr.data?.signature || null,
    margin: sr.data?.margin ?? null,
    message: sr.data?.message || null,
  };
}

/** Resume cancelamento de ordem — inclui limpeza do config.toml (toml_removed/removed_toml/toml_kept). */
export function describeCancelOrderResult(result) {
  const d = result?.data || {};
  if (d.all) {
    const parts = [`Canceladas: ${d.removed_live ?? 0} ao vivo, ${d.removed_pending ?? 0} pendente(s).`];
    if (d.toml_kept) parts.push('Config.toml mantido — voltam num restart.');
    else if (d.removed_toml) parts.push(`${d.removed_toml} removida(s) do config.toml.`);
    if (d.remaining) parts.push(`${d.remaining} permaneceram (falha ao cancelar).`);
    return parts.join(' ');
  }
  if (d.pending) {
    return d.message || (d.cancelled ? 'Ordem pendente removida do config.toml.' : 'Ordem pendente não encontrada (já removida?).');
  }
  if (d.order_id != null) {
    if (!d.cancelled) return `Falha ao cancelar (HTTP ${d.status_code ?? '?'}).`;
    if (d.toml_kept) return 'Ordem cancelada — mantida no config.toml, volta num restart.';
    return d.toml_removed
      ? 'Ordem cancelada e removida do config.toml.'
      : 'Ordem cancelada (não estava gravada no config.toml).';
  }
  return d.cancelled ? 'Ordem cancelada.' : 'Falha ao cancelar ordem.';
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
  if (action === 'cancel_order') {
    return {
      ...result,
      data: { ...result.data, summary: describeCancelOrderResult(result) },
    };
  }
  const withOk = result.ok == null ? { ...result, ok: !result?.data?.error } : result;
  if (withOk.data?.message && withOk.data?.summary == null) {
    return { ...withOk, data: { ...withOk.data, summary: withOk.data.message } };
  }
  return withOk;
}

export function findLiveDealer(dealers, pid) {
  return (dealers || []).find((d) => (
    d.pid === pid
    && (d.dealerStatus === 'online' || d.dealerStatus === 'unused')
  ));
}
