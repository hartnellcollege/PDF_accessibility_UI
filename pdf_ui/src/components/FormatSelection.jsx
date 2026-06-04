import React from 'react';
import { Box, Grid, Typography, Paper } from '@mui/material';
import { styled } from '@mui/material/styles';

const FormatOption = styled(Paper)(({ theme, selected }) => ({
  padding: theme.spacing(3),
  textAlign: 'center',
  cursor: 'pointer',
  border: selected ? `2px solid ${theme.palette.primary.main}` : '1px solid #e0e0e0',
  backgroundColor: selected ? 'rgba(156, 39, 176, 0.04)' : '#fff',
  boxShadow: selected ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
  transition: 'all 0.2s ease-in-out',
  height: { xs: 160, sm: 180, md: 200 }, // Fixed height for consistency
  width: '100%', // Full width within grid item
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: '0 6px 16px rgba(0,0,0,0.1)',
  },
  '@media (max-width:600px)': {
    padding: theme.spacing(2),
    height: 140,
    '&:active': {
      transform: 'scale(0.98)', // Touch feedback on mobile
    },
  },
}));

function FormatSelection({ selectedFormat, onFormatChange }) {
  return (
    <Box sx={{ my: { xs: 2, sm: 4 } }}>
      <Typography 
        variant="h5" 
        gutterBottom 
        sx={{ 
          textAlign: 'center', 
          mb: { xs: 2, sm: 3 },
          fontSize: { xs: '1.25rem', sm: '1.5rem' }
        }}
      >
        Choose output format
      </Typography>
      <Grid container spacing={{ xs: 2, sm: 3 }} justifyContent="center">
        <Grid item xs={12} sm={6} md={6}>
          <FormatOption 
            selected={selectedFormat === 'pdf'}
            onClick={() => onFormatChange('pdf')}
            elevation={selectedFormat === 'pdf' ? 4 : 1}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onFormatChange('pdf');
              }
            }}
            aria-label="Select PDF to PDF format"
          >
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              mb: { xs: 1, sm: 2 } 
            }}>
              <Box
                sx={{
                  width: { xs: 40, sm: 48 },
                  height: { xs: 40, sm: 48 },
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#8C1D40',
                  fontSize: { xs: '20px', sm: '24px' },
                }}
              >
                📄
              </Box>
            </Box>
            <Typography 
              variant="h6" 
              component="div"
              sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}
            >
              PDF to PDF
            </Typography>
            <Typography 
              variant="body2" 
              color="textSecondary" 
              sx={{ 
                mt: 1,
                fontSize: { xs: '0.75rem', sm: '0.875rem' }
              }}
            >
              Improve accessibility and maintain document structure
            </Typography>
          </FormatOption>
        </Grid>
        <Grid item xs={12} sm={6} md={6}>
          <FormatOption 
            selected={selectedFormat === 'html'}
            onClick={() => onFormatChange('html')}
            elevation={selectedFormat === 'html' ? 4 : 1}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onFormatChange('html');
              }
            }}
            aria-label="Select PDF to HTML format"
          >
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              mb: { xs: 1, sm: 2 } 
            }}>
              <Box
                sx={{
                  width: { xs: 40, sm: 48 },
                  height: { xs: 40, sm: 48 },
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#8C1D40',
                  fontSize: { xs: '20px', sm: '24px' },
                }}
              >
                &lt;/&gt;
              </Box>
            </Box>
            <Typography 
              variant="h6" 
              component="div"
              sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}
            >
              PDF to HTML
            </Typography>
            <Typography 
              variant="body2" 
              color="textSecondary" 
              sx={{ 
                mt: 1,
                fontSize: { xs: '0.75rem', sm: '0.875rem' }
              }}
            >
              Convert document to accessible HTML version
            </Typography>
          </FormatOption>
        </Grid>
      </Grid>
    </Box>
  );
}

export default FormatSelection;
