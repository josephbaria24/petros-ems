'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Upload, CheckCircle, AlertCircle, FileText, X, Loader2 } from 'lucide-react'

interface UploadPageBlock {
  id: string
  type: 'file_upload' | 'rich_text' | 'reference_input'
  label: string
  required: boolean
  description?: string
  content?: string
  acceptTypes?: string
  maxSizeMB?: number
}

interface UploadPageConfig {
  blockId: string
  title: string
  description: string
  blocks: UploadPageBlock[]
}

export default function ClientUploadPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const courseId = searchParams.get('courseId')
  const blockId = searchParams.get('blockId')
  const ref = searchParams.get('ref')

  const [loading, setLoading] = useState(true)
  const [pageConfig, setPageConfig] = useState<UploadPageConfig | null>(null)
  const [courseName, setCourseName] = useState('')
  const [referenceNumber, setReferenceNumber] = useState(ref || '')
  const [files, setFiles] = useState<Record<string, File | null>>({})
  const [uploadedUrls, setUploadedUrls] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('dark')
      document.documentElement.style.colorScheme = 'light'
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.documentElement.style.colorScheme = ''
      }
    }
  }, [])

  useEffect(() => {
    if (courseId && blockId) {
      fetchConfig()
    } else {
      setLoading(false)
    }
  }, [courseId, blockId])

  const fetchConfig = async () => {
    try {
      const response = await fetch(`/api/client-upload-config?courseId=${courseId}&blockId=${blockId}`)
      const data = await response.json()
      if (data.error) throw new Error(data.error)
      setPageConfig(data.config)
      setCourseName(data.courseName)
    } catch (err) {
      console.error('Error fetching upload config:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (blockId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const block = pageConfig?.blocks.find(b => b.id === blockId)
    if (block?.maxSizeMB && file.size > block.maxSizeMB * 1024 * 1024) {
      setErrors(prev => ({ ...prev, [blockId]: `File size must be less than ${block.maxSizeMB}MB` }))
      return
    }

    setFiles(prev => ({ ...prev, [blockId]: file }))
    setErrors(prev => ({ ...prev, [blockId]: '' }))
  }

  const removeFile = (blockId: string) => {
    setFiles(prev => ({ ...prev, [blockId]: null }))
    setUploadedUrls(prev => {
      const copy = { ...prev }
      delete copy[blockId]
      return copy
    })
    if (fileInputRefs.current[blockId]) {
      fileInputRefs.current[blockId]!.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!referenceNumber.trim()) {
      setErrors(prev => ({ ...prev, reference: 'Booking reference is required' }))
      return
    }

    const newErrors: Record<string, string> = {}
    const fileBlocks = pageConfig?.blocks.filter(b => b.type === 'file_upload') || []

    for (const block of fileBlocks) {
      if (block.required && !files[block.id] && !uploadedUrls[block.id]) {
        newErrors[block.id] = `${block.label} is required`
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setUploading(true)
    setErrors({})

    try {
      const urls: Record<string, string> = { ...uploadedUrls }

      for (const [bId, file] of Object.entries(files)) {
        if (!file) continue
        const formData = new FormData()
        formData.append('image', file)

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) throw new Error('Upload failed')
        const data = await response.json()
        urls[bId] = data.url
      }

      setUploadedUrls(urls)

      const response = await fetch('/api/client-upload-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          blockId,
          referenceNumber: referenceNumber.trim().toUpperCase(),
          uploadedFiles: urls,
          blockLabels: Object.fromEntries(
            (pageConfig?.blocks || [])
              .filter(b => b.type === 'file_upload')
              .map(b => [b.id, b.label])
          ),
        }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Submission failed')

      setSubmitted(true)
    } catch (err: any) {
      console.error('Submit error:', err)
      setErrors({ submit: err.message || 'An error occurred. Please try again.' })
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
      </div>
    )
  }

  if (!pageConfig) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Upload Page Not Found</h1>
          <p className="text-slate-400">This upload page does not exist or the link is invalid.</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="bg-emerald-500/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-10 w-10 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Files Uploaded Successfully!</h1>
          <p className="text-slate-400 mb-4">
            Your files have been submitted for reference <strong className="text-white">{referenceNumber}</strong>.
            Our team will review your submission shortly.
          </p>
          <p className="text-slate-500 text-sm">You may close this page.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-blue-500/10 rounded-2xl">
              <img src="/trans-logo.png" alt="Petrosphere" className="w-72" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">{pageConfig.title}</h1>
          {courseName && <p className="text-blue-400 text-sm font-medium mb-1">{courseName}</p>}
          <p className="text-slate-400 text-sm">{pageConfig.description}</p>
        </div>

        {/* Form */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-700 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Reference Number */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Booking Reference Number *
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => {
                  setReferenceNumber(e.target.value.toUpperCase())
                  setErrors(prev => ({ ...prev, reference: '' }))
                }}
                placeholder="e.g., BK-2024-XXXXX"
                className={`w-full px-4 py-3 bg-slate-900/50 border rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.reference ? 'border-red-500' : 'border-slate-600'
                }`}
                readOnly={!!ref}
              />
              {errors.reference && (
                <p className="mt-1 text-xs text-red-400">{errors.reference}</p>
              )}
            </div>

            {/* Dynamic Blocks */}
            {pageConfig.blocks.map((block) => {
              if (block.type === 'rich_text') {
                return (
                  <div key={block.id} className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/50">
                    <div className="text-sm text-slate-300 whitespace-pre-wrap">{block.content}</div>
                  </div>
                )
              }

              if (block.type === 'file_upload') {
                const file = files[block.id]
                const uploaded = uploadedUrls[block.id]

                return (
                  <div key={block.id}>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      {block.label} {block.required && '*'}
                    </label>
                    {block.description && (
                      <p className="text-xs text-slate-500 mb-2">{block.description}</p>
                    )}

                    <input
                      type="file"
                      ref={(el) => { fileInputRefs.current[block.id] = el }}
                      accept={block.acceptTypes || '*/*'}
                      onChange={(e) => handleFileChange(block.id, e)}
                      className="hidden"
                      id={`file-${block.id}`}
                    />

                    {file || uploaded ? (
                      <div className="flex items-center gap-3 px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg">
                        <FileText className="h-5 w-5 text-blue-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{file?.name || 'Uploaded'}</p>
                          {file && (
                            <p className="text-xs text-slate-500">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(block.id)}
                          className="text-slate-400 hover:text-red-400 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <label
                        htmlFor={`file-${block.id}`}
                        className={`flex flex-col items-center justify-center w-full px-6 py-8 border-2 border-dashed rounded-lg cursor-pointer hover:border-blue-500 transition-colors bg-slate-900/30 ${
                          errors[block.id] ? 'border-red-500' : 'border-slate-600'
                        }`}
                      >
                        <Upload className="w-10 h-10 text-slate-500 mb-3" />
                        <p className="text-sm text-slate-400 mb-1">Click to upload</p>
                        <p className="text-xs text-slate-500">
                          {block.maxSizeMB ? `Max ${block.maxSizeMB}MB` : 'Any file'}
                          {block.acceptTypes && block.acceptTypes !== '*/*' ? ` · ${block.acceptTypes}` : ''}
                        </p>
                      </label>
                    )}

                    {errors[block.id] && (
                      <p className="mt-1 text-xs text-red-400">{errors[block.id]}</p>
                    )}
                  </div>
                )
              }

              return null
            })}

            {/* Error */}
            {errors.submit && (
              <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{errors.submit}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={uploading}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Submit Files
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
