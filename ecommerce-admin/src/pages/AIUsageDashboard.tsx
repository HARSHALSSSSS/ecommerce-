import { useState, useEffect } from 'react'
import {
  BarChart3,
  DollarSign,
  Sparkles,
  Loader2,
  TrendingUp,
  TrendingDown,
  Calendar,
  Users,
  Image,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Settings,
  Save,
  AlertCircle,
} from 'lucide-react'
import { aiAPI } from '../services/api'
import toast from 'react-hot-toast'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

interface UsageStats {
  usage_date: string
  total_requests: number
  successful_requests: number
  failed_requests: number
  image_requests: number
  description_requests: number
  total_tokens: number
  total_cost_usd: number
}

interface TopUser {
  name: string
  email: string
  total_requests: number
  total_cost: number
}

interface StatusBreakdown {
  status: string
  count: number
  total_cost: number
}

interface AISettings {
  daily_quota_per_user: number
  image_generation_enabled: boolean
  description_generation_enabled: boolean
  auto_approval_enabled: boolean
  cost_per_image_usd?: number
  cost_per_1k_tokens_usd?: number
}

const COLORS = ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6']

export default function AIUsageDashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<UsageStats[]>([])
  const [totalCost, setTotalCost] = useState(0)
  const [totalRequests, setTotalRequests] = useState(0)
  const [topUsers, setTopUsers] = useState<TopUser[]>([])
  const [statusBreakdown, setStatusBreakdown] = useState<StatusBreakdown[]>([])
  const [period, setPeriod] = useState({ start: '', end: '' })
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  })

  // Settings
  const [settings, setSettings] = useState<AISettings | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [apiKey, setApiKey] = useState('')

  useEffect(() => {
    loadData()
    loadSettings()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const response = await aiAPI.getUsageStats({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      })

      setStats(response.data.stats || [])
      setTotalCost(response.data.totalCost || 0)
      setTotalRequests(response.data.totalRequests || 0)
      setTopUsers(response.data.topUsers || [])
      setStatusBreakdown(response.data.statusBreakdown || [])
      setPeriod(response.data.period || { start: '', end: '' })
    } catch (error) {
      console.error('Error loading stats:', error)
      toast.error('Failed to load usage statistics')
    } finally {
      setLoading(false)
    }
  }

  const loadSettings = async () => {
    try {
      const response = await aiAPI.getSettings()
      setSettings(response.data.settings)
    } catch (error) {
      console.error('Error loading settings:', error)
    }
  }

  const handleSaveSettings = async () => {
    if (!settings) return

    setSavingSettings(true)
    try {
      const data: any = {
        daily_quota_per_user: settings.daily_quota_per_user,
        image_generation_enabled: settings.image_generation_enabled,
        description_generation_enabled: settings.description_generation_enabled,
        auto_approval_enabled: settings.auto_approval_enabled,
        cost_per_image_usd: settings.cost_per_image_usd,
        cost_per_1k_tokens_usd: settings.cost_per_1k_tokens_usd,
      }

      if (apiKey.trim()) {
        data.gemini_api_key = apiKey
      }

      await aiAPI.updateSettings(data)
      toast.success('Settings saved successfully')
      setShowSettings(false)
      setApiKey('')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save settings')
    } finally {
      setSavingSettings(false)
    }
  }

  // Calculate summary stats
  const totalImageRequests = stats.reduce((sum, s) => sum + (s.image_requests || 0), 0)
  const totalDescriptionRequests = stats.reduce((sum, s) => sum + (s.description_requests || 0), 0)
  const successRate = totalRequests > 0
    ? ((stats.reduce((sum, s) => sum + (s.successful_requests || 0), 0) / totalRequests) * 100).toFixed(1)
    : '0'

  // Prepare chart data
  const chartData = [...stats].reverse().map(s => ({
    date: new Date(s.usage_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    requests: s.total_requests,
    cost: s.total_cost_usd,
    tokens: s.total_tokens,
  }))

  const typeData = [
    { name: 'Image', value: totalImageRequests, color: '#8b5cf6' },
    { name: 'Description', value: totalDescriptionRequests, color: '#3b82f6' },
  ].filter(d => d.value > 0)

  const statusData = statusBreakdown.map(s => ({
    name: s.status.charAt(0).toUpperCase() + s.status.slice(1),
    value: s.count,
    color: s.status === 'approved' ? '#22c55e' : s.status === 'rejected' ? '#ef4444' : '#f59e0b',
  }))

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-indigo-600" />
            AI Usage Dashboard
          </h1>
          <p className="text-gray-600 mt-1">
            Monitor AI usage, costs, and performance
          </p>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <Settings className="w-4 h-4" />
          Settings
        </button>
      </div>

      {/* Date Range Filter */}
      <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Date Range:</span>
          </div>
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm"
          />
          <span className="text-gray-500">to</span>
          <input
            type="date"
            value={dateRange.endDate}
            onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm"
          />
          <button
            onClick={loadData}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            Apply
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-indigo-600" />
            </div>
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalRequests}</p>
          <p className="text-sm text-gray-600">Total Requests</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <TrendingDown className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">${totalCost.toFixed(2)}</p>
          <p className="text-sm text-gray-600">Total Cost</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{successRate}%</p>
          <p className="text-sm text-gray-600">Success Rate</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{topUsers.length}</p>
          <p className="text-sm text-gray-600">Active Users</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Requests Over Time */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Requests Over Time</h2>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Line type="monotone" dataKey="requests" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500">
              No data available
            </div>
          )}
        </div>

        {/* Cost Over Time */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Cost Over Time</h2>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(value: number) => `$${value.toFixed(4)}`} />
                <Bar dataKey="cost" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500">
              No data available
            </div>
          )}
        </div>
      </div>

      {/* Breakdown Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Type Breakdown */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">By Type</h2>
          {typeData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={typeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {typeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-4">
                {typeData.map((type, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: type.color }} />
                    <span className="text-sm text-gray-600">{type.name}: {type.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-gray-500">
              No data available
            </div>
          )}
        </div>

        {/* Status Breakdown */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">By Status</h2>
          {statusData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-4 flex-wrap">
                {statusData.map((status, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: status.color }} />
                    <span className="text-sm text-gray-600">{status.name}: {status.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-gray-500">
              No data available
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Image className="w-5 h-5 text-purple-600" />
                <span className="text-sm text-gray-700">Image Prompts</span>
              </div>
              <span className="font-semibold text-gray-900">{totalImageRequests}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <span className="text-sm text-gray-700">Descriptions</span>
              </div>
              <span className="font-semibold text-gray-900">{totalDescriptionRequests}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm text-gray-700">Approved</span>
              </div>
              <span className="font-semibold text-gray-900">
                {statusBreakdown.find(s => s.status === 'approved')?.count || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-yellow-600" />
                <span className="text-sm text-gray-700">Pending</span>
              </div>
              <span className="font-semibold text-gray-900">
                {statusBreakdown.find(s => s.status === 'pending')?.count || 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Users */}
      {topUsers.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Users</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Requests</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {topUsers.map((user, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{user.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{user.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{user.total_requests}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">${(user.total_cost || 0).toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && settings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  AI Settings
                </h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* API Key */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gemini API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Leave blank to keep current key"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Daily Quota */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Daily Quota per User
                </label>
                <input
                  type="number"
                  value={settings.daily_quota_per_user}
                  onChange={(e) => setSettings({ ...settings, daily_quota_per_user: parseInt(e.target.value) || 100 })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Toggles */}
              <div className="space-y-3">
                <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer">
                  <span className="text-sm text-gray-700">Image Generation Enabled</span>
                  <input
                    type="checkbox"
                    checked={settings.image_generation_enabled}
                    onChange={(e) => setSettings({ ...settings, image_generation_enabled: e.target.checked })}
                    className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer">
                  <span className="text-sm text-gray-700">Description Generation Enabled</span>
                  <input
                    type="checkbox"
                    checked={settings.description_generation_enabled}
                    onChange={(e) => setSettings({ ...settings, description_generation_enabled: e.target.checked })}
                    className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg cursor-pointer">
                  <div>
                    <span className="text-sm text-gray-700">Auto-Approval</span>
                    <p className="text-xs text-yellow-700">Not recommended</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.auto_approval_enabled}
                    onChange={(e) => setSettings({ ...settings, auto_approval_enabled: e.target.checked })}
                    className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                </label>
              </div>

              {/* Cost Settings */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cost per Image ($)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={settings.cost_per_image_usd || 0.02}
                    onChange={(e) => setSettings({ ...settings, cost_per_image_usd: parseFloat(e.target.value) || 0.02 })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cost per 1K Tokens ($)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={settings.cost_per_1k_tokens_usd || 0.001}
                    onChange={(e) => setSettings({ ...settings, cost_per_1k_tokens_usd: parseFloat(e.target.value) || 0.001 })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Warning */}
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-800">
                  Changes will take effect immediately. Auto-approval bypasses manual review.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex items-center gap-3">
              <button
                onClick={() => setShowSettings(false)}
                className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-indigo-700 disabled:bg-gray-300 transition-colors"
              >
                {savingSettings ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
