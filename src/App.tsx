import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { ScrollControls, Scroll } from '@react-three/drei'
import Experience from './components/Experience'
import Interface from './components/Interface'
import Cursor from './components/Cursor'
import Loader from './components/Loader'
import { PAGES, scrollToPage } from './scrollBus'

const NAV = ['Manifesto', 'Gear', 'Tech', 'Athletes', 'Club', 'Connect']
const NAV_PAGE = [1, 2, 3, 4, 5, 6]

export default function App() {
  return (
    <>
      <Loader />

      <header className="header">
        <button className="logo" onClick={() => scrollToPage(0)}>
          FLUX<span className="logo__tm">ATHLETICS</span>
        </button>
        <nav className="nav">
          {NAV.map((label, i) => (
            <button key={label} onClick={() => scrollToPage(NAV_PAGE[i])}>
              {label}
            </button>
          ))}
        </nav>
      </header>

      <div className="progress" aria-hidden="true">
        <div className="progress__bar" />
      </div>

      <Cursor />

      <Canvas camera={{ position: [0, 0, 10], fov: 42 }} dpr={[1, 2]}>
        <color attach="background" args={['#0d0d11']} />
        <fog attach="fog" args={['#0d0d11', 16, 38]} />
        <Suspense fallback={null}>
          <ScrollControls pages={PAGES} damping={0.15}>
            <Experience />
            <Scroll html style={{ width: '100%' }}>
              <Interface />
            </Scroll>
          </ScrollControls>
        </Suspense>
      </Canvas>
    </>
  )
}
