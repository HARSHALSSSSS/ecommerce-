import { useState, useEffect } from 'react'
import {
  Package,
  Search,
  AlertTriangle,
  TrendingDown,
  Box,
  CheckCircle,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Edit2,
  History,
  AlertCircle,
} from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { inventoryAPI, productManagementAPI } from '../services/api'

interface InventoryItem {
  id: number
  name: string
  sku: string
  category_name: string | null
  stock_quantity: number
  low_stock_threshold: number
  reorder_quantity: number
  stock_status: string
  last_stock_update: string | null
  is_visible: number
  is_active: number
}

interface LowStockAlert {
  id: number
  product_id: number
  product_name: string
  product_sku: string
  alert_type: string
  threshold: number
  current_stock: number
  is_resolved: number
  resolved_at: string | null
  resolved_by_name: string | null
  created_at: string
}

interface InventoryLog {
  id: number
  product_id: number
  product_name: string
  product_sku: string
  previous_quantity: number
  new_quantity: number
  change_quantity: number
  change_type: string
  reason: string | null
  changed_by_name: string
  created_at: string
}

interface InventoryStats {
  totalProducts: number
  totalInventory: number
  lowStockCount: number
  outOfStockCount: number
  averageStock: number
  unresolvedAlerts: number
}

type TabType = 'overview' | 'alerts' | 'history'

export default function Inventory() {
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [alerts, setAlerts] = useState<LowStockAlert[]>([])
  const [logs, setLogs] = useState<InventoryLog[]>([])
  const [stats, setStats] = useState<InventoryStats | null>(null)
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [stockFilter, setStockFilter] = useState('all')
  const [alertFilter, setAlertFilter] = useState('unresolved')

  // Pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Stock update modal
  const [showStockModal, setShowStockModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [stockUpdate, setStockUpdate] = useState({
    quantity: 0,
    type: 'set' as 'set' | 'add' | 'subtract',
    reason: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadData()
  }, [activeTab, page, search, stockFilter, alertFilter])

  const loadData = async () => {
    setLoading(true)
    try {
      switch (activeTab) {
        case 'overview':
          await loadInventory()
          break
        case 'alerts':
          await loadAlerts()
          break
        case 'history':
          await loadLogs()
          break
      }
      await loadStats()
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Failed to load inventory data')
    } finally {
      setLoading(false)
    }
  }

  const loadInventory = async () => {
    const response = await inventoryAPI.getAll({
      page,
      limit: 15,
      search,
      stockStatus: stockFilter,
    })
    setInventory(response.data.inventory || [])
    setTotalPages(response.data.pagination?.totalPages || 1)
    setTotal(response.data.pagination?.total || 0)
  }

  const loadAlerts = async () => {
    const response = await inventoryAPI.getAlerts({
      page,
      limit: 15,
      status: alertFilter,
    })
    setAlerts(response.data.alerts || [])
    setTotalPages(response.data.pagination?.totalPages || 1)
    setTotal(response.data.pagination?.total || 0)
  }

  const loadLogs = async () => {
    const response = await inventoryAPI.getLogs({
      page,
      limit: 15,
    })
    setLogs(response.data.logs || [])
    setTotalPages(response.data.pagination?.totalPages || 1)
    setTotal(response.data.pagination?.total || 0)
  }

  const loadStats = async () => {
    try {
      const response = await productManagementAPI.getStats()
      const s = response.data.stats
      setStats({
        totalProducts: s.totalProducts,
        totalInventory: s.totalInventory,
        lowStockCount: s.lowStock,
        outOfStockCount: s.outOfStock,
        averageStock: Math.round(s.totalInventory / Math.max(s.totalProducts, 1)),
        unresolvedAlerts: s.unresolvedAlerts,
      })
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const handleOpenStockModal = (item: InventoryItem) => {
    setSelectedItem(item)
    setStockUpdate({
      quantity: item.stock_quantity,
      type: 'set',
      reason: '',
    })
    setShowStockModal(true)
  }

  const handleUpdateStock = async () => {
    if (!selectedItem) return

    setSaving(true)
    try {
      let newQuantity = stockUpdate.quantity
      if (stockUpdate.type === 'add') {
        newQuantity = selectedItem.stock_quantity + stockUpdate.quantity
      } else if (stockUpdate.type === 'subtract') {
        newQuantity = selectedItem.stock_quantity - stockUpdate.quantity
      }

      await inventoryAPI.updateStock(selectedItem.id, {
        quantity: newQuantity,
        reason: stockUpdate.reason,
      })

      toast.success('Stock updated successfully')
      setShowStockModal(false)
      loadData()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update stock')
    } finally {
      setSaving(false)
    }
  }

  const handleResolveAlert = async (alertId: number) => {
    try {
      await inventoryAPI.resolveAlert(alertId)
      toast.success('Alert resolved')
      loadAlerts()
      loadStats()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to resolve alert')
    }
  }

  const getStockBadge = (item: InventoryItem) => {
    if (item.stock_quantity === 0) {
      return <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">Out of Stock</span>
    } else if (item.stock_quantity <= item.low_stock_threshold) {
      return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">Low Stock</span>
    }
    return <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">In Stock</span>
  }

  const getStockPercentage = (item: InventoryItem) => {
    const idealStock = item.low_stock_threshold * 5 // Consider 5x threshold as "full"
    const percentage = Math.min((item.stock_quantity / idealStock) * 100, 100)
    return percentage
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-gray-600 mt-1">Monitor stock levels, alerts, and inventory history</p>
        </div>
        <button
          onClick={() => loadData()}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Products</p>
                <p className="text-xl font-bold text-gray-900">{stats.totalProducts}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Box className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Total Units</p>
                <p className="text-xl font-bold text-gray-900">{stats.totalInventory.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingDown className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Avg Stock</p>
                <p className="text-xl font-bold text-gray-900">{stats.averageStock}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Low Stock</p>
                <p className="text-xl font-bold text-gray-900">{stats.lowStockCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Out of Stock</p>
                <p className="text-xl font-bold text-gray-900">{stats.outOfStockCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Active Alerts</p>
                <p className="text-xl font-bold text-gray-900">{stats.unresolvedAlerts}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="border-b border-gray-100">
          <nav className="flex -mb-px">
            <button
              onClick={() => { setActiveTab('overview'); setPage(1); }}
              className={`px-6 py-4 text-sm font-medium border-b-2 ${
                activeTab === 'overview'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Box className="w-4 h-4" />
                Stock Levels
              </div>
            </button>
            <button
              onClick={() => { setActiveTab('alerts'); setPage(1); }}
              className={`px-6 py-4 text-sm font-medium border-b-2 ${
                activeTab === 'alerts'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Alerts
                {stats && stats.unresolvedAlerts > 0 && (
                  <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {stats.unresolvedAlerts}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => { setActiveTab('history'); setPage(1); }}
              className={`px-6 py-4 text-sm font-medium border-b-2 ${
                activeTab === 'history'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <History className="w-4 h-4" />
                History
              </div>
            </button>
          </nav>
        </div>

        {/* Filters */}
        {activeTab === 'overview' && (
          <div className="p-4 border-b border-gray-100">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search by name or SKU..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value)
                      setPage(1)
                    }}
                  />
                </div>
              </div>
              <select
                value={stockFilter}
                onChange={(e) => {
                  setStockFilter(e.target.value)
                  setPage(1)
                }}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="all">All Stock Levels</option>
                <option value="in_stock">In Stock</option>
                <option value="low_stock">Low Stock</option>
                <option value="out_of_stock">Out of Stock</option>
              </select>
            </div>
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="p-4 border-b border-gray-100">
            <select
              value={alertFilter}
              onChange={(e) => {
                setAlertFilter(e.target.value)
                setPage(1)
              }}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="unresolved">Active Alerts</option>
              <option value="resolved">Resolved Alerts</option>
              <option value="all">All Alerts</option>
            </select>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          </div>
        ) : (
          <>
            {/* Stock Levels Tab */}
            {activeTab === 'overview' && (
              <div className="overflow-x-auto">
                {inventory.length === 0 ? (
                  <div className="text-center py-12">
                    <Box className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No inventory items found</p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Product</th>
                        <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">SKU</th>
                        <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Category</th>
                        <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Stock Level</th>
                        <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Threshold</th>
                        <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Status</th>
                        <th className="text-right py-4 px-6 text-sm font-medium text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {inventory.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="py-4 px-6">
                            <p className="font-medium text-gray-900 max-w-[200px] truncate">{item.name}</p>
                            <p className="text-sm text-gray-500">ID: {item.id}</p>
                          </td>
                          <td className="py-4 px-6">
                            <code className="text-sm bg-gray-100 px-2 py-1 rounded">{item.sku || '-'}</code>
                          </td>
                          <td className="py-4 px-6 text-gray-600 text-sm">{item.category_name || '-'}</td>
                          <td className="py-4 px-6">
                            <div className="w-32">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium text-gray-900">{item.stock_quantity}</span>
                              </div>
                              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    item.stock_quantity === 0
                                      ? 'bg-red-500'
                                      : item.stock_quantity <= item.low_stock_threshold
                                      ? 'bg-yellow-500'
                                      : 'bg-green-500'
                                  }`}
                                  style={{ width: `${getStockPercentage(item)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-gray-600 text-sm">
                            <div>
                              <p>Low: {item.low_stock_threshold}</p>
                              <p className="text-xs text-gray-400">Reorder: {item.reorder_quantity}</p>
                            </div>
                          </td>
                          <td className="py-4 px-6">{getStockBadge(item)}</td>
                          <td className="py-4 px-6">
                            <div className="flex items-center justify-end">
                              <button
                                onClick={() => handleOpenStockModal(item)}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                                Update
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Alerts Tab */}
            {activeTab === 'alerts' && (
              <div className="overflow-x-auto">
                {alerts.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
                    <p className="text-gray-500">
                      {alertFilter === 'unresolved' ? 'No active alerts' : 'No alerts found'}
                    </p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Product</th>
                        <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Alert Type</th>
                        <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Current Stock</th>
                        <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Threshold</th>
                        <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Created</th>
                        <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Status</th>
                        <th className="text-right py-4 px-6 text-sm font-medium text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {alerts.map((alert) => (
                        <tr key={alert.id} className="hover:bg-gray-50">
                          <td className="py-4 px-6">
                            <p className="font-medium text-gray-900">{alert.product_name}</p>
                            <p className="text-sm text-gray-500">{alert.product_sku}</p>
                          </td>
                          <td className="py-4 px-6">
                            <span className={`px-2 py-1 rounded text-xs ${
                              alert.alert_type === 'out_of_stock'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {alert.alert_type === 'out_of_stock' ? 'Out of Stock' : 'Low Stock'}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <span className={`font-medium ${alert.current_stock === 0 ? 'text-red-600' : 'text-yellow-600'}`}>
                              {alert.current_stock}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-gray-600">{alert.threshold}</td>
                          <td className="py-4 px-6 text-gray-600 text-sm">
                            {format(new Date(alert.created_at), 'MMM d, yyyy HH:mm')}
                          </td>
                          <td className="py-4 px-6">
                            {alert.is_resolved ? (
                              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                                Resolved
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full">
                                Active
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center justify-end gap-2">
                              {!alert.is_resolved && (
                                <button
                                  onClick={() => handleResolveAlert(alert.id)}
                                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  Resolve
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div className="overflow-x-auto">
                {logs.length === 0 ? (
                  <div className="text-center py-12">
                    <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No inventory changes recorded</p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Product</th>
                        <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Change</th>
                        <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Quantity</th>
                        <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Type</th>
                        <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Reason</th>
                        <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Changed By</th>
                        <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="py-4 px-6">
                            <p className="font-medium text-gray-900">{log.product_name}</p>
                            <p className="text-sm text-gray-500">{log.product_sku}</p>
                          </td>
                          <td className="py-4 px-6">
                            <span className={`font-medium ${log.change_quantity >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {log.change_quantity >= 0 ? '+' : ''}{log.change_quantity}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-gray-600">
                            {log.previous_quantity} → {log.new_quantity}
                          </td>
                          <td className="py-4 px-6">
                            <span className={`px-2 py-1 rounded text-xs ${
                              log.change_type === 'restock'
                                ? 'bg-green-100 text-green-700'
                                : log.change_type === 'sale'
                                ? 'bg-blue-100 text-blue-700'
                                : log.change_type === 'adjustment'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {log.change_type}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-gray-600 text-sm max-w-[150px] truncate">
                            {log.reason || '-'}
                          </td>
                          <td className="py-4 px-6 text-gray-600 text-sm">
                            {log.changed_by_name || 'System'}
                          </td>
                          <td className="py-4 px-6 text-gray-600 text-sm">
                            {format(new Date(log.created_at), 'MMM d, yyyy HH:mm')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
                <p className="text-sm text-gray-600">
                  Showing {(page - 1) * 15 + 1} to {Math.min(page * 15, total)} of {total} items
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                    className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="px-4 py-2 text-sm text-gray-600">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page === totalPages}
                    className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Stock Update Modal */}
      {showStockModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900">Update Stock</h2>
              <button
                onClick={() => setShowStockModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="font-medium text-gray-900">{selectedItem.name}</p>
                <p className="text-sm text-gray-500">Current stock: {selectedItem.stock_quantity}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Update Type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStockUpdate({ ...stockUpdate, type: 'set' })}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${
                      stockUpdate.type === 'set'
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    Set to
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockUpdate({ ...stockUpdate, type: 'add' })}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${
                      stockUpdate.type === 'add'
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockUpdate({ ...stockUpdate, type: 'subtract' })}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${
                      stockUpdate.type === 'subtract'
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    Subtract
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input
                  type="number"
                  min="0"
                  value={stockUpdate.quantity}
                  onChange={(e) => setStockUpdate({ ...stockUpdate, quantity: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                {stockUpdate.type !== 'set' && (
                  <p className="text-sm text-gray-500 mt-1">
                    New stock will be: {stockUpdate.type === 'add'
                      ? selectedItem.stock_quantity + stockUpdate.quantity
                      : Math.max(0, selectedItem.stock_quantity - stockUpdate.quantity)
                    }
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
                <input
                  type="text"
                  value={stockUpdate.reason}
                  onChange={(e) => setStockUpdate({ ...stockUpdate, reason: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="e.g., Restock from supplier, Damaged goods..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowStockModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateStock}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Update Stock
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
