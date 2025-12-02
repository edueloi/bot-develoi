# 🎯 GUIA VISUAL RÁPIDO - 5 MINUTOS

## ⚡ Instalação Ultra Rápida

### 1️⃣ Instalar (30 segundos)

```powershell
npm install
```

### 2️⃣ Configurar CPF (10 segundos)

Abra `.env` e coloque seu CPF:

```env
SALAO_CPF=12345678900  👈 SEU CPF AQUI
```

### 3️⃣ Iniciar (5 segundos)

```powershell
node index.js
```

### 4️⃣ Conectar WhatsApp (30 segundos)

Escaneie o QR Code que aparece no terminal.

### 5️⃣ Testar (10 segundos)

Envie **"oi"** para o número conectado.

---

## 💬 Comandos Rápidos

```
┌────────────────────────────────────────────┐
│  DIGITE NO WHATSAPP    │  O QUE ACONTECE   │
├────────────────────────────────────────────┤
│  oi                    │  Mostra menu      │
│  1                     │  Lista serviços   │
│  2                     │  Ver horários     │
│  hoje                  │  Horários hoje    │
│  4                     │  Info do salão    │
│  tchau                 │  Despedida        │
└────────────────────────────────────────────┘
```

---

## 📂 Arquivos Importantes

```
bot-whatsapp/
├── 📄 index.js          ← Arquivo principal (NÃO MEXER)
├── 📄 config.js         ← Edite mensagens aqui
├── 📄 .env              ← Configure CPF aqui
└── 📄 README.md         ← Documentação completa
```

---

## 🎨 Personalizar Mensagens

Abra `config.js` e edite:

```javascript
mensagens: {
  boasVindas: 'Sua mensagem de boas-vindas',
  menuPrincipal: 'Seu menu customizado',
  // ...
}
```

---

## 🐛 Problemas?

| Problema | Solução |
|----------|---------|
| Bot não inicia | `npm install` |
| QR não aparece | Apague pasta `tokens/` |
| API não funciona | Verifique CPF no `.env` |

---

## 📊 Fluxo Visual

```
CLIENTE              BOT              API
   │                  │                │
   │──── "oi" ────────>│                │
   │                  │                │
   │<── Boas-vindas ──│                │
   │<── Menu ─────────│                │
   │                  │                │
   │──── "1" ─────────>│                │
   │                  │── GET /api ───>│
   │                  │<── JSON ───────│
   │<── Serviços ─────│                │
   │                  │                │
```

---

## ✅ Checklist

- [ ] `npm install` executado
- [ ] `.env` configurado com CPF
- [ ] Bot iniciado (`node index.js`)
- [ ] QR Code escaneado
- [ ] Teste enviado ("oi")
- [ ] Resposta recebida

---

## 🚀 Comandos Úteis

```powershell
# Iniciar
node index.js

# Iniciar com reinício automático
npm run dev

# Parar (Ctrl+C)

# Limpar sessão
Remove-Item -Recurse -Force tokens/
```

---

## 📱 Teste Completo em 1 Minuto

```
Você: oi
Bot: [Boas-vindas + Menu]

Você: 1
Bot: [Lista de serviços]

Você: 2
Bot: [Pergunta data]

Você: hoje
Bot: [Horários disponíveis]

Você: tchau
Bot: [Despedida]

✅ TUDO FUNCIONANDO!
```

---

## 🔗 Links Rápidos

- 📖 [README.md](README.md) - Documentação completa
- 🚀 [INSTALACAO.md](INSTALACAO.md) - Guia detalhado
- 💬 [EXEMPLOS.md](EXEMPLOS.md) - Exemplos de conversas
- 📋 [RESUMO.md](RESUMO.md) - Visão geral

---

## 🎉 Pronto!

**Seu bot está funcionando!** 🎊

Para saber mais, leia os outros arquivos de documentação.

---

**Dúvidas?** Veja [README.md](README.md) ou [INSTALACAO.md](INSTALACAO.md)
