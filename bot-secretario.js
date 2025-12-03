// bot-secretario.js
// ================================================
// BOT SECRETÁRIO EXCLUSIVO PARA PROFISSIONAIS
// - Notifica automaticamente novos agendamentos
// - Consulta agendamentos por CPF do profissional
// - NÃO atende clientes finais
// - IA integrada para entender linguagem natural
// ================================================

require('dotenv').config();
const wppconnect = require('@wppconnect-team/wppconnect');
const express = require('express');
const fetch = require('node-fetch');
const OpenAI = require('openai');

// =============================
// CONFIGURAÇÕES
// =============================

// URL da sua API
const API_BASE = 'https://salao.develoi.com/api/';

// Porta para o webhook HTTP (PHP vai chamar aqui)
const WEBHOOK_PORT = 80;

// Números de atendimento humano
const NUMERO_SUPORTE = '5515992675429@c.us';  // Eduardo Eloi
const NUMERO_VENDAS = '5515991345333@c.us';   // Karen Gomes

// Mapa em memória: numeroWhats -> CPF
// Exemplo: '5511999998888@c.us' -> '12345678900'
const cpfPorNumero = {};

// Sessões de atendimento ativas: numeroCliente -> { tipo, atendente, iniciado }
const sessoesAtendimento = {};

// Lembretes personalizados: { id, numero, mensagem, dataHora, enviado }
const lembretes = [];
let proximoIdLembrete = 1;

// Sessões de criação de lembrete para cliente: numeroProf -> { etapa, agendamentos, agendamentoSelecionado }
const sessoesCriacaoLembreteCliente = {};

// Cliente global do WPPConnect
let clientGlobal = null;

// Cliente OpenAI para IA
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// =============================
// FUNÇÕES AUXILIARES
// =============================

// Processar mensagem com IA (GPT-4)
async function processarComIA(mensagemUsuario, cpfProfissional, contextoAgendamentos = null) {
  try {
    const prompt = `Você é um assistente virtual de um salão de beleza. Analise a mensagem do profissional e identifique a intenção.

Profissional (CPF: ${cpfProfissional}) perguntou: "${mensagemUsuario}"

${contextoAgendamentos ? `\n\nCONTEXTO DOS AGENDAMENTOS:\n${JSON.stringify(contextoAgendamentos, null, 2)}` : ''}

RETORNE UM JSON com:
{
  "intencao": "consultar_hoje" | "consultar_amanha" | "consultar_semana" | "consultar_todos" | "calcular_faturamento" | "contar_clientes" | "verificar_horario" | "desconhecido",
  "filtros": {
    "data_inicio": "YYYY-MM-DD" (opcional),
    "data_fim": "YYYY-MM-DD" (opcional),
    "periodo": "manha" | "tarde" | "noite" (opcional),
    "status": "confirmado" | "pendente" | "cancelado" (opcional)
  },
  "resposta_sugerida": "texto amigável baseado nos dados" (se houver contexto)
}

Exemplos:
- "tenho cliente hoje?" → intencao: "consultar_hoje"
- "quem vem amanhã de tarde?" → intencao: "consultar_amanha", filtros: {periodo: "tarde"}
- "quanto vou ganhar essa semana?" → intencao: "calcular_faturamento", filtros: {data_inicio: "data_inicio_semana", data_fim: "data_fim_semana"}

Responda APENAS com o JSON, sem explicações.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { 
          role: "system", 
          content: "Você é um assistente especializado em interpretar perguntas de profissionais de salão de beleza sobre seus agendamentos. Retorne sempre JSON válido." 
        },
        { 
          role: "user", 
          content: prompt 
        }
      ],
      temperature: 0.3,
      max_tokens: 500
    });

    const respostaIA = completion.choices[0].message.content.trim();
    console.log('   🤖 Resposta da IA:', respostaIA);

    // Parse do JSON
    const jsonMatch = respostaIA.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return { intencao: 'desconhecido' };
  } catch (error) {
    console.error('   ❌ Erro ao processar com IA:', error.message);
    return { intencao: 'desconhecido' };
  }
}

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

// Saudação baseada no horário
function saudacaoPorHorario() {
  const hora = new Date().getHours();
  // 5h às 11h59 = Bom dia
  if (hora >= 5 && hora < 12) return 'Bom dia';
  // 12h às 18h = Boa tarde
  if (hora >= 12 && hora <= 18) return 'Boa tarde';
  // 18h01 às 4h59 = Boa noite
  return 'Boa noite';
}

// Formatar data para português (ex: "07 de maio de 2026")
function formatarDataPtBr(dataISO) {
  if (!dataISO) return 'Data não informada';
  
  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  
  try {
    // Suporta formato YYYY-MM-DD ou DD/MM/YYYY
    let dia, mes, ano;
    
    if (dataISO.includes('-')) {
      // Formato: 2026-05-07
      const partes = dataISO.split('-');
      ano = partes[0];
      mes = parseInt(partes[1]) - 1;
      dia = partes[2];
    } else if (dataISO.includes('/')) {
      // Formato: 07/05/2026
      const partes = dataISO.split('/');
      dia = partes[0];
      mes = parseInt(partes[1]) - 1;
      ano = partes[2];
    } else {
      return dataISO;
    }
    
    return `${dia} de ${meses[mes]} de ${ano}`;
  } catch (err) {
    return dataISO;
  }
}

// Criar lembrete personalizado
function criarLembrete(numero, mensagem, dataHora) {
  const lembrete = {
    id: proximoIdLembrete++,
    numero: numero,
    mensagem: mensagem,
    dataHora: dataHora,
    enviado: false,
    criadoEm: new Date()
  };
  
  lembretes.push(lembrete);
  console.log(`   ⏰ Lembrete #${lembrete.id} criado para ${numero} em ${dataHora.toLocaleString('pt-BR')}`);
  return lembrete;
}

// Processar quando enviar lembrete (para cliente) com IA
async function processarQuandoLembreteCliente(mensagem) {
  try {
    const agora = new Date();
    const prompt = `Analise a mensagem e calcule QUANDO enviar o lembrete.

Mensagem: "${mensagem}"

Data/hora atual: ${agora.toLocaleString('pt-BR')}

RETORNE UM JSON com:
{
  "valido": true | false,
  "quando_texto": "hoje às 15h" | "amanhã às 9h" | "daqui 2 horas",
  "dataHora": "YYYY-MM-DD HH:MM:SS" (calculado baseado em AGORA)
}

Exemplos:
- "hoje 15h" → valido: true, dataHora calculada para hoje 15:00
- "amanhã 9h" → valido: true, dataHora calculada para amanhã 09:00  
- "daqui 2 horas" → valido: true, dataHora = agora + 2 horas
- "daqui 30 minutos" → valido: true, dataHora = agora + 30 min

Responda APENAS JSON válido.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { 
          role: "system", 
          content: "Você é especialista em interpretar horários em português e calcular datas. Sempre calcule baseado no momento atual fornecido." 
        },
        { 
          role: "user", 
          content: prompt 
        }
      ],
      temperature: 0.2,
      max_tokens: 200
    });

    const respostaIA = completion.choices[0].message.content.trim();
    const jsonMatch = respostaIA.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return { valido: false };
  } catch (error) {
    console.error('   ❌ Erro ao processar quando lembrete:', error.message);
    return { valido: false };
  }
}

// Processar comando de lembrete com IA
async function processarComandoLembrete(mensagem) {
  try {
    const prompt = `Analise a mensagem e extraia informações de lembrete.

Mensagem: "${mensagem}"

Data/hora atual: ${new Date().toLocaleString('pt-BR')}

RETORNE UM JSON com:
{
  "eh_lembrete": true | false,
  "quando": "em X minutos" | "hoje às HH:MM" | "amanhã às HH:MM" | "dia DD/MM às HH:MM",
  "dataHora": "YYYY-MM-DD HH:MM:SS" (calculado),
  "mensagem_lembrete": "texto do que lembrar"
}

Exemplos:
- "lembre-me daqui 15 minutos" → eh_lembrete: true, quando: "em 15 minutos"
- "lembrete amanhã 14h" → eh_lembrete: true, quando: "amanhã às 14:00"
- "me avise hoje às 18h" → eh_lembrete: true, quando: "hoje às 18:00"
- "lembrar reunião daqui 30min" → eh_lembrete: true, quando: "em 30 minutos"

Se não for comando de lembrete, retorne eh_lembrete: false.

Responda APENAS com JSON válido.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { 
          role: "system", 
          content: "Você é especialista em interpretar comandos de lembretes em português. Calcule datas/horas corretamente baseado no momento atual." 
        },
        { 
          role: "user", 
          content: prompt 
        }
      ],
      temperature: 0.2,
      max_tokens: 300
    });

    const respostaIA = completion.choices[0].message.content.trim();
    const jsonMatch = respostaIA.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return { eh_lembrete: false };
  } catch (error) {
    console.error('   ❌ Erro ao processar lembrete com IA:', error.message);
    return { eh_lembrete: false };
  }
}

// Verificar e enviar lembretes pendentes (executa a cada minuto)
async function verificarLembretes(client) {
  const agora = new Date();
  
  for (const lembrete of lembretes) {
    if (!lembrete.enviado && lembrete.dataHora <= agora) {
      try {
        const mensagemLembrete = 
          `⏰ *LEMBRETE!*\n\n` +
          `${lembrete.mensagem}\n\n` +
          `──────────────────\n` +
          `_Lembrete criado em ${lembrete.criadoEm.toLocaleString('pt-BR')}_`;
        
        await client.sendText(lembrete.numero, mensagemLembrete);
        lembrete.enviado = true;
        
        console.log(`   ✅ Lembrete #${lembrete.id} enviado para ${lembrete.numero}`);
      } catch (error) {
        console.error(`   ❌ Erro ao enviar lembrete #${lembrete.id}:`, error.message);
      }
    }
  }
  
  // Limpar lembretes antigos (mais de 24h enviados)
  const umDiaAtras = new Date(agora.getTime() - 24 * 60 * 60 * 1000);
  const indiceParaRemover = [];
  
  lembretes.forEach((lembrete, index) => {
    if (lembrete.enviado && lembrete.dataHora < umDiaAtras) {
      indiceParaRemover.push(index);
    }
  });
  
  // Remover de trás para frente para não bagunçar os índices
  for (let i = indiceParaRemover.length - 1; i >= 0; i--) {
    lembretes.splice(indiceParaRemover[i], 1);
  }
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
    return `*${tipoDescricao}*\n\nVocê não possui agendamentos neste período.`;
  }

  let msg = `*${tipoDescricao}*\n`;
  msg += `══════════════════════\n\n`;

  lista.slice(0, 10).forEach((ag, i) => {
    const hora = ag.horario_formatado || ag.horario || '';
    const data = ag.data_agendamento_br || ag.data_agendamento || '';
    const cliente = ag.cliente_nome_completo || ag.cliente_nome || 'Cliente';
    const servico = ag.servico || 'Serviço';
    const valor = ag.valor ? `R$ ${Number(ag.valor).toFixed(2)}` : '';
    const status = ag.status || '';

    msg += `*${i + 1}. ${data} às ${hora}*\n`;
    msg += `Cliente: ${cliente}\n`;
    msg += `Serviço: ${servico}`;
    if (valor) msg += ` - ${valor}`;
    msg += `\nStatus: ${status}\n`;
    if (ag.observacoes) {
      msg += `Obs: ${ag.observacoes}\n`;
    }
    msg += `──────────────────────\n`;
  });

  if (lista.length > 10) {
    msg += `\n_Exibindo 10 de ${lista.length} agendamentos._\n`;
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
    
    // Verificar lembretes a cada 30 segundos
    setInterval(() => {
      verificarLembretes(client);
    }, 30000); // 30 segundos
    
    console.log('⏰ Sistema de lembretes ativado (verificação a cada 30s)\n');
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

    // Extrair CPF logo no início para verificação
    const cpfNumeros = soNumeros(textoBruto);
    const pareceCPF = cpfNumeros.length === 11;

    console.log(`\n📨 Mensagem de ${numero}:`);
    console.log(`   Conteúdo: ${textoBruto}`);

    // ====================================
    // 0) VERIFICAR SE ESTÁ EM ATENDIMENTO HUMANO
    // ====================================
    
    const sessao = sessoesAtendimento[numero];
    
    // Se é o atendente encerrando
    if ((numero === NUMERO_SUPORTE || numero === NUMERO_VENDAS) && texto === 'sair_bot') {
      // Encontrar cliente sendo atendido por este atendente
      const clienteAtendido = Object.keys(sessoesAtendimento).find(
        num => sessoesAtendimento[num].atendente === numero && sessoesAtendimento[num].iniciado
      );
      
      if (clienteAtendido) {
        delete sessoesAtendimento[clienteAtendido];
        await client.sendText(
          clienteAtendido,
          `*ATENDIMENTO ENCERRADO*\n\n` +
          `Obrigado por entrar em contato! 😊\n\n` +
          `Se precisar de algo mais, estamos à disposição.\n\n` +
          `Digite *0* para voltar ao menu principal.`
        );
        await client.sendText(numero, '✅ Atendimento encerrado. Cliente foi notificado.');
        console.log(`   ✅ Atendimento encerrado por ${numero}`);
      } else {
        await client.sendText(numero, '⚠️ Nenhum atendimento ativo encontrado.');
      }
      return;
    }
    
    // Se cliente está em atendimento ativo, redirecionar para atendente
    if (sessao && sessao.iniciado) {
      console.log(`   🔄 Redirecionando mensagem para ${sessao.tipo}`);
      await client.sendText(
        sessao.atendente,
        `*[CLIENTE]:* ${textoBruto}`
      );
      return;
    }
    
    // Se é atendente (Eduardo ou Karen) e digitou "1", verificar se tem solicitação pendente
    if ((numero === NUMERO_SUPORTE || numero === NUMERO_VENDAS) && texto === '1') {
      // Encontrar cliente aguardando este atendente
      const clienteAguardando = Object.keys(sessoesAtendimento).find(
        num => sessoesAtendimento[num].atendente === numero && !sessoesAtendimento[num].iniciado
      );
      
      if (clienteAguardando) {
        // TEM cliente aguardando - aceitar atendimento
        sessoesAtendimento[clienteAguardando].iniciado = true;
        const tipoAtend = sessoesAtendimento[clienteAguardando].tipo;
        const nomeAtendente = numero === NUMERO_SUPORTE ? 'Eduardo' : 'Karen';
        
        await client.sendText(
          clienteAguardando,
          `*ATENDIMENTO INICIADO* ✅\n\n` +
          `Olá! Sou *${nomeAtendente}* e vou te atender agora.\n\n` +
          `Fique à vontade para fazer suas perguntas! 😊`
        );
        await client.sendText(
          numero,
          `✅ *Atendimento aceito!*\n\n` +
          `Você está conectado(a) ao cliente ${clienteAguardando}\n\n` +
          `Para encerrar, digite: *SAIR_BOT*`
        );
        console.log(`   ✅ Atendimento ${tipoAtend} iniciado por ${nomeAtendente}`);
        return;
      }
      // NÃO tem cliente aguardando - atendente pode estar usando bot normalmente
      // Continua processamento normal (não retorna aqui)
    }
    
    // Se é atendente recusando
    if ((numero === NUMERO_SUPORTE || numero === NUMERO_VENDAS) && texto.toLowerCase() === 'recusa') {
      const clienteAguardando = Object.keys(sessoesAtendimento).find(
        num => sessoesAtendimento[num].atendente === numero && !sessoesAtendimento[num].iniciado
      );
      
      if (clienteAguardando) {
        delete sessoesAtendimento[clienteAguardando];
        await client.sendText(
          clienteAguardando,
          `*ATENDIMENTO INDISPONÍVEL*\n\n` +
          `Desculpe, não conseguimos atender no momento.\n\n` +
          `Por favor, tente novamente mais tarde.\n\n` +
          `Digite *0* para voltar ao menu.`
        );
        await client.sendText(numero, '❌ Solicitação recusada. Cliente foi notificado.');
      }
      return;
    }
    
    // Se é atendente enviando mensagem para cliente
    if (numero === NUMERO_SUPORTE || numero === NUMERO_VENDAS) {
      const clienteAtendido = Object.keys(sessoesAtendimento).find(
        num => sessoesAtendimento[num].atendente === numero && sessoesAtendimento[num].iniciado
      );
      
      if (clienteAtendido) {
        await client.sendText(clienteAtendido, textoBruto);
        return;
      }
    }

    // ====================================
    // 1) MENU INICIAL (CLIENTE/SUPORTE/VENDAS)
    // ====================================
    
    // Se não tem CPF vinculado, mostrar menu inicial,
    // MAS NÃO quando a pessoa estiver mandando um CPF ou comando de CPF
    if (
      !cpfPorNumero[numero] &&
      !['1', '2', '3'].includes(texto) &&   // não escolheu opção
      !texto.startsWith('cpf') &&
      !texto.startsWith('trocar cpf') &&
      !texto.startsWith('mudar cpf') &&
      !pareceCPF                             // 👈 se parecer CPF, não cai aqui
    ) {
      const saudacao = saudacaoPorHorario();
      await client.sendText(
        numero,
        `*${saudacao}! Seja bem-vindo(a)!* 👋\n\n` +
        `Sou o assistente virtual do *Salão Develoi*.\n\n` +
        `══════════════════════\n` +
        `*COMO PODEMOS AJUDAR?*\n\n` +
        `*1* - Sou cliente (consultar agendamentos)\n` +
        `*2* - Suporte técnico\n` +
        `*3* - Falar com vendas\n\n` +
        `══════════════════════\n` +
        `Digite o número da opção desejada.`
      );
      return;
    }
    
    // Opção 2: SUPORTE
    if (texto === '2' && !cpfPorNumero[numero]) {
      sessoesAtendimento[numero] = {
        tipo: 'suporte',
        atendente: NUMERO_SUPORTE,
        iniciado: false
      };
      
      await client.sendText(
        numero,
        `*SUPORTE TÉCNICO* 🛠️\n\n` +
        `Conectando você com nossa equipe...\n\n` +
        `Aguarde um momento, por favor.`
      );
      
      await client.sendText(
        NUMERO_SUPORTE,
        `🔔 *NOVA SOLICITAÇÃO DE SUPORTE*\n\n` +
        `Cliente: ${numero}\n\n` +
        `══════════════════════\n` +
        `*ACEITAR ATENDIMENTO?*\n\n` +
        `*1* - Aceitar\n` +
        `*RECUSA* - Recusar\n\n` +
        `══════════════════════`
      );
      
      console.log(`   📞 Solicitação de suporte de ${numero}`);
      return;
    }
    
    // Opção 3: VENDAS
    if (texto === '3' && !cpfPorNumero[numero]) {
      sessoesAtendimento[numero] = {
        tipo: 'vendas',
        atendente: NUMERO_VENDAS,
        iniciado: false
      };
      
      await client.sendText(
        numero,
        `*VENDAS* 💼\n\n` +
        `Conectando você com nossa equipe...\n\n` +
        `Aguarde um momento, por favor.`
      );
      
      await client.sendText(
        NUMERO_VENDAS,
        `🔔 *NOVA SOLICITAÇÃO DE VENDAS*\n\n` +
        `Cliente: ${numero}\n\n` +
        `══════════════════════\n` +
        `*ACEITAR ATENDIMENTO?*\n\n` +
        `*1* - Aceitar\n` +
        `*RECUSA* - Recusar\n\n` +
        `══════════════════════`
      );
      
      console.log(`   💼 Solicitação de vendas de ${numero}`);
      return;
    }

    // ====================================
    // 2) PROFISSIONAL VINCULANDO CPF (Opção 1)
    // ====================================
    
    // Permitir trocar CPF a qualquer momento (ou se escolheu opção 1)
    if (texto === '1' && !cpfPorNumero[numero]) {
      await client.sendText(
        numero,
        `*ÁREA DO CLIENTE* 👤\n\n` +
        `Para consultar seus agendamentos, preciso do seu CPF.\n\n` +
        `══════════════════════\n` +
        `*ENVIE SEU CPF:*\n\n` +
        `Apenas números (11 dígitos)\n` +
        `Exemplo: 12345678900\n\n` +
        `──────────────────\n` +
        `*0* - Voltar ao menu\n` +
        `*SAIR* - Encerrar conversa\n` +
        `══════════════════════`
      );
      return;
    }
    
    if (texto.startsWith('cpf') || texto.startsWith('trocar cpf') || texto.startsWith('mudar cpf') || (pareceCPF && !cpfPorNumero[numero])) {
      const cpfLimpo = cpfNumeros;

      if (cpfLimpo.length !== 11) {
        await client.sendText(
          numero,
          '*CPF INVÁLIDO* ❌\n\n' +
          'Por favor, envie apenas os 11 dígitos do CPF.\n\n' +
          'Exemplo: *12345678900*\n\n' +
          'Ou escreva: *CPF 12345678900*\n\n' +
          '──────────────────\n' +
          '*0* - Voltar ao menu\n' +
          '*SAIR* - Encerrar conversa'
        );
        return;
      }

      // Testar se o CPF tem agendamentos (validação básica)
      console.log(`   🔍 Validando CPF ${cpfLimpo} no sistema...`);
      
      const filtros = { limite: 1 };
      const { ok, data } = await chamarApiAgendamentos(cpfLimpo, filtros);
      
      if (!ok || !data.success) {
        await client.sendText(
          numero,
          '*CPF NÃO ENCONTRADO* ❌\n\n' +
          `O CPF *${cpfLimpo}* não está cadastrado no sistema.\n\n` +
          `──────────────────\n` +
          `*VERIFIQUE SE:*\n` +
          `• Você digitou corretamente\n` +
          `• Seu CPF está cadastrado\n` +
          `• Você é um profissional ativo\n\n` +
          `──────────────────\n` +
          `*OPÇÕES:*\n` +
          `• Digite outro CPF para tentar novamente\n` +
          `• *0* - Voltar ao menu principal\n` +
          `• *SAIR* - Encerrar conversa\n\n` +
          `Precisa de ajuda? Digite *SUPORTE*`
        );
        console.log(`   ❌ CPF ${cpfLimpo} não encontrado no sistema`);
        return;
      }

      // CPF válido - buscar informações do profissional
      const cpfAnterior = cpfPorNumero[numero];
      cpfPorNumero[numero] = cpfLimpo;
      
      if (cpfAnterior) {
        console.log(`   🔄 CPF alterado de ${cpfAnterior} para ${cpfLimpo}`);
      } else {
        console.log(`   ✅ CPF ${cpfLimpo} vinculado ao número ${numero}`);
      }

      // Buscar informações do profissional (nome e estabelecimento)
      let nomeProfissional = 'Profissional';
      let estabelecimento = '';
      
      if (data.data?.agendamentos && data.data.agendamentos.length > 0) {
        const primeiroAgendamento = data.data.agendamentos[0];
        nomeProfissional = primeiroAgendamento.profissional_nome || 'Profissional';
        estabelecimento = primeiroAgendamento.estabelecimento || '';
      }

      // Mensagens variadas de boas-vindas
      const saudacao = saudacaoPorHorario();
      
      await client.sendText(
        numero,
        `*${saudacao}, ${nomeProfissional}!* ✅\n\n` +
        (estabelecimento ? `📍 *${estabelecimento}*\n\n` : '') +
        `CPF vinculado: *${cpfLimpo}*\n\n` +
        `══════════════════════\n` +
        `*CONSULTAR AGENDAMENTOS:*\n\n` +
        `*1* - Agendamentos de hoje\n` +
        `*2* - Agendamentos de amanhã\n` +
        `*3* - Próximos 7 dias\n` +
        `*4* - Todos os agendamentos\n\n` +
        `══════════════════════\n` +
        `*OUTRAS OPÇÕES:*\n\n` +
        `*CPF* - Trocar profissional\n` +
        `*SUPORTE* - Falar com suporte\n` +
        `*VENDAS* - Falar com vendas\n` +
        `*0* - Ver menu completo\n` +
        `*SAIR* - Encerrar conversa\n\n` +
        `══════════════════════\n` +
        `*NOTIFICAÇÕES AUTOMÁTICAS:*\n` +
        `Você receberá avisos quando:\n` +
        `• Novo agendamento criado\n` +
        `• Cliente confirmar presença\n` +
        `• Faltar 1 hora para horário\n\n` +
        `Digite o número da opção desejada.`
      );
      return;
    }

    // ====================================
    // 2) VERIFICAR SE CPF ESTÁ VINCULADO
    // ====================================
    
    const cpfSalvo = cpfPorNumero[numero];
    
    if (!cpfSalvo) {
      // Se chegou aqui sem CPF, redirecionar para menu inicial
      const saudacao = saudacaoPorHorario();
      await client.sendText(
        numero,
        `*${saudacao}!* 👋\n\n` +
        `══════════════════════\n` +
        `*COMO PODEMOS AJUDAR?*\n\n` +
        `*1* - Sou cliente (consultar agendamentos)\n` +
        `*2* - Suporte técnico\n` +
        `*3* - Falar com vendas\n\n` +
        `══════════════════════\n` +
        `Digite o número da opção.`
      );
      return;
    }

    console.log(`   🔑 CPF vinculado: ${cpfSalvo}`);

    // ====================================
    // 3) MENU INTERATIVO (prioridade!)
    // ====================================
    
    if (
      texto === '0' ||
      texto === 'menu' || 
      texto === 'ajuda' ||
      texto === 'oi' || 
      texto === 'olá' ||
      texto === 'ola' ||
      texto === 'comandos'
    ) {
      console.log('   📋 Exibindo menu principal...');
      
      // Menu com botões clicáveis
      const buttons = [
        { buttonId: '1', buttonText: { displayText: '1 - Hoje' } },
        { buttonId: '2', buttonText: { displayText: '2 - Amanhã' } },
        { buttonId: '3', buttonText: { displayText: '3 - Próximos 7 dias' } },
        { buttonId: '4', buttonText: { displayText: '4 - Todos' } }
      ];

      const saudacoesMenu = [
        'Como posso ajudar você hoje?',
        'O que gostaria de consultar?',
        'Qual informação você precisa?',
        'No que posso ser útil agora?'
      ];
      const pergunta = saudacoesMenu[Math.floor(Math.random() * saudacoesMenu.length)];

      const buttonMessage = {
        text: `*BOT SECRETÁRIO - SALÃO DEVELOI*\n\n` +
              `${pergunta}\n\n` +
              `══════════════════════\n` +
              `*ESCOLHA UMA OPÇÃO:*\n\n` +
              `*1* - Agendamentos de hoje\n` +
              `*2* - Agendamentos de amanhã\n` +
              `*3* - Próximos 7 dias\n` +
              `*4* - Todos os agendamentos\n\n` +
              `══════════════════════\n` +
              `*NOTIFICAÇÕES AUTOMÁTICAS:*\n` +
              `Você recebe avisos quando há:\n` +
              `• Novo agendamento\n` +
              `• Confirmação de cliente\n` +
              `• Lembrete (1h antes)\n\n` +
              `Digite o número ou clique no botão.`,
        buttons: buttons,
        headerType: 1
      };

      // Enviar menu texto simples (mais compatível)
      await client.sendText(
        numero,
        `*BOT SECRETÁRIO - SALÃO DEVELOI*\n\n` +
        `${pergunta}\n\n` +
        `══════════════════════\n` +
        `*ESCOLHA UMA OPÇÃO:*\n\n` +
        `*1* - Agendamentos de hoje\n` +
        `*2* - Agendamentos de amanhã\n` +
        `*3* - Próximos 7 dias\n` +
        `*4* - Todos os agendamentos\n` +
        `*0* - Ver este menu\n\n` +
        `══════════════════════\n` +
        `*OUTRAS OPÇÕES:*\n` +
        `*CPF* - Trocar profissional\n` +
        `*SUPORTE* - Falar com suporte\n` +
        `*VENDAS* - Falar com vendas\n` +
        `*LEMBRETES* - Ver lembretes ativos\n\n` +
        `*NOTIFICAÇÕES AUTOMÁTICAS:*\n` +
        `Você recebe avisos quando:\n` +
        `• Novo agendamento criado\n` +
        `• Cliente confirma presença\n` +
        `• Lembrete 1 hora antes\n\n` +
        `*LEMBRETES PERSONALIZADOS:*\n` +
        `Digite frases como:\n` +
        `• "lembre-me daqui 30 min"\n` +
        `• "lembrete amanhã 14h"\n\n` +
        `Digite apenas o número.`
      );
      console.log('   ✅ Menu enviado');
      return;
    }

    // ====================================
    // 4) COMANDOS DE CONSULTA
    // ====================================

    // Agendamentos de HOJE (opção 1)
    if (
      texto.includes('agendamentos hoje') || 
      texto.includes('hoje') ||
      texto === 'hoje' ||
      texto === '1'
    ) {
      console.log('   📅 Consultando agendamentos de hoje...');
      
      await client.sendText(numero, '_Buscando agendamentos de hoje..._');
      
      const filtros = {
        data_inicio: hojeISO(),
        data_fim: hojeISO()
      };

      const { ok, data } = await chamarApiAgendamentos(cpfSalvo, filtros);

      if (!ok) {
        await client.sendText(
          numero,
          `*ERRO*\n\n` +
          `Não foi possível buscar os agendamentos.\n\n` +
          `Detalhes: ${data.message || 'Erro desconhecido'}\n\n` +
          `──────────────────\nDigite *0* para voltar ao menu.`
        );
        return;
      }

      const lista = data.data?.agendamentos || [];
      const msg = montarMensagemAgendamentos('AGENDAMENTOS DE HOJE', lista);
      await client.sendText(numero, msg + `\n\n══════════════════════\n*OPÇÕES:*\n*0* - Menu principal\n*SAIR* - Encerrar conversa`);
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
      
      await client.sendText(numero, '_Buscando agendamentos de amanhã..._');
      
      const filtros = {
        data_inicio: amanhaISO(),
        data_fim: amanhaISO()
      };

      const { ok, data } = await chamarApiAgendamentos(cpfSalvo, filtros);

      if (!ok) {
        await client.sendText(
          numero,
          `*ERRO* ❌\n\n` +
          `Não foi possível buscar os agendamentos.\n\n` +
          `Detalhes: ${data.message || 'Erro desconhecido'}\n\n` +
          `══════════════════════\n*OPÇÕES:*\n*0* - Menu principal\n*SAIR* - Encerrar conversa`
        );
        return;
      }

      const lista = data.data?.agendamentos || [];
      const msg = montarMensagemAgendamentos('AGENDAMENTOS DE AMANHÃ', lista);
      await client.sendText(numero, msg + `\n\n══════════════════════\n*OPÇÕES:*\n*0* - Menu principal\n*SAIR* - Encerrar conversa`);
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
      
      await client.sendText(numero, '_Buscando próximos agendamentos..._');
      
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
          `*ERRO* ❌\n\n` +
          `Não foi possível buscar os agendamentos.\n\n` +
          `Detalhes: ${data.message || 'Erro desconhecido'}\n\n` +
          `══════════════════════\n*OPÇÕES:*\n*0* - Menu principal\n*SAIR* - Encerrar conversa`
        );
        return;
      }

      const lista = data.data?.agendamentos || [];
      const msg = montarMensagemAgendamentos('PRÓXIMOS 7 DIAS', lista);
      await client.sendText(numero, msg + `\n\n══════════════════════\n*OPÇÕES:*\n*0* - Menu principal\n*SAIR* - Encerrar conversa`);
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
      
      await client.sendText(numero, '_Buscando todos os agendamentos..._');
      
      const filtros = {
        limite: 100
      };

      const { ok, data } = await chamarApiAgendamentos(cpfSalvo, filtros);

      if (!ok) {
        await client.sendText(
          numero,
          `*ERRO* ❌\n\n` +
          `Não foi possível buscar os agendamentos.\n\n` +
          `Detalhes: ${data.message || 'Erro desconhecido'}\n\n` +
          `══════════════════════\n*OPÇÕES:*\n*0* - Menu principal\n*SAIR* - Encerrar conversa`
        );
        return;
      }

      const lista = data.data?.agendamentos || [];
      const msg = montarMensagemAgendamentos('TODOS OS AGENDAMENTOS', lista);
      await client.sendText(numero, msg + `\n\n══════════════════════\n*OPÇÕES:*\n*0* - Menu principal\n*SAIR* - Encerrar conversa`);
      return;
    }

    // ====================================
    // 5) COMANDOS ESPECIAIS: SUPORTE E VENDAS
    // ====================================
    
    if (texto === 'suporte' || texto.includes('falar com suporte')) {
      sessoesAtendimento[numero] = {
        tipo: 'suporte',
        atendente: NUMERO_SUPORTE,
        iniciado: false
      };
      
      await client.sendText(
        numero,
        `*SUPORTE TÉCNICO* 🛠️\n\n` +
        `Conectando você com nossa equipe...\n\n` +
        `Aguarde um momento, por favor.`
      );
      
      await client.sendText(
        NUMERO_SUPORTE,
        `🔔 *NOVA SOLICITAÇÃO DE SUPORTE*\n\n` +
        `Cliente: ${numero}\n\n` +
        `══════════════════════\n` +
        `*ACEITAR ATENDIMENTO?*\n\n` +
        `*1* - Aceitar\n` +
        `*RECUSA* - Recusar\n\n` +
        `══════════════════════`
      );
      
      console.log(`   📞 Solicitação de suporte de ${numero}`);
      return;
    }
    
    if (texto === 'vendas' || texto.includes('falar com vendas')) {
      sessoesAtendimento[numero] = {
        tipo: 'vendas',
        atendente: NUMERO_VENDAS,
        iniciado: false
      };
      
      await client.sendText(
        numero,
        `*VENDAS* 💼\n\n` +
        `Conectando você com nossa equipe...\n\n` +
        `Aguarde um momento, por favor.`
      );
      
      await client.sendText(
        NUMERO_VENDAS,
        `🔔 *NOVA SOLICITAÇÃO DE VENDAS*\n\n` +
        `Cliente: ${numero}\n\n` +
        `══════════════════════\n` +
        `*ACEITAR ATENDIMENTO?*\n\n` +
        `*1* - Aceitar\n` +
        `*RECUSA* - Recusar\n\n` +
        `══════════════════════`
      );
      
      console.log(`   💼 Solicitação de vendas de ${numero}`);
      return;
    }

    // ====================================
    // 6) COMANDO ESPECIAL: SAIR/ENCERRAR
    // ====================================
    
    if (
      texto === 'sair' ||
      texto === 'encerrar' ||
      texto === 'tchau' ||
      texto === 'até logo' ||
      texto === 'ate logo' ||
      texto === 'obrigado' ||
      texto === 'obrigada'
    ) {
      const despedidas = [
        `Até logo! Foi um prazer atendê-lo(a). 👋`,
        `Tchau! Estamos sempre à disposição. 😊`,
        `Até mais! Qualquer coisa, é só chamar. 👍`,
        `Obrigado pelo contato! Até a próxima. ✨`
      ];
      const despedida = despedidas[Math.floor(Math.random() * despedidas.length)];
      
      await client.sendText(
        numero,
        `*${despedida}*\n\n` +
        `Para voltar a usar o bot, basta enviar:\n` +
        `*OI* ou *MENU* ou *0*\n\n` +
        `Tenha um ótimo dia! 🌟`
      );
      console.log(`   👋 Conversa encerrada por ${numero}`);
      return;
    }

    // ====================================
    // 7) VERIFICAR SE É COMANDO DE LEMBRETE
    // ====================================
    
    if (
      texto.includes('lembr') || 
      texto.includes('avis') ||
      texto.includes('daqui') ||
      texto.includes('me lembr') ||
      texto.includes('me avis')
    ) {
      console.log('   ⏰ Detectado possível comando de lembrete...');
      await client.sendText(numero, '_Processando seu lembrete..._');
      
      const resultadoLembrete = await processarComandoLembrete(textoBruto);
      
      if (resultadoLembrete.eh_lembrete && resultadoLembrete.dataHora) {
        try {
          const dataHoraLembrete = new Date(resultadoLembrete.dataHora);
          
          // Verificar se a data é válida e futura
          if (isNaN(dataHoraLembrete.getTime())) {
            await client.sendText(
              numero,
              `*ERRO NO LEMBRETE* ❌\n\n` +
              `Não consegui entender a data/hora.\n\n` +
              `Tente formatos como:\n` +
              `• "lembre-me daqui 15 minutos"\n` +
              `• "lembrete amanhã às 14h"\n` +
              `• "me avise hoje às 18h"\n` +
              `• "lembrar daqui 1 hora"`
            );
            return;
          }
          
          const agora = new Date();
          if (dataHoraLembrete <= agora) {
            await client.sendText(
              numero,
              `*ERRO NO LEMBRETE* ❌\n\n` +
              `O horário precisa ser no futuro!\n\n` +
              `Tente:\n` +
              `• "lembre-me daqui 10 minutos"\n` +
              `• "lembrete amanhã às 9h"`
            );
            return;
          }
          
          const mensagemLembrete = resultadoLembrete.mensagem_lembrete || textoBruto;
          const lembrete = criarLembrete(numero, mensagemLembrete, dataHoraLembrete);
          
          const dataFormatada = dataHoraLembrete.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          
          await client.sendText(
            numero,
            `*LEMBRETE CRIADO!* ⏰\n\n` +
            `✅ Lembrete #${lembrete.id} agendado\n\n` +
            `📅 *Quando:* ${resultadoLembrete.quando}\n` +
            `🕐 *Data/hora:* ${dataFormatada}\n` +
            `📝 *Mensagem:* ${mensagemLembrete}\n\n` +
            `══════════════════════\n` +
            `Vou te avisar no horário marcado! 😊\n\n` +
            `*OPÇÕES:*\n` +
            `*LEMBRETES* - Ver lembretes ativos\n` +
            `*0* - Menu principal`
          );
          
          console.log(`   ✅ Lembrete criado: ${dataFormatada}`);
          return;
        } catch (error) {
          console.error('   ❌ Erro ao criar lembrete:', error);
          await client.sendText(
            numero,
            `*ERRO* ❌\n\n` +
            `Não consegui criar o lembrete.\n\n` +
            `Tente: "lembre-me daqui 15 minutos"`
          );
          return;
        }
      }
    }
    
    // Comando para listar lembretes ativos
    if (texto === 'lembretes' || texto === 'meus lembretes' || texto === 'ver lembretes') {
      const meusLembretes = lembretes.filter(l => l.numero === numero && !l.enviado);
      
      if (meusLembretes.length === 0) {
        await client.sendText(
          numero,
          `*MEUS LEMBRETES* 📋\n\n` +
          `Você não tem lembretes ativos.\n\n` +
          `══════════════════════\n` +
          `*CRIAR LEMBRETE:*\n\n` +
          `Digite frases como:\n` +
          `• "lembre-me daqui 30 minutos"\n` +
          `• "lembrete hoje às 15h"\n` +
          `• "me avise amanhã às 9h"\n\n` +
          `*0* - Menu principal`
        );
        return;
      }
      
      let msg = `*MEUS LEMBRETES ATIVOS* ⏰\n\n`;
      msg += `Você tem ${meusLembretes.length} lembrete(s):\n\n`;
      msg += `══════════════════════\n\n`;
      
      meusLembretes.forEach((l, i) => {
        const dataFormatada = l.dataHora.toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        msg += `*${i + 1}. Lembrete #${l.id}*\n`;
        msg += `🕐 ${dataFormatada}\n`;
        msg += `📝 ${l.mensagem}\n`;
        msg += `──────────────────────\n\n`;
      });
      
      msg += `*OPÇÕES:*\n`;
      msg += `*0* - Menu principal`;
      
      await client.sendText(numero, msg);
      console.log(`   📋 Listados ${meusLembretes.length} lembretes`);
      return;
    }
    
    // ====================================
    // 8) PROCESSAMENTO COM IA (INTELIGÊNCIA ARTIFICIAL)
    // ====================================
    
    console.log('   🤖 Tentando processar mensagem com IA...');
    await client.sendText(numero, '_Analisando sua pergunta..._');
    
    const resultadoIA = await processarComIA(textoBruto, cpfSalvo);
    console.log('   🧠 Intenção identificada:', resultadoIA.intencao);
    
    // Processar intenções da IA
    if (resultadoIA.intencao === 'consultar_hoje') {
      // Redirecionar para consulta de hoje
      const filtros = {
        data_inicio: hojeISO(),
        data_fim: hojeISO()
      };
      
      const { ok, data } = await chamarApiAgendamentos(cpfSalvo, filtros);
      if (ok) {
        const lista = data.data?.agendamentos || [];
        const msg = montarMensagemAgendamentos('AGENDAMENTOS DE HOJE', lista);
        await client.sendText(numero, msg + `\n\n══════════════════════\n*OPÇÕES:*\n*0* - Menu principal\n*SAIR* - Encerrar conversa`);
        return;
      }
    } else if (resultadoIA.intencao === 'consultar_amanha') {
      const filtros = {
        data_inicio: amanhaISO(),
        data_fim: amanhaISO()
      };
      
      const { ok, data } = await chamarApiAgendamentos(cpfSalvo, filtros);
      if (ok) {
        const lista = data.data?.agendamentos || [];
        const msg = montarMensagemAgendamentos('AGENDAMENTOS DE AMANHÃ', lista);
        await client.sendText(numero, msg + `\n\n══════════════════════\n*OPÇÕES:*\n*0* - Menu principal\n*SAIR* - Encerrar conversa`);
        return;
      }
    } else if (resultadoIA.intencao === 'consultar_semana') {
      const hoje = new Date();
      const em7dias = new Date();
      em7dias.setDate(hoje.getDate() + 7);
      
      const filtros = {
        data_inicio: hojeISO(),
        data_fim: em7dias.toISOString().slice(0, 10),
        limite: 50
      };
      
      const { ok, data } = await chamarApiAgendamentos(cpfSalvo, filtros);
      if (ok) {
        const lista = data.data?.agendamentos || [];
        const msg = montarMensagemAgendamentos('PRÓXIMOS 7 DIAS', lista);
        await client.sendText(numero, msg + `\n\n══════════════════════\n*OPÇÕES:*\n*0* - Menu principal\n*SAIR* - Encerrar conversa`);
        return;
      }
    } else if (resultadoIA.intencao === 'calcular_faturamento') {
      // Calcular faturamento
      const hoje = new Date();
      const em7dias = new Date();
      em7dias.setDate(hoje.getDate() + 7);
      
      const filtros = {
        data_inicio: resultadoIA.filtros?.data_inicio || hojeISO(),
        data_fim: resultadoIA.filtros?.data_fim || em7dias.toISOString().slice(0, 10),
        limite: 200
      };
      
      const { ok, data } = await chamarApiAgendamentos(cpfSalvo, filtros);
      if (ok && data.data?.agendamentos) {
        const lista = data.data.agendamentos;
        const total = lista.reduce((sum, ag) => sum + (Number(ag.valor) || 0), 0);
        const confirmados = lista.filter(ag => ag.status === 'confirmado');
        const totalConfirmado = confirmados.reduce((sum, ag) => sum + (Number(ag.valor) || 0), 0);
        
        await client.sendText(
          numero,
          `*💰 FATURAMENTO*\n\n` +
          `Período: ${formatarDataPtBr(filtros.data_inicio)} até ${formatarDataPtBr(filtros.data_fim)}\n\n` +
          `══════════════════════\n` +
          `Total de agendamentos: *${lista.length}*\n` +
          `Confirmados: *${confirmados.length}*\n\n` +
          `💵 *Valor total:* R$ ${total.toFixed(2)}\n` +
          `✅ *Confirmado:* R$ ${totalConfirmado.toFixed(2)}\n` +
          `⏳ *Pendente:* R$ ${(total - totalConfirmado).toFixed(2)}\n\n` +
          `══════════════════════\n*OPÇÕES:*\n*0* - Menu principal\n*SAIR* - Encerrar conversa`
        );
        return;
      }
    } else if (resultadoIA.intencao === 'contar_clientes') {
      const filtros = {
        data_inicio: resultadoIA.filtros?.data_inicio || hojeISO(),
        data_fim: resultadoIA.filtros?.data_fim || hojeISO(),
        limite: 200
      };
      
      const { ok, data } = await chamarApiAgendamentos(cpfSalvo, filtros);
      if (ok && data.data?.agendamentos) {
        const lista = data.data.agendamentos;
        await client.sendText(
          numero,
          `*📊 ESTATÍSTICAS*\n\n` +
          `Você tem *${lista.length}* agendamento${lista.length !== 1 ? 's' : ''} no período solicitado.\n\n` +
          `══════════════════════\n*OPÇÕES:*\n*0* - Menu principal\n*1* - Ver detalhes dos agendamentos\n*SAIR* - Encerrar conversa`
        );
        return;
      }
    }
    
    // ====================================
    // 9) COMANDO NÃO RECONHECIDO (após tentar IA)
    // ====================================
    
    const desculpas = [
      'Desculpe, não compreendi sua mensagem.',
      'Ops! Não consegui entender o que você precisa.',
      'Hmm, não reconheci esse comando.',
      'Perdão, não entendi o que você quer dizer.'
    ];
    const desculpa = desculpas[Math.floor(Math.random() * desculpas.length)];

    await client.sendText(
      numero,
      `*${desculpa}* 🤔\n\n` +
      `Tentei entender sua pergunta, mas preciso de mais clareza.\n\n` +
      `══════════════════════\n` +
      `*OPÇÕES DISPONÍVEIS:*\n\n` +
      `*1* - Agendamentos de hoje\n` +
      `*2* - Agendamentos de amanhã\n` +
      `*3* - Próximos 7 dias\n` +
      `*4* - Todos os agendamentos\n` +
      `*0* - Ver menu completo\n\n` +
      `*SUPORTE* - Falar com suporte\n` +
      `*VENDAS* - Falar com vendas\n` +
      `*CPF* - Trocar profissional\n` +
      `*SAIR* - Encerrar conversa\n\n` +
      `══════════════════════\n` +
      `💡 *Dica:* Tente perguntas como:\n` +
      `• "Tenho cliente hoje?"\n` +
      `• "Quanto vou ganhar essa semana?"\n` +
      `• "Quem vem amanhã de tarde?"\n\n` +
      `Digite o número ou comando desejado.`
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
    const dataFormatada = formatarDataPtBr(data);
    
    const msg =
      '🔔 *NOVO AGENDAMENTO RECEBIDO!*\n\n' +
      `📅 *Data:* ${dataFormatada}\n` +
      `⏰ *Horário:* ${horario || 'Não informado'}\n` +
      `👤 *Cliente:* ${cliente_nome || 'Não informado'}\n` +
      (cliente_telefone ? `📞 *Telefone:* ${cliente_telefone}\n` : '') +
      `✂️ *Serviço:* ${servico || 'Não informado'}\n` +
      (valor ? `💰 *Valor:* R$ ${Number(valor).toFixed(2)}\n` : '') +
      (observacoes ? `📝 *Obs:* ${observacoes}\n` : '') +
      `\n──────────────────\n` +
      `🌐 *Acesse o sistema para mais detalhes:*\n` +
      `https://salao.develoi.com`;

    // Envia notificação para o WhatsApp do profissional
    try {
      await clientGlobal.sendText(numeroWhats, msg);
      console.log(`   ✅ Notificação enviada para ${numeroWhats}`);
      
      return res.json({ 
        success: true,
        message: 'Notificação enviada com sucesso'
      });
    } catch (sendError) {
      // Erro comum: "No LID for user" - número não está nos contatos
      if (sendError.message && sendError.message.includes('No LID')) {
        console.log(`   ⚠️ Número ${numeroWhats} não está nos contatos do WhatsApp`);
        return res.status(400).json({ 
          success: false,
          message: 'Número não está nos contatos do WhatsApp. Adicione o contato primeiro.',
          error: 'NO_LID'
        });
      }
      throw sendError; // Re-lança outros erros
    }
    
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

    // Formata data em português bonito
    const dataFormatada = formatarDataPtBr(data);

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
      `📅 *Data:* ${dataFormatada}\n` +
      `⏰ *Horário:* ${horaFormatada || 'Não informado'}\n` +
      (valor ? `💰 *Valor:* R$ ${Number(valor).toFixed(2)}\n` : '') +
      (observacoes ? `\n📝 *Observações:* ${observacoes}\n` : '') +
      `\n──────────────────\n` +
      `_Aguardamos você! 😊_\n\n` +
      `🌐 *Acesse seu agendamento:*\n` +
      `https://salao.develoi.com\n` +
      `\n` +
      `_Estamos te esperando! Se precisar remarcar ou cancelar, entre em contato._\n\n` +
      `Até logo! 😊`;

    // Envia mensagem de confirmação para o WhatsApp do CLIENTE
    try {
      await clientGlobal.sendText(numeroWhats, msg);
      console.log(`   ✅ Confirmação enviada para cliente ${numeroWhats}`);
      
      return res.json({ 
        success: true,
        message: 'Confirmação enviada ao cliente com sucesso'
      });
    } catch (sendError) {
      // Erro comum: "No LID for user" - número não está nos contatos
      if (sendError.message && sendError.message.includes('No LID')) {
        console.log(`   ⚠️ Número ${numeroWhats} não está nos contatos do WhatsApp`);
        return res.status(400).json({ 
          success: false,
          message: 'Número do cliente não está nos contatos. Adicione o contato primeiro.',
          error: 'NO_LID'
        });
      }
      throw sendError; // Re-lança outros erros
    }
    
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

    // Formata data em português
    const dataFormatada = formatarDataPtBr(data);

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
          `📅 *Data:* ${dataFormatada}\n` +
          `⏰ *Horário:* ${horaFormatada || 'Não informado'}\n` +
          (valor ? `💰 *Valor:* R$ ${Number(valor).toFixed(2)}\n` : '') +
          (observacoes ? `\n📝 *Observações:* ${observacoes}\n` : '') +
          `\n──────────────────\n` +
          `_Estamos te esperando! Não se atrase! 😊_\n\n` +
          `🌐 *Seus agendamentos:*\n` +
          `https://salao.develoi.com`;

        try {
          await clientGlobal.sendText(numeroCliente, msgCliente);
          console.log(`   ✅ Lembrete enviado para CLIENTE ${numeroCliente}`);
          enviados++;
        } catch (err) {
          if (err.message && err.message.includes('No LID')) {
            console.log(`   ⚠️ CLIENTE ${numeroCliente} não está nos contatos`);
          } else {
            console.error(`   ❌ Erro ao enviar para cliente:`, err.message);
          }
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
          `📅 *Data:* ${dataFormatada}\n` +
          `⏰ *Horário:* ${horaFormatada || 'Não informado'}\n` +
          `👤 *Cliente:* ${cliente_nome || 'Não informado'}\n` +
          (telefone_cliente ? `📞 *Telefone:* ${telefone_cliente}\n` : '') +
          `✂️ *Serviço:* ${servico || 'Não informado'}\n` +
          (valor ? `💰 *Valor:* R$ ${Number(valor).toFixed(2)}\n` : '') +
          (observacoes ? `\n📝 *Obs:* ${observacoes}\n` : '') +
          `\n──────────────────\n` +
          `_Prepare-se para atender! 👨‍💼_\n\n` +
          `🌐 *Ver detalhes no sistema:*\n` +
          `https://salao.develoi.com`;

        try {
          await clientGlobal.sendText(numeroProfissional, msgProfissional);
          console.log(`   ✅ Lembrete enviado para PROFISSIONAL ${numeroProfissional}`);
          enviados++;
        } catch (err) {
          if (err.message && err.message.includes('No LID')) {
            console.log(`   ⚠️ PROFISSIONAL ${numeroProfissional} não está nos contatos`);
          } else {
            console.error(`   ❌ Erro ao enviar para profissional:`, err.message);
          }
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
