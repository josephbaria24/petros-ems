"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { AlertTriangle, Edit, FileText } from "lucide-react"
import { tmsDb } from "@/lib/supabase-client"
import { toast } from "sonner"

interface DuplicateRegistrationHandlerProps {
  scheduleId: string
  email: string
  phoneNumber: string
  onProceedNew: () => void
  onEditExisting: (existingData: any) => void
  isOpen: boolean
  onClose: () => void
  duplicateData?: any
  bookingRef?: string
}

export function DuplicateRegistrationHandler({
  scheduleId,
  email,
  phoneNumber,
  onProceedNew,
  onEditExisting,
  isOpen,
  onClose,
    duplicateData,
    bookingRef,
}: DuplicateRegistrationHandlerProps) {

  const existingRegistration = duplicateData
  const bookingReference = bookingRef || ""
  
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <AlertDialogTitle className="text-xl">
                Registration Already Exists
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm mt-1">
                We found an existing registration with your information
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        {existingRegistration && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-amber-200">
                <h3 className="font-semibold text-amber-900">
                  Your Registration Details
                </h3>
                <div className="flex items-center gap-2 text-xs text-amber-700">
                  <FileText className="w-4 h-4" />
                  <span className="font-mono font-semibold">{bookingReference}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-amber-700 font-medium">Full Name</p>
                  <p className="text-amber-900">
                    {existingRegistration.first_name}{" "}
                    {existingRegistration.middle_initial}{" "}
                    {existingRegistration.last_name}
                  </p>
                </div>
                <div>
                  <p className="text-amber-700 font-medium">Email</p>
                  <p className="text-amber-900">{existingRegistration.email}</p>
                </div>
                <div>
                  <p className="text-amber-700 font-medium">Phone Number</p>
                  <p className="text-amber-900">
                    {existingRegistration.phone_number}
                  </p>
                </div>
                <div>
                  <p className="text-amber-700 font-medium">Status</p>
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      existingRegistration.status === "pending"
                        ? "bg-yellow-100 text-yellow-800"
                        : existingRegistration.status === "approved"
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {existingRegistration.status}
                  </span>
                </div>
              </div>

              {existingRegistration.payment_status && (
                <div className="pt-3 border-t border-amber-200">
                  <p className="text-amber-700 font-medium text-sm">
                    Payment Status
                  </p>
                  <p className="text-amber-900 text-sm">
                    {existingRegistration.payment_status}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <strong>Note:</strong> You can edit your existing registration or
            proceed to create a new one. If you edit, your previous registration
            will be updated.
          </p>
        </div>

        <AlertDialogFooter className="flex flex-col sm:flex-row gap-2">
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <Button
            variant="outline"
            onClick={() => {
              onEditExisting(existingRegistration)
              onClose()
            }}
            className="flex items-center gap-2"
          >
            <Edit className="w-4 h-4" />
            Edit My Registration
          </Button>
          <AlertDialogAction
            onClick={() => {
              onProceedNew()
              onClose()
            }}
            className="bg-slate-900 hover:bg-slate-700"
          >
            Create New Registration
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// Utility function to check for duplicate registration
export async function checkDuplicateRegistration(
  scheduleId: string,
  email: string,
  phoneNumber: string
): Promise<{ isDuplicate: boolean; data: any | null; bookingRef: string | null }> {
  try {
    // Normalize phone number for comparison (remove spaces and special chars)
    const normalizedPhone = phoneNumber.replace(/\s+/g, "").replace(/\+/g, "")

    // Check for duplicate by email OR phone number in the same schedule
    const { data: existingTrainings, error: trainingError } = await tmsDb
      .from("trainings")
      .select("*")
      .eq("schedule_id", scheduleId)
      .or(`email.eq.${email},phone_number.ilike.%${normalizedPhone}%`)
      .limit(1)

    if (trainingError) {
      console.error("Error checking duplicates:", trainingError)
      return { isDuplicate: false, data: null, bookingRef: null }
    }

    if (existingTrainings && existingTrainings.length > 0) {
      const existingTraining = existingTrainings[0]

      // Fetch booking reference
      const { data: bookingData, error: bookingError } = await tmsDb
        .from("booking_summary")
        .select("reference_number")
        .eq("training_id", existingTraining.id)
        .single()

      if (bookingError) {
        console.error("Error fetching booking reference:", bookingError)
      }

      return {
        isDuplicate: true,
        data: existingTraining,
        bookingRef: bookingData?.reference_number || null,
      }
    }

    return { isDuplicate: false, data: null, bookingRef: null }
  } catch (error) {
    console.error("Unexpected error in duplicate check:", error)
    return { isDuplicate: false, data: null, bookingRef: null }
  }
}

// Component to display the duplicate registration data
export function DuplicateRegistrationDisplay({
  registration,
  bookingReference,
  onEdit,
  onCancel,
}: {
  registration: any
  bookingReference: string
  onEdit: () => void
  onCancel: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
        <div className="flex-1">
          <h3 className="font-semibold text-amber-900">
            Registration Already Exists
          </h3>
          <p className="text-sm text-amber-700 mt-1">
            We found an existing registration for this training with your email or
            phone number.
          </p>
        </div>
      </div>

      <Card className="border-2 border-amber-200">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between pb-4 border-b">
            <h4 className="font-semibold text-gray-900">
              Your Registration Details
            </h4>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 rounded-lg">
              <FileText className="w-4 h-4 text-amber-700" />
              <span className="text-sm font-mono font-semibold text-amber-900">
                {bookingReference}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Full Name</p>
              <p className="text-gray-900">
                {registration.first_name} {registration.middle_initial}{" "}
                {registration.last_name}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Email</p>
              <p className="text-gray-900">{registration.email}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Phone Number</p>
              <p className="text-gray-900">{registration.phone_number}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Status</p>
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                  registration.status === "pending"
                    ? "bg-yellow-100 text-yellow-800"
                    : registration.status === "approved"
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {registration.status?.toUpperCase()}
              </span>
            </div>
            {registration.employment_status && (
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Employment Status
                </p>
                <p className="text-gray-900">{registration.employment_status}</p>
              </div>
            )}
            {registration.payment_status && (
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Payment Status
                </p>
                <p className="text-gray-900">{registration.payment_status}</p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-gray-600 mb-4">
              Would you like to edit your existing registration or cancel and start
              over?
            </p>
            <div className="flex gap-3">
              <Button
                onClick={onEdit}
                className="flex-1 bg-slate-900 hover:bg-slate-700"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit My Registration
              </Button>
              <Button onClick={onCancel} variant="outline" className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}