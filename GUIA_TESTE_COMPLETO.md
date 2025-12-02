# 🧪 Guia de Teste Completo - Bot Secretário

## 📋 O Que Foi Implementado

### ✅ Dois Webhooks Configurados:

1. **`/webhook/novo-agendamento`** 
   - Quando: Cliente agenda no site
   - Envia para: **PROFISSIONAL** (WhatsApp do profissional)
   - Mensagem: "🔔 NOVO AGENDAMENTO RECEBIDO!"

2. **`/webhook/agendamento-confirmado`** ✨ **NOVO!**
   - Quando: Profissional confirma no painel
   - Envia para: **CLIENTE** (WhatsApp do cliente)
   - Mensagem: "✅ AGENDAMENTO CONFIRMADO!"

---

## 🔄 Fluxo Completo do Sistema

```
1️⃣ Cliente agenda no site
   ↓
   PHP grava no banco → INSERT agendamentos
   ↓
   PHP chama → notificarBotNovoAgendamento($pdo, $idAgendamento)
   ↓
   Bot envia WhatsApp para PROFISSIONAL: "🔔 Novo agendamento!"
   
2️⃣ Profissional acessa painel e clica "Confirmar"
   ↓
   PHP atualiza status → UPDATE agendamentos SET status = 'Confirmado'
   ↓
   PHP chama → notificarBotAgendamentoConfirmado($pdo, $idAgendamento)
   ↓
   Bot envia WhatsApp para CLIENTE: "✅ Agendamento confirmado!"
```

---

## 🚀 Passo a Passo para Testar

### **TESTE 1: Notificação de Novo Agendamento** (Profissional)

#### 1. Inicie o bot:
```bash
node bot-secretario.js
```

#### 2. Configure o bot:
- Escaneie o QR Code com o **WhatsApp do profissional** (seu WhatsApp de testes)
- Aguarde mensagem: "✅ Bot do WhatsApp conectado e pronto!"

#### 3. Crie um agendamento:
- Acesse: https://salao.develoi.com/agendar?user=2
- Preencha os dados:
  - Nome do cliente: "João Teste"
  - Telefone: "(11) 98765-4321"
  - Serviço: Qualquer serviço
  - Data: Próximo dia útil
  - Horário: Qualquer horário disponível
- Clique em "Agendar"

#### 4. Verifique:
✅ Seu WhatsApp (profissional) deve receber:

```
🔔 NOVO AGENDAMENTO RECEBIDO!

📅 Data: 03/12/2025
⏰ Horário: 08:45
👤 Cliente: João Teste
📞 Telefone: (11) 98765-4321
✂️ Serviço: Corte Masculino
💰 Valor: R$ 45.00

Abra o sistema para ver mais detalhes.
```

#### 5. Logs esperados no terminal:
```
📲 Webhook recebido: Novo agendamento!
   Dados recebidos: { telefone_profissional: '15992675429', ... }
   ✅ Notificação enviada para 5515992675429@c.us
```

---

### **TESTE 2: Confirmação de Agendamento** ✨ (Cliente)

#### 1. Acesse o painel do profissional:
- URL: https://salao.develoi.com/agendamentos
- Faça login com seu usuário

#### 2. Encontre o agendamento recém-criado:
- Localize o agendamento "João Teste - 03/12/2025 08:45"
- Clique no botão **"Confirmar"** (ou "Confirmar Agendamento")

#### 3. Verifique:
✅ O **WhatsApp do cliente** "(11) 98765-4321" deve receber:

```
✅ AGENDAMENTO CONFIRMADO!

Olá João Teste! 👋

Seu agendamento foi confirmado com sucesso!

📍 Salão Develoi
👤 Profissional: Eduardo Eloi
✂️ Serviço: Corte Masculino
📅 Data: 03/12/2025
⏰ Horário: 08:45
💰 Valor: R$ 45.00

Estamos te esperando! Se precisar remarcar ou cancelar, entre em contato.

Até logo! 😊
```

#### 4. Logs esperados no terminal:
```
✅ Webhook recebido: Agendamento CONFIRMADO!
   Dados recebidos: { telefone_cliente: '11987654321', ... }
   ✅ Confirmação enviada para cliente 5511987654321@c.us
```

---

## 🧪 Teste Manual dos Webhooks (cURL)

### Testar notificação de novo agendamento:
```bash
curl -X POST http://localhost:3333/webhook/novo-agendamento \
  -H "Content-Type: application/json" \
  -d "{\"telefone_profissional\":\"15992675429\",\"cliente_nome\":\"Maria Teste\",\"cliente_telefone\":\"(11) 98888-7777\",\"servico\":\"Corte Feminino\",\"data\":\"2025-12-05\",\"horario\":\"14:30\",\"valor\":80}"
```

### Testar confirmação de agendamento:
```bash
curl -X POST http://localhost:3333/webhook/agendamento-confirmado \
  -H "Content-Type: application/json" \
  -d "{\"telefone_cliente\":\"11988887777\",\"cliente_nome\":\"Maria Teste\",\"profissional_nome\":\"Eduardo Eloi\",\"estabelecimento\":\"Salão Develoi\",\"servico\":\"Corte Feminino\",\"data\":\"2025-12-05\",\"horario\":\"14:30\",\"valor\":80}"
```

---

## ⚠️ Solução de Problemas

### ❌ Problema: Bot não envia mensagem para profissional
**Causas possíveis:**
1. Bot não está rodando → Execute `node bot-secretario.js`
2. QR Code não foi escaneado → Escaneie novamente
3. Telefone do profissional está incorreto no banco de dados

**Solução:**
```sql
-- Verificar telefone do profissional
SELECT id, nome, telefone FROM usuarios WHERE id = 2;

-- Atualizar se necessário (apenas números)
UPDATE usuarios SET telefone = '15992675429' WHERE id = 2;
```

### ❌ Problema: Bot não envia confirmação para cliente
**Causas possíveis:**
1. Cliente não tem telefone cadastrado
2. Telefone do cliente está em formato incorreto
3. Função `notificarBotAgendamentoConfirmado()` não foi chamada no PHP

**Solução:**
```sql
-- Verificar telefone do cliente
SELECT id, nome, telefone FROM clientes WHERE nome LIKE '%João%';

-- Atualizar se necessário
UPDATE clientes SET telefone = '11987654321' WHERE id = 123;
```

### ❌ Problema: Erro "Telefone inválido"
**Formato correto:** `11987654321` (apenas números, com DDD)

**Formatos aceitos:**
- ✅ `11987654321`
- ✅ `5511987654321`
- ❌ `(11) 98765-4321` (será convertido automaticamente)

---

## 📊 Checklist de Integração

### No Bot Node.js (VPS):
- [ ] Bot está rodando: `node bot-secretario.js`
- [ ] Porta 3333 está aberta no firewall
- [ ] QR Code foi escaneado com WhatsApp
- [ ] Endpoint `/webhook/novo-agendamento` responde
- [ ] Endpoint `/webhook/agendamento-confirmado` responde ✨
- [ ] Status em http://localhost:3333/status retorna `"status": "online"`

### No Sistema PHP (HostGator):
- [ ] Arquivo `includes/notificar_bot.php` foi criado
- [ ] URL do webhook está configurada (linha 31):
  ```php
  $WEBHOOK_PROD = 'http://SEU_IP_VPS:3333/webhook/novo-agendamento';
  ```
- [ ] Função `notificarBotNovoAgendamento()` é chamada após `INSERT`
- [ ] Arquivo `api/confirmar_agendamento.php` foi atualizado ✨
- [ ] Função `notificarBotAgendamentoConfirmado()` é chamada após confirmar

### No Banco de Dados:
- [ ] Campo `usuarios.telefone` está preenchido (profissional)
- [ ] Campo `clientes.telefone` está preenchido (clientes)
- [ ] Telefones estão em formato numérico (11987654321)

---

## 📱 Exemplos de Mensagens

### Mensagem 1: Novo Agendamento (para Profissional)
```
🔔 NOVO AGENDAMENTO RECEBIDO!

📅 Data: 05/12/2025
⏰ Horário: 14:30
👤 Cliente: Maria Silva
📞 Telefone: (11) 98765-4321
✂️ Serviço: Corte Feminino + Escova
💰 Valor: R$ 120.00
📝 Obs: Cliente prefere tesoura

Abra o sistema para ver mais detalhes.
```

### Mensagem 2: Confirmação (para Cliente) ✨
```
✅ AGENDAMENTO CONFIRMADO!

Olá Maria Silva! 👋

Seu agendamento foi confirmado com sucesso!

📍 Salão Develoi
👤 Profissional: Eduardo Eloi
✂️ Serviço: Corte Feminino + Escova
📅 Data: 05/12/2025
⏰ Horário: 14:30
💰 Valor: R$ 120.00

📝 Observações: Cliente prefere tesoura

Estamos te esperando! Se precisar remarcar ou cancelar, entre em contato.

Até logo! 😊
```

---

## 🎯 Próximos Passos

1. ✅ **Testar localmente** - Siga TESTE 1 e TESTE 2 acima
2. 📤 **Subir arquivos PHP** para HostGator:
   - `includes/notificar_bot.php`
   - `api/confirmar_agendamento.php`
3. 🔧 **Configurar URL de produção** em `notificar_bot.php`
4. 🚀 **Testar em produção** criando agendamento real
5. ✅ **Confirmar agendamento** e verificar se cliente recebe mensagem

---

## 📞 Comandos Úteis

### Verificar status do bot:
```bash
curl http://localhost:3333/status
```

### Parar o bot:
```bash
Ctrl + C
```

### Reiniciar o bot:
```bash
node bot-secretario.js
```

### Ver logs em tempo real:
```bash
# O bot já mostra logs no terminal
# Procure por estas mensagens:
# 📲 Webhook recebido: Novo agendamento!
# ✅ Webhook recebido: Agendamento CONFIRMADO!
```

---

**Versão:** 2.0  
**Atualizado:** Dezembro 2025  
**Novo recurso:** ✨ Confirmação automática para clientes
