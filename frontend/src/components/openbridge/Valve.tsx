import React from 'react';
import { Box, Typography } from '@mui/material';

interface ValveProps {
    name: string;
    isOpen: boolean;
}

const Valve: React.FC<ValveProps> = ({ name, isOpen }) => {
    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            cursor: 'pointer'
        }}>
            <Box sx={{
                width: 0,
                height: 0,
                borderLeft: '10px solid transparent',
                borderRight: '10px solid transparent',
                borderTop: `20px solid ${isOpen ? '#4caf50' : '#757575'}`,
                marginBottom: '-5px'
            }} />
            <Box sx={{
                width: 0,
                height: 0,
                borderLeft: '10px solid transparent',
                borderRight: '10px solid transparent',
                borderBottom: `20px solid ${isOpen ? '#4caf50' : '#757575'}`,
                marginTop: '-5px'
            }} />
            <Typography variant="caption" sx={{ mt: 0.5 }}>{name}</Typography>
        </Box>
    );
};

export default Valve;
