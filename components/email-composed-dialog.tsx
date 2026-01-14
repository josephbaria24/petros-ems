// components/email-compose-dialog.tsx
"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Save, Send, Trash2, Plus, Eye, FileText } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface EmailTemplate {
  id: string
  name: string
  subject: string
  message: string
  is_default: boolean
}

interface EmailComposeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSend: (subject: string, message: string) => void
  defaultSubject?: string
  defaultMessage?: string
  recipientCount: number
}

// Helper function to convert plain text to HTML
function plainTextToHtml(text: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; }
        .header { background: #4F46E5; color: white; padding: 30px 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background: white; padding: 30px; border-radius: 0 0 5px 5px; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header"><h1>🎓 Certificate of Completion</h1></div>
        <div class="content">
          ${text.split('\n').map(line => `<p>${line || '&nbsp;'}</p>`).join('')}
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Petrosphere Training Center. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `
}

// Helper function to extract plain text from HTML
function htmlToPlainText(html: string): string {
  // Remove HTML tags and get just the text content
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html
  
  // Try to extract content from .content div if it exists
  const contentDiv = tempDiv.querySelector('.content')
  if (contentDiv) {
    return contentDiv.textContent?.trim() || ''
  }
  
  // Otherwise just get all text
  return tempDiv.textContent?.trim() || ''
}

export default function EmailComposeDialog({
  open,
  onOpenChange,
  onSend,
  defaultSubject = "",
  defaultMessage = "",
  recipientCount,
}: EmailComposeDialogProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("")
  const [subject, setSubject] = useState(defaultSubject)
  const [message, setMessage] = useState("")
  const [templateName, setTemplateName] = useState("")
  const [saveAsDefault, setSaveAsDefault] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showSaveForm, setShowSaveForm] = useState(false)

  // Fetch templates on mount
  useEffect(() => {
    if (open) {
      fetchTemplates()
      setSubject(defaultSubject)
      // Convert HTML to plain text for editing
      setMessage(htmlToPlainText(defaultMessage))
    }
  }, [open, defaultSubject, defaultMessage])

  const fetchTemplates = async () => {
    try {
      const response = await fetch("/api/email-templates")
      const result = await response.json()
      if (result.success) {
        setTemplates(result.data || [])
      }
    } catch (error) {
      console.error("Error fetching templates:", error)
    }
  }

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId)
    if (templateId === "custom") {
      setSubject(defaultSubject)
      setMessage(htmlToPlainText(defaultMessage))
      return
    }
    
    const template = templates.find((t) => t.id === templateId)
    if (template) {
      setSubject(template.subject)
      setMessage(htmlToPlainText(template.message))
    }
  }

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      alert("Please enter a template name")
      return
    }

    setIsSaving(true)
    try {
      // Convert plain text to HTML before saving
      const htmlMessage = plainTextToHtml(message)
      
      const response = await fetch("/api/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName,
          subject,
          message: htmlMessage,
          is_default: saveAsDefault,
        }),
      })

      const result = await response.json()
      if (result.success) {
        alert("Template saved successfully!")
        setTemplateName("")
        setSaveAsDefault(false)
        setShowSaveForm(false)
        fetchTemplates()
      } else {
        alert(`Failed to save template: ${result.error}`)
      }
    } catch (error) {
      console.error("Error saving template:", error)
      alert("An error occurred while saving the template")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return

    try {
      const response = await fetch(`/api/email-templates?id=${templateId}`, {
        method: "DELETE",
      })

      const result = await response.json()
      if (result.success) {
        alert("Template deleted successfully!")
        setSelectedTemplateId("")
        fetchTemplates()
      } else {
        alert(`Failed to delete template: ${result.error}`)
      }
    } catch (error) {
      console.error("Error deleting template:", error)
      alert("An error occurred while deleting the template")
    }
  }

  const handleSendNow = () => {
    if (!subject.trim() || !message.trim()) {
      alert("Please enter both subject and message")
      return
    }
    setIsLoading(true)
    // Convert plain text to HTML before sending
    const htmlMessage = plainTextToHtml(message)
    onSend(subject, htmlMessage)
  }

  const getPreviewHtml = () => {
    return plainTextToHtml(message)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="lg:w-[60vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compose Email for Certificate Delivery</DialogTitle>
          <DialogDescription>
            Sending to {recipientCount} recipient{recipientCount !== 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template Selection */}
          <div className="space-y-2">
            <Label>Email Template</Label>
            <div className="flex gap-2">
              <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a template or compose new" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Compose New Email</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name} {template.is_default && "(Default)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTemplateId && selectedTemplateId !== "custom" && (
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => handleDeleteTemplate(selectedTemplateId)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="email-subject">Subject</Label>
            <Input
              id="email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter email subject"
            />
          </div>

          {/* Message with Tabs */}
          <Tabs defaultValue="compose" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="compose">
                <FileText className="mr-2 h-4 w-4" />
                Compose
              </TabsTrigger>
              <TabsTrigger value="preview">
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="compose" className="space-y-2">
              <Label htmlFor="email-message">Message</Label>
              <Textarea
                id="email-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message here... 

Example:
Dear [First Name] [Last Name],

Congratulations on successfully completing your training!

Your certificate is attached to this email.

Thank you for choosing Petrosphere Training Center!"
                rows={12}
                className="text-sm"
              />
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                <p className="text-xs text-blue-800 dark:text-blue-200 font-semibold mb-1">
                  💡 Available Placeholders (will be replaced automatically):
                </p>
                <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1 ml-4 list-disc">
                  <li><code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{'{{first_name}}'}</code> - Recipient's first name</li>
                  <li><code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{'{{last_name}}'}</code> - Recipient's last name</li>
                  <li><code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{'{{full_name}}'}</code> - Recipient's full name</li>
                  <li><code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{'{{certificate_number}}'}</code> - Certificate number</li>
                </ul>
              </div>
            </TabsContent>
            
            <TabsContent value="preview" className="space-y-2">
              <Label>Email Preview</Label>
              <div className="border rounded-md p-4 bg-gray-50 dark:bg-gray-900 max-h-[400px] overflow-y-auto">
                <div dangerouslySetInnerHTML={{ __html: getPreviewHtml() }} />
              </div>
              <p className="text-xs text-muted-foreground">
                This is how your email will look when sent. Certificate will be attached automatically.
              </p>
            </TabsContent>
          </Tabs>

          {/* Save Template Section */}
          {!showSaveForm ? (
            <Button
              variant="outline"
              onClick={() => setShowSaveForm(true)}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Save as Template
            </Button>
          ) : (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/50">
              <div className="flex justify-between items-center">
                <Label className="font-semibold">Save as Template</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowSaveForm(false)
                    setTemplateName("")
                    setSaveAsDefault(false)
                  }}
                >
                  Cancel
                </Button>
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-name">Template Name</Label>
                <Input
                  id="template-name"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Standard Certificate Email"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="save-as-default"
                  checked={saveAsDefault}
                  onCheckedChange={(checked) => setSaveAsDefault(checked as boolean)}
                />
                <Label htmlFor="save-as-default" className="text-sm cursor-pointer">
                  Set as default template
                </Label>
              </div>
              <Button
                onClick={handleSaveTemplate}
                disabled={isSaving || !templateName.trim()}
                className="w-full"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Template
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSendNow} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Now
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}