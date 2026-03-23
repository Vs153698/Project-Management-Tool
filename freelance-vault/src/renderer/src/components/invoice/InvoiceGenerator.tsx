import { useState, useMemo } from 'react'
import { FileText, Download, Plus, Trash2 } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import type { Project } from '../../types'

interface LineItem {
  id: string
  description: string
  qty: number
  rate: number
}

function fmt(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(n)
  } catch {
    return `${currency} ${n.toFixed(2)}`
  }
}

function buildInvoiceHtml(
  project: Project,
  items: LineItem[],
  invoiceNumber: string,
  issueDate: string,
  dueDate: string,
  notes: string,
  fromName: string,
  currency: string,
  bankDetails: string
): string {
  const subtotal = items.reduce((s, i) => s + i.qty * i.rate, 0)
  const rows = items
    .map(
      (i) => `
    <tr>
      <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;font-size:13px;">${i.description}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:13px;">${i.qty}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;">${fmt(i.rate, currency)}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;font-weight:600;">${fmt(i.qty * i.rate, currency)}</td>
    </tr>`
    )
    .join('')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; background: #fff; padding: 40px; }
  h1 { font-size: 28px; font-weight: 700; color: #1d4ed8; }
  .label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
  .value { font-size: 14px; color: #111827; font-weight: 500; }
  table { width: 100%; border-collapse: collapse; margin-top: 24px; }
  thead tr { background: #f3f4f6; }
  thead th { padding: 10px 16px; text-align: left; font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
  .total-row td { padding: 14px 16px; font-size: 16px; font-weight: 700; color: #1d4ed8; }
</style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;">
    <div>
      <h1>INVOICE</h1>
      <p style="color:#6b7280;font-size:13px;margin-top:4px;">#${invoiceNumber}</p>
    </div>
    <div style="text-align:right;">
      <p class="label">From</p>
      <p class="value">${fromName}</p>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px;margin-bottom:32px;">
    <div>
      <p class="label">Bill To</p>
      <p class="value">${project.clientName}</p>
      ${project.middleman ? `<p style="font-size:12px;color:#6b7280;margin-top:2px;">via ${project.middleman}</p>` : ''}
    </div>
    <div>
      <p class="label">Project</p>
      <p class="value">${project.projectName}</p>
    </div>
    <div>
      <p class="label">Issue Date</p>
      <p class="value">${issueDate}</p>
      <p class="label" style="margin-top:8px;">Due Date</p>
      <p class="value">${dueDate}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="text-align:left;">Description</th>
        <th style="text-align:center;">Qty</th>
        <th style="text-align:right;">Rate</th>
        <th style="text-align:right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr class="total-row">
        <td colspan="3" style="text-align:right;color:#111827;font-size:13px;font-weight:600;padding:14px 16px;">Total</td>
        <td style="text-align:right;padding:14px 16px;font-size:18px;font-weight:700;color:#1d4ed8;">${fmt(subtotal, currency)}</td>
      </tr>
    </tbody>
  </table>

  ${notes ? `<div style="margin-top:28px;padding:16px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
    <p class="label">Notes</p>
    <p style="font-size:13px;color:#374151;margin-top:4px;white-space:pre-wrap;">${notes}</p>
  </div>` : ''}

  ${bankDetails ? `<div style="margin-top:16px;padding:16px;background:#eff6ff;border-radius:8px;border:1px solid #bfdbfe;">
    <p class="label" style="color:#1d4ed8;">Payment Details</p>
    <p style="font-size:13px;color:#1e40af;margin-top:4px;white-space:pre-wrap;">${bankDetails}</p>
  </div>` : ''}
</body>
</html>`
}

export default function InvoiceGenerator({ project }: { project: Project }): JSX.Element {
  const { bankDetails, displayCurrency } = useAppStore()

  const [invoiceNumber, setInvoiceNumber] = useState(
    `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`
  )
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return d.toISOString().slice(0, 10)
  })
  const [notes, setNotes] = useState('')
  const [fromName, setFromName] = useState('')
  const [items, setItems] = useState<LineItem[]>([
    { id: '1', description: project.projectName, qty: 1, rate: project.projectCost || 0 }
  ])
  const [generating, setGenerating] = useState(false)
  const [selectedBankId, setSelectedBankId] = useState<string>(
    bankDetails.find((b) => b.isDefault)?.id || ''
  )

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.qty * i.rate, 0), [items])

  const addItem = () => {
    setItems((prev) => [...prev, { id: String(Date.now()), description: '', qty: 1, rate: 0 }])
  }

  const updateItem = (id: string, field: keyof LineItem, value: string | number) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)))
  }

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  const bankText = useMemo(() => {
    const bd = bankDetails.find((b) => b.id === selectedBankId)
    if (!bd) return ''
    const lines: string[] = [
      `${bd.accountHolder}`,
      `${bd.bankName}${bd.branchName ? ` — ${bd.branchName}` : ''}`,
      `Account: ${bd.accountNumber}${bd.accountType ? ` (${bd.accountType})` : ''}`,
    ]
    if (bd.ifsc) lines.push(`IFSC: ${bd.ifsc}`)
    if (bd.swift) lines.push(`SWIFT: ${bd.swift}`)
    if (bd.routingNumber) lines.push(`Routing: ${bd.routingNumber}`)
    if (bd.upiId) lines.push(`UPI: ${bd.upiId}`)
    if (bd.paypalEmail) lines.push(`PayPal: ${bd.paypalEmail}`)
    return lines.join('\n')
  }, [bankDetails, selectedBankId])

  const generate = async () => {
    setGenerating(true)
    const html = buildInvoiceHtml(
      project, items, invoiceNumber, issueDate, dueDate, notes, fromName, displayCurrency, bankText
    )
    const filename = `${invoiceNumber}.pdf`
    await window.electron.invoiceGenerate({ html, filename })
    setGenerating(false)
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center gap-2">
        <FileText size={16} className="text-primary" />
        <span className="text-text font-semibold">Invoice Generator</span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="label">Invoice #</label>
          <input className="input w-full" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
        </div>
        <div>
          <label className="label">Issue Date</label>
          <input type="date" className="input w-full" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Due Date</label>
          <input type="date" className="input w-full" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="label">Your Name / Business</label>
          <input className="input w-full" placeholder="Your name or company" value={fromName} onChange={(e) => setFromName(e.target.value)} />
        </div>
        {bankDetails.length > 0 && (
          <div>
            <label className="label">Payment Details</label>
            <select
              className="input w-full"
              value={selectedBankId}
              onChange={(e) => setSelectedBankId(e.target.value)}
            >
              <option value="">None</option>
              {bankDetails.map((b) => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Line items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label">Line Items</label>
          <button onClick={addItem} className="btn-secondary text-xs py-1 px-2">
            <Plus size={12} />
            Add Item
          </button>
        </div>
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex gap-2 items-center">
              <input
                className="input flex-[3] text-sm"
                placeholder="Description"
                value={item.description}
                onChange={(e) => updateItem(item.id, 'description', e.target.value)}
              />
              <input
                type="number"
                min="0"
                className="input w-16 text-sm text-center"
                placeholder="Qty"
                value={item.qty}
                onChange={(e) => updateItem(item.id, 'qty', parseFloat(e.target.value) || 0)}
              />
              <input
                type="number"
                min="0"
                className="input w-28 text-sm"
                placeholder="Rate"
                value={item.rate}
                onChange={(e) => updateItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
              />
              <span className="text-text text-sm font-semibold w-24 text-right shrink-0">
                {fmt(item.qty * item.rate, displayCurrency)}
              </span>
              <button
                onClick={() => removeItem(item.id)}
                disabled={items.length === 1}
                className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors disabled:opacity-30"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex justify-end mt-3">
          <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-surface border border-border">
            <span className="text-text-muted text-sm">Total</span>
            <span className="text-text font-bold text-lg">{fmt(subtotal, displayCurrency)}</span>
          </div>
        </div>
      </div>

      <div>
        <label className="label">Notes (optional)</label>
        <textarea
          className="input w-full resize-none text-sm"
          rows={3}
          placeholder="Payment terms, thank you note, etc."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <button
        onClick={generate}
        disabled={generating || items.every((i) => !i.description)}
        className="btn-primary py-2.5 px-5 disabled:opacity-40"
      >
        <Download size={15} />
        {generating ? 'Generating PDF...' : 'Generate & Save PDF'}
      </button>
    </div>
  )
}
