# Tulipa IA 🌷

Projeto React/Vite separado da Tulipa IA.

## Já configurado no código
- Firebase Web do projeto `tulipa-ia`
- Login/cadastro por e-mail e senha
- Botão de login com Google
- Firestore para conversas por usuário
- Vários chats
- Modo claro/escuro
- Sair da conta
- Interface roxo/ameixa
- Tulipa IA como assistente geral
- Limite de teste de 20 mensagens por usuário/dia no backend
- Gemini 3.1 Flash Lite
- Vercel Analytics

## Testar a tela no computador
Abra o terminal nesta pasta e execute:

npm install
npm run dev

Depois abra o endereço mostrado pelo Vite (normalmente http://localhost:5173/).

## Antes de testar login
No Firebase Console do projeto Tulipa IA:
1. Authentication > Sign-in method
2. Ative Email/Password
3. Ative Google
4. Crie/ative o Firestore Database

## Para a IA funcionar na Vercel
Ainda será necessário configurar na Vercel:
- GEMINI_API_KEY
- FIREBASE_PROJECT_ID
- FIREBASE_CLIENT_EMAIL
- FIREBASE_PRIVATE_KEY

Essas três últimas credenciais de backend devem vir de uma Service Account do Firebase.
Não publique GEMINI_API_KEY nem FIREBASE_PRIVATE_KEY no GitHub.
