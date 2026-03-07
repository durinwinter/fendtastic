import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Grid } from '@react-three/drei'

export const TechnicalGrid = ({ isNavigating }) => {
    const gridRef = useRef()

    useFrame((state) => {
        const t = state.clock.getElapsedTime()
        // Move grid slightly with time
        gridRef.current.position.z = (t * 0.5) % 2

        // React to navigation with tilt
        if (isNavigating) {
            gridRef.current.rotation.x = Math.min(gridRef.current.rotation.x + 0.01, -0.2)
        } else {
            gridRef.current.rotation.x = Math.max(gridRef.current.rotation.x - 0.01, -0.5)
        }
    })

    return (
        <group ref={gridRef} position={[0, -2.5, -5]} rotation={[-0.4, 0, 0]}>
            <Grid
                args={[150, 150]}
                sectionSize={5}
                sectionThickness={2}
                sectionColor="#00f2ff"
                cellSize={1}
                cellThickness={1.2}
                cellColor="#006688"
                infiniteGrid
                fadeDistance={80}
                fadeStrength={3}
                transparent
                opacity={0.4}
            />
        </group>
    )
}
