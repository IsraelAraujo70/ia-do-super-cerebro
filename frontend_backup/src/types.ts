export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

export interface Source {
  content: string;
  metadata: {
    source: string;
    [key: string]: any;
  };
}

export interface ChatResponse {
  answer: string;
  sources: Source[];
}

export interface ChatError {
  error: string;
}
