import { useState, useEffect, useCallback } from 'react'
import {
  Search,
  Filter,
  Eye,
  Bell,
  Mail,
  MessageSquare,
  Send,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  Calendar,
  Users,
  Smartphone,
  AlertCircle,
} from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { notificationsAPI, customersAPI } from '../services/api'

// Types
interface NotificationLog {
  id: number
  user_id: number | null
  admin_id: number | null
  user_name?: string
  user_email?: string
  admin_name?: string
  notification_type: string
  channel: string
  recipient: string
  subject?: string
  message: string
  related_type?: string
  related_id?: number
  status: string
  sent_at?: string
  delivered_at?: string
  read_at?: string
  failed_reason?: string
  metadata?: string
  created_at: string
}

interface NotificationStats {
  total_count: number
  sent_count: number
  delivered_count: number
  read_count: number
  failed_count: number
  email_count: number
  push_count: number
  sms_count: number
  in_app_count: number
  today_count: number
  type_breakdown: { notification_type: string; count: number }[]
}

const STATUS_COLORS: Record<string, { bg: string; text: string; icon: React.ComponentType<any> }> = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock },
  sent: { bg: 'bg-blue-100', text: 'text-blue-800', icon: Send },
  delivered: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle },
  read: { bg: 'bg-indigo-100', text: 'text-indigo-800', icon: Eye },
  failed: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle },
}

const CHANNEL_ICONS: Record<string, React.ComponentType<any>> = {
  email: Mail,
  push: Smartphone,
  sms: MessageSquare,
  in_app: Bell,
}

const NOTIFICATION_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'order_status_update', label: 'Order Status' },
  { value: 'payment_update', label: 'Payment Update' },
  { value: 'shipping_update', label: 'Shipping Update' },
  { value: 'refund_processed', label: 'Refund Processed' },
  { value: 'credit_note_issued', label: 'Credit Note Issued' },
  { value: 'ticket_update', label: 'Ticket Update' },
  { value: 'admin_message', label: 'Admin Message' },
  { value: 'promotional', label: 'Promotional' },
]

const CHANNELS = [
  { value: 'all', label: 'All Channels' },
  { value: 'email', label: 'Email' },
  { value: 'push', label: 'Push' },
  { value: 'sms', label: 'SMS' },
  { value: 'in_app', label: 'In-App' },
]

export default function Notifications() {
  const [notifications, setNotifications] = useState<NotificationLog[]>([])
  const [stats, setStats] = useState<NotificationStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [channelFilter, setChannelFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedNotification, setSelectedNotification] = useState<NotificationLog | null>(null)
  const [showNotificationModal, setShowNotificationModal] = useState(false)
  const [loadingNotification, setLoadingNotification] = useState(false)
  const [showSendModal, setShowSendModal] = useState(false)
  const [sendUserId, setSendUserId] = useState('')
  const [sendChannel, setSendChannel] = useState('in_app')
  const [sendSubject, setSendSubject] = useState('')
  const [sendMessage, setSendMessage] = useState('')
  const [sending, setSending] = useState(false)

  const loadNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const response = await notificationsAPI.getAll({
        page,
        limit: 20,
        notification_type: typeFilter !== 'all' ? typeFilter : undefined,
        channel: channelFilter !== 'all' ? channelFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: search || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      })
      setNotifications(response.data.notifications)
      setStats(response.data.stats)
      setTotalPages(response.data.pagination.totalPages)
      setTotal(response.data.pagination.total)
    } catch (error) {
      console.error('Failed to load notifications:', error)
      toast.error('Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }, [page, typeFilter, channelFilter, statusFilter, search, startDate, endDate])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  const handleViewNotification = async (notification: NotificationLog) => {
    setLoadingNotification(true)
    setShowNotificationModal(true)
    try {
      const response = await notificationsAPI.getById(notification.id)
      setSelectedNotification(response.data.notification)
    } catch (error) {
      console.error('Failed to load notification details:', error)
      toast.error('Failed to load notification details')
      setShowNotificationModal(false)
    } finally {
      setLoadingNotification(false)
    }
  }

  const handleSendNotification = async () => {
    if (!sendUserId || !sendMessage) {
      toast.error('Please fill in all required fields')
      return
    }
    setSending(true)
    try {
      await notificationsAPI.send({
        user_id: parseInt(sendUserId),
        channel: sendChannel,
        subject: sendSubject || undefined,
        message: sendMessage,
        notification_type: 'admin_message',
      })
      toast.success('Notification sent successfully')
      setShowSendModal(false)
      setSendUserId('')
      setSendChannel('in_app')
      setSendSubject('')
      setSendMessage('')
      loadNotifications()
    } catch (error: any) {
      console.error('Failed to send notification:', error)
      toast.error(error.response?.data?.message || 'Failed to send notification')
    } finally {
      setSending(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    loadNotifications()
  }

  const clearFilters = () => {
    setSearch('')
    setTypeFilter('all')
    setChannelFilter('all')
    setStatusFilter('all')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

  const getChannelIcon = (channel: string) => {
    const Icon = CHANNEL_ICONS[channel] || Bell
    return <Icon className="w-4 h-4" />
  }

  const getNotificationTypeLabel = (type: string) => {
    const found = NOTIFICATION_TYPES.find(t => t.value === type)
    return found ? found.label : type.replace(/_/g, ' ')
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notification Logs</h1>
          <p className="text-gray-500 mt-1">View and manage notification history</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadNotifications}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => setShowSendModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            <Send className="w-4 h-4" />
            Send Notification
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Bell className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Sent</p>
                <p className="text-xl font-bold text-gray-900">{stats.total_count}</p>
                <p className="text-xs text-green-600">+{stats.today_count} today</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Delivered</p>
                <p className="text-xl font-bold text-green-600">{stats.delivered_count}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Eye className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Read</p>
                <p className="text-xl font-bold text-indigo-600">{stats.read_count}</p>
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
                <p className="text-xl font-bold text-red-600">{stats.failed_count}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-1 text-xs">
                <Mail className="w-3 h-3 text-gray-400" />
                <span className="text-gray-600">{stats.email_count}</span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <Smartphone className="w-3 h-3 text-gray-400" />
                <span className="text-gray-600">{stats.push_count}</span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <MessageSquare className="w-3 h-3 text-gray-400" />
                <span className="text-gray-600">{stats.sms_count}</span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <Bell className="w-3 h-3 text-gray-400" />
                <span className="text-gray-600">{stats.in_app_count}</span>
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
              placeholder="Search by subject, message, or recipient..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            {NOTIFICATION_TYPES.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
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
          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
              <select
                value={channelFilter}
                onChange={(e) => { setChannelFilter(e.target.value); setPage(1) }}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                {CHANNELS.map((channel) => (
                  <option key={channel.value} value={channel.value}>{channel.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="sent">Sent</option>
                <option value="delivered">Delivered</option>
                <option value="read">Read</option>
                <option value="failed">Failed</option>
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

      {/* Notifications Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">
                  Recipient
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">
                  Channel
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">
                  Subject / Message
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
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-500">
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Loading notifications...
                    </div>
                  </td>
                </tr>
              ) : notifications.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No notifications found
                  </td>
                </tr>
              ) : (
                notifications.map((notification) => {
                  const statusStyle = STATUS_COLORS[notification.status] || STATUS_COLORS.pending
                  const StatusIcon = statusStyle.icon
                  return (
                    <tr key={notification.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {notification.user_name || notification.recipient}
                        </div>
                        {notification.user_email && (
                          <div className="text-xs text-gray-500">{notification.user_email}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700 capitalize">
                          {getNotificationTypeLabel(notification.notification_type)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {getChannelIcon(notification.channel)}
                          <span className="text-sm text-gray-700 capitalize">
                            {notification.channel.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {notification.subject && (
                          <div className="text-sm font-medium text-gray-900 truncate max-w-xs">
                            {notification.subject}
                          </div>
                        )}
                        <div className="text-xs text-gray-500 truncate max-w-xs">
                          {notification.message}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                          <StatusIcon className="w-3 h-3" />
                          {notification.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {format(new Date(notification.created_at), 'MMM d, HH:mm')}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleViewNotification(notification)}
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
              Showing {((page - 1) * 20) + 1} - {Math.min(page * 20, total)} of {total} notifications
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

      {/* Notification Detail Modal */}
      {showNotificationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Notification Details</h2>
              <button
                onClick={() => { setShowNotificationModal(false); setSelectedNotification(null) }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {loadingNotification ? (
              <div className="p-12 text-center">
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
                <p className="mt-2 text-gray-500">Loading notification details...</p>
              </div>
            ) : selectedNotification ? (
              <div className="p-6 space-y-6">
                {/* Status and Type */}
                <div className="flex justify-between items-start">
                  <div>
                    {(() => {
                      const statusStyle = STATUS_COLORS[selectedNotification.status] || STATUS_COLORS.pending
                      const StatusIcon = statusStyle.icon
                      return (
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                          <StatusIcon className="w-4 h-4" />
                          {selectedNotification.status}
                        </span>
                      )
                    })()}
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    {getChannelIcon(selectedNotification.channel)}
                    <span className="capitalize">{selectedNotification.channel.replace(/_/g, ' ')}</span>
                  </div>
                </div>

                {/* Recipient Info */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Recipient</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Name</p>
                      <p className="font-medium">{selectedNotification.user_name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <p className="font-medium">{selectedNotification.user_email || selectedNotification.recipient}</p>
                    </div>
                  </div>
                </div>

                {/* Message Content */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Message</h3>
                  {selectedNotification.subject && (
                    <div className="mb-3">
                      <p className="text-sm text-gray-500">Subject</p>
                      <p className="font-medium text-gray-900">{selectedNotification.subject}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-500">Content</p>
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedNotification.message}</p>
                  </div>
                </div>

                {/* Type and Related */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Notification Type</p>
                      <p className="font-medium capitalize">
                        {getNotificationTypeLabel(selectedNotification.notification_type)}
                      </p>
                    </div>
                    {selectedNotification.related_type && (
                      <div>
                        <p className="text-sm text-gray-500">Related To</p>
                        <p className="font-medium capitalize">
                          {selectedNotification.related_type} #{selectedNotification.related_id}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Timeline */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Timeline</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Created</span>
                      <span className="font-medium">{format(new Date(selectedNotification.created_at), 'MMM d, yyyy HH:mm:ss')}</span>
                    </div>
                    {selectedNotification.sent_at && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Sent</span>
                        <span className="font-medium">{format(new Date(selectedNotification.sent_at), 'MMM d, yyyy HH:mm:ss')}</span>
                      </div>
                    )}
                    {selectedNotification.delivered_at && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Delivered</span>
                        <span className="font-medium">{format(new Date(selectedNotification.delivered_at), 'MMM d, yyyy HH:mm:ss')}</span>
                      </div>
                    )}
                    {selectedNotification.read_at && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Read</span>
                        <span className="font-medium">{format(new Date(selectedNotification.read_at), 'MMM d, yyyy HH:mm:ss')}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Failure Reason */}
                {selectedNotification.failed_reason && (
                  <div className="bg-red-50 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-semibold text-red-800">Failure Reason</h3>
                        <p className="text-red-700 mt-1">{selectedNotification.failed_reason}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Send Notification Modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="border-b border-gray-100 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Send Notification</h2>
              <button
                onClick={() => { setShowSendModal(false); setSendUserId(''); setSendSubject(''); setSendMessage('') }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User ID *</label>
                <input
                  type="number"
                  value={sendUserId}
                  onChange={(e) => setSendUserId(e.target.value)}
                  placeholder="Enter user ID"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
                <select
                  value={sendChannel}
                  onChange={(e) => setSendChannel(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="in_app">In-App</option>
                  <option value="email">Email</option>
                  <option value="push">Push</option>
                  <option value="sms">SMS</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input
                  type="text"
                  value={sendSubject}
                  onChange={(e) => setSendSubject(e.target.value)}
                  placeholder="Notification subject"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
                <textarea
                  value={sendMessage}
                  onChange={(e) => setSendMessage(e.target.value)}
                  placeholder="Enter notification message"
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { setShowSendModal(false); setSendUserId(''); setSendSubject(''); setSendMessage('') }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendNotification}
                  disabled={sending || !sendUserId || !sendMessage}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {sending ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send
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
