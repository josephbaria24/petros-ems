// components/DatabaseManager.tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Database, RefreshCw, Trash2, Download } from "lucide-react"

export default function DatabaseManager() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const fetchStats = async () => {
    setLoading(true)
    try {
      const renderUrl = process.env.NEXT_PUBLIC_RENDER_SERVICE_URL || "http://localhost:8000"
      const response = await fetch(`${renderUrl}/database/stats`)
      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error("Error fetching stats:", error)
      alert("Failed to fetch database stats")
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async () => {
    setLoading(true)
    try {
      const renderUrl = process.env.NEXT_PUBLIC_RENDER_SERVICE_URL || "http://localhost:8000"
      const response = await fetch(`${renderUrl}/database/reset`, {
        method: "POST"
      })
      const data = await response.json()
      
      if (data.status === "success") {
        alert(`✅ Database reset successfully!\n\nBackup created: ${data.backup_file}`)
        fetchStats()
      } else {
        alert(`❌ Reset failed: ${data.error}`)
      }
    } catch (error: any) {
      console.error("Error resetting database:", error)
      alert(`Failed to reset database: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAll = async () => {
    setLoading(true)
    try {
      const renderUrl = process.env.NEXT_PUBLIC_RENDER_SERVICE_URL || "http://localhost:8000"
      const response = await fetch(`${renderUrl}/database/delete-all-records`, {
        method: "POST"
      })
      const data = await response.json()
      
      if (data.status === "success") {
        alert(`✅ Deleted ${data.records_deleted} records successfully!`)
        fetchStats()
      } else {
        alert(`❌ Delete failed: ${data.error}`)
      }
    } catch (error: any) {
      console.error("Error deleting records:", error)
      alert(`Failed to delete records: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleBackup = async () => {
    setLoading(true)
    try {
      const renderUrl = process.env.NEXT_PUBLIC_RENDER_SERVICE_URL || "http://localhost:8000"
      const response = await fetch(`${renderUrl}/database/backup`)
      const data = await response.json()
      
      if (data.status === "success") {
        alert(`✅ Backup created successfully!\n\nFile: ${data.backup_file}\nSize: ${(data.file_size / 1024).toFixed(2)} KB`)
      } else {
        alert(`❌ Backup failed: ${data.error}`)
      }
    } catch (error: any) {
      console.error("Error creating backup:", error)
      alert(`Failed to create backup: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Master Training Database Manager
        </CardTitle>
        <CardDescription>
          Manage your training database: view stats, create backups, or reset
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Display */}
        <div className="p-4 border rounded-lg bg-muted/50">
          {stats ? (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="font-medium">Total Records:</span>
                <span className="text-lg font-bold">{stats.records}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Database Exists:</span>
                <span>{stats.exists ? "✅ Yes" : "❌ No"}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Hostinger Configured:</span>
                <span>{stats.hostinger_configured ? "✅ Yes" : "❌ No"}</span>
              </div>
              {stats.path && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Path:</span>
                  <span className="font-mono">{stats.path}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-center">
              Click "Refresh Stats" to view database information
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={fetchStats}
            disabled={loading}
            variant="outline"
            className="w-full"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh Stats
          </Button>

          <Button
            onClick={handleBackup}
            disabled={loading}
            variant="outline"
            className="w-full"
          >
            <Download className="h-4 w-4 mr-2" />
            Create Backup
          </Button>
        </div>

        {/* Dangerous Actions */}
        <div className="pt-4 border-t space-y-3">
          <p className="text-sm text-muted-foreground font-medium">
            ⚠️ Dangerous Actions
          </p>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                disabled={loading}
                variant="destructive"
                className="w-full"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete All Records
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete All Records?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will delete all training records from the master database.
                  The file structure will remain, but all data will be cleared.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAll}>
                  Yes, Delete All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                disabled={loading}
                variant="destructive"
                className="w-full"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset Database (Fresh Start)
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset Database?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will create a backup of your current database and then
                  replace it with a fresh, empty database. Your old data will
                  be backed up but the master will start from scratch.
                  <br /><br />
                  <strong>This is safer than deleting records</strong> as it creates
                  an automatic backup.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset}>
                  Yes, Reset Database
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  )
}