import { useEffect, useRef } from 'react'
import { scrollToPage } from '../scrollBus'

/* ------------------------------------------------------------------ */
/* Marquee — outline type tearing across the section                   */
/* ------------------------------------------------------------------ */

function Marquee({ text }: { text: string }) {
  const chunk = Array(6).fill(text).join('  ')
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee__track">
        <span>{chunk}</span>
        <span>{chunk}</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* StaggerTitle — hero headline, letter by letter via CSS keyframes    */
/* ------------------------------------------------------------------ */

function StaggerTitle({ lines }: { lines: string[] }) {
  let index = 0
  return (
    <h1 className="hero-title" aria-label={lines.join(' ')}>
      {lines.map((line, li) => (
        <span className="hero-title__line" key={li} aria-hidden="true">
          {line.split('').map((ch, ci) => {
            const delay = 0.25 + index++ * 0.035
            return (
              <span className="hero-title__letter" key={ci} style={{ animationDelay: `${delay.toFixed(3)}s` }}>
                {ch === ' ' ? ' ' : ch}
              </span>
            )
          })}
        </span>
      ))}
    </h1>
  )
}

/* ------------------------------------------------------------------ */
/* Counter — stat that sprints from 0 to its value once the tech       */
/* section comes on screen. Reads the --scroll var fed by the canvas.  */
/* ------------------------------------------------------------------ */

function Counter({
  value,
  decimals,
  suffix,
  label,
}: {
  value: number
  decimals: number
  suffix: string
  label: string
}) {
  const num = useRef<HTMLSpanElement>(null!)

  useEffect(() => {
    let raf = 0
    let started = false
    const TRIGGER = 0.4 // section 3 of 7 pages ≈ offset 0.5; start a touch early

    const animate = () => {
      const t0 = performance.now()
      const DURATION = 1300
      const tick = (now: number) => {
        const t = Math.min(1, (now - t0) / DURATION)
        const eased = 1 - Math.pow(1 - t, 3)
        num.current.textContent = (value * eased).toFixed(decimals)
        if (t < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }

    const watch = () => {
      const o = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--scroll') || '0',
      )
      if (!started && o > TRIGGER) {
        started = true
        animate()
        return
      }
      raf = requestAnimationFrame(watch)
    }
    raf = requestAnimationFrame(watch)
    return () => cancelAnimationFrame(raf)
  }, [value, decimals])

  return (
    <div className="stat">
      <strong>
        <span ref={num}>0</span>
        <em>{suffix}</em>
      </strong>
      <span className="stat__label">{label}</span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Interface — the 7 scrolled HTML sections                            */
/* ------------------------------------------------------------------ */

export default function Interface() {
  return (
    <div className="interface">
      {/* 0 — Hero */}
      <section className="section section--center section--hero">
        <p className="tagline">Performance sportswear · Engineered in motion</p>
        <StaggerTitle lines={['BUILT FOR', 'THE SURGE.']} />
        <p className="hero-sub">
          Knit, foam and attitude tuned for one moment — the one where everyone else slows
          down and you don&apos;t.
        </p>
        <button className="cta" onClick={() => scrollToPage(1)}>
          Feel the rush ↓
        </button>
        <div className="scroll-hint">
          <span className="scroll-hint__line" />
          <span className="scroll-hint__label">scroll</span>
        </div>
      </section>

      {/* 1 — Manifesto */}
      <section className="section section--left" data-num="01">
        <p className="kicker">01 — Manifesto</p>
        <h2>
          Slow is a choice.
          <br />
          We don&apos;t make it.
        </h2>
        <p className="body">
          Every seam exists to disappear at speed. Every gram was argued over. We don&apos;t
          design for the podium photo — we design for the 200 metres before it, when your
          lungs file a complaint and you overrule them.
        </p>
        <Marquee text="NEVER COAST — NEVER SETTLE —" />
      </section>

      {/* 2 — Gear */}
      <section className="section section--left" data-num="02">
        <p className="kicker">02 — Gear</p>
        <h2>Three lines. Zero excuses.</h2>
        <ul className="gear">
          <li>
            <span className="gear__num">01</span>
            <span className="gear__name">FLUX SPRINT</span>
            <span className="gear__desc">racing shoe · 41g foam core</span>
            <span className="gear__price">€180</span>
          </li>
          <li>
            <span className="gear__num">02</span>
            <span className="gear__name">FLUX CARRY</span>
            <span className="gear__desc">training tee · 0.4mm vent knit</span>
            <span className="gear__price">€65</span>
          </li>
          <li>
            <span className="gear__num">03</span>
            <span className="gear__name">FLUX HOLD</span>
            <span className="gear__desc">half-tight shorts · zero-bounce pocket</span>
            <span className="gear__price">€85</span>
          </li>
        </ul>
        <p className="hint">→ hover the gear</p>
      </section>

      {/* 3 — Tech */}
      <section className="section section--left" data-num="03">
        <p className="kicker">03 — Tech</p>
        <h2>
          Numbers don&apos;t
          <br />
          flatter. Good.
        </h2>
        <div className="stats">
          <Counter value={0.4} decimals={1} suffix="mm" label="vent knit" />
          <Counter value={41} decimals={0} suffix="g" label="foam core" />
          <Counter value={2.1} decimals={1} suffix="x" label="energy return" />
        </div>
        <p className="hint">→ flex the knot</p>
      </section>

      {/* 4 — Athletes */}
      <section className="section section--left" data-num="04">
        <p className="kicker">04 — Athletes</p>
        <h2>The proof runs.</h2>
        <ul className="athletes">
          <li>
            <em>MAYA OKAFOR</em>
            <span>400m hurdles · PB 53.71</span>
          </li>
          <li>
            <em>DIOGO FERRO</em>
            <span>Marathon · PB 2:09:44</span>
          </li>
          <li>
            <em>LENA VOSS</em>
            <span>100m · PB 10.94</span>
          </li>
        </ul>
      </section>

      {/* 5 — Run club */}
      <section className="section section--center" data-num="05">
        <Marquee text="RAIN RUNS TOO — RAIN RUNS TOO —" />
        <p className="kicker">05 — Run club</p>
        <h2>
          Tuesday 19:00 — Marquês.
          <br />
          Rain runs too.
        </h2>
        <p className="body body--center">
          No pace gates, no fees, no excuses about the weather. Show up, warm up, surge.
          First lap is on us — so is the last one.
        </p>
        <a className="cta cta--big" href="mailto:club@fluxathletics.com">
          Join the club
        </a>
      </section>

      {/* 6 — Footer: full volt inversion */}
      <section className="section section--footer">
        <div className="footer-diag" aria-hidden="true">
          DON&apos;T STOP
        </div>

        <div className="footer-grid">
          <div className="footer-col">
            <h3>Shop</h3>
            <a href="https://fluxathletics.com/footwear">Footwear</a>
            <a href="https://fluxathletics.com/apparel">Apparel</a>
            <a href="https://fluxathletics.com/accessories">Accessories</a>
          </div>
          <div className="footer-col">
            <h3>Support</h3>
            <a href="mailto:support@fluxathletics.com">Contact</a>
            <a href="https://fluxathletics.com/shipping">Shipping &amp; returns</a>
            <a href="https://fluxathletics.com/size-guide">Size guide</a>
          </div>
          <div className="footer-col">
            <h3>Club</h3>
            <a href="mailto:club@fluxathletics.com">Join the run club</a>
            <a href="https://www.strava.com">Strava group</a>
            <a href="https://fluxathletics.com/events">Race calendar</a>
          </div>
          <div className="footer-col">
            <h3>Legal</h3>
            <a href="https://fluxathletics.com/privacy">Privacy</a>
            <a href="https://fluxathletics.com/terms">Terms</a>
            <a href="https://fluxathletics.com/cookies">Cookies</a>
          </div>
        </div>

        <div className="footer-social">
          <a href="https://instagram.com" target="_blank" rel="noreferrer">
            IG ↗
          </a>
          <a href="https://www.strava.com" target="_blank" rel="noreferrer">
            STRAVA ↗
          </a>
          <a href="https://youtube.com" target="_blank" rel="noreferrer">
            YT ↗
          </a>
        </div>

        <div className="footer-strip">© FLUX ATHLETICS MMXXVI — MADE TO MOVE</div>
      </section>
    </div>
  )
}
