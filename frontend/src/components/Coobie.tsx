import React, { useState } from 'react';
import { Box, Paper, Typography, IconButton, TextField, InputAdornment, Fade, Avatar } from '@mui/material';
import { Close as CloseIcon, Send as SendIcon } from '@mui/icons-material';
import { styled } from '@mui/material/styles';

const CoobieAvatar = styled(Avatar)(({ theme }) => ({
    width: 48,
    height: 48,
    cursor: 'pointer',
    border: `2px solid #555`,
    backgroundColor: '#1A1A1A',
    transition: 'all 0.2s',
    '&:hover': {
        borderColor: theme.palette.primary.main,
        transform: 'scale(1.05)',
    },
}));

const CoobieOnlinePill = styled(Button)(() => ({
    backgroundColor: 'transparent',
    border: '1px solid #FFBF00',
    color: '#fff',
    borderRadius: 20,
    fontSize: '0.65rem',
    fontWeight: 800,
    padding: '2px 12px',
    height: 24,
    minWidth: 'auto',
    letterSpacing: '0.05em',
    '&:hover': {
        backgroundColor: 'rgba(255,191,0,0.1)',
    }
}));

import { Button } from '@mui/material';

const Coobie: React.FC = () => {
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [chat, setChat] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
    const [loading, setLoading] = useState(false);

    const handleSend = async () => {
        if (!message.trim()) return;
        const newChat = [...chat, { role: 'user' as const, content: message }];
        setChat(newChat);
        setMessage('');
        setLoading(true);
        try {
            const response = await fetch('http://localhost:1234/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'local-model',
                    messages: [
                        { role: 'system', content: 'You are Coobie, a helpful assistant for the MURPH Mars Habitat Control System.' },
                        ...newChat
                    ],
                    temperature: 0.7,
                }),
            });
            const data = await response.json();
            const assistantMessage = data.choices[0].message.content;
            setChat([...newChat, { role: 'assistant', content: assistantMessage }]);
        } catch (error) {
            setChat([...newChat, { role: 'assistant', content: "Habitat brain offline." }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ position: 'relative' }}>
            {/* Chat Drawer */}
            <Fade in={open}>
                <Paper sx={{
                    position: 'fixed',
                    bottom: 80,
                    right: 20,
                    width: 320,
                    zIndex: 2000,
                    p: 2,
                    display: open ? 'flex' : 'none',
                    flexDirection: 'column',
                    backgroundColor: '#151515',
                    border: '1px solid #B7410E',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.8)'
                }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                        <Typography variant="caption" sx={{ fontWeight: 800, color: 'primary.main', letterSpacing: '0.1em' }}>COOBIE INTELLIGENCE</Typography>
                        <IconButton size="small" onClick={() => setOpen(false)}><CloseIcon fontSize="small" /></IconButton>
                    </Box>
                    <Box sx={{ height: 300, overflowY: 'auto', mb: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {chat.map((msg, i) => (
                            <Box key={i} sx={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                                <Typography variant="body2" sx={{
                                    p: 1, borderRadius: 1,
                                    fontSize: '0.8rem',
                                    backgroundColor: msg.role === 'user' ? 'rgba(183,65,14,0.1)' : 'rgba(255,255,255,0.05)',
                                    border: `1px solid ${msg.role === 'user' ? '#B7410E' : '#444'}`,
                                    color: '#eee'
                                }}>
                                    {msg.content}
                                </Typography>
                            </Box>
                        ))}
                        {loading && <Typography variant="caption" sx={{ color: 'text.secondary' }}>Thinking...</Typography>}
                    </Box>
                    <TextField
                        fullWidth size="small" placeholder="COMMAND..."
                        value={message} onChange={(e) => setMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton size="small" onClick={handleSend}><SendIcon fontSize="small" /></IconButton>
                                </InputAdornment>
                            ),
                            style: { fontSize: '0.8rem', fontFamily: 'JetBrains Mono' }
                        }}
                    />
                </Paper>
            </Fade>

            {/* Status Pill & Avatar */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-end' }}>
                <CoobieOnlinePill onClick={() => setOpen(!open)}>
                    COOBIE ONLINE
                </CoobieOnlinePill>
                <CoobieAvatar
                    src="/heptapod-assets/sprites/people/coobie.png"
                    onClick={() => setOpen(!open)}
                />
            </Box>
        </Box>
    );
};

export default Coobie;
