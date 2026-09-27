/**
 * "Metas de conversão" — preferência estrutural de inventário, independente
 * de arbitragem: "eu não quero carregar X, quero estar em Y (ou Y+Z)".
 * Diferente de Spread Opportunity (sobre desalinhamento passageiro do book),
 * aqui o gatilho é "eu tenho isso e quero me livrar".
 *
 * Persistência e monitor (Telegram) ficam 100% no backend
 * (services/rebalance_goal_service.py) — sobrevive ao navegador fechado.
 * Este módulo só tem o cálculo de rota, reaproveitado aqui pra exibição ao
 * vivo (o book já está fluindo via useMarketScan de qualquer forma).
 */

/**
 * Melhor caminho disponível agora pra converter fromAsset -> toAsset, usando
 * as mesmas pernas (Camada A) do motor de Spread Opportunity: direto (1
 * perna) ou via o 3º ativo como ponte (2 pernas) — o que render melhor.
 */
export function bestConversionPath(fromAsset, toAsset, legs, assets) {
  if (fromAsset === toAsset) return null;
  const bridgeAsset = (assets || []).find((a) => a !== fromAsset && a !== toAsset);

  const directLeg = (legs || []).find((l) => l.give === fromAsset && l.get === toAsset);
  const directPct = directLeg ? directLeg.mmPct : null;

  let bridgedPct = null;
  let bridgedLegs = null;
  if (bridgeAsset) {
    const leg1 = (legs || []).find((l) => l.give === fromAsset && l.get === bridgeAsset);
    const leg2 = (legs || []).find((l) => l.give === bridgeAsset && l.get === toAsset);
    if (leg1 && leg2 && leg1.fairRate && leg2.fairRate) {
      const achievedRate = leg1.rate * leg2.rate;
      const fairRate = leg1.fairRate * leg2.fairRate;
      bridgedPct = ((fairRate - achievedRate) / fairRate) * 100;
      bridgedLegs = [leg1, leg2];
    }
  }

  if (directPct != null && (bridgedPct == null || directPct <= bridgedPct)) {
    return { type: 'direct', mmPct: directPct, legs: [directLeg], bridgeAsset: null };
  }
  if (bridgedPct != null) {
    return { type: 'bridge', mmPct: bridgedPct, legs: bridgedLegs, bridgeAsset };
  }
  return null;
}
