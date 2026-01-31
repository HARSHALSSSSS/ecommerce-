import { useState, useEffect } from 'react'
import {
  FiSearch,
  FiFilter,
  FiDownload,
  FiEye,
  FiAlertTriangle,
  FiAlertCircle,
  FiInfo,
  FiActivity,
  FiUser,
  FiClock,
  FiX,
  FiChevronLeft,
  FiChevronRight,
} from 'react-icons/fi'
import { auditAPI } from '../services/api'

interface AuditLog {
  id: number
  action_type: string
  entity_type: string
  entity_id: number | null
  admin_id: number | null
  admin_name: string | null
  admin_email: string | null
  user_id: number | null
  user_name: string | null
  ip_address: string | null
  user_agent: string | null
  old_values: string | null
  new_values: string | null
  description: string | null
  severity: 'info' | 'warning' | 'critical'
  created_at: string
}

interface AuditStats {
  total_logs: number
  critical_count: number
  warning_count: number
  info_count: number
  today_count: number
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [stats, setStats] = useState<AuditStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  
  // Filters
  const [showFilters, setShowFilters] = useState(false)
  const [search, setSearch] = useState('')
  const [actionType, setActionType] = useState('')
  const [entityType, setEntityType] = useState('')
  const [severity, setSeverity] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  
  // Filter options
  const [actionTypes, setActionTypes] = useState<string[]>([])
  const [entityTypes, setEntityTypes] = useState<string[]>([])

  useEffect(() => {
    fetchFilterOptions()
  }, [])

  useEffect(() => {
    fetchLogs()
  }, [page, search, actionType, entityType, severity, startDate, endDate])

  const fetchFilterOptions = async () => {
    try {
      const [actionsRes, entitiesRes] = await Promise.all([
        auditAPI.getActionTypes(),
        auditAPI.getEntityTypes()
      ])
      if (actionsRes.data.success) setActionTypes(actionsRes.data.data)
      if (entitiesRes.data.success) setEntityTypes(entitiesRes.data.data)
    } catch (error) {
      console.error('Error fetching filter options:', error)
    }
  }

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const params: any = { page, limit: 50 }
      if (search) params.search = search
      if (actionType) params.action_type = actionType
      if (entityType) params.entity_type = entityType
      if (severity) params.severity = severity
      if (startDate) params.start_date = startDate
      if (endDate) params.end_date = endDate

      const response = await auditAPI.getAll(params)
      if (response.data.success) {
        setLogs(response.data.data)
        setStats(response.data.stats)
        setTotalPages(response.data.pagination.pages)
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    try {
      const response = await auditAPI.export({
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        format: 'csv'
      })
      if (response.data.success) {
        alert(`Exported ${response.data.data.record_count} audit logs`)
      }
    } catch (error) {
      console.error('Error exporting logs:', error)
      alert('Failed to export audit logs')
    }
  }

  const clearFilters = () => {
    setSearch('')
    setActionType('')
    setEntityType('')
    setSeverity('')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <FiAlertTriangle className="w-3 h-3" /> Critical
          </span>
        )
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
            <FiAlertCircle className="w-3 h-3" /> Warning
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
            <FiInfo className="w-3 h-3" /> Info
          </span>
        )
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Audit Logs</h1>
          <p className="text-gray-600">System-wide action tracking (WORM-compliant)</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 text-white bg-orange-500 rounded-lg hover:bg-orange-600"
        >
          <FiDownload className="w-4 h-4" />
          Export Logs
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <FiActivity className="w-5 h-5 text-gray-500" />
              <div>
                <p className="text-sm text-gray-500">Total Logs</p>
                <p className="text-xl font-bold">{stats.total_logs.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <FiClock className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm text-gray-500">Today</p>
                <p className="text-xl font-bold">{stats.today_count}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <FiInfo className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm text-gray-500">Info</p>
                <p className="text-xl font-bold text-blue-600">{stats.info_count}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <FiAlertCircle className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="text-sm text-gray-500">Warnings</p>
                <p className="text-xl font-bold text-yellow-600">{stats.warning_count}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <FiAlertTriangle className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-sm text-gray-500">Critical</p>
                <p className="text-xl font-bold text-red-600">{stats.critical_count}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search logs..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
              showFilters ? 'bg-orange-100 border-orange-500 text-orange-700' : 'bg-white hover:bg-gray-50'
            }`}
          >
            <FiFilter className="w-4 h-4" />
            Filters
          </button>
          {(actionType || entityType || severity || startDate || endDate) && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
            >
              <FiX className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-4 pt-4 border-t">
            <select
              value={actionType}
              onChange={(e) => { setActionType(e.target.value); setPage(1); }}
              className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500"
            >
              <option value="">All Actions</option>
              {actionTypes.map((at) => (
                <option key={at} value={at}>{at}</option>
              ))}
            </select>
            <select
              value={entityType}
              onChange={(e) => { setEntityType(e.target.value); setPage(1); }}
              className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500"
            >
              <option value="">All Entities</option>
              {entityTypes.map((et) => (
                <option key={et} value={et}>{et}</option>
              ))}
            </select>
            <select
              value={severity}
              onChange={(e) => { setSeverity(e.target.value); setPage(1); }}
              className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500"
            >
              <option value="">All Severities</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500"
              placeholder="Start Date"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500"
              placeholder="End Date"
            />
          </div>
        )}
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Timestamp</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Action</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Entity</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Severity</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">{log.action_type}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <span className="text-gray-700">{log.entity_type}</span>
                          {log.entity_id && (
                            <span className="text-gray-500 text-sm ml-1">#{log.entity_id}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {log.admin_name ? (
                          <div className="flex items-center gap-2">
                            <FiUser className="text-gray-400" />
                            <span>{log.admin_name}</span>
                          </div>
                        ) : log.user_name ? (
                          <div className="flex items-center gap-2">
                            <FiUser className="text-gray-400" />
                            <span>{log.user_name}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">System</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                        {log.description || '-'}
                      </td>
                      <td className="px-4 py-3">
                        {getSeverityBadge(log.severity)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="p-2 text-orange-600 hover:bg-orange-50 rounded"
                          title="View Details"
                        >
                          <FiEye />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                        No audit logs found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-sm text-gray-600">
                  Page {page} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                  >
                    <FiChevronLeft />
                  </button>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                  >
                    <FiChevronRight />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Audit Log Details</h2>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-2 hover:bg-gray-100 rounded"
              >
                <FiX />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-sm text-gray-500">ID</label>
                  <p className="font-medium">{selectedLog.id}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Timestamp</label>
                  <p className="font-medium">{formatDate(selectedLog.created_at)}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Action Type</label>
                  <p className="font-medium">{selectedLog.action_type}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Entity</label>
                  <p className="font-medium">
                    {selectedLog.entity_type}
                    {selectedLog.entity_id && ` #${selectedLog.entity_id}`}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Severity</label>
                  <div className="mt-1">{getSeverityBadge(selectedLog.severity)}</div>
                </div>
                <div>
                  <label className="text-sm text-gray-500">IP Address</label>
                  <p className="font-medium">{selectedLog.ip_address || '-'}</p>
                </div>
              </div>

              <div className="mb-4">
                <label className="text-sm text-gray-500">User</label>
                <p className="font-medium">
                  {selectedLog.admin_name || selectedLog.user_name || 'System'}
                  {selectedLog.admin_email && <span className="text-gray-500 ml-2">({selectedLog.admin_email})</span>}
                </p>
              </div>

              <div className="mb-4">
                <label className="text-sm text-gray-500">Description</label>
                <p className="font-medium">{selectedLog.description || '-'}</p>
              </div>

              <div className="mb-4">
                <label className="text-sm text-gray-500">User Agent</label>
                <p className="text-sm text-gray-700 break-all">{selectedLog.user_agent || '-'}</p>
              </div>

              {selectedLog.old_values && (
                <div className="mb-4">
                  <label className="text-sm text-gray-500">Previous Values</label>
                  <pre className="mt-1 p-3 bg-gray-100 rounded text-sm overflow-x-auto">
                    {typeof selectedLog.old_values === 'string' 
                      ? JSON.stringify(JSON.parse(selectedLog.old_values), null, 2)
                      : JSON.stringify(selectedLog.old_values, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.new_values && (
                <div className="mb-4">
                  <label className="text-sm text-gray-500">New Values</label>
                  <pre className="mt-1 p-3 bg-green-50 rounded text-sm overflow-x-auto">
                    {typeof selectedLog.new_values === 'string'
                      ? JSON.stringify(JSON.parse(selectedLog.new_values), null, 2)
                      : JSON.stringify(selectedLog.new_values, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
