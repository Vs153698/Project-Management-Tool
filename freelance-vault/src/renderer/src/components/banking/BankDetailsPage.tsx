import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  X,
  Building2,
  CreditCard,
  Copy,
  CheckCircle2,
  Star,
  Trash2,
  Edit3,
  Share2,
  Download,
  MessageCircle,
  ChevronDown,
  AlertCircle,
  Banknote,
  Eye,
  EyeOff
} from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import type { BankDetail } from '../../types'

// ─── Canvas Card Generator ───────────────────────────────────────────────────

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function drawField(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  x: number,
  y: number,
  maxWidth = 340
) {
  ctx.font = '500 10px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif'
  ctx.fillStyle = '#6b7280'
  ctx.fillText(label.toUpperCase(), x, y)
  ctx.font = '600 17px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif'
  ctx.fillStyle = '#e5e7eb'
  ctx.fillText(value, x, y + 24, maxWidth)
}

function maskAccountNumber(num: string): string {
  const clean = num.replace(/\s/g, '')
  if (clean.length <= 4) return clean
  const last4 = clean.slice(-4)
  const masked = '•'.repeat(Math.max(0, clean.length - 4))
  // Group in 4s
  const full = masked + last4
  return full.replace(/.{4}(?=.)/g, '$&  ')
}

function generateBankCard(detail: BankDetail, userName: string): string {
  const canvas = document.createElement('canvas')
  const W = 960
  const H = 520
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // ── Background ──
  const bgGrad = ctx.createLinearGradient(0, 0, W, H)
  bgGrad.addColorStop(0, '#0d0d1a')
  bgGrad.addColorStop(0.6, '#13131f')
  bgGrad.addColorStop(1, '#0a0a14')
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, W, H)

  // Subtle noise/texture dots
  ctx.fillStyle = 'rgba(124, 58, 237, 0.03)'
  for (let i = 0; i < 200; i++) {
    const px = Math.random() * W
    const py = Math.random() * H
    const r = Math.random() * 2
    ctx.beginPath()
    ctx.arc(px, py, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // ── Glow blobs ──
  const glow1 = ctx.createRadialGradient(150, 100, 0, 150, 100, 300)
  glow1.addColorStop(0, 'rgba(124, 58, 237, 0.12)')
  glow1.addColorStop(1, 'rgba(124, 58, 237, 0)')
  ctx.fillStyle = glow1
  ctx.fillRect(0, 0, W, H)

  const glow2 = ctx.createRadialGradient(W - 100, H - 100, 0, W - 100, H - 100, 280)
  glow2.addColorStop(0, 'rgba(6, 182, 212, 0.1)')
  glow2.addColorStop(1, 'rgba(6, 182, 212, 0)')
  ctx.fillStyle = glow2
  ctx.fillRect(0, 0, W, H)

  // ── Card border ──
  roundRectPath(ctx, 28, 28, W - 56, H - 56, 24)
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  ctx.lineWidth = 1
  ctx.stroke()

  // ── Top accent stripe ──
  const stripe = ctx.createLinearGradient(0, 0, W, 0)
  stripe.addColorStop(0, '#7c3aed')
  stripe.addColorStop(0.5, '#9333ea')
  stripe.addColorStop(1, '#06b6d4')
  ctx.fillStyle = stripe
  ctx.beginPath()
  ctx.moveTo(28, 28)
  ctx.lineTo(W - 28, 28)
  ctx.quadraticCurveTo(W - 28, 28, W - 28, 28)
  roundRectPath(ctx, 28, 28, W - 56, 5, 2)
  ctx.fill()

  // ── Logo icon ──
  const iconX = 64
  const iconY = 62
  const iconSize = 40
  const iconGrad = ctx.createLinearGradient(iconX, iconY, iconX + iconSize, iconY + iconSize)
  iconGrad.addColorStop(0, '#7c3aed')
  iconGrad.addColorStop(1, '#06b6d4')
  roundRectPath(ctx, iconX, iconY, iconSize, iconSize, 10)
  ctx.fillStyle = iconGrad
  ctx.fill()
  // Simple box/vault icon
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.lineWidth = 2
  ctx.strokeRect(iconX + 10, iconY + 11, 20, 18)
  ctx.beginPath()
  ctx.moveTo(iconX + 20, iconY + 19)
  ctx.arc(iconX + 20, iconY + 19, 3, 0, Math.PI * 2)
  ctx.stroke()

  // ── Branding text ──
  ctx.font = '700 20px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
  const brandGrad = ctx.createLinearGradient(iconX + iconSize + 12, 0, iconX + iconSize + 200, 0)
  brandGrad.addColorStop(0, '#c4b5fd')
  brandGrad.addColorStop(1, '#67e8f9')
  ctx.fillStyle = brandGrad
  ctx.fillText('DevVault', iconX + iconSize + 12, iconY + 17)

  ctx.font = '400 12px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif'
  ctx.fillStyle = '#6b7280'
  ctx.fillText('Payment Details', iconX + iconSize + 12, iconY + 35)

  // ── Label badge ──
  if (detail.label) {
    const badgeText = detail.label
    ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif'
    const tw = ctx.measureText(badgeText).width
    const bx = W - 64 - tw - 16
    const by = iconY + 4
    roundRectPath(ctx, bx, by, tw + 16, 22, 11)
    ctx.fillStyle = 'rgba(124, 58, 237, 0.2)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(124, 58, 237, 0.4)'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.fillStyle = '#a78bfa'
    ctx.fillText(badgeText, bx + 8, by + 15)
  }

  // ── Divider ──
  const divY = 130
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(64, divY)
  ctx.lineTo(W - 64, divY)
  ctx.stroke()

  // ── Account Holder ──
  ctx.font = '400 10px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif'
  ctx.fillStyle = '#4b5563'
  ctx.fillText('ACCOUNT HOLDER', 64, 160)
  ctx.font = '700 30px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
  ctx.fillStyle = '#f9fafb'
  ctx.fillText(detail.accountHolder.toUpperCase(), 64, 198)

  // ── Grid of fields ──
  const col1 = 64
  const col2 = 360
  const col3 = 660
  let rowY = 248

  // Row 1: Bank | Account Number
  drawField(ctx, 'Bank', detail.bankName, col1, rowY, 270)
  // Show full account number on shared image – recipient needs it to transfer funds
  const rawNum = detail.accountNumber.replace(/\s/g, '')
  const formattedNum = rawNum.replace(/.{4}(?=.)/g, '$&  ')
  drawField(ctx, 'Account Number', formattedNum, col2, rowY, 270)
  drawField(ctx, 'Account Type', detail.accountType.charAt(0).toUpperCase() + detail.accountType.slice(1), col3, rowY, 220)

  rowY += 80
  // Row 2: IFSC/SWIFT | Routing | Branch
  if (detail.ifsc) {
    drawField(ctx, 'IFSC Code', detail.ifsc, col1, rowY, 260)
  } else if (detail.swift) {
    drawField(ctx, 'SWIFT / BIC', detail.swift, col1, rowY, 260)
  } else if (detail.routingNumber) {
    drawField(ctx, 'Routing Number', detail.routingNumber, col1, rowY, 260)
  }
  if (detail.branchName) {
    drawField(ctx, 'Branch', detail.branchName, col2, rowY, 270)
  }

  // Row 3: UPI | PayPal
  const hasUpi = !!detail.upiId
  const hasPaypal = !!detail.paypalEmail

  if (hasUpi || hasPaypal) {
    rowY += 80
    if (hasUpi) {
      // UPI pill highlight
      roundRectPath(ctx, col1 - 8, rowY - 20, 290, 50, 10)
      ctx.fillStyle = 'rgba(16, 185, 129, 0.08)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.2)'
      ctx.lineWidth = 1
      ctx.stroke()
      drawField(ctx, 'UPI ID', detail.upiId!, col1, rowY, 260)
    }
    if (hasPaypal) {
      const ppX = hasUpi ? col2 : col1
      roundRectPath(ctx, ppX - 8, rowY - 20, 290, 50, 10)
      ctx.fillStyle = 'rgba(6, 182, 212, 0.08)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.2)'
      ctx.lineWidth = 1
      ctx.stroke()
      drawField(ctx, 'PayPal', detail.paypalEmail!, ppX, rowY, 260)
    }
  }

  // ── Footer ──
  const footY = H - 44
  // Subtle footer line
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(64, footY - 12)
  ctx.lineTo(W - 64, footY - 12)
  ctx.stroke()

  ctx.font = '400 11px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif'
  ctx.fillStyle = '#374151'
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  ctx.fillText(`Shared via DevVault  ·  ${userName}  ·  ${dateStr}`, 64, footY)

  // Default star
  if (detail.isDefault) {
    ctx.font = '400 11px -apple-system'
    ctx.fillStyle = '#f59e0b'
    ctx.fillText('★  Default Account', W - 200, footY)
  }

  return canvas.toDataURL('image/png')
}

// ─── Add / Edit Modal ────────────────────────────────────────────────────────

interface FormProps {
  initial?: BankDetail
  onSave: (d: BankDetail) => void
  onClose: () => void
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function BankDetailForm({ initial, onSave, onClose }: FormProps) {
  const [label, setLabel] = useState(initial?.label || '')
  const [accountHolder, setAccountHolder] = useState(initial?.accountHolder || '')
  const [bankName, setBankName] = useState(initial?.bankName || '')
  const [accountNumber, setAccountNumber] = useState(initial?.accountNumber || '')
  const [accountType, setAccountType] = useState<BankDetail['accountType']>(initial?.accountType || 'savings')
  const [ifsc, setIfsc] = useState(initial?.ifsc || '')
  const [swift, setSwift] = useState(initial?.swift || '')
  const [routingNumber, setRoutingNumber] = useState(initial?.routingNumber || '')
  const [branchName, setBranchName] = useState(initial?.branchName || '')
  const [upiId, setUpiId] = useState(initial?.upiId || '')
  const [paypalEmail, setPaypalEmail] = useState(initial?.paypalEmail || '')
  const [notes, setNotes] = useState(initial?.notes || '')
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const e: Record<string, string> = {}
    if (!accountHolder.trim()) e.accountHolder = 'Required'
    if (!bankName.trim()) e.bankName = 'Required'
    if (!accountNumber.trim()) e.accountNumber = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    onSave({
      id: initial?.id || generateId(),
      label: label.trim() || 'My Account',
      accountHolder: accountHolder.trim(),
      bankName: bankName.trim(),
      accountNumber: accountNumber.trim(),
      accountType,
      ifsc: ifsc.trim() || undefined,
      swift: swift.trim() || undefined,
      routingNumber: routingNumber.trim() || undefined,
      branchName: branchName.trim() || undefined,
      upiId: upiId.trim() || undefined,
      paypalEmail: paypalEmail.trim() || undefined,
      notes: notes.trim() || undefined,
      isDefault,
      createdAt: initial?.createdAt || new Date().toISOString(),
    })
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="modal-content"
        style={{ maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 size={16} className="text-primary" />
            </div>
            <h2 className="text-base font-bold text-text">{initial ? 'Edit Bank Account' : 'Add Bank Account'}</h2>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text p-1.5 rounded-lg hover:bg-surface transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Label */}
          <div>
            <label className="label">Account Label</label>
            <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Primary Account, Business Account" className="input" />
          </div>

          {/* Account Holder + Bank */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Account Holder Name *</label>
              <input type="text" value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} placeholder="John Doe" className="input" />
              {errors.accountHolder && <p className="text-danger text-xs mt-1">{errors.accountHolder}</p>}
            </div>
            <div>
              <label className="label">Bank Name *</label>
              <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="HDFC Bank" className="input" />
              {errors.bankName && <p className="text-danger text-xs mt-1">{errors.bankName}</p>}
            </div>
          </div>

          {/* Account Number + Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Account Number *</label>
              <input type="text" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="XXXX XXXX XXXX" className="input font-mono" />
              {errors.accountNumber && <p className="text-danger text-xs mt-1">{errors.accountNumber}</p>}
            </div>
            <div>
              <label className="label">Account Type</label>
              <select value={accountType} onChange={(e) => setAccountType(e.target.value as BankDetail['accountType'])} className="input">
                <option value="savings">Savings</option>
                <option value="current">Current</option>
                <option value="checking">Checking</option>
              </select>
            </div>
          </div>

          {/* IFSC / SWIFT / Routing */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">IFSC Code</label>
              <input type="text" value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} placeholder="HDFC0001234" className="input font-mono text-sm" />
            </div>
            <div>
              <label className="label">SWIFT / BIC</label>
              <input type="text" value={swift} onChange={(e) => setSwift(e.target.value.toUpperCase())} placeholder="HDFCINBB" className="input font-mono text-sm" />
            </div>
            <div>
              <label className="label">Routing No.</label>
              <input type="text" value={routingNumber} onChange={(e) => setRoutingNumber(e.target.value)} placeholder="021000021" className="input font-mono text-sm" />
            </div>
          </div>

          {/* Branch */}
          <div>
            <label className="label">Branch Name (Optional)</label>
            <input type="text" value={branchName} onChange={(e) => setBranchName(e.target.value)} placeholder="MG Road, Bangalore" className="input" />
          </div>

          {/* UPI + PayPal */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">UPI ID</label>
              <input type="text" value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="name@upi" className="input" />
            </div>
            <div>
              <label className="label">PayPal Email</label>
              <input type="email" value={paypalEmail} onChange={(e) => setPaypalEmail(e.target.value)} placeholder="you@paypal.com" className="input" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notes (Optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any additional payment instructions..." rows={2} className="input resize-none" />
          </div>

          {/* Default toggle */}
          <div
            onClick={() => setIsDefault((v) => !v)}
            className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${isDefault ? 'border-warning/40 bg-warning/5' : 'border-border hover:border-border/80 bg-surface'}`}
          >
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isDefault ? 'border-warning bg-warning' : 'border-border'}`}>
              {isDefault && <Star size={11} className="text-background" fill="currentColor" />}
            </div>
            <div>
              <p className="text-text text-sm font-medium">Set as default account</p>
              <p className="text-text-muted text-xs">Shown first on the Bank Details page</p>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" className="btn-primary flex-1 justify-center">
              {initial ? 'Save Changes' : 'Add Account'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Share Modal ─────────────────────────────────────────────────────────────

interface ShareModalProps {
  detail: BankDetail
  userName: string
  onClose: () => void
}

function ShareModal({ detail, userName, onClose }: ShareModalProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const [generating, setGenerating] = useState(false)
  const hasGenerated = useRef(false)

  const generate = useCallback(async () => {
    if (hasGenerated.current) return
    hasGenerated.current = true
    setGenerating(true)
    // Small delay so the modal animates in first
    await new Promise((r) => setTimeout(r, 100))
    const url = generateBankCard(detail, userName)
    setImageUrl(url)
    setGenerating(false)
  }, [detail, userName])

  // Auto-generate on mount
  useEffect(() => { generate() }, [generate])

  const handleCopyToClipboard = async () => {
    if (!imageUrl) return
    const result = await window.electron.bankCopyImage(imageUrl)
    if (result.success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    }
  }

  const handleSave = async () => {
    if (!imageUrl) return
    const result = await window.electron.bankSaveImage(imageUrl)
    if (result.success) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
  }

  const handleWhatsApp = async () => {
    if (!imageUrl) return
    // Copy image to clipboard first
    await window.electron.bankCopyImage(imageUrl)
    setCopied(true)
    // Open WhatsApp Web in default browser
    setTimeout(() => {
      // shell.openExternal is exposed via folderOpen which uses shell.openPath
      // We need to open a URL — use the window open handler which routes external URLs to shell
      const a = document.createElement('a')
      a.href = 'https://web.whatsapp.com'
      a.target = '_blank'
      a.rel = 'noopener'
      a.click()
    }, 400)
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.22 }}
        className="modal-content"
        style={{ maxWidth: 680, width: '100%' }}
      >
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
              <Share2 size={16} className="text-success" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text">Share Payment Details</h2>
              <p className="text-text-muted text-xs">{detail.label} · {detail.bankName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text p-1.5 rounded-lg hover:bg-surface transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Card Preview */}
          <div className="relative rounded-2xl overflow-hidden border border-border bg-surface" style={{ aspectRatio: '960/520' }}>
            {generating || !imageUrl ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                  className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent"
                />
                <p className="text-text-muted text-xs">Generating card…</p>
              </div>
            ) : (
              <motion.img
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                src={imageUrl}
                alt="Bank details card"
                className="w-full h-full object-cover"
              />
            )}
          </div>

          {/* WhatsApp notice when copied */}
          <AnimatePresence>
            {copied && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex items-center gap-3 p-3 rounded-xl bg-success/10 border border-success/20"
              >
                <CheckCircle2 size={16} className="text-success shrink-0" />
                <div className="flex-1">
                  <p className="text-success text-sm font-medium">Image copied to clipboard!</p>
                  <p className="text-success/70 text-xs">Open WhatsApp and press Cmd+V (or Ctrl+V) to paste it in any chat.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-3">
            {/* WhatsApp */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleWhatsApp}
              disabled={!imageUrl}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[#25d366]/10 border border-[#25d366]/25 hover:border-[#25d366]/50 hover:bg-[#25d366]/15 transition-all disabled:opacity-40"
            >
              <div className="w-10 h-10 rounded-full bg-[#25d366] flex items-center justify-center">
                <MessageCircle size={20} fill="white" className="text-white" />
              </div>
              <div className="text-center">
                <p className="text-[#25d366] font-semibold text-sm">WhatsApp</p>
                <p className="text-text-muted text-[10px]">Copy & open</p>
              </div>
            </motion.button>

            {/* Copy Image */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleCopyToClipboard}
              disabled={!imageUrl}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all disabled:opacity-40 ${
                copied ? 'bg-success/10 border-success/30' : 'bg-surface border-border hover:border-primary/40 hover:bg-primary/5'
              }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${copied ? 'bg-success/20' : 'bg-primary/10'}`}>
                {copied ? <CheckCircle2 size={20} className="text-success" /> : <Copy size={20} className="text-primary" />}
              </div>
              <div className="text-center">
                <p className={`font-semibold text-sm ${copied ? 'text-success' : 'text-text'}`}>{copied ? 'Copied!' : 'Copy Image'}</p>
                <p className="text-text-muted text-[10px]">To clipboard</p>
              </div>
            </motion.button>

            {/* Save PNG */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSave}
              disabled={!imageUrl}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all disabled:opacity-40 ${
                saved ? 'bg-accent/10 border-accent/30' : 'bg-surface border-border hover:border-accent/40 hover:bg-accent/5'
              }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${saved ? 'bg-accent/20' : 'bg-accent/10'}`}>
                {saved ? <CheckCircle2 size={20} className="text-accent" /> : <Download size={20} className="text-accent" />}
              </div>
              <div className="text-center">
                <p className={`font-semibold text-sm ${saved ? 'text-accent' : 'text-text'}`}>{saved ? 'Saved!' : 'Save PNG'}</p>
                <p className="text-text-muted text-[10px]">To desktop</p>
              </div>
            </motion.button>
          </div>

          {/* WhatsApp instruction */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-surface border border-border">
            <AlertCircle size={14} className="text-text-muted mt-0.5 shrink-0" />
            <p className="text-text-muted text-xs leading-relaxed">
              Click <span className="text-[#25d366] font-semibold">WhatsApp</span> to copy the image and open WhatsApp Web automatically.
              Then paste it into any chat using <kbd className="px-1 py-0.5 rounded bg-card border border-border font-mono text-[10px]">⌘V</kbd>.
              You can also save it as a PNG and share from any app.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Bank Account Card ───────────────────────────────────────────────────────

interface AccountCardProps {
  detail: BankDetail
  onEdit: () => void
  onDelete: () => void
  onShare: () => void
}

function AccountCard({ detail, onEdit, onDelete, onShare }: AccountCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showAccNum, setShowAccNum] = useState(false)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="relative bg-card border border-border rounded-2xl p-5 group hover:border-primary/30 transition-all"
    >
      {/* Default badge */}
      {detail.isDefault && (
        <div className="absolute top-4 right-4 flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/10 border border-warning/20">
          <Star size={10} className="text-warning" fill="currentColor" />
          <span className="text-warning text-[10px] font-semibold">Default</span>
        </div>
      )}

      <div className="flex items-start gap-4">
        {/* Bank icon */}
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/20 flex items-center justify-center shrink-0">
          <Building2 size={22} className="text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-text font-bold text-base">{detail.bankName}</p>
          </div>
          <p className="text-text-muted text-sm">{detail.label}</p>

          {/* Account number with reveal toggle */}
          <div className="flex items-center gap-2 mt-2">
            <CreditCard size={13} className="text-text-muted" />
            <span className="font-mono text-sm text-text-muted">
              {showAccNum
                ? detail.accountNumber.replace(/\s/g, '').replace(/.{4}(?=.)/g, '$& ')
                : `•••• •••• ${detail.accountNumber.replace(/\s/g, '').slice(-4)}`}
            </span>
            <button
              onClick={() => setShowAccNum((v) => !v)}
              className="p-0.5 rounded text-text-muted hover:text-text transition-colors"
              title={showAccNum ? 'Hide account number' : 'Show account number'}
            >
              {showAccNum ? <EyeOff size={11} /> : <Eye size={11} />}
            </button>
            <span className="badge text-[10px]">{detail.accountType}</span>
          </div>

          {/* Account holder */}
          <p className="text-text text-sm font-medium mt-1">{detail.accountHolder}</p>

          {/* Tags row */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {detail.ifsc && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface border border-border text-text-muted font-mono">
                IFSC: {detail.ifsc}
              </span>
            )}
            {detail.swift && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface border border-border text-text-muted font-mono">
                SWIFT: {detail.swift}
              </span>
            )}
            {detail.upiId && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/10 border border-success/20 text-success">
                UPI: {detail.upiId}
              </span>
            )}
            {detail.paypalEmail && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-accent">
                PayPal
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
        {/* Share to WhatsApp */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onShare}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-[#25d366]/10 border border-[#25d366]/20 text-[#25d366] hover:bg-[#25d366]/20 hover:border-[#25d366]/40 transition-all text-sm font-semibold"
        >
          <MessageCircle size={15} />
          Share
        </motion.button>

        <motion.button whileTap={{ scale: 0.97 }} onClick={onEdit} className="btn-secondary py-2 px-4 text-sm">
          <Edit3 size={13} />
          Edit
        </motion.button>

        {confirmDelete ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { onDelete(); setConfirmDelete(false) }}
              className="py-2 px-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs font-semibold hover:bg-danger/20 transition-all"
            >
              Delete
            </button>
            <button onClick={() => setConfirmDelete(false)} className="py-2 px-3 rounded-xl bg-surface border border-border text-text-muted text-xs hover:text-text transition-all">
              Cancel
            </button>
          </div>
        ) : (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setConfirmDelete(true)}
            className="p-2 rounded-xl text-text-muted hover:text-danger hover:bg-danger/10 transition-all border border-transparent hover:border-danger/20"
          >
            <Trash2 size={15} />
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function BankDetailsPage(): JSX.Element {
  const { bankDetails, saveBankDetail, deleteBankDetail, user } = useAppStore()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<BankDetail | null>(null)
  const [sharing, setSharing] = useState<BankDetail | null>(null)

  const handleSave = async (detail: BankDetail) => {
    await saveBankDetail(detail)
    setShowForm(false)
    setEditing(null)
  }

  const handleEdit = (detail: BankDetail) => {
    setEditing(detail)
    setShowForm(true)
  }

  const sorted = [...bankDetails].sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0))

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Banknote size={19} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text">Bank Details</h1>
            <p className="text-text-muted text-xs mt-0.5">
              {bankDetails.length === 0 ? 'No accounts yet' : `${bankDetails.length} account${bankDetails.length > 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="btn-primary text-sm"
        >
          <Plus size={16} />
          Add Account
        </motion.button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {bankDetails.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto"
          >
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/15 to-accent/15 border border-primary/15 flex items-center justify-center mb-5">
              <Building2 size={36} className="text-primary/60" />
            </div>
            <h2 className="text-text font-bold text-lg mb-2">No bank accounts yet</h2>
            <p className="text-text-muted text-sm leading-relaxed mb-6">
              Add your bank details to quickly generate a beautiful payment card and share it on WhatsApp with clients.
            </p>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowForm(true)}
              className="btn-primary"
            >
              <Plus size={16} />
              Add First Account
            </motion.button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-4xl">
            <AnimatePresence>
              {sorted.map((detail) => (
                <AccountCard
                  key={detail.id}
                  detail={detail}
                  onEdit={() => handleEdit(detail)}
                  onDelete={() => deleteBankDetail(detail.id)}
                  onShare={() => setSharing(detail)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showForm && (
          <BankDetailForm
            key="form"
            initial={editing ?? undefined}
            onSave={handleSave}
            onClose={() => { setShowForm(false); setEditing(null) }}
          />
        )}
        {sharing && (
          <ShareModal
            key="share"
            detail={sharing}
            userName={user?.name || 'Freelancer'}
            onClose={() => setSharing(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
