import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

export const DigitalOoze = () => {
    const meshRef = useRef()
    const { mouse, viewport } = useThree()

    const uniforms = useMemo(() => ({
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2(0, 0) },
    }), [])

    useFrame((state) => {
        const { clock } = state
        uniforms.uTime.value = clock.getElapsedTime()
        uniforms.uMouse.value.lerp(new THREE.Vector2(mouse.x * viewport.width / 2, mouse.y * viewport.height / 2), 0.1)
    })

    const vertexShader = `
        varying vec2 vUv;
        varying float vElevation;
        uniform float uTime;
        uniform vec2 uMouse;

        void main() {
            vUv = uv;
            vec4 modelPosition = modelMatrix * vec4(position, 1.0);
            
            float distanceToMouse = distance(modelPosition.xz, uMouse);
            float strength = 1.0 / (distanceToMouse + 1.0);
            
            float elevation = sin(modelPosition.x * 3.0 + uTime) * 0.2;
            elevation += sin(modelPosition.z * 2.0 + uTime) * 0.2;
            elevation *= strength * 2.0;

            modelPosition.y += elevation;
            vElevation = elevation;

            vec4 viewPosition = viewMatrix * modelPosition;
            vec4 projectionPosition = projectionMatrix * viewPosition;
            gl_Position = projectionPosition;
        }
    `

    const fragmentShader = `
        varying vec2 vUv;
        varying float vElevation;
        uniform float uTime;

        void main() {
            vec3 color = mix(vec3(0.0, 0.05, 0.1), vec3(0.0, 0.95, 1.0), vElevation + 0.5);
            float grid = sin(vUv.x * 100.0) * sin(vUv.y * 100.0);
            grid = step(0.98, grid);
            
            color += grid * 0.2;
            gl_FragColor = vec4(color, 0.8);
        }
    `

    return (
        <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -3, 0]}>
            <planeGeometry args={[50, 50, 128, 128]} />
            <shaderMaterial
                vertexShader={vertexShader}
                fragmentShader={fragmentShader}
                uniforms={uniforms}
                transparent
            />
        </mesh>
    )
}
