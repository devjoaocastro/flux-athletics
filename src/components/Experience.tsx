import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import {
  Environment,
  Float,
  Html,
  Lightformer,
  RoundedBox,
  Sparkles,
  Trail,
  useCursor,
  useScroll,
} from '@react-three/drei'
import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
  Noise,
  Vignette,
} from '@react-three/postprocessing'
import { easing } from '../lib/easing'
import { PAGES, setScrollEl } from '../scrollBus'

const VOLT = '#c8ff00'
const CHROME = '#dfe2e8'

/* ------------------------------------------------------------------ */
/* Section wrapper — fades/scales/rotates its content as it enters     */
/* and leaves the viewport while we scroll through the 3D world.       */
/* ------------------------------------------------------------------ */

function Section({ index, z = 0, children }: { index: number; z?: number; children: ReactNode }) {
  const inner = useRef<THREE.Group>(null!)
  const scroll = useScroll()
  const vh = useThree((s) => s.viewport.height)

  useFrame((_, delta) => {
    const progress = scroll.offset * (PAGES - 1) - index // 0 when section centered
    const visibility = Math.max(0, 1 - Math.abs(progress)) // 1 visible → 0 offscreen
    easing.damp3(inner.current.scale, 0.7 + visibility * 0.3, 0.18, delta)
    inner.current.rotation.y = progress * 0.35
    inner.current.position.z = z - (1 - visibility) * 2.2
  })

  return (
    <group position={[0, -index * vh, 0]}>
      <group ref={inner}>{children}</group>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* RunnerTrail — a chrome sprinter (sphere) that tears along a curve   */
/* weaving through every section as you scroll, dragging a volt trail  */
/* like a long-exposure shot of a night sprint.                        */
/* ------------------------------------------------------------------ */

function RunnerTrail() {
  const scroll = useScroll()
  const vh = useThree((s) => s.viewport.height)
  const vw = useThree((s) => s.viewport.width)
  const head = useRef<THREE.Mesh>(null!)
  const aura = useRef<THREE.Group>(null!)

  const curve = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i < PAGES; i++) {
      const side = i % 2 === 0 ? 1 : -1
      pts.push(new THREE.Vector3(side * vw * 0.36, -i * vh + vh * 0.24, -1.3))
      pts.push(new THREE.Vector3(-side * vw * 0.22, -i * vh - vh * 0.32, -0.7))
    }
    return new THREE.CatmullRomCurve3(pts)
  }, [vh, vw])

  useFrame((state, delta) => {
    const o = THREE.MathUtils.clamp(scroll.offset, 0.001, 0.999)
    const p = curve.getPoint(o)
    // aggressive chase — short smoothTime so the runner snaps forward
    easing.damp3(head.current.position, [p.x, p.y, p.z], 0.07, delta)
    aura.current.position.copy(head.current.position)
    // stride pulse
    const s = 1 + Math.sin(state.clock.elapsedTime * 9) * 0.14
    head.current.scale.setScalar(s)
  })

  return (
    <group>
      <Trail width={5} length={12} color={VOLT} attenuation={(w) => w * w}>
        <mesh ref={head}>
          <sphereGeometry args={[0.15, 24, 24]} />
          <meshStandardMaterial
            color="#ffffff"
            metalness={1}
            roughness={0.05}
            emissive={VOLT}
            emissiveIntensity={0.9}
          />
        </mesh>
      </Trail>
      <group ref={aura}>
        <pointLight intensity={20} distance={9} color={VOLT} />
        <Sparkles count={26} scale={1.6} size={4} speed={1.4} color={VOLT} opacity={0.9} />
      </group>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* HurdleFrame — box frames hanging between sections that the camera   */
/* bursts through. They punch in scale and flash volt as you pass.     */
/* ------------------------------------------------------------------ */

function HurdleFrame({ y, tilt }: { y: number; tilt: number }) {
  const group = useRef<THREE.Group>(null!)
  const barMat = useRef<THREE.MeshStandardMaterial>(null!)
  const scroll = useScroll()
  const vh = useThree((s) => s.viewport.height)
  const vw = useThree((s) => s.viewport.width)

  const w = vw * 0.62
  const h = vh * 0.58
  const t = 0.07

  useFrame((_, delta) => {
    const camY = -scroll.offset * vh * (PAGES - 1)
    const near = Math.max(0, 1 - Math.abs(camY - y) / (vh * 0.65))
    group.current.rotation.z = tilt + near * 0.14
    easing.damp3(group.current.scale, 1 + near * 0.22, 0.12, delta)
    easing.damp(barMat.current, 'emissiveIntensity', 0.15 + near * 2.4, 0.12, delta)
  })

  return (
    <group ref={group} position={[0, y, 4.2]} rotation={[0, 0, tilt]}>
      {/* top bar — the hurdle rail, volt-hot when you burst through */}
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, t * 1.6, t * 1.6]} />
        <meshStandardMaterial
          ref={barMat}
          color={VOLT}
          emissive={VOLT}
          emissiveIntensity={0.15}
          metalness={0.6}
          roughness={0.25}
        />
      </mesh>
      {/* bottom bar + legs in chrome */}
      <mesh position={[0, -h / 2, 0]}>
        <boxGeometry args={[w, t, t]} />
        <meshStandardMaterial color={CHROME} metalness={1} roughness={0.15} />
      </mesh>
      <mesh position={[-w / 2, 0, 0]}>
        <boxGeometry args={[t, h, t]} />
        <meshStandardMaterial color={CHROME} metalness={1} roughness={0.15} />
      </mesh>
      <mesh position={[w / 2, 0, 0]}>
        <boxGeometry args={[t, h, t]} />
        <meshStandardMaterial color={CHROME} metalness={1} roughness={0.15} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* SpeedLines — instanced stretched streaks racing sideways across     */
/* the whole world. Motion-blur energy, additive volt/white.           */
/* ------------------------------------------------------------------ */

type Streak = { x: number; y: number; z: number; len: number; speed: number }

function SpeedLines({ count = 80 }: { count?: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const vh = useThree((s) => s.viewport.height)
  const vw = useThree((s) => s.viewport.width)

  const streaks = useMemo<Streak[]>(() => {
    const rng = (a: number, b: number) => a + Math.random() * (b - a)
    return Array.from({ length: count }, () => ({
      x: rng(0, vw * 2.4),
      y: rng(vh * 0.6, -vh * (PAGES - 1) - vh * 0.6),
      z: rng(-5, 2.5),
      len: rng(0.9, 3.4),
      speed: rng(2.5, 10),
    }))
  }, [count, vh, vw])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const span = vw * 2.4
    streaks.forEach((s, i) => {
      const x = ((s.x + t * s.speed) % span) - span / 2
      dummy.position.set(x, s.y, s.z)
      dummy.scale.set(s.len, 0.014, 0.014)
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      mesh.current.setMatrixAt(i, dummy.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial
        color={VOLT}
        transparent
        opacity={0.32}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/* Hero — chrome stadium rings spinning hard; hover throws them into   */
/* overdrive.                                                          */
/* ------------------------------------------------------------------ */

function StadiumRings() {
  const a = useRef<THREE.Mesh>(null!)
  const b = useRef<THREE.Mesh>(null!)
  const core = useRef<THREE.Mesh>(null!)
  const speed = useRef({ v: 1 })
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)

  useFrame((state, delta) => {
    easing.damp(speed.current, 'v', hovered ? 4 : 1, 0.2, delta)
    const k = speed.current.v
    a.current.rotation.x += delta * 0.45 * k
    a.current.rotation.y += delta * 0.25 * k
    b.current.rotation.x -= delta * 0.35 * k
    b.current.rotation.z += delta * 0.5 * k
    core.current.rotation.y += delta * 0.9 * k
    const flex = 1 + Math.sin(state.clock.elapsedTime * 6) * (hovered ? 0.07 : 0.02)
    core.current.scale.setScalar(flex)
  })

  return (
    <group
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
    >
      <mesh ref={a} scale={2.5}>
        <torusGeometry args={[1.05, 0.022, 16, 96]} />
        <meshStandardMaterial color={CHROME} metalness={1} roughness={0.08} />
      </mesh>
      <mesh ref={b} scale={3.1}>
        <torusGeometry args={[1.05, 0.012, 8, 96]} />
        <meshBasicMaterial color={VOLT} wireframe transparent opacity={0.5} />
      </mesh>
      <mesh ref={core}>
        <icosahedronGeometry args={[0.85, 1]} />
        <meshStandardMaterial
          color={CHROME}
          emissive={VOLT}
          emissiveIntensity={hovered ? 0.7 : 0.12}
          metalness={1}
          roughness={0.1}
          flatShading
        />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* GearPod — chrome product slab that flashes volt and spins on hover, */
/* with an <Html> price tag that fades with the scroll (terranova fix) */
/* ------------------------------------------------------------------ */

function GearPod({
  position,
  size,
  name,
  price,
  sectionIndex,
}: {
  position: [number, number, number]
  size: [number, number, number]
  name: string
  price: string
  sectionIndex: number
}) {
  const mesh = useRef<THREE.Group>(null!)
  const mat = useRef<THREE.MeshStandardMaterial>(null!)
  const label = useRef<HTMLDivElement>(null)
  const scroll = useScroll()
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)

  useFrame((_, delta) => {
    mesh.current.rotation.y += delta * (hovered ? 2.6 : 0.4)
    easing.damp3(mesh.current.scale, hovered ? 1.25 : 1, 0.15, delta)
    easing.damp(mat.current, 'emissiveIntensity', hovered ? 1.4 : 0.08, 0.12, delta)

    // HTML labels ignore fog/depth — only show them while this section
    // is on screen, fading in/out with the scroll. (terranova fix)
    if (label.current) {
      const sec = scroll.offset * (PAGES - 1)
      const visibility = Math.max(0, 1 - Math.abs(sec - sectionIndex) * 1.6)
      label.current.style.opacity = visibility.toFixed(3)
      label.current.style.display = visibility < 0.04 ? 'none' : ''
    }
  })

  return (
    <Float speed={1.8} rotationIntensity={0.25} floatIntensity={0.6}>
      <group
        ref={mesh}
        position={position}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
        }}
        onPointerOut={() => setHovered(false)}
      >
        <RoundedBox args={size} radius={0.08} smoothness={4}>
          <meshStandardMaterial
            ref={mat}
            color={CHROME}
            emissive={VOLT}
            emissiveIntensity={0.08}
            metalness={1}
            roughness={0.12}
          />
        </RoundedBox>
        <Html center position={[0, -size[1] / 2 - 0.55, 0]} className="tag-html" zIndexRange={[20, 0]}>
          <div
            ref={label}
            className={`tag-label ${hovered ? 'tag-label--hot' : ''}`}
            style={{ opacity: 0, display: 'none' }}
          >
            <strong>{name}</strong>
            <span>{price}</span>
          </div>
        </Html>
      </group>
    </Float>
  )
}

/* ------------------------------------------------------------------ */
/* MuscleKnot — rotating chrome torus-knot that FLEXES (scale pulse)   */
/* on hover.                                                           */
/* ------------------------------------------------------------------ */

function MuscleKnot() {
  const mesh = useRef<THREE.Mesh>(null!)
  const mat = useRef<THREE.MeshStandardMaterial>(null!)
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)

  useFrame((state, delta) => {
    mesh.current.rotation.y += delta * (hovered ? 1.4 : 0.45)
    mesh.current.rotation.x += delta * 0.12
    const flex = hovered ? 1.12 + Math.sin(state.clock.elapsedTime * 9) * 0.09 : 1
    easing.damp3(mesh.current.scale, flex, 0.1, delta)
    easing.damp(mat.current, 'emissiveIntensity', hovered ? 0.9 : 0.1, 0.15, delta)
  })

  return (
    <mesh
      ref={mesh}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
    >
      <torusKnotGeometry args={[1.15, 0.36, 256, 48]} />
      <meshStandardMaterial
        ref={mat}
        color={CHROME}
        emissive={VOLT}
        emissiveIntensity={0.1}
        metalness={1}
        roughness={0.08}
      />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/* RelayRunner — small chrome sphere lapping an invisible loop with a  */
/* volt trail. Three of them = the athletes.                           */
/* ------------------------------------------------------------------ */

function RelayRunner({
  radius,
  speed,
  phase,
  y,
}: {
  radius: number
  speed: number
  phase: number
  y: number
}) {
  const head = useRef<THREE.Mesh>(null!)

  useFrame((state) => {
    const t = state.clock.elapsedTime * speed + phase
    head.current.position.set(
      Math.cos(t) * radius * 1.45,
      y + Math.sin(t * 2.3) * 0.12,
      Math.sin(t) * radius * 0.55,
    )
  })

  return (
    <Trail width={2.4} length={7} color={VOLT} attenuation={(w) => w * w}>
      <mesh ref={head}>
        <sphereGeometry args={[0.11, 16, 16]} />
        <meshStandardMaterial color="#ffffff" metalness={1} roughness={0.1} emissive={VOLT} emissiveIntensity={0.7} />
      </mesh>
    </Trail>
  )
}

/* ------------------------------------------------------------------ */
/* TrackOval — flattened torus track for the run club, with a runner   */
/* dot lapping it and an <Html> label that fades with the scroll.      */
/* ------------------------------------------------------------------ */

function TrackOval({ sectionIndex }: { sectionIndex: number }) {
  const runner = useRef<THREE.Mesh>(null!)
  const label = useRef<HTMLDivElement>(null)
  const scroll = useScroll()
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)

  const R = 1.9

  useFrame((state) => {
    const t = state.clock.elapsedTime * (hovered ? 2.2 : 1.1)
    runner.current.position.set(Math.cos(t) * R * 1.5, Math.sin(t) * R, 0.07)

    if (label.current) {
      const sec = scroll.offset * (PAGES - 1)
      const visibility = Math.max(0, 1 - Math.abs(sec - sectionIndex) * 1.6)
      label.current.style.opacity = visibility.toFixed(3)
      label.current.style.display = visibility < 0.04 ? 'none' : ''
    }
  })

  return (
    <group
      rotation={[-1.02, 0, 0]}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* track lanes — flattened tori */}
      <mesh scale={[1.5, 1, 1]}>
        <torusGeometry args={[R, 0.05, 16, 96]} />
        <meshStandardMaterial color={CHROME} metalness={1} roughness={0.15} />
      </mesh>
      <mesh scale={[1.5, 1, 1]}>
        <torusGeometry args={[R * 1.18, 0.018, 8, 96]} />
        <meshBasicMaterial color={VOLT} wireframe transparent opacity={0.45} />
      </mesh>
      <mesh scale={[1.5, 1, 1]}>
        <torusGeometry args={[R * 0.82, 0.018, 8, 96]} />
        <meshBasicMaterial color={VOLT} wireframe transparent opacity={0.3} />
      </mesh>
      {/* lapping runner */}
      <Trail width={2.6} length={8} color={VOLT} attenuation={(w) => w * w}>
        <mesh ref={runner}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
      </Trail>
      {/* fading label (terranova fix) */}
      <Html center position={[0, 0, 1.2]} className="tag-html" zIndexRange={[20, 0]}>
        <div ref={label} className="tag-label" style={{ opacity: 0, display: 'none' }}>
          <strong>MARQUÊS LOOP</strong>
          <span>TUE 19:00 · 5K + 10K</span>
        </div>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Experience root — camera rig + sections + lights + post FX          */
/* ------------------------------------------------------------------ */

export default function Experience() {
  const scroll = useScroll()
  const vh = useThree((s) => s.viewport.height)
  const vw = useThree((s) => s.viewport.width)
  const lightRig = useRef<THREE.Group>(null!)

  useEffect(() => {
    setScrollEl(scroll.el)
  }, [scroll.el])

  useFrame((state, delta) => {
    const o = scroll.offset
    const y = -o * vh * (PAGES - 1)
    // travel down the world + mouse parallax — snappier than orbita
    easing.damp3(state.camera.position, [state.pointer.x * 0.8, y - state.pointer.y * 0.4, 10], 0.22, delta)
    state.camera.lookAt(0, y, 0)
    if (lightRig.current) lightRig.current.position.y = y
    // feed the DOM progress bar + stat counters
    document.documentElement.style.setProperty('--scroll', o.toFixed(4))
  })

  const x = (f: number) => vw * f
  const chromaOffset = useMemo(() => new THREE.Vector2(0.00075, 0.00045), [])

  return (
    <>
      <ambientLight intensity={0.3} />
      <group ref={lightRig}>
        <pointLight position={[6, 3, 6]} intensity={70} color={VOLT} />
        <pointLight position={[-6, -2, 5]} intensity={55} color="#ffffff" />
      </group>

      {/* studio-style chrome reflections without any network fetch */}
      <Environment resolution={64}>
        <group rotation={[-Math.PI / 3, 0, 0]}>
          <Lightformer intensity={4} rotation-x={Math.PI / 2} position={[0, 5, -9]} scale={[10, 10, 1]} />
          <Lightformer color={VOLT} intensity={2.4} position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
          <Lightformer color="#ffffff" intensity={2} position={[10, 1, 0]} rotation-y={-Math.PI / 2} scale={[20, 1, 1]} />
        </group>
      </Environment>

      {/* ambient grit across the whole scroll length */}
      <Sparkles
        count={240}
        scale={[vw * 1.6, vh * PAGES, 10]}
        position={[0, (-vh * (PAGES - 1)) / 2, -2]}
        size={1.4}
        speed={0.3}
        color={VOLT}
        opacity={0.4}
      />

      {/* motion-blur streaks + the sprinting trail */}
      <SpeedLines />
      <RunnerTrail />

      {/* hurdle gates the camera bursts through between sections */}
      <HurdleFrame y={-0.5 * vh} tilt={-0.05} />
      <HurdleFrame y={-2.5 * vh} tilt={0.06} />
      <HurdleFrame y={-4.5 * vh} tilt={-0.04} />

      {/* 0 — Hero */}
      <Section index={0}>
        <Float speed={1.6} rotationIntensity={0.35} floatIntensity={0.8}>
          <StadiumRings />
        </Float>
        <Sparkles count={80} scale={[8, 5, 6]} size={2.2} speed={0.5} color={VOLT} opacity={0.7} />
      </Section>

      {/* 1 — Manifesto */}
      <Section index={1}>
        <group position={[x(0.22), 0, 0]} rotation={[0.3, 0, 0]}>
          <Float speed={1.4} rotationIntensity={0.2} floatIntensity={0.4}>
            <mesh>
              <octahedronGeometry args={[1.5, 0]} />
              <meshStandardMaterial color={CHROME} metalness={1} roughness={0.07} flatShading />
            </mesh>
          </Float>
        </group>
      </Section>

      {/* 2 — Gear */}
      <Section index={2}>
        <group position={[x(0.2), 0, 0]}>
          <GearPod position={[-1.2, 1.4, 0]} size={[1.7, 0.55, 0.75]} name="FLUX SPRINT" price="€180" sectionIndex={2} />
          <GearPod position={[1.4, 0.2, 0]} size={[1.25, 1.45, 0.22]} name="FLUX CARRY" price="€65" sectionIndex={2} />
          <GearPod position={[-1.0, -1.5, 0]} size={[1.15, 0.9, 0.32]} name="FLUX HOLD" price="€85" sectionIndex={2} />
        </group>
      </Section>

      {/* 3 — Tech */}
      <Section index={3}>
        <group position={[x(0.22), 0, 0]}>
          <Float speed={1.5} rotationIntensity={0.4} floatIntensity={0.6}>
            <MuscleKnot />
          </Float>
        </group>
      </Section>

      {/* 4 — Athletes */}
      <Section index={4}>
        <group position={[x(0.18), 0, 0]}>
          <RelayRunner radius={1.6} speed={1.6} phase={0} y={0.9} />
          <RelayRunner radius={2.1} speed={1.2} phase={2.1} y={0} />
          <RelayRunner radius={1.3} speed={2.1} phase={4.2} y={-0.9} />
        </group>
      </Section>

      {/* 5 — Run club */}
      <Section index={5}>
        <group position={[0, -0.4, -1]}>
          <TrackOval sectionIndex={5} />
        </group>
        <Sparkles count={90} scale={[9, 6, 6]} size={2} speed={0.4} color={VOLT} opacity={0.5} />
      </Section>

      {/* 6 — Footer: the volt HTML inversion owns the screen; keep a
          faint chrome pulse drifting behind for depth */}
      <Section index={6} z={-3}>
        <Float speed={1.2} rotationIntensity={0.4} floatIntensity={0.6}>
          <mesh>
            <torusKnotGeometry args={[1.1, 0.3, 128, 32]} />
            <meshStandardMaterial color="#16161c" metalness={1} roughness={0.3} />
          </mesh>
        </Float>
      </Section>

      <EffectComposer>
        <Bloom intensity={0.6} luminanceThreshold={0.25} luminanceSmoothing={0.7} mipmapBlur />
        <ChromaticAberration offset={chromaOffset} />
        <Noise opacity={0.055} />
        <Vignette offset={0.15} darkness={0.85} />
      </EffectComposer>
    </>
  )
}
