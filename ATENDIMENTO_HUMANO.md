# 🤖 Sistema de Atendimento Humano - Bot Salão Develoi

## 📋 Visão Geral

O bot agora possui um sistema completo de **atendimento humano** com redirecionamento para:
- **Suporte Técnico**: Eduardo Eloi (15) 99267-5429
- **Vendas**: Karen Gomes (15) 99134-5333

## 🎯 Fluxo de Atendimento

### 1️⃣ Menu Inicial (Cliente)
Quando alguém envia a primeira mensagem, recebe:

```
Bom dia/Boa tarde/Boa noite! Seja bem-vindo(a)! 👋

Sou o assistente virtual do Salão Develoi.

══════════════════════
COMO PODEMOS AJUDAR?

1 - Sou cliente (consultar agendamentos)
2 - Suporte técnico
3 - Falar com vendas

══════════════════════
Digite o número da opção desejada.
```

### 2️⃣ Opção 1: Cliente (CPF)
- Cliente digita **1**
- Bot solicita CPF
- Cliente entra na área de agendamentos normal
- Pode digitar **SUPORTE** ou **VENDAS** a qualquer momento

### 3️⃣ Opção 2: Suporte Técnico
Cliente digita **2** → Bot avisa:
```
SUPORTE TÉCNICO 🛠️

Conectando você com nossa equipe...
Aguarde um momento, por favor.
```

**Eduardo recebe notificação:**
```
🔔 NOVA SOLICITAÇÃO DE SUPORTE

Cliente: 5511999998888@c.us

══════════════════════
ACEITAR ATENDIMENTO?

1 - Aceitar
RECUSA - Recusar

══════════════════════
```

**Eduardo escolhe:**
- **1** = Aceita → Atendimento iniciado
- **RECUSA** = Recusa → Cliente é informado

### 4️⃣ Opção 3: Vendas
Mesmo fluxo do suporte, mas envia para **Karen**

---

## 💬 Durante o Atendimento

### Para o Cliente:
Quando atendimento é aceito, recebe:
```
ATENDIMENTO INICIADO ✅

Olá! Sou Eduardo/Karen e vou te atender agora.

Fique à vontade para fazer suas perguntas! 😊
```

Todas as mensagens do cliente vão **direto** para o atendente.

### Para o Atendente (Eduardo ou Karen):
Quando aceita com **1**, recebe:
```
✅ ATENDIMENTO ACEITO!

Você está conectado(a) ao cliente 5511999998888@c.us

Para encerrar, digite: SAIR_BOT
```

Mensagens do cliente chegam assim:
```
[CLIENTE]: Olá, preciso de ajuda com...
```

Atendente responde normalmente. Mensagens vão direto para o cliente.

---

## 🛑 Encerrando Atendimento

### Atendente Encerra:
Digite **SAIR_BOT**

Cliente recebe:
```
ATENDIMENTO ENCERRADO

Obrigado por entrar em contato! 😊

Se precisar de algo mais, estamos à disposição.

Digite 0 para voltar ao menu principal.
```

### Atendente Recusa:
Digite **RECUSA**

Cliente recebe:
```
ATENDIMENTO INDISPONÍVEL

Desculpe, não conseguimos atender no momento.

Por favor, tente novamente mais tarde.

Digite 0 para voltar ao menu.
```

---

## 🎮 Comandos Especiais

### Para Clientes (qualquer momento):
- **SUPORTE** ou **falar com suporte** → Abre chamado para Eduardo
- **VENDAS** ou **falar com vendas** → Abre chamado para Karen
- **0** → Volta ao menu principal
- **CPF** → Troca de profissional

### Para Atendentes:
- **1** → Aceita atendimento pendente
- **RECUSA** → Recusa atendimento pendente
- **SAIR_BOT** → Encerra atendimento atual
- Qualquer outra mensagem → Envia para o cliente

---

## 🔧 Configuração Técnica

### Números Configurados (bot-secretario.js):
```javascript
const NUMERO_SUPORTE = '5515992675429@c.us';  // Eduardo Eloi
const NUMERO_VENDAS = '5515991345333@c.us';   // Karen Gomes
```

### Estrutura de Sessões:
```javascript
sessoesAtendimento[numeroCliente] = {
  tipo: 'suporte' ou 'vendas',
  atendente: NUMERO_SUPORTE ou NUMERO_VENDAS,
  iniciado: false // true após aceitar
}
```

---

## 📊 Exemplos de Uso

### Exemplo 1: Cliente precisa de suporte
1. Cliente envia "Oi"
2. Bot mostra menu (1, 2, 3)
3. Cliente digita **2**
4. Eduardo recebe notificação
5. Eduardo digita **1**
6. Atendimento inicia
7. Conversa acontece
8. Eduardo digita **SAIR_BOT**
9. Cliente recebe agradecimento

### Exemplo 2: Cliente já está usando bot e quer vendas
1. Cliente está consultando agendamentos
2. Cliente digita **VENDAS**
3. Karen recebe notificação
4. Karen aceita com **1**
5. Cliente conectado com Karen
6. Conversa acontece
7. Karen encerra com **SAIR_BOT**

### Exemplo 3: Atendente ocupado
1. Cliente solicita suporte
2. Eduardo recebe notificação
3. Eduardo digita **RECUSA**
4. Cliente recebe aviso de indisponibilidade
5. Cliente pode tentar novamente depois

---

## ⚠️ Observações Importantes

1. **Uma sessão por vez**: Cliente só pode estar em 1 atendimento simultâneo
2. **Mensagens diretas**: Tudo que cliente enviar vai para atendente (e vice-versa)
3. **Saudação automática**: Bot identifica horário e usa "Bom dia", "Boa tarde" ou "Boa noite"
4. **Logs detalhados**: Todas as ações ficam registradas no console
5. **Persistência**: Sessões ficam ativas até encerramento manual

---

## 🚀 Testando o Sistema

### Teste Completo:
1. **Como Cliente**:
   - Envie "Oi" para o bot
   - Escolha opção 2 (Suporte)
   
2. **Como Eduardo**:
   - Receba notificação
   - Digite **1** para aceitar
   - Envie mensagens de teste
   - Digite **SAIR_BOT** para encerrar

3. **Repita para Vendas** (opção 3)

### Verificar Logs:
```
📞 Solicitação de suporte de 5511999998888@c.us
✅ Atendimento suporte iniciado por Eduardo
🔄 Redirecionando mensagem para suporte
✅ Atendimento encerrado por 5515992675429@c.us
```

---

## 📱 Números de Contato

**Suporte Técnico**
- Nome: Eduardo Eloi
- WhatsApp: (15) 99267-5429
- Número formatado: 5515992675429@c.us

**Vendas**
- Nome: Karen Gomes  
- WhatsApp: (15) 99134-5333
- Número formatado: 5515991345333@c.us

---

## 🎨 Melhorias Implementadas

✅ Saudação por horário (Bom dia/Boa tarde/Boa noite)
✅ Menu inicial com 3 opções claras
✅ Redirecionamento bidirecional de mensagens
✅ Sistema de aceite/recusa para atendentes
✅ Encerramento controlado pelo atendente
✅ Comandos disponíveis a qualquer momento
✅ Mensagens formatadas e profissionais
✅ Logs detalhados para debug
✅ Fallback para quando atendente está indisponível

---

## 🔄 Próximas Melhorias Possíveis

- [ ] Fila de espera para múltiplos clientes
- [ ] Tempo limite para aceite (auto-recusa após X minutos)
- [ ] Histórico de atendimentos
- [ ] Estatísticas de atendimento
- [ ] Transferência entre atendentes
- [ ] Mensagens automáticas de horário de funcionamento
- [ ] Integração com CRM
