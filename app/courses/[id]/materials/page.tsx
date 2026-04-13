// app/courses/[id]/materials/page.tsx
"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { tmsDb } from "@/lib/supabase-client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  ArrowLeft,
  Upload,
  Loader2,
  Eye,
  Copy,
  Trash2,
  FileText,
  Lock,
  BookOpen,
  Plus,
  ExternalLink,
  Check,
  Pencil,
} from "lucide-react"
import Link from "next/link"

type Material = {
  id: string
  course_id: string
  title: string
  file_url: string
  file_type: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export default function CourseMaterialsPage() {
  const params = useParams()
  const router = useRouter()
  const courseId = params.id as string

  const [courseName, setCourseName] = useState("")
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)

  // Upload states
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadTitle, setUploadTitle] = useState("")
  const [uploadPassword, setUploadPassword] = useState("")
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)

  // Delete states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [materialToDelete, setMaterialToDelete] = useState<Material | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Copy feedback
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Edit states
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [materialToEdit, setMaterialToEdit] = useState<Material | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editPassword, setEditPassword] = useState("")
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    fetchCourse()
    fetchMaterials()
  }, [courseId])

  const fetchCourse = async () => {
    const { data, error } = await tmsDb
      .from("courses")
      .select("name")
      .eq("id", courseId)
      .single()

    if (!error && data) {
      setCourseName(data.name)
    }
  }

  const fetchMaterials = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/course-materials?courseId=${courseId}`)
      const json = await res.json()
      if (json.data) {
        setMaterials(json.data)
      }
    } catch (err) {
      console.error("Error fetching materials:", err)
      toast.error("Failed to load materials")
    } finally {
      setLoading(false)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setUploadFile(e.dataTransfer.files[0])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadFile(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!uploadFile) {
      toast.error("Please select a file")
      return
    }
    if (!uploadTitle.trim()) {
      toast.error("Please enter a title")
      return
    }
    if (!uploadPassword.trim()) {
      toast.error("Please enter a password")
      return
    }

    setUploading(true)
    try {
      // Step 1: Upload file to FTP
      const formData = new FormData()
      formData.append("material", uploadFile)

      const uploadRes = await fetch("/api/upload-material", {
        method: "POST",
        body: formData,
      })

      if (!uploadRes.ok) {
        const err = await uploadRes.json()
        throw new Error(err.error || "Upload failed")
      }

      const { url, fileType } = await uploadRes.json()

      // Step 2: Create material record
      const createRes = await fetch("/api/course-materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: courseId,
          title: uploadTitle.trim(),
          file_url: url,
          file_type: fileType, // Use the detected type from the API (pdf, articulate, or other)
          password: uploadPassword,
        }),
      })

      if (!createRes.ok) {
        const err = await createRes.json()
        throw new Error(err.error || "Failed to create material")
      }

      toast.success("Material uploaded successfully!")
      setIsUploadDialogOpen(false)
      setUploadTitle("")
      setUploadPassword("")
      setUploadFile(null)
      fetchMaterials()
    } catch (err: any) {
      console.error("Upload error:", err)
      toast.error(err.message || "Failed to upload material")
    } finally {
      setUploading(false)
    }
  }

  const handleToggleActive = async (material: Material) => {
    try {
      const res = await fetch("/api/course-materials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: material.id, is_active: !material.is_active }),
      })

      if (res.ok) {
        setMaterials((prev) =>
          prev.map((m) =>
            m.id === material.id ? { ...m, is_active: !m.is_active } : m
          )
        )
        toast.success(material.is_active ? "Material deactivated" : "Material activated")
      }
    } catch (err) {
      toast.error("Failed to update material")
    }
  }

  const handleDelete = async () => {
    if (!materialToDelete) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/course-materials?id=${materialToDelete.id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        setMaterials((prev) => prev.filter((m) => m.id !== materialToDelete.id))
        toast.success("Material deleted")
        setDeleteDialogOpen(false)
        setMaterialToDelete(null)
      }
    } catch (err) {
      toast.error("Failed to delete material")
    } finally {
      setDeleting(false)
    }
  }

  const handleOpenEdit = (material: Material) => {
    setMaterialToEdit(material)
    setEditTitle(material.title)
    setEditPassword("") // Don't show hashed password, allow reset
    setIsEditDialogOpen(true)
  }

  const handleUpdate = async () => {
    if (!materialToEdit) return
    if (!editTitle.trim()) {
      toast.error("Title is required")
      return
    }

    setUpdating(true)
    try {
      const res = await fetch("/api/course-materials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: materialToEdit.id,
          title: editTitle.trim(),
          password: editPassword.trim() || undefined,
        }),
      })

      if (res.ok) {
        setMaterials((prev) =>
          prev.map((m) =>
            m.id === materialToEdit.id ? { ...m, title: editTitle.trim() } : m
          )
        )
        toast.success("Material updated successfully")
        setIsEditDialogOpen(false)
        setMaterialToEdit(null)
      } else {
        const err = await res.json()
        throw new Error(err.error || "Update failed")
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update material")
    } finally {
      setUpdating(false)
    }
  }

  const handleCopyLink = (materialId: string) => {
    const url = `${window.location.origin}/view-material/${materialId}`
    navigator.clipboard.writeText(url)
    setCopiedId(materialId)
    toast.success("Link copied to clipboard!")
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handlePreview = (materialId: string) => {
    window.open(`/view-material/${materialId}`, "_blank")
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/courses">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Courses
            </Button>
          </Link>
          <div>
            <p className="text-sm text-muted-foreground font-medium">{courseName}</p>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-primary" />
              Course Materials
            </h1>
          </div>
        </div>

        <Button onClick={() => setIsUploadDialogOpen(true)} className="gap-2 cursor-pointer">
          <Plus className="h-4 w-4" />
          Upload Material
        </Button>
      </div>

      {/* Materials Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Loading materials...</p>
                </TableCell>
              </TableRow>
            ) : materials.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No materials uploaded yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Click &quot;Upload Material&quot; to add your first document
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              materials.map((material, index) => (
                <TableRow key={material.id}>
                  <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-red-500 shrink-0" />
                      <div>
                        <p className="font-medium">{material.title}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Lock className="h-3 w-3" />
                          Password Protected
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="uppercase text-xs">
                      {material.file_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={material.is_active}
                        onCheckedChange={() => handleToggleActive(material)}
                      />
                      <span className="text-xs text-muted-foreground">
                        {material.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(material.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 cursor-pointer"
                        onClick={() => handlePreview(material.id)}
                        title="Preview"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 cursor-pointer text-blue-500"
                        onClick={() => handleOpenEdit(material)}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 cursor-pointer"
                        onClick={() => handleCopyLink(material.id)}
                        title="Copy Link"
                      >
                        {copiedId === material.id ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive cursor-pointer"
                        onClick={() => {
                          setMaterialToDelete(material)
                          setDeleteDialogOpen(true)
                        }}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Upload Material
            </DialogTitle>
            <DialogDescription>
              Upload a PDF document for this course. Set a password for viewer access.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Material Title *</Label>
              <Input
                id="title"
                placeholder="e.g., BOSH Module 1 - Introduction"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">Viewer Password *</Label>
              <Input
                id="password"
                type="text"
                placeholder="Set a password for viewers"
                value={uploadPassword}
                onChange={(e) => setUploadPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Viewers will need this password to access the material.
              </p>
            </div>

            {/* File Drop Zone */}
            <div className="space-y-2">
              <Label>File *</Label>
              <div
                className={`
                  border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
                  transition-all duration-200
                  ${dragActive
                    ? "border-primary bg-primary/5 scale-[1.01]"
                    : uploadFile
                    ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                    : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
                  }
                `}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById("file-input")?.click()}
              >
                <input
                  id="file-input"
                  type="file"
                  accept=".pdf,.zip,.html"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                {uploadFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="h-8 w-8 text-green-500" />
                    <div className="text-left">
                      <p className="font-medium text-sm">{uploadFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(uploadFile.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                      Drag & drop a PDF file here, or <span className="text-primary font-medium">browse</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Supports PDF files up to 200MB
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsUploadDialogOpen(false)}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={uploading} className="cursor-pointer">
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-blue-500" />
              Edit Material
            </DialogTitle>
            <DialogDescription>
              Update the title or change the access password for this material.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Material Title</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-password">New Password (Leave blank to keep current)</Label>
              <Input
                id="edit-password"
                type="text"
                placeholder="Enter new password to reset"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={updating}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updating} className="cursor-pointer">
              {updating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Material</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{materialToDelete?.title}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
