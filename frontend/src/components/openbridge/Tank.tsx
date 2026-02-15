import React from 'react';
import { Box, Typography } from '@mui/material';

// Placeholder for OpenBridge Tank if library integration is complex or waiting for install
// In a real scenario with the library, we would import:
// import { ObcTank } from '@oicl/openbridge-webcomponents-react';

interface TankProps {
    name: string;
    level: number;
    capacity?: number;
}

const Tank: React.FC<TankProps> = ({ name, level, capacity = 100 }) => {
    const percentage = Math.min(100, Math.max(0, (level / capacity) * 100));

    return (
        <Box sx={{
            border: '1px solid #ccc',
            borderRadius: '4px',
            padding: '8px',
            textAlign: 'center',
            width: '100px',
            height: '150px',
            position: 'relative',
            overflow: 'hidden',
            bgcolor: '#f0f0f0'
        }}>
            <Box sx={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: `${percentage}%`,
                bgcolor: '#2196f3',
                transition: 'height 0.3s ease-in-out',
                opacity: 0.7
            }} />
            <Typography variant="caption" sx={{ position: 'relative', zIndex: 1, fontWeight: 'bold' }}>{name}</Typography>
            <Typography variant="body2" sx={{ position: 'relative', zIndex: 1 }}>{level.toFixed(1)}%</Typography>
        </Box>
    );
};

export default Tank;
