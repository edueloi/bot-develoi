# 🚀 Guia Rápido de Instalação - Bot WhatsApp Salão Develoi

## ⚡ Instalação em 5 Passos

### 1️⃣ Instalar Dependências

```powershell
npm install
```

Isso vai instalar:
- `@wppconnect-team/wppconnect` - Cliente WhatsApp
- `express` - Servidor web
- `dotenv` - Gerenciador de variáveis de ambiente

---

### 2️⃣ Configurar Variáveis de Ambiente

**Copie o arquivo de exemplo:**

```powershell
copy .env.example .env
```

**Edite o arquivo `.env`:**

```env
API_BASE_URL=https://salao.develoi.com/api/
SALAO_CPF=12345678900
PORT=3000
```

> ⚠️ **IMPORTANTE:** 
> - Substitua `12345678900` pelo **CPF real** cadastrado no salão
> - O CPF deve ter **11 dígitos** (apenas números)
> - Se estiver testando localmente, altere a URL para: `http://localhost/karen_site/controle-salao/api/`

---

### 3️⃣ Iniciar o Bot

```powershell
node index.js
```

Ou com reinício automático (desenvolvimento):

```powershell
npm run dev
```

---

### 4️⃣ Escanear QR Code

Quando o bot iniciar, você verá algo assim no terminal:

```
📱 QR Code gerado! Escaneie com o WhatsApp:

█████████████████████████████████
█████████████████████████████████
███████ ██████ ██████ ███████████
[... QR CODE ASCII ...]
```

**Como escanear:**

1. Abra o WhatsApp no seu celular
2. Vá em **Menu (⋮)** → **Aparelhos conectados**
3. Toque em **Conectar um aparelho**
4. Aponte a câmera para o QR Code no terminal

---

### 5️⃣ Testar o Bot

Envie uma mensagem para o número do WhatsApp conectado:

```
Você: oi
Bot: 🎉 Bem-vindo ao Salão Develoi!
     Sou o assistente virtual [...]
```

**Pronto! Seu bot está funcionando! 🎉**

---

## 🧪 Testando as Funcionalidades

### Teste 1: Menu Principal

```
Digite: menu
```

Deve exibir:
- 1️⃣ Ver serviços e preços
- 2️⃣ Consultar horários livres
- 3️⃣ Meus agendamentos
- 4️⃣ Informações do salão
- 5️⃣ Falar com atendente

---

### Teste 2: Listar Serviços

```
Digite: 1
ou
Digite: serviços
```

Deve mostrar todos os serviços cadastrados na API com preços e durações.

---

### Teste 3: Consultar Horários

```
Digite: 2
```

Bot vai perguntar a data. Responda:

```
Digite: hoje
ou
Digite: amanhã
ou
Digite: 25/12/2024
```

---

### Teste 4: Informações do Salão

```
Digite: 4
```

Deve exibir endereço, telefone, Instagram, etc.

---

## 📊 Monitorando o Bot

No terminal onde o bot está rodando, você verá logs em tempo real:

```
📨 Nova mensagem de 5511999999999@c.us:
   Conteúdo: oi
   🎯 Intenção detectada: saudacao
   🌐 API Request: profissional
   ✅ API Response: OK
   ✅ Mensagem enviada
```

---

## 🛑 Parar o Bot

No terminal, pressione:

```
Ctrl + C
```

Ou se estiver usando PM2:

```powershell
pm2 stop bot-develoi
```

---

## 🔄 Reiniciar após Mudanças

Sempre que editar o código:

1. **Pare o bot** (Ctrl + C)
2. **Reinicie** (`node index.js`)

Ou use `nodemon` para reinício automático:

```powershell
npm run dev
```

---

## ⚙️ Comandos Úteis

### Verificar se o bot está rodando

```powershell
# Verifica processos Node.js
Get-Process | Where-Object { $_.ProcessName -eq "node" }
```

### Limpar sessão do WhatsApp

Se precisar reconectar o WhatsApp:

```powershell
# Remove pasta de tokens
Remove-Item -Recurse -Force tokens/
```

Depois inicie o bot novamente e escaneie o QR Code.

---

### Instalar PM2 (Produção)

Para manter o bot rodando 24/7:

```powershell
npm install -g pm2
pm2 start index.js --name bot-develoi
pm2 save
```

Comandos PM2:

```powershell
pm2 status              # Ver status
pm2 logs bot-develoi    # Ver logs
pm2 restart bot-develoi # Reiniciar
pm2 stop bot-develoi    # Parar
```

---

## 🐛 Solucionando Problemas Comuns

### ❌ Erro: "Cannot find module 'dotenv'"

**Solução:** Instale as dependências

```powershell
npm install
```

---

### ❌ Erro: "CPF inválido"

**Causa:** CPF não configurado ou formato errado

**Solução:** 
1. Abra o arquivo `.env`
2. Verifique se `SALAO_CPF=12345678900` tem 11 dígitos
3. Certifique-se que o CPF está cadastrado no salão

---

### ❌ Erro: "Não foi possível se conectar à API"

**Causa:** URL da API incorreta

**Solução:**
1. Verifique a `API_BASE_URL` no `.env`
2. Teste a API no navegador:
   ```
   https://salao.develoi.com/api/?action=profissional
   ```
3. Se a API não responder, verifique se o servidor do salão está online

---

### ❌ Bot não responde mensagens

**Possíveis causas:**

1. **QR Code não foi escaneado**
   - Solução: Verifique se apareceu "✅ Cliente WPP conectado"

2. **Bot está processando**
   - Solução: Aguarde alguns segundos

3. **Sessão expirou**
   - Solução: Limpe a pasta `tokens/` e reinicie

---

## 📦 Estrutura Final

Após a instalação, você terá:

```
bot-whatsapp/
├── .env                  ✅ (criar este arquivo)
├── .env.example
├── .gitignore
├── config.js
├── index.js
├── package.json
├── README.md
├── INSTALACAO.md         ← Você está aqui
├── node_modules/         ✅ (após npm install)
├── src/
│   ├── chatbot.js
│   └── salaoAPI.js
└── tokens/               ✅ (criado automaticamente)
    └── bot-develoi/
```

---

## ✅ Checklist de Instalação

Marque conforme for completando:

- [ ] Node.js instalado (v16+)
- [ ] Dependências instaladas (`npm install`)
- [ ] Arquivo `.env` criado e configurado
- [ ] CPF cadastrado no sistema do salão
- [ ] Bot iniciado (`node index.js`)
- [ ] QR Code escaneado
- [ ] Mensagem de teste enviada e respondida
- [ ] APIs funcionando corretamente

---

## 🎉 Pronto!

Se tudo estiver marcado, seu bot está **100% funcional**!

**Próximos passos:**
- Leia o `README.md` completo para funcionalidades avançadas
- Configure PM2 para produção
- Personalize as mensagens em `config.js`

---

## 📞 Precisa de Ajuda?

- 📧 Email: contato@develoi.com
- 💬 WhatsApp: (11) 99999-8888
- 📖 Documentação: `README.md`

---

**Boa sorte com seu chatbot! 🚀💇‍♀️**
