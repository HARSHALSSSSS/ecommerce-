import { useState, useEffect, useCallback } from 'react'
import {
  Search,
  Filter,
  Eye,
  CreditCard,
  DollarSign,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  Calendar,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { paymentsAPI } from '../services/api'

// Types
interface Payment {
  id: number
  order_id: number
  order_number: string
  user_id: number
  customer_name: string
  customer_email: string
  payment_method: string
  payment_provider: string
  transaction_id: string
  amount: number
  currency: string
  status: string
  payment_type: string
  gateway_response?: string
  failure_reason?: string
  metadata?: string
  ip_address?: string
  processed_at: string
  created_at: string
  updated_at: string
  invoice?: {
    id: number
    invoice_number: string
    status: string
  }
  available_transitions?: {
    status: string
    display_name: string
  }[]
}

interface PaymentStats {
  total_count: number
  total_completed: number
  total_pending: number
  total_failed: number
  total_refunded: number
  completed_count: number
  pending_count: number
  failed_count: number
  refunded_count: number
}

const STATUS_COLORS: Record<string, { bg: string; text: string; icon: React.ComponentType<any> }> = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock },
  processing: { bg: 'bg-blue-100', text: 'text-blue-800', icon: RefreshCw },
  completed: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle },
  failed: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle },
  refunded: { bg: 'bg-purple-100', text: 'text-purple-800', icon: RefreshCw },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-800', icon: XCircle },
}

const PAYMENT_METHODS = [
  { value: 'all', label: 'All Methods' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'debit_card', label: 'Debit Card' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash_on_delivery', label: 'Cash on Delivery' },
]

export default function Payments() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [stats, setStats] = useState<PaymentStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [methodFilter, setMethodFilter] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [loadingPayment, setLoadingPayment] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const loadPayments = useCallback(async () => {
    setLoading(true)
    try {
      const response = await paymentsAPI.getAll({
        page,
        limit: 20,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        payment_method: methodFilter !== 'all' ? methodFilter : undefined,
        search: search || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      })
      setPayments(response.data.payments)
      setStats(response.data.stats)
      setTotalPages(response.data.pagination.totalPages)
      setTotal(response.data.pagination.total)
    } catch (error) {
      console.error('Failed to load payments:', error)
      toast.error('Failed to load payments')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, methodFilter, search, startDate, endDate])

  useEffect(() => {
    loadPayments()
  }, [loadPayments])

  const handleViewPayment = async (payment: Payment) => {
    setLoadingPayment(true)
    setShowPaymentModal(true)
    try {
      const response = await paymentsAPI.getById(payment.id)
      setSelectedPayment(response.data.payment)
    } catch (error) {
      console.error('Failed to load payment details:', error)
      toast.error('Failed to load payment details')
      setShowPaymentModal(false)
    } finally {
      setLoadingPayment(false)
    }
  }

  const handleStatusUpdate = async (newStatus: string, displayName: string) => {
    if (!selectedPayment) return
    setUpdatingStatus(true)
    try {
      await paymentsAPI.updateStatus(selectedPayment.id, { status: newStatus })
      toast.success(`Payment ${displayName.toLowerCase()}`)
      
      // Refresh payment details
      const response = await paymentsAPI.getById(selectedPayment.id)
      setSelectedPayment(response.data.payment)
      
      // Refresh list
      loadPayments()
    } catch (error: any) {
      console.error('Failed to update payment status:', error)
      toast.error(error.response?.data?.message || 'Failed to update payment status')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    loadPayments()
  }

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setMethodFilter('all')
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

  const getPaymentMethodIcon = (method: string) => {
    switch (method?.toLowerCase()) {
      case 'credit_card':
      case 'debit_card':
        return <CreditCard className="w-4 h-4" />
      case 'paypal':
        return <Wallet className="w-4 h-4" />
      default:
        return <DollarSign className="w-4 h-4" />
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payment Logs</h1>
          <p className="text-gray-500 mt-1">View and manage payment transactions</p>
        </div>
        <button
          onClick={loadPayments}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Transactions</p>
                <p className="text-xl font-bold text-gray-900">{stats.total_count}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Completed</p>
                <p className="text-xl font-bold text-green-600">
                  {formatCurrency(stats.total_completed || 0)}
                </p>
                <p className="text-xs text-gray-400">{stats.completed_count} transactions</p>
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
                <p className="text-xl font-bold text-yellow-600">
                  {formatCurrency(stats.total_pending || 0)}
                </p>
                <p className="text-xs text-gray-400">{stats.pending_count} transactions</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Failed</p>
                <p className="text-xl font-bold text-red-600">
                  {formatCurrency(stats.total_failed || 0)}
                </p>
                <p className="text-xs text-gray-400">{stats.failed_count} transactions</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <RefreshCw className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Refunded</p>
                <p className="text-xl font-bold text-purple-600">
                  {formatCurrency(Math.abs(stats.total_refunded || 0))}
                </p>
                <p className="text-xs text-gray-400">{stats.refunded_count} transactions</p>
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
              placeholder="Search by transaction ID, order #, or customer..."
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
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
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

        {/* Extended Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
              <select
                value={methodFilter}
                onChange={(e) => { setMethodFilter(e.target.value); setPage(1) }}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method.value} value={method.value}>{method.label}</option>
                ))}
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

      {/* Payments Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">
                  Transaction
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
                  Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">
                  Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-500">
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Loading payments...
                    </div>
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    No payments found
                  </td>
                </tr>
              ) : (
                payments.map((payment) => {
                  const statusStyle = STATUS_COLORS[payment.status] || STATUS_COLORS.pending
                  const StatusIcon = statusStyle.icon
                  return (
                    <tr key={payment.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900 font-mono text-sm">
                          {payment.transaction_id}
                        </div>
                        <div className="text-xs text-gray-500 capitalize">
                          {payment.payment_type}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{payment.customer_name}</div>
                        <div className="text-xs text-gray-500">{payment.customer_email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-indigo-600 font-medium">
                          #{payment.order_number}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-sm font-semibold ${payment.amount < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                          {formatCurrency(payment.amount)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {getPaymentMethodIcon(payment.payment_method)}
                          <span className="text-sm text-gray-700 capitalize">
                            {payment.payment_method?.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                          <StatusIcon className="w-3 h-3" />
                          {payment.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {payment.processed_at 
                          ? format(new Date(payment.processed_at), 'MMM d, yyyy HH:mm')
                          : format(new Date(payment.created_at), 'MMM d, yyyy HH:mm')
                        }
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleViewPayment(payment)}
                          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
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
              Showing {((page - 1) * 20) + 1} - {Math.min(page * 20, total)} of {total} payments
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

      {/* Payment Detail Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Payment Details</h2>
              <button
                onClick={() => { setShowPaymentModal(false); setSelectedPayment(null) }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {loadingPayment ? (
              <div className="p-12 text-center">
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
                <p className="mt-2 text-gray-500">Loading payment details...</p>
              </div>
            ) : selectedPayment ? (
              <div className="p-6 space-y-6">
                {/* Transaction Info */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Transaction Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Transaction ID</p>
                      <p className="font-mono text-sm font-medium">{selectedPayment.transaction_id}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Order Number</p>
                      <p className="text-indigo-600 font-medium">#{selectedPayment.order_number}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Amount</p>
                      <p className={`text-lg font-bold ${selectedPayment.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(selectedPayment.amount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Status</p>
                      {(() => {
                        const statusStyle = STATUS_COLORS[selectedPayment.status] || STATUS_COLORS.pending
                        const StatusIcon = statusStyle.icon
                        return (
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                            <StatusIcon className="w-4 h-4" />
                            {selectedPayment.status}
                          </span>
                        )
                      })()}
                    </div>
                  </div>
                </div>

                {/* Payment Method */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Payment Method</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Method</p>
                      <div className="flex items-center gap-2 mt-1">
                        {getPaymentMethodIcon(selectedPayment.payment_method)}
                        <span className="font-medium capitalize">
                          {selectedPayment.payment_method?.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Provider</p>
                      <p className="font-medium capitalize">{selectedPayment.payment_provider || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Type</p>
                      <p className="font-medium capitalize">{selectedPayment.payment_type}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Currency</p>
                      <p className="font-medium">{selectedPayment.currency}</p>
                    </div>
                  </div>
                </div>

                {/* Customer Info */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Customer Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Name</p>
                      <p className="font-medium">{selectedPayment.customer_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <p className="font-medium">{selectedPayment.customer_email}</p>
                    </div>
                    {selectedPayment.ip_address && (
                      <div>
                        <p className="text-sm text-gray-500">IP Address</p>
                        <p className="font-mono text-sm">{selectedPayment.ip_address}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Timestamps */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Timeline</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Created At</p>
                      <p className="font-medium">{format(new Date(selectedPayment.created_at), 'MMM d, yyyy HH:mm:ss')}</p>
                    </div>
                    {selectedPayment.processed_at && (
                      <div>
                        <p className="text-sm text-gray-500">Processed At</p>
                        <p className="font-medium">{format(new Date(selectedPayment.processed_at), 'MMM d, yyyy HH:mm:ss')}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Failure Reason */}
                {selectedPayment.failure_reason && (
                  <div className="bg-red-50 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-semibold text-red-800">Failure Reason</h3>
                        <p className="text-red-700 mt-1">{selectedPayment.failure_reason}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Related Invoice */}
                {selectedPayment.invoice && (
                  <div className="bg-indigo-50 rounded-xl p-4">
                    <h3 className="font-semibold text-indigo-900 mb-2">Related Invoice</h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-indigo-700">{selectedPayment.invoice.invoice_number}</p>
                        <p className="text-sm text-indigo-600 capitalize">{selectedPayment.invoice.status}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Update Status Section */}
                {selectedPayment.available_transitions && selectedPayment.available_transitions.length > 0 && (
                  <div className="bg-blue-50 rounded-xl p-4">
                    <h3 className="font-semibold text-gray-900 mb-3">Update Payment Status</h3>
                    <div className="space-y-2">
                      {selectedPayment.available_transitions.map((transition) => (
                        <button
                          key={transition.status}
                          onClick={() => handleStatusUpdate(transition.status, transition.display_name)}
                          disabled={updatingStatus}
                          className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors text-left flex items-center justify-between ${
                            transition.status === 'completed' 
                              ? 'bg-green-100 text-green-800 hover:bg-green-200 border border-green-200' 
                              : transition.status === 'refunded' || transition.status === 'cancelled' || transition.status === 'failed'
                              ? 'bg-red-100 text-red-800 hover:bg-red-200 border border-red-200'
                              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                          } ${updatingStatus ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <span>→ {transition.display_name}</span>
                          {updatingStatus && <RefreshCw className="w-4 h-4 animate-spin" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
