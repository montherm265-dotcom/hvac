import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatMoney, formatDate } from '@/lib/utils';

const TEAL = [20, 75, 82];
const ORANGE = [227, 90, 31];
const GRAY = [110, 118, 133];

/** Renders a job invoice to a downloadable PDF. */
export function exportInvoicePdf({ job, items, customer, company }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  const currency = company?.default_currency || 'USD';

  doc.setFillColor(...TEAL);
  doc.rect(0, 0, pageWidth, 90, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(company?.company_name || 'Invoice', margin, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(company?.company_address || '', margin, 58);
  doc.text(company?.company_phone || '', margin, 72);

  doc.setFontSize(10);
  doc.text('INVOICE', pageWidth - margin, 40, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(job.title || 'Service job', pageWidth - margin, 58, { align: 'right' });

  let y = 115;
  doc.setTextColor(...TEAL);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Billed to', margin, y);
  doc.text('Service date', pageWidth - margin, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  y += 14;
  doc.text(customer?.name || '—', margin, y);
  doc.text(formatDate(job.scheduled_date), pageWidth - margin, y, { align: 'right' });
  y += 14;
  if (customer?.address) doc.text(customer.address, margin, y);
  doc.text(`Status: ${job.invoice_status === 'paid' ? 'PAID' : 'UNPAID'}`, pageWidth - margin, y, { align: 'right' });

  y += 26;

  const rows = items.map((item, idx) => [
    idx + 1,
    item.description,
    Number(item.quantity || 0).toLocaleString(),
    formatMoney(item.unit_price, currency),
    formatMoney(Number(item.quantity || 0) * Number(item.unit_price || 0), currency),
  ]);
  const subtotal = items.reduce((sum, i) => sum + Number(i.quantity || 0) * Number(i.unit_price || 0), 0);
  const taxRate = Number(job.tax_rate || 0);
  const taxAmt = subtotal * (taxRate / 100);
  const total = subtotal + taxAmt;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['#', 'Description', 'Qty', 'Unit price', 'Amount']],
    body: rows,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 6, textColor: [30, 35, 45] },
    headStyles: { fillColor: [222, 236, 236], textColor: TEAL, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 24 }, 2: { halign: 'right', cellWidth: 55 }, 3: { halign: 'right', cellWidth: 80 }, 4: { halign: 'right', cellWidth: 90 } },
  });
  y = doc.lastAutoTable.finalY + 20;

  const totalsX = pageWidth - margin - 220;
  doc.setFontSize(10);
  doc.setTextColor(...GRAY);
  doc.text('Subtotal', totalsX, y);
  doc.text(formatMoney(subtotal, currency), pageWidth - margin, y, { align: 'right' });
  if (taxRate > 0) {
    y += 16;
    doc.text(`Tax / VAT (${taxRate}%)`, totalsX, y);
    doc.text(formatMoney(taxAmt, currency), pageWidth - margin, y, { align: 'right' });
  }
  y += 12;
  doc.setDrawColor(...ORANGE);
  doc.setLineWidth(1.5);
  doc.line(totalsX, y, pageWidth - margin, y);
  y += 18;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...TEAL);
  doc.text('Total due', totalsX, y);
  doc.text(formatMoney(total, currency), pageWidth - margin, y, { align: 'right' });

  if (job.notes) {
    y += 40;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Notes', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    y += 14;
    doc.text(doc.splitTextToSize(job.notes, pageWidth - margin * 2), margin, y);
  }

  doc.save(`invoice-${(job.title || 'job').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`);
}
