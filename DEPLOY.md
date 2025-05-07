# Guia de Deploy - IA do Super Cérebro

Este guia contém instruções para fazer o deploy da aplicação IA do Super Cérebro no Netlify (frontend) e Render (backend).

## Pré-requisitos

1. Conta no [Netlify](https://www.netlify.com/)
2. Conta no [Render](https://render.com/)
3. Chave de API da OpenAI

## Deploy do Backend (Render)

1. Acesse [Render Dashboard](https://dashboard.render.com/)
2. Clique em "New" e selecione "Web Service"
3. Conecte seu repositório GitHub ou faça upload do código
4. Configure o serviço:
   - **Nome**: ia-super-cerebro-api
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `cd backend && uvicorn app:app --host 0.0.0.0 --port $PORT`
5. Adicione a variável de ambiente:
   - `OPENAI_API_KEY`: Sua chave de API da OpenAI
6. Clique em "Create Web Service"
7. Aguarde o deploy ser concluído

## Deploy do Frontend (Netlify)

1. Acesse [Netlify Dashboard](https://app.netlify.com/)
2. Clique em "New site from Git"
3. Conecte seu repositório GitHub ou faça upload do código
4. Configure o deploy:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `frontend/build`
5. Clique em "Deploy site"
6. Aguarde o deploy ser concluído
7. Vá para "Site settings" > "Domain management" para configurar seu domínio personalizado (opcional)

## Configuração Adicional

Após o deploy, você precisará atualizar o arquivo `netlify.toml` no frontend com a URL correta do seu backend:

```toml
[[redirects]]
  from = "/api/*"
  to = "https://sua-url-do-backend.onrender.com/:splat"
  status = 200
  force = true
```

Substitua `sua-url-do-backend.onrender.com` pela URL real do seu serviço no Render.

## Verificação

1. Acesse a URL do frontend fornecida pelo Netlify
2. Tente fazer upload de um documento
3. Faça uma pergunta para verificar se o chat está funcionando corretamente

## Solução de Problemas

Se encontrar problemas:

1. Verifique os logs no Netlify e Render
2. Confirme se a variável de ambiente OPENAI_API_KEY está configurada corretamente
3. Verifique se as redirecionamentos de API estão configurados corretamente no netlify.toml

## Manutenção

Para atualizar a aplicação após alterações:

1. Faça push das alterações para o repositório
2. O Netlify e o Render detectarão automaticamente as alterações e farão o redeploy
