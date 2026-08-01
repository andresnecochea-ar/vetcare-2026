(function exposeVetCareFinance(global) {
  function amount(value) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function summarize(invoices) {
    const rows = Array.isArray(invoices) ? invoices : [];
    const paid = rows.filter((invoice) => invoice.status === 'paid');
    const pending = rows.filter((invoice) => invoice.status === 'pending');
    return {
      paidTotal: rows.filter(invoice=>invoice.status!=='cancelled').reduce((sum, invoice) => sum + (invoice.amountPaid === undefined ? (invoice.status==='paid'?amount(invoice.total):0) : amount(invoice.amountPaid)), 0),
      pendingTotal: pending.reduce((sum, invoice) => sum + Math.max(0, amount(invoice.total)-amount(invoice.amountPaid)), 0),
      paidCount: paid.length,
      invoiceCount: rows.length,
    };
  }

  global.VetCareFinance = Object.freeze({ summarize });
}(globalThis));
