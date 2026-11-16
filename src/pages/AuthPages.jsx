import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '../components/ui/button.jsx'
import { Card } from '../components/ui/card.jsx'
import { Checkbox } from '../components/ui/checkbox.jsx'
import { Input } from '../components/ui/input.jsx'
import { Label } from '../components/ui/label.jsx'
import { Separator } from '../components/ui/separator.jsx'
import { Alert } from '../components/ui/alert.jsx'
import { ThemeToggle } from '../components/ThemeToggle.jsx'
import { AuthNotConfiguredError, isDemoAuth, requestPasswordReset, signIn, signUp, updatePassword } from '../services/authService.js'
import { useAuth } from '../auth/AuthProvider.jsx'
import { ArthSaathiIllustration, ArthSaathiMark } from '../components/illustrations/ArthSaathiIllustration.jsx'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function AuthLayout({ title, description, children, footer }) {
  return <div className="auth-page">
    <header className="auth-header">
      <Link className="auth-brand" to="/" aria-label="ArthSaathi home"><ArthSaathiMark decorative className="auth-brand-mark" /><span>ArthSaathi</span></Link>
      <div className="auth-header-actions"><ThemeToggle /><Link className="auth-home-link" to="/">Back to home</Link></div>
    </header>
    <main className="auth-main">
      <Card className="auth-card">
        <ArthSaathiIllustration scene="auth" className="auth-mascot-art" />
        <div className="auth-heading"><h1>{title}</h1><p>{description}</p></div>
        {children}
        {footer && <><Separator className="auth-separator" /><div className="auth-footer">{footer}</div></>}
      </Card>
    </main>
  </div>
}

function PasswordField({ id, label, value, onChange, error, autoComplete, hint }) {
  const [visible, setVisible] = useState(false)
  return <div className="auth-field">
    <Label htmlFor={id}>{label}</Label>
    <div className="auth-password-wrap">
      <Input id={id} name={id} type={visible ? 'text' : 'password'} value={value} onChange={onChange} autoComplete={autoComplete} aria-invalid={Boolean(error)} aria-describedby={[error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined} />
      <button className="password-toggle" type="button" onClick={() => setVisible(open => !open)} aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} aria-pressed={visible}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button>
    </div>
    {error && <p className="auth-field-error" id={`${id}-error`}>{error}</p>}
    {hint && <p className="password-guidance" id={`${id}-hint`}>{hint}</p>}
  </div>
}

function EmailField({ value, onChange, error }) {
  return <div className="auth-field">
    <Label htmlFor="email">Email address</Label>
    <Input id="email" name="email" type="email" value={value} onChange={onChange} autoComplete="email" placeholder="you@example.com" aria-invalid={Boolean(error)} aria-describedby={error ? 'email-error' : undefined} />
    {error && <p className="auth-field-error" id="email-error">{error}</p>}
  </div>
}

function errorMessage(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback
}

function passwordStrength(password) {
  if (!password) return null
  const score = [password.length >= 8, password.length >= 12, /[a-z]/.test(password) && /[A-Z]/.test(password), /\d/.test(password) && /[^A-Za-z0-9]/.test(password)].filter(Boolean).length
  const level = score < 2 ? 'Weak' : score < 4 ? 'Good' : 'Strong'
  const filled = score < 2 ? 1 : score < 4 ? 2 : 3
  return { score: filled, level }
}

export function SignUpPage() {
  const navigate = useNavigate()
  const { refreshSession } = useAuth()
  const demoAuth = isDemoAuth()
  const [values, setValues] = useState({ fullName: '', storeName: '', email: '', password: '', confirmPassword: '', acceptedTerms: false })
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('default')
  const [submitting, setSubmitting] = useState(false)
  const update = (name, value) => {
    setValues(current => ({ ...current, [name]: value }))
    setErrors(current => {
      const next = { ...current }
      delete next[name]
      if (name === 'acceptedTerms') delete next.terms
      if (name === 'password' && values.confirmPassword === value) delete next.confirmPassword
      return next
    })
    setMessage('')
  }

  const submit = async (event) => {
    event.preventDefault()
    setErrors({})
    setMessage('')
    if (!values.fullName.trim()) return setErrors({ fullName: 'Enter your name.' })
    if (!values.storeName.trim()) return setErrors({ storeName: 'Enter your shop name.' })
    if (!emailPattern.test(values.email.trim())) return setErrors({ email: 'Enter a valid email address.' })
    if (values.password.length < 8) return setErrors({ password: 'Use at least 8 characters.' })
    if (values.password !== values.confirmPassword) return setErrors({ confirmPassword: 'Passwords do not match.' })
    if (!values.acceptedTerms) return setErrors({ terms: 'Please accept the Terms of Service and Privacy Policy.' })
    setSubmitting(true)
    try {
      const result = await signUp({ fullName: values.fullName.trim(), storeName: values.storeName.trim(), email: values.email.trim(), password: values.password })
      if (result.session) { await refreshSession(); navigate('/dashboard', { replace: true }) }
      else { setMessage('Your account request was received. Check your email to confirm the account before logging in.'); setMessageType('default') }
    } catch (failure) {
      const text = failure instanceof AuthNotConfiguredError ? failure.message : /already registered|already exists/i.test(failure?.message || '') ? 'An account already exists for this email. Log in instead.' : errorMessage(failure, 'We could not create your account. Please try again.')
      setMessage(text); setMessageType('destructive')
    } finally { setSubmitting(false) }
  }

  return <AuthLayout title="Create your account" description="Get started with a workspace built to help you work smarter." footer={<>Already have an account? <Link to="/login">Log in</Link></>}>
    <form className="auth-form" onSubmit={submit} noValidate>
      {demoAuth && <Alert className="auth-message">Local demo mode: accounts stay on this device and are not production-secure. Configure Supabase Auth for hosted authentication.</Alert>}
      <div className="auth-field"><Label htmlFor="fullName">Full name</Label><Input id="fullName" name="name" value={values.fullName} onChange={e => update('fullName', e.target.value)} autoComplete="name" aria-invalid={Boolean(errors.fullName)} aria-describedby={errors.fullName ? 'fullName-error' : undefined} placeholder="Your name" />{errors.fullName && <p className="auth-field-error" id="fullName-error">{errors.fullName}</p>}</div>
      <div className="auth-field"><Label htmlFor="storeName">Shop name</Label><Input id="storeName" name="storeName" value={values.storeName} onChange={e => update('storeName', e.target.value)} autoComplete="organization" aria-invalid={Boolean(errors.storeName)} aria-describedby={errors.storeName ? 'storeName-error' : undefined} placeholder="Your shop name" />{errors.storeName && <p className="auth-field-error" id="storeName-error">{errors.storeName}</p>}</div>
      <EmailField value={values.email} onChange={e => update('email', e.target.value)} error={errors.email} />
      <PasswordField id="password" label="Password" value={values.password} onChange={e => update('password', e.target.value)} error={errors.password} autoComplete="new-password" hint="Use at least 8 characters. A mix of letters, numbers, and symbols is stronger." />
      <PasswordField id="confirmPassword" label="Confirm password" value={values.confirmPassword} onChange={e => update('confirmPassword', e.target.value)} error={errors.confirmPassword} autoComplete="new-password" />
      <div className="auth-check-field"><div className="auth-check-row"><Checkbox id="acceptTerms" checked={values.acceptedTerms} onChange={e => update('acceptedTerms', e.target.checked)} aria-invalid={Boolean(errors.terms)} aria-describedby={errors.terms ? 'terms-error' : undefined} /><span className="terms-copy"><Label htmlFor="acceptTerms">I agree to the Terms of Service and Privacy Policy.</Label><span className="terms-links"><Link to="/#footer">View Terms</Link><span aria-hidden="true">·</span><Link to="/#footer">Privacy Policy</Link></span></span></div>{errors.terms && <p className="auth-field-error" id="terms-error">{errors.terms}</p>}</div>
      {values.password && <div className="password-strength" role="meter" aria-valuemin={1} aria-valuemax={3} aria-valuenow={passwordStrength(values.password).score} aria-valuetext={`Password strength: ${passwordStrength(values.password).level}`}><div aria-hidden="true">{[1, 2, 3].map(step => <span className={step <= passwordStrength(values.password).score ? 'filled' : ''} key={step} />)}</div><span>{passwordStrength(values.password).level}</span></div>}
      {message && <Alert variant={messageType} className="auth-message">{message}</Alert>}
      <Button className="auth-submit" type="submit" disabled={submitting}>{submitting ? 'Creating account…' : 'Create account'}</Button>
    </form>
  </AuthLayout>
}

export function LoginPage() {
  const navigate = useNavigate()
  const { refreshSession } = useAuth()
  const demoAuth = isDemoAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('default')
  const [rememberMe, setRememberMe] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const submit = async (event) => {
    event.preventDefault()
    setErrors({})
    setMessage('')
    if (!emailPattern.test(email.trim())) return setErrors({ email: email.trim() ? 'Enter a valid email address.' : 'Enter your email address.' })
    if (!password) return setErrors({ password: 'Enter your password.' })
    setSubmitting(true)
    try { await signIn({ email: email.trim(), password, rememberMe }); await refreshSession(); navigate('/dashboard', { replace: true }) }
    catch (failure) {
      const text = failure instanceof AuthNotConfiguredError ? failure.message : /invalid login credentials|invalid email or password/i.test(failure?.message || '') ? 'The email or password is incorrect.' : errorMessage(failure, 'We could not log you in. Please try again.')
      setMessage(text); setMessageType('destructive')
    } finally { setSubmitting(false) }
  }
  return <AuthLayout title="Welcome back" description="Log in to continue where you left off." footer={<>Don't have an account? <Link to="/signup">Sign up</Link></>}>
    <form className="auth-form" onSubmit={submit} noValidate>
      {demoAuth && <Alert className="auth-message">Local demo mode: accounts stay on this device and are not production-secure. Configure Supabase Auth for hosted authentication.</Alert>}
      <EmailField value={email} onChange={e => { setEmail(e.target.value); setErrors(current => ({ ...current, email: '' })); setMessage('') }} error={errors.email} />
      <PasswordField id="loginPassword" label="Password" value={password} onChange={e => { setPassword(e.target.value); setErrors(current => ({ ...current, password: '' })); setMessage('') }} error={errors.password} autoComplete="current-password" />
      <div className="auth-login-options"><label className="auth-remember"><Checkbox checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} /><span>Remember me</span></label><Link to="/forgot-password">Forgot password?</Link></div>
      {message && <Alert variant={messageType} className="auth-message">{message}</Alert>}
      <Button className="auth-submit" type="submit" disabled={submitting}>{submitting ? 'Logging in…' : 'Log in'}</Button>
    </form>
  </AuthLayout>
}

export function AuthHubPage() {
  const [mode, setMode] = useState(() => new URLSearchParams(window.location.search).get('mode') === 'signup' ? 'signup' : 'login')
  return <div className="auth-hub"><div className="auth-hub-tabs" role="tablist" aria-label="Account access"><button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => setMode('login')}>Log in</button><button type="button" role="tab" aria-selected={mode === 'signup'} onClick={() => setMode('signup')}>Create account</button></div>{mode === 'login' ? <LoginPage /> : <SignUpPage />}</div>
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('default')
  const [submitting, setSubmitting] = useState(false)
  const submit = async (event) => {
    event.preventDefault()
    if (!email.trim()) { setError('Enter your email address.'); return }
    if (!emailPattern.test(email)) { setError('Enter a valid email address.'); return }
    setError('')
    setMessage('')
    setSubmitting(true)
    try {
      await requestPasswordReset({ email: email.trim() })
      setMessage('If an account exists for that email, you will receive password reset instructions.')
      setMessageType('default')
    } catch (failure) {
      setMessage(failure instanceof AuthNotConfiguredError ? failure.message : 'We could not process that request right now. Please try again.')
      setMessageType('destructive')
    } finally { setSubmitting(false) }
  }
  return <AuthLayout title="Reset your password" description="Enter your email and we’ll help you get back into your account." footer={<>Remembered your password? <Link to="/login">Log in</Link></>}>
    <form className="auth-form" onSubmit={submit} noValidate>
      <EmailField value={email} onChange={e => { setEmail(e.target.value); setError(''); setMessage('') }} error={error} />
      {message && <Alert variant={messageType} className="auth-message">{message}</Alert>}
      <Button className="auth-submit" type="submit" disabled={submitting}>{submitting ? 'Submitting…' : 'Send reset instructions'}</Button>
    </form>
  </AuthLayout>
}

export function ResetPasswordPage() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submit = async event => {
    event.preventDefault()
    if (password.length < 8) { setErrors({ password: 'Use at least 8 characters.' }); return }
    if (password !== confirmPassword) { setErrors({ confirmPassword: 'Passwords do not match.' }); return }
    setErrors({})
    setSubmitting(true)
    try {
      await updatePassword({ password })
      setMessage('Your password has been updated.')
      window.setTimeout(() => navigate('/dashboard', { replace: true }), 700)
    } catch (failure) { setErrors({ form: errorMessage(failure, 'We could not update your password. Request a new reset link and try again.') }) }
    finally { setSubmitting(false) }
  }
  return <AuthLayout title="Choose a new password" description="Set a new password for your ArthSaathi account." footer={<>Need a new link? <Link to="/forgot-password">Request a reset</Link></>}>
    {loading ? <p className="auth-reset-status">Checking your recovery link…</p> : session ? <form className="auth-form" onSubmit={submit} noValidate><PasswordField id="newPassword" label="New password" value={password} onChange={event => { setPassword(event.target.value); setErrors(current => ({ ...current, password: '', form: '' })) }} error={errors.password} autoComplete="new-password" hint="Use at least 8 characters." /><PasswordField id="confirmNewPassword" label="Confirm new password" value={confirmPassword} onChange={event => { setConfirmPassword(event.target.value); setErrors(current => ({ ...current, confirmPassword: '', form: '' })) }} error={errors.confirmPassword} autoComplete="new-password" />{errors.form && <Alert variant="destructive" className="auth-message">{errors.form}</Alert>}{message && <Alert className="auth-message">{message}</Alert>}<Button className="auth-submit" disabled={submitting}>{submitting ? 'Updating…' : 'Update password'}</Button></form> : <div className="auth-form"><Alert variant="destructive" className="auth-message">This password reset link is invalid or has expired. Request a new one to continue.</Alert><Link className="auth-submit button button-primary" to="/forgot-password">Request a reset link</Link></div>}
  </AuthLayout>
}
