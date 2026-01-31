import { useState, useEffect } from 'react'
import { FiPlus, FiEdit2, FiTrash2, FiUserCheck, FiUserX, FiShield, FiMail, FiClock, FiActivity } from 'react-icons/fi'
import { adminUsersAPI, rolesAPI } from '../services/api'

interface Role {
  id: number
  name: string
  display_name: string
}

interface Admin {
  id: number
  email: string
  name: string
  role: string
  is_active: boolean
  last_login: string
  created_at: string
  roles: Role[]
  recentActivity?: any[]
}

export default function AdminUsers() {
  const [admins, setAdmins] = useState<Admin[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null)
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null)
  const [filter, setFilter] = useState<'all' | 'active' | 'blocked'>('all')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    roleIds: [] as number[],
  })

  useEffect(() => {
    loadData()
  }, [filter])

  const loadData = async () => {
    try {
      setLoading(true)
      const [adminsRes, rolesRes] = await Promise.all([
        adminUsersAPI.getAll({ status: filter === 'all' ? undefined : filter }),
        rolesAPI.getAll(),
      ])
      setAdmins(adminsRes.data.admins || [])
      setRoles(rolesRes.data.roles || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const openModal = (admin?: Admin) => {
    if (admin) {
      setEditingAdmin(admin)
      setFormData({
        name: admin.name,
        email: admin.email,
        password: '',
        roleIds: admin.roles?.map(r => r.id) || [],
      })
    } else {
      setEditingAdmin(null)
      setFormData({ name: '', email: '', password: '', roleIds: [] })
    }
    setShowModal(true)
  }

  const openDetailModal = async (admin: Admin) => {
    try {
      const res = await adminUsersAPI.getById(admin.id)
      setSelectedAdmin(res.data.admin)
      setShowDetailModal(true)
    } catch (error) {
      console.error('Error loading admin details:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingAdmin) {
        await adminUsersAPI.update(editingAdmin.id, {
          name: formData.name,
          roleIds: formData.roleIds,
        })
      } else {
        if (!formData.password) {
          alert('Password is required for new admin')
          return
        }
        await adminUsersAPI.create(formData)
      }
      setShowModal(false)
      loadData()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error saving admin')
    }
  }

  const toggleStatus = async (admin: Admin) => {
    try {
      await adminUsersAPI.updateStatus(admin.id, !admin.is_active)
      loadData()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error updating status')
    }
  }

  const toggleRole = (roleId: number) => {
    setFormData(prev => ({
      ...prev,
      roleIds: prev.roleIds.includes(roleId)
        ? prev.roleIds.filter(id => id !== roleId)
        : [...prev.roleIds, roleId],
    }))
  }

  const formatDate = (date: string) => {
    if (!date) return 'Never'
    return new Date(date).toLocaleString()
  }

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
          <h1 className="text-2xl font-bold text-gray-900">Admin User Management</h1>
          <p className="mt-1 text-sm text-gray-500">Manage admin accounts and role assignments</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <FiPlus className="mr-2" /> Add Admin
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'active', 'blocked'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg font-medium capitalize transition-colors ${
              filter === status
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Admins Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-6 py-4 font-semibold text-gray-700">Admin</th>
              <th className="text-left px-6 py-4 font-semibold text-gray-700">Roles</th>
              <th className="text-left px-6 py-4 font-semibold text-gray-700">Status</th>
              <th className="text-left px-6 py-4 font-semibold text-gray-700">Last Login</th>
              <th className="text-right px-6 py-4 font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {admins.map((admin) => (
              <tr key={admin.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                      <span className="text-indigo-600 font-semibold">
                        {admin.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="ml-3">
                      <p className="font-medium text-gray-900">{admin.name}</p>
                      <p className="text-sm text-gray-500">{admin.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {admin.roles?.length > 0 ? (
                      admin.roles.map((role) => (
                        <span
                          key={role.id}
                          className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-medium rounded"
                        >
                          {role.display_name}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-400 text-sm">No roles</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      admin.is_active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {admin.is_active ? 'Active' : 'Blocked'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {formatDate(admin.last_login)}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => openDetailModal(admin)}
                      className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="View Details"
                    >
                      <FiActivity size={18} />
                    </button>
                    <button
                      onClick={() => openModal(admin)}
                      className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <FiEdit2 size={18} />
                    </button>
                    <button
                      onClick={() => toggleStatus(admin)}
                      className={`p-2 rounded-lg transition-colors ${
                        admin.is_active
                          ? 'text-gray-600 hover:text-red-600 hover:bg-red-50'
                          : 'text-gray-600 hover:text-green-600 hover:bg-green-50'
                      }`}
                      title={admin.is_active ? 'Block' : 'Unblock'}
                    >
                      {admin.is_active ? <FiUserX size={18} /> : <FiUserCheck size={18} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {admins.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No admin users found</p>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">
              {editingAdmin ? 'Edit Admin' : 'Create New Admin'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              {!editingAdmin && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="Minimum 8 characters"
                      required={!editingAdmin}
                    />
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Assign Roles</label>
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                  {roles.map((role) => (
                    <label
                      key={role.id}
                      className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formData.roleIds.includes(role.id)}
                        onChange={() => toggleRole(role.id)}
                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                      <div className="ml-3">
                        <span className="font-medium text-gray-900">{role.display_name}</span>
                        <span className="text-xs text-gray-500 ml-2">({role.name})</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  {editingAdmin ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Detail Modal */}
      {showDetailModal && selectedAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center">
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
                  <span className="text-indigo-600 font-bold text-2xl">
                    {selectedAdmin.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="ml-4">
                  <h2 className="text-xl font-bold">{selectedAdmin.name}</h2>
                  <p className="text-gray-500">{selectedAdmin.email}</p>
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  selectedAdmin.is_active
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {selectedAdmin.is_active ? 'Active' : 'Blocked'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center text-gray-500 mb-1">
                  <FiClock className="mr-2" size={16} />
                  <span className="text-sm">Last Login</span>
                </div>
                <p className="font-medium">{formatDate(selectedAdmin.last_login)}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center text-gray-500 mb-1">
                  <FiMail className="mr-2" size={16} />
                  <span className="text-sm">Created</span>
                </div>
                <p className="font-medium">{formatDate(selectedAdmin.created_at)}</p>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="font-semibold mb-3 flex items-center">
                <FiShield className="mr-2" /> Assigned Roles
              </h3>
              <div className="flex flex-wrap gap-2">
                {selectedAdmin.roles?.map((role) => (
                  <span
                    key={role.id}
                    className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg font-medium"
                  >
                    {role.display_name}
                  </span>
                ))}
              </div>
            </div>

            {selectedAdmin.recentActivity && selectedAdmin.recentActivity.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 flex items-center">
                  <FiActivity className="mr-2" /> Recent Activity
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedAdmin.recentActivity.map((log: any) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm"
                    >
                      <div>
                        <span className="font-medium capitalize">{log.action}</span>
                        {log.resource_type && (
                          <span className="text-gray-500"> on {log.resource_type}</span>
                        )}
                      </div>
                      <span className="text-gray-400">{formatDate(log.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end mt-6 pt-4 border-t">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
