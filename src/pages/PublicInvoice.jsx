import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, FileDown, FileX2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { formatMoney, formatDate } from '@/lib/utils';
import { exportInvoicePdf } from '@/lib/pdf';
import Logo from '@/components/Logo';

const SERVICE_LABELS = { installation: 'Installation', repair: 'Repair', maintenance: 'Maintenance', inspection: 'Inspection', duct_cleaning: 'Duct cleaning', other: 'Other' };

export default function PublicInvoice() {
  const { token } = useParams();
  const [data, setData] = useState(undefined);

  useEffect(() => {
    (async () => {
      const { data: result, error } = await supabase.rpc('get_public_invoice', { token });
      setData(error || !result ? null : result);
    })();
  }, [token]);

  if (data === undefined) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (data === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
        <FileX2 className="h-10 w-10 text-muted-foreground" />
        <p className="font-medium">This invoice link isn't valid.</p>
      </div>
    );
  }

  const { job, customer, company, items } = data;
  const currency = company.default_currency || 'USD';
  const subtotal = items.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price), 0);
  const taxAmt = subtotal * (Number(job.tax_rate || 0) / 100);
  const total = subtotal + taxAmt;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-content items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <p className="font-heading font-semibold">{company.company_name || 'Invoice'}</p>
            <p className="text-xs text-muted-foreground">{company.company_address}</p>
          </div>
          <button onClick={() => exportInvoicePdf({ job, items, customer, company })} className="btn-primary"><FileDown className="h-4 w-4" /> Download PDF</button>
        </div>
      </header>

      <div className="mx-auto max-w-content px-4 py-10 sm:px-6">
        <div className="card-soft p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">Invoice</p>
              <h1 className="mt-1 font-display text-2xl font-bold">{job.title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{customer.name} · {SERVICE_LABELS[job.service_type]} · {formatDate(job.scheduled_date)}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${job.invoice_status === 'paid' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-accent/15 text-accent'}`}>
              {job.invoice_status === 'paid' ? 'Paid' : 'Unpaid'}
            </span>
          </div>
        </div>

        <div className="card-soft mt-5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Description</th>
                  <th className="px-2 py-2 font-medium">Qty</th>
                  <th className="px-2 py-2 font-medium">Unit price</th>
                  <th className="px-2 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} className="border-b border-border last:border-0">
                    <td className="px-4 py-2">{item.description}</td>
                    <td className="px-2 py-2">{item.quantity}</td>
                    <td className="px-2 py-2">{formatMoney(item.unit_price, currency)}</td>
                    <td className="px-2 py-2 text-right font-medium">{formatMoney(Number(item.quantity) * Number(item.unit_price), currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <div className="w-full max-w-xs space-y-2 rounded-2xl border border-border bg-card p-5">
            <div className="flex justify-between text-sm text-muted-foreground"><span>Subtotal</span><span>{formatMoney(subtotal, currency)}</span></div>
            {job.tax_rate > 0 && <div className="flex justify-between text-sm text-muted-foreground"><span>Tax / VAT ({job.tax_rate}%)</span><span>{formatMoney(taxAmt, currency)}</span></div>}
            <div className="flex justify-between border-t border-border pt-2 font-display text-lg font-bold"><span>Total due</span><span>{formatMoney(total, currency)}</span></div>
          </div>
        </div>

        {job.notes && (
          <div className="card-soft mt-6 p-5">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Notes</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{job.notes}</p>
          </div>
        )}

        <div className="mt-10 flex justify-center opacity-60"><Logo size={16} /></div>
      </div>
    </div>
  );
}
