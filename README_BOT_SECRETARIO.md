# 🤖 BOT SECRETÁRIO - EXCLUSIVO PARA PROFISSIONAIS

## 🎯 O QUE É ESTE BOT?

Este é um **bot-secretário** que funciona no WhatsApp **EXCLUSIVAMENTE para profissionais do salão**.

### ✅ O que ele faz:

- 📲 **Notifica AUTOMATICAMENTE** quando chega um novo agendamento
- 📅 **Consulta agendamentos** por comando (hoje, amanhã, próximos)
- 🔒 **Filtra por CPF** - cada profissional só vê seus próprios dados
- 💬 **Interface simples** via mensagens de WhatsApp

### ❌ O que ele NÃO faz:

- ❌ Não atende clientes finais
- ❌ Não cria agendamentos pelo WhatsApp
- ❌ Não é público - apenas profissionais

---

## 🚀 INSTALAÇÃO RÁPIDA

### 1️⃣ Instalar Dependências

```powershell
cd c:\var\www\bot-whatsapp
npm install node-fetch
```

### 2️⃣ Iniciar o Bot Secretário

```powershell
node bot-secretario.js
```

### 3️⃣ Escanear QR Code

Use o WhatsApp do **profissional** para escanear o QR que aparece.

### 4️⃣ Vincular CPF

No WhatsApp, envie seu CPF:

```
12345678900
```

### 5️⃣ Testar

```
agendamentos hoje
```

**PRONTO!** ✅

---

## 💬 COMANDOS DISPONÍVEIS

| Comando | O que faz |
|---------|-----------|
| `12345678900` | Vincula seu CPF ao número |
| `agendamentos hoje` | Lista agendamentos de hoje |
| `agendamentos amanhã` | Lista agendamentos de amanhã |
| `próximos agendamentos` | Lista próximos agendamentos |
| `todos os agendamentos` | Lista todos |
| `ajuda` ou `menu` | Mostra comandos |

---

## 🔔 NOTIFICAÇÕES AUTOMÁTICAS

### Como funciona:

1. **Cliente cria agendamento** no sistema web
2. **PHP detecta** e chama o bot via webhook
3. **Bot envia mensagem** IMEDIATAMENTE no WhatsApp do profissional

### Exemplo de notificação:

```
🔔 NOVO AGENDAMENTO RECEBIDO!

📅 Data: 05/12/2024
⏰ Horário: 14:30
👤 Cliente: Maria Silva
📞 Telefone: (11) 98765-4321
✂️ Serviço: Corte Feminino
💰 Valor: R$ 80.00

Abra o sistema para ver mais detalhes.
```

---

## 🔌 INTEGRAÇÃO COM PHP

### Passo 1: Copiar arquivo notificador

Copie `php/notificar_bot.php` para o sistema do salão:

```
controle-salao/
├── includes/
│   └── notificar_bot.php  👈 COLE AQUI
```

### Passo 2: Incluir no código de agendamentos

No arquivo que cria agendamentos, adicione:

```php
<?php
require_once __DIR__ . '/../includes/notificar_bot.php';

// ... seu código de INSERT ...

$novoId = $pdo->lastInsertId();

// 🔔 Notifica o bot
notificarBotNovoAgendamento($pdo, $novoId);
```

### Passo 3: Configurar URL do bot

Edite `notificar_bot.php` na linha 95:

```php
// LOCAL (mesma máquina):
$botUrl = 'http://localhost:3333/webhook/novo-agendamento';

// PRODUÇÃO (servidor separado):
$botUrl = 'http://IP_DO_SERVIDOR:3333/webhook/novo-agendamento';
```

**PRONTO!** Agora toda vez que criar um agendamento, o profissional recebe no WhatsApp!

---

## 📋 EXEMPLOS DE USO

### Exemplo 1: Profissional vinculando CPF

```
Profissional: 12345678900

Bot: ✅ CPF vinculado com sucesso!
     
     Seu CPF 12345678900 está agora vinculado ao seu número.
     
     📋 Comandos disponíveis:
     
     • Agendamentos hoje
     • Agendamentos amanhã
     • Próximos agendamentos
     • Todos os agendamentos
     
     💡 Você também receberá notificações automáticas 
     sempre que um novo agendamento for criado no sistema!
```

---

### Exemplo 2: Consultando agendamentos de hoje

```
Profissional: agendamentos hoje

Bot: 📅 AGENDAMENTOS DE HOJE
     
     1. 05/12/2024 às 09:00
     👤 João Santos
     ✂️ Corte Masculino - R$ 45.00
     📊 Status: Confirmado
     
     2. 05/12/2024 às 14:30
     👤 Maria Silva
     ✂️ Corte Feminino - R$ 80.00
     📊 Status: Pendente
     📝 Cliente prefere tesoura
     
     3. 05/12/2024 às 16:00
     👤 Ana Paula
     ✂️ Escova - R$ 50.00
     📊 Status: Confirmado
```

---

### Exemplo 3: Notificação automática

```
[Cliente cria agendamento no sistema]

Bot: 🔔 NOVO AGENDAMENTO RECEBIDO!
     
     📅 Data: 06/12/2024
     ⏰ Horário: 10:30
     👤 Cliente: Carlos Pereira
     📞 Telefone: (11) 97654-3210
     ✂️ Serviço: Barba
     💰 Valor: R$ 30.00
     
     Abra o sistema para ver mais detalhes.

[Mensagem chega INSTANTANEAMENTE no WhatsApp]
```

---

## 🔐 SEGURANÇA

### ✅ Recursos de segurança:

- Cada profissional vincula seu próprio CPF
- API filtra dados por CPF (Authorization: Bearer)
- Profissional só vê seus próprios agendamentos
- Bot não atende números não vinculados
- Webhook validado antes de enviar notificação

### ⚠️ IMPORTANTE:

- **Nunca compartilhe** seu CPF vinculado
- **Use apenas** seu WhatsApp pessoal
- **Não use** em grupos do WhatsApp

---

## 🔧 ARQUITETURA

```
┌─────────────────────────────────────────┐
│   SISTEMA WEB (PHP)                     │
│   Cliente cria agendamento              │
└────────────────┬────────────────────────┘
                 │
                 │ 1. INSERT agendamento
                 │ 2. Chama notificarBotNovoAgendamento()
                 ▼
┌─────────────────────────────────────────┐
│   notificar_bot.php                     │
│   • Busca dados do agendamento          │
│   • Busca telefone do profissional      │
│   • Envia POST para bot                 │
└────────────────┬────────────────────────┘
                 │
                 │ HTTP POST
                 │ http://localhost:3333/webhook/novo-agendamento
                 ▼
┌─────────────────────────────────────────┐
│   bot-secretario.js (Node.js)           │
│   • Recebe webhook                      │
│   • Valida dados                        │
│   • Envia mensagem WhatsApp             │
└────────────────┬────────────────────────┘
                 │
                 │ WPPConnect
                 ▼
┌─────────────────────────────────────────┐
│   WHATSAPP DO PROFISSIONAL              │
│   Recebe notificação instantânea        │
└─────────────────────────────────────────┘
```

---

## 🐛 SOLUÇÃO DE PROBLEMAS

### ❌ Bot não recebe notificações

**Verifique:**

1. Bot está rodando? (`node bot-secretario.js`)
2. Porta 3333 está livre? (`netstat -an | findstr 3333`)
3. URL no PHP está correta? (linha 95 de `notificar_bot.php`)
4. Teste manualmente:

```powershell
curl http://localhost:3333/status
```

Deve retornar:
```json
{
  "status": "online",
  "profissionais_vinculados": 1,
  "timestamp": "2024-12-01T..."
}
```

---

### ❌ Profissional não consegue vincular CPF

**Causas possíveis:**

1. CPF não tem 11 dígitos
2. CPF não está cadastrado no sistema
3. Bot não está conectado ao WhatsApp

**Solução:**

1. Verifique se o CPF é válido
2. Confirme que está cadastrado em `usuarios.cpf`
3. Veja se apareceu "✅ Cliente WPP conectado" no terminal

---

### ❌ API retorna "CPF não autorizado"

**Causa:** CPF não está na tabela `usuarios`

**Solução:**

1. Acesse o sistema como profissional
2. Vá em "Meu Perfil"
3. Cadastre o CPF
4. Tente vincular novamente no WhatsApp

---

## 🚀 DEPLOY EM PRODUÇÃO

### Com PM2 (Recomendado):

```powershell
# Instalar PM2
npm install -g pm2

# Iniciar bot
pm2 start bot-secretario.js --name bot-secretario

# Salvar configuração
pm2 save

# Auto-iniciar ao reiniciar servidor
pm2 startup

# Ver logs
pm2 logs bot-secretario

# Status
pm2 status
```

### Comandos úteis:

```powershell
# Reiniciar
pm2 restart bot-secretario

# Parar
pm2 stop bot-secretario

# Ver logs em tempo real
pm2 logs bot-secretario --lines 100
```

---

## 📊 DIFERENÇAS DOS DOIS BOTS

Agora você tem **DOIS BOTS** no projeto:

### 🤖 bot-whatsapp (index.js)
- **Para:** Clientes finais
- **Função:** Consultar serviços, horários, info do salão
- **Cria agendamento:** Não (orienta a entrar em contato)

### 🔒 bot-secretario.js (este)
- **Para:** Profissionais do salão
- **Função:** Receber notificações, consultar agendamentos
- **Acesso:** Restrito por CPF

**IMPORTANTE:** Você pode rodar os **dois ao mesmo tempo**!

```powershell
# Terminal 1
node index.js

# Terminal 2
node bot-secretario.js
```

Ou com PM2:

```powershell
pm2 start index.js --name bot-clientes
pm2 start bot-secretario.js --name bot-secretario
```

---

## 📝 PRÓXIMOS PASSOS

1. ✅ Teste o bot localmente
2. ✅ Integre com o PHP do sistema
3. ✅ Coloque em produção com PM2
4. ✅ Configure firewall se necessário
5. ✅ Monitore os logs

---

## 📞 SUPORTE

Problemas? Verifique:

1. **Logs do bot:** Terminal onde rodou `node bot-secretario.js`
2. **Logs do PHP:** `error_log` do Apache/Nginx
3. **Status do bot:** `curl http://localhost:3333/status`

---

**Desenvolvido para Salão Develoi**  
**Versão:** 1.0.0  
**Data:** Dezembro 2024

---

## 🎉 BOT SECRETÁRIO PRONTO!

**Agora seus profissionais recebem notificações instantâneas no WhatsApp! 📲✨**
