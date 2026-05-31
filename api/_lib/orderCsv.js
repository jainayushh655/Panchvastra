const CSV_HEADER =
  'receivedAt,orderId,status,email,fullName,phone,line1,line2,city,state,pincode,payment,items,total\n'

function csvCell(value) {
  const s = String(value ?? '').replace(/\r\n/g, '\n')
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function itemsSummary(items) {
  if (!Array.isArray(items)) return ''
  return items
    .map((it) => {
      const name = typeof it?.name === 'string' ? it.name : '?'
      const size = typeof it?.size === 'string' ? it.size : ''
      const color = typeof it?.color === 'string' ? it.color : ''
      const qty = typeof it?.quantity === 'number' ? it.quantity : 0
      const price = typeof it?.price === 'number' ? it.price : 0
      return `${[name, size, color].filter(Boolean).join(' / ')} ×${qty} @${price}`
    })
    .join(' | ')
}

function entryToCsvRow(entry) {
  const addr = entry.address || {}
  return [
    csvCell(entry.receivedAt || entry.order?.date || ''),
    csvCell(entry.order?.id || ''),
    csvCell(entry.order?.status || 'processing'),
    csvCell(entry.customerEmail || addr.email || ''),
    csvCell(entry.customerName || addr.fullName || ''),
    csvCell(addr.phone || ''),
    csvCell(addr.line1 || ''),
    csvCell(addr.line2 || ''),
    csvCell(addr.city || ''),
    csvCell(addr.state || ''),
    csvCell(addr.pincode || ''),
    csvCell(entry.payment || ''),
    csvCell(itemsSummary(entry.order?.items)),
    csvCell(String(entry.order?.total ?? '')),
  ].join(',')
}

function ordersToCsv(orders) {
  const rows = orders.map((row) => entryToCsvRow(row))
  return CSV_HEADER + rows.join('\n') + (rows.length ? '\n' : '')
}

module.exports = {
  CSV_HEADER,
  entryToCsvRow,
  ordersToCsv,
}
