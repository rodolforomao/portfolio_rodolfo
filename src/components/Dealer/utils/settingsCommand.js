/** Executa comando WS de settings e lança erro legível. */
export async function runSettingsCommand(sendCommand, action, params = {}) {
  const result = await sendCommand(action, params);
  if (!result?.ok) {
    throw new Error(result?.data?.error || 'WebSocket não respondeu');
  }
  if (result.data?.error) {
    throw new Error(result.data.error);
  }
  return result.data;
}

export function parseChatIds(text) {
  if (!text || typeof text !== 'string') return [];
  return [...new Set(
    text.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean),
  )];
}
