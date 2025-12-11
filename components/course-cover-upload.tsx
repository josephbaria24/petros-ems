"use client"

import { useState, useRef } from 'react'
import { X, Upload, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import Image from 'next/image'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type CourseCoverUploadDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  courseId: string | null
  courseName: string
  currentCoverUrl?: string
  onUploadSuccess: (newUrl: string) => void
}

export default function CourseCoverUploadDialog({
  open,
  onOpenChange,
  courseId,
  courseName,
  currentCoverUrl,
  onUploadSuccess
}: CourseCoverUploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB')
        return
      }
      setSelectedFile(file)
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      setUploadedUrl(null)
      setUploadProgress(0)
      setError(null)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile || !courseId) return

    setUploading(true)
    setUploadProgress(0)
    setError(null)

    try {
      // Create FormData
      const formData = new FormData()
      formData.append('image', selectedFile)

      // Upload to your API
      const xhr = new XMLHttpRequest()
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100)
          setUploadProgress(progress)
        }
      })

      const uploadPromise = new Promise<string>((resolve, reject) => {
        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            const result = JSON.parse(xhr.responseText)
            resolve(result.url)
          } else {
            reject(new Error('Upload failed'))
          }
        })

        xhr.addEventListener('error', () => {
          reject(new Error('Network error'))
        })

        xhr.open('POST', '/api/upload')
        xhr.send(formData)
      })

      const uploadedUrl = await uploadPromise
      
      // Update database
      const { supabase } = await import('@/lib/supabase-client')
      const { error: dbError } = await supabase
        .from('courses')
        .update({ cover_image: uploadedUrl })
        .eq('id', courseId)

      if (dbError) {
        throw new Error('Failed to update database')
      }

      setUploadedUrl(uploadedUrl)
      onUploadSuccess(uploadedUrl)
      
    } catch (err) {
      console.error('Upload failed:', err)
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleCancel = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClose = () => {
    handleCancel()
    setUploadedUrl(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="lg:w-[40vw] w-full overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle>Update Cover Photo - {courseName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Cover Preview */}
          {currentCoverUrl && !previewUrl && !uploadedUrl && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Current Cover</label>
              <div className="relative w-full aspect-[2/1] rounded-lg overflow-hidden border">
                <Image
                  src={currentCoverUrl}
                  alt="Current cover"
                  fill
                  className="object-cover"
                />
              </div>
            </div>
          )}

          {/* File Input */}
          {!previewUrl && !uploadedUrl && (
            <div className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors">
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-4">
                  Click to select a new cover image
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="cover-upload"
                />
                <label htmlFor="cover-upload">
                  <Button type="button" asChild>
                    <span>Select Image</span>
                  </Button>
                </label>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Recommended: 1600x800px (2:1 ratio) • Max 5MB
              </p>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg text-sm text-red-900 dark:text-red-100">
              {error}
            </div>
          )}

          {/* Preview Selected Image */}
          {previewUrl && !uploadedUrl && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Selected Image</h3>
                <Button variant="ghost" size="icon" onClick={handleCancel} type="button">
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Image Preview */}
              <div className="relative w-full aspect-[2/1] bg-black rounded-lg overflow-hidden">
                <Image
                  src={previewUrl}
                  alt="Preview"
                  fill
                  className="object-contain"
                />
              </div>

              {/* File Info */}
              <div className="text-sm text-muted-foreground">
                <p>File: {selectedFile?.name}</p>
                <p>Size: {((selectedFile?.size || 0) / 1024 / 1024).toFixed(2)} MB</p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="flex-1"
                  type="button"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Image
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={handleCancel} type="button" disabled={uploading}>
                  Cancel
                </Button>
              </div>

              {/* Progress Bar */}
              {uploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}
            </div>
          )}

          {/* Success State */}
          {uploadedUrl && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                  <Check className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-green-900 dark:text-green-100">
                    Upload Successful!
                  </h3>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    The course cover has been updated.
                  </p>
                </div>
              </div>

              {/* Preview of uploaded image */}
              <div className="relative w-full aspect-[2/1] rounded-lg overflow-hidden border">
                <Image
                  src={uploadedUrl}
                  alt="Uploaded cover"
                  fill
                  className="object-cover"
                />
              </div>

              <Button
                onClick={handleClose}
                className="w-full"
                type="button"
              >
                Done
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}