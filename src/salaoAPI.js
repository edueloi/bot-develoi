// src/salaoAPI.js - Cliente para consumir APIs do Salão Develoi
const config = require('../config');

class SalaoAPI {
  constructor() {
    this.baseURL = config.api.baseURL;
    this.cpf = config.api.cpf;
    this.timeout = config.api.timeout;
  }

  /**
   * Faz requisição GET à API
   * @param {string} action - Ação da API (agendamentos, servicos, etc)
   * @param {object} params - Parâmetros adicionais
   * @returns {Promise<object>} Resposta da API
   */
  async fazerRequisicao(action, params = {}) {
    try {
      // Monta URL com parâmetros
      const url = new URL(this.baseURL);
      url.searchParams.append('action', action);
      
      // Adiciona parâmetros extras
      for (const [key, value] of Object.entries(params)) {
        if (value !== null && value !== undefined && value !== '') {
          url.searchParams.append(key, value);
        }
      }

      console.log(`   🌐 API Request: ${action}`);

      // Faz a requisição
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.cpf}`,
          'Content-Type': 'application/json'
        },
        timeout: this.timeout
      });

      const data = await response.json();

      if (!data.success) {
        console.error(`   ❌ Erro na API: ${data.message}`);
        return { success: false, error: data.message };
      }

      console.log(`   ✅ API Response: OK`);
      return { success: true, data: data.data };

    } catch (error) {
      console.error(`   ❌ Erro ao fazer requisição:`, error.message);
      return { 
        success: false, 
        error: 'Não foi possível se conectar à API do salão' 
      };
    }
  }

  /**
   * Busca todos os serviços disponíveis
   * @returns {Promise<object>}
   */
  async buscarServicos() {
    return await this.fazerRequisicao('servicos');
  }

  /**
   * Busca serviços por tipo (simples ou pacote)
   * @param {string} tipo - 'simples' ou 'pacote'
   * @returns {Promise<object>}
   */
  async buscarServicosPorTipo(tipo) {
    return await this.fazerRequisicao('servicos', { tipo });
  }

  /**
   * Busca horários livres para uma data
   * @param {string} data - Data no formato YYYY-MM-DD
   * @param {number} duracao - Duração em minutos (padrão: 60)
   * @returns {Promise<object>}
   */
  async buscarHorariosLivres(data, duracao = 60) {
    return await this.fazerRequisicao('horarios_livres', { data, duracao });
  }

  /**
   * Busca agendamentos com filtros
   * @param {object} filtros - { data_inicio, data_fim, status }
   * @returns {Promise<object>}
   */
  async buscarAgendamentos(filtros = {}) {
    return await this.fazerRequisicao('agendamentos', filtros);
  }

  /**
   * Busca informações do profissional/estabelecimento
   * @returns {Promise<object>}
   */
  async buscarProfissional() {
    return await this.fazerRequisicao('profissional');
  }

  /**
   * Busca clientes (com busca opcional)
   * @param {string} busca - Termo de busca (nome ou telefone)
   * @returns {Promise<object>}
   */
  async buscarClientes(busca = '') {
    return await this.fazerRequisicao('clientes', { busca });
  }

  /**
   * Formata lista de serviços para exibição no WhatsApp
   * @param {array} servicos - Array de serviços
   * @returns {string} Texto formatado
   */
  formatarServicos(servicos) {
    if (!servicos || servicos.length === 0) {
      return '❌ Nenhum serviço cadastrado no momento.';
    }

    let texto = '✂️ *NOSSOS SERVIÇOS*\n\n';

    // Separa por tipo
    const simples = servicos.filter(s => s.tipo === 'simples');
    const pacotes = servicos.filter(s => s.tipo === 'pacote');

    if (simples.length > 0) {
      texto += '📌 *Serviços Individuais:*\n\n';
      simples.forEach((servico, idx) => {
        texto += `${idx + 1}. *${servico.nome}*\n`;
        texto += `   💰 R$ ${parseFloat(servico.preco).toFixed(2)}\n`;
        texto += `   ⏱️ ${servico.duracao_minutos} min\n`;
        if (servico.descricao) {
          texto += `   📝 ${servico.descricao}\n`;
        }
        texto += '\n';
      });
    }

    if (pacotes.length > 0) {
      texto += '\n🎁 *Pacotes Especiais:*\n\n';
      pacotes.forEach((pacote, idx) => {
        texto += `${idx + 1}. *${pacote.nome}*\n`;
        texto += `   💰 R$ ${parseFloat(pacote.preco).toFixed(2)}\n`;
        texto += `   ⏱️ ${pacote.duracao_minutos} min\n`;
        if (pacote.descricao) {
          texto += `   📝 ${pacote.descricao}\n`;
        }
        texto += '\n';
      });
    }

    texto += '\n_Para agendar, consulte nossos horários disponíveis!_';
    return texto;
  }

  /**
   * Formata horários livres para exibição
   * @param {object} dados - Objeto com data e horarios_livres
   * @returns {string} Texto formatado
   */
  formatarHorariosLivres(dados) {
    if (!dados.horarios_livres || dados.horarios_livres.length === 0) {
      return `❌ Não há horários disponíveis para ${this.formatarDataBR(dados.data)}`;
    }

    let texto = `📅 *HORÁRIOS DISPONÍVEIS*\n`;
    texto += `Data: ${this.formatarDataBR(dados.data)}\n`;
    texto += `Duração: ${dados.duracao_servico} minutos\n\n`;

    dados.horarios_livres.forEach((horario, idx) => {
      texto += `${idx + 1}. ${horario}\n`;
    });

    texto += `\n_Total: ${dados.total_slots} horários disponíveis_`;
    return texto;
  }

  /**
   * Formata informações do salão para exibição
   * @param {object} dados - Dados do profissional
   * @returns {string} Texto formatado
   */
  formatarInfoSalao(dados) {
    let texto = `📍 *${dados.estabelecimento.toUpperCase()}*\n\n`;
    
    if (dados.tipo_estabelecimento) {
      texto += `🏢 ${dados.tipo_estabelecimento}\n\n`;
    }

    if (dados.endereco) {
      texto += `📍 *Endereço:*\n`;
      texto += `${dados.endereco}`;
      if (dados.numero) texto += `, ${dados.numero}`;
      if (dados.bairro) texto += `\n${dados.bairro}`;
      if (dados.cidade && dados.estado) texto += `\n${dados.cidade} - ${dados.estado}`;
      if (dados.cep) texto += `\nCEP: ${dados.cep}`;
      texto += '\n\n';
    }

    if (dados.telefone) {
      texto += `📞 *Telefone:*\n${dados.telefone}\n\n`;
    }

    if (dados.instagram) {
      texto += `📸 *Instagram:*\n@${dados.instagram}\n\n`;
    }

    if (dados.biografia) {
      texto += `ℹ️ *Sobre nós:*\n${dados.biografia}\n`;
    }

    return texto;
  }

  /**
   * Formata agendamentos para exibição
   * @param {array} agendamentos - Array de agendamentos
   * @returns {string} Texto formatado
   */
  formatarAgendamentos(agendamentos) {
    if (!agendamentos || agendamentos.length === 0) {
      return '❌ Você não possui agendamentos.';
    }

    let texto = '📅 *SEUS AGENDAMENTOS*\n\n';

    agendamentos.forEach((ag, idx) => {
      texto += `${idx + 1}. *${ag.servico}*\n`;
      texto += `   📅 ${ag.data_agendamento_br}\n`;
      texto += `   🕐 ${ag.horario_formatado}\n`;
      texto += `   💰 R$ ${parseFloat(ag.valor).toFixed(2)}\n`;
      texto += `   📊 Status: ${ag.status}\n`;
      if (ag.observacoes) {
        texto += `   📝 ${ag.observacoes}\n`;
      }
      texto += '\n';
    });

    return texto;
  }

  /**
   * Formata data para padrão brasileiro
   * @param {string} data - Data no formato YYYY-MM-DD
   * @returns {string} Data formatada DD/MM/YYYY
   */
  formatarDataBR(data) {
    if (!data) return '';
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  /**
   * Converte data BR para formato da API
   * @param {string} dataBR - Data no formato DD/MM/YYYY
   * @returns {string} Data no formato YYYY-MM-DD
   */
  converterDataAPI(dataBR) {
    const [dia, mes, ano] = dataBR.split('/');
    return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }
}

module.exports = SalaoAPI;
