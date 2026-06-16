import { useEffect, useRef, useState } from 'react'
import { Card, CardBody, Chip, Spinner } from '@heroui/react'
import {
  ImageIcon, Plus, Search, FileText, CreditCard, FileSignature,
  Receipt, HelpCircle, Pencil, Trash2, X,
} from 'lucide-react'
import { useI18n } from '../i18n'
import { useToast } from '../App'
import { getEvidence, createEvidence, updateEvidence, deleteEvidence } from '../api'
import type { Evidence } from '../types'
import Btn from '../ui/Btn'
import Modal from '../ui/Modal'
import { TextField, TextAreaField } from '../ui/Field'
import { fmtDate, today } from '../utils'

const SELECT_CLASS = 'w-full bg-content2 border border-content3 rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary transition-colors cursor-pointer [color-scheme:dark]'

const CATEGORIES = [
  { key: 'receipt',   label: 'บิล/ใบเสร็จ',   color: 'success',  Icon: Receipt },
  { key: 'bank_slip', label: 'สลิปโอนเงิน',   color: 'primary',  Icon: CreditCard },
  { key: 'contract',  label: 'สัญญา/เอกสาร', color: 'warning',  Icon: FileSignature },
  { key: 'expense',   label: 'ค่าใช้จ่าย',   color: 'danger',   Icon: FileText },
  { key: 'other',     label: 'อื่นๆ',          color: 'default',  Icon: HelpCircle },
] as const
type CatKey = typeof CATEGORIES[number]['key']

const fmt = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

const ZERO_FORM: Partial<Evidence> = {
  title: '', category: 'receipt' as CatKey, amount: undefined,
  doc_date: today(), contact_name: '', reference: '', image_url: '', notes: '',
}

export default function EvidencePage() {
  const { t } = useI18n()
  const { toast } = useToast()
  const [items, setItems] = useState<Evidence[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [modal, setModal] = useState<'none' | 'create' | 'edit'>('none')
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<Partial<Evidence>>(ZERO_FORM)
  const [previewItem, setPreviewItem] = useState<Evidence | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const set = <K extends keyof Evidence>(k: K, v: Evidence[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await getEvidence(search || undefined, catFilter || undefined)
      setItems(data)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast('ไฟล์ใหญ่เกิน 5MB', 'err'); return }
    const reader = new FileReader()
    reader.onload = ev => set('image_url', ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const openCreate = () => {
    setForm({ ...ZERO_FORM })
    setEditId(null)
    setModal('create')
  }

  const openEdit = (item: Evidence) => {
    setForm({ ...item })
    setEditId(item.id)
    setModal('edit')
  }

  const save = async () => {
    if (!form.title?.trim()) { toast('กรุณากรอกชื่อ / รายละเอียด', 'err'); return }
    try {
      if (modal === 'edit' && editId !== null) {
        await updateEvidence(editId, form)
      } else {
        await createEvidence(form)
      }
      toast(t('toast_ev_saved'))
      setModal('none')
      load()
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  const doDelete = async (id: number) => {
    if (!confirm(t('confirm_delete_ev'))) return
    try {
      await deleteEvidence(id)
      toast(t('toast_ev_deleted'))
      load()
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  const applyFilter = (cat: string) => {
    setCatFilter(cat)
    // Trigger load with updated filter
    setLoading(true)
    getEvidence(search || undefined, cat || undefined)
      .then(({ data }) => setItems(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  const applySearch = (q: string) => {
    setSearch(q)
    setLoading(true)
    getEvidence(q || undefined, catFilter || undefined)
      .then(({ data }) => setItems(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  const getCatConfig = (key: string) =>
    CATEGORIES.find(c => c.key === key) ?? CATEGORIES[CATEGORIES.length - 1]

  return (
    <div className="flex flex-col gap-4">
      {/* Top bar */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-default-400 pointer-events-none" />
            <input
              className="w-full pl-9 pr-4 py-2 bg-content2 border border-content3 rounded-lg text-sm text-foreground placeholder:text-default-400 outline-none focus:border-primary transition-colors"
              placeholder={t('ev_search')}
              value={search}
              onChange={e => applySearch(e.target.value)}
            />
          </div>
          <Btn variant="primary" onClick={openCreate} startContent={<Plus size={15} strokeWidth={2.2} />}>
            {t('ev_btn_add')}
          </Btn>
        </div>

        {/* Category filter chips */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => applyFilter('')}
            className={`text-[12px] px-3 py-1 rounded-full border transition-all cursor-pointer ${catFilter === '' ? 'bg-primary text-white border-primary' : 'bg-content2 border-content3 text-default-500 hover:border-primary hover:text-primary'}`}>
            {t('ev_all_cats')}
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => applyFilter(cat.key)}
              className={`text-[12px] px-3 py-1 rounded-full border transition-all cursor-pointer flex items-center gap-1.5 ${catFilter === cat.key ? 'bg-primary text-white border-primary' : 'bg-content2 border-content3 text-default-500 hover:border-primary hover:text-primary'}`}>
              <cat.Icon size={11} strokeWidth={2} />
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : items.length === 0 ? (
        <Card>
          <CardBody className="flex flex-col items-center py-12 gap-3 text-default-400">
            <ImageIcon size={40} strokeWidth={1.2} />
            <p>{t('ev_no_data')}</p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 stagger">
          {items.map(item => {
            const catCfg = getCatConfig(item.category)
            return (
              <Card key={item.id} className="card-panel card-lift overflow-hidden">
                <CardBody className="p-0">
                  {/* Image or placeholder */}
                  {item.image_url ? (
                    <div className="overflow-hidden rounded-t-xl cursor-pointer" onClick={() => setPreviewItem(item)}>
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="w-full object-cover"
                        style={{ maxHeight: 160, minHeight: 80 }}
                      />
                    </div>
                  ) : (
                    <div className="bg-content2 flex items-center justify-center rounded-t-xl" style={{ height: 128 }}>
                      <ImageIcon size={32} strokeWidth={1.2} className="text-default-300" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="p-3 flex flex-col gap-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <Chip
                        size="sm"
                        variant="flat"
                        color={catCfg.color as 'success' | 'primary' | 'warning' | 'danger' | 'default'}
                        startContent={<catCfg.Icon size={10} strokeWidth={2} />}
                        className="flex-shrink-0 text-[10px]">
                        {catCfg.label}
                      </Chip>
                    </div>

                    <div className="text-[13px] font-semibold leading-snug line-clamp-2">{item.title}</div>

                    {item.reference && (
                      <div className="text-[11px] text-default-400 truncate">#{item.reference}</div>
                    )}
                    {item.contact_name && (
                      <div className="text-[11px] text-default-500 truncate">{item.contact_name}</div>
                    )}

                    <div className="flex items-center justify-between mt-1">
                      {item.amount != null && item.amount !== undefined ? (
                        <span className="text-[13px] font-bold text-success">฿{fmt(item.amount)}</span>
                      ) : <span />}
                      <span className="text-[11px] text-default-400">{fmtDate(item.doc_date)}</span>
                    </div>
                  </div>

                  {/* Footer actions */}
                  <div className="px-3 py-2 border-t border-content3 bg-content2/30 flex items-center justify-end gap-1.5">
                    <Btn size="sm" variant="ghost" onClick={() => openEdit(item)} title={t('btn_edit')} aria-label={t('btn_edit')}>
                      <Pencil size={13} strokeWidth={2} />
                    </Btn>
                    <Btn size="sm" variant="danger" onClick={() => doDelete(item.id)} title={t('btn_delete')} aria-label={t('btn_delete')}>
                      <Trash2 size={13} strokeWidth={2} />
                    </Btn>
                  </div>
                </CardBody>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal
        open={modal !== 'none'}
        onClose={() => setModal('none')}
        title={modal === 'edit' ? t('ev_modal_edit') : t('ev_modal_create')}
        size="lg"
        footer={
          <div className="flex gap-2 justify-end">
            <Btn variant="ghost" onClick={() => setModal('none')}>{t('btn_cancel')}</Btn>
            <Btn variant="primary" onClick={save}>{t('btn_save')}</Btn>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <TextField
            label={t('ev_lbl_title')}
            value={form.title || ''}
            onChange={e => set('title', e.target.value)}
            placeholder="ชื่อหลักฐาน / รายละเอียด"
          />

          <div>
            <label className="block text-[11px] font-medium text-default-500 uppercase tracking-wide mb-1.5">
              {t('ev_lbl_category')}
            </label>
            <select
              value={form.category || 'receipt'}
              onChange={e => set('category', e.target.value as CatKey)}
              className={SELECT_CLASS}>
              {CATEGORIES.map(c => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <TextField
              label={t('ev_lbl_amount')}
              type="number"
              value={form.amount != null ? String(form.amount) : ''}
              onChange={e => set('amount', e.target.value === '' ? undefined : Number(e.target.value))}
              placeholder="0"
            />
            <TextField
              label={t('ev_lbl_date')}
              type="date"
              value={form.doc_date || ''}
              onChange={e => set('doc_date', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <TextField
              label={t('ev_lbl_contact')}
              value={form.contact_name || ''}
              onChange={e => set('contact_name', e.target.value)}
              placeholder="ชื่อบริษัท / ร้านค้า"
            />
            <TextField
              label={t('ev_lbl_ref')}
              value={form.reference || ''}
              onChange={e => set('reference', e.target.value)}
              placeholder="เลขอ้างอิง"
            />
          </div>

          {/* Image upload */}
          <div>
            <div className="text-[11px] font-medium text-default-500 uppercase tracking-wide mb-1.5">
              {t('ev_lbl_image')}
            </div>
            <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handlePhoto} />
            {form.image_url ? (
              <div className="relative rounded-xl overflow-hidden border border-content3 bg-content2">
                <img src={form.image_url} alt="evidence" className="w-full max-h-48 object-contain" />
                <div className="absolute top-2 right-2 flex gap-1.5">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2 py-1 rounded-lg bg-content1/90 text-[11px] text-default-500 hover:text-foreground border border-content3 cursor-pointer transition-colors">
                    {t('ev_img_upload')}
                  </button>
                  <button
                    onClick={() => set('image_url', '')}
                    className="w-7 h-7 flex items-center justify-center rounded-full bg-danger/80 text-white text-[13px] cursor-pointer hover:bg-danger transition-colors">
                    <X size={12} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-content3 rounded-xl py-5 flex flex-col items-center gap-2 text-default-400 hover:border-primary hover:text-primary transition-colors cursor-pointer">
                <ImageIcon size={20} strokeWidth={1.6} />
                <span className="text-[12px]">{t('ev_img_upload')}</span>
              </button>
            )}
          </div>

          <TextAreaField
            label={t('lbl_notes')}
            value={form.notes || ''}
            onChange={e => set('notes', e.target.value)}
            rows={2}
          />
        </div>
      </Modal>

      {/* Full-screen image preview */}
      {previewItem && (
        <div
          className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center"
          onClick={() => setPreviewItem(null)}>
          <button
            className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer"
            onClick={() => setPreviewItem(null)}>
            <X size={18} strokeWidth={2} />
          </button>
          <img
            src={previewItem.image_url!}
            alt={previewItem.title}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
