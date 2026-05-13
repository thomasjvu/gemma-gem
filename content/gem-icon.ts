const PROGRESS_SIZE = 36
const PROGRESS_RADIUS = 14
const PROGRESS_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_RADIUS

function createProgressRing(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', `0 0 ${PROGRESS_SIZE} ${PROGRESS_SIZE}`)
  svg.setAttribute('width', String(PROGRESS_SIZE))
  svg.setAttribute('height', String(PROGRESS_SIZE))
  Object.assign(svg.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    transform: 'rotate(-90deg)',
    pointerEvents: 'none',
  })

  // Background track
  const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
  bgCircle.setAttribute('cx', String(PROGRESS_SIZE / 2))
  bgCircle.setAttribute('cy', String(PROGRESS_SIZE / 2))
  bgCircle.setAttribute('r', String(PROGRESS_RADIUS))
  bgCircle.setAttribute('fill', 'none')
  bgCircle.setAttribute('stroke', 'rgba(20, 184, 166, 0.18)')
  bgCircle.setAttribute('stroke-width', '3')
  svg.appendChild(bgCircle)

  // Progress arc
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
  circle.setAttribute('cx', String(PROGRESS_SIZE / 2))
  circle.setAttribute('cy', String(PROGRESS_SIZE / 2))
  circle.setAttribute('r', String(PROGRESS_RADIUS))
  circle.setAttribute('fill', 'none')
  circle.setAttribute('stroke', '#14b8a6')
  circle.setAttribute('stroke-width', '3')
  circle.setAttribute('stroke-linecap', 'round')
  circle.setAttribute('stroke-dasharray', String(PROGRESS_CIRCUMFERENCE))
  circle.setAttribute('stroke-dashoffset', String(PROGRESS_CIRCUMFERENCE))
  circle.style.transition = 'stroke-dashoffset 0.3s ease'
  circle.id = 'gem-progress-arc'
  svg.appendChild(circle)

  return svg
}

export function createGemIcon(onClick: () => void): HTMLElement {
  const container = document.createElement('div')
  container.id = 'alkahest-browser-companion-icon'
  container.title = 'Alkahest Browser Companion'

  Object.assign(container.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    width: `${PROGRESS_SIZE}px`,
    height: `${PROGRESS_SIZE}px`,
    cursor: 'pointer',
    zIndex: '2147483646',
    borderRadius: '50%',
    background: 'rgba(15, 15, 25, 0.85)',
    backdropFilter: 'blur(8px)',
    boxShadow: '0 2px 12px rgba(20, 184, 166, 0.35)',
    transition: 'transform 0.2s, box-shadow 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  })

  const mascot = document.createElement('img')
  mascot.src = browser.runtime.getURL('mascot/alkahest-f-chibi.png' as any)
  mascot.alt = ''
  Object.assign(mascot.style, {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    objectFit: 'cover',
    position: 'relative',
    zIndex: '1',
  })
  container.appendChild(mascot)

  // Progress ring overlay
  const progressRing = createProgressRing()
  container.appendChild(progressRing)

  container.addEventListener('mouseenter', () => {
    container.style.transform = 'scale(1.1)'
    container.style.boxShadow = '0 4px 20px rgba(244, 3, 49, 0.42)'
  })

  container.addEventListener('mouseleave', () => {
    container.style.transform = 'scale(1)'
    container.style.boxShadow = '0 2px 12px rgba(20, 184, 166, 0.35)'
  })

  container.addEventListener('click', onClick)

  return container
}

export function setGemDisabled(disabled: boolean): void {
  const container = document.getElementById('alkahest-browser-companion-icon')
  if (!container) return

  const mascot = container.querySelector('img')
  if (mascot) {
    mascot.style.filter = disabled ? 'grayscale(1) opacity(0.5)' : 'none'
  }

  container.title = disabled ? 'Alkahest Browser Companion (disabled on this site)' : 'Alkahest Browser Companion'
  container.style.boxShadow = disabled
    ? '0 2px 12px rgba(100, 116, 139, 0.2)'
    : '0 2px 12px rgba(20, 184, 166, 0.35)'
}

/** Update progress ring: 0-100, or -1 to hide */
export function updateGemProgress(progress: number): void {
  const arc = document.getElementById('alkahest-browser-companion-icon')?.querySelector('#gem-progress-arc') as SVGCircleElement | null
  if (!arc) return

  const svg = arc.parentElement as SVGSVGElement | null

  if (progress < 0 || progress >= 100) {
    if (svg) svg.style.opacity = '0'
    return
  }

  if (svg) svg.style.opacity = '1'
  const offset = PROGRESS_CIRCUMFERENCE - (progress / 100) * PROGRESS_CIRCUMFERENCE
  arc.setAttribute('stroke-dashoffset', String(offset))
}
