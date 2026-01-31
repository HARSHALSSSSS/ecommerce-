import { useState, useEffect } from 'react'
import { FiActivity, FiFilter, FiDownload, FiUser, FiClock, FiBox, FiShield, FiSettings } from 'react-icons/fi'
import { logsAPI } from '../services/api'

interface Log {
  id: number
  admin_id: number
  admin_name: string
  admin_email: string
  action: string
  resource_type: string
  resource_id: number
  changes: string
  ip_address: string
  created_at: string
}

const ACTION_COLORS: Record<string, string> = {
  login: 'bg-green-100 text-green-700',
  logout: 'bg-gray-100 text-gray-700',
  create: 'bg-blue-100 text-blue-700',
  update: 'bg-amber-100 text-amber-700',
  delete: 'bg-red-100 text-red-700',
  block: 'bg-red-100 text-red-700',
  unblock: 'bg-green-100 text-green-700',
  force_logout: 'bg-orange-100 text-orange-700',
  update_permissions: 'bg-purple-100 text-purple-700',
}

const RESOURCE_ICONS: Record<string, any> = {
  auth: FiShield,
  product: FiBox,
  order: FiActivity,
  user: FiUser,
  admin: FiUser,
  role: FiShield,
  session: FiActivity,
  settings: FiSettings,
}

export default function ActivityLogs() {
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filters, setFilters] = useState({
    action: '',
    resource_type: '',
  })
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    loadLogs()
  }, [page, filters])

  const loadLogs = async () => {
    try {
      setLoading(true)
      const params: any = { page, limit: 30 }
      if (filters.action) params.action = filters.action
      if (filters.resource_type) params.resource_type = filters.resource_type

      const res = await logsAPI.getAll(params)
      setLogs(res.data.logs || [])
      setTotalPages(res.data.pagination?.totalPages || 1)
    } catch (error) {
      console.error('Error loading logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (date: string) => {
    const d = new Date(date)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const minutes = Math.floor(diff / 60000)
    
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes} min ago`
    if (minutes < 1440) return `${Math.floor(minutes / 60)} hours ago`
    return d.toLocaleString()
  }

  const getActionColor = (action: string) => {
    return ACTION_COLORS[action] || 'bg-gray-100 text-gray-700'
  }

  const getResourceIcon = (resourceType: string) => {
    const Icon = RESOURCE_ICONS[resourceType] || FiActivity
    return <Icon size={16} />
  }

  const clearFilters = () => {
    setFilters({ action: '', resource_type: '' })
    setPage(1)
  }

  const exportLogs = () => {
    const csv = [
      ['ID', 'Admin', 'Action', 'Resource', 'IP Address', 'Date'],
      ...logs.map(log => [
        log.id,
        log.admin_name || 'System',
        log.action,
        log.resource_type,
        log.ip_address,
        new Date(log.created_at).toISOString(),
      ]),
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `activity-logs-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activity Logs</h1>
          <p className="mt-1 text-sm text-gray-500">Complete audit trail of admin actions</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center px-4 py-2 border rounded-lg transition-colors ${
              showFilters ? 'border-indigo-600 text-indigo-600' : 'border-gray-300 hover:bg-gray-50'
            }`}
          >
            <FiFilter className="mr-2" /> Filters
          </button>
          <button
            onClick={exportLogs}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <FiDownload className="mr-2" /> Export
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
              <select
                value={filters.action}
                onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Actions</option>
                <option value="login">Login</option>
                <option value="logout">Logout</option>
                <option value="create">Create</option>
                <option value="update">Update</option>
                <option value="delete">Delete</option>
                <option value="block">Block</option>
                <option value="unblock">Unblock</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Resource</label>
              <select
                value={filters.resource_type}
                onChange={(e) => setFilters({ ...filters, resource_type: e.target.value })}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Resources</option>
                <option value="auth">Auth</option>
                <option value="product">Products</option>
                <option value="order">Orders</option>
                <option value="user">Users</option>
                <option value="admin">Admins</option>
                <option value="role">Roles</option>
                <option value="session">Sessions</option>
              </select>
            </div>
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Logs Timeline */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="divide-y divide-gray-100">
          {logs.map((log) => (
            <div key={log.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 flex-shrink-0">
                  {getResourceIcon(log.resource_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900">
                      {log.admin_name || 'System'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${getActionColor(log.action)}`}
                    >
                      {log.action.replace('_', ' ')}
                    </span>
                    {log.resource_type && (
                      <span className="text-gray-500 text-sm capitalize">
                        {log.resource_type}
                        {log.resource_id && ` #${log.resource_id}`}
                      </span>
                    )}
                  </div>
                  {log.changes && (
                    <p className="text-sm text-gray-600 truncate">
                      Changes: {log.changes}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                    <span className="flex items-center">
                      <FiClock className="mr-1" />
                      {formatDate(log.created_at)}
                    </span>
                    {log.ip_address && (
                      <span>IP: {log.ip_address}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {logs.length === 0 && (
          <div className="p-12 text-center">
            <FiActivity className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No Logs Found</h3>
            <p className="text-gray-500">No activity logs match your filters.</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
