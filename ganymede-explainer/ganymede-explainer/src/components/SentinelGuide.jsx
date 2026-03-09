import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture, Float, MeshDistortMaterial } from '@react-three/drei'
import * as THREE from 'three'

export const SentinelGuide = () => {
    const sentinelRef = useRef()
    const texture = useTexture('/digital_sentinel.png')

    useFrame((state) => {
        if (!sentinelRef.current) return
        const t = state.clock.getElapsedTime()

        // Gentle holographic wobble
        sentinelRef.current.position.y = -1.5 + Math.sin(t * 0.5) * 0.1

        // Pulsing life effect
        const pulse = 1 + Math.sin(t * 2) * 0.05
        sentinelRef.current.scale.set(pulse, pulse, pulse)

        // React to mouse
        const mouse = state.mouse
        sentinelRef.current.rotation.y = THREE.MathUtils.lerp(sentinelRef.current.rotation.y, mouse.x * 0.3, 0.1)
        sentinelRef.current.rotation.x = THREE.MathUtils.lerp(sentinelRef.current.rotation.x, -mouse.y * 0.2, 0.1)
    })

    return (
        <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
            <group
                ref={sentinelRef}
                position={[-4, -1.5, 1]}
            >
                {/* Holographic Sprite */}
                <mesh>
                    <planeGeometry args={[2.5, 3.5]} />
                    <MeshDistortMaterial
                        map={texture}
                        transparent
                        opacity={0.6}
                        distort={0.05}
                        speed={2}
                        color="#00f2ff"
                        emissive="#00f2ff"
                        emissiveIntensity={2}
                        side={THREE.DoubleSide}
                    />
                </mesh>

                {/* Back-glow */}
                <pointLight intensity={3} color="#00f2ff" distance={6} />
            </group>
        </Float>
    )
}
