import React, { useState, useEffect } from 'react';
import './App.css';
import FileUploader from './components/FileUploader';
import ChatInterface from './components/ChatInterface';
import DocumentList from './components/DocumentList';

function App() {
  const [messages, setMessages] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

  // Resetar mensagens de status após alguns segundos
  useEffect(() => {
    if (uploadSuccess || uploadError) {
      const timer = setTimeout(() => {
        setUploadSuccess(false);
        setUploadError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [uploadSuccess, uploadError]);

  const handleUploadStatus = (status: { uploading: boolean, success: boolean, error: string | null }) => {
    setIsUploading(status.uploading);
    setUploadSuccess(status.success);
    setUploadError(status.error);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>IA do Super Cérebro</h1>
        <p className="app-subtitle">Seu assistente de IA para consulta de documentos</p>
      </header>
      
      <main className="app-main">
        <div className="app-sidebar">
          <FileUploader onUploadStatus={handleUploadStatus} />
          <DocumentList 
            selectedFiles={selectedFiles} 
            setSelectedFiles={setSelectedFiles} 
          />
        </div>
        
        <div className="app-content">
          <ChatInterface 
            messages={messages}
            setMessages={setMessages}
            selectedFiles={selectedFiles}
            isUploading={isUploading}
            uploadSuccess={uploadSuccess}
            uploadError={uploadError}
          />
        </div>
      </main>
      
      <footer className="app-footer">
        &copy; {new Date().getFullYear()} IA do Super Cérebro - Todos os direitos reservados
      </footer>
    </div>
  );
}

export default App;
