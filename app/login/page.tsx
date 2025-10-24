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
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left Side - Login Form */}
      <div className="flex flex-col bg-background text-white p-8 md:p-16 lg:p-20">
        {/* Logo/Brand */}
        <div className="mb-16">
          <div className="flex items-center gap-2">
            <svg className="w-8 h-8 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm0 18c-3.89-1.21-6.49-4.89-6.49-8.5V8.39l6.49-3.26 6.49 3.26v3.11c0 3.61-2.6 7.29-6.49 8.5z"/>
              <path d="M9 12l2 2 4-4"/>
            </svg>
            <span className="text-xl font-semibold text-gray-400">TMS</span>
          </div>
        </div>

        {/* Login Content */}
        <div className="flex-1 flex items-start justify-center md:justify-start max-w-md">
          <div className="w-full">
            <LoginForm />
          </div>
        </div>
      </div>

      {/* Right Side - Hero Section */}
      <div className="relative hidden lg:flex items-center justify-center rounded-2xl bg-gradient-to-br from-gray-800 via-gray-900 to-black overflow-hidden">
        {/* Geometric Pattern Background */}
        <div className="absolute inset-0 flex items-center justify-end pr-0">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute border-l border-t border-gray-600"
              style={{
                width: `${(i + 1) * 80}px`,
                height: `${(i + 1) * 80}px`,
                right: `${i * 15}px`,
                bottom: '50%',
                transform: 'translateY(50%) rotate(45deg)',
                opacity: 0.3 - i * 0.02,
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="relative z-10 px-16 max-w-xl">
          <h2 className="text-4xl font-bold text-white mb-6 leading-tight">
            A new way to experience training management in the digital space.
          </h2>
        </div>

        {/* Navigation Arrow */}
      </div>
    </div>
  )
}