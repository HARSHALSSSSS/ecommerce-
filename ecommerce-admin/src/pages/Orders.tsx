import { useState, useEffect, useCallback } from 'react'
import {
  Search,
  Filter,
  Eye,
  Package,
  Truck,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  User,
  DollarSign,
  TrendingUp,
  Timer,
  X,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import { ordersAPI } from '../services/api'

// Types
interface OrderItem {
  id: number
  product_name: string
  product_image?: string
  quantity: number
  price: number
  sku?: string
}

interface Order {
  id: number
  order_number: string
  customer_name: string
  customer_email: string
  customer_phone?: string
  total_amount: number
  status: string
  payment_method: string
  delivery_address: string
  city: string
  postal_code?: string
  notes?: string
  items: OrderItem[]
  item_count: number
  total_items: number
  sla_deadline?: string
  sla_breached?: number
  sla_status: 'on_track' | 'at_risk' | 'breached' | 'completed'
  created_at: string
  updated_at: string
}

interface OrderStats {
  total_orders: number
  pending: number
  confirmed: number
  processing: number
  ready_for_shipping: number
  shipped: number
  out_for_delivery: number
  delivered: number
  cancelled: number
  refunds: number
  total_revenue: number
  avg_order_value: number
  sla: {
    total_tracked: number
    breached: number
    at_risk: number
    on_track: number
  }
  today: {
    orders_today: number
    revenue_today: number
  }
  week: {
    orders_this_week: number
    revenue_this_week: number
  }
}

interface TimelineEvent {
  id: number
  event_type: string
  previous_status: string | null
  new_status: string | null
  previous_status_display: string | null
  new_status_display: string | null
  actor_type: string
  actor_name: string
  notes: string | null
  created_at: string
}

interface StatusTransition {
  status: string
  display_name: string
}

const STATUS_COLORS: Record<string, { bg: string; text: string; icon: React.ComponentType<any> }> = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock },
  confirmed: { bg: 'bg-blue-100', text: 'text-blue-800', icon: CheckCircle },
  processing: { bg: 'bg-indigo-100', text: 'text-indigo-800', icon: Package },
  ready_for_shipping: { bg: 'bg-purple-100', text: 'text-purple-800', icon: Package },
  shipped: { bg: 'bg-cyan-100', text: 'text-cyan-800', icon: Truck },
  out_for_delivery: { bg: 'bg-teal-100', text: 'text-teal-800', icon: Truck },
  delivered: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle },
  failed_delivery: { bg: 'bg-orange-100', text: 'text-orange-800', icon: AlertTriangle },
  cancelled: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle },
  returned: { bg: 'bg-gray-100', text: 'text-gray-800', icon: RefreshCw },
  refund_requested: { bg: 'bg-amber-100', text: 'text-amber-800', icon: DollarSign },
  refund_processing: { bg: 'bg-orange-100', text: 'text-orange-800', icon: RefreshCw },
  refund_rejected: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle },
  refunded: { bg: 'bg-emerald-100', text: 'text-emerald-800', icon: CheckCircle },
}

const STATUS_DISPLAY_NAMES: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  ready_for_shipping: 'Ready for Shipping',
  shipped: 'Shipped',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  failed_delivery: 'Failed Delivery',
  cancelled: 'Cancelled',
  returned: 'Returned',
  refund_requested: 'Refund Requested',
  refund_processing: 'Refund Processing',
  refund_rejected: 'Refund Rejected',
  refunded: 'Refunded',
}

const SLA_STATUS_COLORS: Record<string, string> = {
  on_track: 'text-green-600',
  at_risk: 'text-yellow-600',
  breached: 'text-red-600',
  completed: 'text-gray-400',
}

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<OrderStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [slaFilter, setSlaFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [orderTimeline, setOrderTimeline] = useState<TimelineEvent[]>([])
  const [availableTransitions, setAvailableTransitions] = useState<StatusTransition[]>([])
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [loadingOrder, setLoadingOrder] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [newStatus, setNewStatus] = useState('')
  const [statusNotes, setStatusNotes] = useState('')
  const [notifyCustomer, setNotifyCustomer] = useState(true)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const loadOrders = useCallback(async () => {
    setLoading(true)
    try {
      const response = await ordersAPI.getAll({
        page, limit: 15,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: search || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        sla_status: slaFilter !== 'all' ? slaFilter : undefined,
      })
      setOrders(response.data.orders)
      setTotalPages(response.data.pagination.totalPages)
      setTotal(response.data.pagination.total)
    } catch (error) {
      console.error('Failed to load orders:', error)
      toast.error('Failed to load orders')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, search, dateFrom, dateTo, slaFilter])

  const loadStats = async () => {
    try {
      const response = await ordersAPI.getStats()
      setStats(response.data.stats)
    } catch (error) {
      console.error('Failed to load order stats:', error)
    }
  }

  const loadOrderDetails = async (orderId: number) => {
    setLoadingOrder(true)
    try {
      const [orderRes, timelineRes] = await Promise.all([
        ordersAPI.getById(orderId),
        ordersAPI.getTimeline(orderId),
      ])
      setSelectedOrder(orderRes.data.order)
      setAvailableTransitions(orderRes.data.order.available_transitions || [])
      setOrderTimeline(timelineRes.data.timeline)
      setShowOrderModal(true)
    } catch (error) {
      console.error('Failed to load order details:', error)
      toast.error('Failed to load order details')
    } finally {
      setLoadingOrder(false)
    }
  }

  const handleStatusUpdate = async () => {
    if (!selectedOrder || !newStatus) return
    setUpdatingStatus(true)
    try {
      await ordersAPI.updateStatus(selectedOrder.id, {
        new_status: newStatus, notes: statusNotes, notify_customer: notifyCustomer,
      })
      toast.success(`Order status updated to ${STATUS_DISPLAY_NAMES[newStatus]}`)
      setShowStatusModal(false)
      setNewStatus('')
      setStatusNotes('')
      
      // Refresh order details to get new available transitions
      const [orderRes, timelineRes] = await Promise.all([
        ordersAPI.getById(selectedOrder.id),
        ordersAPI.getTimeline(selectedOrder.id),
      ])
      setSelectedOrder(orderRes.data.order)
      setAvailableTransitions(orderRes.data.order.available_transitions || [])
      setOrderTimeline(timelineRes.data.timeline)
      
      loadOrders()
      loadStats()
    } catch (error: any) {
      console.error('Failed to update status:', error)
      toast.error(error.response?.data?.message || 'Failed to update status')
    } finally {
      setUpdatingStatus(false)
    }
  }

  useEffect(() => { loadOrders() }, [loadOrders])
  useEffect(() => { loadStats() }, [])
  useEffect(() => { setPage(1) }, [statusFilter, slaFilter, search, dateFrom, dateTo])

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

  const getStatusBadge = (status: string) => {
    const config = STATUS_COLORS[status] || { bg: 'bg-gray-100', text: 'text-gray-800', icon: Package }
    const Icon = config.icon
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        <Icon className="w-3 h-3" />
        {STATUS_DISPLAY_NAMES[status] || status}
      </span>
    )
  }

  const getSlaIndicator = (order: Order) => {
    if (!order.sla_deadline || order.sla_status === 'completed') return null
    const deadline = new Date(order.sla_deadline)
    const timeRemaining = formatDistanceToNow(deadline, { addSuffix: true })
    return (
      <div className={`flex items-center gap-1 text-xs ${SLA_STATUS_COLORS[order.sla_status]}`}>
        <Timer className="w-3 h-3" />
        {order.sla_status === 'breached' ? <span>SLA Breached</span> : <span>Due {timeRemaining}</span>}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Order Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage orders, track status, and monitor SLA compliance</p>
        </div>
        <button onClick={() => { loadOrders(); loadStats(); }} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Today's Orders</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.today?.orders_today || 0}</p>
                <p className="text-sm text-gray-500 mt-1">{formatCurrency(stats.today?.revenue_today || 0)}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl"><Package className="w-6 h-6 text-blue-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Pending Orders</p>
                <p className="text-2xl font-bold text-yellow-600 mt-1">{(stats.pending || 0) + (stats.confirmed || 0)}</p>
                <p className="text-xs text-gray-400 mt-1">{stats.pending || 0} pending, {stats.confirmed || 0} confirmed</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-xl"><Clock className="w-6 h-6 text-yellow-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">SLA Status</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-lg font-bold text-red-600">{stats.sla?.breached || 0}</span>
                  <span className="text-xs text-gray-400">breached</span>
                  <span className="text-lg font-bold text-yellow-600">{stats.sla?.at_risk || 0}</span>
                  <span className="text-xs text-gray-400">at risk</span>
                </div>
              </div>
              <div className="p-3 bg-red-100 rounded-xl"><AlertTriangle className="w-6 h-6 text-red-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Revenue</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(stats.total_revenue || 0)}</p>
                <p className="text-xs text-gray-400 mt-1">Avg: {formatCurrency(stats.avg_order_value || 0)}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-xl"><TrendingUp className="w-6 h-6 text-green-600" /></div>
            </div>
          </div>
        </div>
      )}

      {stats && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { key: 'all', label: `All (${stats.total_orders || 0})`, colors: { active: 'bg-gray-900 text-white', inactive: 'bg-gray-100 text-gray-700 hover:bg-gray-200' } },
            { key: 'pending', label: `Pending (${stats.pending || 0})`, colors: { active: 'bg-yellow-500 text-white', inactive: 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100' } },
            { key: 'processing', label: `Processing (${stats.processing || 0})`, colors: { active: 'bg-indigo-500 text-white', inactive: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' } },
            { key: 'shipped', label: `Shipped (${stats.shipped || 0})`, colors: { active: 'bg-cyan-500 text-white', inactive: 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100' } },
            { key: 'delivered', label: `Delivered (${stats.delivered || 0})`, colors: { active: 'bg-green-500 text-white', inactive: 'bg-green-50 text-green-700 hover:bg-green-100' } },
            { key: 'cancelled', label: `Cancelled (${stats.cancelled || 0})`, colors: { active: 'bg-red-500 text-white', inactive: 'bg-red-50 text-red-700 hover:bg-red-100' } },
          ].map(btn => (
            <button key={btn.key} onClick={() => setStatusFilter(btn.key)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${statusFilter === btn.key ? btn.colors.active : btn.colors.inactive}`}>
              {btn.label}
            </button>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" placeholder="Search by order number, customer name, or email..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors ${showFilters ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            <Filter className="w-4 h-4" /> Filters
          </button>
        </div>
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SLA Status</label>
              <select value={slaFilter} onChange={(e) => setSlaFilter(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                <option value="all">All</option>
                <option value="on_track">On Track</option>
                <option value="at_risk">At Risk</option>
                <option value="breached">Breached</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div className="flex items-end">
              <button onClick={() => { setStatusFilter('all'); setSlaFilter('all'); setDateFrom(''); setDateTo(''); setSearch(''); }} className="w-full px-4 py-2 text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg">
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64"><RefreshCw className="w-8 h-8 text-blue-500 animate-spin" /></div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Package className="w-12 h-12 mb-3 text-gray-300" /><p>No orders found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Order</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">SLA</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Items</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Date</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{order.order_number}</div>
                    <div className="text-xs text-gray-500">ID: {order.id}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{order.customer_name}</div>
                    <div className="text-xs text-gray-500">{order.customer_email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(order.status)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{getSlaIndicator(order)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.total_items} items</td>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="font-medium text-gray-900">{formatCurrency(order.total_amount)}</div></td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(order.created_at), 'MMM d, yyyy')}
                    <div className="text-xs text-gray-400">{format(new Date(order.created_at), 'h:mm a')}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button onClick={() => loadOrderDetails(order.id)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="View Details">
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
            <div className="text-sm text-gray-500">Showing {(page - 1) * 15 + 1} to {Math.min(page * 15, total)} of {total} orders</div>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"><ChevronLeft className="w-5 h-5" /></button>
              <span className="px-3 py-1 bg-gray-100 rounded-lg text-sm">{page} / {totalPages}</span>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"><ChevronRight className="w-5 h-5" /></button>
            </div>
          </div>
        )}
      </div>

      {showOrderModal && selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowOrderModal(false)} />
            <div className="relative bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:max-w-4xl sm:w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Order {selectedOrder.order_number}</h2>
                  <p className="text-sm text-gray-500">Created {format(new Date(selectedOrder.created_at), 'MMM d, yyyy h:mm a')}</p>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(selectedOrder.status)}
                  <button onClick={() => setShowOrderModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
                </div>
              </div>
              <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h3 className="font-semibold text-gray-900 mb-4">Order Items</h3>
                    <div className="space-y-3">
                      {selectedOrder.items?.map((item) => (
                        <div key={item.id} className="flex items-center gap-4 bg-white rounded-lg p-3">
                          <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                            {item.product_image ? <img src={item.product_image} alt={item.product_name} className="w-full h-full object-cover rounded-lg" /> : <Package className="w-6 h-6 text-gray-400" />}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{item.product_name}</p>
                            {item.sku && <p className="text-xs text-gray-500">SKU: {item.sku}</p>}
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-gray-900">{formatCurrency(item.price * item.quantity)}</p>
                            <p className="text-xs text-gray-500">{item.quantity} x {formatCurrency(item.price)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between">
                      <span className="font-semibold text-gray-900">Total</span>
                      <span className="font-bold text-lg text-gray-900">{formatCurrency(selectedOrder.total_amount)}</span>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h3 className="font-semibold text-gray-900 mb-4">Order Timeline</h3>
                    <div className="space-y-4">
                      {orderTimeline.length === 0 ? <p className="text-sm text-gray-500">No events recorded yet</p> : orderTimeline.map((event, index) => (
                        <div key={event.id} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className={`w-3 h-3 rounded-full ${index === orderTimeline.length - 1 ? 'bg-blue-500' : 'bg-gray-300'}`} />
                            {index < orderTimeline.length - 1 && <div className="w-0.5 h-full bg-gray-200 my-1" />}
                          </div>
                          <div className="flex-1 pb-4">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">{event.new_status_display || event.event_type}</span>
                              <span className="text-xs text-gray-400">{format(new Date(event.created_at), 'MMM d, h:mm a')}</span>
                            </div>
                            {event.notes && <p className="text-sm text-gray-600 mt-1">{event.notes}</p>}
                            <p className="text-xs text-gray-400 mt-1">by {event.actor_name} ({event.actor_type})</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h3 className="font-semibold text-gray-900 mb-4">Customer</h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center"><User className="w-5 h-5 text-blue-600" /></div>
                        <div>
                          <p className="font-medium text-gray-900">{selectedOrder.customer_name}</p>
                          <p className="text-sm text-gray-500">{selectedOrder.customer_email}</p>
                        </div>
                      </div>
                      {selectedOrder.customer_phone && <p className="text-sm text-gray-600">📞 {selectedOrder.customer_phone}</p>}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h3 className="font-semibold text-gray-900 mb-4">Delivery Address</h3>
                    <p className="text-sm text-gray-600">{selectedOrder.delivery_address}<br />{selectedOrder.city}{selectedOrder.postal_code ? `, ${selectedOrder.postal_code}` : ''}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h3 className="font-semibold text-gray-900 mb-4">Payment</h3>
                    <p className="text-sm text-gray-600">{selectedOrder.payment_method || 'Not specified'}</p>
                  </div>
                  {availableTransitions.length > 0 && (
                    <div className="bg-blue-50 rounded-xl p-4">
                      <h3 className="font-semibold text-gray-900 mb-4">Update Status</h3>
                      <div className="space-y-2">
                        {availableTransitions.map((transition) => (
                          <button key={transition.status} onClick={() => { setNewStatus(transition.status); setShowStatusModal(true); }} className="w-full py-2 px-4 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-blue-300 transition-colors text-left">
                            → {transition.display_name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showStatusModal && selectedOrder && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowStatusModal(false)} />
            <div className="relative bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:max-w-md sm:w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Update Order Status</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-2">Change status from <span className="font-medium">{STATUS_DISPLAY_NAMES[selectedOrder.status]}</span> to <span className="font-medium text-blue-600">{STATUS_DISPLAY_NAMES[newStatus]}</span></p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                  <textarea value={statusNotes} onChange={(e) => setStatusNotes(e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="Add notes about this status update..." />
                </div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={notifyCustomer} onChange={(e) => setNotifyCustomer(e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm text-gray-700">Notify customer about this update</span>
                </label>
                <div className="flex gap-3 pt-4">
                  <button onClick={() => setShowStatusModal(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
                  <button onClick={handleStatusUpdate} disabled={updatingStatus} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{updatingStatus ? 'Updating...' : 'Confirm Update'}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
