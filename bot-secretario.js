// bot-secretario.js
// ================================================
// BOT SECRETÁRIO EXCLUSIVO PARA PROFISSIONAIS
// - Notifica automaticamente novos agendamentos
// - Consulta agendamentos por CPF do profissional
// - NÃO atende clientes finais
// ================================================

const wppconnect = require('@wppconnect-team/wppconnect');
const express = require('express');
const fetch = require('node-fetch');

// =============================
// CONFIGURAÇÕES
// =============================

// URL da sua API
const API_BASE = 'https://salao.develoi.com/api/';

// Porta para o webhook HTTP (PHP vai chamar aqui)
const WEBHOOK_PORT = 3333;

// Mapa em memória: numeroWhats -> CPF
// Exemplo: '5511999998888@c.us' -> '12345678900'
const cpfPorNumero = {};

// Cliente global do WPPConnect
let clientGlobal = null;

// =============================
// FUNÇÕES AUXILIARES
// =============================

// Remove tudo que não é número
function soNumeros(str = '') {
  return (str || '').replace(/\D/g, '');
}

// Normaliza telefone para formato WhatsApp
// Entrada: '11999998888' ou '(11) 99999-8888'
// Saída: '5511999998888@c.us'
function normalizarNumeroWhats(telefoneBruto) {
  const nums = soNumeros(telefoneBruto);
  if (!nums) return null;

  // Se já tem código do país (55)
  if (nums.length === 13 && nums.startsWith('55')) {
    return nums + '@c.us';
  }

  // Se é só DDD + número (10 ou 11 dígitos)
  if (nums.length >= 10 && nums.length <= 11) {
    return '55' + nums + '@c.us';
  }

  return nums + '@c.us';
}

// Data de hoje no formato YYYY-MM-DD
function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

// Amanhã
function amanhaISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Chamada à API de agendamentos
async function chamarApiAgendamentos(cpf, filtros = {}) {
  const url = new URL(API_BASE);
  url.searchParams.set('action', 'agendamentos');

  if (filtros.data_inicio) url.searchParams.set('data_inicio', filtros.data_inicio);
  if (filtros.data_fim) url.searchParams.set('data_fim', filtros.data_fim);
  if (filtros.status) url.searchParams.set('status', filtros.status);
  if (filtros.limite) url.searchParams.set('limite', String(filtros.limite));
  if (filtros.offset) url.searchParams.set('offset', String(filtros.offset));

  try {
    const resp = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cpf}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await resp.json();
    return { ok: resp.ok && data.success, data };
  } catch (error) {
    console.error('Erro ao chamar API:', error);
    return { ok: false, data: { message: 'Erro de conexão com a API' } };
  }
}

// Formata lista de agendamentos para WhatsApp
function montarMensagemAgendamentos(tipoDescricao, lista) {
  if (!lista || lista.length === 0) {
    return `📅 Você não tem ${tipoDescricao}.`;
  }

  let msg = `📅 *${tipoDescricao.toUpperCase()}*\n\n`;

  lista.slice(0, 10).forEach((ag, i) => {
    const hora = ag.horario_formatado || ag.horario || '';
    const data = ag.data_agendamento_br || ag.data_agendamento || '';
    const cliente = ag.cliente_nome_completo || ag.cliente_nome || 'Cliente';
    const servico = ag.servico || 'Serviço';
    const valor = ag.valor ? `R$ ${Number(ag.valor).toFixed(2)}` : '';
    const status = ag.status || '';

    msg += `*${i + 1}. ${data} às ${hora}*\n`;
    msg += `👤 ${cliente}\n`;
    msg += `✂️ ${servico}`;
    if (valor) msg += ` - ${valor}`;
    msg += `\n📊 Status: ${status}\n`;
    if (ag.observacoes) {
      msg += `📝 ${ag.observacoes}\n`;
    }
    msg += `\n`;
  });

  if (lista.length > 10) {
    msg += `_+ ${lista.length - 10} agendamentos não exibidos_\n`;
  }

  return msg;
}

// =============================
// INICIALIZAÇÃO DO WPPCONNECT
// =============================

console.log('🤖 Iniciando Bot Secretário...\n');

wppconnect
  .create({
    session: 'BOT_SECRETARIO_SALAO_DEVELOI',
    logQR: true,
    headless: true,
    puppeteerOptions: {
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    },
    catchQR: (base64Qr, asciiQR) => {
      console.log('📱 QR Code gerado! Escaneie com o WhatsApp do profissional:');
      console.log(asciiQR);
    },
    statusFind: (statusSession, session) => {
      console.log(`Status da sessão: ${statusSession}`);
    }
  })
  .then((client) => {
    console.log('\n✅ Bot do WhatsApp conectado e pronto!');
    console.log('📱 Aguardando mensagens de profissionais...\n');
    clientGlobal = client;
    startBot(client);
  })
  .catch((err) => {
    console.error('❌ Erro ao iniciar WPPConnect:', err);
    process.exit(1);
  });

// =============================
// LÓGICA DO BOT (PROFISSIONAIS)
// =============================

function startBot(client) {
  client.onMessage(async (message) => {
    // Ignora mensagens de grupos
    if (message.isGroupMsg) return;
    
    // Ignora mensagens enviadas pelo próprio bot
    if (message.fromMe) return;

    const numero = message.from; // ex: 5511999998888@c.us
    const textoBruto = (message.body || '').trim();
    const texto = textoBruto.toLowerCase();

    console.log(`\n📨 Mensagem de ${numero}:`);
    console.log(`   Conteúdo: ${textoBruto}`);

    // ====================================
    // 1) PROFISSIONAL VINCULANDO CPF
    // ====================================
    
    const cpfNumeros = soNumeros(textoBruto);
    const pareceCPF = cpfNumeros.length === 11;

    if (texto.startsWith('cpf') || (pareceCPF && !cpfPorNumero[numero])) {
      const cpfLimpo = cpfNumeros;

      if (cpfLimpo.length !== 11) {
        await client.sendText(
          numero,
          '⚠️ *CPF inválido*\n\n' +
          'Me envie apenas os 11 dígitos do seu CPF ou escreva:\n\n' +
          '*CPF 12345678900*'
        );
        return;
      }

      // Salva o vínculo número <-> CPF
      cpfPorNumero[numero] = cpfLimpo;
      
      console.log(`   ✅ CPF ${cpfLimpo} vinculado ao número ${numero}`);

      await client.sendText(
        numero,
        `✅ *CPF vinculado com sucesso!*\n\n` +
        `Seu CPF *${cpfLimpo}* está agora vinculado ao seu número.\n\n` +
        `📋 *Comandos disponíveis:*\n\n` +
        `• *Agendamentos hoje*\n` +
        `• *Agendamentos amanhã*\n` +
        `• *Próximos agendamentos*\n` +
        `• *Todos os agendamentos*\n\n` +
        `💡 Você também receberá notificações automáticas sempre que um novo agendamento for criado no sistema!`
      );
      return;
    }

    // ====================================
    // 2) VERIFICAR SE CPF ESTÁ VINCULADO
    // ====================================
    
    const cpfSalvo = cpfPorNumero[numero];
    
    if (!cpfSalvo) {
      await client.sendText(
        numero,
        `👋 *Olá! Sou o Bot Secretário do Salão Develoi*\n\n` +
        `🔒 Este bot é *exclusivo para profissionais*.\n\n` +
        `Para começar, me envie o seu *CPF* (apenas números):\n\n` +
        `Exemplo: *12345678900*\n\n` +
        `_Clientes devem usar o sistema web para agendamentos._`
      );
      return;
    }

    console.log(`   🔑 CPF vinculado: ${cpfSalvo}`);

    // ====================================
    // 3) COMANDOS DE CONSULTA
    // ====================================

    // Agendamentos de HOJE (opção 1)
    if (
      texto.includes('agendamentos hoje') || 
      texto.includes('hoje') ||
      texto === 'hoje' ||
      texto === '1'
    ) {
      console.log('   📅 Consultando agendamentos de hoje...');
      
      await client.sendText(numero, '⏳ _Buscando agendamentos de hoje..._');
      
      const filtros = {
        data_inicio: hojeISO(),
        data_fim: hojeISO()
      };

      const { ok, data } = await chamarApiAgendamentos(cpfSalvo, filtros);

      if (!ok) {
        await client.sendText(
          numero,
          `❌ *Erro ao buscar agendamentos*\n\n` +
          `${data.message || 'Erro desconhecido'}\n\n` +
          `Digite *0* para voltar ao menu.`
        );
        return;
      }

      const lista = data.data?.agendamentos || [];
      const msg = montarMensagemAgendamentos('📅 Agendamentos de Hoje', lista);
      await client.sendText(numero, msg + `\n\n💡 Digite *0* para voltar ao menu.`);
      return;
    }

    // Agendamentos de AMANHÃ (opção 2)
    if (
      texto.includes('agendamentos amanhã') || 
      texto.includes('agendamentos amanha') ||
      texto.includes('amanhã') ||
      texto.includes('amanha') ||
      texto === '2'
    ) {
      console.log('   📅 Consultando agendamentos de amanhã...');
      
      await client.sendText(numero, '⏳ _Buscando agendamentos de amanhã..._');
      
      const filtros = {
        data_inicio: amanhaISO(),
        data_fim: amanhaISO()
      };

      const { ok, data } = await chamarApiAgendamentos(cpfSalvo, filtros);

      if (!ok) {
        await client.sendText(
          numero,
          `❌ *Erro ao buscar agendamentos*\n\n` +
          `${data.message || 'Erro desconhecido'}\n\n` +
          `Digite *0* para voltar ao menu.`
        );
        return;
      }

      const lista = data.data?.agendamentos || [];
      const msg = montarMensagemAgendamentos('📆 Agendamentos de Amanhã', lista);
      await client.sendText(numero, msg + `\n\n💡 Digite *0* para voltar ao menu.`);
      return;
    }

    // PRÓXIMOS agendamentos (opção 3)
    if (
      texto.includes('próximos') || 
      texto.includes('proximos') ||
      texto.includes('próximos agendamentos') ||
      texto.includes('proximos agendamentos') ||
      texto === '3'
    ) {
      console.log('   📅 Consultando próximos agendamentos...');
      
      await client.sendText(numero, '⏳ _Buscando próximos agendamentos..._');
      
      // Próximos 7 dias
      const hoje = new Date();
      const em7dias = new Date();
      em7dias.setDate(hoje.getDate() + 7);
      
      const filtros = {
        data_inicio: hojeISO(),
        data_fim: em7dias.toISOString().slice(0, 10),
        limite: 50
      };

      const { ok, data } = await chamarApiAgendamentos(cpfSalvo, filtros);

      if (!ok) {
        await client.sendText(
          numero,
          `❌ *Erro ao buscar agendamentos*\n\n` +
          `${data.message || 'Erro desconhecido'}\n\n` +
          `Digite *0* para voltar ao menu.`
        );
        return;
      }

      const lista = data.data?.agendamentos || [];
      const msg = montarMensagemAgendamentos('🔜 Próximos 7 Dias', lista);
      await client.sendText(numero, msg + `\n\n💡 Digite *0* para voltar ao menu.`);
      return;
    }

    // TODOS os agendamentos (opção 4)
    if (
      texto.includes('todos') || 
      texto.includes('todos os agendamentos') ||
      texto.includes('listar tudo') ||
      texto === '4'
    ) {
      console.log('   📅 Consultando todos os agendamentos...');
      
      await client.sendText(numero, '⏳ _Buscando todos os agendamentos..._');
      
      const filtros = {
        limite: 100
      };

      const { ok, data } = await chamarApiAgendamentos(cpfSalvo, filtros);

      if (!ok) {
        await client.sendText(
          numero,
          `❌ *Erro ao buscar agendamentos*\n\n` +
          `${data.message || 'Erro desconhecido'}\n\n` +
          `Digite *0* para voltar ao menu.`
        );
        return;
      }

      const lista = data.data?.agendamentos || [];
      const msg = montarMensagemAgendamentos('📋 Todos os Agendamentos', lista);
      await client.sendText(numero, msg + `\n\n💡 Digite *0* para voltar ao menu.`);
      return;
    }

    // ====================================
    // 4) MENU INTERATIVO COM BOTÕES
    // ====================================
    
    if (
      texto.includes('ajuda') || 
      texto === 'menu' || 
      texto === 'oi' || 
      texto === 'olá' ||
      texto === 'ola' ||
      texto === 'comandos' ||
      texto === '0'
    ) {
      // Menu com botões clicáveis
      const buttons = [
        { buttonId: '1', buttonText: { displayText: '📅 Hoje' } },
        { buttonId: '2', buttonText: { displayText: '📆 Amanhã' } },
        { buttonId: '3', buttonText: { displayText: '🔜 Próximos' } },
        { buttonId: '4', buttonText: { displayText: '📋 Todos' } }
      ];

      const buttonMessage = {
        text: `🤖 *Bot Secretário - Salão Develoi*\n\n` +
              `Olá! Sou seu assistente de agendamentos.\n\n` +
              `📱 *Escolha uma opção abaixo:*\n\n` +
              `📅 *1* - Agendamentos de hoje\n` +
              `📆 *2* - Agendamentos de amanhã\n` +
              `🔜 *3* - Próximos agendamentos (7 dias)\n` +
              `📋 *4* - Todos os agendamentos\n\n` +
              `🔔 *Você também recebe notificações automáticas quando:*\n` +
              `• Novo agendamento é criado\n` +
              `• Cliente confirma presença\n` +
              `• Lembrete 1h antes da consulta\n\n` +
              `💡 _Digite o número ou clique no botão!_`,
        buttons: buttons,
        headerType: 1
      };

      try {
        await client.sendMessageOptions(numero, buttonMessage);
      } catch (err) {
        // Fallback se botões não funcionarem
        await client.sendText(
          numero,
          `🤖 *Bot Secretário - Salão Develoi*\n\n` +
          `📱 *Digite o número da opção:*\n\n` +
          `📅 *1* - Agendamentos de hoje\n` +
          `📆 *2* - Agendamentos de amanhã\n` +
          `🔜 *3* - Próximos agendamentos (7 dias)\n` +
          `📋 *4* - Todos os agendamentos\n` +
          `0️⃣ *0* - Ver menu novamente\n\n` +
          `🔔 Você recebe notificações automáticas!\n\n` +
          `💡 _Digite apenas o número_`
        );
      }
      return;
    }

    // ====================================
    // 5) COMANDO NÃO RECONHECIDO
    // ====================================
    
    await client.sendText(
      numero,
      `🤔 *Não entendi...*\n\n` +
      `💡 *Digite um número:*\n\n` +
      `📅 *1* - Agendamentos de hoje\n` +
      `📆 *2* - Agendamentos de amanhã\n` +
      `🔜 *3* - Próximos 7 dias\n` +
      `📋 *4* - Todos os agendamentos\n` +
      `0️⃣ *0* - Ver menu completo\n\n` +
      `Ou envie *menu* para ver as opções.`
    );
  });
}

// =============================
// WEBHOOK PARA NOTIFICAÇÕES
// =============================

const app = express();
app.use(express.json());

// Endpoint que o PHP vai chamar quando criar novo agendamento
app.post('/webhook/novo-agendamento', async (req, res) => {
  try {
    console.log('\n📲 Webhook recebido: Novo agendamento!');
    
    if (!clientGlobal) {
      console.log('   ❌ Cliente WhatsApp ainda não está pronto');
      return res.status(500).json({ 
        success: false, 
        message: 'Cliente WhatsApp ainda não está pronto' 
      });
    }

    const {
      telefone_profissional,
      cliente_nome,
      cliente_telefone,
      servico,
      data,
      horario,
      valor,
      observacoes
    } = req.body || {};

    console.log('   Dados recebidos:', req.body);

    // Normaliza o número do profissional
    const numeroWhats = normalizarNumeroWhats(telefone_profissional);

    if (!numeroWhats) {
      console.log('   ⚠️ Telefone profissional inválido:', telefone_profissional);
      return res.status(400).json({ 
        success: false, 
        message: 'Telefone profissional inválido' 
      });
    }

    // Monta mensagem de notificação
    const msg =
      '🔔 *NOVO AGENDAMENTO RECEBIDO!*\n\n' +
      `📅 *Data:* ${data || 'Não informada'}\n` +
      `⏰ *Horário:* ${horario || 'Não informado'}\n` +
      `👤 *Cliente:* ${cliente_nome || 'Não informado'}\n` +
      (cliente_telefone ? `📞 *Telefone:* ${cliente_telefone}\n` : '') +
      `✂️ *Serviço:* ${servico || 'Não informado'}\n` +
      (valor ? `💰 *Valor:* R$ ${Number(valor).toFixed(2)}\n` : '') +
      (observacoes ? `📝 *Obs:* ${observacoes}\n` : '') +
      `\n_Abra o sistema para ver mais detalhes._`;

    // Envia notificação para o WhatsApp do profissional
    await clientGlobal.sendText(numeroWhats, msg);

    console.log(`   ✅ Notificação enviada para ${numeroWhats}`);
    
    return res.json({ 
      success: true,
      message: 'Notificação enviada com sucesso'
    });
    
  } catch (err) {
    console.error('   ❌ Erro no webhook:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro interno no bot' 
    });
  }
});

// =============================
// WEBHOOK: AGENDAMENTO CONFIRMADO
// =============================

// Endpoint que o PHP chama quando o profissional CONFIRMA um agendamento
app.post('/webhook/agendamento-confirmado', async (req, res) => {
  try {
    console.log('\n✅ Webhook recebido: Agendamento CONFIRMADO!');
    
    if (!clientGlobal) {
      console.log('   ❌ Cliente WhatsApp ainda não está pronto');
      return res.status(500).json({ 
        success: false, 
        message: 'Cliente WhatsApp ainda não está pronto' 
      });
    }

    const {
      telefone_cliente,
      cliente_nome,
      profissional_nome,
      estabelecimento,
      servico,
      data,
      horario,
      valor,
      observacoes
    } = req.body || {};

    console.log('   Dados recebidos:', req.body);

    // Normaliza o número do CLIENTE (quem VAI RECEBER a confirmação)
    const numeroWhats = normalizarNumeroWhats(telefone_cliente);

    if (!numeroWhats) {
      console.log('   ⚠️ Telefone cliente inválido:', telefone_cliente);
      return res.status(400).json({ 
        success: false, 
        message: 'Telefone cliente inválido' 
      });
    }

    // Formata data e horário para ficar mais legível
    let dataFormatada = data;
    if (data && data.includes('-')) {
      // Converte YYYY-MM-DD para DD/MM/YYYY
      const partes = data.split('-');
      if (partes.length === 3) {
        dataFormatada = `${partes[2]}/${partes[1]}/${partes[0]}`;
      }
    }

    let horaFormatada = horario;
    if (horario && horario.length >= 5) {
      horaFormatada = horario.substring(0, 5); // HH:MM
    }

    // Monta mensagem de CONFIRMAÇÃO para o CLIENTE
    const msg =
      '✅ *AGENDAMENTO CONFIRMADO!*\n\n' +
      `Olá *${cliente_nome}*! 👋\n\n` +
      `Seu agendamento foi confirmado com sucesso!\n\n` +
      `📍 *${estabelecimento || 'Salão'}*\n` +
      `👤 *Profissional:* ${profissional_nome || 'Não informado'}\n` +
      `✂️ *Serviço:* ${servico || 'Não informado'}\n` +
      `📅 *Data:* ${dataFormatada || 'Não informada'}\n` +
      `⏰ *Horário:* ${horaFormatada || 'Não informado'}\n` +
      (valor ? `💰 *Valor:* R$ ${Number(valor).toFixed(2)}\n` : '') +
      (observacoes ? `\n📝 *Observações:* ${observacoes}\n` : '') +
      `\n` +
      `_Estamos te esperando! Se precisar remarcar ou cancelar, entre em contato._\n\n` +
      `Até logo! 😊`;

    // Envia mensagem de confirmação para o WhatsApp do CLIENTE
    await clientGlobal.sendText(numeroWhats, msg);

    console.log(`   ✅ Confirmação enviada para cliente ${numeroWhats}`);
    
    return res.json({ 
      success: true,
      message: 'Confirmação enviada ao cliente com sucesso'
    });
    
  } catch (err) {
    console.error('   ❌ Erro no webhook de confirmação:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro interno no bot' 
    });
  }
});

// =============================
// WEBHOOK: LEMBRETE DE AGENDAMENTO
// =============================

// Endpoint para enviar lembretes automáticos (cliente E profissional)
app.post('/webhook/lembrete-agendamento', async (req, res) => {
  try {
    console.log('\n⏰ Webhook recebido: Lembrete de Agendamento!');
    
    if (!clientGlobal) {
      console.log('   ❌ Cliente WhatsApp ainda não está pronto');
      return res.status(500).json({ 
        success: false, 
        message: 'Cliente WhatsApp ainda não está pronto' 
      });
    }

    const {
      agendamento_id,
      telefone_profissional,
      telefone_cliente,
      cliente_nome,
      profissional_nome,
      estabelecimento,
      servico,
      data,
      horario,
      valor,
      observacoes,
      minutos_restantes,
      minutos_antes_configurado
    } = req.body || {};

    console.log('   Dados recebidos:', req.body);

    let enviados = 0;

    // Formata data e horário
    let dataFormatada = data;
    if (data && data.includes('-')) {
      const partes = data.split('-');
      if (partes.length === 3) {
        dataFormatada = `${partes[2]}/${partes[1]}/${partes[0]}`;
      }
    }

    let horaFormatada = horario;
    if (horario && horario.length >= 5) {
      horaFormatada = horario.substring(0, 5);
    }

    // Calcula tempo restante legível
    let tempoRestante = '';
    if (minutos_restantes < 60) {
      tempoRestante = `${minutos_restantes} minutos`;
    } else {
      const horas = Math.floor(minutos_restantes / 60);
      const mins = minutos_restantes % 60;
      tempoRestante = `${horas} hora${horas > 1 ? 's' : ''}${mins > 0 ? ` e ${mins} minutos` : ''}`;
    }

    // ====================================
    // ENVIAR PARA O CLIENTE
    // ====================================
    if (telefone_cliente) {
      const numeroCliente = normalizarNumeroWhats(telefone_cliente);
      
      if (numeroCliente) {
        const msgCliente =
          '⏰ *LEMBRETE DE AGENDAMENTO*\n\n' +
          `Olá *${cliente_nome}*! 👋\n\n` +
          `Você tem um agendamento em *${tempoRestante}*:\n\n` +
          `📍 *${estabelecimento || 'Salão'}*\n` +
          `👤 *Profissional:* ${profissional_nome || 'Não informado'}\n` +
          `✂️ *Serviço:* ${servico || 'Não informado'}\n` +
          `📅 *Data:* ${dataFormatada || 'Não informada'}\n` +
          `⏰ *Horário:* ${horaFormatada || 'Não informado'}\n` +
          (valor ? `💰 *Valor:* R$ ${Number(valor).toFixed(2)}\n` : '') +
          (observacoes ? `\n📝 *Observações:* ${observacoes}\n` : '') +
          `\n` +
          `_Estamos te esperando! Não se atrase! 😊_`;

        try {
          await clientGlobal.sendText(numeroCliente, msgCliente);
          console.log(`   ✅ Lembrete enviado para CLIENTE ${numeroCliente}`);
          enviados++;
        } catch (err) {
          console.error(`   ❌ Erro ao enviar para cliente:`, err.message);
        }
      }
    }

    // ====================================
    // ENVIAR PARA O PROFISSIONAL
    // ====================================
    if (telefone_profissional) {
      const numeroProfissional = normalizarNumeroWhats(telefone_profissional);
      
      if (numeroProfissional) {
        const msgProfissional =
          '⏰ *LEMBRETE: CONSULTA PRÓXIMA*\n\n' +
          `Você tem um agendamento em *${tempoRestante}*:\n\n` +
          `📅 *Data:* ${dataFormatada || 'Não informada'}\n` +
          `⏰ *Horário:* ${horaFormatada || 'Não informado'}\n` +
          `👤 *Cliente:* ${cliente_nome || 'Não informado'}\n` +
          (telefone_cliente ? `📞 *Telefone:* ${telefone_cliente}\n` : '') +
          `✂️ *Serviço:* ${servico || 'Não informado'}\n` +
          (valor ? `💰 *Valor:* R$ ${Number(valor).toFixed(2)}\n` : '') +
          (observacoes ? `\n📝 *Obs:* ${observacoes}\n` : '') +
          `\n` +
          `_Prepare-se para atender! 👨‍💼_`;

        try {
          await clientGlobal.sendText(numeroProfissional, msgProfissional);
          console.log(`   ✅ Lembrete enviado para PROFISSIONAL ${numeroProfissional}`);
          enviados++;
        } catch (err) {
          console.error(`   ❌ Erro ao enviar para profissional:`, err.message);
        }
      }
    }

    if (enviados === 0) {
      console.log('   ⚠️ Nenhum lembrete foi enviado (telefones inválidos)');
      return res.status(400).json({ 
        success: false, 
        message: 'Nenhum telefone válido para enviar lembrete' 
      });
    }

    return res.json({ 
      success: true,
      message: `${enviados} lembrete(s) enviado(s) com sucesso`,
      lembretes_enviados: enviados
    });
    
  } catch (err) {
    console.error('   ❌ Erro no webhook de lembrete:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro interno no bot' 
    });
  }
});

// =============================
// ENDPOINTS DE STATUS E TESTE
// =============================

// Status do bot
app.get('/status', (req, res) => {
  res.json({
    status: clientGlobal ? 'online' : 'offline',
    profissionais_vinculados: Object.keys(cpfPorNumero).length,
    timestamp: new Date().toISOString(),
    versao: '2.0',
    webhooks_disponiveis: [
      '/webhook/novo-agendamento',
      '/webhook/agendamento-confirmado',
      '/webhook/lembrete-agendamento'
    ],
    servidor: {
      porta: WEBHOOK_PORT,
      uptime_segundos: Math.floor(process.uptime())
    }
  });
});

// Teste de conectividade (para debugar problemas de produção)
app.post('/webhook/teste', (req, res) => {
  console.log('\n🧪 Webhook de TESTE recebido!');
  console.log('   IP de origem:', req.ip);
  console.log('   Headers:', req.headers);
  console.log('   Body:', req.body);
  
  res.json({
    success: true,
    message: 'Webhook de teste recebido com sucesso!',
    dados_recebidos: req.body,
    timestamp: new Date().toISOString(),
    ip_origem: req.ip
  });
});

app.listen(WEBHOOK_PORT, () => {
  console.log(`\n🌐 Webhook escutando na porta ${WEBHOOK_PORT}`);
  console.log(`📡 PHP pode enviar notificações para: http://localhost:${WEBHOOK_PORT}/webhook/novo-agendamento\n`);
});

// Tratamento de erros
process.on('unhandledRejection', (error) => {
  console.error('❌ Erro não tratado:', error);
});

process.on('SIGINT', () => {
  console.log('\n\n👋 Encerrando bot...');
  if (clientGlobal) {
    clientGlobal.close();
  }
  process.exit(0);
});
