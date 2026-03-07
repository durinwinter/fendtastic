import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sphere, MeshDistortMaterial, GradientTexture } from '@react-three/drei'
import * as THREE from 'three'

export const GanymedeMoon = () => {
    const moonRef = useRef()
    const cloudsRef = useRef()

    useFrame((state) => {
        const t = state.clock.getElapsedTime()
        moonRef.current.rotation.y = t * 0.05
        cloudsRef.current.rotation.y = t * 0.07
        cloudsRef.current.rotation.z = Math.sin(t * 0.1) * 0.1
    })

    return (
        <group position={[2, 0, -2]}>
            {/* Main Moon Body */}
            <Sphere ref={moonRef} args={[1.5, 64, 64]}>
                <meshStandardMaterial
                    color="#1a1a2e"
                    roughness={0.8}
                    metalness={0.2}
                    emissive="#001a33"
                    emissiveIntensity={0.5}
                >
                    <GradientTexture
                        stops={[0, 0.5, 1]}
                        colors={['#05070a', '#1a1a2e', '#002244']}
                    />
                </meshStandardMaterial>
            </Sphere>

            {/* Atmospheric Glow / Clouds (Iridescent & Warped) */}
            <Sphere ref={cloudsRef} args={[1.55, 64, 64]}>
                <MeshDistortMaterial
                    color="#00f2ff"
                    speed={3}
                    distort={0.4}
                    radius={1}
                    opacity={0.3}
                    transparent
                    side={THREE.DoubleSide}
                    emissive="#ff00ff"
                    emissiveIntensity={0.5}
                />
            </Sphere>

            {/* Rim Light Effect */}
            <pointLight position={[-5, 5, 5]} intensity={2} color="#00f2ff" />
            <pointLight position={[5, -5, -5]} intensity={1} color="#ffaa00" opacity={0.5} />
        </group>
    )
}
