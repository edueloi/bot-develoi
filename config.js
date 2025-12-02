// config.js - Configurações do Bot
require('dotenv').config();

module.exports = {
  // Configurações da API do Salão
  api: {
    // URL base da API (produção ou local)
    baseURL: process.env.API_BASE_URL || 'https://salao.develoi.com/api/',
    
    // CPF do profissional para autenticação (sem pontos e traços)
    cpf: process.env.SALAO_CPF || '12345678900',
    
    // Timeout para requisições (em ms)
    timeout: 10000
  },

  // Configurações do WhatsApp
  whatsapp: {
    // Nome da sessão
    session: 'bot-develoi',
    
    // Exibir QR Code no terminal
    logQR: true,
    
    // Modo headless (sem interface gráfica)
    headless: true,
    
    // Porta do servidor Express
    port: process.env.PORT || 3000
  },

  // Mensagens padrão do bot
  mensagens: {
    boasVindas: `🎉 *Bem-vindo ao Salão Develoi!*\n\nSou o assistente virtual e estou aqui para ajudar você 24 horas por dia! 💇‍♀️✨\n\nDigite *menu* para ver todas as opções disponíveis.`,
    
    menuPrincipal: `📋 *MENU PRINCIPAL*\n\n` +
      `1️⃣ - Ver serviços e preços\n` +
      `2️⃣ - Consultar horários livres\n` +
      `3️⃣ - Meus agendamentos\n` +
      `4️⃣ - Informações do salão\n` +
      `5️⃣ - Falar com atendente\n\n` +
      `_Digite o número da opção desejada_`,
    
    erroAPI: '❌ Desculpe, não consegui acessar as informações no momento. Tente novamente em instantes.',
    
    comandoInvalido: '🤔 Desculpe, não entendi seu comando.\n\nDigite *menu* para ver as opções disponíveis.',
    
    aguarde: '⏳ Aguarde um momento, estou consultando...',
    
    despedida: '👋 Obrigado por usar nosso atendimento! Até logo!'
  },

  // Palavras-chave para detectar intenções
  palavrasChave: {
    saudacoes: ['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'alo', 'alô'],
    menu: ['menu', 'opções', 'opcoes', 'ajuda', 'help', 'comandos'],
    servicos: ['serviços', 'servicos', 'serviço', 'servico', 'preço', 'preco', 'valor', 'quanto custa'],
    horarios: ['horário', 'horario', 'horários', 'horarios', 'disponível', 'disponivel', 'livre', 'vago'],
    agendamentos: ['agendamento', 'agendamentos', 'marcação', 'marcacao', 'consulta', 'appointment'],
    info: ['endereço', 'endereco', 'localização', 'localizacao', 'telefone', 'contato', 'instagram'],
    atendente: ['atendente', 'humano', 'pessoa', 'falar com alguém', 'falar com alguem'],
    despedida: ['tchau', 'adeus', 'até logo', 'ate logo', 'obrigado', 'obrigada', 'valeu']
  }
};
