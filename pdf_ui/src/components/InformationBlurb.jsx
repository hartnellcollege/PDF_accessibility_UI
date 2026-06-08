import React from 'react';
import { Box } from '@mui/material';
import imgDollar from "../assets/dollar.svg";
import imgCheckmark from "../assets/check.svg";
import imgZap from "../assets/zap.svg";

const InformationBlurb = () => {
  const features = [
    {
      icon: imgDollar,
      title: "Cost Effective Options",
      description: "Cost reduction from traditional remediation methods"
    },
    {
      icon: imgCheckmark,
      title: "WCAG 2.1 Level AA Standard",
      description: "Supports international accessibility standards"
    },
    {
      icon: imgZap,
      title: "Fast Processing",
      description: "Automated PDF remediation in minutes"
    }
  ];

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        gap: { xs: 2, sm: 3, md: 8 },
        alignItems: 'start',
        justifyContent: 'center',
        padding: { xs: 1, sm: 2, md: 0 },
        flexWrap: 'wrap',
        width: '100%',
        maxWidth: { xs: '100%', sm: '100%', md: 'none' }
      }}
    >
      {features.map((feature, index) => (
        <Box
          key={index}
          sx={{
            width: { xs: '100%', sm: '280px', md: '280px' },
            maxWidth: { xs: '320px', sm: 'none' },
            padding: { xs: 1.5, sm: 3 },
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            borderTop: '2px solid #8c1d40',
            position: 'relative',
            minHeight: { xs: '100px', sm: '140px' },
            margin: { xs: '0 auto', sm: '0' }
          }}
        >
          <Box
            sx={{
              backgroundColor: '#ffc627',
              padding: { xs: 0.75, sm: 1 },
              borderRadius: 1,
              marginBottom: { xs: 1.5, sm: 2 },
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: { xs: 40, sm: 48 },
              minHeight: { xs: 40, sm: 48 }
            }}
          >
            <Box
              component="img"
              src={feature.icon}
              alt=""
              sx={{
                width: { xs: '20px', sm: '32px' },
                height: { xs: '20px', sm: '32px' }
              }}
            />
          </Box>
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: { xs: 0.5, sm: 1 }, 
            textAlign: 'center', 
            width: '100%' 
          }}>
            <Box 
              component="h3" 
              sx={{ 
                fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif',
                fontWeight: 600, 
                fontSize: { xs: '12px', sm: '14px' }, 
                lineHeight: { xs: '16px', sm: '20px' }, 
                color: '#020617', 
                margin: 0 
              }}
            >
              {feature.title}
            </Box>
            <Box 
              component="p" 
              sx={{ 
                fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif',
                fontWeight: 400, 
                fontSize: { xs: '11px', sm: '14px' }, 
                lineHeight: { xs: '14px', sm: '20px' }, 
                color: '#1e293b', 
                margin: 0 
              }}
            >
              {feature.description}
            </Box>
          </Box>
        </Box>
      ))}
    </Box>
  );
};

export default InformationBlurb;
