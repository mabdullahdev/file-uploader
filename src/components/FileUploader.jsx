import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Page,
  Card,
  DropZone,
  Box,
  InlineStack,
  BlockStack,
  Text,
  ProgressBar,
  Banner,
  Button,
  Icon,
  Spinner,
  Badge
} from '@shopify/polaris';
import { XSmallIcon, AlertCircleIcon, ImageIcon, FileIcon } from '@shopify/polaris-icons';

// Mock API function to simulate file upload - replace with actual API in production
const uploadFile = (file) => {
  return new Promise((resolve, reject) => {
    // Simulate a network request with random duration between 2-5 seconds
    const uploadTime = Math.random() * 3000 + 2000;
    
    // Simulate occasional failure (10% chance)
    const willFail = Math.random() < 0.1;
    
    setTimeout(() => {
      if (willFail) {
        reject(new Error('Upload failed'));
      } else {
        resolve({ success: true, fileId: Math.random().toString(36).substring(2, 15) });
      }
    }, uploadTime);
  });
};

// File statuses
const STATUS = {
  PENDING: 'pending',
  UPLOADING: 'uploading',
  COMPLETE: 'complete',
  ERROR: 'error'
};

export default function FileUploader() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const activeUploadsRef = useRef(0);
  const MAX_CONCURRENT_UPLOADS = 3;
  
  // Helper to start uploading a file
  const startUpload = (file) => {
    // Start simulated upload with progress updates
    const startTime = Date.now();
    const estimatedTime = Math.random() * 2000 + 1000; // 1-3 seconds
    const simulateProgress = setInterval(() => {
      setFiles(currentFiles => {
        const updatedFiles = [...currentFiles];
        const fileIndex = updatedFiles.findIndex(f => f.id === file.id);
        if (fileIndex !== -1 && updatedFiles[fileIndex].status === STATUS.UPLOADING) {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(95, Math.floor((elapsed / estimatedTime) * 100));
          updatedFiles[fileIndex] = {
            ...updatedFiles[fileIndex],
            progress
          };
        } else {
          clearInterval(simulateProgress);
        }
        return updatedFiles;
      });
    }, 300);

    uploadFile(file.file)
      .then(() => {
        clearInterval(simulateProgress);
        setFiles(currentFiles => {
          const updatedFiles = [...currentFiles];
          const fileIndex = updatedFiles.findIndex(f => f.id === file.id);
          if (fileIndex !== -1) {
            updatedFiles[fileIndex] = {
              ...updatedFiles[fileIndex],
              status: STATUS.COMPLETE,
              progress: 100
            };
          }
          return updatedFiles;
        });
        activeUploadsRef.current--;
      })
      .catch(() => {
        clearInterval(simulateProgress);
        setFiles(currentFiles => {
          const updatedFiles = [...currentFiles];
          const fileIndex = updatedFiles.findIndex(f => f.id === file.id);
          if (fileIndex !== -1) {
            updatedFiles[fileIndex] = {
              ...updatedFiles[fileIndex],
              status: STATUS.ERROR,
              progress: 0
            };
          }
          return updatedFiles;
        });
        activeUploadsRef.current--;
      });
  };

  // Upload queue effect
  useEffect(() => {
    // Count currently uploading
    const uploading = files.filter(f => f.status === STATUS.UPLOADING).length;
    activeUploadsRef.current = uploading;
    // Find pending files
    const pending = files.filter(f => f.status === STATUS.PENDING);
    if (pending.length > 0 && uploading < MAX_CONCURRENT_UPLOADS) {
      const slots = MAX_CONCURRENT_UPLOADS - uploading;
      const toStart = pending.slice(0, slots);
      if (toStart.length > 0) {
        setFiles(currentFiles => {
          const updatedFiles = [...currentFiles];
          toStart.forEach(file => {
            const idx = updatedFiles.findIndex(f => f.id === file.id);
            if (idx !== -1) {
              updatedFiles[idx] = {
                ...updatedFiles[idx],
                status: STATUS.UPLOADING,
                progress: 0
              };
            }
          });
          return updatedFiles;
        });
        // Start upload for each
        toStart.forEach(file => {
          startUpload(file);
        });
      }
    }
  }, [files]);
  
  // Handle file drop
  const handleDrop = useCallback((droppedFiles) => {
    setIsDragging(false);
    // Create file objects with status
    const newFiles = droppedFiles.map(file => ({
      file,
      name: file.name,
      size: formatFileSize(file.size),
      type: getFileType(file),
      extension: getFileExtension(file.name),
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    }));
    setSelectedFiles(newFiles);
    setError('');
  }, []);
  
  // Start upload process when submit button is clicked
  const handleSubmitUpload = useCallback(() => {
    if (selectedFiles.length === 0) {
      setError('Please select files to upload.');
      return;
    }
    // Convert selected files to queued files
    const queuedFiles = selectedFiles.map(file => ({
      ...file,
      status: STATUS.PENDING,
      progress: 0
    }));
    setFiles(queuedFiles);
    setSelectedFiles([]);
  }, [selectedFiles]);
  
  // Handle files added through the file dialog
  const handleFilesAdded = useCallback((newFiles) => {
    handleDrop(newFiles);
  }, [handleDrop]);
  
  // Handle drag events
  const handleDragOver = useCallback(() => {
    setIsDragging(true);
  }, []);
  
  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  // Remove a file from selected files
  const removeSelectedFile = useCallback((fileId) => {
    setSelectedFiles(currentFiles => {
      return currentFiles.filter(file => file.id !== fileId);
    });
  }, []);
  
  // Remove a file from the uploads list
  const removeFile = useCallback((fileId) => {
    setFiles(currentFiles => {
      return currentFiles.filter(file => file.id !== fileId);
    });
  }, []);
  
  // Retry failed uploads
  const retryUpload = useCallback((fileId) => {
    setFiles(currentFiles => {
      const updatedFiles = [...currentFiles];
      const fileIndex = updatedFiles.findIndex(f => f.id === fileId);
      if (fileIndex !== -1) {
        updatedFiles[fileIndex] = {
          ...updatedFiles[fileIndex],
          status: STATUS.PENDING,
          progress: 0
        };
      }
      return updatedFiles;
    });
  }, []);
  
  // Helper functions for file information
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  const getFileExtension = (filename) => {
    return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
  };
  
  const getFileType = (file) => {
    if (file.type.startsWith('image/')) return 'Image';
    if (file.type.startsWith('video/')) return 'Video';
    if (file.type.startsWith('audio/')) return 'Audio';
    if (file.type.startsWith('application/pdf')) return 'PDF';
    if (file.type.includes('document') || file.name.endsWith('.doc') || file.name.endsWith('.docx')) return 'Document';
    if (file.type.includes('spreadsheet') || file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) return 'Spreadsheet';
    if (file.type.includes('presentation') || file.name.endsWith('.ppt') || file.name.endsWith('.pptx')) return 'Presentation';
    return 'Other';
  };
  
  // Calculate upload stats
  const pendingCount = files.filter(file => file.status === STATUS.PENDING).length;
  const uploadingCount = files.filter(file => file.status === STATUS.UPLOADING).length;
  const completeCount = files.filter(file => file.status === STATUS.COMPLETE).length;
  const errorCount = files.filter(file => file.status === STATUS.ERROR).length;
  const totalCount = files.length;
  
  // Get the appropriate file icon based on file type
  const getFileIcon = (fileType) => {
    if (fileType === 'Image') {
      return ImageIcon;
    }
    return FileIcon;
  };
  
  // Get status badge for each file
  const getStatusBadge = (status) => {
    switch (status) {
      case STATUS.UPLOADING:
        return <Badge progress="incomplete">Uploading</Badge>;
      case STATUS.COMPLETE:
        return <Badge status="success">Complete</Badge>;
      case STATUS.ERROR:
        return <Badge status="critical">Failed</Badge>;
      case STATUS.PENDING:
        return <Badge>Queued</Badge>;
      default:
        return null;
    }
  };
  
  return (
    <Page title="Shopify File Uploader">
      {(files.length > 0) && (
        <Banner title="File Upload Status" status="info">
          <p>
            {completeCount} complete • {uploadingCount} uploading • {pendingCount} queued • {errorCount} failed • {totalCount} total
          </p>
        </Banner>
      )}
      
      <Box paddingBlockEnd="4">
        <Card>
          <DropZone
            accept="image/*, application/pdf, .doc, .docx, .xls, .xlsx, .ppt, .pptx, .txt"
            type="file"
            openFileDialog={false}
            onDrop={handleFilesAdded}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            allowMultiple
            overlayText="Drop files to upload"
            active={isDragging}
          >
            <DropZone.FileUpload
              actionTitle="Add files"
              actionHint={`Select files to upload`}
            />
          </DropZone>
          
          {error && (
            <Box padding="4">
              <Banner
                title={error}
                status="critical"
                onDismiss={() => setError('')}
              />
            </Box>
          )}
        </Card>
      </Box>
      
      {selectedFiles.length > 0 && (
        <Box paddingBlockEnd="4">
          <Card>
            <Box padding="4">
              <Text variant="headingMd" as="h2">Selected Files</Text>
              <Text variant="bodySm" as="p" color="subdued">Review your selected files before uploading</Text>
              
              <Box paddingBlockStart="4">
                <BlockStack gap="2">
                  {selectedFiles.map((file) => (
                    <Card key={file.id}>
                      <Box padding="4">
                        <InlineStack alignment="center">
                          <Box paddingInlineEnd="3" paddingInlineStart="3">
                            <Icon source={getFileIcon(file.type)} color="base" />
                          </Box>
                          
                          <Box width="100%">
                            <BlockStack gap="1">
                              <Text variant="bodyMd" fontWeight="bold">{file.name}</Text>
                              
                              <InlineStack gap="2">
                                <Text variant="bodySm" color="subdued">{file.size}</Text>
                                <Text variant="bodySm" color="subdued">•</Text>
                                <Text variant="bodySm" color="subdued">{file.type}</Text>
                                <Text variant="bodySm" color="subdued">•</Text>
                                <Text variant="bodySm" color="subdued">{file.extension.toUpperCase()}</Text>
                              </InlineStack>
                            </BlockStack>
                          </Box>
                          
                          <Box>
                            <Button 
                              icon={XSmallIcon} 
                              onClick={() => removeSelectedFile(file.id)} 
                              plain
                              accessibilityLabel="Remove file"
                            />
                          </Box>
                        </InlineStack>
                      </Box>
                    </Card>
                  ))}
                </BlockStack>
              </Box>
              
              <Box paddingBlockStart="4">
                <InlineStack gap="2">
                  <Button onClick={handleSubmitUpload} primary>Upload Files</Button>
                  <Button onClick={() => setSelectedFiles([])}>Clear All</Button>
                </InlineStack>
              </Box>
            </Box>
          </Card>
        </Box>
      )}
      
      {files.length > 0 && (
        <Card>
          <Box padding="4">
            <Text variant="headingMd" as="h2">Uploads</Text>
            <BlockStack gap="2">
              {files.map((file) => (
                <Card key={file.id}>
                  <Box padding="4">
                    <InlineStack alignment="center">
                      <Box paddingInlineEnd="3" paddingInlineStart="3">
                        <Icon source={getFileIcon(file.type)} color="base" />
                      </Box>
                      
                      <Box width="100%">
                        <BlockStack gap="1">
                          <InlineStack alignment="space-between">
                            <Text variant="bodyMd" fontWeight="bold">{file.name}</Text>
                            {getStatusBadge(file.status)}
                          </InlineStack>
                          
                          <InlineStack gap="2">
                            <Text variant="bodySm" color="subdued">{file.size}</Text>
                            <Text variant="bodySm" color="subdued">•</Text>
                            <Text variant="bodySm" color="subdued">{file.type}</Text>
                            <Text variant="bodySm" color="subdued">•</Text>
                            <Text variant="bodySm" color="subdued">{file.extension.toUpperCase()}</Text>
                          </InlineStack>
                          
                          {file.status === STATUS.UPLOADING && (
                            <Box paddingBlockStart="2">
                              <ProgressBar progress={file.progress} size="small" />
                            </Box>
                          )}
                          
                          {file.status === STATUS.ERROR && (
                            <InlineStack gap="1" alignment="center">
                              <Icon source={AlertCircleIcon} color="critical" />
                              <Text variant="bodySm" color="critical">Upload failed</Text>
                            </InlineStack>
                          )}
                        </BlockStack>
                      </Box>
                      
                      <Box>
                        {file.status === STATUS.UPLOADING ? (
                          <Box padding="2">
                            <Spinner size="small" />
                          </Box>
                        ) : file.status === STATUS.ERROR ? (
                          <Button onClick={() => retryUpload(file.id)} size="medium">Retry</Button>
                        ) : file.status !== STATUS.COMPLETE && (
                          <Button 
                            icon={XSmallIcon} 
                            onClick={() => removeFile(file.id)} 
                            plain
                            accessibilityLabel="Remove file"
                          />
                        )}
                      </Box>
                    </InlineStack>
                  </Box>
                </Card>
              ))}
            </BlockStack>
          </Box>
        </Card>
      )}
    </Page>
  );
}