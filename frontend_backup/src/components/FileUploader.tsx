import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';

interface FileUploaderProps {
  onUploadStatus: (status: { uploading: boolean, success: boolean, error: string | null }) => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onUploadStatus }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setFiles(acceptedFiles);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/markdown': ['.md'],
      'text/plain': ['.txt']
    },
    maxFiles: 1
  });

  const handleUpload = async () => {
    if (files.length === 0) return;

    const formData = new FormData();
    formData.append('file', files[0]);

    try {
      setUploading(true);
      onUploadStatus({ uploading: true, success: false, error: null });
      setUploadProgress(0);

      const response = await axios.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(progress);
          }
        }
      });

      console.log('Upload successful:', response.data);
      setFiles([]);
      onUploadStatus({ uploading: false, success: true, error: null });
      
      // Resetar o progresso após um tempo
      setTimeout(() => {
        setUploadProgress(0);
      }, 3000);
    } catch (error) {
      console.error('Error uploading file:', error);
      onUploadStatus({ 
        uploading: false, 
        success: false, 
        error: 'Falha ao fazer upload dos arquivos. Por favor, tente novamente.' 
      });
      
      // Resetar o progresso após um tempo
      setTimeout(() => {
        setUploadProgress(0);
      }, 3000);
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (size: number) => {
    if (size < 1024) return size + ' bytes';
    else if (size < 1024 * 1024) return (size / 1024).toFixed(2) + ' KB';
    else return (size / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div className="file-uploader">
      <h2 className="uploader-title">Carregar Documento</h2>
      <div {...getRootProps()} className={`dropzone ${isDragActive ? 'dropzone-active' : ''}`}>
        <input {...getInputProps()} />
        <div className="dropzone-content">
          <div className="dropzone-icon">📄</div>
          <p className="dropzone-text">
            {isDragActive
              ? 'Solte o arquivo aqui...'
              : 'Arraste e solte um arquivo aqui, ou clique para selecionar'}
          </p>
          <p className="dropzone-subtext">
            Formatos suportados: PDF, Markdown e TXT
          </p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="file-list">
          {files.map((file, index) => (
            <div key={index} className="file-item">
              <div className="file-name">{file.name}</div>
              <div className="file-size">{formatFileSize(file.size)}</div>
            </div>
          ))}
          <button
            className="upload-btn"
            onClick={handleUpload}
            disabled={uploading}
          >
            {uploading ? 'Enviando...' : 'Enviar Documento'}
          </button>
        </div>
      )}
      
      {uploadProgress > 0 && uploadProgress < 100 && (
        <div className="upload-progress-container">
          <div 
            className="upload-progress-bar" 
            style={{ width: `${uploadProgress}%` }}
          ></div>
          <span className="upload-progress-text">{uploadProgress}%</span>
        </div>
      )}
    </div>
  );
};

export default FileUploader;
