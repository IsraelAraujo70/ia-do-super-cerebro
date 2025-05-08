import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

// Função para formatar o texto com suporte a Markdown e código
const formatText = (text: string): string => {
  // Substituir quebras de linha por <br>
  text = text.replace(/\n/g, '<br>');
  
  // Formatar blocos de código
  text = text.replace(/```([\s\S]*?)```/g, (match, code) => {
    return `<pre class="code-block"><code>${code.trim()}</code></pre>`;
  });
  
  // Formatar código inline
  text = text.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
  
  // Formatar negrito
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // Formatar itálico
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  
  // Formatar links
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  
  return text;
};

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp?: Date;  // Tornando timestamp opcional
}

interface Source {
  content: string;
  metadata?: any;
}

interface ChatInterfaceProps {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  isUploading?: boolean;
  uploadSuccess?: boolean;
  uploadError?: string | null;
  selectedFiles: string[];
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  messages, 
  setMessages, 
  isUploading, 
  uploadSuccess, 
  uploadError,
  selectedFiles 
}) => {
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Conectar ao WebSocket quando o componente montar
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Use a URL da API em produção ou localhost em desenvolvimento
    const wsHost = process.env.NODE_ENV === 'production' 
      ? 'ia-super-cerebro-api.onrender.com'
      : window.location.host;
    const wsUrl = `${wsProtocol}//${wsHost}/ws/chat`;
    console.log('Connecting to WebSocket:', wsUrl);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket conectado');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Received message:', data);

        if (data.error) {
          const errorMessage: Message = {
            id: uuidv4(),
            content: `Erro: ${data.error}`,
            role: 'assistant'
          };
          setMessages(prev => [...prev, errorMessage]);
          setIsLoading(false);
        } else if (data.answer) {
          const newMessage: Message = {
            id: uuidv4(),
            content: data.answer,
            role: 'assistant'
          };
          setMessages(prev => [...prev, newMessage]);
          
          if (data.sources) {
            setSources(data.sources);
          }
          
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket desconectado');
    };

    setSocket(ws);

    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [setMessages]);

  // Rolar para o final das mensagens quando uma nova mensagem é adicionada
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (!input.trim() || isLoading) return;
    
    if (socket && socket.readyState === WebSocket.OPEN) {
      // Adicionar mensagem do usuário
      const userMessage: Message = {
        id: uuidv4(),
        content: input,
        role: 'user'
      };
      
      setMessages(prev => [...prev, userMessage]);
      
      // Preparar dados para enviar, incluindo arquivos selecionados
      const messageData = {
        question: input,
        top_k: 5,
        file_paths: selectedFiles.length > 0 ? selectedFiles : []
      };
      
      console.log('Sending message data:', messageData);
      
      // Enviar mensagem para o servidor via WebSocket
      socket.send(JSON.stringify(messageData));
      
      // Limpar input e mostrar indicador de carregamento
      setInput('');
      setIsLoading(true);
      setSources([]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        Chat com IA do Super Cérebro
        {selectedFiles.length > 0 && (
          <span className="chat-filter-info">
            ({selectedFiles.length} documento(s) selecionado(s))
          </span>
        )}
      </div>
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-welcome">
            <h3>Bem-vindo ao IA do Super Cérebro!</h3>
            <p>
              Faça perguntas sobre os documentos carregados e receba respostas baseadas no conteúdo.
              {selectedFiles.length > 0 ? (
                <span> Você está conversando com {selectedFiles.length} documento(s) selecionado(s).</span>
              ) : (
                <span> Você está conversando com todos os documentos disponíveis.</span>
              )}
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div 
              key={message.id}
              className={`message ${message.role === 'user' ? 'message-user' : 'message-assistant'}`}
              dangerouslySetInnerHTML={{ __html: message.role === 'assistant' ? formatText(message.content) : message.content }}
            />
          ))
        )}
        {isLoading && (
          <div className="message message-assistant typing-message">
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input-container">
        <input
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Digite sua pergunta..."
          disabled={isLoading}
        />
        <button
          className="chat-button"
          onClick={handleSendMessage}
          disabled={!input.trim() || isLoading}
        >
          Enviar
        </button>
      </div>
      {sources.length > 0 && (
        <div className="sources-container">
          <h3 className="sources-title">Fontes de Informação</h3>
          <div className="sources-list">
            {sources.map((source, index) => (
              <div key={index} className="source-item">
                <div className="source-title">Fonte {index + 1}</div>
                <div 
                  className="source-content"
                  dangerouslySetInnerHTML={{ __html: formatText(source.content) }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatInterface;
