# 🔗 Integração PHP Completa - Bot Secretário

## 📦 Arquivos Criados

### 1. `includes/notificar_bot.php` ✅
**Função:** Notifica o bot sobre eventos no sistema

**Contém:**
- `notificarBotNovoAgendamento()` - Quando cliente agenda
- `notificarBotAgendamentoConfirmado()` ✨ - Quando profissional confirma

**URLs dos Webhooks (linhas 26-27 e 144-145):**
```php
// Para NOVO AGENDAMENTO
$WEBHOOK_LOCAL = 'http://localhost:3333/webhook/novo-agendamento';
$WEBHOOK_PROD = 'http://bot.salao.develoi.com:3333/webhook/novo-agendamento';

// Para CONFIRMAÇÃO (nova função)
$WEBHOOK_LOCAL = 'http://localhost:3333/webhook/agendamento-confirmado';
$WEBHOOK_PROD = 'http://bot.salao.develoi.com:3333/webhook/agendamento-confirmado';
```

### 2. `api/confirmar_agendamento.php` ✅ NOVO!
**Função:** API AJAX para confirmar agendamentos no painel

**O que faz:**
1. Recebe `POST` com `id` do agendamento
2. Atualiza status para "Confirmado" no banco
3. Chama `notificarBotAgendamentoConfirmado()` ✨
4. Bot envia mensagem de confirmação para o **cliente**

---

## 🔄 Fluxo de Integração Completo

### Cenário 1: Cliente Agenda no Site

```
1. Cliente preenche formulário → agendar.php

2. PHP grava no banco:
   INSERT INTO agendamentos (...) VALUES (...)
   $idAgendamento = $pdo->lastInsertId();

3. PHP chama notificação:
   require_once __DIR__ . '/includes/notificar_bot.php';
   notificarBotNovoAgendamento($pdo, $idAgendamento);

4. Função busca dados:
   SELECT a.*, u.telefone AS telefone_profissional, c.nome AS cliente_nome
   FROM agendamentos a
   JOIN usuarios u ON u.id = a.user_id
   LEFT JOIN clientes c ON c.id = a.cliente_id
   WHERE a.id = ?

5. Função faz POST HTTP:
   curl → http://bot.salao.develoi.com:3333/webhook/novo-agendamento
   {
     "telefone_profissional": "15992675429",
     "cliente_nome": "João Silva",
     "servico": "Corte Masculino",
     "data": "2025-12-05",
     "horario": "14:30",
     "valor": 45
   }

6. Bot recebe e envia WhatsApp:
   Para: 5515992675429@c.us (PROFISSIONAL)
   Mensagem: "🔔 NOVO AGENDAMENTO RECEBIDO!"
```

### Cenário 2: Profissional Confirma Agendamento ✨ NOVO!

```
1. Profissional clica "Confirmar" no painel → AJAX

2. JavaScript chama API:
   POST /api/confirmar_agendamento.php
   { id: 123 }

3. API atualiza banco:
   UPDATE agendamentos 
   SET status = 'Confirmado' 
   WHERE id = 123 AND user_id = ?

4. API chama notificação:
   notificarBotAgendamentoConfirmado($pdo, 123);

5. Função busca dados completos:
   SELECT 
     a.*,
     u.telefone AS telefone_profissional,
     u.nome AS profissional_nome,
     u.estabelecimento,
     c.nome AS cliente_nome,
     c.telefone AS cliente_telefone
   FROM agendamentos a
   JOIN usuarios u ON u.id = a.user_id
   LEFT JOIN clientes c ON c.id = a.cliente_id
   WHERE a.id = 123

6. Função faz POST HTTP:
   curl → http://bot.salao.develoi.com:3333/webhook/agendamento-confirmado
   {
     "telefone_cliente": "11987654321",      👈 ATENÇÃO: Cliente!
     "cliente_nome": "João Silva",
     "profissional_nome": "Eduardo Eloi",
     "estabelecimento": "Salão Develoi",
     "servico": "Corte Masculino",
     "data": "2025-12-05",
     "horario": "14:30",
     "valor": 45
   }

7. Bot recebe e envia WhatsApp:
   Para: 5511987654321@c.us (CLIENTE)         👈 ATENÇÃO: Cliente!
   Mensagem: "✅ AGENDAMENTO CONFIRMADO!"
```

---

## 📝 Código de Integração no PHP

### Onde adicionar: `agendar.php` (após INSERT)

```php
// Após criar o agendamento
$stmt->execute($params);
$idAgendamento = $pdo->lastInsertId();

// ✅ ADICIONAR AQUI:
require_once __DIR__ . '/includes/notificar_bot.php';
notificarBotNovoAgendamento($pdo, $idAgendamento);

// Resto do código...
if ($idAgendamento > 0) {
    echo json_encode(['success' => true]);
}
```

### Onde adicionar: `api/confirmar_agendamento.php` (após UPDATE)

```php
// Após confirmar
$stmt->execute([$agendamentoId, $userId]);

if ($stmt->rowCount() > 0) {
    // ✅ ADICIONAR AQUI:
    notificarBotAgendamentoConfirmado($pdo, $agendamentoId);
    
    echo json_encode([
        'success' => true, 
        'message' => 'Agendamento confirmado com sucesso!'
    ]);
}
```

---

## 🗂️ Estrutura de Arquivos no Servidor

### HostGator (PHP):
```
public_html/
├── includes/
│   ├── db.php
│   └── notificar_bot.php ✅ (novo arquivo)
├── api/
│   ├── index.php
│   └── confirmar_agendamento.php ✅ (novo arquivo)
├── agendar.php (modificar)
└── agendamentos.php (painel)
```

### VPS (Node.js):
```
/root/bot-whatsapp/
├── bot-secretario.js ✅ (atualizado com webhook de confirmação)
├── package.json
├── tokens/
└── node_modules/
```

---

## 🔧 Configuração de URLs

### Desenvolvimento (localhost):
```php
// notificar_bot.php linha 26-27
$WEBHOOK_LOCAL = 'http://localhost:3333/webhook/novo-agendamento';

// notificar_bot.php linha 144-145
$WEBHOOK_LOCAL = 'http://localhost:3333/webhook/agendamento-confirmado';
```

### Produção (VPS):
```php
// notificar_bot.php linha 30-31
$WEBHOOK_PROD = 'http://185.123.45.67:3333/webhook/novo-agendamento';

// notificar_bot.php linha 148-149
$WEBHOOK_PROD = 'http://185.123.45.67:3333/webhook/agendamento-confirmado';
```

**Importante:** Substitua `185.123.45.67` pelo IP real da sua VPS!

---

## 🧪 Teste de Integração Passo a Passo

### Passo 1: Verificar Bot Está Online
```bash
curl http://localhost:3333/status
```

**Resposta esperada:**
```json
{
  "status": "online",
  "profissionais_vinculados": 0,
  "timestamp": "2025-12-01T15:30:00.000Z"
}
```

### Passo 2: Testar Webhook de Novo Agendamento
```bash
curl -X POST http://localhost:3333/webhook/novo-agendamento \
  -H "Content-Type: application/json" \
  -d '{"telefone_profissional":"15992675429","cliente_nome":"Teste","servico":"Corte","data":"2025-12-05","horario":"14:30","valor":45}'
```

**Verificar:**
- [ ] Terminal do bot mostra: `📲 Webhook recebido: Novo agendamento!`
- [ ] WhatsApp do profissional recebe mensagem

### Passo 3: Testar Webhook de Confirmação ✨
```bash
curl -X POST http://localhost:3333/webhook/agendamento-confirmado \
  -H "Content-Type: application/json" \
  -d '{"telefone_cliente":"11987654321","cliente_nome":"João Teste","profissional_nome":"Eduardo","estabelecimento":"Salão","servico":"Corte","data":"2025-12-05","horario":"14:30","valor":45}'
```

**Verificar:**
- [ ] Terminal do bot mostra: `✅ Webhook recebido: Agendamento CONFIRMADO!`
- [ ] WhatsApp do cliente recebe mensagem

### Passo 4: Testar no Sistema Real

1. **Criar agendamento:**
   - Acesse: https://salao.develoi.com/agendar?user=2
   - Preencha dados completos
   - Clique "Agendar"
   - **Verificar:** Profissional recebe notificação 🔔

2. **Confirmar agendamento:**
   - Acesse painel: https://salao.develoi.com/agendamentos
   - Encontre o agendamento
   - Clique "Confirmar"
   - **Verificar:** Cliente recebe confirmação ✅

---

## 📊 Logs e Debugging

### PHP Logs (HostGator):
```php
// Verificar error_log do Apache
tail -f /var/log/apache2/error.log

// Procure por:
[BOT] Webhook http://... HTTP 200 - Resp: {"success":true}
```

### Bot Logs (VPS):
```bash
# Terminal onde bot está rodando
# Procure por:
📲 Webhook recebido: Novo agendamento!
   ✅ Notificação enviada para 5515992675429@c.us

✅ Webhook recebido: Agendamento CONFIRMADO!
   ✅ Confirmação enviada para cliente 5511987654321@c.us
```

### Debug Manual:
```php
// Adicione no notificar_bot.php para debug:
error_log('[BOT DEBUG] Telefone profissional: ' . $ag['telefone_profissional']);
error_log('[BOT DEBUG] Telefone cliente: ' . $ag['cliente_telefone']);
error_log('[BOT DEBUG] Webhook URL: ' . $webhookUrl);
```

---

## ⚠️ Problemas Comuns

### ❌ "Profissional sem telefone cadastrado"
**Causa:** Campo `usuarios.telefone` vazio  
**Solução:**
```sql
UPDATE usuarios 
SET telefone = '15992675429' 
WHERE id = 2;
```

### ❌ "Cliente sem telefone cadastrado"
**Causa:** Campo `clientes.telefone` vazio  
**Solução:**
```sql
UPDATE clientes 
SET telefone = '11987654321' 
WHERE id = 123;
```

### ❌ "Erro cURL ao notificar bot"
**Causa:** Bot não está rodando ou URL errada  
**Solução:**
1. Verificar bot: `curl http://localhost:3333/status`
2. Verificar firewall da VPS (porta 3333)
3. Verificar URL em `notificar_bot.php`

### ❌ Bot envia mas WhatsApp não recebe
**Causa:** Formato de telefone incorreto  
**Solução:** Telefones devem estar sem máscara no banco:
- ❌ `(11) 98765-4321`
- ✅ `11987654321`

---

## 🚀 Deploy em Produção

### 1. Configurar VPS:
```bash
# Instalar Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clonar/copiar bot
cd /root
git clone ... ou scp ...

# Instalar dependências
cd bot-whatsapp
npm install

# Abrir porta no firewall
sudo ufw allow 3333/tcp

# Rodar com PM2 (gerenciador de processos)
sudo npm install -g pm2
pm2 start bot-secretario.js --name "bot-secretario"
pm2 save
pm2 startup
```

### 2. Configurar HostGator:
```bash
# Via FTP ou File Manager
1. Copiar includes/notificar_bot.php → public_html/includes/
2. Copiar api/confirmar_agendamento.php → public_html/api/
3. Editar URLs dos webhooks (linhas 31 e 145)
4. Adicionar chamadas no código existente
```

### 3. Testar:
- Criar agendamento real no site
- Verificar notificação no WhatsApp do profissional
- Confirmar agendamento no painel
- Verificar confirmação no WhatsApp do cliente

---

## 📞 Suporte Rápido

### Comandos Úteis:

```bash
# Status do bot
curl http://localhost:3333/status

# Verificar logs em tempo real
pm2 logs bot-secretario

# Reiniciar bot
pm2 restart bot-secretario

# Verificar processos
pm2 list

# Parar bot
pm2 stop bot-secretario
```

---

## ✅ Checklist Final

- [ ] Bot rodando na VPS
- [ ] Porta 3333 aberta no firewall
- [ ] QR Code escaneado
- [ ] `notificar_bot.php` copiado para HostGator
- [ ] `confirmar_agendamento.php` copiado para HostGator
- [ ] URLs dos webhooks configuradas
- [ ] Telefones dos profissionais preenchidos no banco
- [ ] Telefones dos clientes preenchidos no banco
- [ ] Teste de novo agendamento funcionou ✅
- [ ] Teste de confirmação funcionou ✅
- [ ] Sistema em produção testado ✅

---

**Versão:** 2.0  
**Data:** Dezembro 2025  
**Novidade:** ✨ Webhook de confirmação para clientes
