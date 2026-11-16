import { Suspense, lazy, useEffect, useState } from 'react'
import { ArrowRight, Check, CircleDollarSign, Code2, Globe2, Layers3, LockKeyhole, Mail, Menu, Play, Quote, Sparkles, Users, X, Zap } from 'lucide-react'
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Button } from './components/ui/button.jsx'
import { Card } from './components/ui/card.jsx'
import { Badge } from './components/ui/badge.jsx'
import { Input } from './components/ui/input.jsx'
import { ThemeToggle } from './components/ThemeToggle.jsx'
import { SignUpPage, LoginPage, ForgotPasswordPage, ResetPasswordPage, AuthHubPage } from './pages/AuthPages.jsx'
import { useAuth } from './auth/AuthProvider.jsx'
import { ArthSaathiIllustration, ArthSaathiMark } from './components/illustrations/ArthSaathiIllustration.jsx'
import { RetailShell } from './components/layout/RetailShell.jsx'
const RetailPage = lazy(() => import('./retail/RetailPages.jsx'))
const ContrastCheckerPage = lazy(() => import('./retail/ContrastCheckerPage.jsx'))

function Eyebrow({ children }) { return <p className="eyebrow">{children}</p> }
function SectionHead({ label, title, description, align = 'center' }) {
  return <div className={`section-head ${align}`}><Eyebrow>{label}</Eyebrow><h2>{title}</h2>{description && <p>{description}</p>}</div>
}

const primaryNav = [
  ['Products', '#features'],
  ['Solutions', '#features'],
  ['Pricing', '#pricing'],
  ['Company', '#footer'],
]

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (!menuOpen) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  const closeMenu = () => setMenuOpen(false)
  const goToSignUp = () => {
    closeMenu()
    navigate('/signup')
  }
  const links = (className) => primaryNav.map(([label, href]) => (
    <a className={className} href={href} key={label} onClick={closeMenu}>{label}</a>
  ))

  return <header className="navbar">
    <div className="navbar-inner">
      <Link className="navbar-brand" to="/" aria-label="ArthSaathi home">
        <ArthSaathiMark decorative className="navbar-mark" />
        <span>ArthSaathi</span>
      </Link>
      <nav className="navbar-links" aria-label="Main navigation">{links('navbar-link')}</nav>
      <div className="navbar-actions">
        <ThemeToggle />
        <Link className="navbar-login" to="/login">Login</Link>
      <Button className="navbar-cta" onClick={goToSignUp}>Get Started</Button>
      </div>
      <button className="navbar-menu-toggle" type="button" aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen(open => !open)}>
        {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
      </button>
    </div>
    <div className="mobile-navigation" id="mobile-navigation" hidden={!menuOpen}>
      <nav aria-label="Mobile navigation">{links('mobile-navigation-link')}</nav>
      <div className="mobile-navigation-actions">
        <ThemeToggle />
        <Link className="navbar-login" to="/login" onClick={closeMenu}>Login</Link>
      <Button className="navbar-cta" onClick={goToSignUp}>Get Started</Button>
      </div>
    </div>
  </header>
}

function Hero() {
  const [preview, setPreview] = useState(false)
  const navigate = useNavigate()
  return <section className="hero" id="top">
    <div className="hero-copy">
      <Badge className="announcement">A smarter way to manage your dukaan.</Badge>
      <h1>Apne Business Ka<br />Apna Saathi.</h1>
      <p>Manage your stock, billing, sales, and customer udhaar in one place.<br className="desktop" /> Know what is in stock, record transactions, and keep pending payments visible.</p>
      <Button onClick={() => navigate('/signup')}>Get Started</Button>
    </div>
    <div className="hero-media">
      <ArthSaathiIllustration scene="shop" className="hero-artwork" />
      <button className="play-button" aria-label="Open video preview" onClick={() => setPreview(true)}><Play size={24} fill="none" /></button>
    </div>
    {preview && <div className="modal-backdrop" role="presentation" onClick={() => setPreview(false)}><div className="preview-modal" role="dialog" aria-modal="true" aria-labelledby="preview-title" onClick={e => e.stopPropagation()}><button className="modal-close" aria-label="Close preview" onClick={() => setPreview(false)}><X /></button><ArthSaathiIllustration scene="shop" className="preview-artwork" /><div><span className="eyebrow">ARTHSAATHI</span><h2 id="preview-title">Apne Business Ka Apna Saathi.</h2><p>Manage your daily shop records with greater clarity.</p></div></div></div>}
  </section>
}

function Trusted() { return <section className="trusted"><p>Built for India's hardworking shopkeepers.</p></section> }

const miniFeatures = [
  { scene: 'credit', title: "Udhaar You Don't Lose Track Of", text: 'Keep customer credit records organized, track pending payments, and know who owes what.' },
  { scene: 'operations', title: 'Seamless Daily Operations', text: 'Bring your everyday shop activities together so you spend less time managing records and more time serving customers.' },
  { scene: 'customer', title: 'Customers Who Keep Coming Back', text: 'Keep customer details and transaction history organized to provide better service and build lasting relationships.' },
  { scene: 'profit', title: 'Understand Product Profit', text: 'Review sale totals, product costs, and recorded profit to understand which items contribute more.' },
]
function Benefits() {
  return <section className="benefits section-pad" id="features">
    <SectionHead label="Benefits" title="Less Hisaab-Kitaab. More Business Growth." description="Everything you need to manage your daily business, stay on top of your money, and keep your shop moving forward." />
    <div className="feature-pair">
      <article className="feature-block"><h3>Stock That Stays in Control</h3><p>Know what's selling, what's running low, and what needs restocking before your customers ask.</p><ArthSaathiIllustration scene="stock" className="feature-illustration" /></article>
      <article className="feature-block"><h3>Billing Without the Hassle</h3><p>Create bills, record sales, and keep your daily transactions organized without the usual confusion.</p><ArthSaathiIllustration scene="billing" className="feature-illustration" /></article>
    </div>
    <div className="mini-grid">{miniFeatures.map(({ scene, title, text }) => <article key={title}><ArthSaathiIllustration scene={scene} className="mini-feature-art" /><h4>{title}</h4><p>{text}</p></article>)}</div>
  </section>
}

const people = [
  { name: 'Opening the shop', role: 'A quick stock check', scene: 'stock' },
  { name: 'The daily udhaar', role: 'A note worth keeping', scene: 'credit' },
  { name: 'At the counter', role: 'One customer at a time', scene: 'customer' },
  { name: 'Closing hisaab', role: 'Reviewing the day', scene: 'profit' },
]
function Testimonial() {
  return <section className="testimonial section-pad">
    <div className="quote-head"><div><p className="quote-kicker"><Quote size={17} /> Built for the People Who Keep Business Moving.</p><blockquote>Running a shop takes hard work. ArthSaathi is built to help make everyday business management clearer, simpler, and more organized.</blockquote><p className="quote-date">For India's shopkeepers</p></div><div className="brand-story-mark"><ArthSaathiMark decorative /> ArthSaathi</div></div>
    <div className="people-grid">{people.map(person => <Card className="person-card" key={person.name}><ArthSaathiIllustration scene={person.scene} title={`${person.name}: ${person.role}`} /><div className="person-caption"><div>{person.role}</div><strong>{person.name}</strong><span>ArthSaathi shop stories</span></div></Card>)}</div>
  </section>
}

const stats = [
  { value: 'Sales', label: 'Keep daily transactions organized', link: 'Our Customers' },
  { value: 'Stock', label: 'Know what needs restocking', link: 'Learn More' },
  { value: 'Udhaar', label: 'Track pending payments', link: 'Customer Stories' },
  { value: 'Payments', label: 'Keep pending balances visible', link: 'Explore ArthSaathi' },
]
function Stats() {
  return <section className="stats section-pad"><div className="stats-copy"><h2>Your Business. A Clearer Picture.</h2><p>Keep an eye on your sales, stock, and pending payments. Understand your business better and make decisions with confidence.</p><div className="stats-grid">{stats.map(s => <article key={s.value}><strong>{s.value}</strong><span>{s.label}</span><a href="#contact">{s.link} <ArrowRight size={15} /></a></article>)}</div></div><ArthSaathiIllustration scene="profit" className="stats-image" /></section>
}

const tiers = [
  { name: 'Starter', icon: Sparkles, annual: 10, description: 'For small shops that want to organize everyday business operations.', features: ['Organize daily business records', 'Manage your inventory', 'Record sales and transactions', 'Keep customer credit records'] },
  { name: 'Pro', icon: Zap, annual: 24, description: 'For growing shops that need better control over stock, sales, and payments.', features: ['Everything in Starter', 'Sort and search inventory', 'Review sales and recorded profit', 'Track customer balances'], popular: true },
  { name: 'Enterprise', icon: Layers3, annual: 48, description: 'For larger businesses that need more control over their operations.', features: ['Everything in Pro', 'Print completed invoices', 'Review sales and inventory trends', 'Manage on-device shop records'] },
]
function Pricing() {
  const [annual, setAnnual] = useState(true)
  const navigate = useNavigate()
  return <section className="pricing section-pad" id="pricing"><SectionHead label="Pricing" title="Simple Plans. Smarter Shop Management." description="Choose a plan that fits your business today, with room to grow as your shop grows." />
    <div className="billing" role="group" aria-label="Billing period"><button className={annual ? 'selected' : ''} onClick={() => setAnnual(true)} aria-pressed={annual}>Billed Yearly</button><button className={!annual ? 'selected' : ''} onClick={() => setAnnual(false)} aria-pressed={!annual}>Billed Monthly</button></div>
    <div className="pricing-grid">{tiers.map(tier => {const Icon = tier.icon; return <Card className={`price-card ${tier.popular ? 'popular' : ''}`} key={tier.name}>{tier.popular && <Badge className="popular-badge">Most Popular</Badge>}<div className="plan-icon"><Icon size={18} /></div><h3>{tier.name}</h3><p className="plan-description">{tier.description}</p><div className="price"><strong>{annual ? `$${tier.annual}` : 'Contact us'}</strong><span>{annual ? <>Per month<br />Plus applicable taxes</> : <>Monthly pricing<br />on request</>}</span></div><Button variant={tier.popular ? 'primary' : 'outline'} onClick={() => navigate('/signup')}>Get Started</Button><ul>{tier.features.map(item => <li key={item}><Check size={15} />{item}</li>)}</ul></Card>})}</div>
  </section>
}

const posts = [
  { category: 'Profit & Finance', title: 'Sales Are Up. But Is Your Profit?', read: 'Business guide', desc: "Learn why sales alone don't tell the whole story and how tracking product costs helps you understand recorded profit.", author: 'ArthSaathi', date: 'Profit & finance', scene: 'profit' },
  { category: 'Inventory', title: 'Never Lose Track of Your Stock', read: 'Stock guide', desc: 'Discover practical ways to manage inventory, spot low-stock products, and avoid unnecessary overstocking.', author: 'ArthSaathi', date: 'Inventory guide', scene: 'stock' },
  { category: 'Customer Payments', title: 'Udhaar, Without the Confusion', read: 'Payment guide', desc: 'Learn how organized credit records and timely payment follow-ups can help you stay on top of customer dues.', author: 'ArthSaathi', date: 'Customer payments', scene: 'credit' },
]
function Blog() {
  return <section className="blog section-pad" id="blog"><div className="blog-head"><div><Eyebrow>Business Guides</Eyebrow><h2>Smart Business Starts with Better Hisaab.</h2><p>Practical tips and useful ideas to help you manage stock, record sales, follow up on payments, and understand product profit.</p></div><a className="see-all" href="#blog">See All <ArrowRight size={15} /></a></div><div className="blog-grid">{posts.map(post => <article className="blog-card" key={post.title}><a className="blog-image" href="#blog" aria-label={`Read ${post.title}`}><ArthSaathiIllustration scene={post.scene} title={`${post.category}: ${post.title}`} /></a><div className="blog-meta"><span>{post.category}</span><small>{post.read}</small></div><h3><a href="#blog">{post.title}</a></h3><p>{post.desc}</p><div className="author"><ArthSaathiMark decorative className="author-mark" /><span>{post.author}<small>{post.date}</small></span></div></article>)}</div></section>
}

const faqs = [
  { icon: Sparkles, q: 'What is ArthSaathi?', a: 'ArthSaathi is a business management platform designed to help shopkeepers organize supported inventory, billing, sales, customer, and payment records.' },
  { icon: Users, q: 'Who is ArthSaathi for?', a: 'ArthSaathi is designed for kirana stores, local retailers, and small businesses that want to manage their daily operations with greater clarity and control.' },
  { icon: CircleDollarSign, q: 'How much does ArthSaathi cost?', a: 'Our plans are designed to suit different business needs. Visit the pricing section to compare the available plans and choose the right fit for your shop.' },
  { icon: Code2, q: 'Do I need technical skills to use ArthSaathi?', a: 'ArthSaathi aims to make everyday business management straightforward, so you can focus on running your shop instead of struggling with complicated software.' },
  { icon: Globe2, q: 'Can I try ArthSaathi before choosing a plan?', a: 'When local demo mode is active, you can create an account to explore the workspace. Demo account and shop records stay in this browser.' },
  { icon: LockKeyhole, q: 'How does ArthSaathi protect my business data?', a: 'In the current local data setup, shop records are saved in this browser on this device and are not sent to a retail server. Configure Supabase Auth for hosted sign-in; it does not sync shop records.' },
]
function FAQ() {
  return <section className="faq section-pad" id="faq"><SectionHead label="Support" title="Frequently Asked Questions" align="left" /><div className="faq-grid">{faqs.map(({ icon: Icon, q, a }) => <article className="faq-item" key={q}><div className="faq-icon"><Icon size={19} /></div><h3>{q}</h3><p>{a}</p></article>)}</div></section>
}

function Contact() { return <section className="contact section-pad" id="contact"><div className="contact-panel"><div className="avatar-stack"><span>A</span><span>₹</span><span>D</span></div><h2>Your Shop Is Growing. Is Your Hisaab Keeping Up?</h2><p>Bring your daily business records together and take the next step toward running your shop with greater confidence.</p><Button onClick={() => { document.querySelector('#newsletter')?.scrollIntoView({ behavior: 'smooth' }); document.querySelector('#email')?.focus({ preventScroll: true }) }}>Get in Touch</Button></div></section> }

function Newsletter() {
  const [message, setMessage] = useState('We respect your privacy.')
  const submit = (e) => { e.preventDefault(); const data = new FormData(e.currentTarget); const email = String(data.get('email') || ''); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setMessage('Enter a valid email address.'); return } setMessage('Newsletter sign-ups are not connected yet, so no subscription was sent.') }
  return <section className="newsletter section-pad" id="newsletter"><div><h2>Better Business Starts with Better Ideas.</h2><p>Get practical business tips, helpful guides, and ArthSaathi product updates straight to your inbox.</p></div><form onSubmit={submit}><div className="subscribe-row"><label className="sr-only" htmlFor="email">Email address</label><Input id="email" type="email" name="email" placeholder="Enter your email address" required /><Button type="submit"><Mail size={15} /> Subscribe</Button></div><small aria-live="polite">{message}</small></form></section>
}

const footerColumns = [
  { title: 'Product', links: [['Features', '#features'], ['Pricing', '#pricing'], ['How It Works', '#features', "What's New"], ['Demo', '/signup']] },
  { title: 'Company', links: [['About Us', '#top'], ['Contact Us', '#contact'], ['Blog', '#blog'], ['Careers', '#blog']] },
  { title: 'Resources', links: [['Help Center', '#faq'], ['FAQs', '#faq'], ['Business Guides', '#blog'], ['Community', '#contact']] },
  { title: 'Legal', links: [['Privacy Policy', '#footer'], ['Terms of Service', '#footer'], ['Security', '#footer'], ['Cookie Settings', '#footer']] },
]
function Footer() {
  return <footer className="footer section-pad" id="footer"><div className="footer-links">{footerColumns.map(col => <div key={col.title}><h3>{col.title}</h3>{col.links.map(([label, href, badge]) => <a key={label} href={href}>{label}{badge && <Badge>{badge}</Badge>}</a>)}</div>)}</div><div className="footer-bottom"><a className="brand" href="#top"><ArthSaathiMark decorative className="footer-mark" /> ArthSaathi</a><div className="social"><a href="https://www.linkedin.com" aria-label="LinkedIn">LinkedIn</a><a href="https://x.com" aria-label="X">X</a><span>© Copyright ArthSaathi. All rights reserved.</span></div></div></footer>
}

function LandingPage() {
  return <><Navbar /><main><Hero /><Trusted /><Benefits /><Testimonial /><Stats /><Pricing /><Blog /><FAQ /><Contact /><Newsletter /><Footer /></main></>
}

function RouteScrollManager() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) {
      requestAnimationFrame(() => document.querySelector(hash)?.scrollIntoView())
      return
    }
    window.scrollTo({ top: 0, left: 0 })
  }, [pathname, hash])

  return null
}

function AuthLoading() {
  return <main className="auth-loading" aria-live="polite"><span className="auth-loading-mark"><Zap size={18} /></span><p>Checking your session…</p></main>
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <AuthLoading />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}

function LegacyDashboardRedirect() {
  const { section } = useParams()
  const destinations = { dashboard: '/dashboard', analytics: '/analytics', settings: '/settings', 'quick-create': '/sales', lifecycle: '/transactions', projects: '/inventory', team: '/customers', reports: '/analytics', 'data-library': '/inventory' }
  return <Navigate to={destinations[section] || '/dashboard'} replace />
}

function RetailPageRoute({ page }) { return <Suspense fallback={<AuthLoading />}><RetailPage page={page} /></Suspense> }

function GuestRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <AuthLoading />
  if (user) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  return <>
    <RouteScrollManager />
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={<GuestRoute><AuthHubPage /></GuestRoute>} />
      <Route path="/signup" element={<GuestRoute><SignUpPage /></GuestRoute>} />
      <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
      <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<ProtectedRoute><RetailShell /></ProtectedRoute>}>
        <Route path="/dashboard" element={<RetailPageRoute page="dashboard" />} />
        <Route path="/inventory" element={<RetailPageRoute page="inventory" />} />
        <Route path="/sales" element={<RetailPageRoute page="sales" />} />
        <Route path="/customers" element={<RetailPageRoute page="customers" />} />
        <Route path="/transactions" element={<RetailPageRoute page="transactions" />} />
        <Route path="/analytics" element={<RetailPageRoute page="analytics" />} />
        <Route path="/settings" element={<RetailPageRoute page="settings" />} />
        <Route path="/contrast-checker" element={<Suspense fallback={<AuthLoading />}><ContrastCheckerPage /></Suspense>} />
        <Route path="/dashboard/:section" element={<LegacyDashboardRedirect />} />
      </Route>
      <Route path="*" element={<LandingPage />} />
    </Routes>
  </>
}
