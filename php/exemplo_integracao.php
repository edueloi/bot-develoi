<?php
/**
 * ========================================================================
 * EXEMPLO DE INTEGRAÇÃO COM O BOT
 * ========================================================================
 * 
 * Este arquivo mostra como integrar o notificador do bot
 * no seu sistema de agendamentos existente.
 * 
 * Copie e cole o código relevante no seu arquivo de salvamento.
 * ========================================================================
 */

// ====================================================================
// EXEMPLO 1: Após CRIAR um novo agendamento
// ====================================================================

// Supondo que você tenha um arquivo como: pages/agendamentos/salvar.php

<?php
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/notificar_bot.php'; // 👈 ADICIONE ESTA LINHA

// ... seu código de validação e preparação dos dados ...

// INSERT do agendamento
$stmt = $pdo->prepare("
    INSERT INTO agendamentos (
        user_id,
        cliente_id,
        servico,
        valor,
        data_agendamento,
        horario,
        status,
        observacoes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
");

$stmt->execute([
    $userId,
    $clienteId,
    $servico,
    $valor,
    $dataAgendamento,
    $horario,
    $status,
    $observacoes
]);

// Pega o ID do agendamento recém-criado
$novoId = $pdo->lastInsertId();

// 🔔 NOTIFICA O BOT AUTOMATICAMENTE
notificarBotNovoAgendamento($pdo, $novoId);

// ... resto do código (redirect, mensagem de sucesso, etc) ...
?>


// ====================================================================
// EXEMPLO 2: Em um sistema que já tem agendamentos
// ====================================================================

<?php
// Se você já tem agendamentos e quer começar a notificar a partir de agora:

require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/notificar_bot.php';

session_start();

// Verifica se é um POST (formulário de agendamento)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    
    $userId = $_SESSION['user_id'];
    $clienteId = $_POST['cliente_id'];
    $servico = $_POST['servico'];
    $valor = $_POST['valor'];
    $dataAgendamento = $_POST['data_agendamento'];
    $horario = $_POST['horario'];
    $status = $_POST['status'] ?? 'Pendente';
    $observacoes = $_POST['observacoes'] ?? '';

    try {
        // Inicia transação
        $pdo->beginTransaction();

        // INSERT do agendamento
        $stmt = $pdo->prepare("
            INSERT INTO agendamentos (
                user_id, cliente_id, servico, valor, 
                data_agendamento, horario, status, observacoes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");

        $stmt->execute([
            $userId, $clienteId, $servico, $valor,
            $dataAgendamento, $horario, $status, $observacoes
        ]);

        $novoId = $pdo->lastInsertId();

        // Commit da transação
        $pdo->commit();

        // 🔔 Notifica o bot (não bloqueia se falhar)
        notificarBotNovoAgendamento($pdo, $novoId);

        // Redireciona com sucesso
        header('Location: agendamentos.php?success=1');
        exit;

    } catch (Exception $e) {
        $pdo->rollBack();
        die('Erro ao criar agendamento: ' . $e->getMessage());
    }
}
?>


// ====================================================================
// EXEMPLO 3: API REST criando agendamento
// ====================================================================

<?php
// Se você tem uma API REST que cria agendamentos:

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/notificar_bot.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    $userId = $input['user_id'];
    $clienteId = $input['cliente_id'];
    $servico = $input['servico'];
    $valor = $input['valor'];
    $dataAgendamento = $input['data_agendamento'];
    $horario = $input['horario'];
    $status = $input['status'] ?? 'Pendente';
    $observacoes = $input['observacoes'] ?? '';

    try {
        $stmt = $pdo->prepare("
            INSERT INTO agendamentos (
                user_id, cliente_id, servico, valor,
                data_agendamento, horario, status, observacoes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");

        $stmt->execute([
            $userId, $clienteId, $servico, $valor,
            $dataAgendamento, $horario, $status, $observacoes
        ]);

        $novoId = $pdo->lastInsertId();

        // 🔔 Notifica o bot
        $notificado = notificarBotNovoAgendamento($pdo, $novoId);

        echo json_encode([
            'success' => true,
            'id' => $novoId,
            'bot_notificado' => $notificado
        ]);

    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => $e->getMessage()
        ]);
    }
}
?>


// ====================================================================
// EXEMPLO 4: Notificar sobre cancelamento (OPCIONAL)
// ====================================================================

<?php
// Quando um agendamento for cancelado:

require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/notificar_bot.php';

$agendamentoId = $_POST['id'];

// Atualiza status para Cancelado
$stmt = $pdo->prepare("
    UPDATE agendamentos 
    SET status = 'Cancelado' 
    WHERE id = ?
");
$stmt->execute([$agendamentoId]);

// 🔔 Notifica o bot sobre o cancelamento (se implementado)
notificarBotAgendamentoCancelado($pdo, $agendamentoId);

header('Location: agendamentos.php?cancelled=1');
exit;
?>


// ====================================================================
// DICAS DE IMPLEMENTAÇÃO
// ====================================================================

/**
 * 1. ONDE COLOCAR O ARQUIVO notificar_bot.php?
 *    - Recomendado: includes/notificar_bot.php
 *    - Ou: lib/bot/notificar_bot.php
 * 
 * 2. AJUSTAR URL DO BOT
 *    No arquivo notificar_bot.php, linha ~95:
 *    
 *    Local: $botUrl = 'http://localhost:3333/webhook/novo-agendamento';
 *    Produção: $botUrl = 'http://IP_DO_SERVIDOR:3333/webhook/novo-agendamento';
 * 
 * 3. TESTE LOCAL
 *    - Rode o bot: node bot-secretario.js
 *    - Crie um agendamento no sistema
 *    - Verifique se a notificação chegou no WhatsApp
 * 
 * 4. LOGS
 *    O notificador grava logs em error_log do PHP
 *    Verifique em: /var/log/apache2/error.log (Linux)
 *                  C:\xampp\apache\logs\error.log (Windows)
 * 
 * 5. SE O BOT NÃO RECEBER
 *    - Verifique se o bot está rodando (node bot-secretario.js)
 *    - Verifique a porta (3333)
 *    - Teste manualmente: curl http://localhost:3333/status
 *    - Veja os logs do PHP e do Node
 * 
 * 6. FIREWALL (PRODUÇÃO)
 *    Se PHP e Node estão em servidores diferentes:
 *    - Libere a porta 3333 no firewall
 *    - Ou use um proxy reverso (Nginx)
 */
