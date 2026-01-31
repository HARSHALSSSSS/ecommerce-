import { useState, useEffect } from 'react'
import { FiPlus, FiEdit2, FiTrash2, FiShield, FiUsers, FiCheck, FiX } from 'react-icons/fi'
import { rolesAPI, permissionsAPI } from '../services/api'

interface Permission {
  id: number
  module: string
  action: string
  name: string
  description: string
}

interface Role {
  id: number
  name: string
  display_name: string
  description: string
  is_system: boolean
  is_active: boolean
  admin_count: number
  permissions: Permission[]
  created_at: string
}

export default function Roles() {
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showPermissionModal, setShowPermissionModal] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [permissionMatrix, setPermissionMatrix] = useState<{ module: string; permissions: Record<string, { id: number; enabled: boolean }> }[]>([])
  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
    description: '',
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [rolesRes, permsRes] = await Promise.all([
        rolesAPI.getAll(),
        permissionsAPI.getAll(),
      ])
      setRoles(rolesRes.data.roles || [])
      setPermissions(permsRes.data.permissions || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const openModal = (role?: Role) => {
    if (role) {
      setEditingRole(role)
      setFormData({
        name: role.name,
        display_name: role.display_name,
        description: role.description || '',
      })
    } else {
      setEditingRole(null)
      setFormData({ name: '', display_name: '', description: '' })
    }
    setShowModal(true)
  }

  const openPermissionModal = async (role: Role) => {
    setSelectedRole(role)
    try {
      const res = await permissionsAPI.getMatrix(role.id)
      setPermissionMatrix(res.data.matrix || [])
      setShowPermissionModal(true)
    } catch (error) {
      console.error('Error loading permission matrix:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingRole) {
        await rolesAPI.update(editingRole.id, {
          display_name: formData.display_name,
          description: formData.description,
        })
      } else {
        await rolesAPI.create(formData)
      }
      setShowModal(false)
      loadData()
    } catch (error) {
      console.error('Error saving role:', error)
    }
  }

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this role?')) {
      try {
        await rolesAPI.delete(id)
        loadData()
      } catch (error: any) {
        alert(error.response?.data?.message || 'Error deleting role')
      }
    }
  }

  const togglePermission = (moduleIndex: number, action: string) => {
    const updated = [...permissionMatrix]
    const perm = updated[moduleIndex].permissions[action]
    if (perm) {
      perm.enabled = !perm.enabled
    }
    setPermissionMatrix(updated)
  }

  const savePermissions = async () => {
    if (!selectedRole) return
    
    const enabledPermIds: number[] = []
    permissionMatrix.forEach(module => {
      Object.values(module.permissions).forEach(perm => {
        if (perm.enabled) {
          enabledPermIds.push(perm.id)
        }
      })
    })

    try {
      await permissionsAPI.updateMatrix(selectedRole.id, enabledPermIds)
      setShowPermissionModal(false)
      loadData()
    } catch (error) {
      console.error('Error saving permissions:', error)
    }
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
          <h1 className="text-2xl font-bold text-gray-900">Roles & Access Manager</h1>
          <p className="mt-1 text-sm text-gray-500">Manage roles and their permissions</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <FiPlus className="mr-2" /> Add Role
        </button>
      </div>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {roles.map((role) => (
          <div
            key={role.id}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <FiShield className="text-indigo-600" size={20} />
                </div>
                <div className="ml-3">
                  <h3 className="font-semibold text-gray-900">{role.display_name}</h3>
                  <span className="text-xs text-gray-500">{role.name}</span>
                </div>
              </div>
              {role.is_system && (
                <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded">
                  System
                </span>
              )}
            </div>

            <p className="text-sm text-gray-600 mb-4 line-clamp-2">
              {role.description || 'No description'}
            </p>

            <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
              <div className="flex items-center">
                <FiUsers className="mr-1" />
                <span>{role.admin_count || 0} admins</span>
              </div>
              <span>{role.permissions?.length || 0} permissions</span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => openPermissionModal(role)}
                className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
              >
                Permissions
              </button>
              {!role.is_system && (
                <>
                  <button
                    onClick={() => openModal(role)}
                    className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  >
                    <FiEdit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(role.id)}
                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <FiTrash2 size={18} />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Role Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editingRole ? 'Edit Role' : 'Create New Role'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingRole && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role Name (slug)
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g., content_manager"
                    required
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g., Content Manager"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                  placeholder="Describe the role..."
                />
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
                  {editingRole ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permission Matrix Modal */}
      {showPermissionModal && selectedRole && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold">Permission Matrix</h2>
                <p className="text-sm text-gray-500">{selectedRole.display_name}</p>
              </div>
              <button
                onClick={() => setShowPermissionModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <FiX size={20} />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Module</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-700">View</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-700">Create</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-700">Edit</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-700">Delete</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-700">Other</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {permissionMatrix.map((module, moduleIndex) => (
                    <tr key={module.module} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900 capitalize">
                        {module.module}
                      </td>
                      {['view', 'create', 'edit', 'delete'].map((action) => (
                        <td key={action} className="text-center px-4 py-3">
                          {module.permissions[action] ? (
                            <button
                              onClick={() => togglePermission(moduleIndex, action)}
                              disabled={selectedRole.is_system && selectedRole.name === 'super_admin'}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                                module.permissions[action].enabled
                                  ? 'bg-green-100 text-green-600'
                                  : 'bg-gray-100 text-gray-400'
                              } ${selectedRole.is_system && selectedRole.name === 'super_admin' ? 'cursor-not-allowed' : 'hover:bg-green-200'}`}
                            >
                              {module.permissions[action].enabled ? (
                                <FiCheck size={18} />
                              ) : (
                                <FiX size={18} />
                              )}
                            </button>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      ))}
                      <td className="text-center px-4 py-3">
                        {Object.entries(module.permissions)
                          .filter(([action]) => !['view', 'create', 'edit', 'delete'].includes(action))
                          .map(([action, perm]) => (
                            <button
                              key={action}
                              onClick={() => togglePermission(moduleIndex, action)}
                              disabled={selectedRole.is_system && selectedRole.name === 'super_admin'}
                              className={`px-2 py-1 rounded text-xs mr-1 ${
                                perm.enabled
                                  ? 'bg-green-100 text-green-600'
                                  : 'bg-gray-100 text-gray-400'
                              }`}
                            >
                              {action}
                            </button>
                          ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <button
                onClick={() => setShowPermissionModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              {!(selectedRole.is_system && selectedRole.name === 'super_admin') && (
                <button
                  onClick={savePermissions}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Save Permissions
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
