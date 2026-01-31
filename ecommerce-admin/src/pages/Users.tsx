import { useState, useEffect } from 'react'
import {
  Search,
  Eye,
  Users as UsersIcon,
  X,
  Mail,
  Phone,
  MapPin,
  Calendar,
  ShoppingBag,
  Ban,
  CheckCircle,
  Activity,
  Bell,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Clock,
  DollarSign,
  Loader2,
} from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { customersAPI } from '../services/api'

interface User {
  id: number
  name: string
  email: string
  phone: string | null
  address: string | null
  city: string | null
  is_active: boolean
  is_blocked: boolean
  block_reason?: string
  created_at: string
  order_count: number
  total_spent: number
  last_activity?: string
}

interface UserDetail {
  id: number
  name: string
  email: string
  phone: string | null
  address: string | null
  city: string | null
  country: string | null
  postal_code: string | null
  is_active: boolean
  is_blocked: boolean
  order_count: number
  total_spent: number
  created_at: string
}

interface Order {
  id: number
  order_number: string
  total_amount: number
  status: string
  created_at: string
}

interface Ticket {
  id: number
  ticket_number: string
  subject: string
  category: string
  priority: string
  status: string
  created_at: string
}

interface BlockHistory {
  id: number
  reason: string
  blocked_at: string
  blocked_by_name: string
  unblocked_at?: string
  unblocked_by_name?: string
  unblock_reason?: string
  is_active: boolean
}

interface NotificationPreferences {
  email_marketing: number
  email_orders: number
  email_promotions: number
  push_enabled: number
  push_orders: number
  push_promotions: number
  sms_enabled: number
  sms_orders: number
  consent_date?: string
  consent_source?: string
}

interface ActivityLog {
  id: number
  action: string
  action_type: string
  ip_address: string
  device_info: string
  created_at: string
}

interface Stats {
  totalUsers: number
  activeUsers: number
  blockedUsers: number
  newUsersToday: number
  newUsersThisWeek: number
  openTickets: number
}

type TabType = 'overview' | 'orders' | 'tickets' | 'activity' | 'preferences'

export default function Users() {
  const [users, setUsers] = useState<User[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null)
  const [userOrders, setUserOrders] = useState<Order[]>([])
  const [userTickets, setUserTickets] = useState<Ticket[]>([])
  const [userActivity, setUserActivity] = useState<ActivityLog[]>([])
  const [blockHistory, setBlockHistory] = useState<BlockHistory[]>([])
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [showBlockModal, setShowBlockModal] = useState(false)
  const [showUnblockModal, setShowUnblockModal] = useState(false)
  const [blockReason, setBlockReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activityPage, setActivityPage] = useState(1)
  const [activityTotalPages, setActivityTotalPages] = useState(1)

  // Fetch users
  const fetchUsers = async () => {
    try {
      setIsLoading(true)
      const response = await customersAPI.getAll({
        page: currentPage,
        limit: 10,
        search: searchQuery,
        status: statusFilter === 'all' ? undefined : statusFilter,
      })
      if (response.data.success) {
        setUsers(response.data.users)
        setTotalPages(response.data.pagination.totalPages)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
      toast.error('Failed to fetch users')
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch stats
  const fetchStats = async () => {
    try {
      const response = await customersAPI.getStats()
      if (response.data.success) {
        setStats(response.data.stats)
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  useEffect(() => {
    fetchUsers()
    fetchStats()
  }, [currentPage, statusFilter])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentPage === 1) {
        fetchUsers()
      } else {
        setCurrentPage(1)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Fetch user detail
  const handleViewUser = async (userId: number) => {
    try {
      const response = await customersAPI.getById(userId)
      if (response.data.success) {
        setSelectedUser(response.data.user)
        setUserOrders(response.data.orders || [])
        setUserTickets(response.data.tickets || [])
        setBlockHistory(response.data.blockHistory || [])
        setPreferences(response.data.preferences)
        setActiveTab('overview')
        // Fetch activity logs
        fetchUserActivity(userId, 1)
      }
    } catch (error) {
      console.error('Error fetching user:', error)
      toast.error('Failed to fetch user details')
    }
  }

  // Fetch user activity logs
  const fetchUserActivity = async (userId: number, page: number) => {
    try {
      const response = await customersAPI.getActivity(userId, { page, limit: 20 })
      if (response.data.success) {
        setUserActivity(response.data.logs)
        setActivityPage(page)
        setActivityTotalPages(response.data.pagination.totalPages)
      }
    } catch (error) {
      console.error('Error fetching activity:', error)
    }
  }

  // Block user
  const handleBlockUser = async () => {
    if (!selectedUser || blockReason.trim().length < 10) {
      toast.error('Please provide a reason (minimum 10 characters)')
      return
    }

    try {
      setIsSubmitting(true)
      const response = await customersAPI.block(selectedUser.id, blockReason)
      if (response.data.success) {
        toast.success('User blocked successfully')
        setShowBlockModal(false)
        setBlockReason('')
        handleViewUser(selectedUser.id)
        fetchUsers()
        fetchStats()
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to block user')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Unblock user
  const handleUnblockUser = async () => {
    if (!selectedUser || blockReason.trim().length < 10) {
      toast.error('Please provide a reason (minimum 10 characters)')
      return
    }

    try {
      setIsSubmitting(true)
      const response = await customersAPI.unblock(selectedUser.id, blockReason)
      if (response.data.success) {
        toast.success('User unblocked successfully')
        setShowUnblockModal(false)
        setBlockReason('')
        handleViewUser(selectedUser.id)
        fetchUsers()
        fetchStats()
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to unblock user')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      shipped: 'bg-purple-100 text-purple-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      open: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      resolved: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800',
    }
    return styles[status] || 'bg-gray-100 text-gray-800'
  }

  const getPriorityBadge = (priority: string) => {
    const styles: Record<string, string> = {
      urgent: 'bg-red-100 text-red-800',
      high: 'bg-orange-100 text-orange-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-gray-100 text-gray-800',
    }
    return styles[priority] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Customer Management</h1>
          <p className="text-gray-500">View and manage customer accounts</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <UsersIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-800">{stats?.totalUsers || 0}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-800">{stats?.activeUsers || 0}</p>
              <p className="text-xs text-gray-500">Active</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <Ban className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-800">{stats?.blockedUsers || 0}</p>
              <p className="text-xs text-gray-500">Blocked</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-800">{stats?.newUsersToday || 0}</p>
              <p className="text-xs text-gray-500">Today</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-800">{stats?.newUsersThisWeek || 0}</p>
              <p className="text-xs text-gray-500">This Week</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-800">{stats?.openTickets || 0}</p>
              <p className="text-xs text-gray-500">Open Tickets</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button
              className={`px-4 py-2 rounded-lg transition-colors ${statusFilter === 'all' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              onClick={() => setStatusFilter('all')}
            >
              All
            </button>
            <button
              className={`px-4 py-2 rounded-lg transition-colors ${statusFilter === 'active' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              onClick={() => setStatusFilter('active')}
            >
              Active
            </button>
            <button
              className={`px-4 py-2 rounded-lg transition-colors ${statusFilter === 'blocked' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              onClick={() => setStatusFilter('blocked')}
            >
              Blocked
            </button>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Orders</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Total Spent</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Last Activity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                            <span className="text-gray-600 font-medium">{user.name.charAt(0).toUpperCase()}</span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">{user.name}</p>
                            <p className="text-xs text-gray-500">ID: #{user.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm text-gray-600">{user.email}</p>
                        <p className="text-xs text-gray-400">{user.phone || 'No phone'}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-gray-800 font-medium">{user.order_count}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-gray-800 font-medium">${(user.total_spent || 0).toFixed(2)}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.is_blocked ? (
                          <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">Blocked</span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Active</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500">
                          {user.last_activity ? format(new Date(user.last_activity), 'MMM d, yyyy') : 'Never'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleViewUser(user.id)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Page {currentPage} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-xl font-bold text-gray-600">{selectedUser.name.charAt(0).toUpperCase()}</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">{selectedUser.name}</h2>
                  <p className="text-sm text-gray-500">Customer ID: #{selectedUser.id}</p>
                </div>
                {blockHistory.some((b) => b.is_active) ? (
                  <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">Blocked</span>
                ) : (
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">Active</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {blockHistory.some((b) => b.is_active) ? (
                  <button
                    onClick={() => setShowUnblockModal(true)}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Unblock User
                  </button>
                ) : (
                  <button
                    onClick={() => setShowBlockModal(true)}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2"
                  >
                    <Ban className="w-4 h-4" />
                    Block User
                  </button>
                )}
                <button onClick={() => setSelectedUser(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 px-6">
              {[
                { id: 'overview', label: 'Overview', icon: UsersIcon },
                { id: 'orders', label: 'Orders', icon: ShoppingBag },
                { id: 'tickets', label: 'Support Tickets', icon: MessageSquare },
                { id: 'activity', label: 'Activity Log', icon: Activity },
                { id: 'preferences', label: 'Notifications', icon: Bell },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* User Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h3 className="font-semibold text-gray-800">Contact Information</h3>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 text-gray-600">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span>{selectedUser.email}</span>
                        </div>
                        <div className="flex items-center gap-3 text-gray-600">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span>{selectedUser.phone || 'Not provided'}</span>
                        </div>
                        <div className="flex items-center gap-3 text-gray-600">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span>
                            {selectedUser.address || 'No address'}
                            {selectedUser.city && `, ${selectedUser.city}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-gray-600">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span>Joined {format(new Date(selectedUser.created_at), 'MMMM d, yyyy')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h3 className="font-semibold text-gray-800">Statistics</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-blue-50 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <ShoppingBag className="w-4 h-4 text-blue-600" />
                            <span className="text-sm text-blue-600">Orders</span>
                          </div>
                          <p className="text-2xl font-bold text-gray-800">{selectedUser.order_count}</p>
                        </div>
                        <div className="bg-green-50 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <DollarSign className="w-4 h-4 text-green-600" />
                            <span className="text-sm text-green-600">Total Spent</span>
                          </div>
                          <p className="text-2xl font-bold text-gray-800">${(selectedUser.total_spent || 0).toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Block History */}
                  {blockHistory.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        Block History
                      </h3>
                      <div className="space-y-3">
                        {blockHistory.map((block) => (
                          <div
                            key={block.id}
                            className={`p-4 rounded-lg border ${block.is_active ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium text-gray-800">
                                  Blocked by {block.blocked_by_name}
                                </p>
                                <p className="text-sm text-gray-600 mt-1">{block.reason}</p>
                                <p className="text-xs text-gray-400 mt-2">
                                  {format(new Date(block.blocked_at), 'MMM d, yyyy h:mm a')}
                                </p>
                              </div>
                              {block.is_active ? (
                                <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">Active</span>
                              ) : (
                                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">Resolved</span>
                              )}
                            </div>
                            {block.unblocked_at && (
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <p className="text-sm text-gray-600">
                                  Unblocked by {block.unblocked_by_name} - {block.unblock_reason}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                  {format(new Date(block.unblocked_at), 'MMM d, yyyy h:mm a')}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Orders Tab */}
              {activeTab === 'orders' && (
                <div className="space-y-4">
                  {userOrders.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <ShoppingBag className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No orders found</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {userOrders.map((order) => (
                        <div key={order.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-800">{order.order_number}</p>
                            <p className="text-sm text-gray-500">{format(new Date(order.created_at), 'MMM d, yyyy')}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-gray-800">${order.total_amount.toFixed(2)}</p>
                            <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(order.status)}`}>
                              {order.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tickets Tab */}
              {activeTab === 'tickets' && (
                <div className="space-y-4">
                  {userTickets.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No support tickets found</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {userTickets.map((ticket) => (
                        <div key={ticket.id} className="p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-gray-800">{ticket.subject}</p>
                              <p className="text-sm text-gray-500">{ticket.ticket_number}</p>
                            </div>
                            <div className="flex gap-2">
                              <span className={`px-2 py-1 text-xs rounded-full ${getPriorityBadge(ticket.priority)}`}>
                                {ticket.priority}
                              </span>
                              <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(ticket.status)}`}>
                                {ticket.status}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-gray-400 mt-2">{format(new Date(ticket.created_at), 'MMM d, yyyy')}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Activity Tab */}
              {activeTab === 'activity' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">
                    Activity logs are anonymized for GDPR compliance. IP addresses are partially masked.
                  </p>
                  {userActivity.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Activity className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No activity logs found</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3">
                        {userActivity.map((log) => (
                          <div key={log.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <Activity className="w-5 h-5 text-blue-600" />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-gray-800">{log.action}</p>
                              <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                                {log.action_type && <span className="bg-gray-200 px-2 py-0.5 rounded">{log.action_type}</span>}
                                {log.ip_address && <span>IP: {log.ip_address}</span>}
                                {log.device_info && <span>Device: {log.device_info}</span>}
                              </div>
                            </div>
                            <span className="text-xs text-gray-400">{format(new Date(log.created_at), 'MMM d, h:mm a')}</span>
                          </div>
                        ))}
                      </div>
                      {activityTotalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 pt-4">
                          <button
                            onClick={() => selectedUser && fetchUserActivity(selectedUser.id, activityPage - 1)}
                            disabled={activityPage === 1}
                            className="p-2 rounded-lg border disabled:opacity-50"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <span className="text-sm text-gray-500">
                            Page {activityPage} of {activityTotalPages}
                          </span>
                          <button
                            onClick={() => selectedUser && fetchUserActivity(selectedUser.id, activityPage + 1)}
                            disabled={activityPage === activityTotalPages}
                            className="p-2 rounded-lg border disabled:opacity-50"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Preferences Tab */}
              {activeTab === 'preferences' && preferences && (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-800">Email Notifications</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className={`p-4 rounded-lg border ${preferences.email_marketing ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                        <p className="font-medium text-gray-800">Marketing</p>
                        <p className="text-sm text-gray-500">{preferences.email_marketing ? 'Opted In' : 'Opted Out'}</p>
                      </div>
                      <div className={`p-4 rounded-lg border ${preferences.email_orders ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                        <p className="font-medium text-gray-800">Order Updates</p>
                        <p className="text-sm text-gray-500">{preferences.email_orders ? 'Opted In' : 'Opted Out'}</p>
                      </div>
                      <div className={`p-4 rounded-lg border ${preferences.email_promotions ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                        <p className="font-medium text-gray-800">Promotions</p>
                        <p className="text-sm text-gray-500">{preferences.email_promotions ? 'Opted In' : 'Opted Out'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-800">Push Notifications</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className={`p-4 rounded-lg border ${preferences.push_enabled ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                        <p className="font-medium text-gray-800">Push Enabled</p>
                        <p className="text-sm text-gray-500">{preferences.push_enabled ? 'Yes' : 'No'}</p>
                      </div>
                      <div className={`p-4 rounded-lg border ${preferences.push_orders ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                        <p className="font-medium text-gray-800">Order Updates</p>
                        <p className="text-sm text-gray-500">{preferences.push_orders ? 'Opted In' : 'Opted Out'}</p>
                      </div>
                      <div className={`p-4 rounded-lg border ${preferences.push_promotions ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                        <p className="font-medium text-gray-800">Promotions</p>
                        <p className="text-sm text-gray-500">{preferences.push_promotions ? 'Opted In' : 'Opted Out'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-800">SMS Notifications</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className={`p-4 rounded-lg border ${preferences.sms_enabled ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                        <p className="font-medium text-gray-800">SMS Enabled</p>
                        <p className="text-sm text-gray-500">{preferences.sms_enabled ? 'Yes' : 'No'}</p>
                      </div>
                      <div className={`p-4 rounded-lg border ${preferences.sms_orders ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                        <p className="font-medium text-gray-800">Order Updates</p>
                        <p className="text-sm text-gray-500">{preferences.sms_orders ? 'Opted In' : 'Opted Out'}</p>
                      </div>
                    </div>
                  </div>

                  {preferences.consent_date && (
                    <div className="pt-4 border-t border-gray-100">
                      <p className="text-sm text-gray-500">
                        Consent provided on {format(new Date(preferences.consent_date), 'MMMM d, yyyy')}
                        {preferences.consent_source && ` via ${preferences.consent_source}`}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Block Modal */}
      {showBlockModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Ban className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">Block User</h3>
                <p className="text-sm text-gray-500">This will prevent the user from accessing their account</p>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for blocking <span className="text-red-500">*</span>
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                rows={4}
                placeholder="Please provide a detailed reason (minimum 10 characters)..."
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">{blockReason.length}/10 characters minimum</p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowBlockModal(false)
                  setBlockReason('')
                }}
                className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBlockUser}
                disabled={isSubmitting || blockReason.trim().length < 10}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Block User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unblock Modal */}
      {showUnblockModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">Unblock User</h3>
                <p className="text-sm text-gray-500">This will restore the user's access to their account</p>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for unblocking <span className="text-red-500">*</span>
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                rows={4}
                placeholder="Please provide a detailed reason (minimum 10 characters)..."
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">{blockReason.length}/10 characters minimum</p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowUnblockModal(false)
                  setBlockReason('')
                }}
                className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUnblockUser}
                disabled={isSubmitting || blockReason.trim().length < 10}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Unblock User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
