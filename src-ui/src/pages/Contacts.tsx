import { useEffect, useState } from 'react'
import {
  Avatar, Card, CardBody, Chip, Spinner,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
} from '@heroui/react'
import { TextField, TextAreaField } from '../ui/Field'
import { useI18n } from '../i18n'
import { useToast } from '../App'
import { getContacts, createContact, updateContact, deleteContact } from '../api'
import type { Contact } from '../types'
import Btn from '../ui/Btn'
import Modal from '../ui/Modal'

const SELECT_CLASS = 'w-full bg-content2 border border-content3 rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary transition-colors cursor-pointer [color-scheme:dark]'

export default function Contacts() {
  const { t } = useI18n()
  const { toast } = useToast()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Contact | null>(null)

  // Form
  const [fType, setFType] = useState<'customer' | 'vendor'>('customer')
  const [fName, setFName] = useState('')
  const [fCompany, setFCompany] = useState('')
  const [fTax, setFTax] = useState('')
  const [fBranch, setFBranch] = useState('')
  const [fEmail, setFEmail] = useState('')
  const [fPhone, setFPhone] = useState('')
  const [fAddress, setFAddress] = useState('')
  const [fNote, setFNote] = useState('')

  const load = async (q?: string) => {
    setLoading(true)
    try { const { data } = await getContacts(q || search); setContacts(data) } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditing(null)
    setFType('customer'); setFName(''); setFCompany(''); setFTax(''); setFBranch(''); setFEmail(''); setFPhone(''); setFAddress(''); setFNote('')
    setModal(true)
  }

  const openEdit = (c: Contact) => {
    setEditing(c)
    setFType(c.type); setFName(c.name); setFCompany(c.company || ''); setFTax(c.tax_id || ''); setFBranch(c.branch || ''); setFEmail(c.email || ''); setFPhone(c.phone || ''); setFAddress(c.address || ''); setFNote(c.note || '')
    setModal(true)
  }

  const save = async () => {
    try {
      const payload = { type: fType, name: fName, company: fCompany || null, tax_id: fTax || null, branch: fBranch || null, email: fEmail || null, phone: fPhone || null, address: fAddress || null, note: fNote || null }
      if (editing) { await updateContact(editing.id, payload); toast(t('toast_contact_edited')) }
      else { await createContact(payload); toast(t('toast_contact_added')) }
      setModal(false); load()
    } catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  const doDelete = async (id: number) => {
    if (!confirm(t('confirm_delete_contact'))) return
    try { await deleteContact(id); toast(t('toast_contact_deleted')); load() }
    catch (e: unknown) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <TextField
          className="max-w-[280px]"
          placeholder={t('search_contact')}
          value={search} onChange={e => { setSearch(e.target.value); load(e.target.value) }}
        />
        <Btn variant="primary" onClick={openCreate}>{t('btn_add_contact')}</Btn>
      </div>

      <Card className="bg-content1 border border-content3" shadow="none">
        <CardBody className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
          ) : (
            <Table removeWrapper aria-label={t('btn_add_contact')}
              classNames={{ th: 'bg-transparent text-default-500 uppercase text-[11px]', td: 'text-[13px]' }}>
              <TableHeader>
                <TableColumn>{t('col_name')}</TableColumn>
                <TableColumn>{t('lbl_type')}</TableColumn>
                <TableColumn>{t('col_tax_id')}</TableColumn>
                <TableColumn>{t('col_email')}</TableColumn>
                <TableColumn>{t('col_phone')}</TableColumn>
                <TableColumn align="end">{t('col_actions')}</TableColumn>
              </TableHeader>
              <TableBody emptyContent={
                <div className="py-10 text-default-500">
                  <div className="text-4xl mb-3.5 opacity-40">👥</div>
                  <p>{t('no_contacts')}</p>
                </div>
              }>
                {contacts.map(c => (
                  <TableRow key={c.id} className="hover:bg-content2/60 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={(c.name || '?').charAt(0).toUpperCase()} size="sm"
                          classNames={{ base: 'bg-primary/15 flex-shrink-0', name: 'text-primary font-bold text-xs' }} />
                        <div>
                          <div className="font-medium">{c.name}</div>
                          {c.company && <div className="text-[11px] text-default-500">{c.company}</div>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Chip size="sm" variant="flat" color={c.type === 'customer' ? 'secondary' : 'warning'}>
                        {c.type === 'customer' ? t('contact_customer') : t('contact_vendor')}
                      </Chip>
                    </TableCell>
                    <TableCell className="text-default-500">{c.tax_id || '—'}</TableCell>
                    <TableCell className="text-default-500">{c.email || '—'}</TableCell>
                    <TableCell className="text-default-500">{c.phone || '—'}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Btn size="sm" variant="ghost" onClick={() => openEdit(c)}>{t('btn_edit')}</Btn>
                        <Btn size="sm" variant="danger" onClick={() => doDelete(c.id)}>{t('btn_delete')}</Btn>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} size="xl"
        title={editing ? t('modal_edit_contact') : t('modal_new_contact')}
        footer={<>
          <Btn variant="ghost" onClick={() => setModal(false)}>{t('btn_cancel')}</Btn>
          <Btn variant="primary" onClick={save}>{t('btn_save')}</Btn>
        </>}>
        <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-default-500 uppercase tracking-wide mb-1.5">{t('lbl_type')}</label>
                    <select value={fType} onChange={e => setFType(e.target.value as 'customer' | 'vendor')} className={SELECT_CLASS}>
                      <option value="customer">{t('contact_customer')}</option>
                      <option value="vendor">{t('contact_vendor')}</option>
                    </select>
                  </div>
                  <TextField label={t('lbl_name')}
                    placeholder={t('lbl_name_ph')} value={fName} onChange={e => setFName(e.target.value)} />
                </div>
                <TextField label={t('lbl_contact_company')} placeholder={t('lbl_contact_company_ph')}
                  value={fCompany} onChange={e => setFCompany(e.target.value)} />
                <div className="grid grid-cols-2 gap-4">
                  <TextField label={t('col_tax_id')}
                    value={fTax} onChange={e => setFTax(e.target.value)} />
                  <TextField label={t('lbl_branch')}
                    placeholder={t('lbl_branch_ph')} value={fBranch} onChange={e => setFBranch(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <TextField type="email" label={t('lbl_email')}
                    value={fEmail} onChange={e => setFEmail(e.target.value)} />
                  <TextField label={t('lbl_phone')}
                    value={fPhone} onChange={e => setFPhone(e.target.value)} />
                </div>
                <TextAreaField label={t('lbl_address')}
                  value={fAddress} onChange={e => setFAddress(e.target.value)} />
                <TextAreaField label={t('lbl_note')}
                  value={fNote} onChange={e => setFNote(e.target.value)} />
        </div>
      </Modal>
    </div>
  )
}
