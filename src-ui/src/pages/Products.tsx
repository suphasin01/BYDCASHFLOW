import { useEffect, useState } from 'react'
import {
  Card, CardBody, Chip, Spinner,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
} from '@heroui/react'
import { TextField, TextAreaField } from '../ui/Field'
import { useI18n } from '../i18n'
import { useToast } from '../App'
import { getProducts, createProduct, updateProduct, deleteProduct } from '../api'
import type { Product } from '../types'
import { fmt } from '../utils'
import Btn from '../ui/Btn'
import Modal from '../ui/Modal'

const SELECT_CLASS = 'w-full bg-content2 border border-content3 rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary transition-colors cursor-pointer [color-scheme:dark]'

type ChipColor = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger'

export default function Products() {
  const { t } = useI18n()
  const { toast } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)

  // Form
  const [fCode, setFCode] = useState('')
  const [fName, setFName] = useState('')
  const [fPrice, setFPrice] = useState(0)
  const [fUnit, setFUnit] = useState('')
  const [fVat, setFVat] = useState<'excluded' | 'included' | 'none'>('excluded')
  const [fCategory, setFCategory] = useState('')
  const [fDescription, setFDescription] = useState('')

  const load = async (q?: string) => {
    setLoading(true)
    try { const { data } = await getProducts(q ?? search); setProducts(data) } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditing(null)
    setFCode(''); setFName(''); setFPrice(0); setFUnit(''); setFVat('excluded'); setFCategory(''); setFDescription('')
    setModal(true)
  }

  const openEdit = (p: Product) => {
    setEditing(p)
    setFCode(p.code || ''); setFName(p.name); setFPrice(p.price); setFUnit(p.unit || ''); setFVat(p.vat_type); setFCategory(p.category || ''); setFDescription(p.description || '')
    setModal(true)
  }

  const save = async () => {
    try {
      const payload = { code: fCode || null, name: fName, price: fPrice, unit: fUnit || null, vat_type: fVat, category: fCategory || null, description: fDescription || null }
      if (editing) { await updateProduct(editing.id, payload); toast(t('toast_product_edited')) }
      else { await createProduct(payload); toast(t('toast_product_added')) }
      setModal(false); load()
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  const doDelete = async (id: number) => {
    if (!confirm(t('confirm_delete_product'))) return
    try { await deleteProduct(id); toast(t('toast_product_deleted')); load() }
    catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  const vatBadge = (vt: string): { color: ChipColor; label: string } => {
    if (vt === 'excluded') return { color: 'primary', label: t('vat_excluded') }
    if (vt === 'included') return { color: 'success', label: t('vat_included') }
    return { color: 'default', label: t('vat_none') }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <TextField
          className="w-full sm:max-w-[280px]"
          placeholder={t('search_product')}
          value={search} onChange={e => { setSearch(e.target.value); load(e.target.value) }}
        />
        <Btn variant="primary" onClick={openCreate} className="w-full sm:w-auto">{t('btn_add_product')}</Btn>
      </div>

      <Card className="bg-content1 border border-content3 glow-hover" shadow="none">
        <CardBody className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
          ) : (
            <Table removeWrapper aria-label={t('btn_add_product')}
              classNames={{ th: 'bg-transparent text-default-500 uppercase text-[11px]', td: 'text-[13px]' }}>
              <TableHeader>
                <TableColumn>{t('col_code')}</TableColumn>
                <TableColumn>{t('col_product_name')}</TableColumn>
                <TableColumn>{t('col_price')}</TableColumn>
                <TableColumn>{t('col_unit')}</TableColumn>
                <TableColumn>{t('col_vat')}</TableColumn>
                <TableColumn>{t('col_category')}</TableColumn>
                <TableColumn align="end">{t('col_actions')}</TableColumn>
              </TableHeader>
              <TableBody emptyContent={
                <div className="py-10 text-default-500">
                  <div className="text-4xl mb-3.5 opacity-40">📦</div>
                  <p>{t('no_products')}</p>
                </div>
              }>
                {products.map(p => {
                  const vb = vatBadge(p.vat_type)
                  return (
                    <TableRow key={p.id} className="hover:bg-content2/60 transition-colors">
                      <TableCell className="text-default-500">{p.code || '—'}</TableCell>
                      <TableCell>
                        <div className="font-medium">{p.name}</div>
                        {p.description && <div className="text-[11px] text-default-500 mt-0.5">{p.description}</div>}
                      </TableCell>
                      <TableCell><span className="text-success font-semibold">฿{fmt(p.price)}</span></TableCell>
                      <TableCell className="text-default-500">{p.unit || '—'}</TableCell>
                      <TableCell>
                        <Chip size="sm" variant="flat" color={vb.color}>{vb.label}</Chip>
                      </TableCell>
                      <TableCell className="text-default-500">{p.category || '—'}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Btn size="sm" variant="ghost" onClick={() => openEdit(p)}>{t('btn_edit')}</Btn>
                          <Btn size="sm" variant="danger" onClick={() => doDelete(p.id)}>{t('btn_delete')}</Btn>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} size="xl"
        title={editing ? t('modal_edit_product') : t('modal_new_product')}
        footer={<>
          <Btn variant="ghost" onClick={() => setModal(false)}>{t('btn_cancel')}</Btn>
          <Btn variant="primary" onClick={save}>{t('btn_save')}</Btn>
        </>}>
        <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <TextField label={t('lbl_product_code')}
                    value={fCode} onChange={e => setFCode(e.target.value)} />
                  <TextField label={t('lbl_product_name')}
                    value={fName} onChange={e => setFName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <TextField type="number" label={t('lbl_price')}
                    value={fPrice === 0 ? '' : String(fPrice)} onChange={e => setFPrice(e.target.value === '' ? 0 : Number(e.target.value))} />
                  <TextField label={t('col_unit')}
                    placeholder={t('lbl_unit_size_ph')} value={fUnit} onChange={e => setFUnit(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-default-500 uppercase tracking-wide mb-1.5">{t('lbl_vat_type')}</label>
                    <select value={fVat} onChange={e => setFVat(e.target.value as 'excluded' | 'included' | 'none')} className={SELECT_CLASS}>
                      <option value="excluded">{t('vat_excluded')}</option>
                      <option value="included">{t('vat_included')}</option>
                      <option value="none">{t('vat_none')}</option>
                    </select>
                  </div>
                  <TextField label={t('col_category')}
                    value={fCategory} onChange={e => setFCategory(e.target.value)} />
                </div>
                <TextAreaField label={t('lbl_description')}
                  value={fDescription} onChange={e => setFDescription(e.target.value)} />
        </div>
      </Modal>
    </div>
  )
}
