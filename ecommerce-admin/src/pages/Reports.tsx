import { useState, useEffect } from 'react'
import {
  FiDownload,
  FiRefreshCw,
  FiTrendingUp,
  FiDollarSign,
  FiShoppingCart,
  FiUsers,
  FiPackage,
  FiCalendar,
  FiFileText,
  FiBarChart2,
  FiPieChart,
} from 'react-icons/fi'
import { reportsAPI } from '../services/api'

interface SalesSummary {
  total_orders: number
  total_revenue: number
  average_order_value: number
  unique_customers: number
}

interface DailySales {
  date: string
  orders: number
  revenue: number
}

interface TopProduct {
  id: number
  name: string
  image_url: string
  units_sold: number
  revenue: number
}

interface CategorySales {
  category: string
  orders: number
  units_sold: number
  revenue: number
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState<'sales' | 'tax' | 'orders' | 'customers' | 'inventory'>('sales')
  const [period, setPeriod] = useState('month')
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  
  // Sales data
  const [salesSummary, setSalesSummary] = useState<SalesSummary | null>(null)
  const [dailySales, setDailySales] = useState<DailySales[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [salesByCategory, setSalesByCategory] = useState<CategorySales[]>([])
  
  // Tax data
  const [taxData, setTaxData] = useState<any>(null)
  
  // Orders data
  const [ordersData, setOrdersData] = useState<any>(null)
  
  // Customers data
  const [customersData, setCustomersData] = useState<any>(null)
  
  // Inventory data
  const [inventoryData, setInventoryData] = useState<any>(null)

  useEffect(() => {
    fetchReportData()
  }, [activeTab, period])

  const fetchReportData = async () => {
    setLoading(true)
    try {
      switch (activeTab) {
        case 'sales':
          const salesRes = await reportsAPI.getSalesReport({ period })
          if (salesRes.data.success) {
            const data = salesRes.data.data
            setSalesSummary(data.summary)
            setDailySales(data.daily_sales || [])
            setTopProducts(data.top_products || [])
            setSalesByCategory(data.sales_by_category || [])
          }
          break
        case 'tax':
          const taxRes = await reportsAPI.getTaxReport({ period })
          if (taxRes.data.success) {
            setTaxData(taxRes.data.data)
          }
          break
        case 'orders':
          const ordersRes = await reportsAPI.getOrdersReport({ period })
          if (ordersRes.data.success) {
            setOrdersData(ordersRes.data.data)
          }
          break
        case 'customers':
          const customersRes = await reportsAPI.getCustomersReport({ period })
          if (customersRes.data.success) {
            setCustomersData(customersRes.data.data)
          }
          break
        case 'inventory':
          const inventoryRes = await reportsAPI.getInventoryReport()
          if (inventoryRes.data.success) {
            setInventoryData(inventoryRes.data.data)
          }
          break
      }
    } catch (error) {
      console.error('Error fetching report:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async (format: 'csv' | 'pdf') => {
    setExporting(true)
    try {
      await reportsAPI.exportReport({
        report_type: activeTab,
        format,
        parameters: { period }
      })
      alert(`${activeTab} report exported as ${format.toUpperCase()}`)
    } catch (error) {
      console.error('Error exporting report:', error)
      alert('Failed to export report')
    } finally {
      setExporting(false)
    }
  }

  const handleClearCache = async () => {
    try {
      await reportsAPI.clearCache(activeTab)
      alert('Report cache cleared')
      fetchReportData()
    } catch (error) {
      console.error('Error clearing cache:', error)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0)
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num || 0)
  }

  const tabs = [
    { id: 'sales', label: 'Sales', icon: FiDollarSign },
    { id: 'tax', label: 'Tax', icon: FiFileText },
    { id: 'orders', label: 'Orders', icon: FiShoppingCart },
    { id: 'customers', label: 'Customers', icon: FiUsers },
    { id: 'inventory', label: 'Inventory', icon: FiPackage },
  ]

  const periods = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'Last 7 Days' },
    { value: 'month', label: 'Last 30 Days' },
    { value: 'quarter', label: 'Last 90 Days' },
    { value: 'year', label: 'Last Year' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Reports Dashboard</h1>
          <p className="text-gray-600">Analytics and insights for your store</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleClearCache}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white rounded-lg border hover:bg-gray-50"
          >
            <FiRefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 text-white bg-orange-500 rounded-lg hover:bg-orange-600 disabled:opacity-50"
          >
            <FiDownload className="w-4 h-4" />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* Tabs and Period Filter */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
        {activeTab !== 'inventory' && (
          <div className="flex items-center gap-2">
            <FiCalendar className="text-gray-500" />
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              {periods.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
        </div>
      ) : (
        <>
          {/* Sales Tab */}
          {activeTab === 'sales' && salesSummary && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <FiDollarSign className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Total Revenue</p>
                      <p className="text-2xl font-bold text-gray-800">
                        {formatCurrency(salesSummary.total_revenue)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <FiShoppingCart className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Total Orders</p>
                      <p className="text-2xl font-bold text-gray-800">
                        {formatNumber(salesSummary.total_orders)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-100 rounded-lg">
                      <FiTrendingUp className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Avg Order Value</p>
                      <p className="text-2xl font-bold text-gray-800">
                        {formatCurrency(salesSummary.average_order_value)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-orange-100 rounded-lg">
                      <FiUsers className="w-6 h-6 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Unique Customers</p>
                      <p className="text-2xl font-bold text-gray-800">
                        {formatNumber(salesSummary.unique_customers)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Daily Sales Chart Placeholder */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <FiBarChart2 className="text-orange-500" />
                    Daily Sales Trend
                  </h3>
                  <div className="space-y-2">
                    {dailySales.slice(-7).map((day) => (
                      <div key={day.date} className="flex items-center justify-between py-2 border-b">
                        <span className="text-gray-600">{new Date(day.date).toLocaleDateString()}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-gray-500">{day.orders} orders</span>
                          <span className="font-semibold text-green-600">{formatCurrency(day.revenue)}</span>
                        </div>
                      </div>
                    ))}
                    {dailySales.length === 0 && (
                      <p className="text-center text-gray-500 py-4">No sales data for this period</p>
                    )}
                  </div>
                </div>

                {/* Sales by Category */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <FiPieChart className="text-orange-500" />
                    Sales by Category
                  </h3>
                  <div className="space-y-3">
                    {salesByCategory.map((cat, index) => (
                      <div key={cat.category || index} className="flex items-center justify-between">
                        <span className="text-gray-700">{cat.category || 'Uncategorized'}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-gray-500">{cat.units_sold} units</span>
                          <span className="font-semibold">{formatCurrency(cat.revenue)}</span>
                        </div>
                      </div>
                    ))}
                    {salesByCategory.length === 0 && (
                      <p className="text-center text-gray-500 py-4">No category data available</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Top Products */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <FiPackage className="text-orange-500" />
                  Top Selling Products
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Units Sold</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {topProducts.map((product) => (
                        <tr key={product.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {product.image_url ? (
                                <img src={product.image_url} alt={product.name} className="w-10 h-10 rounded object-cover" />
                              ) : (
                                <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center">
                                  <FiPackage className="text-gray-400" />
                                </div>
                              )}
                              <span className="font-medium">{product.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">{formatNumber(product.units_sold)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-green-600">
                            {formatCurrency(product.revenue)}
                          </td>
                        </tr>
                      ))}
                      {topProducts.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                            No product sales data for this period
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Tax Tab */}
          {activeTab === 'tax' && taxData && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow p-6">
                  <p className="text-sm text-gray-500">Taxable Orders</p>
                  <p className="text-2xl font-bold text-gray-800">{formatNumber(taxData.summary?.taxable_orders || 0)}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <p className="text-sm text-gray-500">Gross Revenue</p>
                  <p className="text-2xl font-bold text-gray-800">{formatCurrency(taxData.summary?.gross_revenue || 0)}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <p className="text-sm text-gray-500">Total Tax Collected</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(taxData.summary?.total_tax_collected || 0)}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <p className="text-sm text-gray-500">Avg Tax per Order</p>
                  <p className="text-2xl font-bold text-gray-800">{formatCurrency(taxData.summary?.average_tax_per_order || 0)}</p>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Daily Tax Collection</h3>
                <div className="space-y-2">
                  {(taxData.daily_tax || []).slice(-10).map((day: any) => (
                    <div key={day.date} className="flex items-center justify-between py-2 border-b">
                      <span className="text-gray-600">{new Date(day.date).toLocaleDateString()}</span>
                      <div className="flex items-center gap-6">
                        <span className="text-sm text-gray-500">{day.orders} orders</span>
                        <span className="text-gray-700">{formatCurrency(day.gross_revenue)}</span>
                        <span className="font-semibold text-green-600">{formatCurrency(day.tax_collected)} tax</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Orders Tab */}
          {activeTab === 'orders' && ordersData && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-xs text-gray-500">Total</p>
                  <p className="text-xl font-bold">{ordersData.summary?.total_orders || 0}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-xs text-gray-500">Completed</p>
                  <p className="text-xl font-bold text-green-600">{ordersData.summary?.completed_orders || 0}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-xs text-gray-500">Pending</p>
                  <p className="text-xl font-bold text-yellow-600">{ordersData.summary?.pending_orders || 0}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-xs text-gray-500">Processing</p>
                  <p className="text-xl font-bold text-blue-600">{ordersData.summary?.processing_orders || 0}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-xs text-gray-500">Shipped</p>
                  <p className="text-xl font-bold text-purple-600">{ordersData.summary?.shipped_orders || 0}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-xs text-gray-500">Cancelled</p>
                  <p className="text-xl font-bold text-red-600">{ordersData.summary?.cancelled_orders || 0}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Orders by Day of Week</h3>
                  <div className="space-y-2">
                    {(ordersData.orders_by_day || []).map((day: any) => (
                      <div key={day.day} className="flex items-center justify-between py-2 border-b">
                        <span>{day.day}</span>
                        <span className="font-semibold">{day.count} orders</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Fulfillment Rate</h3>
                  <div className="flex items-center justify-center h-32">
                    <div className="text-center">
                      <p className="text-4xl font-bold text-green-600">
                        {ordersData.summary?.fulfillment_rate || 0}%
                      </p>
                      <p className="text-gray-500">Order Fulfillment</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Customers Tab */}
          {activeTab === 'customers' && customersData && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg shadow p-6">
                  <p className="text-sm text-gray-500">Total Customers</p>
                  <p className="text-2xl font-bold">{formatNumber(customersData.summary?.total_customers || 0)}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <p className="text-sm text-gray-500">New Customers</p>
                  <p className="text-2xl font-bold text-green-600">{formatNumber(customersData.summary?.new_customers || 0)}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <p className="text-sm text-gray-500">Repeat Customers</p>
                  <p className="text-2xl font-bold text-purple-600">{formatNumber(customersData.summary?.repeat_customers || 0)}</p>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Top Customers by Spending</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Orders</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Spent</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {(customersData.top_customers || []).map((customer: any) => (
                        <tr key={customer.id}>
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium">{customer.name}</p>
                              <p className="text-sm text-gray-500">{customer.email}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">{customer.total_orders}</td>
                          <td className="px-4 py-3 text-right font-semibold text-green-600">
                            {formatCurrency(customer.total_spent)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Inventory Tab */}
          {activeTab === 'inventory' && inventoryData && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-xs text-gray-500">Total Products</p>
                  <p className="text-xl font-bold">{inventoryData.summary?.total_products || 0}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-xs text-gray-500">Total Units</p>
                  <p className="text-xl font-bold">{formatNumber(inventoryData.summary?.total_units || 0)}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-xs text-gray-500">Inventory Value</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(inventoryData.summary?.inventory_value || 0)}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-xs text-gray-500">Low Stock</p>
                  <p className="text-xl font-bold text-yellow-600">{inventoryData.summary?.low_stock || 0}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-xs text-gray-500">Out of Stock</p>
                  <p className="text-xl font-bold text-red-600">{inventoryData.summary?.out_of_stock || 0}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4 text-red-600">Products Needing Reorder</h3>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {(inventoryData.reorder_products || []).map((product: any) => (
                      <div key={product.id} className="flex items-center justify-between py-2 border-b">
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-xs text-gray-500">SKU: {product.sku}</p>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${product.stock_quantity === 0 ? 'text-red-600' : 'text-yellow-600'}`}>
                            {product.stock_quantity} / {product.low_stock_threshold}
                          </p>
                          <p className="text-xs text-gray-500">Reorder: {product.reorder_quantity}</p>
                        </div>
                      </div>
                    ))}
                    {(inventoryData.reorder_products || []).length === 0 && (
                      <p className="text-center text-gray-500 py-4">All products are well stocked!</p>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Inventory by Category</h3>
                  <div className="space-y-3">
                    {(inventoryData.inventory_by_category || []).map((cat: any, index: number) => (
                      <div key={cat.category || index} className="flex items-center justify-between">
                        <span>{cat.category || 'Uncategorized'}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-gray-500">{cat.products} products</span>
                          <span className="text-sm text-gray-500">{formatNumber(cat.total_units)} units</span>
                          <span className="font-semibold">{formatCurrency(cat.value)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
