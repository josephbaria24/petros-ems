// app/guest-training-registration/layout.tsx
export default function GuestRegistrationLayout({
    children,
  }: {
    children: React.ReactNode
  }) {
    return (
      <div className="m-0 p-0 min-h-screen">
        {children}
      </div>
    )
  }