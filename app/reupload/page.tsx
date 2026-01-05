"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Upload, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { toast } from "sonner"

export default function ReuploadPage() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const traineeId = searchParams.get("traineeId")

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [trainee, setTrainee] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [idFile, setIdFile] = useState<File | null>(null)
  const [photo2x2File, setPhoto2x2File] = useState<File | null>(null)
  const [idPreview, setIdPreview] = useState<string | null>(null)
  const [photo2x2Preview, setPhoto2x2Preview] = useState<string | null>(null)

  useEffect(() => {
    validateAndFetchTrainee()
  }, [token, traineeId])

  const validateAndFetchTrainee = async () => {
    if (!token || !traineeId) {
      setError("Invalid or missing reupload link.")
      setLoading(false)
      return
    }

    try {
      const { data, error: fetchError } = await supabase
        .from("trainings")
        .select("*")
        .eq("id", traineeId)
        .single()

      if (fetchError || !data) {
        setError("Unable to find your registration.")
        setLoading(false)
        return
      }

      // Verify token matches
      if (data.declined_photos?.token !== token) {
        setError("This reupload link is invalid or has expired.")
        setLoading(false)
        return
      }

      // Check if link expired (7 days)
      const declinedDate = new Date(data.declined_photos.declined_at)
      const expiryDate = new Date(declinedDate.getTime() + 7 * 24 * 60 * 60 * 1000)
      
      if (new Date() > expiryDate) {
        setError("This reupload link has expired. Please contact support.")
        setLoading(false)
        return
      }

      setTrainee(data)
      setLoading(false)
    } catch (err) {
      console.error("Validation error:", err)
      setError("An error occurred. Please try again.")
      setLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'id' | '2x2') => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB')
      return
    }

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      if (type === 'id') {
        setIdFile(file)
        setIdPreview(reader.result as string)
      } else {
        setPhoto2x2File(file)
        setPhoto2x2Preview(reader.result as string)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async () => {
    if (!trainee) return

    const needsId = trainee.declined_photos?.id_picture
    const needs2x2 = trainee.declined_photos?.picture_2x2

    if (needsId && !idFile) {
      toast.error("Please upload your ID picture")
      return
    }

    if (needs2x2 && !photo2x2File) {
      toast.error("Please upload your 2x2 photo")
      return
    }

    setSubmitting(true)

    try {
      let idUrl = trainee.id_picture_url
      let photo2x2Url = trainee.picture_2x2_url

      // Upload ID if needed
      if (needsId && idFile) {
        const formData = new FormData()
        formData.append('image', idFile)
        
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) throw new Error('Failed to upload ID picture')
        
        const data = await response.json()
        idUrl = data.url
      }

      // Upload 2x2 if needed
      if (needs2x2 && photo2x2File) {
        const formData = new FormData()
        formData.append('image', photo2x2File)
        
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) throw new Error('Failed to upload 2x2 photo')
        
        const data = await response.json()
        photo2x2Url = data.url
      }

      // Update database
      const { error: updateError } = await supabase
        .from("trainings")
        .update({
          id_picture_url: idUrl,
          picture_2x2_url: photo2x2Url,
          status: "Resubmitted (Pending Verification)",
          declined_photos: null, // Clear decline data
        })
        .eq("id", traineeId)

      if (updateError) throw updateError

      setSuccess(true)
      toast.success("Photos resubmitted successfully!")

    } catch (error: any) {
      console.error("Reupload error:", error)
      toast.error(error.message || "Failed to resubmit photos")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 text-red-600">
              <XCircle className="h-6 w-6" />
              <CardTitle>Invalid Link</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">{error}</p>
            <p className="text-sm text-gray-500 mt-4">
              If you need assistance, please contact Petrosphere Training Institute.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-6 w-6" />
              <CardTitle>Photos Resubmitted Successfully!</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Thank you for resubmitting your photos. Our team will review them shortly
              and contact you once they've been verified.
            </p>
            <Alert className="mt-4 bg-blue-50 border-blue-200">
              <AlertDescription>
                You will receive an email notification once your photos have been reviewed.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 py-12">
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Photo Resubmission</CardTitle>
            <CardDescription>
              Hello {trainee?.first_name} {trainee?.last_name}, please resubmit the required photos below.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Decline Reason */}
            {trainee?.declined_photos?.reason && (
              <Alert className="bg-red-50 border-red-200">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  <strong>Reason for Decline:</strong>
                  <p className="mt-1">{trainee.declined_photos.reason}</p>
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* ID Picture Upload */}
              {trainee?.declined_photos?.id_picture && (
                <div className="space-y-3">
                  <Label className="text-base font-semibold">
                    ID Picture
                    <span className="text-red-500 ml-1">*</span>
                  </Label>
                  
                  {idPreview ? (
                    <div className="relative">
                      <img 
                        src={idPreview} 
                        alt="ID Preview" 
                        className="w-full h-48 object-cover rounded border-2 border-green-300"
                      />
                      <Button
                        size="sm"
                        variant="destructive"
                        className="absolute top-2 right-2"
                        onClick={() => {
                          setIdFile(null)
                          setIdPreview(null)
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileChange(e, 'id')}
                        className="hidden"
                        id="id-upload"
                      />
                      <label htmlFor="id-upload" className="cursor-pointer">
                        <Upload className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600">Click to upload ID picture</p>
                        <p className="text-xs text-gray-400 mt-1">PNG, JPG (max 5MB)</p>
                      </label>
                    </div>
                  )}
                </div>
              )}

              {/* 2x2 Photo Upload */}
              {trainee?.declined_photos?.picture_2x2 && (
                <div className="space-y-3">
                  <Label className="text-base font-semibold">
                    2x2 Photo
                    <span className="text-red-500 ml-1">*</span>
                  </Label>
                  
                  {photo2x2Preview ? (
                    <div className="relative">
                      <img 
                        src={photo2x2Preview} 
                        alt="2x2 Preview" 
                        className="w-full h-48 object-cover rounded border-2 border-green-300"
                      />
                      <Button
                        size="sm"
                        variant="destructive"
                        className="absolute top-2 right-2"
                        onClick={() => {
                          setPhoto2x2File(null)
                          setPhoto2x2Preview(null)
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileChange(e, '2x2')}
                        className="hidden"
                        id="2x2-upload"
                      />
                      <label htmlFor="2x2-upload" className="cursor-pointer">
                        <Upload className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600">Click to upload 2x2 photo</p>
                        <p className="text-xs text-gray-400 mt-1">PNG, JPG (max 5MB)</p>
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Alert>
              <AlertDescription>
                <strong>Photo Requirements:</strong>
                <ul className="list-disc list-inside mt-2 text-sm space-y-1">
                  <li>Clear, well-lit photos</li>
                  <li>Face must be clearly visible</li>
                  <li>No blurry or pixelated images</li>
                  <li>Professional appearance</li>
                </ul>
              </AlertDescription>
            </Alert>

            <Button 
              onClick={handleSubmit} 
              disabled={submitting}
              className="w-full"
              size="lg"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Photos'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}