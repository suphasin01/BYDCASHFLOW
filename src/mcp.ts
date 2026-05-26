#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { contactRepo, productRepo, documentRepo, paymentRepo, businessRepo, reportRepo } from './db';

const server = new Server(
  { name: 'local-api', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// ── Tool definitions ──────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    // Contacts
    { name: 'list_contacts',  description: 'ดูรายชื่อลูกค้า/ผู้ขายทั้งหมด', inputSchema: { type: 'object', properties: { type: { type: 'string', enum: ['customer','vendor'], description: 'กรองตามประเภท' }, q: { type: 'string', description: 'ค้นหาชื่อ/เลขภาษี/อีเมล' } } } },
    { name: 'get_contact',    description: 'ดูข้อมูล contact ตาม ID', inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'number' } } } },
    { name: 'create_contact', description: 'สร้าง contact ใหม่', inputSchema: { type: 'object', required: ['name'], properties: { type: { type: 'string', enum: ['customer','vendor'], default: 'customer' }, name: { type: 'string' }, tax_id: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' }, address: { type: 'string' }, branch: { type: 'string' }, note: { type: 'string' } } } },
    { name: 'update_contact', description: 'แก้ไข contact', inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'number' }, type: { type: 'string' }, name: { type: 'string' }, tax_id: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' }, address: { type: 'string' } } } },
    { name: 'delete_contact', description: 'ลบ contact', inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'number' } } } },

    // Products
    { name: 'list_products',  description: 'ดูรายการสินค้า/บริการทั้งหมด', inputSchema: { type: 'object', properties: { q: { type: 'string', description: 'ค้นหาชื่อ/รหัส' } } } },
    { name: 'get_product',    description: 'ดูข้อมูลสินค้าตาม ID', inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'number' } } } },
    { name: 'create_product', description: 'สร้างสินค้า/บริการใหม่', inputSchema: { type: 'object', required: ['name','price'], properties: { code: { type: 'string' }, name: { type: 'string' }, description: { type: 'string' }, unit: { type: 'string' }, price: { type: 'number' }, vat_type: { type: 'string', enum: ['included','excluded','none'], default: 'excluded' }, category: { type: 'string' } } } },
    { name: 'update_product', description: 'แก้ไขสินค้า', inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'number' }, code: { type: 'string' }, name: { type: 'string' }, price: { type: 'number' }, unit: { type: 'string' } } } },
    { name: 'delete_product', description: 'ลบสินค้า', inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'number' } } } },

    // Documents
    { name: 'list_documents',  description: 'ดูรายการเอกสารทั้งหมด', inputSchema: { type: 'object', properties: { type: { type: 'string', enum: ['quotation','invoice','receipt','billing_note','cash_invoice','purchase_order','expense'] }, status: { type: 'string', enum: ['draft','sent','approved','paid','cancelled'] }, contact_id: { type: 'number' }, limit: { type: 'number', default: 50 }, offset: { type: 'number', default: 0 } } } },
    { name: 'get_document',    description: 'ดูรายละเอียดเอกสารตาม ID (รวม items และ payments)', inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'number' } } } },
    { name: 'create_document', description: 'สร้างเอกสารใหม่', inputSchema: { type: 'object', required: ['type'], properties: { type: { type: 'string', enum: ['quotation','invoice','receipt','billing_note','cash_invoice','purchase_order','expense'] }, number: { type: 'string', description: 'เลขที่เอกสาร (ถ้าไม่ระบุจะสร้างอัตโนมัติ)' }, contact_id: { type: 'number' }, contact_name: { type: 'string' }, date: { type: 'string', description: 'YYYY-MM-DD' }, due_date: { type: 'string', description: 'YYYY-MM-DD' }, status: { type: 'string', default: 'draft' }, subtotal: { type: 'number', default: 0 }, discount: { type: 'number', default: 0 }, vat: { type: 'number', default: 0 }, total: { type: 'number', default: 0 }, notes: { type: 'string' }, items: { type: 'array', items: { type: 'object', properties: { description: { type: 'string' }, qty: { type: 'number' }, unit: { type: 'string' }, price: { type: 'number' }, discount: { type: 'number' }, amount: { type: 'number' } } } } } } },
    { name: 'update_document', description: 'แก้ไขเอกสาร', inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'number' }, status: { type: 'string' }, due_date: { type: 'string' }, notes: { type: 'string' }, items: { type: 'array' } } } },
    { name: 'update_document_status', description: 'เปลี่ยนสถานะเอกสาร', inputSchema: { type: 'object', required: ['id','status'], properties: { id: { type: 'number' }, status: { type: 'string', enum: ['draft','sent','approved','paid','cancelled'] } } } },
    { name: 'delete_document', description: 'ลบเอกสาร', inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'number' } } } },

    // Payments
    { name: 'list_payments',  description: 'ดูประวัติการชำระเงิน', inputSchema: { type: 'object', properties: { document_id: { type: 'number' } } } },
    { name: 'record_payment', description: 'บันทึกการชำระเงิน', inputSchema: { type: 'object', required: ['document_id','amount'], properties: { document_id: { type: 'number' }, amount: { type: 'number' }, date: { type: 'string', description: 'YYYY-MM-DD' }, method: { type: 'string', enum: ['cash','transfer','cheque','credit_card'], default: 'transfer' }, reference: { type: 'string' }, notes: { type: 'string' } } } },
    { name: 'delete_payment', description: 'ลบการชำระเงิน', inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'number' } } } },

    // Business
    { name: 'get_business_info',    description: 'ดูข้อมูลธุรกิจ', inputSchema: { type: 'object', properties: {} } },
    { name: 'update_business_info', description: 'อัปเดตข้อมูลธุรกิจ', inputSchema: { type: 'object', properties: { name: { type: 'string' }, tax_id: { type: 'string' }, address: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' }, website: { type: 'string' } } } },

    // Reports
    { name: 'get_summary_report',   description: 'ดูรายงานสรุป รายได้ ค่าใช้จ่าย กำไร', inputSchema: { type: 'object', properties: { period: { type: 'string', description: 'YYYY-MM เช่น 2024-01' } } } },
    { name: 'get_monthly_report',   description: 'ดูรายงานรายเดือนทั้งปี', inputSchema: { type: 'object', properties: { year: { type: 'number', description: 'ปี เช่น 2024' } } } },
    { name: 'get_top_contacts',     description: 'ดูลูกค้า/ผู้ขายที่มียอดสูงสุด', inputSchema: { type: 'object', properties: { limit: { type: 'number', default: 10 } } } },
  ],
}));

// ── Tool handlers ─────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  const a = (args ?? {}) as Record<string, unknown>;

  try {
    let result: unknown;

    switch (name) {
      // Contacts
      case 'list_contacts':  result = contactRepo.list(a.q ? undefined : a.type as string | undefined); if (a.q) result = contactRepo.search(a.q as string); break;
      case 'get_contact':    result = contactRepo.get(Number(a.id)); break;
      case 'create_contact': result = contactRepo.create(a); break;
      case 'update_contact': { const { id, ...data } = a; result = contactRepo.update(Number(id), data); break; }
      case 'delete_contact': result = contactRepo.delete(Number(a.id)); break;

      // Products
      case 'list_products':  result = a.q ? productRepo.search(a.q as string) : productRepo.list(); break;
      case 'get_product':    result = productRepo.get(Number(a.id)); break;
      case 'create_product': result = productRepo.create(a); break;
      case 'update_product': { const { id, ...data } = a; result = productRepo.update(Number(id), data); break; }
      case 'delete_product': result = productRepo.delete(Number(a.id)); break;

      // Documents
      case 'list_documents':  result = documentRepo.list({ type: a.type as string, status: a.status as string, contact_id: a.contact_id ? Number(a.contact_id) : undefined, limit: a.limit ? Number(a.limit) : 50, offset: a.offset ? Number(a.offset) : 0 }); break;
      case 'get_document':    result = documentRepo.get(Number(a.id)); break;
      case 'create_document': { const { items, ...docData } = a; result = documentRepo.create(docData, (items as Record<string, unknown>[]) ?? []); break; }
      case 'update_document': { const { id, items, ...data } = a; result = documentRepo.update(Number(id), data, items as Record<string, unknown>[] | undefined); break; }
      case 'update_document_status': result = documentRepo.updateStatus(Number(a.id), a.status as string); break;
      case 'delete_document': result = documentRepo.delete(Number(a.id)); break;

      // Payments
      case 'list_payments':  result = paymentRepo.list(a.document_id ? Number(a.document_id) : undefined); break;
      case 'record_payment': result = paymentRepo.create(a); break;
      case 'delete_payment': result = paymentRepo.delete(Number(a.id)); break;

      // Business
      case 'get_business_info':    result = businessRepo.get(); break;
      case 'update_business_info': result = businessRepo.update(a); break;

      // Reports
      case 'get_summary_report': result = reportRepo.summary(a.period as string | undefined); break;
      case 'get_monthly_report': result = reportRepo.monthly(a.year ? Number(a.year) : undefined); break;
      case 'get_top_contacts':   result = reportRepo.topContacts(a.limit ? Number(a.limit) : 10); break;

      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (err: unknown) {
    return {
      content: [{ type: 'text', text: `Error: ${String(err)}` }],
      isError: true,
    };
  }
});

// ── Start ────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Local API MCP server started');
}

main().catch(console.error);
