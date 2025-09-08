import { LoginForm } from "@/components/login-form"
import { FloatingShapes } from "@/components/floating-shapes"

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-100 via-teal-50 to-cyan-100 relative overflow-hidden flex items-center justify-center p-4">
      <FloatingShapes />

      <div className="w-full max-w-md relative z-10">
        <LoginForm />
      </div>
    </div>
  )
}
