import { useState, useEffect } from 'react'
import {
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Loader2,
} from 'lucide-react'
import { dashboardAPI, productsAPI } from '../services/api'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts'
import { format } from 'date-fns'

// Mock data for demonstration
const mockStats = {
  totalRevenue: 45230.50,
  totalOrders: 1234,
  totalUsers: 892,
  totalProducts: 156,
  revenueChange: 12.5,
  ordersChange: 8.2,
  usersChange: 15.3,
  productsChange: -2.4,
}

const mockSalesData = [
  { name: 'Jan', sales: 4000, orders: 240 },
  { name: 'Feb', sales: 3000, orders: 198 },
  { name: 'Mar', sales: 5000, orders: 300 },
  { name: 'Apr', sales: 4500, orders: 280 },
  { name: 'May', sales: 6000, orders: 350 },
  { name: 'Jun', sales: 5500, orders: 320 },
  { name: 'Jul', sales: 7000, orders: 400 },
]

const mockRecentOrders = [
  { id: 1, orderNumber: 'ORD-001', customer: 'John Doe', amount: 125.50, status: 'completed', date: new Date() },
  { id: 2, orderNumber: 'ORD-002', customer: 'Jane Smith', amount: 89.99, status: 'pending', date: new Date() },
  { id: 3, orderNumber: 'ORD-003', customer: 'Bob Johnson', amount: 234.00, status: 'processing', date: new Date() },
  { id: 4, orderNumber: 'ORD-004', customer: 'Alice Brown', amount: 67.50, status: 'completed', date: new Date() },
  { id: 5, orderNumber: 'ORD-005', customer: 'Charlie Wilson', amount: 156.75, status: 'shipped', date: new Date() },
]

const mockTopProducts = [
  { id: 1, name: 'Premium Headphones', sales: 234, revenue: 23400 },
  { id: 2, name: 'Wireless Earbuds', sales: 189, revenue: 9450 },
  { id: 3, name: 'Smart Watch', sales: 156, revenue: 31200 },
  { id: 4, name: 'Laptop Stand', sales: 134, revenue: 5360 },
  { id: 5, name: 'USB-C Hub', sales: 121, revenue: 6050 },
]

function StatCard({
  title,
  value,
  change,
  icon: Icon,
  color,
}: {
  title: string
  value: string
  change: number
  icon: React.ElementType
  color: string
}) {
  const isPositive = change >= 0

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 md:p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-300">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm text-gray-500 mb-1 font-medium">{title}</p>
          <p className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 truncate">{value}</p>
          <div className="flex items-center gap-1 mt-2">
            {isPositive ? (
              <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-green-500 flex-shrink-0" />
            ) : (
              <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4 text-red-500 flex-shrink-0" />
            )}
            <span className={`text-xs sm:text-sm font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {isPositive ? '+' : ''}{change}%
            </span>
            <span className="text-xs sm:text-sm text-gray-400 truncate">vs last month</span>
          </div>
        </div>
        <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${color}`}>
          <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    processing: 'bg-blue-100 text-blue-700',
    shipped: 'bg-purple-100 text-purple-700',
    cancelled: 'bg-red-100 text-red-700',
  }

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-700'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState(mockStats)
  const [salesData, setSalesData] = useState(mockSalesData)
  const [recentOrders, setRecentOrders] = useState(mockRecentOrders)
  const [topProducts, setTopProducts] = useState(mockTopProducts)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true)
      
      // Fetch stats
      try {
        const statsResponse = await dashboardAPI.getStats()
        if (statsResponse.data.success) {
          const s = statsResponse.data.stats
          setStats({
            totalRevenue: s.totalRevenue || 0,
            totalOrders: s.totalOrders || 0,
            totalUsers: s.totalUsers || 0,
            totalProducts: s.totalProducts || 0,
            revenueChange: s.revenueChange || 0,
            ordersChange: s.ordersChange || 0,
            usersChange: s.usersChange || 0,
            productsChange: s.productsChange || 0,
          })
        }
      } catch (e) {
        console.log('Stats fetch failed, using mock data')
      }

      // Fetch sales chart data
      try {
        const salesResponse = await dashboardAPI.getSalesChart()
        if (salesResponse.data.success && salesResponse.data.data) {
          setSalesData(salesResponse.data.data)
        }
      } catch (e) {
        console.log('Sales chart fetch failed, using mock data')
      }

      // Fetch recent orders
      try {
        const ordersResponse = await dashboardAPI.getRecentOrders()
        if (ordersResponse.data.success && ordersResponse.data.orders) {
          setRecentOrders(ordersResponse.data.orders.map((o: { id: number; order_number: string; customer_name: string; total_amount: number; status: string; created_at: string }) => ({
            id: o.id,
            orderNumber: o.order_number,
            customer: o.customer_name || 'Guest',
            amount: o.total_amount,
            status: o.status,
            date: new Date(o.created_at),
          })))
        }
      } catch (e) {
        console.log('Recent orders fetch failed, using mock data')
      }

      // Fetch top products
      try {
        const topProductsResponse = await dashboardAPI.getTopProducts()
        if (topProductsResponse.data.success && topProductsResponse.data.products) {
          setTopProducts(topProductsResponse.data.products.map((p: { id: number; name: string; total_sales: number; revenue: number }) => ({
            id: p.id,
            name: p.name,
            sales: p.total_sales || 0,
            revenue: p.revenue || 0,
          })))
        }
      } catch (e) {
        console.log('Top products fetch failed, using mock data')
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      // Keep mock data on error
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-gray-500 mt-1 text-sm md:text-base">Welcome back! Here's what's happening with your store.</p>
        </div>
        <div className="text-xs md:text-sm text-gray-500 whitespace-nowrap">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard
          title="Total Revenue"
          value={`$${stats.totalRevenue.toLocaleString()}`}
          change={stats.revenueChange}
          icon={DollarSign}
          color="bg-primary"
        />
        <StatCard
          title="Total Orders"
          value={stats.totalOrders.toLocaleString()}
          change={stats.ordersChange}
          icon={ShoppingCart}
          color="bg-blue-500"
        />
        <StatCard
          title="Total Users"
          value={stats.totalUsers.toLocaleString()}
          change={stats.usersChange}
          icon={Users}
          color="bg-green-500"
        />
        <StatCard
          title="Total Products"
          value={stats.totalProducts.toLocaleString()}
          change={stats.productsChange}
          icon={Package}
          color="bg-purple-500"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Sales Chart */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 md:p-6 shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 md:mb-6">
            <h2 className="text-lg md:text-xl font-semibold text-gray-800">Sales Overview</h2>
            <select className="px-3 py-1.5 text-xs sm:text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white">
              <option>Last 7 months</option>
              <option>Last 12 months</option>
              <option>This year</option>
            </select>
          </div>
          <div className="h-64 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="sales"
                  stroke="#E07856"
                  strokeWidth={3}
                  dot={{ fill: '#E07856', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Orders Chart */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 md:p-6 shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 md:mb-6">
            <h2 className="text-lg md:text-xl font-semibold text-gray-800">Orders Overview</h2>
            <select className="px-3 py-1.5 text-xs sm:text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white">
              <option>Last 7 months</option>
              <option>Last 12 months</option>
              <option>This year</option>
            </select>
          </div>
          <div className="h-64 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="orders" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Recent Orders */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 sm:p-5 md:p-6 border-b border-gray-100">
            <h2 className="text-lg md:text-xl font-semibold text-gray-800">Recent Orders</h2>
            <button className="flex items-center gap-1 text-sm text-primary font-medium hover:underline transition-colors">
              View all <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left py-3 px-4 sm:px-6 text-xs font-medium text-gray-600 uppercase">Order</th>
                  <th className="text-left py-3 px-4 sm:px-6 text-xs font-medium text-gray-600 uppercase">Customer</th>
                  <th className="text-left py-3 px-4 sm:px-6 text-xs font-medium text-gray-600 uppercase">Amount</th>
                  <th className="text-left py-3 px-4 sm:px-6 text-xs font-medium text-gray-600 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 sm:px-6">
                      <span className="font-medium text-gray-800 text-xs sm:text-sm">{order.orderNumber}</span>
                    </td>
                    <td className="py-4 px-6 text-gray-600">{order.customer}</td>
                    <td className="py-4 px-6 font-medium text-gray-800">${order.amount.toFixed(2)}</td>
                    <td className="py-4 px-6">
                      <StatusBadge status={order.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800">Top Products</h2>
            <button className="flex items-center gap-1 text-sm text-primary font-medium hover:underline">
              View all <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase">Sales</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((product, index) => (
                  <tr key={product.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0 ? 'bg-yellow-100 text-yellow-700' :
                          index === 1 ? 'bg-gray-100 text-gray-700' :
                          index === 2 ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-50 text-gray-500'
                        }`}>
                          {index + 1}
                        </span>
                        <span className="font-medium text-gray-800">{product.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-gray-600">{product.sales} units</td>
                    <td className="py-4 px-6 font-medium text-gray-800">${product.revenue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
