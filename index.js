// index.js - Bot WhatsApp Integrado com APIs Salão Develoi
const express = require('express');
const wppconnect = require('@wppconnect-team/wppconnect');
const SalaoAPI = require('./src/salaoAPI');
const ChatBot = require('./src/chatbot');

const app = express();
const PORT = process.env.PORT || 3000;

let clientInstance = null;
let chatBot = null;

// ========================================================================
// SERVIDOR HTTP
// ========================================================================

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Bot WhatsApp Develoi</title>
      <style>
        body { font-family: Arial; padding: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        .container { max-width: 600px; margin: 0 auto; background: white; color: #333; padding: 30px; border-radius: 20px; }
        h1 { color: #667eea; }
        .status { padding: 15px; border-radius: 10px; margin: 20px 0; }
        .online { background: #10b981; color: white; }
        .offline { background: #ef4444; color: white; }
        ul { line-height: 2; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🤖 Bot WhatsApp Salão Develoi</h1>
        <div class="status ${clientInstance ? 'online' : 'offline'}">
          Status: ${clientInstance ? '✅ Online e Pronto' : '❌ Offline'}
        </div>
        <h3>📱 Funcionalidades Disponíveis:</h3>
        <ul>
          <li>📅 Consultar agendamentos</li>
          <li>🕐 Ver horários livres</li>
          <li>✂️ Listar serviços e preços</li>
          <li>📍 Informações do salão</li>
          <li>💬 Atendimento automatizado 24/7</li>
        </ul>
        <p><strong>Para usar:</strong> Envie "Oi" ou "Menu" no WhatsApp cadastrado</p>
      </div>
    </body>
    </html>
  `);
});

// Rota para enviar mensagem manual
app.get('/send', async (req, res) => {
  if (!clientInstance) {
    return res.status(500).send('Cliente WPP ainda não está pronto');
  }

  const number = req.query.number;
  const message = req.query.msg || 'Olá! 🤖';

  if (!number) {
    return res.status(400).send('Parâmetro "number" é obrigatório');
  }

  try {
    await clientInstance.sendText(`${number}@c.us`, message);
    res.send(`Mensagem enviada para ${number}`);
  } catch (err) {
    console.error('Erro ao enviar mensagem:', err);
    res.status(500).send('Erro ao enviar mensagem');
  }
});

// ========================================================================
// INICIALIZA WPPCONNECT
// ========================================================================

wppconnect
  .create({
    session: 'bot-develoi',
    logQR: true,
    headless: true,
    catchQR: (base64Qr, asciiQR) => {
      console.log('\n📱 QR Code gerado! Escaneie com o WhatsApp:');
      console.log(asciiQR);
    },
    statusFind: (statusSession, session) => {
      console.log(`Status da sessão ${session}: ${statusSession}`);
    },
  })
  .then((client) => {
    clientInstance = client;
    chatBot = new ChatBot(client);
    
    console.log('\n✅ Cliente WPP conectado e pronto!');
    console.log('📱 Bot está aguardando mensagens...\n');

    // Escuta todas as mensagens recebidas
    client.onMessage(async (message) => {
      try {
        // Ignora mensagens de grupos e do próprio bot
        if (message.isGroupMsg || message.fromMe) return;

        console.log(`\n📨 Nova mensagem de ${message.from}:`);
        console.log(`   Conteúdo: ${message.body}`);

        // Processa a mensagem pelo chatbot
        await chatBot.processarMensagem(message);
      } catch (error) {
        console.error('❌ Erro ao processar mensagem:', error);
        
        // Envia mensagem de erro ao usuário
        await client.sendText(
          message.from,
          '❌ Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente em instantes.'
        );
      }
    });

    // Detecta quando alguém está digitando
    client.onAck((ack) => {
      // Você pode usar isso para mostrar feedback visual
    });

  })
  .catch((error) => {
    console.error('❌ Erro ao iniciar WPPConnect:', error);
    process.exit(1);
  });

// ========================================================================
// INICIA SERVIDOR
// ========================================================================

app.listen(PORT, () => {
  console.log(`\n🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`📡 Aguardando conexão do WhatsApp...\n`);
});

// Tratamento de erros não capturados
process.on('unhandledRejection', (error) => {
  console.error('❌ Erro não tratado:', error);
});

process.on('SIGINT', () => {
  console.log('\n👋 Encerrando bot...');
  if (clientInstance) {
    clientInstance.close();
  }
  process.exit(0);
});
