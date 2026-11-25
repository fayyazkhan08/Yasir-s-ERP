// import { useState } from 'react';
// import { usePaginatedList } from '../hooks/usePaginatedList';
// import { useDebounce } from '../hooks/useDebounce';
// import { DataTable, Column } from '../components/common/DataTable';
// import { StatusBadge } from '../components/common/StatusBadge';
// import { Invoice } from '../types';
// import { api } from '../api/client';
// import { InvoiceFormModal } from '../components/billing/InvoiceFormModal';

// function formatCurrency(n: number) {
//   return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
// }

// export function BillingPage() {
//   const [search, setSearch] = useState('');
//   const [status, setStatus] = useState('');
//   const [invoiceType, setInvoiceType] = useState('');
//   const debouncedSearch = useDebounce(search);

//   const { rows, pagination, page, setPage, sortBy, sortDir, handleSort, loading, refresh } =
//     usePaginatedList<Invoice>({
//       endpoint: '/invoices',
//       filters: { search: debouncedSearch, status, invoice_type: invoiceType },
//       defaultSortBy: 'invoice_date',
//     });

//   const [modalOpen, setModalOpen] = useState(false);

//   const downloadPdf = (invoiceId: number, invoiceNo: string) => {
//     api.get(`/invoices/${invoiceId}/pdf`, { responseType: 'blob' }).then((res) => {
//       const url = window.URL.createObjectURL(new Blob([res.data]));
//       const link = document.createElement('a');
//       link.href = url;
//       link.download = `${invoiceNo}.pdf`;
//       link.click();
//       window.URL.revokeObjectURL(url);
//     });
//   };

//   const columns: Column<Invoice>[] = [
//     { key: 'invoice_no', header: 'Invoice #', sortable: true, render: (i) => <span className="mono" style={{ fontWeight: 600 }}>{i.invoice_no}</span> },
//     { key: 'customer_name', header: 'Customer', render: (i) => (
//       <div>
//         <div style={{ fontWeight: 600 }}>{i.customer_name}</div>
//         <div className="text-muted mono" style={{ fontSize: 11.5 }}>{i.customer_mobile}</div>
//       </div>
//     ) },
//     { key: 'invoice_type', header: 'Type', render: (i) => (
//       <span className={`badge ${i.invoice_type === 'gst' ? 'badge-primary' : 'badge-neutral'}`}>
//         {i.invoice_type === 'gst' ? 'GST' : 'Non-GST'}
//       </span>
//     ) },
//     { key: 'invoice_date', header: 'Date', sortable: true, render: (i) => new Date(i.invoice_date).toLocaleDateString('en-IN') },
//     { key: 'total_amount', header: 'Total', sortable: true, align: 'right', render: (i) => <span className="mono" style={{ fontWeight: 600 }}>{formatCurrency(i.total_amount)}</span> },
//     { key: 'status', header: 'Status', render: (i) => <StatusBadge status={i.status} /> },
//     { key: 'actions', header: '', align: 'right', render: (i) => (
//       <button className="btn btn-secondary btn-sm" onClick={() => downloadPdf(i.id, i.invoice_no)}>⬇ PDF</button>
//     ) },
//   ];

//   return (
//     <div className="card">
//       <div className="table-toolbar">
//         <div className="flex gap-2" style={{ flex: 1, maxWidth: 560, flexWrap: 'wrap' }}>
//           <div className="input-group" style={{ flex: 1, minWidth: 200 }}>
//             <span className="input-icon">🔍</span>
//             <input className="input" placeholder="Search invoice # or customer…" value={search} onChange={(e) => setSearch(e.target.value)} />
//           </div>
//           <select className="select" style={{ width: 130 }} value={invoiceType} onChange={(e) => setInvoiceType(e.target.value)}>
//             <option value="">All types</option>
//             <option value="gst">GST</option>
//             <option value="non_gst">Non-GST</option>
//           </select>
//           <select className="select" style={{ width: 150 }} value={status} onChange={(e) => setStatus(e.target.value)}>
//             <option value="">All status</option>
//             <option value="unpaid">Unpaid</option>
//             <option value="paid">Paid</option>
//             <option value="partially_paid">Partially Paid</option>
//             <option value="cancelled">Cancelled</option>
//           </select>
//         </div>
//         <button className="btn btn-primary" onClick={() => setModalOpen(true)}>+ New Invoice</button>
//       </div>

//       <DataTable
//         columns={columns}
//         rows={rows}
//         loading={loading}
//         sortBy={sortBy}
//         sortDir={sortDir}
//         onSort={handleSort}
//         pagination={pagination}
//         onPageChange={setPage}
//         emptyIcon="🧾"
//         emptyTitle="No invoices yet"
//         emptyMessage="Create your first invoice to start billing customers."
//       />

//       {modalOpen && (
//         <InvoiceFormModal
//           onClose={() => setModalOpen(false)}
//           onCreated={() => { setModalOpen(false); refresh(); }}
//         />
//       )}
//     </div>
//   );
// }

import { useState } from 'react';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { useDebounce } from '../hooks/useDebounce';
import { DataTable, Column } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { Invoice } from '../types';
import { api } from '../api/client';
import { InvoiceFormModal } from '../components/billing/InvoiceFormModal';
import { InvoicePrint } from '../components/billing/InvoicePrint';

function formatCurrency(n: number) {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

export function BillingPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [invoiceType, setInvoiceType] = useState('');
  const debouncedSearch = useDebounce(search);

  const { rows, pagination, page, setPage, sortBy, sortDir, handleSort, loading, refresh } =
    usePaginatedList<Invoice>({
      endpoint: '/invoices',
      filters: { search: debouncedSearch, status, invoice_type: invoiceType },
      defaultSortBy: 'invoice_date',
    });

  const [modalOpen, setModalOpen] = useState(false);
  // Invoice currently shown in the print view. auto = open the print dialog immediately (used right after creating one).
  const [printTarget, setPrintTarget] = useState<{ id: number; auto: boolean } | null>(null);

  const downloadPdf = (invoiceId: number, invoiceNo: string) => {
    api.get(`/invoices/${invoiceId}/pdf`, { responseType: 'blob' }).then((res) => {
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoiceNo}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    });
  };

  const columns: Column<Invoice>[] = [
    { key: 'invoice_no', header: 'Invoice #', sortable: true, render: (i) => <span className="mono" style={{ fontWeight: 600 }}>{i.invoice_no}</span> },
    { key: 'customer_name', header: 'Customer', render: (i) => (
      <div>
        <div style={{ fontWeight: 600 }}>{i.customer_name}</div>
        <div className="text-muted mono" style={{ fontSize: 11.5 }}>{i.customer_mobile}</div>
      </div>
    ) },
    { key: 'invoice_type', header: 'Type', render: (i) => (
      <span className={`badge ${i.invoice_type === 'gst' ? 'badge-primary' : 'badge-neutral'}`}>
        {i.invoice_type === 'gst' ? 'GST' : 'Non-GST'}
      </span>
    ) },
    { key: 'invoice_date', header: 'Date', sortable: true, render: (i) => new Date(i.invoice_date).toLocaleDateString('en-IN') },
    { key: 'total_amount', header: 'Total', sortable: true, align: 'right', render: (i) => <span className="mono" style={{ fontWeight: 600 }}>{formatCurrency(i.total_amount)}</span> },
    { key: 'status', header: 'Status', render: (i) => <StatusBadge status={i.status} /> },
    { key: 'actions', header: '', align: 'right', render: (i) => (
      <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-primary btn-sm" onClick={() => setPrintTarget({ id: i.id, auto: false })}>🖨 Print</button>
        <button className="btn btn-secondary btn-sm" onClick={() => downloadPdf(i.id, i.invoice_no)}>⬇ PDF</button>
      </div>
    ) },
  ];

  return (
    <div className="card">
      <div className="table-toolbar">
        <div className="flex gap-2" style={{ flex: 1, maxWidth: 560, flexWrap: 'wrap' }}>
          <div className="input-group" style={{ flex: 1, minWidth: 200 }}>
            <span className="input-icon">🔍</span>
            <input className="input" placeholder="Search invoice # or customer…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="select" style={{ width: 130 }} value={invoiceType} onChange={(e) => setInvoiceType(e.target.value)}>
            <option value="">All types</option>
            <option value="gst">GST</option>
            <option value="non_gst">Non-GST</option>
          </select>
          <select className="select" style={{ width: 150 }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All status</option>
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>+ New Invoice</button>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={handleSort}
        pagination={pagination}
        onPageChange={setPage}
        emptyIcon="🧾"
        emptyTitle="No invoices yet"
        emptyMessage="Create your first invoice to start billing customers."
      />

      {modalOpen && (
        <InvoiceFormModal
          onClose={() => setModalOpen(false)}
          onCreated={(id) => { setModalOpen(false); refresh(); setPrintTarget({ id, auto: true }); }}
        />
      )}

      {printTarget && (
        <InvoicePrint invoiceId={printTarget.id} autoPrint={printTarget.auto} onClose={() => setPrintTarget(null)} />
      )}
    </div>
  );
}