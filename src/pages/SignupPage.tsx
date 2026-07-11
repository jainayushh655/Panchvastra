import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { registerUser } from '@/api/auth'
import { OtpVerificationModal } from '@/components/auth/OtpVerificationModal'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/context/AuthProvider'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { validateEmail, validateName } from '@/lib/formValidation'

export function SignupPage() {
  useDocumentTitle('Sign up')
  const navigate = useNavigate()
  const { verifyOtpAndLogin } = useAuth()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false)
  const [otpError, setOtpError] = useState<string | null>(null)
  const [isOtpVerifying, setIsOtpVerifying] = useState(false)

  const inputClass =
    'w-full rounded-xl border border-[#dcc59b] bg-white/95 px-3 py-2.5 text-sm text-zinc-900 outline-none transition-colors focus:border-[#b07f2e]'

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()

    const firstNameErr = validateName(firstName)
    if (firstNameErr) {
      setError(firstNameErr)
      return
    }

    const lastNameErr = validateName(lastName)
    if (lastNameErr) {
      setError(lastNameErr)
      return
    }

    const emailErr = validateEmail(email)
    if (emailErr) {
      setError(emailErr)
      return
    }

    if (phoneNumber.length !== 10) {
      setError('Phone number must be exactly 10 digits.')
      return
    }

    setError('')
    setIsSubmitting(true)

    try {
      const response = await registerUser({
        first_name: firstName,
        last_name: lastName,
        email,
        phone_number: phoneNumber,
      })

        // if (response?.status ) {
        //   setOtpError(null)
        //   setIsOtpModalOpen(true)
        // } else {
        //   setError(response?.message ?? 'Registration failed.')
        // }

      if (response.success) {
    setOtpError(null);
    setIsOtpModalOpen(true);
} else {
    setError(response.message ?? "Registration failed.");
}  
    } catch (error: unknown) {
      const message =
        typeof error === 'object' && error && 'response' in error
          ? ((error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Registration failed.')
          : 'Registration failed.'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOtpVerify = async (otp: string) => {
    setOtpError(null)
    setIsOtpVerifying(true)

    const result = await verifyOtpAndLogin({ email, otp })
    setIsOtpVerifying(false)

    if (!result.ok) {
      setOtpError(result.error)
      return
    }

    setIsOtpModalOpen(false)
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-svh bg-[radial-gradient(circle_at_top,rgba(214,179,109,0.24),transparent_40%),linear-gradient(180deg,#fff8eb,#fffdf8)] px-4 py-14">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-[#e5cfaa] bg-white/90 p-7 shadow-[0_30px_60px_-36px_rgba(0,0,0,0.4)] backdrop-blur">

        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#8a7355]">
          Create your account
        </p>

        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#b07f2e]">
          Sign up
        </h1>

        <p className="mt-2 text-sm text-zinc-600">
          Register once and continue with a smoother checkout flow.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>

          {/* First Name */}
          <div>
            <label
              htmlFor="signup-firstname"
              className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8a7355]"
            >
              First Name
            </label>

            <input
              id="signup-firstname"
              className={`${inputClass} mt-1`}
              placeholder="First Name"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value)
                setError('')
              }}
            />
          </div>

          {/* Last Name */}
          <div>
            <label
              htmlFor="signup-lastname"
              className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8a7355]"
            >
              Last Name
            </label>

            <input
              id="signup-lastname"
              className={`${inputClass} mt-1`}
              placeholder="Last Name"
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value)
                setError('')
              }}
            />
          </div>

          {/* Email */}
          <div>
            <label
              htmlFor="signup-email"
              className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8a7355]"
            >
              Email
            </label>

            <input
              id="signup-email"
              type="email"
              autoComplete="email"
              className={`${inputClass} mt-1`}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setError('')
              }}
            />
          </div>

          {/* Phone Number */}
          <div>
            <label
              htmlFor="signup-phone"
              className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8a7355]"
            >
              Phone Number
            </label>

            <input
              id="signup-phone"
              type="tel"
              className={`${inputClass} mt-1`}
              placeholder="9876543210"
              value={phoneNumber}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '')
                setPhoneNumber(value)
                setError('')
              }}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">
              {error}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full !border-[#b07f2e] !bg-[#b07f2e] !text-white hover:!bg-[#99661f]"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create Account'}
          </Button>

        </form>

        <p className="mt-6 text-sm text-zinc-600">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-semibold text-[#8a7355] hover:text-[#b07f2e]"
          >
            Login
          </Link>
        </p>

      </div>

      <OtpVerificationModal
        isOpen={isOtpModalOpen}
        email={email}
        title="Verify Your Email"
        message="Enter the 6-digit OTP sent to your email."
        error={otpError}
        isVerifying={isOtpVerifying}
        submitLabel="Verify OTP"
        onVerify={handleOtpVerify}
        onCancel={() => setIsOtpModalOpen(false)}
      />
    </div>
  )
}
