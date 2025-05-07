import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Document {
  filename: string;
  upload_time: string;
  file_path: string;
  size: number;
}

interface DocumentListProps {
  selectedFiles: string[];
  setSelectedFiles: (files: string[]) => void;
}

const DocumentList: React.FC<DocumentListProps> = ({ selectedFiles, setSelectedFiles }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectAll, setSelectAll] = useState(false);

  // Função para atualizar a lista de documentos
  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/documents');
      console.log('Documents response:', response.data);
      setDocuments(response.data);
      setError(null);
    } catch (err) {
      console.error('Erro ao buscar documentos:', err);
      setError('Não foi possível carregar os documentos. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
    
    // Configurar um intervalo para atualizar a lista a cada 5 segundos
    const intervalId = setInterval(() => {
      fetchDocuments();
    }, 5000);
    
    // Limpar o intervalo quando o componente for desmontado
    return () => clearInterval(intervalId);
  }, []);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setSelectAll(checked);
    
    if (checked) {
      // Selecionar todos os documentos
      setSelectedFiles(documents.map(doc => doc.file_path));
    } else {
      // Desmarcar todos
      setSelectedFiles([]);
    }
  };


  useEffect(() => {
    // Atualizar o estado de "selecionar todos" com base na seleção atual
    if (documents.length > 0 && selectedFiles.length === documents.length) {
      setSelectAll(true);
    } else {
      setSelectAll(false);
    }
  }, [selectedFiles, documents]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="documents-container">
      <h2 className="documents-title">Documentos Carregados</h2>
      
      {loading && documents.length === 0 ? (
        <div className="loading-indicator">Carregando documentos...</div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : documents.length === 0 ? (
        <div className="no-documents">Nenhum documento carregado ainda.</div>
      ) : (
        <>
          <div className="documents-actions">
            <div className="select-all-container">
              <label className="select-all-label">
                <input 
                  type="checkbox" 
                  className="select-all-checkbox"
                  checked={selectAll}
                  onChange={handleSelectAll}
                />
                Desmarcar/Selecionar todos
              </label>
            </div>
            <div className="selection-info">
              {selectedFiles.length === 0 ? (
                <span className="no-selection-text">Nenhum documento selecionado</span>
              ) : (
                <span className="selection-text">{selectedFiles.length} documento(s) selecionado(s)</span>
              )}
            </div>
          </div>
          
          <div className="documents-list">
            <div className="document-header">
              <div className="document-select"></div>
              <div>Nome</div>
              <div>Data de Upload</div>
              <div>Tamanho</div>
            </div>
            
            <div className="document-items-container">
              {documents.map((doc) => (
                <div 
                  key={doc.file_path} 
                  className={`document-item ${selectedFiles.includes(doc.file_path) ? 'document-selected' : ''}`}
                  onClick={() => {
                    // Toggle selection on click
                    const isSelected = selectedFiles.includes(doc.file_path);
                    let newSelectedFiles;
                    
                    if (isSelected) {
                      // If already selected, remove from selection
                      newSelectedFiles = selectedFiles.filter(file => file !== doc.file_path);
                    } else {
                      // If not selected, add to selection
                      newSelectedFiles = [...selectedFiles, doc.file_path];
                    }
                    
                    setSelectedFiles(newSelectedFiles);
                    console.log('Selected files after click:', newSelectedFiles);
                  }}
                >
                  <div className="document-select">
                    <input 
                      type="checkbox" 
                      checked={selectedFiles.includes(doc.file_path)}
                      onChange={() => {}} // Handled by parent div click
                      onClick={(e) => {
                        e.stopPropagation();
                        const isSelected = selectedFiles.includes(doc.file_path);
                        let newSelectedFiles;
                        
                        if (isSelected) {
                          // If already selected, remove from selection
                          newSelectedFiles = selectedFiles.filter(file => file !== doc.file_path);
                        } else {
                          // If not selected, add to selection
                          newSelectedFiles = [...selectedFiles, doc.file_path];
                        }
                        
                        setSelectedFiles(newSelectedFiles);
                        console.log('Selected files after checkbox click:', newSelectedFiles);
                      }}
                    />
                  </div>
                  <div className="document-name">
                    <span className="document-icon">
                      {doc.filename.endsWith('.pdf') ? '📄' : 
                       doc.filename.endsWith('.md') ? '📝' : 
                       doc.filename.endsWith('.txt') ? '📃' : '📑'}
                    </span>
                    {doc.filename}
                  </div>
                  <div className="document-date">{doc.upload_time}</div>
                  <div className="document-size">{formatFileSize(doc.size)}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DocumentList;
