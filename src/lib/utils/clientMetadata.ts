/** Coleta o máximo de informações técnicas do cliente para a assinatura. */
export function coletarMetadadosCliente(): Record<string, unknown> {
  const nav = navigator as Navigator & {
    deviceMemory?: number
    userAgentData?: unknown
    connection?: { effectiveType?: string; downlink?: number; rtt?: number }
  }
  const s = window.screen
  return {
    userAgent: nav.userAgent,
    idioma: nav.language,
    idiomas: nav.languages,
    plataforma: nav.platform,
    fornecedor: nav.vendor,
    nucleosCpu: nav.hardwareConcurrency,
    memoriaGb: nav.deviceMemory,
    toqueMaxPontos: nav.maxTouchPoints,
    online: nav.onLine,
    cookiesHabilitados: nav.cookieEnabled,
    userAgentData: nav.userAgentData,
    conexao: nav.connection
      ? {
          tipoEfetivo: nav.connection.effectiveType,
          downlink: nav.connection.downlink,
          rtt: nav.connection.rtt,
        }
      : null,
    tela: {
      largura: s.width,
      altura: s.height,
      larguraDisponivel: s.availWidth,
      alturaDisponivel: s.availHeight,
      profundidadeCor: s.colorDepth,
      pixelRatio: window.devicePixelRatio,
      orientacao: s.orientation?.type,
    },
    janela: { largura: window.innerWidth, altura: window.innerHeight },
    fusoHorario: Intl.DateTimeFormat().resolvedOptions().timeZone,
    deslocamentoFusoMin: new Date().getTimezoneOffset(),
    capturadoEmCliente: new Date().toISOString(),
  }
}

/** Pede a geolocalização (se o usuário autorizar). Resolve null se negado. */
export function obterGeolocalizacao(): Promise<{
  latitude: number
  longitude: number
  precisao: number | null
} | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          precisao: pos.coords.accuracy ?? null,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    )
  })
}
