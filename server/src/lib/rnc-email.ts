import { env } from '../env.js'

/**
 * URL base pública usada nos links dos e-mails. Quando APP_BASE_URL foi
 * configurada para produção, ela é autoritativa; caso contrário, usa a URL
 * derivada da requisição (via nginx). Só cai no default local em último caso
 * (ex.: e-mails do agendador sem requisição e sem APP_BASE_URL configurada).
 */
function resolverBaseUrl(override?: string): string {
  const configurada = env.APP_BASE_URL.replace(/\/$/, '')
  const ehLocal = /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(configurada)
  if (configurada && !ehLocal) return configurada
  if (override) return override.replace(/\/$/, '')
  return configurada
}

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
  /** URL pública do app (derivada da requisição) para os links do e-mail. */
  baseUrl?: string
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
  const base = resolverBaseUrl(d.baseUrl)
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
  /** URL pública do app (derivada da requisição) para os links do e-mail. */
  baseUrl?: string
}

/** E-mail de conclusão: todas as assinaturas da RNC foram realizadas. */
export function montarEmailConclusao(d: DadosEmailConclusao) {
  const base = resolverBaseUrl(d.baseUrl)
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

// ── Ciência do fornecedor ───────────────────────────────────────────

export type DadosEmailCiencia = {
  numero: string
  filialNome: string
  fornecedorNome: string
  contatoNome: string | null
  tipoNc: string
  severidade: string | null
  dataIdentificacao: Date
  descricaoDefeito: string | null
  quantidadeDefeito: number | null
  token: string
  prazoEm: Date
  baseUrl?: string
}

/**
 * E-mail enviado ao contato do fornecedor quando todas as assinaturas
 * internas foram concluídas. Traz o PDF e o link onde ele registra o
 * aceite ou a recusa da não conformidade.
 */
export function montarEmailCiencia(d: DadosEmailCiencia) {
  const base = resolverBaseUrl(d.baseUrl)
  const linkCiencia = `${base}/?ciencia=${encodeURIComponent(d.token)}`
  const linkPdf = `${base}/api/ciencia/${encodeURIComponent(d.token)}/pdf`
  const prazo = fmtDataHora(d.prazoEm)

  const subject = `RNC ${d.numero} — ciência do fornecedor necessária (prazo: ${prazo})`

  const linhas = [
    `Prezado(a)${d.contatoNome ? ` ${d.contatoNome}` : ''},`,
    '',
    `Foi registrada uma não conformidade envolvendo ${d.fornecedorNome}. O relatório abaixo já foi analisado e assinado internamente e segue para a sua ciência.`,
    '',
    `RNC: ${d.numero}`,
    `Unidade: ${d.filialNome}`,
    `Tipo de não conformidade: ${d.tipoNc}`,
    d.severidade ? `Severidade: ${d.severidade}` : '',
    `Data da ocorrência: ${fmtData(d.dataIdentificacao)}`,
    d.quantidadeDefeito != null
      ? `Quantidade com defeito: ${d.quantidadeDefeito}`
      : '',
    d.descricaoDefeito ? `Defeito: ${d.descricaoDefeito}` : '',
    '',
    `Documento completo (PDF): ${linkPdf}`,
    '',
    `Registre a sua resposta: ${linkCiencia}`,
    '',
    'Na página acima é possível:',
    '  • ACEITAR — reconhecer e aceitar a não conformidade;',
    '  • RECUSAR — recusar ou questionar, informando a justificativa.',
    '',
    `IMPORTANTE: a resposta deve ser registrada até ${prazo}. Sem manifestação nesse prazo, a não conformidade será considerada ACEITA automaticamente por decurso de prazo.`,
  ].filter((l) => l !== null)

  const text = linhas.join('\n')

  const item = (k: string, v: string) =>
    v
      ? `<tr><td style="padding:4px 10px 4px 0;color:#6b7280;font-size:13px">${escapeHtml(k)}</td><td style="padding:4px 0;color:#111827;font-size:13px"><b>${escapeHtml(v)}</b></td></tr>`
      : ''

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#111827">
    <h2 style="margin:0 0 4px">Ciência do fornecedor — RNC ${escapeHtml(d.numero)}</h2>
    <p style="color:#6b7280;margin:0 0 16px;font-size:14px">
      Prezado(a)${d.contatoNome ? ` ${escapeHtml(d.contatoNome)}` : ''}, foi registrada uma não conformidade
      envolvendo <b>${escapeHtml(d.fornecedorNome)}</b>. O relatório já foi assinado internamente e segue para a sua ciência.
    </p>
    <table style="border-collapse:collapse;margin-bottom:18px">
      ${item('Unidade', d.filialNome)}
      ${item('Tipo de não conformidade', d.tipoNc)}
      ${item('Severidade', d.severidade ?? '')}
      ${item('Data da ocorrência', fmtData(d.dataIdentificacao))}
      ${item('Quantidade com defeito', d.quantidadeDefeito != null ? String(d.quantidadeDefeito) : '')}
      ${item('Defeito', d.descricaoDefeito ?? '')}
    </table>
    <p style="margin:0 0 18px">
      <a href="${linkCiencia}" style="background:#111827;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;display:inline-block;font-size:14px">
        Registrar minha resposta
      </a>
      <a href="${linkPdf}" style="margin-left:8px;color:#374151;text-decoration:none;border:1px solid #d1d5db;padding:10px 18px;border-radius:8px;display:inline-block;font-size:14px">
        Ver documento (PDF)
      </a>
    </p>
    <p style="font-size:13px;color:#374151;margin:0 0 6px">Na página você poderá:</p>
    <ul style="font-size:13px;color:#374151;margin:0 0 16px;padding-left:18px">
      <li><b>Aceitar</b> — reconhecer e aceitar a não conformidade.</li>
      <li><b>Recusar</b> — recusar ou questionar, informando a justificativa.</li>
    </ul>
    <p style="background:#fef3c7;border:1px solid #fde68a;color:#92400e;padding:10px 12px;border-radius:6px;font-size:13px;margin:0">
      A resposta deve ser registrada até <b>${escapeHtml(prazo)}</b>. Sem manifestação nesse prazo,
      a não conformidade será considerada <b>aceita automaticamente por decurso de prazo</b>.
    </p>
    <p style="color:#9ca3af;font-size:12px;margin-top:20px">Mensagem automática do SGNC.</p>
  </div>`

  return { subject, text, html }
}

export type DadosEmailRespostaCiencia = {
  numero: string
  fornecedorNome: string
  aceita: boolean
  porDecurso: boolean
  respondidaPor: string | null
  respondidaEm: Date
  justificativa: string | null
}

/** Aviso interno com a resposta do fornecedor (ou o aceite por decurso). */
export function montarEmailRespostaCiencia(d: DadosEmailRespostaCiencia) {
  const situacao = d.porDecurso
    ? 'ACEITA automaticamente por decurso de prazo'
    : d.aceita
      ? 'ACEITA pelo fornecedor'
      : 'RECUSADA/QUESTIONADA pelo fornecedor'
  const subject = `RNC ${d.numero} — ${d.porDecurso ? 'aceite automático (decurso de prazo)' : d.aceita ? 'aceita pelo fornecedor' : 'recusada pelo fornecedor'}`

  const text = [
    `A RNC ${d.numero} (${d.fornecedorNome}) teve a ciência do fornecedor registrada.`,
    '',
    `Situação: ${situacao}`,
    `Data da resposta: ${fmtDataHora(d.respondidaEm)}`,
    d.respondidaPor ? `Respondido por: ${d.respondidaPor}` : '',
    d.justificativa ? `\nJustificativa do fornecedor:\n${d.justificativa}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const cor = d.aceita ? '#15803d' : '#b91c1c'
  const fundo = d.aceita ? '#f0fdf4' : '#fef2f2'
  const borda = d.aceita ? '#86efac' : '#fecaca'

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#111827">
    <h2 style="margin:0 0 4px">RNC ${escapeHtml(d.numero)} — ciência do fornecedor</h2>
    <p style="color:#6b7280;margin:0 0 16px;font-size:14px">Fornecedor: <b>${escapeHtml(d.fornecedorNome)}</b></p>
    <p style="background:${fundo};border:1px solid ${borda};color:${cor};padding:12px 14px;border-radius:8px;font-size:14px;margin:0 0 14px">
      <b>${escapeHtml(situacao)}</b><br>
      <span style="color:#374151;font-size:13px">Em ${escapeHtml(fmtDataHora(d.respondidaEm))}${d.respondidaPor ? ` · por ${escapeHtml(d.respondidaPor)}` : ''}</span>
    </p>
    ${
      d.justificativa
        ? `<p style="font-size:13px;color:#374151;margin:0 0 4px"><b>Justificativa do fornecedor:</b></p>
           <p style="white-space:pre-wrap;background:#f9fafb;border:1px solid #e5e7eb;padding:10px 12px;border-radius:6px;font-size:13px;margin:0">${escapeHtml(d.justificativa)}</p>`
        : ''
    }
    <p style="color:#9ca3af;font-size:12px;margin-top:20px">Mensagem automática do SGNC.</p>
  </div>`

  return { subject, text, html }
}

// ── Análise da recusa e envio definitivo ────────────────────────────

export type DadosEmailAnaliseRecusa = {
  numero: string
  fornecedorNome: string
  respondidaPor: string | null
  respondidaEm: Date
  justificativa: string | null
  token: string
  baseUrl?: string
}

/**
 * E-mail ao aprovador marcado quando o fornecedor recusa a RNC. Ele decide
 * entre acatar a recusa ou negá-la (tornando a RNC definitiva).
 */
export function montarEmailAnaliseRecusa(d: DadosEmailAnaliseRecusa) {
  const base = resolverBaseUrl(d.baseUrl)
  const link = `${base}/?analise=${encodeURIComponent(d.token)}`
  const subject = `RNC ${d.numero} — recusada pelo fornecedor: sua análise é necessária`

  const text = [
    `A RNC ${d.numero} foi RECUSADA/QUESTIONADA por ${d.fornecedorNome}.`,
    '',
    `Data da recusa: ${fmtDataHora(d.respondidaEm)}`,
    d.respondidaPor ? `Respondido por: ${d.respondidaPor}` : '',
    d.justificativa ? `\nJustificativa do fornecedor:\n${d.justificativa}` : '',
    '',
    'Como aprovador responsável, você deve analisar essa recusa:',
    '  • ACATAR A RECUSA — a justificativa do fornecedor é aceita;',
    '  • NEGAR A RECUSA — a RNC é mantida e enviada em definitivo ao',
    '    fornecedor, sem possibilidade de nova recusa.',
    '',
    `Registrar a sua análise: ${link}`,
    '',
    'O fornecedor pode recusar apenas uma vez.',
  ]
    .filter(Boolean)
    .join('\n')

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#111827">
    <h2 style="margin:0 0 4px">RNC ${escapeHtml(d.numero)} — recusada pelo fornecedor</h2>
    <p style="color:#6b7280;margin:0 0 16px;font-size:14px">
      <b>${escapeHtml(d.fornecedorNome)}</b> recusou/questionou esta não conformidade
      em ${escapeHtml(fmtDataHora(d.respondidaEm))}${d.respondidaPor ? ` · por ${escapeHtml(d.respondidaPor)}` : ''}.
    </p>
    ${
      d.justificativa
        ? `<p style="font-size:13px;color:#374151;margin:0 0 4px"><b>Justificativa do fornecedor:</b></p>
           <p style="white-space:pre-wrap;background:#fef2f2;border:1px solid #fecaca;padding:10px 12px;border-radius:6px;font-size:13px;margin:0 0 16px">${escapeHtml(d.justificativa)}</p>`
        : ''
    }
    <p style="font-size:13px;color:#374151;margin:0 0 6px">Como aprovador responsável, analise a recusa:</p>
    <ul style="font-size:13px;color:#374151;margin:0 0 16px;padding-left:18px">
      <li><b>Acatar a recusa</b> — a justificativa do fornecedor é aceita.</li>
      <li><b>Negar a recusa</b> — a RNC é mantida e enviada em <b>definitivo</b>
          ao fornecedor, sem possibilidade de nova recusa.</li>
    </ul>
    <p style="margin:0 0 16px">
      <a href="${link}" style="background:#111827;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;display:inline-block;font-size:14px">
        Registrar a minha análise
      </a>
    </p>
    <p style="color:#6b7280;font-size:12px;margin:0">O fornecedor pode recusar apenas uma vez.</p>
    <p style="color:#9ca3af;font-size:12px;margin-top:20px">Mensagem automática do SGNC.</p>
  </div>`

  return { subject, text, html }
}

export type DadosEmailDefinitiva = {
  numero: string
  fornecedorNome: string
  contatoNome: string | null
  justificativaAnalise: string | null
  token: string
  baseUrl?: string
}

/**
 * E-mail ao fornecedor quando a recusa é negada: a RNC passa a valer em
 * definitivo, sem possibilidade de nova recusa.
 */
export function montarEmailCienciaDefinitiva(d: DadosEmailDefinitiva) {
  const base = resolverBaseUrl(d.baseUrl)
  const linkPdf = `${base}/api/ciencia/${encodeURIComponent(d.token)}/pdf`
  const linkPagina = `${base}/?ciencia=${encodeURIComponent(d.token)}`
  const subject = `RNC ${d.numero} — decisão final: não conformidade mantida`

  const text = [
    `Prezado(a)${d.contatoNome ? ` ${d.contatoNome}` : ''},`,
    '',
    `A recusa apresentada para a RNC ${d.numero} foi analisada e NÃO foi acatada.`,
    'A não conformidade é mantida e esta comunicação é DEFINITIVA, não cabendo nova recusa.',
    '',
    d.justificativaAnalise
      ? `Parecer da análise:\n${d.justificativaAnalise}\n`
      : '',
    `Documento (PDF): ${linkPdf}`,
    `Consultar na plataforma: ${linkPagina}`,
  ]
    .filter(Boolean)
    .join('\n')

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#111827">
    <h2 style="margin:0 0 4px">RNC ${escapeHtml(d.numero)} — decisão final</h2>
    <p style="color:#6b7280;margin:0 0 16px;font-size:14px">
      Prezado(a)${d.contatoNome ? ` ${escapeHtml(d.contatoNome)}` : ''}, a recusa apresentada
      por <b>${escapeHtml(d.fornecedorNome)}</b> foi analisada.
    </p>
    <p style="background:#fef2f2;border:1px solid #fecaca;color:#991b1b;padding:12px 14px;border-radius:8px;font-size:14px;margin:0 0 14px">
      <b>A recusa não foi acatada.</b><br>
      <span style="color:#374151;font-size:13px">
        A não conformidade é mantida e esta comunicação é <b>definitiva</b>,
        não cabendo nova recusa.
      </span>
    </p>
    ${
      d.justificativaAnalise
        ? `<p style="font-size:13px;color:#374151;margin:0 0 4px"><b>Parecer da análise:</b></p>
           <p style="white-space:pre-wrap;background:#f9fafb;border:1px solid #e5e7eb;padding:10px 12px;border-radius:6px;font-size:13px;margin:0 0 16px">${escapeHtml(d.justificativaAnalise)}</p>`
        : ''
    }
    <p style="margin:0 0 16px">
      <a href="${linkPagina}" style="background:#111827;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;display:inline-block;font-size:14px">
        Consultar na plataforma
      </a>
      <a href="${linkPdf}" style="margin-left:8px;color:#374151;text-decoration:none;border:1px solid #d1d5db;padding:10px 18px;border-radius:8px;display:inline-block;font-size:14px">
        Ver documento (PDF)
      </a>
    </p>
    <p style="color:#9ca3af;font-size:12px;margin-top:20px">Mensagem automática do SGNC.</p>
  </div>`

  return { subject, text, html }
}
