import Modal from './Modal'
import Btn from './Btn'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  html: string
  onDownload?: () => void
  downloadLabel?: string
  closeLabel?: string
}

export default function PreviewModal({ open, onClose, title, html, onDownload, downloadLabel = 'ดาวน์โหลด PDF', closeLabel = 'ปิด' }: Props) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="4xl"
      footer={<>
        <Btn variant="ghost" onClick={onClose}>{closeLabel}</Btn>
        {onDownload && <Btn variant="primary" onClick={onDownload}>{downloadLabel}</Btn>}
      </>}>
      <div className="bg-default-100 rounded-lg p-2 -m-1">
        <iframe title="document-preview" srcDoc={html} sandbox="allow-same-origin"
          className="w-full h-[80vh] bg-white rounded-md border border-content3" />
      </div>
    </Modal>
  )
}
