import { env } from '../env.js'

export type DadosEmailAssinatura = {
  numero: string
  filialNome: string
  fornecedorNome: string
  tipoNc: string
  severidade: string | null
  dataIdentificacao: Date
  descricaoDefeito: string | null
  aprovadorNome: string
  areaNome: string
  token: string
  senha: string
  /** solicitacao = 1º envio; lembrete = SLA 50%; escalonamento = nível superior. */
  tipo?: 'solicitacao' | 'lembrete' | 'escalonamento'
  /** Texto do prazo (ex.: "12h") para o aviso de expiração. */
  prazoTexto?: string | null
}

function fmtData(d: Date): string {
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Monta assunto, texto e HTML do e-mail de solicitação de assinatura. */
export function montarEmailAssinatura(d: DadosEmailAssinatura) {
  const base = env.APP_BASE_URL.replace(/\/$/, '')
  const linkAssinar = `${base}/?assinar=${encodeURIComponent(d.token)}`
  const linkPdf = `${base}/api/assinatura/${encodeURIComponent(d.token)}/pdf`
  const tipo = d.tipo ?? 'solicitacao'

  const subject =
    tipo === 'lembrete'
      ? `LEMBRETE — RNC ${d.numero}: prazo de assinatura expirando (${d.areaNome})`
      : tipo === 'escalonamento'
        ? `ESCALONAMENTO — RNC ${d.numero} aguardando sua assinatura (${d.areaNome})`
        : `RNC ${d.numero} — solicitação de assinatura (${d.areaNome})`

  // Aviso conforme o tipo (lembrete/escalonamento).
  const aviso =
    tipo === 'lembrete'
      ? `ATENÇÃO: o prazo${d.prazoTexto ? ` de ${d.prazoTexto}` : ''} para assinatura está expirando. Caso não seja assinada a tempo, a RNC será escalonada para o nível superior da sua área.`
      : tipo === 'escalonamento'
        ? `Esta RNC foi escalonada para você porque o prazo de assinatura do nível anterior expirou sem assinatura.`
        : ''

  const intro =
    tipo === 'solicitacao'
      ? `Você foi indicado(a) como aprovador da área "${d.areaNome}" para a RNC abaixo e sua assinatura é necessária.`
      : `Sua assinatura da área "${d.areaNome}" para a RNC abaixo ainda está pendente.`

  const linhas = [
    `Olá, ${d.aprovadorNome}.`,
    '',
    aviso ? aviso : '',
    aviso ? '' : '',
    intro,
    '',
    `RNC: ${d.numero}`,
    `Unidade: ${d.filialNome}`,
    `Fornecedor: ${d.fornecedorNome}`,
    `Tipo de não conformidade: ${d.tipoNc}`,
    d.severidade ? `Severidade: ${d.severidade}` : '',
    `Data da ocorrência: ${fmtData(d.dataIdentificacao)}`,
    d.descricaoDefeito ? `Defeito: ${d.descricaoDefeito}` : '',
    '',
    `Senha de assinatura: ${d.senha}`,
    '(informe esta senha na plataforma para confirmar a assinatura)',
    '',
    `Acessar e assinar pela plataforma: ${linkAssinar}`,
    `Baixar a RNC em PDF: ${linkPdf}`,
    '',
    'Mensagem automática do SGNC — Sistema de Gestão de Não Conformidade.',
  ].filter((l) => l !== '')

  const text = linhas.join('\n')

  const tituloHtml =
    tipo === 'lembrete'
      ? `Lembrete de assinatura — RNC ${escapeHtml(d.numero)}`
      : tipo === 'escalonamento'
        ? `Escalonamento — RNC ${escapeHtml(d.numero)}`
        : `Solicitação de assinatura — RNC ${escapeHtml(d.numero)}`

  const avisoHtml = aviso
    ? `<div style="margin:0 0 14px;padding:10px 14px;border-radius:8px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-size:13px">${escapeHtml(aviso)}</div>`
    : ''

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#111827;max-width:560px;margin:0 auto">
    <h2 style="margin:0 0 4px">${tituloHtml}</h2>
    <p style="color:#6b7280;margin:0 0 16px">Sistema de Gestão de Não Conformidade</p>
    ${avisoHtml}
    <p>Olá, <b>${escapeHtml(d.aprovadorNome)}</b>. ${escapeHtml(intro)}</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px;margin:12px 0">
      ${[
        ['RNC', d.numero],
        ['Unidade', d.filialNome],
        ['Fornecedor', d.fornecedorNome],
        ['Tipo de NC', d.tipoNc],
        ...(d.severidade ? [['Severidade', d.severidade]] : []),
        ['Data da ocorrência', fmtData(d.dataIdentificacao)],
        ...(d.descricaoDefeito ? [['Defeito', d.descricaoDefeito]] : []),
      ]
        .map(
          ([k, v]) =>
            `<tr><td style="padding:4px 8px;color:#6b7280;border:1px solid #e5e7eb;white-space:nowrap">${escapeHtml(
              k,
            )}</td><td style="padding:4px 8px;border:1px solid #e5e7eb">${escapeHtml(
              v,
            )}</td></tr>`,
        )
        .join('')}
    </table>
    <div style="margin:16px 0;padding:12px 16px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb">
      <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">Senha de assinatura</div>
      <div style="font-size:28px;font-weight:700;letter-spacing:.25em;color:#111827">${escapeHtml(d.senha)}</div>
      <div style="font-size:12px;color:#6b7280">Informe esta senha na plataforma para confirmar a assinatura.</div>
    </div>
    <p style="margin:20px 0">
      <a href="${linkAssinar}" style="background:#111827;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;display:inline-block">
        Acessar e assinar a RNC
      </a>
    </p>
    <p style="font-size:13px"><a href="${linkPdf}" style="color:#2563eb">Baixar a RNC em PDF</a></p>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px">Mensagem automática do SGNC.</p>
  </div>`

  return { subject, text, html }
}

function fmtDataHora(d: Date | null | undefined): string {
  if (!d) return '—'
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

export type AssinaturaResumo = {
  areaNome: string
  nome: string
  cargo: string | null
  assinadoEm: Date | null
  ip: string | null
  navegador: string | null
  so: string | null
  dispositivo: string | null
  latitude: number | null
  longitude: number | null
}

export type DadosEmailConclusao = {
  numero: string
  filialNome: string
  fornecedorNome: string
  tipoNc: string
  severidade: string | null
  dataIdentificacao: Date
  emitenteNome: string | null
  assinaturas: AssinaturaResumo[]
}

/** E-mail de conclusão: todas as assinaturas da RNC foram realizadas. */
export function montarEmailConclusao(d: DadosEmailConclusao) {
  const base = env.APP_BASE_URL.replace(/\/$/, '')
  const subject = `RNC ${d.numero} — assinaturas concluídas`

  const linhasResumo = d.assinaturas.map((a) => {
    const local =
      a.latitude != null && a.longitude != null
        ? `${a.latitude.toFixed(5)}, ${a.longitude.toFixed(5)}`
        : '—'
    return [
      `• ${a.areaNome}: ${a.nome}${a.cargo ? ` (${a.cargo})` : ''}`,
      `    Assinado em: ${fmtDataHora(a.assinadoEm)}`,
      `    IP: ${a.ip ?? '—'} · ${a.navegador ?? '—'}`,
      `    Dispositivo: ${[a.so, a.dispositivo].filter(Boolean).join(' · ') || '—'}`,
      `    Localização: ${local}`,
    ].join('\n')
  })

  const text = [
    `As assinaturas da RNC ${d.numero} foram concluídas.`,
    '',
    `Unidade: ${d.filialNome}`,
    `Fornecedor: ${d.fornecedorNome}`,
    `Tipo de não conformidade: ${d.tipoNc}`,
    d.severidade ? `Severidade: ${d.severidade}` : '',
    `Data da ocorrência: ${fmtData(d.dataIdentificacao)}`,
    d.emitenteNome ? `Emitente: ${d.emitenteNome}` : '',
    '',
    'Assinaturas realizadas:',
    ...linhasResumo,
    '',
    `Acesse a plataforma: ${base}`,
    '',
    'Mensagem automática do SGNC — Sistema de Gestão de Não Conformidade.',
  ]
    .filter((l) => l !== '')
    .join('\n')

  const linhasHtml = d.assinaturas
    .map((a) => {
      const local =
        a.latitude != null && a.longitude != null
          ? `<a href="https://www.google.com/maps?q=${a.latitude},${a.longitude}">${a.latitude.toFixed(5)}, ${a.longitude.toFixed(5)}</a>`
          : '—'
      const disp = [a.so, a.dispositivo].filter(Boolean).join(' · ') || '—'
      return `<tr>
        <td style="padding:6px 8px;border:1px solid #e5e7eb">${escapeHtml(a.areaNome)}</td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb"><b>${escapeHtml(a.nome)}</b>${a.cargo ? `<br><span style="color:#6b7280">${escapeHtml(a.cargo)}</span>` : ''}</td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb">${escapeHtml(fmtDataHora(a.assinadoEm))}</td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb">${escapeHtml(a.ip ?? '—')}<br><span style="color:#6b7280">${escapeHtml(a.navegador ?? '—')} · ${escapeHtml(disp)}</span></td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb">${local}</td>
      </tr>`
    })
    .join('')

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#111827;max-width:680px;margin:0 auto">
    <h2 style="margin:0 0 4px">Assinaturas concluídas — RNC ${escapeHtml(d.numero)}</h2>
    <p style="color:#6b7280;margin:0 0 12px">Sistema de Gestão de Não Conformidade</p>
    <div style="margin:0 0 14px;padding:10px 14px;border-radius:8px;background:#f0fdf4;border:1px solid #86efac;color:#15803d;font-size:14px">
      Todas as assinaturas previstas para esta RNC foram realizadas.
    </div>
    <table style="border-collapse:collapse;width:100%;font-size:13px;margin:0 0 14px">
      ${[
        ['Unidade', d.filialNome],
        ['Fornecedor', d.fornecedorNome],
        ['Tipo de NC', d.tipoNc],
        ...(d.severidade ? [['Severidade', d.severidade]] : []),
        ['Data da ocorrência', fmtData(d.dataIdentificacao)],
        ...(d.emitenteNome ? [['Emitente', d.emitenteNome]] : []),
      ]
        .map(
          ([k, v]) =>
            `<tr><td style="padding:4px 8px;color:#6b7280;border:1px solid #e5e7eb;white-space:nowrap">${escapeHtml(k)}</td><td style="padding:4px 8px;border:1px solid #e5e7eb">${escapeHtml(v)}</td></tr>`,
        )
        .join('')}
    </table>
    <h3 style="margin:0 0 6px;font-size:14px">Assinaturas realizadas</h3>
    <table style="border-collapse:collapse;width:100%;font-size:12px">
      <thead>
        <tr style="background:#f9fafb;color:#6b7280">
          <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:left">Área</th>
          <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:left">Aprovador</th>
          <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:left">Assinado em</th>
          <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:left">Origem</th>
          <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:left">Local</th>
        </tr>
      </thead>
      <tbody>${linhasHtml}</tbody>
    </table>
    <p style="color:#9ca3af;font-size:12px;margin-top:20px">Mensagem automática do SGNC.</p>
  </div>`

  return { subject, text, html }
}
