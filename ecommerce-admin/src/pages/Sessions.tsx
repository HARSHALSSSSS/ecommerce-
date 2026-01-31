import { useState, useEffect } from 'react'
import { FiMonitor, FiSmartphone, FiGlobe, FiLogOut, FiAlertTriangle, FiClock, FiUser } from 'react-icons/fi'
import { sessionsAPI } from '../services/api'

interface Session {
  id: number
  admin_id: number
  admin_name: string
  admin_email: string
  ip_address: string
  user_agent: string
  device_info: string
  location: string
  is_active: boolean
  last_activity: string
  created_at: string
  expires_at: string
}

export default function Sessions() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmLogout, setConfirmLogout] = useState<number | null>(null)

  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    try {
      setLoading(true)
      const res = await sessionsAPI.getAll()
      setSessions(res.data.sessions || [])
    } catch (error) {
      console.error('Error loading sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  const forceLogout = async (sessionId: number) => {
    try {
      await sessionsAPI.forceLogout(sessionId)
      setConfirmLogout(null)
      loadSessions()
    } catch (error) {
      console.error('Error forcing logout:', error)
    }
  }

  const forceLogoutAll = async (adminId: number) => {
    if (confirm('Are you sure you want to terminate all sessions for this admin?')) {
      try {
        await sessionsAPI.forceLogoutAll(adminId)
        loadSessions()
      } catch (error) {
        console.error('Error forcing logout all:', error)
      }
    }
  }

  const getDeviceIcon = (device: string) => {
    const d = device.toLowerCase()
    if (d.includes('iphone') || d.includes('android')) {
      return <FiSmartphone size={20} />
    }
    return <FiMonitor size={20} />
  }

  const formatDate = (date: string) => {
    if (!date) return 'Unknown'
    const d = new Date(date)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const minutes = Math.floor(diff / 60000)
    
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes} min ago`
    if (minutes < 1440) return `${Math.floor(minutes / 60)} hours ago`
    return d.toLocaleString()
  }

  const isExpiringSoon = (expiresAt: string) => {
    const expires = new Date(expiresAt)
    const now = new Date()
    const hoursLeft = (expires.getTime() - now.getTime()) / (1000 * 60 * 60)
    return hoursLeft < 24
  }

  // Group sessions by admin
  const groupedSessions = sessions.reduce((acc, session) => {
    const key = session.admin_id
    if (!acc[key]) {
      acc[key] = {
        admin_id: session.admin_id,
        admin_name: session.admin_name,
        admin_email: session.admin_email,
        sessions: [],
      }
    }
    acc[key].sessions.push(session)
    return acc
  }, {} as Record<number, { admin_id: number; admin_name: string; admin_email: string; sessions: Session[] }>)

  if (loading) {
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
          <h1 className="text-2xl font-bold text-gray-900">Session Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor and manage active admin sessions
          </p>
        </div>
        <button
          onClick={loadSessions}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active Sessions</p>
              <p className="text-3xl font-bold text-gray-900">{sessions.length}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <FiGlobe className="text-green-600" size={24} />
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Logged In Admins</p>
              <p className="text-3xl font-bold text-gray-900">{Object.keys(groupedSessions).length}</p>
            </div>
            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
              <FiUser className="text-indigo-600" size={24} />
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Expiring Soon</p>
              <p className="text-3xl font-bold text-amber-600">
                {sessions.filter(s => isExpiringSoon(s.expires_at)).length}
              </p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
              <FiAlertTriangle className="text-amber-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Sessions by Admin */}
      <div className="space-y-6">
        {Object.values(groupedSessions).map((group) => (
          <div key={group.admin_id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                  <span className="text-indigo-600 font-semibold">
                    {group.admin_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="ml-3">
                  <p className="font-semibold text-gray-900">{group.admin_name}</p>
                  <p className="text-sm text-gray-500">{group.admin_email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
                  {group.sessions.length} session(s)
                </span>
                {group.sessions.length > 1 && (
                  <button
                    onClick={() => forceLogoutAll(group.admin_id)}
                    className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
                  >
                    Logout All
                  </button>
                )}
              </div>
            </div>

            <div className="divide-y divide-gray-100">
              {group.sessions.map((session) => (
                <div key={session.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600">
                        {getDeviceIcon(session.device_info)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{session.device_info}</p>
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          <span>{session.ip_address}</span>
                          <span>•</span>
                          <span className="flex items-center">
                            <FiClock className="mr-1" size={12} />
                            {formatDate(session.last_activity)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {isExpiringSoon(session.expires_at) && (
                        <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded flex items-center">
                          <FiAlertTriangle className="mr-1" size={12} />
                          Expiring soon
                        </span>
                      )}
                      {confirmLogout === session.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500">Confirm?</span>
                          <button
                            onClick={() => forceLogout(session.id)}
                            className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirmLogout(null)}
                            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmLogout(session.id)}
                          className="flex items-center px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <FiLogOut className="mr-1" size={16} />
                          <span className="text-sm font-medium">Force Logout</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {sessions.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <FiGlobe className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No Active Sessions</h3>
          <p className="text-gray-500">There are no active admin sessions at the moment.</p>
        </div>
      )}
    </div>
  )
}
