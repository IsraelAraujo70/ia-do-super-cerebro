# IA do Super Cérebro

Sistema de processamento de documentos (PDF, MD, TXT) com chat baseado em IA para responder perguntas sobre o conteúdo.

## Funcionalidades

- Upload de documentos PDF, Markdown e TXT
- Processamento de texto com divisão em chunks
- Criação de embeddings usando OpenAI
- Armazenamento em banco de dados vetorial FAISS
- Chat em tempo real via WebSocket
- Interface web moderna em React/TypeScript
- Completamente dockerizado
- Atualização automática do código durante desenvolvimento

## Estrutura do Projeto

```
ia-do-super-cerebro/
├── backend/                # API Python (FastAPI)
│   ├── app.py              # Aplicação principal
│   ├── requirements.txt    # Dependências Python
│   ├── Dockerfile          # Configuração Docker para backend
│   └── .env                # Variáveis de ambiente (OpenAI API Key)
├── frontend/               # Interface React/TypeScript
│   ├── src/                # Código fonte React
│   ├── Dockerfile          # Configuração Docker para frontend
│   └── nginx.conf          # Configuração do Nginx
└── docker-compose.yml      # Orquestração dos serviços
```

## Requisitos

- Docker e Docker Compose
- Chave de API da OpenAI

## Configuração

1. Clone o repositório:
   ```
   git clone <url-do-repositorio>
   cd ia-do-super-cerebro
   ```

2. Configure a chave da API da OpenAI:
   Edite o arquivo `backend/.env` e adicione sua chave da API OpenAI:
   ```
   OPENAI_API_KEY=sua_chave_da_api_aqui
   ```

## Execução

### Usando Docker (Recomendado)

Para iniciar o sistema completo usando Docker:

```bash
# Construir as imagens
docker build -t super-cerebro-backend ./backend
docker build -t super-cerebro-frontend ./frontend

# Iniciar o backend
docker run -d --name super-cerebro-backend \
  -p 8000:8000 \
  -v $(pwd)/backend:/app \
  -v faiss_data:/app/faiss_index \
  --env-file ./backend/.env \
  super-cerebro-backend

# Iniciar o frontend
docker run -d --name super-cerebro-frontend \
  -p 80:80 \
  --link super-cerebro-backend:backend \
  super-cerebro-frontend
```

O sistema estará disponível em:
- Frontend: http://localhost
- Backend API: http://localhost:8000
- Documentação da API: http://localhost:8000/docs

### Desenvolvimento com Hot Reload

Para desenvolvimento com atualização automática do código:

#### Backend

```bash
# Iniciar o backend com hot reload
docker run -d --name super-cerebro-backend-dev \
  -p 8000:8000 \
  -v $(pwd)/backend:/app \
  -v faiss_data:/app/faiss_index \
  --env-file ./backend/.env \
  super-cerebro-backend \
  uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

#### Frontend

```bash
# Iniciar o frontend em modo de desenvolvimento
cd frontend
npm install
npm start
```

Isso iniciará o servidor de desenvolvimento React na porta 3000 com hot reload.
Para se conectar ao backend, você precisará atualizar as URLs de API no frontend para apontar para `http://localhost:8000`.

## Uso

1. Acesse a interface web em http://localhost
2. Faça upload de um documento (PDF, MD ou TXT)
3. Após o processamento, faça perguntas sobre o conteúdo do documento
4. O sistema encontrará as partes mais relevantes do documento e gerará respostas baseadas nesse contexto

## Desenvolvimento

### Backend (Python/FastAPI)

O código do backend está montado como um volume no container Docker, então qualquer alteração nos arquivos será automaticamente detectada e o servidor será reiniciado graças à flag `--reload` do Uvicorn.

Para executar o backend manualmente (sem Docker):

```bash
cd backend
pip install -r requirements.txt
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

### Frontend (React/TypeScript)

Para desenvolvimento do frontend, é recomendado executá-lo fora do Docker usando o servidor de desenvolvimento do React:

```bash
cd frontend
npm install
npm start
```

Isso iniciará o servidor de desenvolvimento na porta 3000 com hot reload.

### Reconstruindo os containers

Se você fizer alterações nos Dockerfiles ou no requirements.txt, será necessário reconstruir as imagens:

```bash
# Parar e remover os containers existentes
docker stop super-cerebro-backend super-cerebro-frontend
docker rm super-cerebro-backend super-cerebro-frontend

# Reconstruir as imagens
docker build -t super-cerebro-backend ./backend
docker build -t super-cerebro-frontend ./frontend

# Reiniciar os containers
# (use os mesmos comandos de execução mencionados acima)
```

## Solução de Problemas

### O backend não inicia

Verifique se a chave da API OpenAI está configurada corretamente no arquivo `.env`.

### Erro ao carregar o banco de dados vetorial

Se você estiver recebendo erros relacionados ao FAISS, pode ser necessário limpar o volume:

```bash
docker volume rm faiss_data
```

### Problemas de conexão entre frontend e backend

Verifique se o container do backend está em execução e se o link entre os containers está configurado corretamente.

## Tecnologias Utilizadas

- **Backend**:
  - Python 3.9
  - FastAPI
  - WebSockets
  - Langchain
  - OpenAI API
  - FAISS (Facebook AI Similarity Search)
  - PDFPlumber

- **Frontend**:
  - React
  - TypeScript
  - WebSocket client

- **Infraestrutura**:
  - Docker
  - Nginx
