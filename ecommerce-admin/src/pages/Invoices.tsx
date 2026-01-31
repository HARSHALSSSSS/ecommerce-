import { useState, useEffect, useCallback } from 'react'
import {
  Search,
  Filter,
  Eye,
  FileText,
  Download,
  Plus,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  Calendar,
  DollarSign,
  TrendingUp,
  AlertCircle,
} from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { invoicesAPI, ordersAPI } from '../services/api'

// Types
interface Invoice {
  id: number
  invoice_number: string
  order_id: number
  order_number: string
  user_id: number
  customer_name: string
  customer_email: string
  payment_id?: number
  invoice_type: string
  subtotal: number
  tax_amount: number
  shipping_amount: number
  discount_amount: number
  total_amount: number
  currency: string
  status: string
  billing_name?: string
  billing_address?: string
  billing_city?: string
  billing_state?: string
  billing_postal_code?: string
  billing_country?: string
  notes?: string
  pdf_url?: string
  issued_at: string
  due_at?: string
  paid_at?: string
  voided_at?: string
  created_at: string
  items?: InvoiceItem[]
  credit_notes?: CreditNote[]
}

interface InvoiceItem {
  id: number
  product_name: string
  product_sku?: string
  quantity: number
  unit_price: number
  tax_rate: number
  tax_amount: number
  discount_amount: number
  total_amount: number
}

interface CreditNote {
  id: number
  credit_note_number: string
  total_amount: number
  status: string
  issued_at: string
}

interface InvoiceStats {
  total_count: number
  total_amount: number
  paid_amount: number
  pending_amount: number
  paid_count: number
  pending_count: number
  voided_count: number
}

const STATUS_COLORS: Record<string, { bg: string; text: string; icon: React.ComponentType<any> }> = {
  issued: { bg: 'bg-blue-100', text: 'text-blue-800', icon: FileText },
  paid: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle },
  overdue: { bg: 'bg-red-100', text: 'text-red-800', icon: AlertCircle },
  voided: { bg: 'bg-gray-100', text: 'text-gray-800', icon: XCircle },
}

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [stats, setStats] = useState<InvoiceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [loadingInvoice, setLoadingInvoice] = useState(false)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [generateOrderId, setGenerateOrderId] = useState('')
  const [generateNotes, setGenerateNotes] = useState('')
  const [generating, setGenerating] = useState(false)

  const loadInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const response = await invoicesAPI.getAll({
        page,
        limit: 20,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        invoice_type: typeFilter !== 'all' ? typeFilter : undefined,
        search: search || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      })
      setInvoices(response.data.invoices)
      setStats(response.data.stats)
      setTotalPages(response.data.pagination.totalPages)
      setTotal(response.data.pagination.total)
    } catch (error) {
      console.error('Failed to load invoices:', error)
      toast.error('Failed to load invoices')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, typeFilter, search, startDate, endDate])

  useEffect(() => {
    loadInvoices()
  }, [loadInvoices])

  const handleViewInvoice = async (invoice: Invoice) => {
    setLoadingInvoice(true)
    setShowInvoiceModal(true)
    try {
      const response = await invoicesAPI.getById(invoice.id)
      setSelectedInvoice(response.data.invoice)
    } catch (error) {
      console.error('Failed to load invoice details:', error)
      toast.error('Failed to load invoice details')
      setShowInvoiceModal(false)
    } finally {
      setLoadingInvoice(false)
    }
  }

  const handleGenerateInvoice = async () => {
    if (!generateOrderId) {
      toast.error('Please enter an order ID')
      return
    }
    setGenerating(true)
    try {
      const response = await invoicesAPI.generate(parseInt(generateOrderId), generateNotes)
      toast.success(`Invoice ${response.data.invoice.invoice_number} generated successfully`)
      setShowGenerateModal(false)
      setGenerateOrderId('')
      setGenerateNotes('')
      loadInvoices()
    } catch (error: any) {
      console.error('Failed to generate invoice:', error)
      toast.error(error.response?.data?.message || 'Failed to generate invoice')
    } finally {
      setGenerating(false)
    }
  }

  const handleUpdateStatus = async (invoiceId: number, newStatus: string) => {
    try {
      await invoicesAPI.updateStatus(invoiceId, { status: newStatus })
      toast.success('Invoice status updated')
      if (selectedInvoice) {
        setSelectedInvoice({ ...selectedInvoice, status: newStatus })
      }
      loadInvoices()
    } catch (error) {
      console.error('Failed to update invoice status:', error)
      toast.error('Failed to update invoice status')
    }
  }

  const handleDownloadInvoice = async (invoice: Invoice) => {
    try {
      toast.loading('Generating PDF...', { id: 'pdf-download' })
      const response = await invoicesAPI.getPdfData(invoice.id)
      const pdfData = response.data.invoice
      
      // Create a simple HTML invoice for printing/download
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Invoice ${pdfData.invoice_number}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
              .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
              .header h1 { margin: 0; color: #333; }
              .header p { margin: 5px 0; color: #666; }
              .invoice-info { display: flex; justify-content: space-between; margin-bottom: 30px; }
              .invoice-info div { flex: 1; }
              .invoice-info h3 { margin: 0 0 10px 0; color: #333; font-size: 14px; }
              .invoice-info p { margin: 3px 0; color: #666; font-size: 13px; }
              table { width: 100%; border-collapse: collapse; margin: 20px 0; }
              th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
              th { background: #f5f5f5; font-weight: 600; }
              .totals { text-align: right; margin-top: 20px; }
              .totals p { margin: 5px 0; }
              .totals .total { font-size: 18px; font-weight: bold; color: #333; }
              .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
              .status-issued { background: #e0f2fe; color: #0369a1; }
              .status-paid { background: #dcfce7; color: #166534; }
              .footer { margin-top: 40px; text-align: center; color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px; }
              @media print { body { padding: 20px; } }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>INVOICE</h1>
              <p>${pdfData.invoice_number}</p>
              <span class="status status-${pdfData.status}">${pdfData.status.toUpperCase()}</span>
            </div>
            
            <div class="invoice-info">
              <div>
                <h3>Bill To:</h3>
                <p><strong>${pdfData.billing_name || pdfData.customer_name || 'Customer'}</strong></p>
                <p>${pdfData.customer_email || ''}</p>
                <p>${pdfData.billing_address || ''}</p>
                <p>${pdfData.billing_city || ''} ${pdfData.billing_state || ''} ${pdfData.billing_postal_code || ''}</p>
              </div>
              <div style="text-align: right;">
                <h3>Invoice Details:</h3>
                <p><strong>Invoice #:</strong> ${pdfData.invoice_number}</p>
                <p><strong>Order #:</strong> ${pdfData.order_number || 'N/A'}</p>
                <p><strong>Issue Date:</strong> ${new Date(pdfData.issued_at).toLocaleDateString()}</p>
                ${pdfData.due_at ? `<p><strong>Due Date:</strong> ${new Date(pdfData.due_at).toLocaleDateString()}</p>` : ''}
              </div>
            </div>
            
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                ${(pdfData.items && pdfData.items.length > 0) 
                  ? pdfData.items.map((item: any) => `
                    <tr>
                      <td>${item.product_name}</td>
                      <td>${item.quantity}</td>
                      <td>$${Number(item.unit_price).toFixed(2)}</td>
                      <td>$${Number(item.total_amount).toFixed(2)}</td>
                    </tr>
                  `).join('')
                  : `<tr><td colspan="4" style="text-align: center; color: #999;">Order items</td></tr>`
                }
              </tbody>
            </table>
            
            <div class="totals">
              <p>Subtotal: $${Number(pdfData.subtotal).toFixed(2)}</p>
              <p>Tax: $${Number(pdfData.tax_amount).toFixed(2)}</p>
              ${pdfData.shipping_amount > 0 ? `<p>Shipping: $${Number(pdfData.shipping_amount).toFixed(2)}</p>` : ''}
              ${pdfData.discount_amount > 0 ? `<p>Discount: -$${Number(pdfData.discount_amount).toFixed(2)}</p>` : ''}
              <p class="total">Total: $${Number(pdfData.total_amount).toFixed(2)}</p>
            </div>
            
            <div class="footer">
              <p>Thank you for your business!</p>
              <p>Generated on ${new Date().toLocaleString()}</p>
            </div>
          </body>
          </html>
        `)
        printWindow.document.close()
        printWindow.focus()
        
        // Trigger print dialog
        setTimeout(() => {
          printWindow.print()
        }, 500)
      }
      
      toast.success('Invoice opened for printing', { id: 'pdf-download' })
    } catch (error) {
      console.error('Failed to download invoice:', error)
      toast.error('Failed to download invoice', { id: 'pdf-download' })
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    loadInvoices()
  }

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setTypeFilter('all')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-500 mt-1">Manage and generate invoices for orders</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadInvoices}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            <Plus className="w-4 h-4" />
            Generate Invoice
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Invoices</p>
                <p className="text-xl font-bold text-gray-900">{stats.total_count}</p>
                <p className="text-sm text-gray-500">{formatCurrency(stats.total_amount || 0)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Paid</p>
                <p className="text-xl font-bold text-green-600">{stats.paid_count}</p>
                <p className="text-sm text-gray-500">{formatCurrency(stats.paid_amount || 0)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Pending</p>
                <p className="text-xl font-bold text-yellow-600">{stats.pending_count}</p>
                <p className="text-sm text-gray-500">{formatCurrency(stats.pending_amount || 0)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <XCircle className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Voided</p>
                <p className="text-xl font-bold text-gray-600">{stats.voided_count}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by invoice #, order #, or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Status</option>
            <option value="issued">Issued</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="voided">Voided</option>
          </select>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <Filter className="w-4 h-4" />
            More Filters
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Search
          </button>
        </form>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Type</label>
              <select
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Types</option>
                <option value="sale">Sale</option>
                <option value="proforma">Proforma</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">
                  Order
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">
                  Issued Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-500">
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Loading invoices...
                    </div>
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No invoices found
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => {
                  const statusStyle = STATUS_COLORS[invoice.status] || STATUS_COLORS.issued
                  const StatusIcon = statusStyle.icon
                  return (
                    <tr key={invoice.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-gray-400" />
                          <div>
                            <div className="font-medium text-gray-900">{invoice.invoice_number}</div>
                            <div className="text-xs text-gray-500 capitalize">{invoice.invoice_type}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{invoice.customer_name}</div>
                        <div className="text-xs text-gray-500">{invoice.customer_email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-indigo-600 font-medium">
                          #{invoice.order_number}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-gray-900">
                          {formatCurrency(invoice.total_amount)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                          <StatusIcon className="w-3 h-3" />
                          {invoice.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {format(new Date(invoice.issued_at), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleViewInvoice(invoice)}
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDownloadInvoice(invoice)}
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition"
                            title="Download Invoice"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Showing {((page - 1) * 20) + 1} - {Math.min(page * 20, total)} of {total} invoices
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-4 py-2 text-sm text-gray-700">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Invoice Detail Modal */}
      {showInvoiceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Invoice Details</h2>
              <button
                onClick={() => { setShowInvoiceModal(false); setSelectedInvoice(null) }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {loadingInvoice ? (
              <div className="p-12 text-center">
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
                <p className="mt-2 text-gray-500">Loading invoice details...</p>
              </div>
            ) : selectedInvoice ? (
              <div className="p-6 space-y-6">
                {/* Invoice Header */}
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">{selectedInvoice.invoice_number}</h3>
                    <p className="text-gray-500">Order #{selectedInvoice.order_number}</p>
                  </div>
                  <div className="text-right">
                    {(() => {
                      const statusStyle = STATUS_COLORS[selectedInvoice.status] || STATUS_COLORS.issued
                      const StatusIcon = statusStyle.icon
                      return (
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                          <StatusIcon className="w-4 h-4" />
                          {selectedInvoice.status}
                        </span>
                      )
                    })()}
                    <p className="text-sm text-gray-500 mt-1">
                      Issued: {format(new Date(selectedInvoice.issued_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>

                {/* Billing Info */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Bill To</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="font-medium">{selectedInvoice.billing_name || selectedInvoice.customer_name}</p>
                      <p className="text-gray-500">{selectedInvoice.customer_email}</p>
                    </div>
                    <div className="text-sm text-gray-600">
                      {selectedInvoice.billing_address && <p>{selectedInvoice.billing_address}</p>}
                      {(selectedInvoice.billing_city || selectedInvoice.billing_state) && (
                        <p>{[selectedInvoice.billing_city, selectedInvoice.billing_state].filter(Boolean).join(', ')}</p>
                      )}
                      {selectedInvoice.billing_postal_code && <p>{selectedInvoice.billing_postal_code}</p>}
                      {selectedInvoice.billing_country && <p>{selectedInvoice.billing_country}</p>}
                    </div>
                  </div>
                </div>

                {/* Invoice Items */}
                {selectedInvoice.items && selectedInvoice.items.length > 0 && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Items</h4>
                    <table className="w-full">
                      <thead className="border-b border-gray-200">
                        <tr>
                          <th className="text-left text-sm font-medium text-gray-600 pb-2">Item</th>
                          <th className="text-center text-sm font-medium text-gray-600 pb-2">Qty</th>
                          <th className="text-right text-sm font-medium text-gray-600 pb-2">Unit Price</th>
                          <th className="text-right text-sm font-medium text-gray-600 pb-2">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {selectedInvoice.items.map((item) => (
                          <tr key={item.id}>
                            <td className="py-2">
                              <p className="font-medium text-gray-900">{item.product_name}</p>
                              {item.product_sku && (
                                <p className="text-xs text-gray-500">SKU: {item.product_sku}</p>
                              )}
                            </td>
                            <td className="py-2 text-center text-gray-700">{item.quantity}</td>
                            <td className="py-2 text-right text-gray-700">{formatCurrency(item.unit_price)}</td>
                            <td className="py-2 text-right font-medium text-gray-900">{formatCurrency(item.total_amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Totals */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="font-medium">{formatCurrency(selectedInvoice.subtotal)}</span>
                    </div>
                    {selectedInvoice.tax_amount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Tax</span>
                        <span className="font-medium">{formatCurrency(selectedInvoice.tax_amount)}</span>
                      </div>
                    )}
                    {selectedInvoice.shipping_amount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Shipping</span>
                        <span className="font-medium">{formatCurrency(selectedInvoice.shipping_amount)}</span>
                      </div>
                    )}
                    {selectedInvoice.discount_amount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Discount</span>
                        <span className="font-medium text-green-600">-{formatCurrency(selectedInvoice.discount_amount)}</span>
                      </div>
                    )}
                    <div className="border-t border-gray-200 pt-2 mt-2">
                      <div className="flex justify-between text-lg">
                        <span className="font-semibold text-gray-900">Total</span>
                        <span className="font-bold text-gray-900">{formatCurrency(selectedInvoice.total_amount)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Credit Notes */}
                {selectedInvoice.credit_notes && selectedInvoice.credit_notes.length > 0 && (
                  <div className="bg-purple-50 rounded-xl p-4">
                    <h4 className="font-semibold text-purple-900 mb-3">Related Credit Notes</h4>
                    <div className="space-y-2">
                      {selectedInvoice.credit_notes.map((cn) => (
                        <div key={cn.id} className="flex justify-between items-center bg-white rounded-lg p-3">
                          <div>
                            <p className="font-medium text-gray-900">{cn.credit_note_number}</p>
                            <p className="text-sm text-gray-500">{format(new Date(cn.issued_at), 'MMM d, yyyy')}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-red-600">-{formatCurrency(cn.total_amount)}</p>
                            <p className="text-xs text-gray-500 capitalize">{cn.status}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {selectedInvoice.notes && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="font-semibold text-gray-900 mb-2">Notes</h4>
                    <p className="text-gray-600">{selectedInvoice.notes}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => handleDownloadInvoice(selectedInvoice)}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    <Download className="w-4 h-4" />
                    Download / Print
                  </button>
                  {selectedInvoice.status === 'issued' && (
                    <>
                      <button
                        onClick={() => handleUpdateStatus(selectedInvoice.id, 'paid')}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Mark as Paid
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(selectedInvoice.id, 'voided')}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                      >
                        <XCircle className="w-4 h-4" />
                        Void Invoice
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Generate Invoice Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="border-b border-gray-100 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Generate Invoice</h2>
              <button
                onClick={() => { setShowGenerateModal(false); setGenerateOrderId(''); setGenerateNotes('') }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Order ID</label>
                <input
                  type="number"
                  value={generateOrderId}
                  onChange={(e) => setGenerateOrderId(e.target.value)}
                  placeholder="Enter order ID"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                <textarea
                  value={generateNotes}
                  onChange={(e) => setGenerateNotes(e.target.value)}
                  placeholder="Add any notes for this invoice"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { setShowGenerateModal(false); setGenerateOrderId(''); setGenerateNotes('') }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateInvoice}
                  disabled={generating || !generateOrderId}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {generating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Generate
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
