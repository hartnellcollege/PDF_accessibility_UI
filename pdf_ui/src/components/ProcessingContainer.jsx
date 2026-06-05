import React, { useState, useEffect, useCallback, useRef } from 'react';
import ResultsContainer from './ResultsContainer';
import './ProcessingContainer.css';
import { PDFBucket, HTMLBucket } from '../utilities/constants';
import { useApiClient } from '../hooks/useApiClient';
import { ApiError } from '../utilities/apiError';

const PROCESSING_STEPS = [
  { title: "Analyzing Document Structure", description: "Scanning PDF for accessibility issues" },
  { title: "Adding Accessibility Tags", description: "Implementing WCAG 2.1 compliance" },
  { title: "Adding Metadata", description: "Final accessibility enhancements" },
  { title: "Generating Accessible PDF", description: "Creating your accessible PDF document" }
];
/**
 *
 * @param {{
 *  pendingFiles: { originalName: string, updatedName: string }[],
 *  setPendingFiles: React.Dispatch<React.SetStateAction<null>>,
 *  onAllFilesReady: () => void,
 *  selectedFormat: string,
 *  onNewUpload: () => void,
 * }} param0
 */
const ProcessingContainer = ({
  pendingFiles,
  setPendingFiles,
  onAllFilesReady,
  selectedFormat,
  onNewUpload
}) => {
  const [processedFiles, setProcessedFiles] = useState(null);
  const [isDoneProcessing, setIsDoneProcessing] = useState(false);
  
  const [currentStep, setCurrentStep] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [pollingAttempts, setPollingAttempts] = useState(0);
  const intervalsRef = useRef({ poll: null, time: null, step: null });

  const [errorMessage, setErrorMessage] = useState('');

  const { apiFetch, downloadFile } = useApiClient();

  // Function to truncate the filename if it exceeds the threshold
  const truncateFilename = (filename) => {
    const FILENAME_THRESHOLD = 30;
    if (filename.length > FILENAME_THRESHOLD) {
      const extensionIndex = filename.lastIndexOf('.');
      const extension = filename.substring(extensionIndex);
      const truncatedName = filename.substring(0, FILENAME_THRESHOLD - extension.length) + '...';
      return truncatedName + extension;
    }
    return filename;
  };

  // Function to format elapsed time
  const formatElapsedTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getObjectKey = useCallback((file_name) => {
    let objectKey;
    if (selectedFormat === 'html') {
      // Sanitize filename for HTML format to match Bedrock Data Automation constraints
      const sanitizeForS3 = (filename) => {
        let sanitized = filename;
        // Replace spaces with underscores
        sanitized = sanitized.replace(/\s/g, '_');
        // Replace characters that violate Bedrock Data Automation S3 URI constraints
        // Pattern disallows: \x00-\x1F (control chars), \x7F (DEL), { ^ } % ` ] " > [ ~ < # |
        // Also replace other problematic characters: & \ * ? / $ ! ' : @ + =
        // eslint-disable-next-line no-control-regex
        const problematicChars = /[\x00-\x1F\x7F{^}%`\]">[~<#|&\\*?/$!'":@+=]/g;
        sanitized = sanitized.replace(problematicChars, '_');
        // Replace multiple consecutive underscores with a single one
        while (sanitized.includes('__')) {
          sanitized = sanitized.replace(/__/g, '_');
        }
        // Remove leading/trailing underscores
        sanitized = sanitized.replace(/^_+|_+$/g, '');
        return sanitized;
      };
      objectKey = `remediated/final_${sanitizeForS3(file_name.replace('.pdf', '.zip'))}`;
    } else {
      // PDF format uses original filename without extra sanitization
      objectKey = `result/COMPLIANT_${file_name}`;
    }

    return objectKey;
  }, [selectedFormat]);

  useEffect(() => {
    intervalsRef.current = { poll: null, time: null, step: null };
    
    const stopPolling = () => {
      clearInterval(intervalsRef.current.poll);
      clearInterval(intervalsRef.current.time);
      clearInterval(intervalsRef.current.step);
    }

    const checkFileAvailability = async () => {
      // Maximum polling time: 15 minutes (60 attempts * 15 seconds = 15 minutes)
      const MAX_POLLING_ATTEMPTS = 60;

      // Increment polling attempts
      setPollingAttempts(prev => {
        const newAttempts = prev + 1;

        // Stop polling after maximum attempts
        if (newAttempts >= MAX_POLLING_ATTEMPTS) {
          console.warn('⚠️ Maximum polling attempts reached. Stopping file check.');
          setErrorMessage('Processing is taking longer than expected. Please try again.')
          stopPolling();
          return newAttempts;
        }
        return newAttempts;
      });

      // Select the correct bucket based on format (same logic as UploadSection)
      const selectedBucket = selectedFormat === 'html' ? HTMLBucket : PDFBucket;

      // Check if Bucket is available
      if (!selectedBucket) {
        console.error('Bucket configuration error.')
        setErrorMessage('Something went wrong, please try again. Contact support if this error persists.')
        stopPolling();
        return;
      }

      try {
        const results = await Promise.all(
          pendingFiles.map(async ({ originalName, updatedName }) => {
            const objectKey = getObjectKey(updatedName);
            const params = new URLSearchParams({ key: objectKey, bucket: selectedBucket });
            const data = await apiFetch(`/file-status?${params.toString()}`, {
              method: 'GET',
            });
            return { updatedName, originalName, objectKey, ready: data.ready };
          })
        );

        const readyFiles = results.filter(r => r.ready);
        const stillPending = results.filter(r => !r.ready).map(({ updatedName, originalName }) => ({ originalName, updatedName }));

        const newEntries = [];
        for (const { originalName, objectKey } of readyFiles) {
          const url = await downloadFile(objectKey, selectedBucket, true);
          newEntries.push({ originalName, objectKey: objectKey.split('/').pop(), downloadUrl: url });
        }

        if (!processedFiles) setProcessedFiles(newEntries)
        else setProcessedFiles((prev) => [...prev, ...newEntries]);
        setPendingFiles(stillPending);

        if (stillPending.length === 0) {
          setIsDoneProcessing(true);
          setCurrentStep(PROCESSING_STEPS.length - 1); // Set to final step
          // onFileReady(url, objectKey.split('/').pop());
          onAllFilesReady([...( processedFiles ?? []), ...( newEntries ?? [] )]);

          // Clear all intervals on success
          stopPolling();

          console.log('✅ File processing completed successfully!');
        } else {
          console.log(`⏳ File not ready yet (attempt ${pollingAttempts + 1}). Retrying in 15 seconds...`);
        }
      } catch (error) {
        stopPolling();
        console.error('Error during file polling:', error);
        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage('Something went wrong while processing your files. Please try again.');
        }
      }
    };

    if (pendingFiles.length > 0 && !isDoneProcessing) {
      // Reset polling attempts for new file
      setPollingAttempts(0);

      // Start time tracking
      intervalsRef.current.time = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);

      // Microanimation: cycling through steps with cumulative highlighting
      intervalsRef.current.step = setInterval(() => {
        setCurrentStep(prev => (prev + 1) % PROCESSING_STEPS.length);
      }, 1200);

      // File checking with maximum retry limit
      intervalsRef.current.poll = setInterval(checkFileAvailability, 15000);
    }

    return () => stopPolling();
  }, [pendingFiles, setPendingFiles, isDoneProcessing, onAllFilesReady, apiFetch, downloadFile, selectedFormat, getObjectKey, processedFiles, pollingAttempts]);

  return (
    <div className="processing-container">
      <div className="processing-content">
        <div className="processing-header">
          <div className="header-content">
            {/* <h2>{isDoneProcessing ? `File Ready: ${truncateFilename(originalFileName)}` : `Processing: ${truncateFilename(originalFileName)}`}</h2> */}
            <h2>{isDoneProcessing ? 'Processing Complete' : 'Processing'}</h2>
            <div className="flow-indicator">
              {selectedFormat === 'html' ? 'PDF → HTML' : 'PDF → PDF'}
            </div>
          </div>
        </div>

        <div className="processing-info">
          <div className="time-info">
            <span>⏱️ Time elapsed: {formatElapsedTime(elapsedTime)}</span>
          </div>
          <p className="processing-description">
            {isDoneProcessing
              ? 'Remediation complete! Your file is ready for download.'
              : 'Remediation process typically takes a few minutes to complete depending on the document complexity'
            }
          </p>
        </div>

        {!isDoneProcessing && (
          <div className="progress-section">
            <div className="steps-list">
              {PROCESSING_STEPS.map((step, index) => (
                <div key={index} className="step-item">
                  <div className={`step-number ${index <= currentStep ? 'active' : ''}`}>
                    {index + 1}
                  </div>
                  <div className="step-content">
                    <div className="step-title">{step.title}</div>
                    <div className="step-description">{step.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {errorMessage && (
          <div className='processing-error'>
            <p>{errorMessage}</p>
            <button className="upload-new-btn" onClick={() => {
              setErrorMessage('');
              onNewUpload();
            }}>
              Back
            </button>
          </div>
        )}
      </div>


    </div>
  );
};

export default ProcessingContainer;
