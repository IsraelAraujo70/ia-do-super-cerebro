import os
import json
import pdfplumber
import markdown
import faiss
import numpy as np
import asyncio
import uvicorn
from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from dotenv import load_dotenv
import tiktoken
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain.vectorstores import FAISS
from langchain.docstore.document import Document
from langchain.prompts import ChatPromptTemplate
from langchain_core.messages import SystemMessage, HumanMessage
import time

# Constantes
UPLOADS_DIR = "uploads"
FAISS_INDEX_PATH = os.path.abspath("faiss_index")

# Carregar variáveis de ambiente
load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY não está definido no arquivo .env")

# Inicializar tokenizer para divisão de texto
tokenizer = tiktoken.get_encoding("cl100k_base")

# Inicializar modelo de embeddings da OpenAI
embeddings_model = OpenAIEmbeddings(
    model="text-embedding-3-small",
    openai_api_key=OPENAI_API_KEY
)

# Inicializar o cliente OpenAI para o chat
chat_model = ChatOpenAI(
    model_name="gpt-3.5-turbo",
    temperature=0.7,
    api_key=OPENAI_API_KEY
)

# Variável global para o banco de dados de vetores
vector_db = None

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

# Pydantic models for API requests and responses
class QuestionRequest(BaseModel):
    question: str
    top_k: int = 5
    file_paths: List[str] = []  # Lista de caminhos de arquivos para filtrar a consulta

class QuestionResponse(BaseModel):
    answer: str
    sources: List[Dict[str, Any]] = []

class DocumentInfo(BaseModel):
    filename: str
    upload_time: str
    file_path: str
    size: int

# Initialize FastAPI app
app = FastAPI(title="IA do Super Cérebro")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Endpoint to list uploaded documents
@app.get("/documents", response_model=List[DocumentInfo])
async def list_documents():
    """List all uploaded documents."""
    try:
        if not os.path.exists(UPLOADS_DIR):
            os.makedirs(UPLOADS_DIR, exist_ok=True)
            return []
        
        documents = []
        for filename in os.listdir(UPLOADS_DIR):
            file_path = os.path.join(UPLOADS_DIR, filename)
            if os.path.isfile(file_path):
                # Get file stats
                stats = os.stat(file_path)
                # Format upload time from filename (assuming format: timestamp_filename)
                parts = filename.split('_', 1)
                upload_time = "Desconhecido"
                original_filename = filename
                
                if len(parts) > 1 and parts[0].isdigit():
                    timestamp = int(parts[0])
                    upload_time = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(timestamp))
                    original_filename = parts[1]  # Nome original sem o timestamp
                
                # Create document info
                doc_info = DocumentInfo(
                    filename=original_filename,  # Nome original sem o timestamp
                    upload_time=upload_time,
                    file_path=file_path,
                    size=stats.st_size
                )
                documents.append(doc_info)
        
        # Sort by upload time (newest first)
        documents.sort(key=lambda x: x.upload_time, reverse=True)
        return documents
    except Exception as e:
        print(f"Error listing documents: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error listing documents: {str(e)}")


# Function to extract text from a file
def extract_text(file_path: str) -> str:
    """Extract text from a file based on its extension."""
    try:
        file_extension = os.path.splitext(file_path)[1].lower()
        
        if file_extension == '.pdf':
            # Extract text from PDF
            text = ""
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text() or ""
                    text += page_text + "\n\n"
            return text
        
        elif file_extension == '.txt':
            # Extract text from TXT
            with open(file_path, 'r', encoding='utf-8') as file:
                return file.read()
        
        elif file_extension == '.md':
            # Extract text from Markdown
            with open(file_path, 'r', encoding='utf-8') as file:
                return file.read()
        
        else:
            # Unsupported file type
            raise ValueError(f"Unsupported file type: {file_extension}")
    
    except Exception as e:
        print(f"Error extracting text from {file_path}: {str(e)}")
        import traceback
        traceback.print_exc()
        return ""

# Function to split text into chunks
def split_text(text: str, chunk_size: int = 500) -> List[Document]:
    """Split text into chunks with a maximum token count."""
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=50,
        length_function=lambda text: len(tokenizer.encode(text)),
    )
    texts = text_splitter.split_text(text)
    return [Document(page_content=t, metadata={"source": "document"}) for t in texts]

# Create a function to create a vector database
def create_vector_db(documents: List[Document]) -> FAISS:
    """Create a FAISS vector database from documents."""
    try:
        print(f"Creating vector database with {len(documents)} documents")
        db = FAISS.from_documents(documents, embeddings_model)
        return db
    except Exception as e:
        print(f"Error creating vector database: {str(e)}")
        import traceback
        traceback.print_exc()
        raise ValueError(f"Error creating vector database: {str(e)}")

# Function to save the vector database
def save_vector_db(db: FAISS) -> None:
    """Save the vector database to disk."""
    try:
        # Ensure the directory exists
        os.makedirs(FAISS_INDEX_PATH, exist_ok=True)
        
        # Save the vector database
        db.save_local(FAISS_INDEX_PATH)
        print(f"Vector database saved to {FAISS_INDEX_PATH}")
    except Exception as e:
        print(f"Error saving vector database: {str(e)}")
        import traceback
        traceback.print_exc()
        raise ValueError(f"Error saving vector database: {str(e)}")

# Function to load the vector database
def load_vector_db() -> Optional[FAISS]:
    """Load the vector database from disk."""
    try:
        # Check if the index file exists
        if not os.path.exists(os.path.join(FAISS_INDEX_PATH, "index.faiss")):
            print(f"Vector database file not found at {FAISS_INDEX_PATH}")
            return None
        
        # Load the vector database
        db = FAISS.load_local(FAISS_INDEX_PATH, embeddings_model)
        
        # Monkey patch the _embed_query method
        def patched_embed_query(self, text):
            return embeddings_model.embed_query(text)
        
        # Apply the monkey patch
        import types
        db._embed_query = types.MethodType(patched_embed_query, db)
        
        # Also patch the _embed_documents method
        def patched_embed_documents(self, texts):
            return [embeddings_model.embed_query(text) for text in texts]
        
        # Apply the patch
        db._embed_documents = types.MethodType(patched_embed_documents, db)
        
        print(f"Vector database loaded from {FAISS_INDEX_PATH}")
        return db
    except Exception as e:
        print(f"Error loading vector database: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

# Function to query the vector database
@app.get("/query")
async def query_vector_db(question: str, top_k: int = 5, file_paths: List[str] = []):
    """Query the vector database for relevant documents."""
    global vector_db
    
    if not vector_db:
        raise ValueError("Vector database not initialized")
    
    print(f"Querying vector database with question: '{question}'")
    print(f"Vector database type: {type(vector_db)}")
    print(f"Filtering by file paths: {file_paths}")
    print(f"Embeddings model type: {type(embeddings_model)}")
    
    try:
        print("Generating embeddings for the question...")
        # Gerar embeddings para a pergunta usando o método embed_query diretamente
        embedding = embeddings_model.embed_query(question)
        print(f"Successfully generated embeddings of length {len(embedding)}")
        
        print("Performing similarity search...")
        # Realizar a busca por similaridade
        if file_paths and len(file_paths) > 0 and file_paths[0] is not None:
            print(f"Filtering results by {len(file_paths)} file paths")
            # Primeiro, obter todos os documentos relevantes
            all_docs = vector_db.similarity_search_by_vector(embedding, k=top_k * 3)
            
            # Filtrar manualmente os documentos com base nos caminhos de arquivo
            filtered_docs = [
                doc for doc in all_docs 
                if 'source' in doc.metadata and doc.metadata['source'] in file_paths
            ]
            
            # Limitar ao número solicitado
            docs = filtered_docs[:top_k]
        else:
            # Se não houver filtros, retornar todos os documentos relevantes
            docs = vector_db.similarity_search_by_vector(embedding, k=top_k)
        
        print(f"Found {len(docs)} documents")
        return docs
    
    except Exception as e:
        print(f"Error querying vector database: {str(e)}")
        import traceback
        traceback.print_exc()
        raise ValueError(f"Error querying vector database: {str(e)}")

# Function to generate answer using OpenAI
async def generate_answer(question: str, context_docs: List[Document]) -> str:
    """Generate an answer using OpenAI based on the question and context documents."""
    # Extract context from documents
    context_text = "\n\n".join([doc.page_content for doc in context_docs])
    print(f"Context length: {len(context_text)} characters")
    
    try:
        print("Creating prompt...")
        
        # Create messages for the chat model
        system_message = SystemMessage(content="Você é um assistente de IA especializado em responder perguntas com base no contexto fornecido. Use apenas as informações do contexto para responder. Se a informação não estiver no contexto, diga que não tem informações suficientes.")
        
        user_message = HumanMessage(content=f"Contexto:\n\n{context_text}\n\nPergunta: {question}\n\nResponda usando apenas as informações do contexto acima.")
        
        messages = [system_message, user_message]
        
        # Send request to OpenAI
        print("Sending request to OpenAI...")
        response = await chat_model.agenerate([messages])
        
        print("Received response from OpenAI")
        return response.generations[0][0].text.strip()
    
    except Exception as e:
        print(f"Error generating answer: {str(e)}")
        import traceback
        traceback.print_exc()
        return f"Erro ao gerar resposta: {str(e)}"

# Function to process a document
def process_document(file_path: str, file_name: str, upload_time: str) -> List[Document]:
    """Process a document and split it into chunks."""
    print(f"Processing file: {file_path}")
    
    # Extract text from the document
    text = extract_text(file_path)
    if not text:
        raise ValueError(f"Não foi possível extrair texto do arquivo: {file_name}")
    
    print(f"Extracted text length: {len(text)} characters")
    
    # Split text into chunks
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=lambda text: len(tokenizer.encode(text)),
    )
    chunks = text_splitter.split_text(text)
    
    print(f"Split into {len(chunks)} chunks")
    
    # Create documents with metadata
    documents = []
    for i, chunk in enumerate(chunks):
        metadata = {
            "source": file_name,
            "chunk": i,
            "filename": file_name,
            "upload_time": upload_time,
            "file_path": file_path
        }
        documents.append(Document(page_content=chunk, metadata=metadata))
    
    return documents

# Função para adicionar documentos ao vector database
def add_documents_to_vector_db(documents: List[Document]) -> None:
    """Add documents to the vector database."""
    global vector_db
    
    if not documents:
        print("No documents to add")
        return
    
    print(f"Adding {len(documents)} documents to vector database")
    
    try:
        if vector_db is None:
            # Criar um novo banco de dados de vetores
            print("Creating new vector database")
            vector_db = create_vector_db(documents)
        else:
            # Adicionar ao banco de dados existente
            
            # Usar o método from_documents diretamente para adicionar novos documentos
            new_db = FAISS.from_documents(documents, embeddings_model)
            
            # Mesclar com o banco de dados existente
            vector_db.merge_from(new_db)
        
        # Salvar o banco de dados atualizado
        print("Saving updated vector database to disk")
        save_vector_db(vector_db)
        
    except Exception as e:
        print(f"Error adding documents to vector database: {str(e)}")
        import traceback
        traceback.print_exc()
        raise ValueError(f"Error adding documents to vector database: {str(e)}")

# Endpoint to upload a document
@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    """Upload a document and add it to the vector database."""
    global vector_db
    
    # Create uploads directory if it doesn't exist
    uploads_dir = UPLOADS_DIR
    os.makedirs(uploads_dir, exist_ok=True)
    
    # Generate a timestamp for the file name to avoid collisions
    timestamp = time.time()
    file_name = f"{int(timestamp)}_{file.filename}"
    file_path = os.path.join(uploads_dir, file_name)
    
    # Save the file
    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())
    
    try:
        # Process the document
        documents = process_document(file_path, file.filename, time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(timestamp)))
        
        # Add documents to the vector database
        add_documents_to_vector_db(documents)
        
        return {"message": "Document processed successfully", "chunks": len(documents), "file_saved": file_path}
    
    except Exception as e:
        print(f"Error processing document: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# HTTP endpoint to ask a question
@app.post("/perguntar", response_model=QuestionResponse)
async def ask_question(request: QuestionRequest):
    """Ask a question and get an answer based on the document context."""
    try:
        # Query vector database for relevant documents
        docs = await query_vector_db(request.question, request.top_k, request.file_paths)
        
        # Generate answer
        answer = await generate_answer(request.question, docs)
        
        # Prepare sources information
        sources = [{"content": doc.page_content, "metadata": doc.metadata} for doc in docs]
        
        return {"answer": answer, "sources": sources}
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating answer: {str(e)}")

# WebSocket endpoint for chat
@app.websocket("/ws/chat")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time chat."""
    await manager.connect(websocket)
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            print(f"Received data from client: {data}")
            
            try:
                data_json = json.loads(data)
                print(f"Parsed JSON data: {data_json}")
                
                if "question" not in data_json:
                    await manager.send_personal_message(
                        json.dumps({"error": "Question is required"}),
                        websocket
                    )
                    continue
                
                question = data_json["question"]
                top_k = data_json.get("top_k", 5)
                file_paths = data_json.get("file_paths", [])
                
                print(f"Processing question: '{question}' with top_k={top_k}")
                print(f"Selected file paths: {file_paths}")
                
                try:
                    # Query vector database for relevant documents
                    print("Querying vector database...")
                    docs = await query_vector_db(question, top_k, file_paths)
                    print(f"Found {len(docs)} relevant documents")
                    
                    # Generate answer
                    print("Generating answer...")
                    answer = await generate_answer(question, docs)
                    print(f"Generated answer: '{answer[:100]}...'")
                    
                    # Prepare sources information
                    sources = [{"content": doc.page_content, "metadata": doc.metadata} for doc in docs]
                    
                    # Send response back to client
                    await manager.send_personal_message(
                        json.dumps({"answer": answer, "sources": sources}),
                        websocket
                    )
                    print("Response sent to client")
                    
                except ValueError as e:
                    print(f"ValueError during processing: {str(e)}")
                    await manager.send_personal_message(
                        json.dumps({"error": str(e)}),
                        websocket
                    )
                    
                except Exception as e:
                    print(f"Exception during processing: {str(e)}")
                    import traceback
                    traceback.print_exc()
                    await manager.send_personal_message(
                        json.dumps({"error": f"Error generating answer: {str(e)}"}),
                        websocket
                    )
            
            except json.JSONDecodeError as e:
                print(f"JSON decode error: {str(e)}")
                await manager.send_personal_message(
                    json.dumps({"error": f"Invalid JSON format: {str(e)}"}),
                    websocket
                )
                
            except Exception as e:
                print(f"Unexpected error: {str(e)}")
                import traceback
                traceback.print_exc()
                await manager.send_personal_message(
                    json.dumps({"error": f"Unexpected error: {str(e)}"}),
                    websocket
                )
    
    except WebSocketDisconnect:
        print("WebSocket disconnected")
        manager.disconnect(websocket)

# Função para carregar o banco de dados de vetores na inicialização
@app.on_event("startup")
async def startup_db_client():
    """Load the vector database on startup."""
    global vector_db
    try:
        print("Loading vector database...")
        vector_db = load_vector_db()
        if vector_db:
            print("Vector database loaded successfully")
        else:
            print("No existing vector database found. Will create one when documents are uploaded.")
    except Exception as e:
        print(f"Error loading vector database: {str(e)}")
        import traceback
        traceback.print_exc()

# Run the application
if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
