import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, ExternalLink, Info, SunMoon } from 'lucide-react'
import { Badge } from '../components/ui/badge.jsx'
import { Button } from '../components/ui/button.jsx'
import { Card } from '../components/ui/card.jsx'
import { ThemeToggle } from '../components/ThemeToggle.jsx'
import { useTheme } from '../theme/ThemeProvider.jsx'
import { useLanguage } from './LanguageProvider.jsx'
import { assessContrast } from '../lib/contrast.js'
import './contrast-checker.css'

const samples = [
  {
    section: 'contentContainers',
    entries: [
      { id: 'base', name: 'base', background: 'var(--background)', foreground: 'var(--foreground)', threshold: 4.5, criterion: 'normalTextAA' },
      { id: 'card', name: 'card', background: 'var(--card)', foreground: 'var(--card-foreground)', threshold: 4.5, criterion: 'normalTextAA' },
      { id: 'popover', name: 'popover', background: 'var(--popover)', foreground: 'var(--popover-foreground)', threshold: 4.5, criterion: 'normalTextAA' },
      { id: 'muted', name: 'muted', background: 'var(--muted)', foreground: 'var(--muted-foreground)', threshold: 4.5, criterion: 'normalTextAA' },
    ],
  },
  {
    section: 'interactiveElements',
    entries: [
      { id: 'primary-button', name: 'primaryButton', background: 'var(--primary)', foreground: 'var(--primary-foreground)', threshold: 4.5, criterion: 'buttonTextAA' },
      { id: 'secondary-button', name: 'secondaryButton', background: 'var(--secondary)', foreground: 'var(--secondary-foreground)', threshold: 4.5, criterion: 'buttonTextAA' },
      { id: 'destructive-button', name: 'destructiveButton', background: '#b7383f', foreground: '#ffffff', threshold: 4.5, criterion: 'buttonTextAA' },
      { id: 'link', name: 'link', background: 'var(--background)', foreground: 'var(--primary)', threshold: 4.5, criterion: 'normalTextAA' },
      { id: 'input', name: 'inputText', background: 'var(--background)', foreground: 'var(--foreground)', threshold: 4.5, criterion: 'normalTextAA' },
      { id: 'placeholder', name: 'inputPlaceholder', background: 'var(--background)', foreground: 'var(--muted-foreground)', threshold: 4.5, criterion: 'normalTextAA' },
      { id: 'large-text', name: 'largeText', background: 'var(--background)', foreground: 'var(--muted-foreground)', threshold: 3, criterion: 'largeTextAA' },
      { id: 'muted-label', name: 'mutedTextMutedSurface', background: 'var(--muted)', foreground: 'var(--muted-foreground)', threshold: 4.5, criterion: 'normalTextAA' },
      { id: 'focus-ring', name: 'focusIndicator', background: 'var(--background)', foreground: 'var(--ring)', threshold: 3, criterion: 'uiIndicatorAA' },
      { id: 'border', name: 'inputCardBorder', background: 'var(--background)', foreground: 'var(--border)', threshold: 3, criterion: 'componentBoundaryAA' },
      { id: 'issue-badge', name: 'issueBadge', background: 'var(--accent)', foreground: 'var(--destructive)', threshold: 4.5, criterion: 'normalTextAA' },
    ],
  },
]

function measureCurrentTheme() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return []
  return assessContrast(samples.flatMap(group => group.entries), window.getComputedStyle(document.documentElement))
}

function ColorValue({ label, color, t }) {
  return <div className="contrast-color-value"><span className="contrast-color-swatch" style={{ '--contrast-swatch': color || 'transparent' }} aria-hidden="true" /><span className="contrast-color-copy"><small>{t(label)}</small><code>{color || t('unableResolve')}</code></span></div>
}

function ContrastCard({ result, t, locale }) {
  const statusText = result.status === 'pass' ? t('pass') : result.status === 'fail' ? t('needsAdjustment') : t('unableEvaluate')
  const StatusIcon = result.status === 'pass' ? Check : result.status === 'fail' ? AlertTriangle : Info
  return <Card className={`contrast-result-card ${result.status}`}>
    <div className="contrast-result-heading"><h3>{t(result.name)}</h3><Badge className={`contrast-status ${result.status}`}><StatusIcon size={13} aria-hidden="true" />{statusText}</Badge></div>
    <div className="contrast-color-pair">
      <ColorValue label="background" color={result.backgroundColor} t={t} />
      <ColorValue label="foreground" color={result.foregroundColor} t={t} />
    </div>
    {result.status === 'unknown' ? <div className="contrast-sample contrast-unavailable"><strong>Aa</strong><span>{t('sampleText')}</span><small>{t('colorParseError')}</small></div> : <div className={`contrast-sample ${result.id === 'large-text' ? 'large' : ''} ${result.id === 'focus-ring' ? 'ring' : ''} ${result.id === 'border' ? 'boundary' : ''}`} style={{ '--contrast-preview-bg': result.backgroundColor, '--contrast-preview-fg': result.foregroundColor }}>
      <strong>Aa</strong><span>{t('sampleText')}</span>
    </div>}
    <div className="contrast-result-footer"><span>{t(result.criterion)}</span><strong className="contrast-ratio">{result.ratio === null ? '—' : `${new Intl.NumberFormat(locale,{minimumFractionDigits:2,maximumFractionDigits:2}).format(result.ratio)}:1`}</strong></div>
    {result.status === 'fail' && <p className="contrast-failure-note">{t('backgroundPairBelow', { foreground: result.foregroundColor, background: result.backgroundColor, threshold: new Intl.NumberFormat(locale,{minimumFractionDigits:1,maximumFractionDigits:1}).format(result.threshold) })}</p>}
  </Card>
}

export default function ContrastCheckerPage() {
  const { theme } = useTheme()
  const { t, locale, formatNumber } = useLanguage()
  const [filter, setFilter] = useState('all')
  const [results, setResults] = useState(measureCurrentTheme)

  useEffect(() => {
    setResults(measureCurrentTheme())
  }, [theme])

  const failingCount = useMemo(() => results.filter(result => result.status === 'fail').length, [results])
  const visibleGroups = samples.map(group => ({
    ...group,
    entries: group.entries.map(entry => results.find(result => result.id === entry.id)).filter(Boolean).filter(result => filter === 'all' || result.status === 'fail'),
  })).filter(group => group.entries.length)

  return <div className="contrast-checker">
    <header className="contrast-checker-header">
      <div className="contrast-title-block">
        <span className="contrast-eyebrow">{t('accessibilityTool')}</span>
        <h1>{t('contrastChecker')}</h1>
        <p>{t('contrastSubtitle')} <a href="https://www.w3.org/TR/UNDERSTANDING-WCAG20/visual-audio-contrast-contrast.html" target="_blank" rel="noreferrer">{t('learnMore')} <ExternalLink size={13} aria-hidden="true" /></a></p>
      </div>
      <div className="contrast-header-actions"><span><SunMoon size={15} aria-hidden="true" /> {theme === 'dark' ? t('darkTheme') : t('lightTheme')}</span><ThemeToggle labels={{ light: t('themeLight'), dark: t('themeDark') }} /></div>
    </header>

    <div className="contrast-toolbar"><div className="contrast-filter-tabs" role="group" aria-label={t('filterContrastResults')}>
      <Button type="button" variant={filter === 'all' ? 'primary' : 'outline'} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>{t('allCount')} <span>{formatNumber(results.length)}</span></Button>
      <Button type="button" variant={filter === 'issues' ? 'primary' : 'outline'} aria-pressed={filter === 'issues'} onClick={() => setFilter('issues')}>{t('issues')} <span>{formatNumber(failingCount)}</span></Button>
    </div><p className="contrast-summary" aria-live="polite">{filter === 'issues' ? `${formatNumber(failingCount)} ${t('failingPairs')}` : `${formatNumber(results.length)} ${t('colorPairsChecked')}`} · {theme === 'dark' ? t('darkMode') : t('lightMode')}</p></div>

    {visibleGroups.length ? visibleGroups.map(group => <section className="contrast-section" key={group.section} aria-labelledby={`contrast-${group.section}`}>
      <div className="contrast-section-heading"><h2 id={`contrast-${group.section}`}>{t(group.section)}</h2><span>{formatNumber(group.entries.length)} {t('results')}</span></div>
      <div className="contrast-grid">{group.entries.map(result => <ContrastCard key={result.id} result={result} t={t} locale={locale} />)}</div>
    </section>) : filter === 'issues' && results.length ? <div className="contrast-all-clear" role="status"><Check size={20} /><div><strong>{t('noContrastIssues')}</strong><p>{t('pairsMeetThreshold')}</p></div></div> : <div className="contrast-loading" role="status">{t('calculatingContrast')}</div>}

    <p className="contrast-method-note"><Info size={14} aria-hidden="true" /> {t('methodNote')}</p>
  </div>
}
