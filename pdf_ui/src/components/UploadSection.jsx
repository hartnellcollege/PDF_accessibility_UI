import React, { useState, useRef } from 'react';
// import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Snackbar, Alert } from '@mui/material';
import { motion } from 'framer-motion';
import { PDFDocument } from 'pdf-lib';
import { useApiClient } from '../hooks/useApiClient';
import { useAuthContext } from '../context/AuthContext';
import imgFileQuestion from '../assets/pdf-question.svg';
import imgFileText from '../assets/pdf-icon.svg';
import imgCodeXml from '../assets/pdf-html.svg';
import './UploadSection.css';

import { PDFBucket, HTMLBucket, validateBucketConfiguration, validateFormatBucket } from '../utilities/constants';

function sanitizeFilename(filename, format = 'pdf') {
  const normalized = filename.normalize('NFD');
  const withoutDiacritics = normalized.replace(/[\u0300-\u036f]/g, '');
  let sanitized = withoutDiacritics.replace(/[^\u0000-\u00FF]/g, '');

  // Apply comprehensive sanitization for both formats —
  // keeping only characters the backend regex allows: alphanumeric, space, . _ - ( ) [ ]
  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/[^\w .\-()\[\]]/g, '_');
  // \w covers [a-zA-Z0-9_] so _ is already included above

  if (format === 'html') {
    // HTML path: spaces become underscores
    sanitized = sanitized.replace(/\s/g, '_');
  }
  // pdf path: spaces are allowed by the backend regex so leave them as-is

  // Collapse multiple consecutive underscores
  sanitized = sanitized.replace(/_+/g, '_');

  // Remove leading/trailing underscores and spaces
  sanitized = sanitized.replace(/^[_ ]+|[_ ]+$/g, '');

  // Ensure starts with alphanumeric (backend regex requires ^[a-zA-Z0-9])
  sanitized = sanitized.replace(/^[^a-zA-Z0-9]+/, '');

  // Strip the extension before checking emptiness, then re-add
  const withoutExt = sanitized.replace(/\.pdf$/i, '');
  return withoutExt.trim() ? sanitized : 'default.pdf';
}


function UploadSection({ onUploadComplete }) {
  const { username } = useAuthContext();
  const { apiFetch } = useApiClient();
  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);

  const [selectedFiles, setSelectedFiles] = useState(null);
  const [selectedFormat, setSelectedFormat] = useState(null);
  const [fileSizeMB, setFileSizeMB] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [formatAvailability, setFormatAvailability] = useState({ pdf: false, html: false });

  // Check format availability on component mount
  React.useEffect(() => {
    const pdfValidation = validateFormatBucket('pdf');
    const htmlValidation = validateFormatBucket('html');

    setFormatAvailability({
      pdf: pdfValidation.isConfigured,
      html: htmlValidation.isConfigured
    });
  }, []);

  const resetFileInput = () => {
    setSelectedFiles(null);
    setSelectedFormat(null);
    setFileSizeMB(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = null;
    }
  };

  const handleFormatSelect = (format) => {
    // Check bucket configuration for the specific format
    const formatValidation = validateFormatBucket(format);
    const fullValidation = validateBucketConfiguration();

    // If both buckets are missing, show deployment popup
    if (fullValidation.needsFullDeployment) {
      setErrorMessage('Backend infrastructure not deployed. Please deploy the backend first.');
      setOpenSnackbar(true);

      // if (onShowDeploymentPopup) {
      //   onShowDeploymentPopup(fullValidation);
      // }
      return;
    }

    setSelectedFormat(format);
    setErrorMessage('');
  };

  const handleFileInput = async (inputFiles) => {
    if (!inputFiles || !inputFiles.length) return;


    // Reset any existing error messages
    setErrorMessage('');

    // **1. Basic PDF Checks**
    for (const file of inputFiles) {
      if (file.type !== 'application/pdf') {
        setErrorMessage('Only PDF files are allowed.');
        setOpenSnackbar(true);
        resetFileInput();
        return;
      }

      // Magic bytes check
      const magicBuffer = await file.slice(0, 5).arrayBuffer();
      const magicBytes = new Uint8Array(magicBuffer);
      const magicString = String.fromCharCode(...magicBytes);
      if (magicString !== '%PDF-') {
        setErrorMessage(`"${file.name}" is not a valid PDF file.`);
        setOpenSnackbar(true);
        resetFileInput();
        return;
      }
    }

    // **2. PDF validation with pdf-lib**
    try {
      for (const file of inputFiles) {
        const sizeMB = file.size / (1024 * 1024);
        if (sizeMB > 500) {
          setErrorMessage(`"${file.name}" exceeds the 500MB size limit.`);
          setOpenSnackbar(true);
          resetFileInput();
          return;
        }

        // Encryption check
        const arrayBuffer = await file.arrayBuffer();
        let pdfDoc;
        try {
          pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: false }); // Should throw error if encrypted
          if (pdfDoc.isEncrypted) throw new Error(); // Explicitly throw error if file was loaded
        } catch (e) {
          setErrorMessage(`"${file.name}" is password protected. Please remove the password and try again.`);
          setOpenSnackbar(true);
          resetFileInput();
          return;
        }
      }

      setSelectedFiles(inputFiles);

      if (inputFiles.length === 1) {
        const file = inputFiles[0];
        const sizeInBytes = file.size || 0;
        const sizeInMB = sizeInBytes / (1024 * 1024);
        const displaySize = sizeInMB >= 0.1
          ? parseFloat(sizeInMB.toFixed(1))
          : parseFloat(sizeInMB.toFixed(2));
        setFileSizeMB(displaySize);
        console.log('File size set to:', sizeInMB, 'MB for file:', file.name, '(raw size:', file.size, 'bytes)');
      }

      // Pass the file directly to handleUpload
      const uploadRes = await Promise.all(inputFiles.map(handleUpload));
      const newFilenames = uploadRes.map(r => r.uniqueFilename);
      const sanitizedFilenames = uploadRes.map(r => r.sanitizedFileName);

      onUploadComplete(newFilenames, sanitizedFilenames, selectedFormat || 'pdf');
    } catch (error) {
      setErrorMessage('Unable to read the PDF file.');
      setOpenSnackbar(true);
      resetFileInput();
    }
  };

  const handleFileSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.pdf,application/pdf';
    input.onchange = (e) => {
      const files = [...e.target.files];
      if (files.length) handleFileInput(files);
    };
    input.click();
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    const droppedFiles = [...e.dataTransfer.files];
    if (droppedFiles.length) handleFileInput(droppedFiles);
  };

  const handleUpload = async (file) => {

    // **1. Check if the bucket for selected format is configured**
    const formatValidation = validateFormatBucket(selectedFormat);
    if (formatValidation.needsDeployment) {
      setErrorMessage(`${formatValidation.bucketType} not configured. Please install the required infrastructure first.`);
      setOpenSnackbar(true);
      return;
    }

    // **3. Basic Guards**
    if (!file) {
      setErrorMessage('Please select a PDF file before uploading.');
      setOpenSnackbar(true);
      return;
    }

    // **3. Attempt to Increment Usage First**
    setIsUploading(true);

    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, ''); // YYYYMMDDTHHMMSS format
    const userEmail = username || 'unkown-user'; // Use email for unique filename, fallback to 'user'
    const sanitizedEmail = userEmail.replace(/[^a-zA-Z0-9]/g, '_'); // Replace non-alphanumerics with underscores
    const sanitizedFileName = sanitizeFilename(file.name, selectedFormat) || 'default.pdf'; // Fallback to 'default.pdf' if sanitization fails
    const uniqueFilename = `${sanitizedEmail}_${timestamp}_${sanitizedFileName}`; // Combined unique filename
    
    try {
      const { uploadUrl } = await apiFetch('/upload', {
        method: 'POST',
        body: JSON.stringify({
          fileName: uniqueFilename,
          fileType: file.type,
          fileSize: file.size,
          remediationType: selectedFormat === 'html' ? 'pdf2html' : 'pdf2pdf',
        }),
      });

      const upload = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/pdf',
          'x-amz-server-side-encryption': 'AES256',
        },
        body: file,
      })

      if (!upload.ok) {
        throw new Error('S3 upload failed.')
      }

      console.log('File uploaded, new file name:', uniqueFilename);
        
      return { uniqueFilename, sanitizedFileName };
      // **8. Don't reset automatically - let parent component handle flow**
    } catch (error) {
      console.error('Error uploading file.');
      setErrorMessage('Error uploading file. Please try again.');
      setOpenSnackbar(true);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCloseSnackbar = (_, reason) => {
    if (reason === 'clickaway') return;
    setOpenSnackbar(false);
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    dragCounter.current++;
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    if (--dragCounter.current <= 0) setIsDragging(false);
  }

  const handleDragEnd = (e) => {
    dragCounter.current = 0;
    setIsDragging(false);
  };


  if (selectedFormat === 'pdf' || selectedFormat === 'html') {
    const formatTitle = selectedFormat === 'pdf' ? 'PDF to PDF' : 'PDF to HTML';
    const formatIcon = selectedFormat === 'pdf' ? imgFileText : imgCodeXml;

    if (selectedFiles) {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="upload-container-selected">
            <div className="upload-content">
              <div className="upload-header">
                <div className="file-icon">
                  <img src={formatIcon} alt="" />
                </div>
                <div className="upload-title">
                  <h2>{formatTitle}</h2>
                </div>
              </div>

              <div className="upload-progress">
                <div className="file-info">
                  { selectedFiles.length === 1 && (
                    <span className="file-name">{selectedFiles[0].name} • {fileSizeMB > 0 ? fileSizeMB : (selectedFiles[0]?.size ? (() => {
                      const size = selectedFiles[0].size / (1024 * 1024);
                      return size >= 0.1 ? size.toFixed(1) : size.toFixed(2);
                    })() : '0.0')} MB</span>
                  )}
                  <span className="progress-percent">{isUploading ? 'Uploading...' : 'Ready'}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: isUploading ? '50%' : '100%' }}></div>
                </div>
              </div>

              {errorMessage && (
                <div className="upload-error">
                  <p>Upload failed: {errorMessage}</p>
                </div>
              )}

              <div className="upload-buttons">
                <button
                  className="change-file-btn"
                  onClick={() => {
                    setSelectedFiles(null);
                    setErrorMessage('');
                    setIsUploading(false);
                  }}
                  disabled={isUploading}
                >
                  Choose New PDF
                </button>
              </div>
            </div>

            <div className="disclaimer">
              <p>This solution does not remediate for fillable forms and color selection/ contrast for people with color blindness</p>
            </div>
          </div>

          {/* Snackbar for error messages */}
          <Snackbar
            open={openSnackbar}
            autoHideDuration={6000}
            onClose={handleCloseSnackbar}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          >
            <Alert onClose={handleCloseSnackbar} severity="error" sx={{ width: '100%' }} elevation={6} variant="filled">
              {errorMessage}
            </Alert>
          </Snackbar>
        </motion.div>
      );
    }

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div
          className={`upload-container-selected ${isDragging ? 'drag-active' : ''}`}
          onDrop={handleFileDrop}
          onDragOver={(e) => e.preventDefault()}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragEnd={handleDragEnd}
          >
          <div className="upload-content">
            <div className="upload-header">
              <div className="file-icon">
                <img src={formatIcon} alt="" />
              </div>
              <div className="upload-title">
                <h2>{formatTitle}</h2>
              </div>
            </div>

            <div className="upload-instructions">
              <p className="upload-main-text">{isDragging ?  'Release to upload PDFs' : 'Drop your PDFs here or click to browse'}</p>
            </div>

            {errorMessage && (
              <div className="upload-error">
                <p>{errorMessage}</p>
              </div>
            )}

            <div className="upload-buttons">
              <button className="change-format-btn" onClick={() => setSelectedFormat(null)}>
                Change Output Format
              </button>
              <button className="upload-btn" onClick={handleFileSelect} disabled={isUploading}>
                {isUploading ? 'Uploading...' : 'Upload PDFs'}
              </button>
            </div>
          </div>

          <div className="disclaimer">
            <p>This solution does not remediate for fillable forms and color selection/contrast for people with color blindness</p>
          </div>
        </div>

        {/* Snackbar for error messages */}
        <Snackbar
          open={openSnackbar}
          autoHideDuration={6000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        >
          <Alert onClose={handleCloseSnackbar} severity="error" sx={{ width: '100%' }} elevation={6} variant="filled">
            {errorMessage}
          </Alert>
        </Snackbar>
      </motion.div>
    );
  }

  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="upload-container">
        <div className="upload-content">
          <div className="upload-header">
            <div className="file-icon">
              <img src={imgFileQuestion} alt="" />
            </div>
            <div className="upload-title">
              <h2>Choose Output Format</h2>
            </div>
          </div>

          <div className="format-options">
            <div
              className={`format-option ${selectedFormat === 'pdf' ? 'selected' : ''}`}
              onClick={() => handleFormatSelect('pdf')}
            >
              <div className="format-header">
                <div className="format-icon">
                  <img src={imgFileText} alt="" />
                </div>
                <div className="format-info">
                  <span className="format-name">PDF to PDF</span>
                  <span className={`format-status ${formatAvailability.pdf ? 'available' : 'unavailable'}`}>
                    {formatAvailability.pdf ? '✓ Available' : '⚠ Install Required'}
                  </span>
                </div>
              </div>
              <p className="format-description">
                Improve accessibility and maintain document structure
              </p>
            </div>

            <div
              className={`format-option ${selectedFormat === 'html' ? 'selected' : ''}`}
              onClick={() => handleFormatSelect('html')}
            >
              <div className="format-header">
                <div className="format-icon">
                  <img src={imgCodeXml} alt="" />
                </div>
                <div className="format-info">
                  <span className="format-name">PDF to HTML</span>
                  <span className={`format-status ${formatAvailability.html ? 'available' : 'unavailable'}`}>
                    {formatAvailability.html ? '✓ Available' : '⚠ Install Required'}
                  </span>
                </div>
              </div>
              <p className="format-description">
                Convert document to accessible HTML version
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Snackbar for error messages */}
      <Snackbar
        open={openSnackbar}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert onClose={handleCloseSnackbar} severity="error" sx={{ width: '100%' }} elevation={6} variant="filled">
          {errorMessage}
        </Alert>
      </Snackbar>
    </motion.div>
  );
}

export default UploadSection;
