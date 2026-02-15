import React from 'react';
import { Box, Typography } from '@mui/material';

interface PumpProps {
    name: string;
    isRunning: boolean;
}

const Pump: React.FC<PumpProps> = ({ name, isRunning }) => {
    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
        }}>
            <Box
                sx={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    border: `4px solid ${isRunning ? '#4caf50' : '#757575'}`,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    bgcolor: 'white'
                }}
            >
                <Box
                    sx={{
                        width: '0',
                        height: '0',
                        borderTop: '8px solid transparent',
                        borderBottom: '8px solid transparent',
                        borderLeft: `12px solid ${isRunning ? '#4caf50' : '#757575'}`,
                        marginLeft: '4px'
                    }}
                />
            </Box>
            <Typography variant="caption" sx={{ mt: 0.5 }}>{name}</Typography>
        </Box>
    );
};

export default Pump;
