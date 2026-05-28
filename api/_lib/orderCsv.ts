import { mkdir, readFile, appendFile } from 'node:fs/promises'
import path from 'node:path'

const HEADER =
  'receivedAt,orderId,email,fullName,phone,line1,line2,city,state,pincode,payment,items,total\n'

function csvCell(value: string): string {
  const s = String(value ?? '').replace(/\r\n/g, '\n')
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export type OrderCsvPayload = {
  receivedAt: string
  orderId: string
  email: string
  fullName: string
  phone: string
  line1: string
  line2: string
  city: string
  state: string
  pincode: string
  payment: string
  itemsSummary: string
  total: number
}

export async function appendOrderCsvRow(filePath: string, row: OrderCsvPayload): Promise<void> {
  const dir = path.dirname(filePath)
  await mkdir(dir, { recursive: true })

  let needsHeader = false
  try {
    await readFile(filePath, 'utf8')
  } catch (e: unknown) {
    const code = e && typeof e === 'object' && 'code' in e ? (e as NodeJS.ErrnoException).code : ''
    if (code === 'ENOENT') needsHeader = true
    else throw e
  }

  const line = [
    csvCell(row.receivedAt),
    csvCell(row.orderId),
    csvCell(row.email),
    csvCell(row.fullName),
    csvCell(row.phone),
    csvCell(row.line1),
    csvCell(row.line2),
    csvCell(row.city),
    csvCell(row.state),
    csvCell(row.pincode),
    csvCell(row.payment),
    csvCell(row.itemsSummary),
    csvCell(String(row.total)),
  ].join(',')

  if (needsHeader) await appendFile(filePath, HEADER, 'utf8')
  await appendFile(filePath, `${line}\n`, 'utf8')
}
