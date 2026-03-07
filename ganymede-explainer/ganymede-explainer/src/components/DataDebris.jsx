import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export const DataDebris = ({ count = 100 }) => {
    const meshRef = useRef()
    const particles = useMemo(() => {
        const temp = []
        for (let i = 0; i < count; i++) {
            const time = Math.random() * 100
            const factor = 20 + Math.random() * 100
            const speed = 0.01 + Math.random() / 200
            const x = Math.random() * 10 - 5
            const y = Math.random() * 10 - 5
            const z = Math.random() * 10 - 5
            temp.push({ time, factor, speed, x, y, z })
        }
        return temp
    }, [count])

    const dummy = useMemo(() => new THREE.Object3D(), [])

    useFrame((state) => {
        particles.forEach((particle, i) => {
            let { time, factor, speed, x, y, z } = particle
            const t = (time += speed)
            particle.time = t

            // Perlin-ish motion
            dummy.position.set(
                x + Math.cos(t) * factor * 0.01,
                y + Math.sin(t) * factor * 0.01,
                z + Math.cos(t) * factor * 0.01
            )

            dummy.updateMatrix()
            meshRef.current.setMatrixAt(i, dummy.matrix)
        })
        meshRef.current.instanceMatrix.needsUpdate = true
    })

    return (
        <instancedMesh ref={meshRef} args={[null, null, count]}>
            <dodecahedronGeometry args={[0.05, 0]} />
            <meshStandardMaterial
                color="#00f2ff"
                emissive="#00f2ff"
                emissiveIntensity={2}
                transparent
                opacity={0.6}
            />
        </instancedMesh>
    )
}
