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
