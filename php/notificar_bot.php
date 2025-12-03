<?php
/**
 * ========================================================================
 * NOTIFICADOR DO BOT - Salão Develoi
 * ========================================================================
 * 
 * Envia notificações automáticas para o bot-secretário quando:
 * - Um novo agendamento é criado
 * - Um agendamento é atualizado
 * - Um agendamento é cancelado
 * 
 * ========================================================================
 */

/**
 * Notifica o bot sobre um novo agendamento
 * 
 * @param PDO $pdo Conexão com o banco de dados
 * @param int $agendamentoId ID do agendamento recém-criado
 * @return bool True se enviou com sucesso, False caso contrário
 */
function notificarBotNovoAgendamento(PDO $pdo, $agendamentoId) {
    try {
        // 1) Buscar dados completos do agendamento
        $sql = "
            SELECT 
                a.id,
                a.user_id,
                a.servico,
                a.valor,
                a.data_agendamento,
                a.horario,
                a.status,
                a.observacoes,
                u.telefone AS telefone_profissional,
                u.nome AS nome_profissional,
                c.nome AS cliente_nome,
                c.telefone AS cliente_telefone
            FROM agendamentos a
            JOIN usuarios u ON a.user_id = u.id
            LEFT JOIN clientes c ON a.cliente_id = c.id
            WHERE a.id = ?
            LIMIT 1
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([$agendamentoId]);
        $ag = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$ag) {
            error_log("Notificador Bot: Agendamento #{$agendamentoId} não encontrado");
            return false;
        }

        // 2) Verificar se o profissional tem telefone cadastrado
        if (empty($ag['telefone_profissional'])) {
            error_log("Notificador Bot: Profissional #{$ag['user_id']} sem telefone cadastrado");
            return false;
        }

        // 3) Formatar data para o padrão brasileiro
        $dataFormatada = '';
        if (!empty($ag['data_agendamento'])) {
            $timestamp = strtotime($ag['data_agendamento']);
            $dataFormatada = date('d/m/Y', $timestamp);
        }

        // 4) Formatar horário
        $horarioFormatado = '';
        if (!empty($ag['horario'])) {
            $timestamp = strtotime($ag['horario']);
            $horarioFormatado = date('H:i', $timestamp);
        }

        // 5) Montar payload para o bot
        $payload = [
            'telefone_profissional' => $ag['telefone_profissional'],
            'cliente_nome'          => $ag['cliente_nome'] ?? 'Cliente não informado',
            'cliente_telefone'      => $ag['cliente_telefone'] ?? '',
            'servico'               => $ag['servico'] ?? 'Serviço não informado',
            'data'                  => $dataFormatada,
            'horario'               => $horarioFormatado,
            'valor'                 => $ag['valor'] ?? 0,
            'observacoes'           => $ag['observacoes'] ?? ''
        ];

        // 6) URL do webhook do bot
        // Detecta automaticamente se está em localhost ou produção
        $host = $_SERVER['HTTP_HOST'] ?? '';
        $isLocal = (strpos($host, 'localhost') !== false || strpos($host, '127.0.0.1') !== false);
        
        if ($isLocal) {
            $botUrl = 'http://localhost:3333/webhook/novo-agendamento';
        } else {
            $botUrl = 'http://bot.develoi.com:3333/webhook/novo-agendamento';
        }

        // 7) Enviar requisição para o bot
        $ch = curl_init($botUrl);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
            CURLOPT_TIMEOUT => 5, // Timeout de 5 segundos
            CURLOPT_CONNECTTIMEOUT => 3
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        // 8) Verificar resposta
        if ($response === false || $httpCode !== 200) {
            error_log("Notificador Bot: Erro ao enviar notificação - HTTP {$httpCode} - {$error}");
            return false;
        }

        // Log de sucesso
        error_log("Notificador Bot: Notificação enviada com sucesso para {$ag['telefone_profissional']} (Agendamento #{$agendamentoId})");
        
        return true;

    } catch (Exception $e) {
        error_log("Notificador Bot: Exceção - " . $e->getMessage());
        return false;
    }
}

/**
 * Notifica o bot sobre cancelamento de agendamento (OPCIONAL)
 * 
 * @param PDO $pdo Conexão com o banco de dados
 * @param int $agendamentoId ID do agendamento cancelado
 * @return bool
 */
function notificarBotAgendamentoCancelado(PDO $pdo, $agendamentoId) {
    try {
        $sql = "
            SELECT 
                a.*,
                u.telefone AS telefone_profissional,
                c.nome AS cliente_nome
            FROM agendamentos a
            JOIN usuarios u ON a.user_id = u.id
            LEFT JOIN clientes c ON a.cliente_id = c.id
            WHERE a.id = ?
            LIMIT 1
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([$agendamentoId]);
        $ag = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$ag || empty($ag['telefone_profissional'])) {
            return false;
        }

        $dataFormatada = date('d/m/Y', strtotime($ag['data_agendamento']));
        $horarioFormatado = date('H:i', strtotime($ag['horario']));

        // Envia mensagem simples de cancelamento
        $payload = [
            'telefone_profissional' => $ag['telefone_profissional'],
            'tipo' => 'cancelamento',
            'cliente_nome' => $ag['cliente_nome'],
            'servico' => $ag['servico'],
            'data' => $dataFormatada,
            'horario' => $horarioFormatado
        ];

        // Detecta ambiente
        $host = $_SERVER['HTTP_HOST'] ?? '';
        $isLocal = (strpos($host, 'localhost') !== false || strpos($host, '127.0.0.1') !== false);
        
        if ($isLocal) {
            $botUrl = 'http://localhost:3333/webhook/cancelamento-agendamento';
        } else {
            $botUrl = 'http://bot.develoi.com:3333/webhook/cancelamento-agendamento';
        }

        $ch = curl_init($botUrl);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
            CURLOPT_TIMEOUT => 5
        ]);

        curl_exec($ch);
        curl_close($ch);

        return true;

    } catch (Exception $e) {
        error_log("Notificador Bot (Cancelamento): " . $e->getMessage());
        return false;
    }
}

/**
 * ========================================================================
 * FUNÇÃO: getBotBaseUrl
 * ========================================================================
 * Retorna a URL base do BOT (localhost ou produção VPS)
 */
if (!function_exists('getBotBaseUrl')) {
    function getBotBaseUrl(): string
    {
        $host = $_SERVER['HTTP_HOST'] ?? '';
        $isLocalDev = in_array($host, ['localhost', '127.0.0.1']);

        // Quando estiver desenvolvendo TUDO na mesma máquina (PHP + bot)
        if ($isLocalDev) {
            // Bot rodando localmente na porta 80
            return 'http://localhost';
        }

        // EM PRODUÇÃO (HostGator chamando o bot na VPS)
        // Bot está escutando na porta 80 (sem :3333 nem :80)
        return 'http://72.61.221.59';
    }
}

/**
 * ========================================================================
 * FUNÇÃO: notificarBotLembreteAgendamento
 * ========================================================================
 * Notifica o BOT para enviar lembrete ao cliente E ao profissional
 * sobre agendamento próximo (ex: 1 hora antes).
 *
 * @param PDO $pdo
 * @param int $agendamentoId ID do agendamento
 * @param int $minutosAntes Quantos minutos antes do horário (padrão: 60)
 */
if (!function_exists('notificarBotLembreteAgendamento')) {
    function notificarBotLembreteAgendamento(PDO $pdo, int $agendamentoId, int $minutosAntes = 60): void
    {
        try {
            // ====================================
            // URL DO WEBHOOK
            // ====================================
            $baseUrl = getBotBaseUrl();
            $webhookUrl = rtrim($baseUrl, '/') . '/webhook/lembrete-agendamento';

            // ====================================
            // BUSCAR DADOS DO AGENDAMENTO
            // ====================================
            $sql = "
                SELECT 
                    a.id,
                    a.user_id,
                    a.cliente_id,
                    a.servico,
                    a.valor,
                    a.data_agendamento,
                    a.horario,
                    a.status,
                    a.observacoes,
                    a.lembrete_enviado,
                    
                    u.telefone      AS telefone_profissional,
                    u.nome          AS profissional_nome,
                    u.estabelecimento,
                    
                    c.nome          AS cliente_nome,
                    c.telefone      AS cliente_telefone
                FROM agendamentos a
                JOIN usuarios u ON u.id = a.user_id
                LEFT JOIN clientes c ON c.id = a.cliente_id
                WHERE a.id = :id
                LIMIT 1
            ";
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute([':id' => $agendamentoId]);
            $ag = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$ag) {
                error_log("[BOT] Lembrete: Agendamento {$agendamentoId} não encontrado.");
                return;
            }

            // Verificar se já foi enviado
            if (!empty($ag['lembrete_enviado']) && $ag['lembrete_enviado'] == 1) {
                error_log("[BOT] Lembrete já enviado para agendamento {$agendamentoId}.");
                return;
            }

            // Verificar se tem telefones
            if (empty($ag['telefone_profissional']) && empty($ag['cliente_telefone'])) {
                error_log("[BOT] Lembrete: Sem telefones cadastrados para agendamento {$agendamentoId}.");
                return;
            }

            // ====================================
            // CALCULAR TEMPO ATÉ O AGENDAMENTO
            // ====================================
            $dataHoraAgendamento = $ag['data_agendamento'] . ' ' . $ag['horario'];
            $timestampAgendamento = strtotime($dataHoraAgendamento);
            $timestampAtual = time();
            $minutosRestantes = floor(($timestampAgendamento - $timestampAtual) / 60);

            // ====================================
            // MONTAR PAYLOAD
            // ====================================
            $payload = [
                'agendamento_id'        => $ag['id'],
                'telefone_profissional' => $ag['telefone_profissional'] ?? null,
                'telefone_cliente'      => $ag['cliente_telefone'] ?? null,
                'cliente_nome'          => $ag['cliente_nome'] ?? 'Cliente',
                'profissional_nome'     => $ag['profissional_nome'] ?? 'Profissional',
                'estabelecimento'       => $ag['estabelecimento'] ?? 'Salão',
                'servico'               => $ag['servico'] ?? 'Serviço',
                'data'                  => $ag['data_agendamento'] ?? null,
                'horario'               => $ag['horario'] ?? null,
                'valor'                 => $ag['valor'] ?? null,
                'observacoes'           => $ag['observacoes'] ?? null,
                'minutos_restantes'     => $minutosRestantes,
                'minutos_antes_configurado' => $minutosAntes,
            ];

            // ====================================
            // ENVIAR REQUISIÇÃO
            // ====================================
            $ch = curl_init($webhookUrl);
            curl_setopt_array($ch, [
                CURLOPT_POST           => true,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
                CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
                CURLOPT_TIMEOUT        => 10,
            ]);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlError = curl_error($ch);
            curl_close($ch);

            // ====================================
            // MARCAR COMO ENVIADO
            // ====================================
            if ($httpCode >= 200 && $httpCode < 300) {
                $stmtUpdate = $pdo->prepare("UPDATE agendamentos SET lembrete_enviado = 1 WHERE id = ?");
                $stmtUpdate->execute([$agendamentoId]);
                error_log("[BOT] Lembrete enviado com sucesso para agendamento {$agendamentoId}");
            } else {
                error_log("[BOT] Erro ao enviar lembrete - HTTP {$httpCode} - Resp: {$response}");
            }

            // ====================================
            // LOG
            // ====================================
            if ($curlError) {
                error_log("[BOT] Erro cURL ao enviar lembrete: {$curlError}");
            }

        } catch (Throwable $e) {
            error_log('[BOT] Exceção ao enviar lembrete: ' . $e->getMessage());
        }
    }
}

/**
 * ========================================================================
 * FUNÇÃO: processarLembretesAutomaticos
 * ========================================================================
 * Processa todos os agendamentos que precisam de lembrete automático.
 * DEVE SER EXECUTADO POR UM CRON JOB A CADA 5-10 MINUTOS.
 *
 * @param PDO $pdo
 * @param int $minutosAntes Tempo de antecedência para enviar lembrete (padrão: 60)
 * @return int Número de lembretes enviados
 */
if (!function_exists('processarLembretesAutomaticos')) {
    function processarLembretesAutomaticos(PDO $pdo, int $minutosAntes = 60): int
    {
        try {
            error_log("[BOT] Processando lembretes automáticos ({$minutosAntes} minutos antes)...");

            // ====================================
            // BUSCAR AGENDAMENTOS QUE PRECISAM DE LEMBRETE
            // ====================================
            $sql = "
                SELECT 
                    a.id,
                    a.data_agendamento,
                    a.horario,
                    CAST((julianday(a.data_agendamento || ' ' || a.horario) - julianday('now', 'localtime')) * 24 * 60 AS INTEGER) AS minutos_ate_agendamento
                FROM agendamentos a
                WHERE a.status IN ('Confirmado', 'Pendente')
                  AND (a.lembrete_enviado IS NULL OR a.lembrete_enviado = 0)
                  AND datetime(a.data_agendamento || ' ' || a.horario) > datetime('now', 'localtime')
                  AND datetime(a.data_agendamento || ' ' || a.horario) <= datetime('now', 'localtime', '+{$minutosAntes} minutes')
                ORDER BY a.data_agendamento ASC, a.horario ASC
            ";

            $stmt = $pdo->query($sql);
            $agendamentos = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $totalEnviados = 0;

            foreach ($agendamentos as $ag) {
                notificarBotLembreteAgendamento($pdo, $ag['id'], $minutosAntes);
                $totalEnviados++;
                
                // Pausa de 1 segundo entre envios para não sobrecarregar
                sleep(1);
            }

            error_log("[BOT] Processamento concluído: {$totalEnviados} lembrete(s) enviado(s).");
            return $totalEnviados;

        } catch (Throwable $e) {
            error_log('[BOT] Exceção ao processar lembretes automáticos: ' . $e->getMessage());
            return 0;
        }
    }
}
