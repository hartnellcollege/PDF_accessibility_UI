import React, { useState } from 'react';
import JSZip from 'jszip';
import './ResultsContainer.css';
import img1 from "../assets/zap.svg";
import img2 from "../assets/pdf-icon.svg";
import AccessibilityChecker from './AccessibilityChecker';
import { ApiError, defaultMessageForStatus, errorCodeForStatus } from '../utilities/apiError';

/**
 *
 * @param {{
 *  processedFiles: { originalName: string, objectKey: string, downloadUrl: string }[],
 *  format: string,
 *  processingTime: number,
 *  originalFileName: string | null,
 *  updatedFilename: string | null,
 *  onNewUpload: () => void,
 * }}
 * @returns
 */
const ResultsContainer = ({
  // fileName,
  processedFiles,
  format,
  processingTime,
  originalFileName,
  updatedFilename,
  // resultFilename,
  onNewUpload
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Function to format processing time
  const formatProcessingTime = (seconds) => {
    if (!seconds || seconds < 0) return 'Processing completed';

    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;

    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const handleDownload = async () => {
    if (!processedFiles || !format) {
      alert('Download information not available');
      return;
    }

    setIsDownloading(true);
    try {
      // Single file upload
      if (originalFileName) {
        const { originalName, objectKey, downloadUrl } = processedFiles[0];
        if (!downloadUrl) {
          throw new Error('No download URL received');
        }
        const downloadName = objectKey.endsWith('.zip') ? objectKey : originalName;

        const res = await fetch(downloadUrl);

        if (!res.ok) {
          throw new ApiError(defaultMessageForStatus(res.status), errorCodeForStatus(res.status), res.status);
        }

        const blob = await res.blob();

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = downloadName;
        a.click();
  
        console.log('Download initiated successfully');
        URL.revokeObjectURL(url);
        return;
      }

      // Bulk upload to zip files
      const zip = new JSZip();

      const failedFiles = [];
      await Promise.all(
        processedFiles.map(async ({ originalName, objectKey, downloadUrl }) => {
          try {
            const downloadName = objectKey.endsWith('.zip') ? objectKey : originalName;
            const res = await fetch(downloadUrl);
            if (!res.ok) throw new ApiError(`HTTP ${res.status}`, errorCodeForStatus(res.status), res.status);
            const blob = await res.blob();
            zip.file(downloadName, blob);
          } catch (error) {
            console.error(`Failed to download ${originalName}:`, error);
            failedFiles.push({ name: originalName, status: error instanceof ApiError ? error.status : null });
          }
        })
      )

      // Some files failed, but some succeeded
      if (failedFiles.length > 0 && failedFiles.length < processedFiles.length) {
        setErrorMessage(`Some files could not be downloaded: ${failedFiles.join(', ')}\nPlease re-upload those files and try again.`);
      } else if (failedFiles.length === processedFiles.length) {
        const allTimedOut = failedFiles.every(f => f.status === 403);
        throw new ApiError(
          'File downloads failed. Please try again.',
          'DOWNLOAD_ERROR',
          allTimedOut ? 403 : null
        );
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'remediated_files.zip';
      a.click();

      console.log('Download initiated successfully');
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      if (error instanceof ApiError) {
        setErrorMessage(
          error.status === 403
          ? 'Access denied for file download.\nYour download request may have timed out, please re-upload your files and try again.'
          : error.message
        );
      } else {
        // Provide more specific error messages
        let message = 'Download failed. Please try again.';
        if (error.message.includes('File not found')) {
          message = 'File not ready yet. Please wait for processing to complete.';
        } else if (error.message.includes('Access denied')) {
          message = 'Access denied. Please check permissions or contact support.';
        } else if (error.message.includes('credentials')) {
          message = 'Authentication error. Please refresh the page and try again.';
        }

        setErrorMessage(message);
      }
    } finally {
      setIsDownloading(false);
    }
  };


  return (
    <>
      <div className="results-container">
        <div className="results-content">
          <div className="results-header">
            <h2>PDF Remediation Successful</h2>
            <div className="flow-indicator">
              {format === 'html' ? 'PDF → HTML' : 'PDF → PDF'}
            </div>
          </div>

          <div className="processing-info">
            <div className="processing-time">
              <img alt="" className="block max-w-none size-full" src={img1} />
              <span>Total Processing Time: {formatProcessingTime(processingTime)}</span>
            </div>
            <p className="description">{`Your PDF${originalFileName ? '' : 's'} ha${originalFileName ? 's' : 've'} been successfully remediated for accessibility`}</p>
          </div>

          <div className="file-success-container">
            <div className="file-info-card">
              <div className="file-name-section">
                <div className="file-icon">
                  <img alt="" className="block max-w-none size-full" src={img2} />
                </div>
                <div className="file-details">
                  {originalFileName && (
                    <div className="file-name">{originalFileName}</div>
                  )}
                  <div className="file-status">{`File${originalFileName ? '' : 's'} processed successfully`}</div>
                </div>
              </div>
            </div>
          </div>

          {errorMessage && (
            <div className='download-error'>
              <p>{errorMessage}</p>
            </div>
          )}

          <div className="button-group">
            {(format === 'pdf' && originalFileName) && (
              <button className="view-report-btn" onClick={() => setShowReportDialog(true)}>
                View Report
              </button>
            )}
            <button
              className="download-btn"
              onClick={handleDownload}
              disabled={isDownloading || !processedFiles}
              title={isDownloading ? 'Downloading...' : 'Download the processed files'}
            >
              {isDownloading ? 'Downloading...' : `Download ${(format === 'html' || !originalFileName) ? 'ZIP' : 'PDF'} File`}
            </button>
          </div>

        </div>

      {/* Accessibility Report Dialog - Only for PDF-PDF format */}
      {(format === 'pdf' && originalFileName) && (
        <AccessibilityChecker
          // originalFileName={originalFileName || fileName}
          originalFileName={originalFileName}
          updatedFilename={updatedFilename}
          open={showReportDialog}
          onClose={() => setShowReportDialog(false)}
        />
      )}

        <div className="upload-new-section">
          <button className="upload-new-btn" onClick={() => setShowConfirmDialog(true)}>
            Upload a New PDF
          </button>
        </div>
      </div>

      {/* Custom Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="confirm-overlay" onClick={() => setShowConfirmDialog(false)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-header">
              <h3>Confirm New Upload</h3>
            </div>
            <div className="confirm-body">
              <p>Are you sure you want to upload a new PDF?</p>
              <p className="confirm-warning">This will discard the current PDF and start a new session.</p>
            </div>
            <div className="confirm-actions">
              <button
                className="confirm-btn cancel-btn"
                onClick={() => setShowConfirmDialog(false)}
              >
                Cancel
              </button>
              <button
                className="confirm-btn confirm-btn-primary"
                onClick={() => {
                  setShowConfirmDialog(false);
                  onNewUpload();
                }}
              >
                Yes, Upload New PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ResultsContainer;
