import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authAPI } from '../services/api'

interface Role {
  name: string
  display_name: string
}

interface Admin {
  id: number
  email: string
  name: string
  role: string
  roles?: Role[]
  permissions?: string[]
}

interface AuthContextType {
  admin: Admin | null
  isAuthenticated: boolean
  isLoading: boolean
  permissions: string[]
  login: (email: string, password: string, captchaToken: string) => Promise<void>
  logout: () => Promise<void>
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
  isSuperAdmin: () => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null)
  const [permissions, setPermissions] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('adminToken')
      if (!token) {
        setIsLoading(false)
        return
      }

      const response = await authAPI.verifyToken()
      if (response.data.success) {
        setAdmin(response.data.admin)
        setPermissions(response.data.admin.permissions || [])
      } else {
        localStorage.removeItem('adminToken')
        localStorage.removeItem('admin')
      }
    } catch (error) {
      localStorage.removeItem('adminToken')
      localStorage.removeItem('admin')
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (email: string, password: string, captchaToken: string) => {
    const response = await authAPI.login(email, password, captchaToken)
    if (response.data.success) {
      localStorage.setItem('adminToken', response.data.token)
      localStorage.setItem('admin', JSON.stringify(response.data.admin))
      setAdmin(response.data.admin)
      setPermissions(response.data.admin.permissions || [])
    } else {
      throw new Error(response.data.message || 'Login failed')
    }
  }

  const logout = async () => {
    try {
      await authAPI.logout()
    } catch (error) {
      // Continue with local logout even if API fails
    }
    localStorage.removeItem('adminToken')
    localStorage.removeItem('admin')
    setAdmin(null)
    setPermissions([])
  }

  const hasPermission = (permission: string): boolean => {
    if (isSuperAdmin()) return true
    return permissions.includes(permission)
  }

  const hasAnyPermission = (requiredPermissions: string[]): boolean => {
    if (isSuperAdmin()) return true
    return requiredPermissions.some(p => permissions.includes(p))
  }

  const isSuperAdmin = (): boolean => {
    return admin?.role === 'super_admin' || admin?.roles?.some(r => r.name === 'super_admin') || false
  }

  return (
    <AuthContext.Provider
      value={{
        admin,
        isAuthenticated: !!admin,
        isLoading,
        permissions,
        login,
        logout,
        hasPermission,
        hasAnyPermission,
        isSuperAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
