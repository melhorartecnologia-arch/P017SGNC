import * as XLSX from 'xlsx'

export type XlsxColumn<T> = {
  header: string
  /** Função que extrai o valor da célula. Strings, números e booleanos são suportados. */
  value: (row: T) => string | number | boolean | null | undefined
  /** Largura sugerida em "characters" (aproximadamente). */
  width?: number
}

export function exportToXlsx<T>(opts: {
  filename: string
  sheetName?: string
  rows: T[]
  columns: XlsxColumn<T>[]
}) {
  const { filename, rows, columns } = opts
  const sheetName = (opts.sheetName ?? 'Dados').slice(0, 31)

  const aoa: (string | number | boolean | null)[][] = []
  aoa.push(columns.map((c) => c.header))
  for (const row of rows) {
    aoa.push(
      columns.map((c) => {
        const v = c.value(row)
        if (v === undefined || v === null) return ''
        return v
      }),
    )
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = columns.map((c) => ({ wch: c.width ?? Math.max(c.header.length + 2, 12) }))

  // Cabeçalho em negrito (XLSX 0.18 honra style somente em algumas builds; mantemos
  // como propriedade — sem efeito é aceitável).
  for (let i = 0; i < columns.length; i++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c: i })
    const cell = ws[addr]
    if (cell) cell.s = { font: { bold: true } }
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)

  const safeName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  XLSX.writeFile(wb, safeName)
}

/** Junta um array de objetos com `codigo` numa string separada por vírgula. */
export function joinCodigos(items: { codigo: string }[] | null | undefined): string {
  if (!items || items.length === 0) return ''
  return items.map((i) => i.codigo).join(', ')
}

/** Formata uma data ISO (vinda do backend) como dd/mm/aaaa hh:mm. */
export function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`
}

/** Lê o primeiro sheet do arquivo enviado e devolve as linhas como objetos. */
export async function readXlsxRows(
  file: File,
): Promise<Record<string, unknown>[]> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const firstSheetName = wb.SheetNames[0]
  if (!firstSheetName) return []
  const ws = wb.Sheets[firstSheetName]
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: '',
    raw: false,
  })
}

/** Gera um XLSX vazio com apenas o cabeçalho — usado como template de importação. */
export function downloadTemplate(opts: {
  filename: string
  sheetName?: string
  headers: string[]
}) {
  const ws = XLSX.utils.aoa_to_sheet([opts.headers])
  ws['!cols'] = opts.headers.map((h) => ({ wch: Math.max(h.length + 2, 14) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, (opts.sheetName ?? 'Modelo').slice(0, 31))
  const safe = opts.filename.endsWith('.xlsx')
    ? opts.filename
    : `${opts.filename}.xlsx`
  XLSX.writeFile(wb, safe)
}

/**
 * Itera todas as páginas de uma listagem da API, devolvendo a coleção
 * inteira (respeitando os filtros passados ao fetcher).
 */
export async function fetchAllPaged<T>(
  fetcher: (params: { page: number; pageSize: number }) => Promise<{
    items: T[]
    total: number
    page: number
    pageSize: number
  }>,
  opts: { pageSize?: number; maxPages?: number } = {},
): Promise<T[]> {
  const pageSize = opts.pageSize ?? 100
  const maxPages = opts.maxPages ?? 200
  const out: T[] = []
  for (let page = 1; page <= maxPages; page++) {
    const res = await fetcher({ page, pageSize })
    out.push(...res.items)
    if (res.items.length < pageSize) break
    if (out.length >= res.total) break
  }
  return out
}

/** Lê uma célula com tolerância: aceita variações de header (case-insensitive + trim). */
export function pick(row: Record<string, unknown>, header: string): string {
  const direct = row[header]
  if (direct !== undefined && direct !== null && direct !== '') return String(direct).trim()
  const norm = header.toLowerCase().trim()
  for (const k of Object.keys(row)) {
    if (k.toLowerCase().trim() === norm) {
      const v = row[k]
      if (v !== undefined && v !== null && v !== '') return String(v).trim()
    }
  }
  return ''
}

/** Converte texto de planilha em booleano de "Ativo". Default: true. */
export function parseAtivo(value: string): boolean {
  const v = value.toLowerCase().trim()
  if (!v) return true
  if (['ativo', 'ativa', 'sim', 'true', '1', 's', 'verdadeiro'].includes(v))
    return true
  if (['inativo', 'inativa', 'não', 'nao', 'false', '0', 'n', 'falso'].includes(v))
    return false
  return true
}
