import { useState, useEffect } from 'react'
import {
  Image,
  Loader2,
  Sparkles,
  AlertCircle,
  CheckCircle,
  Copy,
  RefreshCw,
  Info,
} from 'lucide-react'
import { aiAPI, productsAPI } from '../services/api'
import toast from 'react-hot-toast'

interface Product {
  id: number
  name: string
  category: string
}

interface Generation {
  id: number
  prompt: string
  generated_content: string
  status: string
  created_at: string
  product_name?: string
}

interface Quota {
  dailyLimit: number
  used: number
  remaining: number
  canGenerate: boolean
}

export default function AIImageGenerator() {
  const [prompt, setPrompt] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<number | undefined>()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [productsLoading, setProductsLoading] = useState(true)
  const [result, setResult] = useState<Generation | null>(null)
  const [quota, setQuota] = useState<Quota | null>(null)
  const [recentGenerations, setRecentGenerations] = useState<Generation[]>([])

  // Load products and quota on mount
  useEffect(() => {
    loadProducts()
    loadQuota()
    loadRecentGenerations()
  }, [])

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
      const response = await aiAPI.getGenerations({ type: 'image', limit: 5 })
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

    try {
      const response = await aiAPI.generateImagePrompt({
        prompt: prompt.trim(),
        productId: selectedProduct,
      })

      if (response.data.success) {
        setResult(response.data.generation)
        setQuota(response.data.quota)
        toast.success('Image prompt generated! Awaiting approval.')
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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Image className="w-7 h-7 text-purple-600" />
          AI Image Generator
        </h1>
        <p className="text-gray-600 mt-1">
          Generate AI-powered image prompts for your products
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
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Generate Image Prompt</h2>

            {/* Product Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Product (Optional)
              </label>
              <select
                value={selectedProduct || ''}
                onChange={(e) => setSelectedProduct(e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
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

            {/* Prompt Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Describe the image you want
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="E.g., A modern minimalist product photo of a leather bag on a white marble surface with soft natural lighting..."
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 min-h-[150px] resize-none"
                disabled={loading}
              />
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={loading || !prompt.trim() || (quota !== null && !quota.canGenerate)}
              className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate Image Prompt
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
                  Generated Prompt
                </h2>
                {getStatusBadge(result.status)}
              </div>

              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <p className="text-gray-800 whitespace-pre-wrap">{result.generated_content}</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => copyToClipboard(result.generated_content)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  Copy
                </button>
                <button
                  onClick={() => {
                    setResult(null)
                    setPrompt('')
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  New Generation
                </button>
              </div>

              {result.status === 'pending' && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-800">
                    This generation is pending approval. It will appear in the Approval Queue for review before being applied.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Recent Generations Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Generations</h2>

            {recentGenerations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Image className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No image prompts generated yet</p>
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
                    <p className="text-sm text-gray-700 line-clamp-2">{gen.prompt}</p>
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

          {/* Info Card */}
          <div className="mt-6 bg-purple-50 rounded-2xl p-6 border border-purple-200">
            <h3 className="font-semibold text-purple-900 mb-2">How it works</h3>
            <ul className="space-y-2 text-sm text-purple-800">
              <li className="flex items-start gap-2">
                <span className="font-bold">1.</span>
                Describe the image you want
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">2.</span>
                AI generates a detailed prompt
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">3.</span>
                Prompt awaits approval
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">4.</span>
                Use approved prompt with image AI
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
