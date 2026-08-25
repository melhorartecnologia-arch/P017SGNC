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
  /** RNC (padrão), RAQ, RVT ou RHE — muda os rótulos do e-mail. */
  docTipo?: 'RNC' | 'RAQ' | 'RVT' | 'RHE'
  /** Título do documento (RAQ/RHE) ou pauta (RVT). */
  titulo?: string | null
}

/** Rótulo do campo de título por tipo de documento. */
function rotuloTitulo(doc: string): string {
  return doc === 'RVT' ? 'Pauta' : 'Título'
}

function fmtData(d: Date): string {
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

/**
 * Prazo de ação é DATA PURA (gravada como meia-noite UTC). Formatar em
 * America/Sao_Paulo puxaria o dia para trás — aqui o dia é lido em UTC.
 */
function fmtDataPura(d: Date): string {
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
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
  // Rótulos por tipo de documento: "a RNC" / "o RAQ" / "o RVT".
  const doc = d.docTipo ?? 'RNC'
  const masculino = doc !== 'RNC'
  const oDoc = masculino ? `o ${doc}` : 'a RNC'
  const escalonadoDoc = masculino
    ? `Este ${doc} foi escalonado`
    : 'Esta RNC foi escalonada'
  const assinadoDoc = masculino ? 'assinado' : 'assinada'

  const subject =
    tipo === 'lembrete'
      ? `LEMBRETE — ${doc} ${d.numero}: prazo de assinatura expirando (${d.areaNome})`
      : tipo === 'escalonamento'
        ? `ESCALONAMENTO — ${doc} ${d.numero} aguardando sua assinatura (${d.areaNome})`
        : `${doc} ${d.numero} — solicitação de assinatura (${d.areaNome})`

  // Aviso conforme o tipo (lembrete/escalonamento).
  const aviso =
    tipo === 'lembrete'
      ? `ATENÇÃO: o prazo${d.prazoTexto ? ` de ${d.prazoTexto}` : ''} para assinatura está expirando. Caso não seja ${assinadoDoc} a tempo, ${oDoc} será ${masculino ? 'escalonado' : 'escalonada'} para o nível superior da sua área.`
      : tipo === 'escalonamento'
        ? `${escalonadoDoc} para você porque o prazo de assinatura do nível anterior expirou sem assinatura.`
        : ''

  const intro =
    tipo === 'solicitacao'
      ? `Você foi indicado(a) como aprovador da área "${d.areaNome}" para ${oDoc} abaixo e sua assinatura é necessária.`
      : `Sua assinatura da área "${d.areaNome}" para ${oDoc} abaixo ainda está pendente.`

  const linhas = [
    `Olá, ${d.aprovadorNome}.`,
    '',
    aviso ? aviso : '',
    aviso ? '' : '',
    intro,
    '',
    `${doc}: ${d.numero}`,
    d.titulo ? `${rotuloTitulo(doc)}: ${d.titulo}` : '',
    `Unidade: ${d.filialNome}`,
    `Fornecedor: ${d.fornecedorNome}`,
    d.tipoNc ? `Tipo de não conformidade: ${d.tipoNc}` : '',
    d.severidade ? `Severidade: ${d.severidade}` : '',
    `Data da ocorrência: ${fmtData(d.dataIdentificacao)}`,
    d.descricaoDefeito ? `Defeito: ${d.descricaoDefeito}` : '',
    '',
    `Senha de assinatura: ${d.senha}`,
    '(informe esta senha na plataforma para confirmar a assinatura)',
    '',
    `Acessar e assinar pela plataforma: ${linkAssinar}`,
    `Baixar ${oDoc} em PDF: ${linkPdf}`,
    '',
    'Mensagem automática do SGNC — Sistema de Gestão de Não Conformidade.',
  ].filter((l) => l !== '')

  const text = linhas.join('\n')

  const tituloHtml =
    tipo === 'lembrete'
      ? `Lembrete de assinatura — ${doc} ${escapeHtml(d.numero)}`
      : tipo === 'escalonamento'
        ? `Escalonamento — ${doc} ${escapeHtml(d.numero)}`
        : `Solicitação de assinatura — ${doc} ${escapeHtml(d.numero)}`

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
        [doc, d.numero],
        ...(d.titulo ? [[rotuloTitulo(doc), d.titulo]] : []),
        ['Unidade', d.filialNome],
        ['Fornecedor', d.fornecedorNome],
        ...(d.tipoNc ? [['Tipo de NC', d.tipoNc]] : []),
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
        Acessar e assinar ${oDoc.replace('o RAQ', 'o RAQ').replace('a RNC', 'a RNC')}
      </a>
    </p>
    <p style="font-size:13px"><a href="${linkPdf}" style="color:#2563eb">Baixar ${oDoc} em PDF</a></p>
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
  /** RNC (padrão), RAQ, RVT ou RHE — muda os rótulos do e-mail. */
  docTipo?: 'RNC' | 'RAQ' | 'RVT' | 'RHE'
  /** Título do documento (RAQ/RHE) ou pauta (RVT). */
  titulo?: string | null
  /**
   * Omite IP, navegador, dispositivo e geolocalização dos signatários.
   * Usar quando o e-mail vai também a destinatários externos (RHE: os
   * representantes do fornecedor assinam e recebem a conclusão) — a
   * evidência forense fica restrita ao registro interno.
   */
  ocultarForense?: boolean
}

export type DadosEmailEscalonado = {
  numero: string
  docTipo?: 'RNC' | 'RAQ' | 'RVT' | 'RHE'
  titulo?: string | null
  areaNome: string
  /** Nome do aprovador superado (destinatário). */
  nome: string
  /** Nível para o qual a aprovação subiu. */
  nivelNovo: number | null
}

/**
 * Aviso ao aprovador SUPERADO pelo escalonamento: o prazo da política de
 * resposta expirou sem a assinatura dele, a aprovação subiu de nível e o
 * link dele deixou de valer — ele não pode mais assinar.
 */
export function montarEmailEscalonadoAviso(d: DadosEmailEscalonado) {
  const doc = d.docTipo ?? 'RNC'
  const daDoc = doc === 'RNC' ? 'da RNC' : `do ${doc}`
  const nivelTxt = d.nivelNovo != null ? ` (nível ${d.nivelNovo})` : ''
  const subject = `${doc} ${d.numero} — aprovação escalonada ao nível superior`

  const text = [
    `Olá, ${d.nome},`,
    '',
    `O prazo da política de resposta para a assinatura ${daDoc} ${d.numero} expirou sem o seu registro, e a aprovação da área ${d.areaNome} foi escalonada ao nível superior${nivelTxt}.`,
    '',
    d.titulo ? `${rotuloTitulo(doc)}: ${d.titulo}` : '',
    'A partir de agora a assinatura desta área cabe ao nível escalonado — o seu link de assinatura deixou de valer e não é mais possível assinar este documento.',
    '',
    'Mensagem automática do SGNC — Sistema de Gestão de Não Conformidade.',
  ]
    .filter((l) => l !== '')
    .join('\n')

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#111827;max-width:640px;margin:0 auto">
    <h2 style="margin:0 0 4px">Aprovação escalonada — ${doc} ${escapeHtml(d.numero)}</h2>
    <p style="color:#6b7280;margin:0 0 12px">Sistema de Gestão de Não Conformidade</p>
    <p style="font-size:14px;margin:0 0 10px">Olá, <b>${escapeHtml(d.nome)}</b>,</p>
    <p style="font-size:14px;margin:0 0 10px">
      O prazo da política de resposta para a assinatura ${daDoc}
      <b>${escapeHtml(d.numero)}</b>${d.titulo ? ` (${escapeHtml(rotuloTitulo(doc))}: ${escapeHtml(d.titulo)})` : ''}
      expirou sem o seu registro, e a aprovação da área
      <b>${escapeHtml(d.areaNome)}</b> foi escalonada ao nível superior${escapeHtml(nivelTxt)}.
    </p>
    <div style="margin:0 0 14px;padding:10px 14px;border-radius:8px;background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:13px">
      A assinatura desta área agora cabe ao nível escalonado — o seu link de
      assinatura <b>deixou de valer</b> e não é mais possível assinar este documento.
    </div>
    <p style="color:#9ca3af;font-size:12px;margin-top:20px">Mensagem automática do SGNC.</p>
  </div>`

  return { subject, text, html }
}

/** E-mail de conclusão: todas as assinaturas do documento foram realizadas. */
export function montarEmailConclusao(d: DadosEmailConclusao) {
  const base = resolverBaseUrl(d.baseUrl)
  const doc = d.docTipo ?? 'RNC'
  const daDoc = doc === 'RNC' ? 'da RNC' : `do ${doc}`
  const subject = `${doc} ${d.numero} — assinaturas concluídas`

  const linhasResumo = d.assinaturas.map((a) => {
    const local =
      a.latitude != null && a.longitude != null
        ? `${a.latitude.toFixed(5)}, ${a.longitude.toFixed(5)}`
        : '—'
    return [
      `• ${a.areaNome}: ${a.nome}${a.cargo ? ` (${a.cargo})` : ''}`,
      `    Assinado em: ${fmtDataHora(a.assinadoEm)}`,
      ...(d.ocultarForense
        ? []
        : [
            `    IP: ${a.ip ?? '—'} · ${a.navegador ?? '—'}`,
            `    Dispositivo: ${[a.so, a.dispositivo].filter(Boolean).join(' · ') || '—'}`,
            `    Localização: ${local}`,
          ]),
    ].join('\n')
  })

  const text = [
    `As assinaturas ${daDoc} ${d.numero} foram concluídas.`,
    '',
    d.titulo ? `${rotuloTitulo(doc)}: ${d.titulo}` : '',
    `Unidade: ${d.filialNome}`,
    `Fornecedor: ${d.fornecedorNome}`,
    d.tipoNc ? `Tipo de não conformidade: ${d.tipoNc}` : '',
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
      const colsForense = d.ocultarForense
        ? ''
        : `
        <td style="padding:6px 8px;border:1px solid #e5e7eb">${escapeHtml(a.ip ?? '—')}<br><span style="color:#6b7280">${escapeHtml(a.navegador ?? '—')} · ${escapeHtml(disp)}</span></td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb">${local}</td>`
      return `<tr>
        <td style="padding:6px 8px;border:1px solid #e5e7eb">${escapeHtml(a.areaNome)}</td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb"><b>${escapeHtml(a.nome)}</b>${a.cargo ? `<br><span style="color:#6b7280">${escapeHtml(a.cargo)}</span>` : ''}</td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb">${escapeHtml(fmtDataHora(a.assinadoEm))}</td>${colsForense}
      </tr>`
    })
    .join('')

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#111827;max-width:680px;margin:0 auto">
    <h2 style="margin:0 0 4px">Assinaturas concluídas — ${doc} ${escapeHtml(d.numero)}</h2>
    <p style="color:#6b7280;margin:0 0 12px">Sistema de Gestão de Não Conformidade</p>
    <div style="margin:0 0 14px;padding:10px 14px;border-radius:8px;background:#f0fdf4;border:1px solid #86efac;color:#15803d;font-size:14px">
      Todas as assinaturas previstas para ${doc === 'RNC' ? 'esta RNC' : `este ${doc}`} foram realizadas.
    </div>
    <table style="border-collapse:collapse;width:100%;font-size:13px;margin:0 0 14px">
      ${[
        ...(d.titulo ? [[rotuloTitulo(doc), d.titulo]] : []),
        ['Unidade', d.filialNome],
        ['Fornecedor', d.fornecedorNome],
        ...(d.tipoNc ? [['Tipo de NC', d.tipoNc]] : []),
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
          <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:left">Assinado em</th>${
            d.ocultarForense
              ? ''
              : `
          <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:left">Origem</th>
          <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:left">Local</th>`
          }
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

// ── Ações de contingência do fornecedor ─────────────────────────────

export type DadosEmailContingencia = {
  numero: string
  fornecedorNome: string
  contatoNome: string | null
  tipoNc: string
  descricaoDefeito: string | null
  /** Como a não conformidade foi confirmada (aceite, decurso, definitiva). */
  confirmacao: string
  prazoEm: Date
  alertasPorDia: number
  token: string
  baseUrl?: string
}

/**
 * Pedido das ações de contingência ao fornecedor, aberto assim que a não
 * conformidade é confirmada. Vencido o prazo, o fornecedor passa a receber
 * alertas diários até enviar a devolutiva.
 */
export function montarEmailContingencia(d: DadosEmailContingencia) {
  const base = resolverBaseUrl(d.baseUrl)
  const linkPagina = `${base}/?ciencia=${encodeURIComponent(d.token)}`
  const linkPdf = `${base}/api/ciencia/${encodeURIComponent(d.token)}/pdf`
  const prazo = fmtDataHora(d.prazoEm)

  const subject = `RNC ${d.numero} — ações de contingência necessárias (prazo: ${prazo})`

  const text = [
    `Prezado(a)${d.contatoNome ? ` ${d.contatoNome}` : ''},`,
    '',
    `A não conformidade da RNC ${d.numero} foi confirmada (${d.confirmacao}).`,
    'É necessário cadastrar, uma a uma, as ações de contingência que serão executadas.',
    'Cada ação é analisada individualmente e pode ser aprovada ou recusada.',
    '',
    `Tipo de não conformidade: ${d.tipoNc}`,
    d.descricaoDefeito ? `Defeito: ${d.descricaoDefeito}` : '',
    '',
    `Registre as ações de contingência: ${linkPagina}`,
    `Documento completo (PDF): ${linkPdf}`,
    '',
    `Prazo para a devolutiva: ${prazo}.`,
    `Vencido o prazo, serão enviados ${d.alertasPorDia} alertas por dia até o envio das ações.`,
  ]
    .filter(Boolean)
    .join('\n')

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#111827">
    <h2 style="margin:0 0 4px">Ações de contingência — RNC ${escapeHtml(d.numero)}</h2>
    <p style="color:#6b7280;margin:0 0 16px;font-size:14px">
      Prezado(a)${d.contatoNome ? ` ${escapeHtml(d.contatoNome)}` : ''}, a não conformidade
      registrada para <b>${escapeHtml(d.fornecedorNome)}</b> foi confirmada
      (${escapeHtml(d.confirmacao)}). Cadastre, uma a uma, as ações que serão executadas —
      cada ação é analisada individualmente e pode ser aprovada ou recusada.
    </p>
    <table style="border-collapse:collapse;margin-bottom:18px">
      <tr><td style="padding:4px 10px 4px 0;color:#6b7280;font-size:13px">Tipo de não conformidade</td><td style="padding:4px 0;color:#111827;font-size:13px"><b>${escapeHtml(d.tipoNc)}</b></td></tr>
      ${
        d.descricaoDefeito
          ? `<tr><td style="padding:4px 10px 4px 0;color:#6b7280;font-size:13px">Defeito</td><td style="padding:4px 0;color:#111827;font-size:13px"><b>${escapeHtml(d.descricaoDefeito)}</b></td></tr>`
          : ''
      }
    </table>
    <p style="margin:0 0 18px">
      <a href="${linkPagina}" style="background:#111827;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;display:inline-block;font-size:14px">
        Registrar as ações de contingência
      </a>
      <a href="${linkPdf}" style="margin-left:8px;color:#374151;text-decoration:none;border:1px solid #d1d5db;padding:10px 18px;border-radius:8px;display:inline-block;font-size:14px">
        Ver documento (PDF)
      </a>
    </p>
    <p style="background:#fef3c7;border:1px solid #fde68a;color:#92400e;padding:10px 12px;border-radius:6px;font-size:13px;margin:0">
      A devolutiva deve ser registrada até <b>${escapeHtml(prazo)}</b>. Vencido o prazo,
      serão enviados <b>${d.alertasPorDia} alertas por dia</b> até o envio das ações.
    </p>
    <p style="color:#9ca3af;font-size:12px;margin-top:20px">Mensagem automática do SGNC.</p>
  </div>`

  return { subject, text, html }
}

export type DadosEmailAlertaContingencia = {
  numero: string
  fornecedorNome: string
  contatoNome: string | null
  prazoEm: Date
  /** Quantos alertas já foram enviados, contando este. */
  alerta: number
  /** true quando o plano foi devolvido para correção, não é o 1º envio. */
  ajuste: boolean
  token: string
  baseUrl?: string
}

/** Alerta recorrente enquanto as ações de contingência não chegam. */
export function montarEmailAlertaContingencia(d: DadosEmailAlertaContingencia) {
  const base = resolverBaseUrl(d.baseUrl)
  const linkPagina = `${base}/?ciencia=${encodeURIComponent(d.token)}`
  const prazo = fmtDataHora(d.prazoEm)

  const oQueFalta = d.ajuste
    ? 'a correção do plano de ações de contingência'
    : 'as ações de contingência'

  const subject = `URGENTE — RNC ${d.numero}: ${d.ajuste ? 'correção do plano de ações' : 'ações de contingência'} em atraso (alerta ${d.alerta})`

  const text = [
    `Prezado(a)${d.contatoNome ? ` ${d.contatoNome}` : ''},`,
    '',
    d.ajuste
      ? `O plano de ações da RNC ${d.numero} foi devolvido para correção e continua pendente.`
      : `As ações de contingência da RNC ${d.numero} continuam pendentes.`,
    `O prazo venceu em ${prazo}.`,
    '',
    `Registre ${oQueFalta} agora: ${linkPagina}`,
    '',
    'Este alerta será repetido enquanto a devolutiva não for registrada.',
  ].join('\n')

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#111827">
    <h2 style="margin:0 0 4px">${d.ajuste ? 'Correção do plano de ações' : 'Ações de contingência'} em atraso — RNC ${escapeHtml(d.numero)}</h2>
    <p style="color:#6b7280;margin:0 0 16px;font-size:14px">
      Prezado(a)${d.contatoNome ? ` ${escapeHtml(d.contatoNome)}` : ''},
      ${
        d.ajuste
          ? `o plano de ações de <b>${escapeHtml(d.fornecedorNome)}</b> foi devolvido para correção e continua pendente.`
          : `as ações de contingência de <b>${escapeHtml(d.fornecedorNome)}</b> continuam pendentes.`
      }
    </p>
    <p style="background:#fef2f2;border:1px solid #fecaca;color:#991b1b;padding:12px 14px;border-radius:8px;font-size:14px;margin:0 0 16px">
      <b>Prazo vencido em ${escapeHtml(prazo)}.</b><br>
      <span style="color:#374151;font-size:13px">Alerta ${d.alerta} — a cobrança se repete até o registro das ações.</span>
    </p>
    <p style="margin:0 0 16px">
      <a href="${linkPagina}" style="background:#b91c1c;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;display:inline-block;font-size:14px">
        ${d.ajuste ? 'Corrigir o plano de ações' : 'Registrar as ações de contingência'}
      </a>
    </p>
    <p style="color:#9ca3af;font-size:12px;margin-top:20px">Mensagem automática do SGNC.</p>
  </div>`

  return { subject, text, html }
}

export type AcaoDoPlano = {
  ordem: number
  descricao: string
  responsavel?: string | null
  prazo?: Date | null
  status?: string
  parecer?: string | null
}

/** Linhas da tabela de ações em texto puro, para o corpo alternativo. */
function acoesEmTexto(acoes: AcaoDoPlano[]): string {
  return acoes
    .map((a) => {
      const partes = [`${a.ordem}. ${a.descricao}`]
      if (a.responsavel) partes.push(`   Responsável: ${a.responsavel}`)
      if (a.prazo) partes.push(`   Prazo: ${fmtDataPura(a.prazo)}`)
      if (a.status && a.status !== 'PENDENTE') {
        partes.push(`   Situação: ${a.status === 'APROVADA' ? 'APROVADA' : 'RECUSADA'}`)
      }
      if (a.parecer) partes.push(`   Parecer: ${a.parecer}`)
      return partes.join('\n')
    })
    .join('\n\n')
}

/** Linhas da tabela de ações em HTML. */
function acoesEmHtml(acoes: AcaoDoPlano[], comSituacao: boolean): string {
  const cabecalho = `
    <tr style="background:#f9fafb">
      <th style="border:1px solid #e5e7eb;padding:6px 8px;text-align:left;font-size:12px;color:#6b7280">#</th>
      <th style="border:1px solid #e5e7eb;padding:6px 8px;text-align:left;font-size:12px;color:#6b7280">Ação</th>
      <th style="border:1px solid #e5e7eb;padding:6px 8px;text-align:left;font-size:12px;color:#6b7280">Responsável</th>
      <th style="border:1px solid #e5e7eb;padding:6px 8px;text-align:left;font-size:12px;color:#6b7280">Prazo</th>
      ${comSituacao ? '<th style="border:1px solid #e5e7eb;padding:6px 8px;text-align:left;font-size:12px;color:#6b7280">Situação</th>' : ''}
    </tr>`

  const linhas = acoes
    .map((a) => {
      const aprovada = a.status === 'APROVADA'
      const recusada = a.status === 'RECUSADA'
      const cor = aprovada ? '#15803d' : recusada ? '#b91c1c' : '#6b7280'
      const rotulo = aprovada ? 'Aprovada' : recusada ? 'Recusada' : 'Em análise'
      return `
      <tr>
        <td style="border:1px solid #e5e7eb;padding:6px 8px;font-size:13px;color:#6b7280">${a.ordem}</td>
        <td style="border:1px solid #e5e7eb;padding:6px 8px;font-size:13px;color:#111827">
          ${escapeHtml(a.descricao)}
          ${a.parecer ? `<br><span style="font-size:12px;color:${cor}"><b>Parecer:</b> ${escapeHtml(a.parecer)}</span>` : ''}
        </td>
        <td style="border:1px solid #e5e7eb;padding:6px 8px;font-size:13px;color:#111827">${escapeHtml(a.responsavel ?? '—')}</td>
        <td style="border:1px solid #e5e7eb;padding:6px 8px;font-size:13px;color:#111827">${a.prazo ? escapeHtml(fmtDataPura(a.prazo)) : '—'}</td>
        ${comSituacao ? `<td style="border:1px solid #e5e7eb;padding:6px 8px;font-size:13px;color:${cor}"><b>${rotulo}</b></td>` : ''}
      </tr>`
    })
    .join('')

  return `<table style="border-collapse:collapse;width:100%;margin:0 0 16px">${cabecalho}${linhas}</table>`
}

export type DadosEmailContingenciaRecebida = {
  numero: string
  rncId: string
  fornecedorNome: string
  respondidaPor: string | null
  respondidaEm: Date
  acoes: AcaoDoPlano[]
  emAtraso: boolean
  baseUrl?: string
}

/** Aviso interno com o plano de ações enviado pelo fornecedor. */
export function montarEmailContingenciaRecebida(
  d: DadosEmailContingenciaRecebida,
) {
  const base = resolverBaseUrl(d.baseUrl)
  const linkRnc = `${base}/?rnc=${encodeURIComponent(d.rncId)}`
  const subject = `RNC ${d.numero} — plano de ações de contingência para análise${d.emAtraso ? ' (entregue em atraso)' : ''}`

  const text = [
    `O fornecedor ${d.fornecedorNome} enviou o plano de ações de contingência da RNC ${d.numero}.`,
    '',
    `Data da devolutiva: ${fmtDataHora(d.respondidaEm)}${d.emAtraso ? ' (fora do prazo)' : ''}`,
    d.respondidaPor ? `Registrado por: ${d.respondidaPor}` : '',
    '',
    `Ações informadas (${d.acoes.length}):`,
    acoesEmTexto(d.acoes),
    '',
    'Cada ação precisa ser APROVADA ou RECUSADA na plataforma.',
    `Abrir a RNC: ${linkRnc}`,
  ]
    .filter(Boolean)
    .join('\n')

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:0 auto;color:#111827">
    <h2 style="margin:0 0 4px">RNC ${escapeHtml(d.numero)} — plano de ações de contingência</h2>
    <p style="color:#6b7280;margin:0 0 16px;font-size:14px">Fornecedor: <b>${escapeHtml(d.fornecedorNome)}</b></p>
    <p style="background:${d.emAtraso ? '#fffbeb' : '#f0fdf4'};border:1px solid ${d.emAtraso ? '#fde68a' : '#86efac'};color:${d.emAtraso ? '#92400e' : '#15803d'};padding:12px 14px;border-radius:8px;font-size:14px;margin:0 0 14px">
      <b>Plano recebido${d.emAtraso ? ' fora do prazo' : ' dentro do prazo'} — ${d.acoes.length} ação(ões) para analisar.</b><br>
      <span style="color:#374151;font-size:13px">Em ${escapeHtml(fmtDataHora(d.respondidaEm))}${d.respondidaPor ? ` · por ${escapeHtml(d.respondidaPor)}` : ''}</span>
    </p>
    ${acoesEmHtml(d.acoes, false)}
    <p style="margin:0 0 16px">
      <a href="${linkRnc}" style="background:#111827;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;display:inline-block;font-size:14px">
        Analisar as ações na plataforma
      </a>
    </p>
    <p style="font-size:13px;color:#374151;margin:0">
      Cada ação deve ser <b>aprovada</b> ou <b>recusada</b>. A recusa exige parecer e devolve
      o plano ao fornecedor para correção.
    </p>
    <p style="color:#9ca3af;font-size:12px;margin-top:20px">Mensagem automática do SGNC.</p>
  </div>`

  return { subject, text, html }
}

export type DadosEmailAnalisePlano = {
  numero: string
  fornecedorNome: string
  contatoNome: string | null
  aprovado: boolean
  acoes: AcaoDoPlano[]
  novoPrazoEm: Date | null
  token: string
  baseUrl?: string
}

/**
 * Resultado da análise do plano para o fornecedor: aprovado, ou devolvido
 * para correção com o parecer de cada ação recusada.
 */
export function montarEmailAnalisePlanoContingencia(d: DadosEmailAnalisePlano) {
  const base = resolverBaseUrl(d.baseUrl)
  const linkPagina = `${base}/?ciencia=${encodeURIComponent(d.token)}`
  const recusadas = d.acoes.filter((a) => a.status === 'RECUSADA')

  const subject = d.aprovado
    ? `RNC ${d.numero} — plano de ações de contingência aprovado`
    : `RNC ${d.numero} — ajuste necessário no plano de ações de contingência`

  const text = [
    `Prezado(a)${d.contatoNome ? ` ${d.contatoNome}` : ''},`,
    '',
    d.aprovado
      ? `O plano de ações de contingência da RNC ${d.numero} foi APROVADO integralmente.`
      : `O plano de ações de contingência da RNC ${d.numero} foi analisado e ${recusadas.length} ação(ões) NÃO foram aprovadas.`,
    '',
    'Situação de cada ação:',
    acoesEmTexto(d.acoes),
    '',
    d.aprovado
      ? 'Nenhuma providência adicional é necessária nesta etapa.'
      : `Corrija os pontos indicados e reenvie o plano até ${d.novoPrazoEm ? fmtDataHora(d.novoPrazoEm) : 'o novo prazo informado na plataforma'}.`,
    '',
    `Acessar: ${linkPagina}`,
  ]
    .filter(Boolean)
    .join('\n')

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:0 auto;color:#111827">
    <h2 style="margin:0 0 4px">RNC ${escapeHtml(d.numero)} — análise do plano de ações</h2>
    <p style="color:#6b7280;margin:0 0 16px;font-size:14px">
      Prezado(a)${d.contatoNome ? ` ${escapeHtml(d.contatoNome)}` : ''}, o plano enviado por
      <b>${escapeHtml(d.fornecedorNome)}</b> foi analisado.
    </p>
    <p style="background:${d.aprovado ? '#f0fdf4' : '#fef2f2'};border:1px solid ${d.aprovado ? '#86efac' : '#fecaca'};color:${d.aprovado ? '#15803d' : '#991b1b'};padding:12px 14px;border-radius:8px;font-size:14px;margin:0 0 14px">
      <b>${d.aprovado ? 'Plano aprovado integralmente.' : `${recusadas.length} ação(ões) não foram aprovadas.`}</b>
      ${
        d.aprovado
          ? ''
          : `<br><span style="color:#374151;font-size:13px">Corrija os pontos indicados e reenvie o plano${d.novoPrazoEm ? ` até <b>${escapeHtml(fmtDataHora(d.novoPrazoEm))}</b>` : ''}.</span>`
      }
    </p>
    ${acoesEmHtml(d.acoes, true)}
    <p style="margin:0 0 16px">
      <a href="${linkPagina}" style="background:${d.aprovado ? '#111827' : '#b91c1c'};color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;display:inline-block;font-size:14px">
        ${d.aprovado ? 'Consultar na plataforma' : 'Corrigir o plano de ações'}
      </a>
    </p>
    <p style="color:#9ca3af;font-size:12px;margin-top:20px">Mensagem automática do SGNC.</p>
  </div>`

  return { subject, text, html }
}

// ── Análise de causa: Ishikawa + 5W2H ───────────────────────────────

export const ISHIKAWA_LABEL: Record<string, string> = {
  METODO: 'Método',
  MAQUINA: 'Máquina',
  MAO_DE_OBRA: 'Mão de obra',
  MATERIAL: 'Material',
  MEDICAO: 'Medição',
  MEIO_AMBIENTE: 'Meio ambiente',
}

export const CINCO_W_DOIS_H_LABEL: [string, string][] = [
  ['oQue', 'O quê'],
  ['porQue', 'Por quê'],
  ['onde', 'Onde'],
  ['quando', 'Quando'],
  ['quem', 'Quem'],
  ['como', 'Como'],
  ['quantoCusta', 'Quanto custa'],
]

export type CausaIshikawa = { categoria: string; descricao: string }
export type Cinco2H = Record<string, string | null>

function ishikawaEmTexto(causas: CausaIshikawa[]): string {
  const porCategoria = new Map<string, string[]>()
  for (const c of causas) {
    const lista = porCategoria.get(c.categoria) ?? []
    lista.push(c.descricao)
    porCategoria.set(c.categoria, lista)
  }
  return [...porCategoria.entries()]
    .map(
      ([cat, itens]) =>
        `${ISHIKAWA_LABEL[cat] ?? cat}:\n${itens.map((i) => `  - ${i}`).join('\n')}`,
    )
    .join('\n\n')
}

function ishikawaEmHtml(causas: CausaIshikawa[]): string {
  const porCategoria = new Map<string, string[]>()
  for (const c of causas) {
    const lista = porCategoria.get(c.categoria) ?? []
    lista.push(c.descricao)
    porCategoria.set(c.categoria, lista)
  }
  const blocos = [...porCategoria.entries()]
    .map(
      ([cat, itens]) => `
      <tr>
        <td style="border:1px solid #e5e7eb;padding:6px 8px;font-size:13px;color:#6b7280;vertical-align:top;white-space:nowrap"><b>${escapeHtml(ISHIKAWA_LABEL[cat] ?? cat)}</b></td>
        <td style="border:1px solid #e5e7eb;padding:6px 8px;font-size:13px;color:#111827">
          ${itens.map((i) => `• ${escapeHtml(i)}`).join('<br>')}
        </td>
      </tr>`,
    )
    .join('')
  return `<table style="border-collapse:collapse;width:100%;margin:0 0 16px">${blocos}</table>`
}

function cinco2hEmTexto(d: Cinco2H): string {
  return CINCO_W_DOIS_H_LABEL.map(
    ([chave, rotulo]) => `${rotulo}: ${d[chave] ?? '—'}`,
  ).join('\n')
}

function cinco2hEmHtml(d: Cinco2H): string {
  const linhas = CINCO_W_DOIS_H_LABEL.map(
    ([chave, rotulo]) => `
      <tr>
        <td style="border:1px solid #e5e7eb;padding:6px 8px;font-size:13px;color:#6b7280;vertical-align:top;white-space:nowrap"><b>${escapeHtml(rotulo)}</b></td>
        <td style="border:1px solid #e5e7eb;padding:6px 8px;font-size:13px;color:#111827">${escapeHtml(d[chave] ?? '—')}</td>
      </tr>`,
  ).join('')
  return `<table style="border-collapse:collapse;width:100%;margin:0 0 16px">${linhas}</table>`
}

export type DadosEmailCausaRaizSolicitada = {
  numero: string
  fornecedorNome: string
  contatoNome: string | null
  token: string
  baseUrl?: string
}

/** Pede ao fornecedor a análise de causa, aberta com o envio das ações. */
export function montarEmailCausaRaizSolicitada(
  d: DadosEmailCausaRaizSolicitada,
) {
  const base = resolverBaseUrl(d.baseUrl)
  const linkPagina = `${base}/?ciencia=${encodeURIComponent(d.token)}`
  const subject = `RNC ${d.numero} — análise de causa necessária (Ishikawa e 5W2H)`

  const text = [
    `Prezado(a)${d.contatoNome ? ` ${d.contatoNome}` : ''},`,
    '',
    `As ações de contingência da RNC ${d.numero} foram recebidas.`,
    'A próxima etapa é a análise de causa, preenchida na própria plataforma:',
    '',
    '  • Diagrama de Ishikawa — as causas prováveis em cada uma das seis categorias',
    '    (Método, Máquina, Mão de obra, Material, Medição e Meio ambiente);',
    '  • 5W2H — O quê, Por quê, Onde, Quando, Quem, Como e Quanto custa.',
    '',
    'Com os dois preenchidos, envie para aprovação pela própria página.',
    '',
    `Preencher agora: ${linkPagina}`,
  ].join('\n')

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:0 auto;color:#111827">
    <h2 style="margin:0 0 4px">Análise de causa — RNC ${escapeHtml(d.numero)}</h2>
    <p style="color:#6b7280;margin:0 0 16px;font-size:14px">
      Prezado(a)${d.contatoNome ? ` ${escapeHtml(d.contatoNome)}` : ''}, as ações de contingência
      de <b>${escapeHtml(d.fornecedorNome)}</b> foram recebidas. A próxima etapa é a análise de causa.
    </p>
    <p style="font-size:13px;color:#374151;margin:0 0 6px">Preencha na plataforma:</p>
    <ul style="font-size:13px;color:#374151;margin:0 0 16px;padding-left:18px">
      <li><b>Diagrama de Ishikawa</b> — causas prováveis em Método, Máquina, Mão de obra, Material, Medição e Meio ambiente.</li>
      <li><b>5W2H</b> — O quê, Por quê, Onde, Quando, Quem, Como e Quanto custa.</li>
    </ul>
    <p style="margin:0 0 16px">
      <a href="${linkPagina}" style="background:#111827;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;display:inline-block;font-size:14px">
        Preencher a análise de causa
      </a>
    </p>
    <p style="font-size:13px;color:#374151;margin:0">
      Com os dois itens completos, envie para aprovação pela própria página.
    </p>
    <p style="color:#9ca3af;font-size:12px;margin-top:20px">Mensagem automática do SGNC.</p>
  </div>`

  return { subject, text, html }
}

export type DadosEmailCausaRaizEnviada = {
  numero: string
  rncId: string
  fornecedorNome: string
  enviadaPor: string | null
  enviadaEm: Date
  envio: number
  causas: CausaIshikawa[]
  cinco2h: Cinco2H
  baseUrl?: string
}

/** Aviso ao aprovador marcado de que a análise de causa chegou. */
export function montarEmailCausaRaizEnviada(d: DadosEmailCausaRaizEnviada) {
  const base = resolverBaseUrl(d.baseUrl)
  const linkRnc = `${base}/?rnc=${encodeURIComponent(d.rncId)}`
  const subject = `RNC ${d.numero} — análise de causa para aprovação (Ishikawa e 5W2H)`

  const text = [
    `O fornecedor ${d.fornecedorNome} enviou a análise de causa da RNC ${d.numero}${d.envio > 1 ? ` (reenvio nº ${d.envio})` : ''}.`,
    '',
    `Data do envio: ${fmtDataHora(d.enviadaEm)}`,
    d.enviadaPor ? `Registrado por: ${d.enviadaPor}` : '',
    '',
    'DIAGRAMA DE ISHIKAWA',
    ishikawaEmTexto(d.causas),
    '',
    '5W2H',
    cinco2hEmTexto(d.cinco2h),
    '',
    'A análise precisa ser APROVADA ou REJEITADA na plataforma.',
    `Abrir a RNC: ${linkRnc}`,
  ]
    .filter(Boolean)
    .join('\n')

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:0 auto;color:#111827">
    <h2 style="margin:0 0 4px">RNC ${escapeHtml(d.numero)} — análise de causa</h2>
    <p style="color:#6b7280;margin:0 0 16px;font-size:14px">Fornecedor: <b>${escapeHtml(d.fornecedorNome)}</b></p>
    <p style="background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;padding:12px 14px;border-radius:8px;font-size:14px;margin:0 0 16px">
      <b>Análise recebida para aprovação${d.envio > 1 ? ` — reenvio nº ${d.envio}` : ''}.</b><br>
      <span style="color:#374151;font-size:13px">Em ${escapeHtml(fmtDataHora(d.enviadaEm))}${d.enviadaPor ? ` · por ${escapeHtml(d.enviadaPor)}` : ''}</span>
    </p>
    <p style="font-size:13px;color:#374151;margin:0 0 4px"><b>Diagrama de Ishikawa</b></p>
    ${ishikawaEmHtml(d.causas)}
    <p style="font-size:13px;color:#374151;margin:0 0 4px"><b>5W2H</b></p>
    ${cinco2hEmHtml(d.cinco2h)}
    <p style="margin:0 0 16px">
      <a href="${linkRnc}" style="background:#111827;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;display:inline-block;font-size:14px">
        Analisar na plataforma
      </a>
    </p>
    <p style="font-size:13px;color:#374151;margin:0">
      A rejeição exige parecer e devolve a análise ao fornecedor para alteração.
    </p>
    <p style="color:#9ca3af;font-size:12px;margin-top:20px">Mensagem automática do SGNC.</p>
  </div>`

  return { subject, text, html }
}

export type DadosEmailCausaRaizAnalisada = {
  numero: string
  fornecedorNome: string
  contatoNome: string | null
  aprovada: boolean
  parecer: string | null
  token: string
  baseUrl?: string
}

/** Resultado da análise de causa para o fornecedor. */
export function montarEmailCausaRaizAnalisada(
  d: DadosEmailCausaRaizAnalisada,
) {
  const base = resolverBaseUrl(d.baseUrl)
  const linkPagina = `${base}/?ciencia=${encodeURIComponent(d.token)}`
  const subject = d.aprovada
    ? `RNC ${d.numero} — análise de causa aprovada`
    : `RNC ${d.numero} — análise de causa rejeitada: ajuste necessário`

  const text = [
    `Prezado(a)${d.contatoNome ? ` ${d.contatoNome}` : ''},`,
    '',
    d.aprovada
      ? `A análise de causa da RNC ${d.numero} (Ishikawa e 5W2H) foi APROVADA.`
      : `A análise de causa da RNC ${d.numero} (Ishikawa e 5W2H) foi REJEITADA.`,
    '',
    d.parecer ? `Parecer do aprovador:\n${d.parecer}` : '',
    '',
    d.aprovada
      ? 'Nenhuma providência adicional é necessária nesta etapa.'
      : 'Altere o que foi preenchido na plataforma e envie novamente para aprovação.',
    '',
    `Acessar: ${linkPagina}`,
  ]
    .filter(Boolean)
    .join('\n')

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:0 auto;color:#111827">
    <h2 style="margin:0 0 4px">RNC ${escapeHtml(d.numero)} — análise de causa</h2>
    <p style="color:#6b7280;margin:0 0 16px;font-size:14px">
      Prezado(a)${d.contatoNome ? ` ${escapeHtml(d.contatoNome)}` : ''}, a análise enviada por
      <b>${escapeHtml(d.fornecedorNome)}</b> foi avaliada.
    </p>
    <p style="background:${d.aprovada ? '#f0fdf4' : '#fef2f2'};border:1px solid ${d.aprovada ? '#86efac' : '#fecaca'};color:${d.aprovada ? '#15803d' : '#991b1b'};padding:12px 14px;border-radius:8px;font-size:14px;margin:0 0 14px">
      <b>${d.aprovada ? 'Análise de causa aprovada.' : 'Análise de causa rejeitada.'}</b>
      ${d.aprovada ? '' : '<br><span style="color:#374151;font-size:13px">Altere o que foi preenchido e envie novamente para aprovação.</span>'}
    </p>
    ${
      d.parecer
        ? `<p style="font-size:13px;color:#374151;margin:0 0 4px"><b>Parecer do aprovador:</b></p>
           <p style="white-space:pre-wrap;background:#f9fafb;border:1px solid #e5e7eb;padding:10px 12px;border-radius:6px;font-size:13px;margin:0 0 16px">${escapeHtml(d.parecer)}</p>`
        : ''
    }
    <p style="margin:0 0 16px">
      <a href="${linkPagina}" style="background:${d.aprovada ? '#111827' : '#b91c1c'};color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;display:inline-block;font-size:14px">
        ${d.aprovada ? 'Consultar na plataforma' : 'Alterar a análise de causa'}
      </a>
    </p>
    <p style="color:#9ca3af;font-size:12px;margin-top:20px">Mensagem automática do SGNC.</p>
  </div>`

  return { subject, text, html }
}

// ── Verificação de eficácia ─────────────────────────────────────────

export type DadosEmailEficaciaLiberada = {
  numero: string
  rncId: string
  fornecedorNome: string
  dataBase: Date | null
  liberadaEm: Date
  baseUrl?: string
}

/** Avisa o aprovador marcado que a verificação de eficácia já pode ser feita. */
export function montarEmailEficaciaLiberada(d: DadosEmailEficaciaLiberada) {
  const base = resolverBaseUrl(d.baseUrl)
  const linkRnc = `${base}/?rnc=${encodeURIComponent(d.rncId)}`
  const subject = `RNC ${d.numero} — verificação de eficácia liberada`

  const text = [
    `O plano de ação da RNC ${d.numero} (${d.fornecedorNome}) já cumpriu o tempo de espera.`,
    '',
    d.dataBase
      ? `Última data planejada do plano: ${fmtData(d.dataBase)}`
      : '',
    `Verificação liberada em: ${fmtDataHora(d.liberadaEm)}`,
    '',
    'Registre na plataforma se as ações foram EFICAZES ou NÃO EFICAZES.',
    `Abrir a RNC: ${linkRnc}`,
  ]
    .filter(Boolean)
    .join('\n')

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:0 auto;color:#111827">
    <h2 style="margin:0 0 4px">RNC ${escapeHtml(d.numero)} — verificação de eficácia</h2>
    <p style="color:#6b7280;margin:0 0 16px;font-size:14px">Fornecedor: <b>${escapeHtml(d.fornecedorNome)}</b></p>
    <p style="background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;padding:12px 14px;border-radius:8px;font-size:14px;margin:0 0 16px">
      <b>O plano de ação já cumpriu o tempo de espera e pode ser verificado.</b><br>
      <span style="color:#374151;font-size:13px">
        ${d.dataBase ? `Última data planejada: ${escapeHtml(fmtData(d.dataBase))} · ` : ''}
        Liberada em ${escapeHtml(fmtDataHora(d.liberadaEm))}
      </span>
    </p>
    <p style="margin:0 0 16px">
      <a href="${linkRnc}" style="background:#111827;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;display:inline-block;font-size:14px">
        Registrar a verificação de eficácia
      </a>
    </p>
    <p style="font-size:13px;color:#374151;margin:0">
      Registre se as ações foram <b>eficazes</b> ou <b>não eficazes</b>. O resultado
      "não eficaz" exige parecer.
    </p>
    <p style="color:#9ca3af;font-size:12px;margin-top:20px">Mensagem automática do SGNC.</p>
  </div>`

  return { subject, text, html }
}

export type DadosEmailEficaciaVerificada = {
  numero: string
  fornecedorNome: string
  contatoNome: string | null
  eficaz: boolean
  parecer: string | null
  token: string
  baseUrl?: string
}

/** Resultado da verificação de eficácia para o fornecedor. */
export function montarEmailEficaciaVerificada(
  d: DadosEmailEficaciaVerificada,
) {
  const base = resolverBaseUrl(d.baseUrl)
  const linkPagina = `${base}/?ciencia=${encodeURIComponent(d.token)}`
  const subject = d.eficaz
    ? `RNC ${d.numero} — plano de ação verificado como eficaz`
    : `RNC ${d.numero} — plano de ação verificado como NÃO eficaz`

  const text = [
    `Prezado(a)${d.contatoNome ? ` ${d.contatoNome}` : ''},`,
    '',
    d.eficaz
      ? `A verificação de eficácia da RNC ${d.numero} concluiu que as ações foram EFICAZES.`
      : `A verificação de eficácia da RNC ${d.numero} concluiu que as ações NÃO foram eficazes.`,
    '',
    d.parecer ? `Parecer da verificação:\n${d.parecer}` : '',
    '',
    `Acessar: ${linkPagina}`,
  ]
    .filter(Boolean)
    .join('\n')

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:0 auto;color:#111827">
    <h2 style="margin:0 0 4px">RNC ${escapeHtml(d.numero)} — verificação de eficácia</h2>
    <p style="color:#6b7280;margin:0 0 16px;font-size:14px">
      Prezado(a)${d.contatoNome ? ` ${escapeHtml(d.contatoNome)}` : ''}, o plano de ação de
      <b>${escapeHtml(d.fornecedorNome)}</b> foi verificado.
    </p>
    <p style="background:${d.eficaz ? '#f0fdf4' : '#fef2f2'};border:1px solid ${d.eficaz ? '#86efac' : '#fecaca'};color:${d.eficaz ? '#15803d' : '#991b1b'};padding:12px 14px;border-radius:8px;font-size:14px;margin:0 0 14px">
      <b>${d.eficaz ? 'Ações verificadas como eficazes.' : 'Ações verificadas como NÃO eficazes.'}</b>
    </p>
    ${
      d.parecer
        ? `<p style="font-size:13px;color:#374151;margin:0 0 4px"><b>Parecer da verificação:</b></p>
           <p style="white-space:pre-wrap;background:#f9fafb;border:1px solid #e5e7eb;padding:10px 12px;border-radius:6px;font-size:13px;margin:0 0 16px">${escapeHtml(d.parecer)}</p>`
        : ''
    }
    <p style="margin:0 0 16px">
      <a href="${linkPagina}" style="background:#111827;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;display:inline-block;font-size:14px">
        Consultar na plataforma
      </a>
    </p>
    <p style="color:#9ca3af;font-size:12px;margin-top:20px">Mensagem automática do SGNC.</p>
  </div>`

  return { subject, text, html }
}

// ── RAQ: envio do documento assinado ao fornecedor ─────────────────

export type DadosEmailRaqFornecedor = {
  numero: string
  titulo: string | null
  filialNome: string
  fornecedorNome: string
  contatoNome: string | null
  severidade: string | null
  dataIdentificacao: Date
  descricaoDefeito: string | null
}

/**
 * Alerta de qualidade assinado, enviado ao contato do fornecedor com o
 * PDF anexo. É a etapa final do RAQ: comunicação, sem resposta esperada.
 */
export function montarEmailRaqFornecedor(d: DadosEmailRaqFornecedor) {
  const subject = `Alerta de Qualidade ${d.numero}${d.titulo ? ` — ${d.titulo}` : ''}`

  const text = [
    `Prezado(a)${d.contatoNome ? ` ${d.contatoNome}` : ''},`,
    '',
    `Segue em anexo o Relatório de Alerta de Qualidade ${d.numero}, emitido por ${d.filialNome} e assinado pelos responsáveis.`,
    '',
    d.titulo ? `Título: ${d.titulo}` : '',
    d.severidade ? `Severidade: ${d.severidade}` : '',
    `Data da ocorrência: ${fmtData(d.dataIdentificacao)}`,
    d.descricaoDefeito ? `Ocorrência: ${d.descricaoDefeito}` : '',
    '',
    'Este comunicado é um alerta de qualidade: analise o conteúdo do documento e adote as providências internas cabíveis.',
  ]
    .filter(Boolean)
    .join('\n')

  const item = (k: string, v: string) =>
    v
      ? `<tr><td style="padding:4px 10px 4px 0;color:#6b7280;font-size:13px">${escapeHtml(k)}</td><td style="padding:4px 0;color:#111827;font-size:13px"><b>${escapeHtml(v)}</b></td></tr>`
      : ''

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#111827">
    <h2 style="margin:0 0 4px">Alerta de Qualidade — RAQ ${escapeHtml(d.numero)}</h2>
    <p style="color:#6b7280;margin:0 0 16px;font-size:14px">
      Prezado(a)${d.contatoNome ? ` ${escapeHtml(d.contatoNome)}` : ''}, segue em anexo o
      Relatório de Alerta de Qualidade emitido por <b>${escapeHtml(d.filialNome)}</b> para
      <b>${escapeHtml(d.fornecedorNome)}</b>, já assinado pelos responsáveis.
    </p>
    <table style="border-collapse:collapse;margin-bottom:18px">
      ${item('Título', d.titulo ?? '')}
      ${item('Severidade', d.severidade ?? '')}
      ${item('Data da ocorrência', fmtData(d.dataIdentificacao))}
      ${item('Ocorrência', d.descricaoDefeito ?? '')}
    </table>
    <p style="background:#fef3c7;border:1px solid #fde68a;color:#92400e;padding:10px 12px;border-radius:6px;font-size:13px;margin:0">
      Este comunicado é um <b>alerta de qualidade</b>: analise o documento em anexo e adote
      as providências internas cabíveis.
    </p>
    <p style="color:#9ca3af;font-size:12px;margin-top:20px">Mensagem automática do SGNC.</p>
  </div>`

  return { subject, text, html }
}

// ── RVT: envio do documento assinado ao fornecedor ─────────────────

export type DadosEmailRvtFornecedor = {
  numero: string
  pauta: string | null
  filialNome: string
  fornecedorNome: string
  contatoNome: string | null
  dataVisita: Date
  conclusao: string | null
}

/**
 * Relatório de visita técnica assinado, enviado ao contato do fornecedor
 * com o PDF anexo. Etapa final do RVT: registro, sem resposta esperada.
 */
export function montarEmailRvtFornecedor(d: DadosEmailRvtFornecedor) {
  const subject = `Relatório de Visita Técnica ${d.numero}${d.pauta ? ` — ${d.pauta}` : ''}`

  const text = [
    `Prezado(a)${d.contatoNome ? ` ${d.contatoNome}` : ''},`,
    '',
    `Segue em anexo o Relatório de Visita Técnica ${d.numero}, referente à visita realizada em ${fmtData(d.dataVisita)} envolvendo ${d.fornecedorNome}, já assinado pelos responsáveis de ${d.filialNome}.`,
    '',
    d.pauta ? `Pauta: ${d.pauta}` : '',
    d.conclusao ? `Conclusão: ${d.conclusao}` : '',
    '',
    'Este documento é o registro formal da visita técnica e das tratativas acordadas.',
  ]
    .filter(Boolean)
    .join('\n')

  const item = (k: string, v: string) =>
    v
      ? `<tr><td style="padding:4px 10px 4px 0;color:#6b7280;font-size:13px">${escapeHtml(k)}</td><td style="padding:4px 0;color:#111827;font-size:13px"><b>${escapeHtml(v)}</b></td></tr>`
      : ''

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#111827">
    <h2 style="margin:0 0 4px">Relatório de Visita Técnica — RVT ${escapeHtml(d.numero)}</h2>
    <p style="color:#6b7280;margin:0 0 16px;font-size:14px">
      Prezado(a)${d.contatoNome ? ` ${escapeHtml(d.contatoNome)}` : ''}, segue em anexo o
      relatório da visita técnica realizada em <b>${escapeHtml(fmtData(d.dataVisita))}</b>
      envolvendo <b>${escapeHtml(d.fornecedorNome)}</b>, já assinado pelos responsáveis de
      <b>${escapeHtml(d.filialNome)}</b>.
    </p>
    <table style="border-collapse:collapse;margin-bottom:18px">
      ${item('Pauta', d.pauta ?? '')}
      ${item('Conclusão', d.conclusao ?? '')}
    </table>
    <p style="background:#f0f9ff;border:1px solid #bae6fd;color:#075985;padding:10px 12px;border-radius:6px;font-size:13px;margin:0">
      Este documento é o <b>registro formal</b> da visita técnica e das tratativas acordadas.
    </p>
    <p style="color:#9ca3af;font-size:12px;margin-top:20px">Mensagem automática do SGNC.</p>
  </div>`

  return { subject, text, html }
}

// ── RHE: envio do documento assinado ao fornecedor ─────────────────

/** Rótulo em português do resultado da homologação. */
export function rotuloHomologacao(r: string | null | undefined): string {
  if (r === 'APROVADO') return 'APROVADO'
  if (r === 'REPROVADO') return 'REPROVADO'
  if (r === 'APROVADO_COM_RESTRICAO') return 'APROVADO COM RESTRIÇÃO'
  return '—'
}

export type DadosEmailRheFornecedor = {
  numero: string
  titulo: string | null
  filialNome: string
  fornecedorNome: string
  contatoNome: string | null
  homologacaoInicial: string | null
  homologacaoInicialData: Date | null
}

/**
 * Relatório de homologação assinado (inclusive pelo representante
 * técnico do fornecedor), enviado com o PDF anexo. Etapa final do RHE.
 */
export function montarEmailRheFornecedor(d: DadosEmailRheFornecedor) {
  const subject = `Relatório de Homologação ${d.numero}${d.titulo ? ` — ${d.titulo}` : ''}`

  const text = [
    `Prezado(a)${d.contatoNome ? ` ${d.contatoNome}` : ''},`,
    '',
    `Segue em anexo o Relatório de Homologação de Embalagem ${d.numero}, emitido por ${d.filialNome} e assinado por todos os responsáveis — incluindo o representante técnico de ${d.fornecedorNome}.`,
    '',
    d.titulo ? `Título: ${d.titulo}` : '',
    d.homologacaoInicial
      ? `Homologação inicial: ${rotuloHomologacao(d.homologacaoInicial)}${d.homologacaoInicialData ? ` em ${fmtDataPura(d.homologacaoInicialData)}` : ''}`
      : '',
    '',
    'Este documento é o registro formal da homologação realizada.',
  ]
    .filter(Boolean)
    .join('\n')

  const item = (k: string, v: string) =>
    v
      ? `<tr><td style="padding:4px 10px 4px 0;color:#6b7280;font-size:13px">${escapeHtml(k)}</td><td style="padding:4px 0;color:#111827;font-size:13px"><b>${escapeHtml(v)}</b></td></tr>`
      : ''

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#111827">
    <h2 style="margin:0 0 4px">Relatório de Homologação — RHE ${escapeHtml(d.numero)}</h2>
    <p style="color:#6b7280;margin:0 0 16px;font-size:14px">
      Prezado(a)${d.contatoNome ? ` ${escapeHtml(d.contatoNome)}` : ''}, segue em anexo o
      relatório de homologação emitido por <b>${escapeHtml(d.filialNome)}</b> e assinado por
      todos os responsáveis — incluindo o representante técnico de
      <b>${escapeHtml(d.fornecedorNome)}</b>.
    </p>
    <table style="border-collapse:collapse;margin-bottom:18px">
      ${item('Título', d.titulo ?? '')}
      ${item(
        'Homologação inicial',
        d.homologacaoInicial
          ? `${rotuloHomologacao(d.homologacaoInicial)}${d.homologacaoInicialData ? ` em ${fmtDataPura(d.homologacaoInicialData)}` : ''}`
          : '',
      )}
    </table>
    <p style="background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;padding:10px 12px;border-radius:6px;font-size:13px;margin:0">
      Este documento é o <b>registro formal</b> da homologação realizada.
    </p>
    <p style="color:#9ca3af;font-size:12px;margin-top:20px">Mensagem automática do SGNC.</p>
  </div>`

  return { subject, text, html }
}
