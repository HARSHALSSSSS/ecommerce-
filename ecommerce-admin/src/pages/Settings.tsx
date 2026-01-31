import { useState } from 'react'
import { User, Lock, Bell, Database, Globe, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'

export default function Settings() {
  const { admin } = useAuth()
  const [activeTab, setActiveTab] = useState('profile')

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'database', label: 'Database', icon: Database },
    { id: 'general', label: 'General', icon: Globe },
  ]

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
        <p className="text-gray-500">Manage your account and application settings</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <div className="lg:w-64 shrink-0">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      activeTab === tab.id
                        ? 'bg-primary text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                )
              })}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeTab === 'profile' && <ProfileSettings admin={admin} />}
          {activeTab === 'security' && <SecuritySettings />}
          {activeTab === 'notifications' && <NotificationSettings />}
          {activeTab === 'database' && <DatabaseSettings />}
          {activeTab === 'general' && <GeneralSettings />}
        </div>
      </div>
    </div>
  )
}

function ProfileSettings({ admin }: { admin: any }) {
  const [formData, setFormData] = useState({
    name: admin?.name || '',
    email: admin?.email || '',
  })

  const handleSave = () => {
    toast.success('Profile updated successfully')
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <h2 className="text-lg font-semibold text-gray-800 mb-6">Profile Settings</h2>

      <div className="space-y-6">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center">
            <span className="text-3xl font-bold text-white">
              {formData.name.charAt(0).toUpperCase() || 'A'}
            </span>
          </div>
          <div>
            <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
              Change Avatar
            </button>
            <p className="text-sm text-gray-500 mt-1">JPG, PNG. Max 2MB</p>
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          className="inline-flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
        >
          <Save className="w-4 h-4" />
          Save Changes
        </button>
      </div>
    </div>
  )
}

function SecuritySettings() {
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  const handleSave = () => {
    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    toast.success('Password changed successfully')
    setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' })
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <h2 className="text-lg font-semibold text-gray-800 mb-6">Security Settings</h2>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
          <input
            type="password"
            value={formData.currentPassword}
            onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
          <input
            type="password"
            value={formData.newPassword}
            onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
          <input
            type="password"
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <button
          onClick={handleSave}
          className="inline-flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
        >
          <Save className="w-4 h-4" />
          Update Password
        </button>
      </div>
    </div>
  )
}

function NotificationSettings() {
  const [settings, setSettings] = useState({
    orderNotifications: true,
    userRegistrations: true,
    lowStockAlerts: true,
    emailNotifications: false,
  })

  const handleSave = () => {
    toast.success('Notification settings saved')
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <h2 className="text-lg font-semibold text-gray-800 mb-6">Notification Settings</h2>

      <div className="space-y-4">
        {[
          { key: 'orderNotifications', label: 'New Order Notifications', desc: 'Get notified when a new order is placed' },
          { key: 'userRegistrations', label: 'User Registration Alerts', desc: 'Get notified when a new user registers' },
          { key: 'lowStockAlerts', label: 'Low Stock Alerts', desc: 'Get notified when product stock is low' },
          { key: 'emailNotifications', label: 'Email Notifications', desc: 'Receive notifications via email' },
        ].map((item) => (
          <div key={item.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div>
              <p className="font-medium text-gray-800">{item.label}</p>
              <p className="text-sm text-gray-500">{item.desc}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings[item.key as keyof typeof settings]}
                onChange={(e) => setSettings({ ...settings, [item.key]: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        ))}

        <button
          onClick={handleSave}
          className="inline-flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
        >
          <Save className="w-4 h-4" />
          Save Preferences
        </button>
      </div>
    </div>
  )
}

function DatabaseSettings() {
  const handleBackup = () => {
    toast.success('Database backup started')
  }

  const handleSync = () => {
    toast.success('Database sync initiated')
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <h2 className="text-lg font-semibold text-gray-800 mb-6">Database Settings</h2>

      <div className="space-y-6">
        <div className="p-4 bg-gray-50 rounded-xl">
          <h3 className="font-medium text-gray-800 mb-2">Database Status</h3>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-600">Connected</span>
          </div>
          <p className="text-sm text-gray-500 mt-2">SQLite Database • ecommerce.db</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={handleBackup}
            className="p-4 border border-gray-200 rounded-xl hover:bg-gray-50 text-left"
          >
            <h4 className="font-medium text-gray-800">Backup Database</h4>
            <p className="text-sm text-gray-500">Create a backup of your database</p>
          </button>
          <button
            onClick={handleSync}
            className="p-4 border border-gray-200 rounded-xl hover:bg-gray-50 text-left"
          >
            <h4 className="font-medium text-gray-800">Sync with Mobile App</h4>
            <p className="text-sm text-gray-500">Force sync data with mobile app</p>
          </button>
        </div>
      </div>
    </div>
  )
}

function GeneralSettings() {
  const [settings, setSettings] = useState({
    storeName: 'Ecommerce Store',
    currency: 'USD',
    timezone: 'America/New_York',
  })

  const handleSave = () => {
    toast.success('General settings saved')
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <h2 className="text-lg font-semibold text-gray-800 mb-6">General Settings</h2>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Store Name</label>
          <input
            type="text"
            value={settings.storeName}
            onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
          <select
            value={settings.currency}
            onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
            <option value="INR">INR (₹)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
          <select
            value={settings.timezone}
            onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="America/New_York">Eastern Time (ET)</option>
            <option value="America/Los_Angeles">Pacific Time (PT)</option>
            <option value="Europe/London">GMT</option>
            <option value="Asia/Kolkata">IST</option>
          </select>
        </div>

        <button
          onClick={handleSave}
          className="inline-flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
        >
          <Save className="w-4 h-4" />
          Save Settings
        </button>
      </div>
    </div>
  )
}
