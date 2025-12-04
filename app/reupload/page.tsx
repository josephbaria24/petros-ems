"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Upload, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase-client"

export default function ReuploadPage() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const traineeId = searchParams.get("traineeId")

  const [loading, setLoading] = useState(true)
  const [traineeData, setTraineeData] = useState<any>(null)
  const [declineInfo, setDeclineInfo] = useState<any>(null)
  const [expired, setExpired] = useState(false)
  
  const [idPicture, setIdPicture] = useState<File | null>(null)
  const [picture2x2, setPicture2x2] = useState<File | null>(null)
  const [idPreview, setIdPreview] = useState<string>("")
  const [preview2x2, setPreview2x2] = useState<string>("")
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (token && traineeId) {
      validateAndFetchData()
    }
  }, [token, traineeId])

  const validateAndFetchData = async () => {
    try {
      const { data, error } = await supabase
        .from("trainings")
        .select("*, courses:course_id(name)")
        .eq("id", traineeId)
        .single()

      if (error || !data) {
        throw new Error("Invalid link")
      }

      const declined = data.declined_photos

      if (!declined || declined.token !== token) {
        throw new Error("Invalid or expired link")
      }

      // Check if link is expired (7 days)
      const declinedDate = new Date(declined.declined_at)
      const now = new Date()
      const daysDiff = (now.getTime() - declinedDate.getTime()) / (1000 * 60 * 60 * 24)

      if (daysDiff > 7) {
        setExpired(true)
        setLoading(false)
        return
      }

      setTraineeData(data)
      setDeclineInfo(declined)
      setLoading(false)
    } catch (error: any) {
      console.error("Validation error:", error)
      toast.error(error.message || "Invalid or expired link")
      setLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: "id" | "2x2") => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file")
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB")
      return
    }

    if (type === "id") {
      setIdPicture(file)
      setIdPreview(URL.createObjectURL(file))
    } else {
      setPicture2x2(file)
      setPreview2x2(URL.createObjectURL(file))
    }
  }

  const uploadToServer = async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append("image", file)

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      throw new Error("Upload failed")
    }

    const data = await response.json()
    return data.url
  }

  const handleSubmit = async () => {
    if (declineInfo.id_picture && !idPicture) {
      toast.error("Please upload your ID picture")
      return
    }

    if (declineInfo.picture_2x2 && !picture2x2) {
      toast.error("Please upload your 2x2 picture")
      return
    }

    setUploading(true)

    try {
      const updates: any = {}

      if (declineInfo.id_picture && idPicture) {
        const idUrl = await uploadToServer(idPicture)
        updates.id_picture_url = idUrl
      }

      if (declineInfo.picture_2x2 && picture2x2) {
        const url2x2 = await uploadToServer(picture2x2)
        updates.picture_2x2_url = url2x2
      }

      // Update database
      const { error } = await supabase
        .from("trainings")
        .update({
          ...updates,
          declined_photos: null, // Clear decline info
          status: "Pending", // Reset to pending for review
        })
        .eq("id", traineeId)

      if (error) throw error

      setSuccess(true)
      toast.success("Photos uploaded successfully! We'll review them shortly.")
    } catch (error: any) {
      console.error("Upload error:", error)
      toast.error(error.message || "Failed to upload photos")
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (expired) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-6">
          <div className="text-center space-y-4">
            <XCircle className="h-16 w-16 text-red-500 mx-auto" />
            <h2 className="text-2xl font-bold">Link Expired</h2>
            <p className="text-muted-foreground">
              This re-upload link has expired. Please contact us for assistance.
            </p>
          </div>
        </Card>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-6">
          <div className="text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold">Upload Successful!</h2>
            <p className="text-muted-foreground">
              Your photos have been uploaded successfully. We'll review them and get back to you soon.
            </p>
          </div>
        </Card>
      </div>
    )
  }

  if (!traineeData || !declineInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-6">
          <div className="text-center space-y-4">
            <XCircle className="h-16 w-16 text-red-500 mx-auto" />
            <h2 className="text-2xl font-bold">Invalid Link</h2>
            <p className="text-muted-foreground">
              This link is invalid or has already been used.
            </p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto py-8">
        <Card className="p-6 space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold">Photo Re-upload</h1>
            <p className="text-muted-foreground">
              Hello, {traineeData.first_name} {traineeData.last_name}
            </p>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Reason for decline:</strong> {declineInfo.reason}
            </AlertDescription>
          </Alert>

          <div className="space-y-6">
            {declineInfo.id_picture && (
              <div className="space-y-3">
                <Label htmlFor="id-picture" className="text-lg font-semibold">
                  ID Picture *
                </Label>
                <Input
                  id="id-picture"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, "id")}
                  className="cursor-pointer"
                />
                {idPreview && (
                  <div className="mt-3">
                    <img
                      src={idPreview}
                      alt="ID Preview"
                      className="max-w-xs rounded-lg border-2 border-primary"
                    />
                  </div>
                )}
              </div>
            )}

            {declineInfo.picture_2x2 && (
              <div className="space-y-3">
                <Label htmlFor="picture-2x2" className="text-lg font-semibold">
                  2x2 Picture *
                </Label>
                <Input
                  id="picture-2x2"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, "2x2")}
                  className="cursor-pointer"
                />
                {preview2x2 && (
                  <div className="mt-3">
                    <img
                      src={preview2x2}
                      alt="2x2 Preview"
                      className="max-w-xs rounded-lg border-2 border-primary"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <Button
            onClick={handleSubmit}
            disabled={uploading}
            className="w-full"
            size="lg"
          >
            {uploading ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-5 w-5 mr-2" />
                Submit Photos
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            This link will expire in 7 days from the decline date.
          </p>
        </Card>
      </div>
    </div>
  )
}