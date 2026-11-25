/** Letterhead shown on printed invoices / dealer order slips (from .env). */
export function companyInfo() {
  return {
    name: process.env.COMPANY_NAME || 'Your Company Pvt Ltd',
    gstin: process.env.COMPANY_GSTIN || '',
    address: process.env.COMPANY_ADDRESS || '',
    state: process.env.COMPANY_STATE || '',
  };
}