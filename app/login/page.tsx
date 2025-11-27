'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { LoginForm } from '@/components/login-form'

export default function LoginPage() {
  const router = useRouter()
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session) {
        router.replace('/dashboard')
      } else {
        setCheckingSession(false)
      }
    }

    checkSession()
  }, [router])

  if (checkingSession) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }
  
return (
  <div className="min-h-screen flex items-center justify-center px-4">
    <div className="w-full max-w-6xl bg-white shadow-xl rounded-3xl overflow-hidden grid grid-cols-1 lg:grid-cols-2">

      {/* LEFT: LOGIN FORM */}
      <div className="px-10 py-12 flex flex-col justify-center">

        {/* Welcome Header */}
        <h1 className="text-4xl font-bold text-gray-900 mb-3">Welcome back!</h1>
        <p className="text-gray-500 mb-10">
          Simplify your workflow and boost your productivity with <span className="font-medium">TMS</span>.
        </p>

        {/* Login Form */}
        <div className="w-full max-w-sm">
          <LoginForm />
        </div>

        {/* Continue With */}
   

      </div>

      {/* RIGHT: Illustration */}
      <div className="hidden lg:flex bg-[#F7FBF5] items-center justify-center p-10 relative">

  <img
    src="/login.svg"
    alt="illustration"
    className="w-4/5 max-w-md"
  />


        {/* Floating card like screenshot */}
        <div className="absolute bottom-14 bg-white shadow-md rounded-2xl px-5 py-4 flex items-center gap-4">
          <div>
            <p className="font-medium text-gray-700">Training Managemnet System</p>
            <p className="text-sm text-gray-500">10 Tasks</p>
          </div>
          <div className="ml-auto text-green-600 font-semibold text-sm">84%</div>
        </div>

      </div>
    </div>
  </div>
)

}