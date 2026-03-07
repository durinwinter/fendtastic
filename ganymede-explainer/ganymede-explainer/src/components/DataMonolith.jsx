import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Float, MeshWobbleMaterial } from '@react-three/drei'
import * as THREE from 'three'

export const DataMonolith = ({ position, label, onClick, active }) => {
    const meshRef = useRef()
    const [hovered, setHover] = useState(false)

    useFrame((state) => {
        const t = state.clock.getElapsedTime()
        meshRef.current.rotation.y = t * 0.5
        meshRef.current.position.y = position[1] + Math.sin(t * 1.5) * 0.1
    })

    return (
        <Float speed={5} rotationIntensity={0.2} floatIntensity={0.5}>
            <group
                position={position}
                onClick={onClick}
                onPointerOver={() => setHover(true)}
                onPointerOut={() => setHover(false)}
            >
                <mesh ref={meshRef}>
                    <boxGeometry args={[0.5, 1.5, 0.5]} />
                    <MeshWobbleMaterial
                        color={hovered ? "#ffaa00" : "#00f2ff"}
                        emissive={hovered ? "#ffaa00" : "#00f2ff"}
                        emissiveIntensity={hovered ? 2 : 1}
                        factor={0.2}
                        speed={2}
                    />
                </mesh>
                <Text
                    position={[0, 1.2, 0]}
                    fontSize={0.2}
                    color="white"
                    font="/fonts/JetBrainsMono-Bold.ttf"
                    anchorX="center"
                    anchorY="middle"
                >
                    {label}
                </Text>
            </group>
        </Float>
    )
}
