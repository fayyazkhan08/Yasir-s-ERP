// import PDFDocument from 'pdfkit';
// import { Response } from 'express';

// interface InvoiceItemRow {
//   description: string;
//   hsn_code?: string;
//   quantity: number;
//   unit_price: number;
//   gst_rate: number;
//   line_total: number;
// }

// interface InvoiceData {
//   invoice_no: string;
//   invoice_date: string;
//   invoice_type: 'gst' | 'non_gst';
//   status: string;
//   customer_name: string;
//   customer_mobile: string;
//   customer_email?: string;
//   customer_gstin?: string;
//   customer_address?: string;
//   subtotal: number;
//   cgst_amount: number;
//   sgst_amount: number;
//   igst_amount: number;
//   discount_amount: number;
//   reward_applied: number;
//   total_amount: number;
//   items: InvoiceItemRow[];
// }

// const COMPANY = {
//   name: process.env.COMPANY_NAME || 'Your Company Pvt Ltd',
//   gstin: process.env.COMPANY_GSTIN || '',
//   address: process.env.COMPANY_ADDRESS || '',
//   state: process.env.COMPANY_STATE || '',
// };

// /** Streams a formatted invoice PDF directly to the HTTP response. */
// export function streamInvoicePdf(res: Response, invoice: InvoiceData) {
//   const doc = new PDFDocument({ margin: 40, size: 'A4' });
//   res.setHeader('Content-Type', 'application/pdf');
//   res.setHeader('Content-Disposition', `attachment; filename=${invoice.invoice_no}.pdf`);
//   doc.pipe(res);

//   // Header
//   doc.fontSize(18).fillColor('#0F6B5C').text(COMPANY.name, { continued: false });
//   doc.fontSize(9).fillColor('#555').text(COMPANY.address);
//   if (invoice.invoice_type === 'gst' && COMPANY.gstin) {
//     doc.text(`GSTIN: ${COMPANY.gstin}  |  State: ${COMPANY.state}`);
//   }
//   doc.moveDown(0.5);
//   doc
//     .strokeColor('#E2E6EA')
//     .lineWidth(1)
//     .moveTo(40, doc.y)
//     .lineTo(555, doc.y)
//     .stroke();
//   doc.moveDown(0.8);

//   // Invoice meta + bill-to
//   const topY = doc.y;
//   doc.fontSize(14).fillColor('#111').text(invoice.invoice_type === 'gst' ? 'TAX INVOICE' : 'INVOICE', 40, topY);
//   doc.fontSize(9).fillColor('#333');
//   doc.text(`Invoice No: ${invoice.invoice_no}`, 40, topY + 20);
//   doc.text(`Date: ${invoice.invoice_date}`, 40, topY + 34);
//   doc.text(`Status: ${invoice.status.toUpperCase()}`, 40, topY + 48);

//   doc.fontSize(10).fillColor('#111').text('Bill To:', 320, topY, { align: 'left' });
//   doc.fontSize(9).fillColor('#333');
//   doc.text(invoice.customer_name, 320, topY + 14);
//   doc.text(invoice.customer_mobile, 320, topY + 28);
//   if (invoice.customer_email) doc.text(invoice.customer_email, 320, topY + 42);
//   if (invoice.customer_gstin) doc.text(`GSTIN: ${invoice.customer_gstin}`, 320, topY + 56);
//   if (invoice.customer_address) doc.text(invoice.customer_address, 320, topY + 70, { width: 200 });

//   doc.moveDown(4);

//   // Items table header
//   const tableTop = doc.y + 10;
//   const cols = invoice.invoice_type === 'gst'
//     ? [40, 200, 250, 300, 350, 410, 470]   // desc, hsn, qty, price, gst%, total
//     : [40, 260, 340, 420, 470];

//   doc.fontSize(9).fillColor('#fff');
//   doc.rect(40, tableTop, 515, 20).fill('#0F6B5C');
//   doc.fillColor('#fff');
//   if (invoice.invoice_type === 'gst') {
//     doc.text('Description', cols[0] + 4, tableTop + 6, { width: 150 });
//     doc.text('HSN', cols[1] + 4, tableTop + 6, { width: 45 });
//     doc.text('Qty', cols[2] + 4, tableTop + 6, { width: 45 });
//     doc.text('Price', cols[3] + 4, tableTop + 6, { width: 55 });
//     doc.text('GST%', cols[4] + 4, tableTop + 6, { width: 45 });
//     doc.text('Total', cols[5] + 4, tableTop + 6, { width: 75 });
//   } else {
//     doc.text('Description', cols[0] + 4, tableTop + 6, { width: 200 });
//     doc.text('Qty', cols[1] + 4, tableTop + 6, { width: 70 });
//     doc.text('Price', cols[2] + 4, tableTop + 6, { width: 70 });
//     doc.text('Total', cols[3] + 4, tableTop + 6, { width: 90 });
//   }

//   let y = tableTop + 24;
//   doc.fillColor('#222').fontSize(9);
//   invoice.items.forEach((item, idx) => {
//     if (idx % 2 === 1) doc.rect(40, y - 3, 515, 18).fill('#F7F8FA').fillColor('#222');
//     if (invoice.invoice_type === 'gst') {
//       doc.text(item.description, cols[0] + 4, y, { width: 150 });
//       doc.text(item.hsn_code || '-', cols[1] + 4, y, { width: 45 });
//       doc.text(String(item.quantity), cols[2] + 4, y, { width: 45 });
//       doc.text(item.unit_price.toFixed(2), cols[3] + 4, y, { width: 55 });
//       doc.text(`${item.gst_rate}%`, cols[4] + 4, y, { width: 45 });
//       doc.text(item.line_total.toFixed(2), cols[5] + 4, y, { width: 75 });
//     } else {
//       doc.text(item.description, cols[0] + 4, y, { width: 200 });
//       doc.text(String(item.quantity), cols[1] + 4, y, { width: 70 });
//       doc.text(item.unit_price.toFixed(2), cols[2] + 4, y, { width: 70 });
//       doc.text(item.line_total.toFixed(2), cols[3] + 4, y, { width: 90 });
//     }
//     y += 20;
//   });

//   doc.moveTo(40, y).lineTo(555, y).strokeColor('#E2E6EA').stroke();
//   y += 10;

//   // Totals block
//   const totalsX = 380;
//   const line = (label: string, value: number, bold = false) => {
//     doc.fontSize(bold ? 11 : 9).fillColor(bold ? '#0F6B5C' : '#333');
//     doc.text(label, totalsX, y, { width: 100 });
//     doc.text(`₹ ${value.toFixed(2)}`, totalsX + 100, y, { width: 75, align: 'right' });
//     y += bold ? 18 : 14;
//   };
//   line('Subtotal', invoice.subtotal);
//   if (invoice.invoice_type === 'gst') {
//     if (invoice.cgst_amount) line('CGST', invoice.cgst_amount);
//     if (invoice.sgst_amount) line('SGST', invoice.sgst_amount);
//     if (invoice.igst_amount) line('IGST', invoice.igst_amount);
//   }
//   if (invoice.discount_amount) line('Discount', -invoice.discount_amount);
//   if (invoice.reward_applied) line('Referral Reward', -invoice.reward_applied);
//   line('Total Amount', invoice.total_amount, true);

//   doc.moveDown(3);
//   doc.fontSize(8).fillColor('#888').text('This is a system-generated invoice.', 40, 750, { align: 'center', width: 515 });

//   doc.end();
// }


import PDFDocument from 'pdfkit';
import { Response } from 'express';

interface InvoiceItemRow {
  description: string;
  comment?: string;
  hsn_code?: string;
  quantity: number;
  unit?: string;
  unit_price: number;
  gst_rate: number;
  line_total: number;
}

interface InvoiceData {
  invoice_no: string;
  invoice_date: string;
  invoice_type: 'gst' | 'non_gst';
  status: string;
  customer_name: string;
  customer_mobile: string;
  customer_email?: string;
  customer_gstin?: string;
  customer_address?: string;
  subtotal: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  discount_amount: number;
  reward_applied: number;
  total_amount: number;
  items: InvoiceItemRow[];
}

const COMPANY = {
  name: process.env.COMPANY_NAME || 'Your Company Pvt Ltd',
  gstin: process.env.COMPANY_GSTIN || '',
  address: process.env.COMPANY_ADDRESS || '',
  state: process.env.COMPANY_STATE || '',
};

/** Streams a formatted invoice PDF directly to the HTTP response. */
export function streamInvoicePdf(res: Response, invoice: InvoiceData) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${invoice.invoice_no}.pdf`);
  doc.pipe(res);

  // Header
  doc.fontSize(18).fillColor('#0F6B5C').text(COMPANY.name, { continued: false });
  doc.fontSize(9).fillColor('#555').text(COMPANY.address);
  if (invoice.invoice_type === 'gst' && COMPANY.gstin) {
    doc.text(`GSTIN: ${COMPANY.gstin}  |  State: ${COMPANY.state}`);
  }
  doc.moveDown(0.5);
  doc
    .strokeColor('#E2E6EA')
    .lineWidth(1)
    .moveTo(40, doc.y)
    .lineTo(555, doc.y)
    .stroke();
  doc.moveDown(0.8);

  // Invoice meta + bill-to
  const topY = doc.y;
  doc.fontSize(14).fillColor('#111').text(invoice.invoice_type === 'gst' ? 'TAX INVOICE' : 'INVOICE', 40, topY);
  doc.fontSize(9).fillColor('#333');
  doc.text(`Invoice No: ${invoice.invoice_no}`, 40, topY + 20);
  doc.text(`Date: ${invoice.invoice_date}`, 40, topY + 34);
  doc.text(`Status: ${invoice.status.toUpperCase()}`, 40, topY + 48);

  doc.fontSize(10).fillColor('#111').text('Bill To:', 320, topY, { align: 'left' });
  doc.fontSize(9).fillColor('#333');
  doc.text(invoice.customer_name, 320, topY + 14);
  doc.text(invoice.customer_mobile, 320, topY + 28);
  if (invoice.customer_email) doc.text(invoice.customer_email, 320, topY + 42);
  if (invoice.customer_gstin) doc.text(`GSTIN: ${invoice.customer_gstin}`, 320, topY + 56);
  if (invoice.customer_address) doc.text(invoice.customer_address, 320, topY + 70, { width: 200 });

  doc.moveDown(4);

  // Items table header
  const tableTop = doc.y + 10;
  const isGst = invoice.invoice_type === 'gst';
  // Column x-positions and widths. Qty is wide enough for "10 SQ FT." etc.
  const C = isGst
    ? { desc: [40, 150], hsn: [190, 45], qty: [235, 70], price: [305, 55], gst: [360, 45], total: [405, 150] }
    : { desc: [40, 230], hsn: [0, 0], qty: [270, 90], price: [360, 80], gst: [0, 0], total: [440, 115] };
  const cell = (c: number[], text: string, yy: number, opts: any = {}) =>
    doc.text(text, c[0] + 4, yy, { width: c[1] - 8, ...opts });

  doc.fontSize(9).fillColor('#fff');
  doc.rect(40, tableTop, 515, 20).fill('#0F6B5C');
  doc.fillColor('#fff');
  cell(C.desc, 'Description', tableTop + 6);
  if (isGst) cell(C.hsn, 'HSN', tableTop + 6);
  cell(C.qty, 'Qty', tableTop + 6);
  cell(C.price, 'Price', tableTop + 6);
  if (isGst) cell(C.gst, 'GST%', tableTop + 6);
  cell(C.total, 'Total', tableTop + 6);

  const fmtQty = (n: number) => String(Number(n));

  let y = tableTop + 24;
  doc.fillColor('#222').fontSize(9);
  invoice.items.forEach((item, idx) => {
    const rowH = item.comment ? 30 : 18;
    if (y + rowH > 730) { doc.addPage(); y = 50; doc.fillColor('#222').fontSize(9); }
    if (idx % 2 === 1) doc.rect(40, y - 3, 515, rowH).fill('#F7F8FA').fillColor('#222');
    doc.fontSize(9).fillColor('#222');
    cell(C.desc, item.description, y, { height: 12, ellipsis: true });
    if (item.comment) {
      doc.fontSize(7.5).fillColor('#777');
      cell(C.desc, item.comment, y + 11, { height: 10, ellipsis: true });
      doc.fontSize(9).fillColor('#222');
    }
    if (isGst) cell(C.hsn, item.hsn_code || '-', y);
    cell(C.qty, `${fmtQty(item.quantity)}${item.unit ? ' ' + item.unit : ''}`, y);
    cell(C.price, item.unit_price.toFixed(2), y);
    if (isGst) cell(C.gst, `${item.gst_rate}%`, y);
    cell(C.total, item.line_total.toFixed(2), y);
    y += rowH + 2;
  });

  doc.moveTo(40, y).lineTo(555, y).strokeColor('#E2E6EA').stroke();
  y += 10;

  // Totals block
  const totalsX = 380;
  const line = (label: string, value: number, bold = false) => {
    doc.fontSize(bold ? 11 : 9).fillColor(bold ? '#0F6B5C' : '#333');
    doc.text(label, totalsX, y, { width: 100 });
    doc.text(`₹ ${value.toFixed(2)}`, totalsX + 100, y, { width: 75, align: 'right' });
    y += bold ? 18 : 14;
  };
  line('Subtotal', invoice.subtotal);
  if (invoice.invoice_type === 'gst') {
    if (invoice.cgst_amount) line('CGST', invoice.cgst_amount);
    if (invoice.sgst_amount) line('SGST', invoice.sgst_amount);
    if (invoice.igst_amount) line('IGST', invoice.igst_amount);
  }
  if (invoice.discount_amount) line('Discount', -invoice.discount_amount);
  if (invoice.reward_applied) line('Referral Reward', -invoice.reward_applied);
  line('Total Amount', invoice.total_amount, true);

  doc.moveDown(3);
  doc.fontSize(8).fillColor('#888').text('This is a system-generated invoice.', 40, 750, { align: 'center', width: 515 });

  doc.end();
}