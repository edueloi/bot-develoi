// src/chatbot.js - Lógica principal do chatbot
const SalaoAPI = require('./salaoAPI');
const config = require('../config');

class ChatBot {
  constructor(client) {
    this.client = client;
    this.api = new SalaoAPI();
    this.sessoes = new Map(); // Armazena estado da conversa de cada usuário
  }

  /**
   * Processa mensagem recebida
   * @param {object} message - Objeto da mensagem do WPPConnect
   */
  async processarMensagem(message) {
    const numero = message.from;
    const texto = message.body.trim().toLowerCase();

    // Recupera ou cria sessão do usuário
    let sessao = this.sessoes.get(numero);
    if (!sessao) {
      sessao = {
        estado: 'inicio',
        ultimaInteracao: new Date(),
        dados: {}
      };
      this.sessoes.set(numero, sessao);
    }

    // Atualiza tempo da última interação
    sessao.ultimaInteracao = new Date();

    // Detecta intenção do usuário
    const intencao = this.detectarIntencao(texto);

    console.log(`   🎯 Intenção detectada: ${intencao}`);

    // Processa com base na intenção
    switch (intencao) {
      case 'saudacao':
        await this.enviarBoasVindas(numero);
        break;

      case 'menu':
        await this.enviarMenu(numero);
        break;

      case 'servicos':
        await this.listarServicos(numero);
        break;

      case 'horarios':
        await this.consultarHorarios(numero, sessao);
        break;

      case 'agendamentos':
        await this.listarAgendamentos(numero);
        break;

      case 'info':
        await this.enviarInfoSalao(numero);
        break;

      case 'atendente':
        await this.chamarAtendente(numero);
        break;

      case 'despedida':
        await this.enviarDespedida(numero);
        break;

      case 'numero':
        // Usuário digitou um número (opção do menu)
        await this.processarOpcaoMenu(numero, texto);
        break;

      default:
        // Se estiver no meio de uma conversa, tenta processar contexto
        if (sessao.estado !== 'inicio') {
          await this.processarContexto(numero, texto, sessao);
        } else {
          await this.enviarComandoInvalido(numero);
        }
    }

    // Limpa sessões antigas (mais de 30 minutos)
    this.limparSessoesAntigas();
  }

  /**
   * Detecta a intenção do usuário com base no texto
   * @param {string} texto - Texto da mensagem
   * @returns {string} Intenção detectada
   */
  detectarIntencao(texto) {
    const palavras = config.palavrasChave;

    // Verifica saudações
    if (palavras.saudacoes.some(p => texto.includes(p))) {
      return 'saudacao';
    }

    // Verifica menu
    if (palavras.menu.some(p => texto.includes(p))) {
      return 'menu';
    }

    // Verifica serviços
    if (palavras.servicos.some(p => texto.includes(p))) {
      return 'servicos';
    }

    // Verifica horários
    if (palavras.horarios.some(p => texto.includes(p))) {
      return 'horarios';
    }

    // Verifica agendamentos
    if (palavras.agendamentos.some(p => texto.includes(p))) {
      return 'agendamentos';
    }

    // Verifica informações
    if (palavras.info.some(p => texto.includes(p))) {
      return 'info';
    }

    // Verifica atendente
    if (palavras.atendente.some(p => texto.includes(p))) {
      return 'atendente';
    }

    // Verifica despedida
    if (palavras.despedida.some(p => texto.includes(p))) {
      return 'despedida';
    }

    // Verifica se é um número (opção de menu)
    if (/^[1-5]$/.test(texto)) {
      return 'numero';
    }

    return 'desconhecido';
  }

  /**
   * Envia mensagem de boas-vindas
   */
  async enviarBoasVindas(numero) {
    await this.enviarMensagem(numero, config.mensagens.boasVindas);
    await this.delay(1000);
    await this.enviarMenu(numero);
  }

  /**
   * Envia menu principal
   */
  async enviarMenu(numero) {
    await this.enviarMensagem(numero, config.mensagens.menuPrincipal);
  }

  /**
   * Processa opção numérica do menu
   */
  async processarOpcaoMenu(numero, opcao) {
    switch (opcao) {
      case '1':
        await this.listarServicos(numero);
        break;
      case '2':
        await this.consultarHorarios(numero);
        break;
      case '3':
        await this.listarAgendamentos(numero);
        break;
      case '4':
        await this.enviarInfoSalao(numero);
        break;
      case '5':
        await this.chamarAtendente(numero);
        break;
      default:
        await this.enviarComandoInvalido(numero);
    }
  }

  /**
   * Lista todos os serviços
   */
  async listarServicos(numero) {
    await this.enviarMensagem(numero, config.mensagens.aguarde);

    const resultado = await this.api.buscarServicos();

    if (!resultado.success) {
      await this.enviarMensagem(numero, config.mensagens.erroAPI);
      return;
    }

    const texto = this.api.formatarServicos(resultado.data.servicos);
    await this.enviarMensagem(numero, texto);

    // Sugere próxima ação
    await this.delay(1500);
    await this.enviarMensagem(
      numero,
      '💬 Gostaria de consultar nossos horários disponíveis? Digite *2* ou *horários*'
    );
  }

  /**
   * Consulta horários livres
   */
  async consultarHorarios(numero, sessao = null) {
    // Se não tem sessão, cria uma
    if (!sessao) {
      sessao = this.sessoes.get(numero) || { estado: 'inicio', dados: {} };
      this.sessoes.set(numero, sessao);
    }

    // Pergunta a data se ainda não foi informada
    if (sessao.estado !== 'aguardando_data') {
      sessao.estado = 'aguardando_data';
      await this.enviarMensagem(
        numero,
        '📅 Para qual data você gostaria de consultar?\n\n' +
        'Responda com:\n' +
        '• *hoje* - para ver hoje\n' +
        '• *amanhã* - para ver amanhã\n' +
        '• *DD/MM/AAAA* - para uma data específica\n\n' +
        '_Exemplo: 25/12/2024_'
      );
      return;
    }
  }

  /**
   * Processa contexto da conversa
   */
  async processarContexto(numero, texto, sessao) {
    if (sessao.estado === 'aguardando_data') {
      await this.processarConsultaData(numero, texto, sessao);
    } else {
      await this.enviarComandoInvalido(numero);
    }
  }

  /**
   * Processa consulta de data para horários
   */
  async processarConsultaData(numero, texto, sessao) {
    let data = null;

    // Processa "hoje"
    if (texto.includes('hoje')) {
      data = new Date();
    }
    // Processa "amanhã"
    else if (texto.includes('amanhã') || texto.includes('amanha')) {
      data = new Date();
      data.setDate(data.getDate() + 1);
    }
    // Processa data no formato DD/MM/AAAA
    else if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(texto)) {
      const match = texto.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      data = new Date(match[3], match[2] - 1, match[1]);
    }

    if (!data || isNaN(data.getTime())) {
      await this.enviarMensagem(
        numero,
        '❌ Data inválida. Por favor, use o formato DD/MM/AAAA\n\n_Exemplo: 25/12/2024_'
      );
      return;
    }

    // Formata data para API
    const dataAPI = data.toISOString().split('T')[0];

    await this.enviarMensagem(numero, config.mensagens.aguarde);

    const resultado = await this.api.buscarHorariosLivres(dataAPI);

    if (!resultado.success) {
      await this.enviarMensagem(numero, config.mensagens.erroAPI);
      sessao.estado = 'inicio';
      return;
    }

    const textoHorarios = this.api.formatarHorariosLivres(resultado.data);
    await this.enviarMensagem(numero, textoHorarios);

    // Reseta estado
    sessao.estado = 'inicio';

    // Sugere agendar
    await this.delay(1500);
    await this.enviarMensagem(
      numero,
      '📞 Para agendar, entre em contato conosco!\n\nDigite *4* para ver nosso telefone e endereço.'
    );
  }

  /**
   * Lista agendamentos (requer telefone ou identificação do cliente)
   */
  async listarAgendamentos(numero) {
    await this.enviarMensagem(
      numero,
      '📋 *Consultar Agendamentos*\n\n' +
      'Por questões de segurança, para consultar seus agendamentos, ' +
      'por favor entre em contato diretamente conosco.\n\n' +
      '📞 Digite *4* para ver nosso telefone.'
    );
  }

  /**
   * Envia informações do salão
   */
  async enviarInfoSalao(numero) {
    await this.enviarMensagem(numero, config.mensagens.aguarde);

    const resultado = await this.api.buscarProfissional();

    if (!resultado.success) {
      await this.enviarMensagem(numero, config.mensagens.erroAPI);
      return;
    }

    const texto = this.api.formatarInfoSalao(resultado.data);
    await this.enviarMensagem(numero, texto);

    // Envia localização se tiver coordenadas (opcional)
    // await this.client.sendLocation(numero, latitude, longitude, 'Nosso endereço');
  }

  /**
   * Encaminha para atendente humano
   */
  async chamarAtendente(numero) {
    await this.enviarMensagem(
      numero,
      '👤 *Atendimento Humano*\n\n' +
      'Um momento, vou encaminhar você para um de nossos atendentes!\n\n' +
      '⏰ Horário de atendimento:\n' +
      'Segunda a Sexta: 9h às 18h\n' +
      'Sábado: 9h às 14h\n\n' +
      '_Aguarde que em breve alguém irá responder..._'
    );

    // Aqui você pode implementar notificação para o atendente
    // Ex: enviar para número do salão
  }

  /**
   * Envia mensagem de despedida
   */
  async enviarDespedida(numero) {
    await this.enviarMensagem(numero, config.mensagens.despedida);
    // Limpa sessão
    this.sessoes.delete(numero);
  }

  /**
   * Envia comando inválido
   */
  async enviarComandoInvalido(numero) {
    await this.enviarMensagem(numero, config.mensagens.comandoInvalido);
  }

  /**
   * Envia mensagem para um número
   */
  async enviarMensagem(numero, texto) {
    try {
      await this.client.sendText(numero, texto);
      console.log(`   ✅ Mensagem enviada para ${numero}`);
    } catch (error) {
      console.error(`   ❌ Erro ao enviar mensagem:`, error.message);
    }
  }

  /**
   * Delay para simular digitação
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Limpa sessões antigas (mais de 30 minutos sem interação)
   */
  limparSessoesAntigas() {
    const agora = new Date();
    const tempoLimite = 30 * 60 * 1000; // 30 minutos

    for (const [numero, sessao] of this.sessoes.entries()) {
      if (agora - sessao.ultimaInteracao > tempoLimite) {
        this.sessoes.delete(numero);
        console.log(`   🗑️ Sessão removida: ${numero}`);
      }
    }
  }
}

module.exports = ChatBot;
