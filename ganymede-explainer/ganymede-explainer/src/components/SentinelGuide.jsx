import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture, Float, MeshDistortMaterial } from '@react-three/drei'
import * as THREE from 'three'

export const SentinelGuide = ({ active }) => {
    const sentinelRef = useRef()
    const texture = useTexture('/digital_sentinel.png')

    useFrame((state) => {
        if (!sentinelRef.current) return
        const t = state.clock.getElapsedTime()

        // Gentle holographic wobble
        sentinelRef.current.position.y = -2 + Math.sin(t * 0.5) * 0.1

        // React to mouse
        const mouse = state.mouse
        sentinelRef.current.rotation.y = THREE.MathUtils.lerp(sentinelRef.current.rotation.y, mouse.x * 0.2, 0.1)
        sentinelRef.current.rotation.x = THREE.MathUtils.lerp(sentinelRef.current.rotation.x, -mouse.y * 0.1, 0.1)
    })

    return (
        <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
            <group
                ref={sentinelRef}
                position={[-3, -2, 2]}
                scale={active ? 1.0 : 0}
                visible={active}
            >
                {/* Holographic Sprite */}
                <mesh>
                    <planeGeometry args={[2, 3]} />
                    <MeshDistortMaterial
                        map={texture}
                        transparent
                        opacity={0.8}
                        distort={0.1}
                        speed={2}
                        color="#00f2ff"
                        emissive="#00f2ff"
                        emissiveIntensity={1.5}
                        side={THREE.DoubleSide}
                    />
                </mesh>

                {/* Back-glow */}
                <pointLight intensity={2} color="#00f2ff" distance={5} />
            </group>
        </Float>
    )
}
