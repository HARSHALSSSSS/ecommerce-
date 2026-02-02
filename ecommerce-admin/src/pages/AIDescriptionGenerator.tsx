import { useState, useEffect } from 'react'
import {
  FileText,
  Loader2,
  Sparkles,
  AlertCircle,
  CheckCircle,
  Copy,
  RefreshCw,
  Info,
  Edit3,
} from 'lucide-react'
import { aiAPI, productsAPI } from '../services/api'
import toast from 'react-hot-toast'

interface Product {
  id: number
  name: string
  category: string
  description?: string
}

interface Generation {
  id: number
  prompt: string
  generated_content: string
  status: string
  created_at: string
  product_name?: string
  tokens_used?: number
  cost_usd?: number
}

interface Quota {
  dailyLimit: number
  used: number
  remaining: number
  canGenerate: boolean
}

export default function AIDescriptionGenerator() {
  const [prompt, setPrompt] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<number | undefined>()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [productsLoading, setProductsLoading] = useState(true)
  const [result, setResult] = useState<Generation | null>(null)
  const [quota, setQuota] = useState<Quota | null>(null)
  const [recentGenerations, setRecentGenerations] = useState<Generation[]>([])
  const [editedContent, setEditedContent] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  // Load products and quota on mount
  useEffect(() => {
    loadProducts()
    loadQuota()
    loadRecentGenerations()
  }, [])

  // Update edited content when result changes
  useEffect(() => {
    if (result) {
      setEditedContent(result.generated_content)
    }
  }, [result])

  const loadProducts = async () => {
    try {
      setProductsLoading(true)
      const response = await productsAPI.getAll({ limit: 100 })
      setProducts(response.data.products || response.data || [])
    } catch (error) {
      console.error('Error loading products:', error)
    } finally {
      setProductsLoading(false)
    }
  }

  const loadQuota = async () => {
    try {
      const response = await aiAPI.getMyQuota()
      setQuota(response.data.quota)
    } catch (error) {
      console.error('Error loading quota:', error)
    }
  }

  const loadRecentGenerations = async () => {
    try {
      const response = await aiAPI.getGenerations({ type: 'description', limit: 5 })
      setRecentGenerations(response.data.generations || [])
    } catch (error) {
      console.error('Error loading generations:', error)
    }
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt')
      return
    }

    if (quota && !quota.canGenerate) {
      toast.error('Daily quota exceeded')
      return
    }

    setLoading(true)
    setResult(null)
    setIsEditing(false)

    try {
      const response = await aiAPI.generateDescription({
        prompt: prompt.trim(),
        productId: selectedProduct,
      })

      if (response.data.success) {
        setResult(response.data.generation)
        setQuota(response.data.quota)
        toast.success('Description generated! Awaiting approval.')
        loadRecentGenerations()
      } else {
        toast.error(response.data.message || 'Generation failed')
      }
    } catch (error: any) {
      console.error('Generation error:', error)
      toast.error(error.response?.data?.message || 'Failed to generate')
    } finally {
      setLoading(false)
    }
  }

  const handleProductSelect = (productId: number | undefined) => {
    setSelectedProduct(productId)
    if (productId) {
      const product = products.find(p => p.id === productId)
      if (product) {
        setPrompt(`Write a compelling product description for "${product.name}" in the ${product.category} category.`)
      }
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    }
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  const selectedProductDetails = selectedProduct 
    ? products.find(p => p.id === selectedProduct) 
    : null

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-7 h-7 text-blue-600" />
          AI Description Generator
        </h1>
        <p className="text-gray-600 mt-1">
          Generate AI-powered product descriptions
        </p>
      </div>

      {/* Quota Info */}
      {quota && (
        <div className={`mb-6 p-4 rounded-xl ${quota.canGenerate ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Info className={`w-5 h-5 ${quota.canGenerate ? 'text-green-600' : 'text-red-600'}`} />
              <div>
                <p className="font-medium text-gray-900">Daily Quota</p>
                <p className="text-sm text-gray-600">
                  {quota.used} / {quota.dailyLimit} requests used today
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">{quota.remaining}</p>
              <p className="text-sm text-gray-600">remaining</p>
            </div>
          </div>
          <div className="mt-3 bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${quota.canGenerate ? 'bg-green-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min((quota.used / quota.dailyLimit) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Generation Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Generate Description</h2>

            {/* Product Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Product (Recommended)
              </label>
              <select
                value={selectedProduct || ''}
                onChange={(e) => handleProductSelect(e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={productsLoading}
              >
                <option value="">No product selected</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.category})
                  </option>
                ))}
              </select>
            </div>

            {/* Selected Product Info */}
            {selectedProductDetails && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium text-blue-900">{selectedProductDetails.name}</p>
                <p className="text-xs text-blue-700">Category: {selectedProductDetails.category}</p>
                {selectedProductDetails.description && (
                  <p className="text-xs text-blue-600 mt-1 line-clamp-2">
                    Current: {selectedProductDetails.description}
                  </p>
                )}
              </div>
            )}

            {/* Prompt Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Describe what you want
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="E.g., Write a compelling product description highlighting the premium materials, craftsmanship, and benefits..."
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[120px] resize-none"
                disabled={loading}
              />
            </div>

            {/* Quick Prompts */}
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Quick prompts:</p>
              <div className="flex flex-wrap gap-2">
                {[
                  'Professional & detailed',
                  'Short & catchy',
                  'SEO optimized',
                  'Luxury focus',
                  'Benefits focused',
                ].map((quick) => (
                  <button
                    key={quick}
                    onClick={() => setPrompt(`${prompt ? prompt + '. ' : ''}Write in a ${quick.toLowerCase()} style.`)}
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-full hover:bg-gray-200 transition-colors"
                  >
                    {quick}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={loading || !prompt.trim() || (quota !== null && !quota.canGenerate)}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate Description
                </>
              )}
            </button>
          </div>

          {/* Result */}
          {result && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  Generated Description
                </h2>
                <div className="flex items-center gap-2">
                  {result.tokens_used && (
                    <span className="text-xs text-gray-500">
                      {result.tokens_used} tokens
                    </span>
                  )}
                  {getStatusBadge(result.status)}
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                {isEditing ? (
                  <textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="w-full min-h-[200px] p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-gray-800 whitespace-pre-wrap">{editedContent}</p>
                )}
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => copyToClipboard(editedContent)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  Copy
                </button>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                  {isEditing ? 'Done Editing' : 'Edit'}
                </button>
                <button
                  onClick={() => {
                    setResult(null)
                    setPrompt('')
                    setIsEditing(false)
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  New Generation
                </button>
              </div>

              {result.status === 'pending' && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-800">
                    This description is pending approval. Go to the Approval Queue to approve and apply it to the product.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Recent Generations Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Descriptions</h2>

            {recentGenerations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No descriptions generated yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentGenerations.map((gen) => (
                  <div key={gen.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-500">
                        {new Date(gen.created_at).toLocaleDateString()}
                      </span>
                      {getStatusBadge(gen.status)}
                    </div>
                    <p className="text-sm text-gray-700 line-clamp-3">{gen.generated_content}</p>
                    {gen.product_name && (
                      <p className="text-xs text-gray-500 mt-1">
                        Product: {gen.product_name}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tips Card */}
          <div className="mt-6 bg-blue-50 rounded-2xl p-6 border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-2">💡 Tips</h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li>• Select a product for context</li>
              <li>• Be specific about tone & style</li>
              <li>• Mention key features to highlight</li>
              <li>• Review and edit before approval</li>
              <li>• No auto-publishing - approval required</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
