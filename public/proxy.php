<?php
// Proxy server-side para FRED e CoinGecko — resolve CORS do browser
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, no-store');

// Repassa o status HTTP do upstream para o browser
function forwardStatusCode() {
    global $http_response_header;
    if (!isset($http_response_header)) return;
    foreach ($http_response_header as $h) {
        if (preg_match('#^HTTP/[\d.]+ (\d+)#', $h, $m)) {
            http_response_code((int)$m[1]);
            return;
        }
    }
}

$source = $_GET['source'] ?? '';

// ---------- FRED ----------
if ($source === 'fred') {
    $apiKey   = $_GET['api_key']            ?? '';
    $seriesId = strtoupper($_GET['series_id'] ?? '');
    $start    = $_GET['observation_start']  ?? '2015-01-01';

    if (!$apiKey || !$seriesId) {
        http_response_code(400);
        echo json_encode(['error_message' => 'api_key e series_id são obrigatórios']);
        exit;
    }

    if (!preg_match('/^[A-Z0-9]+$/', $seriesId)) {
        http_response_code(400);
        echo json_encode(['error_message' => 'series_id inválido']);
        exit;
    }

    $url = 'https://api.stlouisfed.org/fred/series/observations'
         . '?series_id='         . urlencode($seriesId)
         . '&api_key='           . urlencode($apiKey)
         . '&file_type=json'
         . '&observation_start=' . urlencode($start)
         . '&sort_order=asc';

    $ctx  = stream_context_create(['http' => ['timeout' => 25, 'ignore_errors' => true]]);
    $body = @file_get_contents($url, false, $ctx);

    if ($body === false) {
        http_response_code(502);
        echo json_encode(['error_message' => 'Não foi possível conectar ao FRED API. Verifique a chave e a conectividade do servidor.']);
        exit;
    }

    forwardStatusCode();
    echo $body;

// ---------- CoinGecko ----------
} elseif ($source === 'coingecko') {
    $path = $_GET['path'] ?? '';

    if (!$path) {
        http_response_code(400);
        echo json_encode(['error' => 'path é obrigatório']);
        exit;
    }

    // Permitir apenas rotas conhecidas
    if (!preg_match('#^/(coins|global|simple)#', $path)) {
        http_response_code(400);
        echo json_encode(['error' => 'Rota CoinGecko não permitida: ' . $path]);
        exit;
    }

    // Chave gratuita do CoinGecko (opcional — CG-xxx)
    $cgKey = getenv('COINGECKO_API_KEY') ?: '';
    $cgKeyHeader = $cgKey ? "x-cg-demo-api-key: {$cgKey}\r\n" : '';

    $url = 'https://api.coingecko.com/api/v3' . $path;
    $ctx = stream_context_create([
        'http' => [
            'timeout'       => 25,
            'ignore_errors' => true,
            'header'        => "Accept: application/json\r\nUser-Agent: MacroDash/1.0\r\n{$cgKeyHeader}",
        ],
    ]);
    $body = @file_get_contents($url, false, $ctx);

    if ($body === false) {
        http_response_code(502);
        echo json_encode(['error' => 'Não foi possível conectar ao CoinGecko API']);
        exit;
    }

    forwardStatusCode();
    echo $body;

} else {
    http_response_code(400);
    echo json_encode(['error' => 'source inválido. Use source=fred ou source=coingecko']);
}
