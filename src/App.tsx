import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import URDFLoader from 'urdf-loader'
import type { URDFJoint, URDFRobot } from 'urdf-loader'

type ViewerApi = {
  resetCamera: () => void
}

const assetUrl = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`

type MotionName = 'idle' | 'wave' | 'squat' | 'combat' | 'walk' | 'attention'

const MOTIONS: { id: MotionName; label: string; code: string }[] = [
  { id: 'idle', label: '待机', code: 'IDLE' },
  { id: 'wave', label: '招手', code: 'WAVE' },
  { id: 'squat', label: '下蹲', code: 'SQUAT' },
  { id: 'combat', label: '战斗', code: 'COMBAT' },
  { id: 'walk', label: '步行', code: 'WALK' },
  { id: 'attention', label: '立正', code: 'RESET' },
]

function showcaseMaterial(name: string) {
  let color = '#efefeb'
  if (name.includes('roll')) color = '#e7e8e5'
  if (name.includes('yaw')) color = '#f3f3ef'
  if (name.includes('base') || name.includes('imu')) color = '#101316'
  if (name.includes('hand_link')) color = '#f5f5f1'

  return new THREE.MeshStandardMaterial({
    color,
    metalness: name.includes('base') || name.includes('imu') ? 0.9 : 0.62,
    roughness: name.includes('base') || name.includes('imu') ? 0.18 : 0.21,
    envMapIntensity: 1.35,
  })
}

const BASE_POSE: Record<string, number> = {
  arm_left_shoulder_pitch_joint: -0.2,
  arm_left_shoulder_roll_joint: 0.22,
  arm_left_shoulder_yaw_joint: 0,
  arm_left_elbow_pitch_joint: 0.34,
  arm_left_elbow_roll_joint: 0,
  arm_right_shoulder_pitch_joint: 0.2,
  arm_right_shoulder_roll_joint: -0.22,
  arm_right_shoulder_yaw_joint: 0,
  arm_right_elbow_pitch_joint: -0.34,
  arm_right_elbow_roll_joint: 0,
  leg_left_hip_roll_joint: 0.04,
  leg_left_hip_yaw_joint: 0,
  leg_left_hip_pitch_joint: 0,
  leg_left_knee_pitch_joint: 0.04,
  leg_left_ankle_pitch_joint: -0.02,
  leg_left_ankle_roll_joint: 0,
  leg_right_hip_roll_joint: -0.04,
  leg_right_hip_yaw_joint: 0,
  leg_right_hip_pitch_joint: 0,
  leg_right_knee_pitch_joint: 0.04,
  leg_right_ankle_pitch_joint: -0.02,
  leg_right_ankle_roll_joint: 0,
}

const MOTION_POSES: Record<MotionName, Partial<Record<string, number>>> = {
  idle: {},
  attention: {
    arm_left_shoulder_pitch_joint: -0.16,
    arm_left_shoulder_roll_joint: 0.38,
    arm_left_shoulder_yaw_joint: 0,
    arm_left_elbow_pitch_joint: 0.78,
    arm_left_elbow_roll_joint: 0,
    arm_right_shoulder_pitch_joint: 0.16,
    arm_right_shoulder_roll_joint: -0.38,
    arm_right_shoulder_yaw_joint: 0,
    arm_right_elbow_pitch_joint: -0.78,
    arm_right_elbow_roll_joint: 0,
    leg_left_hip_roll_joint: 0.1,
    leg_right_hip_roll_joint: -0.1,
    leg_left_hip_pitch_joint: -0.08,
    leg_right_hip_pitch_joint: -0.08,
    leg_left_knee_pitch_joint: 0.14,
    leg_right_knee_pitch_joint: 0.14,
    leg_left_ankle_pitch_joint: -0.06,
    leg_right_ankle_pitch_joint: -0.06,
  },
  wave: {
    arm_right_shoulder_pitch_joint: 0.04,
    arm_right_shoulder_roll_joint: -1.18,
    arm_right_shoulder_yaw_joint: 0.68,
    arm_right_elbow_pitch_joint: -1.3,
    arm_right_elbow_roll_joint: 0.08,
  },
  squat: {
    arm_left_shoulder_pitch_joint: -0.42,
    arm_right_shoulder_pitch_joint: 0.42,
    arm_left_shoulder_roll_joint: 0.28,
    arm_right_shoulder_roll_joint: -0.28,
    arm_left_elbow_pitch_joint: 0.22,
    arm_right_elbow_pitch_joint: -0.22,
    leg_left_hip_pitch_joint: -0.6,
    leg_right_hip_pitch_joint: -0.6,
    leg_left_knee_pitch_joint: 1.16,
    leg_right_knee_pitch_joint: 1.16,
    leg_left_ankle_pitch_joint: -0.56,
    leg_right_ankle_pitch_joint: -0.56,
    leg_left_hip_roll_joint: 0.1,
    leg_right_hip_roll_joint: -0.1,
  },
  combat: {
    // Low diagonal martial-arts stance from the supplied reference:
    // right side reaches up/left, left side counterbalances down/right.
    arm_left_shoulder_pitch_joint: 0.32,
    arm_right_shoulder_pitch_joint: 0.58,
    arm_left_shoulder_roll_joint: 0.72,
    arm_right_shoulder_roll_joint: -1.27,
    arm_left_shoulder_yaw_joint: 0.16,
    arm_right_shoulder_yaw_joint: 0.52,
    arm_left_elbow_pitch_joint: 0.24,
    arm_right_elbow_pitch_joint: -0.3,
    arm_left_elbow_roll_joint: -0.08,
    arm_right_elbow_roll_joint: 0.08,
    leg_left_hip_roll_joint: 0.32,
    leg_left_hip_yaw_joint: -0.2,
    leg_left_hip_pitch_joint: -0.86,
    leg_left_knee_pitch_joint: 1.76,
    leg_left_ankle_pitch_joint: -0.72,
    leg_left_ankle_roll_joint: -0.15,
    leg_right_hip_roll_joint: -0.88,
    leg_right_hip_yaw_joint: 0.12,
    leg_right_hip_pitch_joint: -0.34,
    leg_right_knee_pitch_joint: 0.2,
    leg_right_ankle_pitch_joint: 0.08,
    leg_right_ankle_roll_joint: 0.15,
  },
  walk: {},
}

function updatePose(
  robot: URDFRobot,
  motion: MotionName,
  time: number,
  delta: number,
  current: Record<string, number>,
) {
  const values = { ...BASE_POSE, ...MOTION_POSES[motion] } as Record<string, number>
  const phase = time * 2.6

  if (motion === 'idle') {
    const breath = Math.sin(time * 1.2)
    values.arm_left_shoulder_roll_joint += breath * 0.035
    values.arm_right_shoulder_roll_joint -= breath * 0.035
    values.leg_left_hip_roll_joint += breath * 0.008
    values.leg_right_hip_roll_joint -= breath * 0.008
  }

  if (motion === 'wave') {
    const handWave = Math.sin(time * 5.1)
    const followThrough = Math.sin(time * 5.1 - 0.55)
    // With no wrist joint, a readable greeting comes from a bent, raised arm
    // and a coordinated forearm arc rather than simply rolling the hand mesh.
    values.arm_right_elbow_pitch_joint += handWave * 0.2
    values.arm_right_shoulder_yaw_joint += followThrough * 0.075
    values.arm_right_elbow_roll_joint += followThrough * 0.22
    values.arm_right_shoulder_pitch_joint += Math.sin(time * 2.55) * 0.035
    values.arm_left_shoulder_roll_joint += Math.sin(time * 1.25) * 0.018
  }

  if (motion === 'attention') {
    const readyBreath = Math.sin(time * 1.35)
    values.arm_left_shoulder_roll_joint += readyBreath * 0.018
    values.arm_right_shoulder_roll_joint -= readyBreath * 0.018
    values.arm_left_elbow_pitch_joint += readyBreath * 0.025
    values.arm_right_elbow_pitch_joint -= readyBreath * 0.025
  }

  if (motion === 'combat') {
    const stanceBreath = Math.sin(time * 1.35)
    const weightShift = Math.sin(time * 1.35 - 0.65)
    values.arm_left_shoulder_roll_joint += stanceBreath * 0.018
    values.arm_right_shoulder_roll_joint -= stanceBreath * 0.018
    values.arm_left_elbow_pitch_joint += weightShift * 0.018
    values.leg_left_knee_pitch_joint += stanceBreath * 0.025
    values.leg_left_ankle_pitch_joint -= stanceBreath * 0.018
    values.leg_right_hip_roll_joint -= weightShift * 0.018
  }

  if (motion === 'walk') {
    const stride = Math.sin(phase)
    const opposite = Math.sin(phase + Math.PI)
    values.leg_left_hip_pitch_joint = stride * 0.28
    values.leg_right_hip_pitch_joint = opposite * 0.28
    values.leg_left_knee_pitch_joint = 0.08 + Math.max(0, -stride) * 0.52
    values.leg_right_knee_pitch_joint = 0.08 + Math.max(0, -opposite) * 0.52
    values.leg_left_ankle_pitch_joint = -stride * 0.16
    values.leg_right_ankle_pitch_joint = -opposite * 0.16
    // Shoulder joint axes are mirrored by the URDF. Use the phase opposite
    // to the former pair so each forward leg is matched by the other arm.
    values.arm_left_shoulder_pitch_joint = opposite * 0.3
    values.arm_right_shoulder_pitch_joint = -stride * 0.3
  }

  Object.entries(values).forEach(([name, target]) => {
    const joint = robot.joints[name] as URDFJoint | undefined
    if (!joint) return
    current[name] = THREE.MathUtils.damp(current[name] ?? 0, target, 6.8, delta)
    joint.setJointValue(current[name])
  })
}

function recolorRobot(robot: URDFRobot) {
  robot.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh) return

    let ancestor: THREE.Object3D | null = object.parent
    while (ancestor && !(ancestor as THREE.Object3D & { isURDFLink?: boolean }).isURDFLink) {
      ancestor = ancestor.parent
    }
    const name = ancestor?.name ?? object.name
    let color = new THREE.Color('#efefeb')
    let metalness = 0.62
    let roughness = 0.21

    if (name.includes('shoulder_pitch') || name.includes('hip_pitch')) color = new THREE.Color('#f2f2ee')
    if (name.includes('shoulder_roll') || name.includes('hip_roll')) color = new THREE.Color('#e9eae7')
    if (name.includes('shoulder_yaw') || name.includes('hip_yaw')) color = new THREE.Color('#f4f4f0')
    if (name.includes('elbow_pitch') || name.includes('knee_pitch')) color = new THREE.Color('#ecece8')
    if (name.includes('elbow_roll') || name.includes('ankle_roll')) color = new THREE.Color('#e4e6e3')
    if (name.includes('ankle_pitch')) color = new THREE.Color('#f0f0ec')
    if (name.includes('hand_link')) {
      color = new THREE.Color('#f5f5f1')
      roughness = 0.17
    }
    if (name === 'base') {
      color = new THREE.Color('#101316')
      metalness = 0.92
      roughness = 0.17
    }
    if (name.includes('imu')) {
      color = new THREE.Color('#15191d')
      metalness = 0.88
      roughness = 0.2
    }

    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.material = new THREE.MeshStandardMaterial({
      color,
      metalness,
      roughness,
      envMapIntensity: name === 'base' || name.includes('imu') ? 1.55 : 1.38,
    })
  })
}

function Viewer({
  exploded,
  motion,
  setLoaded,
  apiRef,
}: {
  exploded: boolean
  motion: MotionName
  setLoaded: (value: boolean) => void
  apiRef: React.MutableRefObject<ViewerApi | null>
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const explodedRef = useRef(exploded)
  const motionRef = useRef(motion)

  useEffect(() => {
    explodedRef.current = exploded
  }, [exploded])

  useEffect(() => {
    motionRef.current = motion
  }, [motion])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34, host.clientWidth / host.clientHeight, 0.01, 50)
    camera.position.set(1.51, -1.7, 0.97)
    camera.up.set(0, 0, 1)

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' })
    const normalPixelRatio = Math.min(window.devicePixelRatio, 1.15)
    const explosionPixelRatio = Math.max(0.65, Math.min(window.devicePixelRatio, 1) * 0.72)
    renderer.setPixelRatio(normalPixelRatio)
    renderer.setSize(host.clientWidth, host.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.08
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.domElement.style.touchAction = 'pan-y'
    renderer.domElement.tabIndex = 0
    host.appendChild(renderer.domElement)

    const pmrem = new THREE.PMREMGenerator(renderer)
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture

    const key = new THREE.DirectionalLight('#dcecff', 2.0)
    key.position.set(2.3, -2, 3.1)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    scene.add(key)

    const rim = new THREE.DirectionalLight('#4c8dff', 2.6)
    rim.position.set(-2.2, 2.6, 1.4)
    scene.add(rim)

    const warm = new THREE.PointLight('#f3b959', 7, 4, 2)
    warm.position.set(0.2, -0.4, 1.45)
    scene.add(warm)

    const floorMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uEnergy: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;
        uniform float uTime;
        uniform float uEnergy;

        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          float radius = length(p);
          float angle = atan(p.y, p.x);
          float speed = 0.72 + uEnergy * 1.35;
          float t = uTime * speed;

          vec3 midnight = vec3(0.004, 0.014, 0.027);
          vec3 blue = vec3(0.025, 0.38, 0.92);
          vec3 cyan = vec3(0.12, 0.72, 1.0);
          vec3 orange = vec3(1.0, 0.31, 0.025);
          vec3 gold = vec3(1.0, 0.68, 0.12);

          float spiralBlue = sin(radius * 33.0 - t * 4.2 + angle * 5.0);
          float spiralOrange = sin(radius * 27.0 + t * 3.5 - angle * 4.0 + 1.8);
          float blueWave = pow(max(0.0, spiralBlue), 9.0);
          float orangeWave = pow(max(0.0, spiralOrange), 11.0);
          float ringGrid = pow(max(0.0, sin(radius * 48.0 - t * 1.25)), 24.0);
          float spokeGrid = pow(max(0.0, cos(angle * 18.0 + t * 0.45)), 45.0);
          float energyBand = 0.5 + 0.5 * sin(angle * 2.0 - t * 1.6 + radius * 11.0);
          float centerFalloff = smoothstep(1.04, 0.08, radius);
          float rim = smoothstep(0.88, 0.99, radius) * (1.0 - smoothstep(0.99, 1.015, radius));

          vec3 color = midnight;
          color += mix(blue, cyan, energyBand) * blueWave * (0.25 + uEnergy * 0.36);
          color += mix(orange, gold, 1.0 - energyBand) * orangeWave * (0.22 + uEnergy * 0.42);
          color += blue * ringGrid * 0.13;
          color += mix(blue, orange, energyBand) * spokeGrid * 0.055;
          color += mix(cyan, gold, 0.5 + 0.5 * sin(angle * 3.0 - t)) * rim * (0.65 + uEnergy * 0.65);
          color *= centerFalloff;
          color += vec3(0.005, 0.012, 0.02);

          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.DoubleSide,
    })

    const floor = new THREE.Mesh(new THREE.CircleGeometry(0.76, 96), floorMaterial)
    floor.receiveShadow = true
    floor.position.z = -0.003
    scene.add(floor)

    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.606, 0.618, 96),
      new THREE.MeshBasicMaterial({ color: '#4385eb', transparent: true, opacity: 0.42, side: THREE.DoubleSide }),
    )
    halo.position.z = 0.001
    scene.add(halo)

    const polarGrid = new THREE.PolarGridHelper(0.73, 20, 6, 72, '#2e73ad', '#16324b')
    polarGrid.rotation.x = Math.PI / 2
    polarGrid.position.z = 0.0025
    const polarMaterial = polarGrid.material as THREE.LineBasicMaterial
    polarMaterial.transparent = true
    polarMaterial.opacity = 0.2
    polarMaterial.blending = THREE.AdditiveBlending
    scene.add(polarGrid)

    const hologramBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.62, 1.52, 44, 1, true),
      new THREE.MeshBasicMaterial({
        color: '#269cff',
        transparent: true,
        opacity: 0.018,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    hologramBeam.rotation.x = Math.PI / 2
    hologramBeam.position.z = 0.76
    scene.add(hologramBeam)

    const effectCenter = new THREE.Vector3(0, 0, 0.46)
    const effectParticleCount = 96
    const effectPositions = new Float32Array(effectParticleCount * 3)
    const effectDirections = new Float32Array(effectParticleCount * 3)
    const effectPhases = new Float32Array(effectParticleCount)
    const effectColors = new Float32Array(effectParticleCount * 3)
    const energyBlue = new THREE.Color('#58b7ff')
    const energyGold = new THREE.Color('#f1b84e')
    const goldenAngle = Math.PI * (3 - Math.sqrt(5))

    for (let index = 0; index < effectParticleCount; index += 1) {
      const normalized = (index + 0.5) / effectParticleCount
      const vertical = 1 - 2 * normalized
      const radial = Math.sqrt(Math.max(0, 1 - vertical * vertical))
      const azimuth = index * goldenAngle
      effectDirections[index * 3] = Math.cos(azimuth) * radial
      effectDirections[index * 3 + 1] = Math.sin(azimuth) * radial
      effectDirections[index * 3 + 2] = vertical
      effectPhases[index] = ((index * 37) % effectParticleCount) / effectParticleCount
      effectPositions[index * 3] = effectCenter.x
      effectPositions[index * 3 + 1] = effectCenter.y
      effectPositions[index * 3 + 2] = effectCenter.z
      const particleColor = index % 5 === 0 ? energyGold : energyBlue
      effectColors[index * 3] = particleColor.r
      effectColors[index * 3 + 1] = particleColor.g
      effectColors[index * 3 + 2] = particleColor.b
    }

    const effectGeometry = new THREE.BufferGeometry()
    effectGeometry.setAttribute('position', new THREE.BufferAttribute(effectPositions, 3))
    effectGeometry.setAttribute('color', new THREE.BufferAttribute(effectColors, 3))
    const effectMaterial = new THREE.PointsMaterial({
      size: 0.012,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const energyParticles = new THREE.Points(effectGeometry, effectMaterial)
    energyParticles.visible = false
    scene.add(energyParticles)

    const trailMaxCount = 16
    const trailPositions = new Float32Array(trailMaxCount * 2 * 3)
    const trailColors = new Float32Array(trailMaxCount * 2 * 3)
    for (let index = 0; index < trailMaxCount; index += 1) {
      const trailColor = index % 4 === 0 ? energyGold : energyBlue
      for (let point = 0; point < 2; point += 1) {
        const offset = (index * 2 + point) * 3
        const attenuation = point === 0 ? 1 : 0.18
        trailColors[offset] = trailColor.r * attenuation
        trailColors[offset + 1] = trailColor.g * attenuation
        trailColors[offset + 2] = trailColor.b * attenuation
      }
    }
    const trailGeometry = new THREE.BufferGeometry()
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3))
    trailGeometry.setAttribute('color', new THREE.BufferAttribute(trailColors, 3))
    trailGeometry.setDrawRange(0, 0)
    const trailMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const partTrails = new THREE.LineSegments(trailGeometry, trailMaterial)
    partTrails.visible = false
    scene.add(partTrails)

    const shellMaterial = new THREE.MeshBasicMaterial({
      color: '#4ca9ff',
      wireframe: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const energyShell = new THREE.Mesh(new THREE.SphereGeometry(0.47, 14, 10), shellMaterial)
    energyShell.position.copy(effectCenter)
    energyShell.visible = false
    scene.add(energyShell)

    const energyRings = [0, 1, 2].map((index) => {
      const material = new THREE.MeshBasicMaterial({
        color: index === 1 ? '#e7ad49' : '#5cb7ff',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34 + index * 0.018, 0.003, 6, 72), material)
      ring.position.copy(effectCenter)
      if (index === 1) ring.rotation.x = Math.PI / 2
      if (index === 2) ring.rotation.y = Math.PI / 2
      ring.visible = false
      scene.add(ring)
      return ring
    })

    const explosionLight = new THREE.PointLight('#55adff', 0, 2.4, 2)
    explosionLight.position.copy(effectCenter)
    scene.add(explosionLight)

    const shockMaterial = new THREE.MeshBasicMaterial({
      color: '#a8ddff',
      wireframe: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const shockSphere = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), shockMaterial)
    shockSphere.position.copy(effectCenter)
    shockSphere.visible = false
    scene.add(shockSphere)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 0, 0.43)
    controls.enableDamping = true
    controls.dampingFactor = 0.055
    controls.enableRotate = true
    controls.enableZoom = false
    controls.rotateSpeed = 0.72
    controls.enablePan = false
    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE
    controls.touches.ONE = THREE.TOUCH.ROTATE
    controls.touches.TWO = THREE.TOUCH.ROTATE
    controls.minPolarAngle = 0.2
    controls.maxPolarAngle = Math.PI * 0.78

    const resetCamera = () => {
      camera.position.set(1.51, -1.7, 0.97)
      controls.target.set(0, 0, 0.43)
    }

    const robotGroup = new THREE.Group()
    robotGroup.rotation.z = 0
    robotGroup.position.z = 0.005
    scene.add(robotGroup)

    let robot: URDFRobot | null = null
    let engineeringBoundsCaptured = false
    let explosionAmount = 0
    let rootHeightOffset = 0
    let standingFootMinZ = 0
    let footMeshes: THREE.Mesh[] = []
    let explosionStartedAt = -10
    let wasExploded = false
    let explosionPerformanceMode = false
    const currentPose: Record<string, number> = {}
    let explosionPrepared = false
    let explodedParts: {
      mesh: THREE.Mesh
      origin: THREE.Vector3
      target: THREE.Vector3
      originRotation: THREE.Quaternion
      targetRotation: THREE.Quaternion
      originScale: THREE.Vector3
      originWorld: THREE.Vector3
      launchDirectionWorld: THREE.Vector3
      suppressInExplosion: boolean
      delay: number
    }[] = []

    const findLinkName = (object: THREE.Object3D) => {
      let ancestor: THREE.Object3D | null = object.parent
      while (ancestor && !(ancestor as THREE.Object3D & { isURDFLink?: boolean }).isURDFLink) {
        ancestor = ancestor.parent
      }
      return ancestor?.name ?? ''
    }

    const getFootMinZ = () => {
      if (!robot || footMeshes.length === 0) return standingFootMinZ
      robot.updateMatrixWorld(true)
      let minimum = Number.POSITIVE_INFINITY
      footMeshes.forEach((mesh) => {
        mesh.geometry.computeBoundingBox()
        const localBox = mesh.geometry.boundingBox
        if (!localBox) return
        const worldBox = localBox.clone().applyMatrix4(mesh.matrixWorld)
        minimum = Math.min(minimum, worldBox.min.z)
      })
      return Number.isFinite(minimum) ? minimum : standingFootMinZ
    }

    const prepareExplosion = () => {
      if (!robot) return
      robot.updateMatrixWorld(true)
      const center = robotGroup.localToWorld(new THREE.Vector3(0, 0, 0.46))
      explodedParts = []

      const explosionMeshes: THREE.Mesh[] = []
      robot.traverse((object) => {
        const candidate = object as THREE.Mesh
        if (candidate.isMesh && candidate.parent) explosionMeshes.push(candidate)
      })
      const majorPartCount = explosionMeshes.filter((mesh) => {
        mesh.geometry.computeBoundingBox()
        const size = mesh.geometry.boundingBox?.getSize(new THREE.Vector3()) ?? new THREE.Vector3()
        return size.length() >= 0.06
      }).length
      let shellIndex = 0

      explosionMeshes.forEach((mesh) => {
        if (!mesh.parent) return

        const name = findLinkName(mesh)
        const isFoot = name.includes('ankle_roll')
        mesh.geometry.computeBoundingBox()
        mesh.geometry.computeBoundingSphere()
        const localSize = mesh.geometry.boundingBox?.getSize(new THREE.Vector3()) ?? new THREE.Vector3()
        const suppressInExplosion = localSize.length() < 0.06
        const shellSlot = suppressInExplosion ? 0 : shellIndex++
        const side = name.includes('_left_') ? 1 : name.includes('_right_') ? -1 : 0
        const worldPosition = mesh.getWorldPosition(new THREE.Vector3())
        const worldScale = mesh.getWorldScale(new THREE.Vector3())
        const maxWorldScale = Math.max(Math.abs(worldScale.x), Math.abs(worldScale.y), Math.abs(worldScale.z))
        const safetyRadius = (mesh.geometry.boundingSphere?.radius ?? localSize.length() * 0.5) * maxWorldScale

        // Every visible module owns one fixed slot on the same spherical shell.
        // Golden-angle spacing avoids rows while a shared radius keeps the
        // arrangement intentional instead of looking like random debris.
        const goldenAngle = Math.PI * (3 - Math.sqrt(5))
        const normalizedSlot = majorPartCount > 1 ? shellSlot / (majorPartCount - 1) : 0.5
        const azimuth = shellSlot * goldenAngle
        const vertical = THREE.MathUtils.lerp(-0.58, 0.88, normalizedSlot)
        const horizontal = Math.sqrt(Math.max(0, 1 - vertical * vertical))
        const sphereDirection = new THREE.Vector3(
          Math.cos(azimuth) * horizontal,
          Math.sin(azimuth) * horizontal,
          vertical,
        ).normalize()
        const shellRadius = 0.48
        let targetWorld = center.clone().addScaledVector(sphereDirection, shellRadius)

        if (isFoot) {
          // Feet occupy symmetric lower-shell slots and still have no
          // front/back displacement relative to the robot.
          const footVertical = -0.5
          const footHorizontal = Math.sqrt(1 - footVertical * footVertical)
          targetWorld = center.clone().addScaledVector(new THREE.Vector3(
            0,
            side * footHorizontal,
            footVertical,
          ), shellRadius)
        }

        // Conservative origin-centred sphere clearance accounts for arbitrary
        // part rotation. The straight interpolation then stays above the deck.
        const minimumSafeZ = 0.018 + safetyRadius
        targetWorld.z = Math.max(targetWorld.z, minimumSafeZ)

        // Tiny connector/sensor meshes read as visual debris when detached.
        // Keep them in place and fade them out instead of launching them.
        if (suppressInExplosion) targetWorld = worldPosition.clone()
        mesh.parent.updateWorldMatrix(true, false)
        const targetLocal = mesh.parent.worldToLocal(targetWorld)
        const originRotation = mesh.quaternion.clone()
        const orderlyTwist = isFoot ? 0 : (shellSlot % 2 === 0 ? 1 : -1) * (0.28 + normalizedSlot * 0.18)
        const tangentAxis = new THREE.Vector3().crossVectors(sphereDirection, new THREE.Vector3(0, 0, 1))
        if (tangentAxis.lengthSq() < 0.001) tangentAxis.set(1, 0, 0)
        tangentAxis.normalize()
        const tangentRotation = new THREE.Quaternion().setFromAxisAngle(
          tangentAxis,
          isFoot ? 0 : (shellSlot % 2 === 0 ? 1 : -1) * (0.18 + normalizedSlot * 0.14),
        )
        const scatterRotation = tangentRotation.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(
          isFoot ? 0 : vertical * 0.16,
          isFoot ? 0 : ((shellSlot % 3) - 1) * 0.1,
          orderlyTwist,
        )))
        const targetRotation = suppressInExplosion
          ? originRotation.clone()
          : originRotation.clone().multiply(scatterRotation)
        explodedParts.push({
          mesh,
          origin: mesh.position.clone(),
          target: targetLocal,
          originRotation,
          targetRotation,
          originScale: mesh.scale.clone(),
          originWorld: worldPosition.clone(),
          launchDirectionWorld: targetWorld.clone().sub(worldPosition).normalize(),
          suppressInExplosion,
          delay: suppressInExplosion
            ? 0
            : name === 'base'
              ? 0.16
              : name.includes('shoulder') || name.includes('hip')
                ? 0.1 + (shellSlot % 3) * 0.012
                : name.includes('elbow') || name.includes('knee')
                  ? 0.055 + (shellSlot % 3) * 0.01
                  : 0.018 + (shellSlot % 3) * 0.008,
        })
      })

      explosionPrepared = true
    }

    const loader = new URDFLoader()
    loader.loadMeshCb = (path, _manager, _material, done) => {
      const file = path.replaceAll('\\', '/').split('/').pop()
      if (!file) return
      const completeMesh = (geometry: THREE.BufferGeometry) => {
        geometry.computeVertexNormals()
        const mesh = new THREE.Mesh(geometry, showcaseMaterial(file))
        mesh.castShadow = true
        mesh.receiveShadow = true
        if (file.includes('leg_left_ankle_roll_visual') || file.includes('leg_right_ankle_roll_visual')) {
          if (!footMeshes.includes(mesh)) footMeshes.push(mesh)
        }
        done(mesh)
      }
      const loadCompressedMesh = async () => {
        try {
          const response = await fetch(assetUrl(`/humanoid/meshes-gzip/${file}.gz`))
          if (!response.ok || !response.body) throw new Error(`Compressed mesh unavailable: ${file}`)
          const data = response.headers.get('content-encoding')?.includes('gzip')
            ? await response.arrayBuffer()
            : await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
          completeMesh(new STLLoader().parse(data))
        } catch {
          new STLLoader().load(assetUrl(`/humanoid/meshes/${file}`), completeMesh)
        }
      }
      void loadCompressedMesh()
    }

    loader.load(assetUrl('/humanoid/berkeley_humanoid_lite.urdf'), (loadedRobot) => {
      robot = loadedRobot
      recolorRobot(robot)
      updatePose(robot, motionRef.current, 0, 0.5, currentPose)
      robot.updateMatrixWorld(true)

      robotGroup.add(robot)
      robotGroup.updateMatrixWorld(true)
      ;['leg_left_ankle_roll', 'leg_right_ankle_roll'].forEach((linkName) => {
        const footLink = robot?.links[linkName]
        footLink?.traverse((object) => {
          const candidate = object as THREE.Mesh
          if (candidate.isMesh && !footMeshes.includes(candidate)) footMeshes.push(candidate)
        })
      })
      standingFootMinZ = getFootMinZ()
      setLoaded(true)
    })

    apiRef.current = {
      resetCamera,
    }

    let userControlledCamera = false
    const handleControlStart = () => {
      userControlledCamera = true
      controls.autoRotate = false
    }
    controls.addEventListener('start', handleControlStart)

    const clock = new THREE.Clock()
    let animationFrame = 0
    let viewerVisible = true
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      viewerVisible = entry.isIntersecting
    }, { threshold: 0.01 })
    visibilityObserver.observe(host)
    const animate = () => {
      animationFrame = requestAnimationFrame(animate)
      if (!viewerVisible) {
        clock.getDelta()
        return
      }
      const delta = Math.min(clock.getDelta(), 0.04)
      const elapsed = clock.elapsedTime
      const isExploded = explodedRef.current
      if (isExploded && !wasExploded) explosionStartedAt = elapsed
      wasExploded = isExploded
      const impactAge = elapsed - explosionStartedAt
      const target = isExploded ? THREE.MathUtils.smoothstep(impactAge, 0.08, 0.7) : 0
      if (target === 1 && !explosionPrepared) prepareExplosion()
      if (isExploded && !explosionPrepared) prepareExplosion()
      explosionAmount = THREE.MathUtils.damp(explosionAmount, target, isExploded ? 8.5 : 5.2, delta)

      if (robot) {
        if (!explodedRef.current && explosionAmount < 0.008) {
          updatePose(robot, motionRef.current, elapsed, delta, currentPose)
          if (motionRef.current === 'squat' && footMeshes.length > 0) {
            const currentFootMinZ = getFootMinZ()
            const footHeightError = standingFootMinZ - currentFootMinZ
            // Exact vertical foot lock: solve once from the articulated pose,
            // apply it, refresh matrices, then remove any remaining numerical
            // residual. The idle sole height is the immutable squat reference.
            rootHeightOffset = THREE.MathUtils.clamp(rootHeightOffset + footHeightError, -0.45, 0.04)
            robot.position.z = rootHeightOffset
            robot.updateMatrixWorld(true)
            const residualError = standingFootMinZ - getFootMinZ()
            rootHeightOffset = THREE.MathUtils.clamp(rootHeightOffset + residualError, -0.45, 0.04)
          } else {
            rootHeightOffset = THREE.MathUtils.damp(rootHeightOffset, 0, 7.2, delta)
          }
          robot.position.z = rootHeightOffset
          robot.updateMatrixWorld(true)
          const solvedFootMinZ = getFootMinZ()
          if (motionRef.current === 'idle' && Math.abs(rootHeightOffset) < 0.002) {
            // Keep the reference tied to the fully settled idle pose instead of
            // the first loading frame, which can still contain joint damping.
            standingFootMinZ = solvedFootMinZ
          }
          host.dataset.footBaseline = standingFootMinZ.toFixed(6)
          host.dataset.footCurrent = solvedFootMinZ.toFixed(6)
          host.dataset.footError = (solvedFootMinZ - standingFootMinZ).toFixed(6)
          host.dataset.rootOffset = rootHeightOffset.toFixed(6)
          host.dataset.footCount = String(footMeshes.length)
          if (!engineeringBoundsCaptured) {
            const activeRobot = robot
            let loadedMeshCount = 0
            activeRobot.traverse((object) => { if ((object as THREE.Mesh).isMesh) loadedMeshCount += 1 })
            if (loadedMeshCount < 26) return
            Object.entries(BASE_POSE).forEach(([name, value]) => {
              ;(activeRobot.joints[name] as URDFJoint | undefined)?.setJointValue(value)
            })
            activeRobot.position.z = 0
            activeRobot.updateMatrixWorld(true)
            const engineeringBounds = new THREE.Box3().setFromObject(activeRobot)
            const engineeringSize = engineeringBounds.getSize(new THREE.Vector3())
            if (engineeringSize.z > 0.5 && engineeringSize.x > 0.1 && engineeringSize.y > 0.1) {
              host.dataset.modelWidth = engineeringSize.y.toFixed(4)
              host.dataset.modelDepth = engineeringSize.x.toFixed(4)
              host.dataset.modelHeight = engineeringSize.z.toFixed(4)
              engineeringBoundsCaptured = true
            }
            Object.entries(currentPose).forEach(([name, value]) => {
              ;(activeRobot.joints[name] as URDFJoint | undefined)?.setJointValue(value)
            })
            activeRobot.position.z = rootHeightOffset
            activeRobot.updateMatrixWorld(true)
          }
        }
        explodedParts.forEach(({
          mesh,
          origin,
          target: partTarget,
          originRotation,
          targetRotation,
          originScale,
          suppressInExplosion,
          delay,
        }) => {
          const partProgress = THREE.MathUtils.clamp((explosionAmount - delay) / (1 - delay), 0, 1)
          const easedExplosion = partProgress * partProgress * (3 - 2 * partProgress)
          const launchProgress = explodedRef.current && !suppressInExplosion
            ? Math.min(1.065, 1 - Math.pow(1 - partProgress, 4.6) + Math.sin(partProgress * Math.PI) * 0.055)
            : easedExplosion
          mesh.position.lerpVectors(origin, partTarget, launchProgress)
          const rotationProgress = THREE.MathUtils.clamp((easedExplosion - 0.24) / 0.76, 0, 1)
          const easedRotation = rotationProgress * rotationProgress * (3 - 2 * rotationProgress)
          mesh.quaternion.slerpQuaternions(originRotation, targetRotation, easedRotation)
          if (suppressInExplosion) {
            const visibleScale = 1 - THREE.MathUtils.smoothstep(explosionAmount, 0.03, 0.3)
            mesh.scale.copy(originScale).multiplyScalar(visibleScale)
          } else {
            const scaleImpulse = explodedRef.current ? Math.sin(partProgress * Math.PI) * 0.16 : 0
            mesh.scale.copy(originScale).multiplyScalar(1 + scaleImpulse)
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
            materials.forEach((material) => {
              if (!(material instanceof THREE.MeshStandardMaterial)) return
              material.emissive.copy(material.color)
              material.emissiveIntensity = explodedRef.current
                ? Math.sin(Math.min(1, partProgress * 1.5) * Math.PI) * 0.68
                : Math.max(0, material.emissiveIntensity - delta * 2.8)
            })
          }
        })

        const trailPositionAttribute = trailGeometry.getAttribute('position') as THREE.BufferAttribute
        const trailPositionArray = trailPositionAttribute.array as Float32Array
        let activeTrailCount = 0
        let strongestTrail = 0
        if (explodedRef.current) {
          explodedParts.forEach(({ mesh, launchDirectionWorld, suppressInExplosion, delay }) => {
            if (suppressInExplosion || activeTrailCount >= trailMaxCount) return
            const partProgress = THREE.MathUtils.clamp((explosionAmount - delay) / (1 - delay), 0, 1)
            const trailEnergy = Math.sin(partProgress * Math.PI)
            if (trailEnergy < 0.025) return
            const currentWorld = mesh.getWorldPosition(new THREE.Vector3())
            const tailLength = 0.055 + trailEnergy * 0.24
            const tailWorld = currentWorld.clone().addScaledVector(launchDirectionWorld, -tailLength)
            const positionOffset = activeTrailCount * 6
            trailPositionArray[positionOffset] = currentWorld.x
            trailPositionArray[positionOffset + 1] = currentWorld.y
            trailPositionArray[positionOffset + 2] = currentWorld.z
            trailPositionArray[positionOffset + 3] = tailWorld.x
            trailPositionArray[positionOffset + 4] = tailWorld.y
            trailPositionArray[positionOffset + 5] = Math.max(0.025, tailWorld.z)
            strongestTrail = Math.max(strongestTrail, trailEnergy)
            activeTrailCount += 1
          })
        }
        trailGeometry.setDrawRange(0, activeTrailCount * 2)
        trailPositionAttribute.needsUpdate = activeTrailCount > 0
        partTrails.visible = activeTrailCount > 0
        trailMaterial.opacity = strongestTrail * 0.98

        if (!explodedRef.current && explosionAmount < 0.002 && explosionPrepared) {
          explodedParts.forEach(({ mesh, origin, originRotation, originScale }) => {
            mesh.position.copy(origin)
            mesh.quaternion.copy(originRotation)
            mesh.scale.copy(originScale)
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
            materials.forEach((material) => {
              if (material instanceof THREE.MeshStandardMaterial) material.emissiveIntensity = 0
            })
          })
          explodedParts = []
          explosionPrepared = false
        }
      }

      halo.material.opacity = 0.3 + Math.sin(elapsed * 1.25) * 0.08
      halo.rotation.z = elapsed * 0.04
      const effectAmount = THREE.MathUtils.smoothstep(explosionAmount, 0.04, 0.78)
      const shockAge = Math.max(0, impactAge - 0.08)
      const shockProgress = THREE.MathUtils.clamp(shockAge / 0.72, 0, 1)
      const shockStrength = isExploded && shockProgress < 1 ? Math.pow(1 - shockProgress, 1.8) : 0
      const effectVisible = effectAmount > 0.01
      const energyPulse = 0.5 + Math.sin(elapsed * 5.4) * 0.5
      energyParticles.visible = effectVisible
      energyShell.visible = effectVisible
      if (effectVisible) {
        effectMaterial.opacity = effectAmount * (0.48 + energyPulse * 0.3)
        effectMaterial.size = 0.009 + effectAmount * 0.009
        const positionAttribute = effectGeometry.getAttribute('position') as THREE.BufferAttribute
        const positionArray = positionAttribute.array as Float32Array
        for (let index = 0; index < effectParticleCount; index += 1) {
          const phase = effectPhases[index]
          const stream = (elapsed * 0.24 + phase) % 1
          const radius = 0.1 + effectAmount * (0.2 + phase * 0.24) + stream * 0.055
          const swirl = elapsed * (0.18 + phase * 0.12)
          const sourceX = effectDirections[index * 3]
          const sourceY = effectDirections[index * 3 + 1]
          const sourceZ = effectDirections[index * 3 + 2]
          const directionX = sourceX * Math.cos(swirl) - sourceY * Math.sin(swirl)
          const directionY = sourceX * Math.sin(swirl) + sourceY * Math.cos(swirl)
          positionArray[index * 3] = effectCenter.x + directionX * radius
          positionArray[index * 3 + 1] = effectCenter.y + directionY * radius
          positionArray[index * 3 + 2] = Math.max(0.03, effectCenter.z + sourceZ * radius)
        }
        positionAttribute.needsUpdate = true
        energyParticles.rotation.z = elapsed * 0.06
      } else {
        effectMaterial.opacity = 0
      }

      shockSphere.visible = shockStrength > 0.005
      shockMaterial.opacity = shockStrength * 0.82
      shockSphere.scale.setScalar(0.55 + shockProgress * 4.35)
      shockSphere.rotation.x = elapsed * 0.8
      shockSphere.rotation.y = elapsed * 1.1

      shellMaterial.opacity = effectAmount * (0.035 + energyPulse * 0.025)
      floorMaterial.uniforms.uTime.value = elapsed
      floorMaterial.uniforms.uEnergy.value = effectAmount
      polarMaterial.opacity = 0.16 + effectAmount * 0.24 + energyPulse * 0.03
      polarGrid.rotation.z = elapsed * (0.025 + effectAmount * 0.12)
      ;(hologramBeam.material as THREE.MeshBasicMaterial).opacity = 0.012 + effectAmount * (0.01 + energyPulse * 0.008)
      hologramBeam.rotation.z = elapsed * (0.06 + effectAmount * 0.12)
      const shellScale = 0.78 + effectAmount * 0.34 + energyPulse * 0.018
      energyShell.scale.setScalar(shellScale)
      energyShell.rotation.x = elapsed * 0.08
      energyShell.rotation.y = elapsed * 0.11
      energyShell.rotation.z = elapsed * 0.045

      energyRings.forEach((ring, index) => {
        const pulsePhase = (elapsed * 0.42 + index / energyRings.length) % 1
        const ringScale = 0.72 + pulsePhase * 0.78
        ring.visible = effectVisible
        ring.scale.setScalar(ringScale)
        ;(ring.material as THREE.MeshBasicMaterial).opacity = effectAmount * (1 - pulsePhase) * 0.38 + shockStrength * 0.32
        ring.rotation.z += delta * (index % 2 === 0 ? 0.16 : -0.12)
      })
      explosionLight.intensity = effectAmount * (3.4 + energyPulse * 2.8) + shockStrength * 12

      const explosionOrbit = explodedRef.current || explosionAmount > 0.04
      if (explosionOrbit !== explosionPerformanceMode) {
        explosionPerformanceMode = explosionOrbit
        renderer.setPixelRatio(explosionOrbit ? explosionPixelRatio : normalPixelRatio)
        renderer.setSize(host.clientWidth, host.clientHeight, false)
        key.castShadow = !explosionOrbit
        renderer.shadowMap.needsUpdate = true
      }
      controls.autoRotate = explosionOrbit || (!userControlledCamera && elapsed < 4.5)
      controls.autoRotateSpeed = explosionOrbit ? 1.22 : 0.32
      controls.update()
      host.dataset.cameraDistance = camera.position.distanceTo(controls.target).toFixed(6)

      const stableCameraPosition = camera.position.clone()
      const stableFov = camera.fov
      const cameraShockAge = Math.max(0, impactAge - 0.09)
      if (isExploded && cameraShockAge < 0.68) {
        const decay = Math.exp(-cameraShockAge * 6.2)
        const impact = Math.sin(cameraShockAge * 78) * decay
        camera.position.x += impact * 0.014
        camera.position.y += Math.cos(cameraShockAge * 93) * decay * 0.01
        camera.position.z += Math.sin(cameraShockAge * 67) * decay * 0.007
        camera.fov = stableFov - Math.sin(Math.min(1, cameraShockAge / 0.52) * Math.PI) * 3.2
        camera.updateProjectionMatrix()
      }
      renderer.render(scene, camera)
      camera.position.copy(stableCameraPosition)
      if (camera.fov !== stableFov) {
        camera.fov = stableFov
        camera.updateProjectionMatrix()
      }
    }
    animate()

    const resize = () => {
      camera.aspect = host.clientWidth / host.clientHeight
      camera.updateProjectionMatrix()
      renderer.setPixelRatio(explosionPerformanceMode ? explosionPixelRatio : normalPixelRatio)
      renderer.setSize(host.clientWidth, host.clientHeight)
    }
    window.addEventListener('resize', resize)

    return () => {
      cancelAnimationFrame(animationFrame)
      visibilityObserver.disconnect()
      window.removeEventListener('resize', resize)
      controls.removeEventListener('start', handleControlStart)
      controls.dispose()
      pmrem.dispose()
      effectGeometry.dispose()
      effectMaterial.dispose()
      trailGeometry.dispose()
      trailMaterial.dispose()
      energyShell.geometry.dispose()
      shellMaterial.dispose()
      shockSphere.geometry.dispose()
      shockMaterial.dispose()
      floor.geometry.dispose()
      floorMaterial.dispose()
      halo.geometry.dispose()
      ;(halo.material as THREE.Material).dispose()
      polarGrid.geometry.dispose()
      polarMaterial.dispose()
      hologramBeam.geometry.dispose()
      ;(hologramBeam.material as THREE.Material).dispose()
      energyRings.forEach((ring) => {
        ring.geometry.dispose()
        ;(ring.material as THREE.Material).dispose()
      })
      renderer.dispose()
      host.removeChild(renderer.domElement)
      apiRef.current = null
    }
  }, [apiRef, setLoaded])

  return <div className="viewer" ref={hostRef} aria-label="3S 人形服务机器人交互式三维模型" />
}

function App() {
  const appRef = useRef<HTMLElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [exploded, setExploded] = useState(false)
  const [motion, setMotion] = useState<MotionName>('idle')
  const viewerApi = useRef<ViewerApi | null>(null)
  const setLoadedStable = useCallback((value: boolean) => setLoaded(value), [])
  const trackPointer = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const x = `${event.clientX}px`
    const y = `${event.clientY}px`
    event.currentTarget.style.setProperty('--pointer-x', x)
    event.currentTarget.style.setProperty('--pointer-y', y)
  }, [])
  const selectMotion = (nextMotion: MotionName) => {
    setExploded(false)
    setMotion(nextMotion)
  }

  useEffect(() => {
    const app = appRef.current
    if (!app) return
    let scrollFrame = 0
    const updateScrollState = () => {
      scrollFrame = 0
      const available = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      app.style.setProperty('--page-progress', String(Math.min(1, Math.max(0, window.scrollY / available))))
    }
    const requestScrollUpdate = () => {
      if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScrollState)
    }
    const observedSections = [...app.querySelectorAll<HTMLElement>('.hero, .details, .actuator-family-section, .hardware-section, .service-system-section, .software-section, .real-builds')]
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const section = entry.target as HTMLElement
          section.classList.add('is-inview')
          app.dataset.activeSection = section.id || 'hero'
        }
      })
    }, { threshold: 0.24, rootMargin: '-8% 0px -18%' })
    observedSections.forEach((section) => sectionObserver.observe(section))
    updateScrollState()
    window.addEventListener('scroll', requestScrollUpdate, { passive: true })
    window.addEventListener('resize', requestScrollUpdate)
    return () => {
      if (scrollFrame) cancelAnimationFrame(scrollFrame)
      sectionObserver.disconnect()
      window.removeEventListener('scroll', requestScrollUpdate)
      window.removeEventListener('resize', requestScrollUpdate)
    }
  }, [])

  return (
    <main ref={appRef} className={exploded ? 'app is-exploded' : 'app'} onPointerMove={trackPointer} data-active-section="hero">
      <div className="noise" />
      <div className="cursor-aura" />
      <div className="impact-flash" />
      <div className="ambient ambient-blue" />
      <div className="ambient ambient-gold" />
      <div className="scan-beam" />
      <div className="hud-vignette" />
      <div className="light-pillars"><i /><i /><i /><i /><i /></div>
      <div className="circuit-field"><i /><i /><i /><i /><i /><i /></div>
      <div className="page-energy-progress" aria-hidden="true"><i /><b /><span>SCROLL ENERGY</span></div>
      <nav className="page-rail" aria-label="页面章节导航">
        <a href="#" data-code="01"><i />TWIN</a>
        <a href="#details" data-code="02"><i />SYSTEM</a>
        <a href="#actuators" data-code="03"><i />DEVICE</a>
        <a href="#hardware" data-code="04"><i />EDGE</a>
        <a href="#service-system" data-code="05"><i />IOT LOOP</a>
        <a href="#software" data-code="06"><i />DATA</a>
        <a href="#real-builds" data-code="07"><i />FIELD</a>
      </nav>
      <header className="nav">
        <a className="brand" href="#" aria-label="3S Robot 首页">
          <span className="brand-mark"><i /><i /></span>
          <span>3S <b>ROBOT</b></span>
        </a>
        <div className="nav-status"><span /> IOT 3S DEMO <i>／ 01</i></div>
        <nav>
          <a href="#actuators">DEVICE</a>
          <a href="#hardware">EDGE</a>
          <a href="#service-system">IOT LOOP</a>
          <a href="#real-builds">FIELD</a>
        </nav>
      </header>

      <div className="data-marquee" aria-hidden="true">
        <div>22 DOF SERVICE ROBOT &nbsp;◆&nbsp; IOT SMART SERVICE &nbsp;◆&nbsp; REAL-TIME KINEMATICS &nbsp;◆&nbsp; 5010 / 6512 MODULAR ACTUATION &nbsp;◆&nbsp; DIGITAL TWIN &nbsp;◆&nbsp; SIM-TO-REAL PIPELINE &nbsp;◆&nbsp; 3S DEMO SYSTEM</div>
      </div>

      <section className="hero">
        <div className="side-index" aria-hidden="true"><b>01</b><span>3S SERVICE<br />DIGITAL TWIN</span><i /></div>
        <div className="copy">
          <div className="eyebrow"><span /> MOBILE IOT SERVICE TERMINAL · 3S</div>
          <h1>IOT SERVICE<br /><em>HUMANOID.</em></h1>
          <p>让机器人从“会动的机器”变成可感知、可联网、<br />可远程控制、可数字化运维的移动物联网终端。</p>
          <div className="hero-iot-route" aria-label="物联网数据链">
            <span><i />感知</span><b>→</b><span><i />边缘</span><b>→</b><span><i />互联</span><b>→</b><span><i />服务</span>
          </div>
          <div className="actions">
            <button
              className="primary"
              onClick={() => setExploded((value) => !value)}
              aria-label={exploded ? '重新组装' : '探索结构'}
            >
              <span className="primary-copy">
                <small>{exploded ? 'ASSEMBLY PROTOCOL' : 'STRUCTURE SCAN'}</small>
                <b>{exploded ? '重新组装' : '探索结构'}</b>
              </span>
              <span className="primary-icon" aria-hidden="true">
                <i /><i /><i />
                <b>{exploded ? '↙' : '↗'}</b>
              </span>
              <span className="primary-energy" aria-hidden="true" />
            </button>
            <button className="icon-button" onClick={() => viewerApi.current?.resetCamera()} aria-label="重置视角">◎</button>
          </div>
        </div>

        <div className="stage">
          <div className="holo-disc" />
          <div className="energy-core" />
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="hud-arc hud-arc-a" />
          <div className="hud-arc hud-arc-b" />
          <div className="hud-reticle" aria-hidden="true">
            <i /><i /><i /><i />
            <span className="hud-axis hud-axis-x">X</span>
            <span className="hud-axis hud-axis-y">Y</span>
            <span className="hud-axis hud-axis-z">Z</span>
          </div>
          <div className="telemetry telemetry-top">
            <span>EDGE GATEWAY / 3S-22</span>
            <b>{exploded ? 'DEVICE TOPOLOGY VIEW' : '22 JOINT NODES ONLINE'}</b>
          </div>
          <div className="telemetry telemetry-bottom">
            <span>CAN0 + CAN1 / UDP UPLINK</span>
            <b>{exploded ? 'SERVICE GRAPH EXPANDED' : 'DIGITAL TWIN SYNCHRONIZED'}</b>
          </div>
          <Viewer
            exploded={exploded}
            motion={motion}
            setLoaded={setLoadedStable}
            apiRef={viewerApi}
          />
          {!loaded && <div className="loader"><span /><small>ASSEMBLING DIGITAL TWIN</small></div>}
          <div className="model-caption">
            <span className="pulse" />
            <div><small>FULL-BODY DIGITAL TWIN</small><strong>{exploded ? 'EXPLODED VIEW' : '22-DOF MOTION'}</strong></div>
          </div>
          <div className="interaction-hint">
            <span>↔</span>
            <small>按住拖动旋转<br />模型比例已锁定</small>
          </div>
        </div>

        <div className="motion-console" id="architecture">
          <div className="motion-console__head">
            <div><span className="pulse" /><small>MOTION STUDIO</small></div>
            <strong>{exploded ? 'ASSEMBLY EXPLODED' : `${MOTIONS.find((item) => item.id === motion)?.code} SEQUENCE`}</strong>
          </div>
          <div className="motion-list">
            {MOTIONS.map((item, index) => (
              <button
                key={item.id}
                className={!exploded && motion === item.id ? 'is-active' : ''}
                onClick={() => selectMotion(item.id)}
                aria-label={`播放${item.label}动作`}
              >
                <i>{String(index + 1).padStart(2, '0')}</i>
                <span>{item.label}<small>{item.code}</small></span>
              </button>
            ))}
          </div>
        </div>

        <aside className="specs" id="system">
          <div><strong>22</strong><span>FIELD DEVICE<br />JOINT NODES</span></div>
          <div><strong>2</strong><span>EDGE BUS<br />CAN CHANNELS</span></div>
          <div><strong>25<i>HZ</i></strong><span>ON-DEVICE<br />POLICY RATE</span></div>
        </aside>

        <div className="scroll-cue" aria-hidden="true">
          <span>SCROLL TO EXPLORE</span>
          <i><b /></i>
        </div>
      </section>

      <section className="details evidence-section" id="details">
        <div className="section-energy-label" aria-hidden="true"><span>URDF VERIFIED</span><i /><b>DIGITAL ASSET / ONLINE</b></div>
        <div className="details-intro evidence-head">
          <div className="details-heading">
            <div className="eyebrow"><span /> SYSTEM OVERVIEW · 02</div>
            <h2>一台机器人，<br />一套移动物联网系统。</h2>
            <p>22 个关节负责执行与反馈，板载计算负责实时决策，双 CAN 与 UDP 负责数据互联，数字孪生负责可视化、远程操控和运维诊断。</p>
          </div>
          <aside className="overview-manifest" aria-label="数字模型清单">
            <div className="manifest-head"><span>3S EVIDENCE STACK</span><b>MODEL + PHOTO + SERVICE</b></div>
            <div><i>01</i><span><small>DEVICE LAYER</small><b>22 JOINTS + IMU + ENCODER</b></span><em>SENSE</em></div>
            <div><i>02</i><span><small>EDGE + NETWORK</small><b>POLICY + DUAL CAN + UDP</b></span><em>LINK</em></div>
            <div><i>03</i><span><small>SERVICE LAYER</small><b>TWIN + TELEOP + DIAGNOSIS</b></span><em>SERVE</em></div>
          </aside>
        </div>

        <div className="metric-grid proof-grid" aria-label="项目关键数据">
          <article>
            <small>CONNECTED DEVICE</small>
            <strong>22<i>NODES</i></strong>
            <p>每个关节同时承担动作执行和状态反馈，组成分布式现场设备层。</p>
          </article>
          <article>
            <small>FULL-BODY CHAIN</small>
            <strong>22<i>DOF</i></strong>
            <p>源码资产定义 10 个双臂关节与 12 个双腿关节。</p>
          </article>
          <article>
            <small>DESKTOP FABRICATION</small>
            <strong>200<i>MM</i></strong>
            <p>主要打印件面向 200 × 200 × 200 mm 桌面 FDM 设备。</p>
          </article>
          <article>
            <small>DEPLOYABLE POLICY</small>
            <strong>25<i>HZ</i></strong>
            <p>训练回放脚本导出 ONNX，并生成部署所需控制周期。</p>
          </article>
        </div>

        <div className="engineering-gallery">
          <figure className="dimension-plate">
            <div className="plate-corner plate-corner-a" /><div className="plate-corner plate-corner-b" />
            <div className="render-ident"><i /> ACTUAL URDF / STL RENDER</div>
            <img src={assetUrl('/renders/bhl-engineering-hero.png')} alt="由项目 URDF 和 STL 资产渲染的整机模型" loading="lazy" />
            <div className="measure measure-width"><i /><span>761.5 MM<small>IDLE-POSE WIDTH</small></span><i /></div>
            <div className="measure measure-height"><i /><span>794.2 MM<small>MESH HEIGHT</small></span><i /></div>
            <div className="measure measure-depth"><span>338.6 MM · DEPTH ENVELOPE</span></div>
            <div className="model-axis" aria-hidden="true"><i className="axis-x" /><i className="axis-y" /><i className="axis-z" /><b>X</b><b>Y</b><b>Z</b></div>
            <figcaption>
              <div><small>ENGINEERING PLATE / 001</small><strong>待机姿态网格包围尺寸</strong></div>
              <p>尺寸由页面实际载入的工程网格实时计算，不作为产品标称外形尺寸。</p>
            </figcaption>
          </figure>

          <div className="engineering-subgrid">
            <figure className="joint-plate">
              <img src={assetUrl('/renders/bhl-engineering-side.png')} alt="服务机器人侧面关节结构渲染" loading="lazy" />
              <div className="joint-pin pin-shoulder"><i /><span>SHOULDER<br /><b>3-AXIS CHAIN</b></span></div>
              <div className="joint-pin pin-hip"><i /><span>HIP<br /><b>YAW · ROLL · PITCH</b></span></div>
              <div className="joint-pin pin-knee"><i /><span>KNEE<br /><b>PITCH JOINT</b></span></div>
              <figcaption><span>02 / KINEMATIC PROFILE</span><b>22 个 REVOLUTE JOINTS</b></figcaption>
            </figure>
            <figure className="explode-plate">
              <img src={assetUrl('/renders/bhl-engineering-exploded.png')} alt="服务机器人实际网格资产分解渲染" loading="lazy" />
              <div className="mesh-counter"><small>RENDER ASSET SET</small><strong>26</strong><span>STL MESHES</span></div>
              <div className="cad-origin"><i /> CAD MODEL<br /><b>PARAMETRIC ASSEMBLY</b></div>
              <figcaption><span>03 / ASSET TOPOLOGY</span><b>URDF 关联的实际零件集合</b></figcaption>
            </figure>
          </div>
        </div>

        <div className="source-proof-strip">
          <span>PROBLEM BACKGROUND</span>
          <span>TECHNICAL SOLUTION</span>
          <span>KEY TECHNOLOGY</span>
          <span>SCENARIO VALUE</span>
        </div>
      </section>

      <section className="actuator-family-section" id="actuators">
        <div className="section-energy-label" aria-hidden="true"><span>DEVICE LAYER</span><i /><b>CONNECTED ACTUATORS / 03</b></div>
        <div className="actuator-family-head">
          <div>
            <div className="eyebrow"><span /> IOT DEVICE LAYER · 03</div>
            <h2>两种智能关节，<br /><em>构成现场设备层。</em></h2>
          </div>
          <p>5010 与 6512 不只是机械关节。电机负责执行，编码器持续反馈位置，驱动器完成闭环控制，再通过 CAN 接入板载网关；机械模块由此成为可寻址、可诊断的现场节点。</p>
        </div>

        <div className="joint-family-layout" aria-label="5010 与 6512 关节模型特点">
          <article className="joint-family-card joint-family-5010">
            <div className="joint-family-visual">
              <img src={assetUrl('/renders/onshape-actuator-5010-thumb.png')} alt="Actuator-5010 摆线关节 CAD 模型" loading="eager" decoding="async" />
              <span>COMPACT / 5010</span>
            </div>
            <div className="joint-family-copy">
              <small>01 / ACTUATOR-5010</small>
              <h3>紧凑型摆线关节。</h3>
              <p>文档中包含 Ender / Bambu 打印变体、End Cap、5010_profile 与 RI-60_profile，适合展示小尺寸关节如何被拆成可打印、可维护的标准件。</p>
              <div className="joint-feature-list">
                <span><b>PRINT</b><i>Ender + Bambu variants</i></span>
                <span><b>PROFILE</b><i>5010 / RI-60 DXF</i></span>
                <span><b>STRUCTURE</b><i>End Cap + Hex Standoff</i></span>
              </div>
            </div>
          </article>

          <article className="joint-family-card joint-family-6512">
            <div className="joint-family-visual">
              <img src={assetUrl('/renders/onshape-actuator-thumb.png')} alt="Actuator-6512 摆线关节 CAD 模型" loading="eager" decoding="async" />
              <span>LARGER / 6512</span>
            </div>
            <div className="joint-family-copy">
              <small>02 / ACTUATOR-6512</small>
              <h3>大尺寸承载关节。</h3>
              <p>6512 文档包含 M6C12 profile、Bambu 版本、输出轴、输入轴和整机装配 BOM，更适合作为髋、膝、肩等高负载位置的工程展示主角。</p>
              <div className="joint-feature-list">
                <span><b>PROFILE</b><i>M6C12 DXF</i></span>
                <span><b>ASSEMBLY</b><i>Full Assembly + BOM</i></span>
                <span><b>ROLE</b><i>High-load joint layer</i></span>
              </div>
            </div>
          </article>
        </div>

        <div className="joint-system-strip" aria-label="两种关节的共同设计特点">
          <div><small>SHARED CORE</small><b>Cycloidal Disk</b><span>摆线盘把电机高速旋转转换成高减速输出。</span></div>
          <div><small>PRINTABLE BODY</small><b>Housing Variants</b><span>壳体按打印机和装配工艺拆分，便于低成本复现。</span></div>
          <div><small>MODEL TO BUILD</small><b>CAD + PRINT FILES</b><span>CAD 与打印文件配套，形成从模型到制造的闭环。</span></div>
          <div><small>IOT ENDPOINT</small><b>Sense · Act · Report</b><span>关节形成“采集状态—执行指令—回传结果”的最小物联网闭环。</span></div>
        </div>
      </section>

      <section className="hardware-section photo-led-section" id="hardware">
        <div className="section-energy-label" aria-hidden="true"><span>EDGE NODE</span><i /><b>DEVICE NETWORK / 04</b></div>
        <div className="section-index" aria-hidden="true">04</div>
        <div className="section-copy">
          <div className="eyebrow"><span /> PHYSICAL EDGE NETWORK · 04</div>
          <h2>硬件不只被装配，<br /><em>还要被连接。</em></h2>
          <p>无刷电机、编码器、驱动板和摆线减速器组成执行节点；左右肢体经双 CAN 分流接入边缘控制器，让批量关节拥有统一的命令、反馈和故障定位路径。</p>
          <div className="hardware-tags">
            <span>3D PRINTED GEARBOX</span>
            <span>AS5600 ENCODER</span>
            <span>BLDC + FOC</span>
            <span>CAN BUS</span>
          </div>
        </div>

        <div className="hardware-photo-cluster" aria-label="从单关节到全身集成的实物照片">
          <figure className="hardware-photo-main">
            <img src={assetUrl('/photos/actuator-prototype.jpg')} alt="实物执行器原型，展示白色打印壳体、无刷电机和编码器接线" loading="lazy" />
            <figcaption><span>01 / ACTUATOR CORE</span><b>编码器、电机与打印壳体的同轴装配</b></figcaption>
          </figure>
          <figure>
            <img src={assetUrl('/photos/actuator-batch.jpg')} alt="多个执行器、电调和线束组成的批量装配测试现场" loading="lazy" />
            <figcaption><span>02 / BATCH BUILD</span><b>执行器批量接线与调试</b></figcaption>
          </figure>
          <figure>
            <img src={assetUrl('/photos/fullbody-integration.jpg')} alt="人形服务机器人全身实物集成测试照片" loading="lazy" />
            <figcaption><span>03 / FULL BODY</span><b>从模块走向全身系统集成</b></figcaption>
          </figure>
          <div className="hardware-photo-status"><i /> REAL BUILD / PROVIDED PHOTOS</div>
        </div>

        <div className="hardware-proof-cards">
          <article>
            <small>MECHANICAL</small>
            <h3>白色打印件 + 金属轴承</h3>
            <p>实物照片能看到打印层纹、黄铜嵌件和轴承阵列，对应源码资产中的 22 个关节安装位。</p>
          </article>
          <article>
            <small>ELECTRICAL</small>
            <h3>编码器与驱动分离调试</h3>
            <p>AS5600 磁编码器、驱动板和相线在装配前批量测试，降低整机一次性调错的风险。</p>
          </article>
          <article>
            <small>NETWORK</small>
            <h3>CAN 总线分侧连接</h3>
            <p>低层代码把左右腿挂到 can0 / can1，并以统一关节顺序读写目标位置与测量值。</p>
          </article>
        </div>

        <div className="build-sequence">
          {[
            ['01', 'PRINT', '打印壳体与结构件'],
            ['02', 'ENCODE', '安装磁铁与 AS5600'],
            ['03', 'ASSEMBLE', '电机、减速器与驱动装配'],
            ['04', 'NETWORK', '电源与 CAN 总线连接'],
          ].map(([number, code, label]) => (
            <div key={number}>
              <i>{number}</i><span><small>{code}</small><b>{label}</b></span>
            </div>
          ))}
        </div>
      </section>

      <section className="service-system-section" id="service-system">
        <div className="section-energy-label" aria-hidden="true"><span>CLOSED LOOP</span><i /><b>IOT SERVICE / 05</b></div>
        <div className="service-system-head">
          <div>
            <div className="eyebrow"><span /> END · EDGE · NETWORK · SERVICE · 05</div>
            <h2>数据回得来，<br /><em>服务才真正闭环。</em></h2>
          </div>
          <p>远端下发任务，边缘控制器拆解动作，关节节点执行并回传状态，数字孪生同步呈现结果。指令、执行、反馈和诊断形成同一条可追踪的数据链。</p>
        </div>

        <div className="service-system-layout" aria-label="物联网智慧服务系统架构">
          <div className="service-orbit-map">
            <div className="service-map-kicker"><i /> LIVE SYSTEM TOPOLOGY <b>DATA FLOW ACTIVE</b></div>
            <div className="service-core">
              <small>DIGITAL TWIN</small>
              <b>3S Service Hub</b>
              <span>状态可视 · 远程控制 · 运维诊断</span>
            </div>
            <span className="service-node node-sense"><i />设备感知<small>ENCODER · IMU · JOINT STATE</small></span>
            <span className="service-node node-edge"><i />边缘决策<small>LOW LEVEL · ONNX POLICY</small></span>
            <span className="service-node node-network"><i />现场互联<small>CAN0 · CAN1 · UDP</small></span>
            <span className="service-node node-cloud"><i />服务应用<small>TELEOP · TWIN · DIAGNOSIS</small></span>
            <div className="service-live-rail" aria-label="系统在线状态">
              <span><small>DEVICE</small><b>22 / 22</b></span>
              <span><small>FIELD BUS</small><b>CAN0 + CAN1</b></span>
              <span><small>EDGE POLICY</small><b>25 HZ</b></span>
            </div>
          </div>

          <div className="service-brief-grid">
            <article>
              <small>01 / SENSE</small>
              <h3>现场状态可被持续感知</h3>
              <p>编码器与 IMU 把关节位置、姿态和运动状态变成边缘控制器可读取的数据。</p>
            </article>
            <article>
              <small>02 / DECIDE</small>
              <h3>实时任务在设备侧完成</h3>
              <p>低层控制与 ONNX 策略运行在板载计算端，关键动作不依赖远端网络往返。</p>
            </article>
            <article>
              <small>03 / CONNECT</small>
              <h3>双总线承载全身设备网络</h3>
              <p>can0 / can1 分担左右侧关节通信，UDP 连接上层遥操作与状态展示。</p>
            </article>
            <article>
              <small>04 / SERVE</small>
              <h3>数字孪生把数据变成服务</h3>
              <p>网页端统一呈现设备结构、动作状态和控制链，为远程演示、调试和故障定位提供入口。</p>
            </article>
          </div>
        </div>

        <div className="deliverable-strip iot-loop-strip" aria-label="物联网服务闭环">
          <span><b>01</b>任务下发</span>
          <span><b>02</b>边缘决策</span>
          <span><b>03</b>关节执行</span>
          <span><b>04</b>状态回传</span>
          <span><b>05</b>孪生诊断</span>
        </div>
      </section>

      <section className="software-section concise-software" id="software">
        <div className="section-energy-label" aria-hidden="true"><span>DATA PIPELINE</span><i /><b>EDGE TO SERVICE / 06</b></div>
        <div className="software-head">
          <div>
            <div className="eyebrow"><span /> IOT DATA PIPELINE · 06</div>
            <h2>一条数据链，<br />贯穿感知与服务。</h2>
          </div>
          <p>关节传感数据经 CAN 汇入边缘控制，策略在设备侧实时运行；UDP 承载远程任务与遥操作目标，数字孪生同步动作与设备状态。仿真训练则为边缘策略提供可部署的智能能力。</p>
        </div>

        <div className="pipeline clean-pipeline" aria-label="物联网数据与控制流程">
          <div className="pipeline-track"><i /><i /><i /><i /></div>
          {[
            ['01', 'SENSE', 'ENCODER · IMU', '现场状态采集'],
            ['02', 'EDGE', 'LOW LEVEL + ONNX', '设备侧实时决策'],
            ['03', 'BUS', 'CAN0 · CAN1', '全身节点互联'],
            ['04', 'UPLINK', 'UDP STREAM', '任务与状态传输'],
            ['05', 'SERVICE', 'DIGITAL TWIN', '远程控制与诊断'],
          ].map(([number, phase, title, text], index) => (
            <article key={number} className={index === 4 ? 'is-live' : ''}>
              <div className="pipeline-node"><i /><span>{number}</span></div>
              <small>{phase}</small>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>

        <div className="code-signal-row" aria-label="源码亮点">
          <article>
            <small>FIELD DEVICES</small>
            <strong>22 JOINT NODES</strong>
            <p>统一关节顺序把目标位置与测量状态映射到同一套设备模型。</p>
          </article>
          <article>
            <small>EDGE CLOCKS</small>
            <strong>2000 / 250 / 25 Hz</strong>
            <p>物理、低层控制和策略按不同时间尺度在边缘端协同运行。</p>
          </article>
          <article>
            <small>NETWORK PATH</small>
            <strong>CAN ⇄ UDP</strong>
            <p>现场总线连接关节，上层链路连接遥操作、数字孪生和服务界面。</p>
          </article>
        </div>

        <div className="simulation-showcase tight-simulation" id="simulation-visuals">
          <figure className="simulation-frame simulation-frame-primary">
            <img src={assetUrl('/renders/bhl-simulation-trajectory.png')} alt="基于机器人外形生成的强化学习步态训练技术可视化" loading="lazy" />
            <div className="sim-scanline" aria-hidden="true" />
            <div className="sim-visual-label"><i /> CONCEPT VISUAL / RL TRAINING</div>
            <div className="sim-copy">
              <small>01 / PARALLEL LOCOMOTION</small>
              <h3>在数千个平行世界里，<br />筛出一种能走向真机的步态。</h3>
              <p>并行环境负责快速探索，奖励函数负责淘汰滑脚、失稳和高冲击动作；蓝色残影表示连续步态相位，橙色足底环表示接触事件。</p>
            </div>
            <div className="sim-metrics">
              <span><b>4096</b><small>PARALLEL ENVS</small></span>
              <span><b>25<em>HZ</em></b><small>POLICY RATE</small></span>
              <span><b>20<em>S</em></b><small>EPISODE</small></span>
            </div>
          </figure>
        </div>

        <figure className="teleop-feature compact-teleop">
          <img src={assetUrl('/renders/bhl-teleoperation-ik.png')} alt="双手柄位姿经 UDP 和微分逆运动学映射至机器人双臂的技术概念图" loading="lazy" />
          <div className="teleop-shade" />
          <div className="teleop-feature-label"><i /> 03 / DUAL-ARM TELEOPERATION</div>
          <div className="teleop-feature-copy">
            <small>这个项目真正有辨识度的软件能力</small>
            <h3>两只手柄，<br />直接映射两只机械臂。</h3>
            <p>控制器提供六自由度目标位姿；机器人端以 Pinocchio 建模、Pink 求解微分逆运动学，在稳定基座的同时追踪双臂末端。</p>
          </div>
          <div className="teleop-chain" aria-label="遥操作数据链">
            <span><i>01</i><b>VIVE POSE</b><small>双手六自由度</small></span><em>→</em>
            <span><i>02</i><b>UDP STREAM</b><small>Windows → Ubuntu</small></span><em>→</em>
            <span><i>03</i><b>PINOCCHIO + PINK</b><small>微分逆运动学</small></span><em>→</em>
            <span><i>04</i><b>ARM TARGETS</b><small>关节速度输出</small></span>
          </div>
          <figcaption>基于实际模型外形制作的技术概念图；坐标轴表示控制器、目标末端与当前末端位姿的对齐关系。</figcaption>
        </figure>
      </section>

      <section className="real-builds photo-wall-section" id="real-builds">
        <div className="section-energy-label" aria-hidden="true"><span>REAL MANUFACTURING</span><i /><b>BUILD FLOOR / 07</b></div>
        <div className="real-builds-head">
          <div>
            <div className="eyebrow"><span /> FROM PARTS TO HUMANOID · 07</div>
            <h2>模型之后，<br /><em>看实物怎样长出来。</em></h2>
          </div>
          <p>实物照片按制造路径重排：先看单个关节原型，再看电机入壳、轴承嵌件、驱动板、批量调试，最后进入全身装配。这样比单纯堆图更像一条完整技术报告证据链。</p>
        </div>

        <div className="real-photo-grid real-photo-grid-expanded" aria-label="3S 人形服务机器人真实制造与装配照片">
          <figure className="real-photo-card real-photo-actuator-close">
            <img src={assetUrl('/photos/actuator-prototype.jpg')} alt="单个白色 3D 打印执行器近景" loading="eager" decoding="async" />
            <figcaption><span>01 / SINGLE MODULE</span><b>单关节原型的同轴结构</b></figcaption>
          </figure>
          <figure className="real-photo-card real-photo-actuators">
            <img src={assetUrl('/photos/actuator-production.jpg')} alt="5010 和 6512 无刷电机安装进白色打印关节壳体" loading="eager" decoding="async" />
            <figcaption><span>02 / ACTUATOR PRODUCTION</span><b>无刷电机进入打印壳体</b></figcaption>
          </figure>
          <figure className="real-photo-card real-photo-transmission">
            <img src={assetUrl('/photos/printed-transmission.jpg')} alt="批量制造的打印轮盘、轴承和黄铜嵌件" loading="eager" decoding="async" />
            <figcaption><span>03 / PRINTED TRANSMISSION</span><b>打印轮盘、轴承与嵌件装配</b></figcaption>
          </figure>
          <figure className="real-photo-card real-photo-electronics">
            <img src={assetUrl('/photos/control-electronics.jpg')} alt="批量准备的电机驱动板与磁编码器板" loading="eager" decoding="async" />
            <figcaption><span>04 / CONTROL ELECTRONICS</span><b>驱动与编码器批量准备</b></figcaption>
          </figure>
          <figure className="real-photo-card real-photo-transmission-top">
            <img src={assetUrl('/photos/printed-transmission-top.jpg')} alt="顶视拍摄的打印轮盘、轴承和黄铜嵌件批量排布" loading="eager" decoding="async" />
            <figcaption><span>05 / BEARING ARRAY</span><b>顶视看轴承阵列与嵌件分布</b></figcaption>
          </figure>
          <figure className="real-photo-card real-photo-batch">
            <img src={assetUrl('/photos/actuator-batch.jpg')} alt="大批量执行器、电调和线束测试现场" loading="eager" decoding="async" />
            <figcaption><span>06 / BATCH TEST</span><b>执行器从单件进入批量验证</b></figcaption>
          </figure>
          <figure className="real-photo-card real-photo-integration">
            <img src={assetUrl('/photos/system-integration.jpg')} alt="人形服务机器人整机平铺装配与全身线束集成" loading="eager" decoding="async" />
            <figcaption><span>07 / SYSTEM INTEGRATION</span><b>全身关节与线束进入实机</b></figcaption>
          </figure>
          <figure className="real-photo-card real-photo-fullbody">
            <img src={assetUrl('/photos/fullbody-integration.jpg')} alt="人形服务机器人整机站立集成实物照片" loading="eager" decoding="async" />
            <figcaption><span>08 / STANDING PROTOTYPE</span><b>白色主体、黑色中框与外露线束</b></figcaption>
          </figure>
        </div>
      </section>

      <footer>
        <span>3S HUMANOID SERVICE SYSTEM</span>
        <div className="footer-line"><i /></div>
        <span>DESIGN · CONNECT · SERVICE</span>
      </footer>
    </main>
  )
}

export default App
