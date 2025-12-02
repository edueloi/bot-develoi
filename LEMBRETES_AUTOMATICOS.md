# 🔔 Sistema de Lembretes Automáticos - Bot Secretário

## ✅ O Que Foi Implementado

### 1. **Novo Webhook no Bot**: `/webhook/lembrete-agendamento`
- Envia lembrete para **CLIENTE** (WhatsApp do cliente)
- Envia lembrete para **PROFISSIONAL** (WhatsApp do profissional)
- Configura tempo de antecedência (ex: 60 minutos antes)

### 2. **Funções PHP Prontas**:
- `notificarBotLembreteAgendamento()` - Envia lembrete individual
- `processarLembretesAutomaticos()` - Processa todos os lembretes pendentes

### 3. **Arquivo CRON**: `cron_lembretes.php`
- Executa automaticamente a cada 10 minutos
- Busca agendamentos próximos
- Marca como enviado para não duplicar

---

## 🔧 Como Configurar

### **Passo 1: Copiar Arquivos para o Servidor**

```
bot-whatsapp/cron_lembretes.php → controle-salao/cron_lembretes.php
```

O arquivo `includes/notificar_bot.php` já tem as funções necessárias.

### **Passo 2: Configurar CRON Job**

#### **No cPanel (HostGator):**

1. Acesse **Cron Jobs** no cPanel
2. Clique em **Adicionar Novo Cron Job**
3. Configure:
   - **Frequência:** A cada 10 minutos
   - **Comando:**
     ```bash
     /usr/bin/php /home/usuario/public_html/controle-salao/cron_lembretes.php
     ```
   - **Email de notificação:** Opcional

#### **No Linux/VPS:**

```bash
# Editar crontab
crontab -e

# Adicionar linha (a cada 10 minutos):
*/10 * * * * /usr/bin/php /var/www/html/controle-salao/cron_lembretes.php >> /var/log/cron_lembretes.log 2>&1
```

#### **Para Testes (Local):**

```powershell
# Executar manualmente
php cron_lembretes.php

# Ou via navegador (com token):
# http://localhost/controle-salao/cron_lembretes.php?token=seu_token_secreto_aqui_123456
```

### **Passo 3: Configurar Token de Segurança**

No arquivo `cron_lembretes.php`, linha 32:

```php
$tokenSecreto = 'seu_token_secreto_aqui_123456'; // 🔐 TROCAR!
```

**Gere um token forte:**
```php
// Exemplo de token gerado:
$tokenSecreto = bin2hex(random_bytes(32));
// Resultado: a3f5c9e8b1d4f7a2c6e9b8d5a1f3c7e2b9d6a4f8c2e5b7d9a6f1c8e3b5d2a7f4
```

---

## 🧪 Testar Sistema de Lembretes

### **Teste 1: Testar Webhook Manualmente**

```powershell
curl -X POST http://localhost:3333/webhook/lembrete-agendamento `
  -H "Content-Type: application/json" `
  -d '{
    "agendamento_id": 123,
    "telefone_profissional": "15992675429",
    "telefone_cliente": "11987654321",
    "cliente_nome": "João Teste",
    "profissional_nome": "Eduardo Eloi",
    "estabelecimento": "Salão Develoi",
    "servico": "Corte Masculino",
    "data": "2025-12-02",
    "horario": "15:30",
    "valor": 45,
    "minutos_restantes": 55,
    "minutos_antes_configurado": 60
  }'
```

**Resultado esperado:**
- ✅ WhatsApp do **cliente** recebe: "⏰ LEMBRETE DE AGENDAMENTO"
- ✅ WhatsApp do **profissional** recebe: "⏰ LEMBRETE: CONSULTA PRÓXIMA"

### **Teste 2: Executar CRON Manualmente**

```powershell
php cron_lembretes.php
```

**Saída esperada:**
```
========================================
CRON JOB - LEMBRETES AUTOMÁTICOS
========================================
Início: 2025-12-02 14:30:00
Antecedência: 60 minutos
========================================

Processando lembretes...

========================================
PROCESSAMENTO CONCLUÍDO
========================================
Término: 2025-12-02 14:30:05
Tempo de execução: 5.2s
Lembretes enviados: 3
========================================
```

### **Teste 3: Via Navegador (com Token)**

```
http://localhost/controle-salao/cron_lembretes.php?token=seu_token_secreto_aqui_123456
```

**Resposta JSON:**
```json
{
  "success": true,
  "lembretes_enviados": 3,
  "tempo_execucao_segundos": 5.2,
  "inicio": "2025-12-02 14:30:00",
  "fim": "2025-12-02 14:30:05",
  "configuracao": {
    "minutos_antes": 60
  }
}
```

---

## 📊 Mensagens Enviadas

### **Mensagem para o CLIENTE:**

```
⏰ LEMBRETE DE AGENDAMENTO

Olá João Silva! 👋

Você tem um agendamento em 55 minutos:

📍 Salão Develoi
👤 Profissional: Eduardo Eloi
✂️ Serviço: Corte Masculino
📅 Data: 02/12/2025
⏰ Horário: 15:30
💰 Valor: R$ 45.00

Estamos te esperando! Não se atrase! 😊
```

### **Mensagem para o PROFISSIONAL:**

```
⏰ LEMBRETE: CONSULTA PRÓXIMA

Você tem um agendamento em 55 minutos:

📅 Data: 02/12/2025
⏰ Horário: 15:30
👤 Cliente: João Silva
📞 Telefone: (11) 98765-4321
✂️ Serviço: Corte Masculino
💰 Valor: R$ 45.00

Prepare-se para atender! 👨‍💼
```

---

## 🔍 Debugar Problema de Produção

### **Problema: Webhook não chega em produção mas funciona em localhost**

#### **Diagnóstico Rápido:**

1. **Testar conectividade:**
```powershell
# Testar se o bot está acessível
curl http://bot.develoi.com:3333/status

# Testar webhook de teste
curl -X POST http://bot.develoi.com:3333/webhook/teste `
  -H "Content-Type: application/json" `
  -d '{"teste": "conexao"}'
```

2. **Verificar firewall da VPS:**
```bash
# No servidor onde o bot está rodando
sudo ufw status
sudo ufw allow 3333/tcp
```

3. **Verificar se o bot está rodando:**
```bash
# Ver processos Node.js
ps aux | grep node

# Ver logs (se usando PM2)
pm2 logs bot-secretario
```

4. **Testar do servidor PHP:**
```bash
# No servidor HostGator, executar via SSH:
curl -X POST http://bot.develoi.com:3333/webhook/teste \
  -H "Content-Type: application/json" \
  -d '{"origem": "hostgator"}'
```

#### **Soluções Comuns:**

| Problema | Solução |
|----------|---------|
| Porta 3333 bloqueada | Abrir porta no firewall: `sudo ufw allow 3333/tcp` |
| DNS não aponta | Usar IP direto: `http://72.61.221.59:3333` |
| Bot não está rodando | Iniciar: `node bot-secretario.js` ou `pm2 start` |
| Timeout no cURL | Aumentar CURLOPT_TIMEOUT para 15 segundos |
| HostGator bloqueia requisições externas | Contactar suporte para liberar |

---

## ⚙️ Configurações Avançadas

### **Alterar tempo de antecedência:**

```bash
# Enviar lembrete 2 horas antes (120 minutos)
php cron_lembretes.php 120

# Ou via URL:
# http://localhost/cron_lembretes.php?token=xxx&minutos=120
```

### **Diferentes horários de lembrete:**

```bash
# CRON 1: 1 hora antes (a cada 10 minutos)
*/10 * * * * php /path/cron_lembretes.php 60

# CRON 2: 24 horas antes (a cada 1 hora)
0 * * * * php /path/cron_lembretes.php 1440

# CRON 3: 30 minutos antes (a cada 5 minutos)
*/5 * * * * php /path/cron_lembretes.php 30
```

### **Logs detalhados:**

```bash
# Ver logs do PHP
tail -f /var/log/apache2/error_log | grep BOT

# Ver logs do bot
tail -f /root/bot-whatsapp/bot.log
```

---

## 📋 Checklist de Implementação

### No Bot (Node.js):
- [x] Webhook `/webhook/lembrete-agendamento` implementado
- [x] Endpoint `/webhook/teste` para debug
- [x] Endpoint `/status` com informações completas
- [ ] Bot rodando e conectado ao WhatsApp
- [ ] Porta 3333 acessível externamente

### No PHP:
- [x] Função `notificarBotLembreteAgendamento()` criada
- [x] Função `processarLembretesAutomaticos()` criada
- [x] Arquivo `cron_lembretes.php` criado
- [ ] Token de segurança configurado
- [ ] Arquivo copiado para servidor
- [ ] CRON job configurado

### No Banco de Dados:
- [x] Campo `lembrete_enviado` criado na tabela `agendamentos`
- [x] Índice criado para performance

### Testes:
- [ ] Teste manual do webhook funcionou
- [ ] CRON executado manualmente funcionou
- [ ] Lembrete chegou no WhatsApp do cliente
- [ ] Lembrete chegou no WhatsApp do profissional
- [ ] CRON automático está rodando

---

## 🚨 Troubleshooting

### ❌ "Lembrete já enviado"
**Causa:** Campo `lembrete_enviado = 1` no banco  
**Solução:** 
```sql
UPDATE agendamentos SET lembrete_enviado = 0 WHERE id = 123;
```

### ❌ "Nenhum telefone válido"
**Causa:** Telefones vazios ou em formato errado  
**Solução:**
```sql
-- Verificar telefones
SELECT id, cliente_nome, 
       (SELECT telefone FROM clientes WHERE id = a.cliente_id) as tel_cliente,
       (SELECT telefone FROM usuarios WHERE id = a.user_id) as tel_prof
FROM agendamentos a 
WHERE id = 123;

-- Atualizar se necessário
UPDATE clientes SET telefone = '11987654321' WHERE id = X;
UPDATE usuarios SET telefone = '15992675429' WHERE id = Y;
```

### ❌ CRON não executa
**Causa:** Caminho errado ou permissões  
**Solução:**
```bash
# Verificar caminho do PHP
which php

# Dar permissão de execução
chmod +x cron_lembretes.php

# Testar manualmente primeiro
php cron_lembretes.php
```

---

## 📞 URLs de Produção Corretas

```php
// includes/notificar_bot.php - getBotBaseUrl()

// Local:
$BOT_BASE_URL_LOCAL = 'http://localhost:3333';

// Produção (IP da VPS Hostinger):
$BOT_BASE_URL_PROD = 'http://72.61.221.59:3333';

// Ou se configurar DNS:
$BOT_BASE_URL_PROD = 'http://bot.develoi.com:3333';
```

---

**Versão:** 2.0  
**Data:** Dezembro 2025  
**Novo recurso:** ✨ Lembretes automáticos para clientes e profissionais
