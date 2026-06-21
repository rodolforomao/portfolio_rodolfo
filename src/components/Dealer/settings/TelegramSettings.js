import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Badge from 'react-bootstrap/Badge';
import Alert from 'react-bootstrap/Alert';
import InputGroup from 'react-bootstrap/InputGroup';
import Table from 'react-bootstrap/Table';
import {
  TbRefresh, TbBrandTelegram, TbTrash, TbSend, TbPlus, TbStar,
  TbBell, TbHistory,
} from 'react-icons/tb';
import { parseChatIds, runSettingsCommand } from '../utils/settingsCommand';
import { fetchVaultDealers, dealersToWallets } from '../vault/vaultApi';

const DEFAULT_BOT_ID = 'main';

// Metadados dos tipos de alerta (mantidos no frontend para labels)
const ALERT_TYPE_META = {
  notify_swaps:                 { label: 'Swaps / trades executados',          group: 'trades' },
  notify_deposits:              { label: 'Depósitos recebidos',                 group: 'trades' },
  notify_withdrawals:           { label: 'Saques realizados',                   group: 'trades' },
  notify_flash_crash:           { label: 'Flash crash detectado',               group: 'risco' },
  notify_order_not_in_book:     { label: 'Ordem ausente do livro SideSwap',     group: 'risco' },
  notify_dealer_crash:          { label: 'Dealer crashou / reiniciou',           group: 'risco' },
  notify_manager_disconnected:  { label: 'Manager desconectado do relay',        group: 'risco' },
  notify_low_balance:           { label: 'Saldo baixo (threshold configurável)', group: 'avancado' },
  notify_order_stuck_pending:   { label: 'Ordem presa pendente (sem order_id)', group: 'avancado' },
  notify_price_oracle_unavailable: { label: 'Oracle de preços indisponível',    group: 'avancado' },
};

const ALERT_GROUPS = {
  trades: 'Operações',
  risco:  'Risco / sistema',
  avancado: 'Avançado',
};

const EVENT_TYPE_LABELS = {
  swap:                     'Swap',
  deposit:                  'Depósito',
  withdrawal:               'Saque',
  flash_crash:              'Flash crash',
  flash_crash_recovery:     'Recuperação',
  order_not_in_book:        'Ordem ausente',
  dealer_crash:             'Dealer crash',
  low_balance:              'Saldo baixo',
  order_stuck_pending:      'Ordem presa',
  manager_disconnected:     'Manager desconectado',
  price_oracle_unavailable: 'Oracle indisponível',
};

function BotFormFields({
  botId, setBotId, name, setName, token, setToken, chatIdsText, setChatIdsText,
  disabled, botIdLocked,
}) {
  return (
    <>
      <Form.Group className="mb-3">
        <Form.Label>ID do bot</Form.Label>
        <Form.Control
          size="sm"
          value={botId}
          onChange={(e) => setBotId(e.target.value)}
          placeholder="main"
          disabled={disabled || botIdLocked}
        />
        <Form.Text className="text-muted">Identificador interno (ex.: <code>main</code>, <code>cliente_1</code>).</Form.Text>
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>Nome amigável</Form.Label>
        <Form.Control
          size="sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Bot Principal"
          disabled={disabled}
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>Token (@BotFather)</Form.Label>
        <Form.Control
          size="sm"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
          disabled={disabled}
          autoComplete="off"
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>Chat IDs</Form.Label>
        <Form.Control
          as="textarea"
          rows={2}
          size="sm"
          value={chatIdsText}
          onChange={(e) => setChatIdsText(e.target.value)}
          placeholder="1722629689 ou vários separados por vírgula"
          disabled={disabled}
        />
        <Form.Text className="text-muted">
          Obtenha via @userinfobot ou envie <code>/start</code> ao bot e adicione o ID aqui.
        </Form.Text>
      </Form.Group>
    </>
  );
}

function NotificationHistoryPanel({ history, onRefresh, loading }) {
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    if (!filter) return history;
    return history.filter((h) => (
      h.event_type?.includes(filter)
      || h.wallet?.toLowerCase().includes(filter.toLowerCase())
    ));
  }, [history, filter]);

  function fmtTs(ts) {
    if (!ts) return '—';
    try {
      return new Date(ts).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    } catch {
      return ts;
    }
  }

  function statusBadge(entry) {
    if (entry.skipped === 'disabled') return <Badge bg="secondary">desabilitado</Badge>;
    if (entry.skipped === 'no_bots') return <Badge bg="warning" text="dark">sem bots</Badge>;
    if (entry.sent > 0) return <Badge bg="success">{entry.sent} enviado{entry.sent > 1 ? 's' : ''}</Badge>;
    if (entry.failed > 0) return <Badge bg="danger">{entry.failed} falha{entry.failed > 1 ? 's' : ''}</Badge>;
    return <Badge bg="secondary">0</Badge>;
  }

  return (
    <div className="dealer-tg-history">
      <div className="dealer-tg-history-head">
        <InputGroup size="sm" style={{ maxWidth: 280 }}>
          <Form.Control
            placeholder="Filtrar por tipo ou wallet"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          {filter && (
            <Button variant="outline-secondary" onClick={() => setFilter('')}>×</Button>
          )}
        </InputGroup>
        <Button size="sm" variant="outline-secondary" onClick={onRefresh} disabled={loading}>
          <TbRefresh className={loading ? 'dealer-spin' : ''} /> Atualizar
        </Button>
      </div>

      {filtered.length === 0 ? (
        <p className="dealer-hint mt-2">Nenhuma notificação encontrada.</p>
      ) : (
        <div className="dealer-tg-history-table-wrap">
          <Table size="sm" className="dealer-tg-history-table">
            <thead>
              <tr>
                <th>Horário</th>
                <th>Tipo</th>
                <th>Wallet</th>
                <th>Status</th>
                <th>Preview</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry, i) => (
                <tr key={i} className={entry.sent > 0 ? '' : 'dealer-tg-history-row-muted'}>
                  <td className="dealer-tg-history-ts">{fmtTs(entry.ts)}</td>
                  <td>
                    <span className="dealer-tg-event-badge">
                      {EVENT_TYPE_LABELS[entry.event_type] || entry.event_type}
                    </span>
                  </td>
                  <td className="dealer-tg-history-wallet">{entry.wallet || '—'}</td>
                  <td>{statusBadge(entry)}</td>
                  <td className="dealer-tg-history-preview" title={entry.preview}>
                    {entry.preview?.slice(0, 60) || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
      <p className="dealer-hint mt-1">Últimas {filtered.length} notificações (mais recentes primeiro).</p>
    </div>
  );
}

function AlertsConfigPanel({ alerts, onSave, busy, canUseWs, lowBalanceThresholds, onSaveThresholds }) {
  const [localAlerts, setLocalAlerts] = useState({});
  const [thresholdText, setThresholdText] = useState('');
  const [thresholdAsset, setThresholdAsset] = useState('USDt');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (alerts) {
      const map = {};
      Object.entries(alerts).forEach(([k, v]) => { map[k] = v.enabled; });
      setLocalAlerts(map);
      setDirty(false);
    }
  }, [alerts]);

  const toggle = (key) => {
    setLocalAlerts((prev) => ({ ...prev, [key]: !prev[key] }));
    setDirty(true);
  };

  const handleSave = () => {
    onSave(localAlerts);
    setDirty(false);
  };

  const handleAddThreshold = () => {
    const val = parseFloat(thresholdText.replace(',', '.'));
    if (!thresholdAsset || isNaN(val)) return;
    onSaveThresholds({ ...lowBalanceThresholds, [thresholdAsset]: val });
    setThresholdText('');
  };

  const handleRemoveThreshold = (asset) => {
    const updated = { ...lowBalanceThresholds };
    delete updated[asset];
    onSaveThresholds(updated);
  };

  const groupKeys = Object.entries(ALERT_GROUPS).map(([groupId, groupLabel]) => ({
    groupId,
    groupLabel,
    keys: Object.entries(ALERT_TYPE_META)
      .filter(([, meta]) => meta.group === groupId)
      .map(([key]) => key),
  }));

  return (
    <div className="dealer-tg-alerts">
      {groupKeys.map(({ groupId, groupLabel, keys }) => (
        <div key={groupId} className="dealer-tg-alert-group mb-3">
          <div className="dealer-tg-alert-group-label">{groupLabel}</div>
          {keys.map((key) => {
            const meta = ALERT_TYPE_META[key];
            const alertData = alerts?.[key];
            const enabled = localAlerts[key] ?? alertData?.enabled ?? alertData?.default ?? true;
            return (
              <div key={key} className="dealer-tg-alert-row">
                <Form.Check
                  type="switch"
                  id={`alert-${key}`}
                  className="dealer-settings-switch"
                  label={meta.label}
                  checked={enabled}
                  onChange={() => toggle(key)}
                  disabled={busy || !canUseWs}
                />
                {!enabled && (
                  <Badge bg="secondary" className="ms-2 dealer-tg-alert-off">off</Badge>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {dirty && (
        <Button
          size="sm"
          className="dealer-btn-primary mt-1 mb-3"
          disabled={busy || !canUseWs}
          onClick={handleSave}
        >
          Salvar alertas
        </Button>
      )}

      {/* Threshold de saldo baixo */}
      {(localAlerts.notify_low_balance ?? alerts?.notify_low_balance?.enabled) && (
        <div className="dealer-tg-threshold-section">
          <div className="dealer-tg-alert-group-label">Thresholds — saldo mínimo por asset</div>
          <p className="dealer-hint">
            Notifica quando o saldo cair abaixo do valor configurado após um saque.
          </p>
          {Object.entries(lowBalanceThresholds || {}).length > 0 ? (
            <ul className="dealer-settings-list mb-2">
              {Object.entries(lowBalanceThresholds).map(([asset, val]) => (
                <li key={asset}>
                  <strong>{asset}</strong>: {val}
                  <Button
                    size="sm"
                    variant="link"
                    className="dealer-tg-chat-remove"
                    disabled={busy || !canUseWs}
                    onClick={() => handleRemoveThreshold(asset)}
                  >
                    ×
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dealer-hint">Nenhum threshold configurado.</p>
          )}
          <InputGroup size="sm" className="dealer-tg-threshold-add">
            <Form.Control
              placeholder="Asset (ex: USDt, L-BTC)"
              value={thresholdAsset}
              onChange={(e) => setThresholdAsset(e.target.value)}
              style={{ maxWidth: 120 }}
              disabled={busy || !canUseWs}
            />
            <Form.Control
              placeholder="Valor mínimo"
              value={thresholdText}
              onChange={(e) => setThresholdText(e.target.value)}
              disabled={busy || !canUseWs}
            />
            <Button
              variant="outline-secondary"
              disabled={busy || !canUseWs || !thresholdAsset || !thresholdText}
              onClick={handleAddThreshold}
            >
              <TbPlus /> Adicionar
            </Button>
          </InputGroup>
        </div>
      )}
    </div>
  );
}

export default function TelegramSettings({ sendCommand, wsStatus, agentConnected }) {
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [config, setConfig] = useState(null);
  const [wallets, setWallets] = useState([]);
  const [alertsConfig, setAlertsConfig] = useState(null);
  const [lowBalanceThresholds, setLowBalanceThresholds] = useState({});
  const [notificationHistory, setNotificationHistory] = useState([]);
  const [activeSection, setActiveSection] = useState('bots');
  const [lastSavedBotId, setLastSavedBotId] = useState(null);

  const [botId, setBotId] = useState(DEFAULT_BOT_ID);
  const [botName, setBotName] = useState('Bot Principal');
  const [botToken, setBotToken] = useState('');
  const [chatIdsText, setChatIdsText] = useState('');

  const [newChatByBot, setNewChatByBot] = useState({});
  const [defaults, setDefaults] = useState({
    notify_swaps: true,
    notify_deposits: true,
    notify_withdrawals: true,
  });

  const [walletForm, setWalletForm] = useState({
    wallet_name: '',
    bot_ids: [DEFAULT_BOT_ID],
    notify_swaps: true,
    notify_deposits: true,
    notify_withdrawals: true,
  });

  const canUseWs = wsStatus === 'connected' && agentConnected && sendCommand;

  const load = useCallback(async () => {
    if (wsStatus !== 'connected' || !sendCommand) return;
    setLoading(true);
    setError(null);
    try {
      const [tgConfig, alertsCfg, vaultRes] = await Promise.all([
        runSettingsCommand(sendCommand, 'get_telegram_config', {}),
        runSettingsCommand(sendCommand, 'get_telegram_alerts_config', {}).catch(() => null),
        fetchVaultDealers().catch(() => ({ ok: false, data: { dealers: [] } })),
      ]);
      setConfig(tgConfig);
      setWallets(dealersToWallets(vaultRes.data?.dealers || []));
      if (alertsCfg) {
        setAlertsConfig(alertsCfg.alerts || null);
        setLowBalanceThresholds(alertsCfg.low_balance_thresholds || {});
      }
      if (tgConfig.default_notifications) {
        setDefaults({
          notify_swaps: tgConfig.default_notifications.notify_swaps !== false,
          notify_deposits: tgConfig.default_notifications.notify_deposits !== false,
          notify_withdrawals: tgConfig.default_notifications.notify_withdrawals !== false,
        });
      }
      const mainBot = (tgConfig.bots || []).find((b) => b.bot_id === DEFAULT_BOT_ID);
      if (mainBot?.chat_ids?.length) {
        setChatIdsText(mainBot.chat_ids.join(', '));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [sendCommand, wsStatus]);

  const loadHistory = useCallback(async () => {
    if (wsStatus !== 'connected' || !sendCommand) return;
    setLoadingHistory(true);
    try {
      const result = await runSettingsCommand(sendCommand, 'get_telegram_notification_history', { limit: 200 });
      setNotificationHistory(result.history || []);
    } catch {
      // silencioso
    } finally {
      setLoadingHistory(false);
    }
  }, [sendCommand, wsStatus]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (activeSection === 'historico') {
      loadHistory();
    }
  }, [activeSection, loadHistory]);

  const bots = config?.bots || [];
  const walletConfigs = useMemo(() => config?.wallets || {}, [config]);
  const globalBot = config?.global_bot;
  const isActive = bots.some((b) => b.chat_count > 0);

  const walletOptions = useMemo(() => {
    const fromBackend = wallets.map((w) => w.name).filter(Boolean);
    const fromConfig = Object.keys(walletConfigs);
    return [...new Set([...fromBackend, ...fromConfig])].sort();
  }, [wallets, walletConfigs]);

  const flash = (msg) => {
    setSuccess(msg);
    setError(null);
    setTimeout(() => setSuccess(null), 5000);
  };

  const runAction = async (fn) => {
    if (!canUseWs) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveBot = () => {
    const id = botId.trim();
    const token = botToken.trim();
    if (!id) { setError('Informe o ID do bot.'); return; }
    const chat_ids = parseChatIds(chatIdsText);
    const exists = bots.some((b) => b.bot_id === id);
    if (!exists && !token) { setError('Informe o token do @BotFather.'); return; }

    runAction(async () => {
      if (exists) {
        for (const cid of chat_ids) {
          await runSettingsCommand(sendCommand, 'add_telegram_chat', { bot_id: id, chat_id: cid });
        }
        if (id === globalBot || !globalBot) {
          await runSettingsCommand(sendCommand, 'set_telegram_global_bot', { bot_id: id });
        }
        flash(`Bot "${id}" atualizado (chats). Para trocar token, remova e cadastre de novo.`);
        return;
      }
      await runSettingsCommand(sendCommand, 'add_telegram_bot', {
        bot_id: id, token, name: botName.trim() || id, chat_ids,
      });
      await runSettingsCommand(sendCommand, 'set_telegram_global_bot', { bot_id: id });
      setBotToken('');
      setLastSavedBotId(id);
      flash(`Bot "${id}" registrado. Envie uma mensagem de teste para confirmar.`);
    });
  };

  const handleSaveDefaults = () => {
    runAction(async () => {
      await runSettingsCommand(sendCommand, 'update_telegram_defaults', defaults);
      flash('Notificações padrão salvas.');
    });
  };

  const handleTest = (bot_id) => {
    runAction(async () => {
      const data = await runSettingsCommand(sendCommand, 'send_telegram_test', {
        bot_id,
        message: '✅ Teste do Dealer Console — manager_dealer',
      });
      flash(`Teste enviado: ${data.sent}/${data.total_chats} chat(s).`);
    });
  };

  const handleRemoveBot = (bot_id) => {
    if (!window.confirm(`Remover bot "${bot_id}"?`)) return;
    runAction(async () => {
      await runSettingsCommand(sendCommand, 'remove_telegram_bot', { bot_id });
      flash(`Bot "${bot_id}" removido.`);
    });
  };

  const handleSetGlobal = (bot_id) => {
    runAction(async () => {
      await runSettingsCommand(sendCommand, 'set_telegram_global_bot', { bot_id });
      flash(`Bot global: ${bot_id}`);
    });
  };

  const handleAddChat = (bot_id) => {
    const chat_id = (newChatByBot[bot_id] || '').trim();
    if (!chat_id) return;
    runAction(async () => {
      await runSettingsCommand(sendCommand, 'add_telegram_chat', { bot_id, chat_id });
      setNewChatByBot((prev) => ({ ...prev, [bot_id]: '' }));
      flash(`Chat ${chat_id} adicionado ao bot ${bot_id}.`);
    });
  };

  const handleRemoveChat = (bot_id, chat_id) => {
    runAction(async () => {
      await runSettingsCommand(sendCommand, 'remove_telegram_chat', { bot_id, chat_id });
      flash(`Chat ${chat_id} removido.`);
    });
  };

  const handleSaveWallet = () => {
    const wallet_name = walletForm.wallet_name.trim();
    if (!wallet_name) { setError('Selecione uma carteira.'); return; }
    runAction(async () => {
      await runSettingsCommand(sendCommand, 'configure_telegram_wallet', {
        wallet_name,
        bot_ids: walletForm.bot_ids,
        notify_swaps: walletForm.notify_swaps,
        notify_deposits: walletForm.notify_deposits,
        notify_withdrawals: walletForm.notify_withdrawals,
      });
      flash(`Carteira "${wallet_name}" configurada.`);
    });
  };

  const handleRemoveWallet = (wallet_name) => {
    runAction(async () => {
      await runSettingsCommand(sendCommand, 'remove_telegram_wallet', { wallet_name });
      flash(`Configuração da carteira "${wallet_name}" removida.`);
    });
  };

  const loadWalletIntoForm = (wallet_name) => {
    const wc = walletConfigs[wallet_name];
    if (!wc) {
      setWalletForm({
        wallet_name,
        bot_ids: bots.length ? [bots[0].bot_id] : [DEFAULT_BOT_ID],
        notify_swaps: defaults.notify_swaps,
        notify_deposits: defaults.notify_deposits,
        notify_withdrawals: defaults.notify_withdrawals,
      });
      return;
    }
    setWalletForm({
      wallet_name,
      bot_ids: wc.bots || [],
      notify_swaps: wc.notify_swaps !== false,
      notify_deposits: wc.notify_deposits !== false,
      notify_withdrawals: wc.notify_withdrawals !== false,
    });
  };

  const handleSaveAlerts = (updates) => {
    runAction(async () => {
      const result = await runSettingsCommand(sendCommand, 'update_telegram_alerts_config', updates);
      setAlertsConfig(result.alerts || null);
      flash('Tipos de alerta salvos.');
    });
  };

  const handleSaveThresholds = (thresholds) => {
    runAction(async () => {
      const result = await runSettingsCommand(sendCommand, 'update_telegram_alerts_config', {
        low_balance_thresholds: thresholds,
      });
      setLowBalanceThresholds(result.low_balance_thresholds || {});
      flash('Thresholds salvos.');
    });
  };

  const SECTIONS = [
    { key: 'bots',     label: 'Bots & chats' },
    { key: 'alertas',  label: 'Tipos de alerta' },
    { key: 'historico', label: 'Histórico' },
  ];

  return (
    <div className="dealer-settings-section dealer-telegram-settings">
      <div className="dealer-settings-section-head">
        <h4><TbBrandTelegram /> Telegram</h4>
        <Button
          size="sm"
          variant="outline-secondary"
          onClick={load}
          disabled={loading || wsStatus !== 'connected'}
        >
          <TbRefresh className={loading ? 'dealer-spin' : ''} />
          {loading ? '…' : 'Atualizar'}
        </Button>
      </div>

      {wsStatus !== 'connected' && (
        <Alert variant="secondary">WebSocket offline — conecte ao relay para configurar.</Alert>
      )}
      {wsStatus === 'connected' && !agentConnected && (
        <Alert variant="warning">Manager offline — inicie o manager_dealer para salvar configurações.</Alert>
      )}
      {error && <Alert variant="danger" className="py-2">{error}</Alert>}
      {success && (
        <Alert variant="success" className="py-2 dealer-tg-success-alert">
          <span>{success}</span>
          {lastSavedBotId && bots.some((b) => b.bot_id === lastSavedBotId && b.chat_count > 0) && (
            <Button
              size="sm"
              variant="outline-success"
              className="ms-3"
              disabled={busy}
              onClick={() => { handleTest(lastSavedBotId); }}
            >
              <TbSend /> Testar agora
            </Button>
          )}
        </Alert>
      )}

      {/* Status resumido */}
      <div className={`dealer-settings-card mb-3${isActive ? '' : ' dealer-tg-status-unconfigured'}`}>
        <div className="dealer-settings-row">
          <span className="dealer-settings-row-label">Status</span>
          <div className="dealer-tg-status-row">
            <Badge bg={isActive ? 'success' : 'secondary'}>
              {isActive ? 'Ativo' : 'Não configurado'}
            </Badge>
            {isActive && globalBot && (
              <Button
                size="sm"
                variant="outline-secondary"
                className="dealer-tg-quick-test"
                disabled={busy || !canUseWs}
                onClick={() => handleTest(globalBot)}
                title="Enviar mensagem de teste agora"
              >
                <TbSend /> Testar
              </Button>
            )}
          </div>
        </div>
        <div className="dealer-settings-row">
          <span className="dealer-settings-row-label">Bots · chats · global</span>
          <span>
            {bots.length} bot(s) · {bots.reduce((n, b) => n + (b.chat_count || 0), 0)} chat(s)
            {globalBot ? ` · global: ${globalBot}` : ''}
          </span>
        </div>
        {alertsConfig && (
          <div className="dealer-settings-row">
            <span className="dealer-settings-row-label">Alertas ativos</span>
            <span>
              {Object.values(alertsConfig).filter((a) => a.enabled).length}
              {' / '}
              {Object.keys(alertsConfig).length}
            </span>
          </div>
        )}
        {!isActive && canUseWs && (
          <div className="dealer-tg-setup-hint">
            Configure um bot abaixo para receber alertas via Telegram.
          </div>
        )}
      </div>

      {/* Nav interna */}
      <div className="dealer-tg-inner-nav mb-3">
        {SECTIONS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`dealer-tg-inner-tab${activeSection === key ? ' active' : ''}`}
            onClick={() => setActiveSection(key)}
          >
            {key === 'alertas' && <TbBell />}
            {key === 'historico' && <TbHistory />}
            {' '}{label}
          </button>
        ))}
      </div>

      {/* ── BOTS & CHATS ── */}
      {activeSection === 'bots' && (
        <>
          <div className="dealer-settings-card mb-3">
            <h5 className="dealer-settings-subtitle">1. Bot principal</h5>
            <p className="dealer-settings-desc">
              Crie o bot no <strong>@BotFather</strong> (<code>/newbot</code>), cole o token e os chat IDs.
            </p>
            <BotFormFields
              botId={botId} setBotId={setBotId}
              name={botName} setName={setBotName}
              token={botToken} setToken={setBotToken}
              chatIdsText={chatIdsText} setChatIdsText={setChatIdsText}
              disabled={busy || !canUseWs}
            />
            <Button
              className="dealer-btn-primary"
              size="sm"
              disabled={busy || !canUseWs}
              onClick={handleSaveBot}
            >
              {busy ? 'Salvando…' : 'Salvar bot'}
            </Button>
            {bots.some((b) => b.bot_id === botId.trim()) && (
              <p className="dealer-hint mt-2 mb-0">
                Bot já existe: salvar adiciona chats. Para trocar o token, remova o bot e cadastre de novo.
              </p>
            )}
          </div>

          <div className="dealer-settings-card mb-3">
            <h5 className="dealer-settings-subtitle">2. Notificações padrão (por carteira)</h5>
            <Form.Check
              type="switch" id="tg-notify-swaps" className="dealer-settings-switch"
              label="Swaps / trades" checked={defaults.notify_swaps}
              onChange={(e) => setDefaults((d) => ({ ...d, notify_swaps: e.target.checked }))}
              disabled={busy || !canUseWs}
            />
            <Form.Check
              type="switch" id="tg-notify-deposits" className="dealer-settings-switch mt-2"
              label="Depósitos / entradas" checked={defaults.notify_deposits}
              onChange={(e) => setDefaults((d) => ({ ...d, notify_deposits: e.target.checked }))}
              disabled={busy || !canUseWs}
            />
            <Form.Check
              type="switch" id="tg-notify-withdrawals" className="dealer-settings-switch mt-2"
              label="Saques / saídas" checked={defaults.notify_withdrawals}
              onChange={(e) => setDefaults((d) => ({ ...d, notify_withdrawals: e.target.checked }))}
              disabled={busy || !canUseWs}
            />
            <Button
              size="sm" variant="outline-secondary" className="mt-3"
              disabled={busy || !canUseWs} onClick={handleSaveDefaults}
            >
              Salvar padrões
            </Button>
          </div>

          {bots.length > 0 && (
            <div className="dealer-settings-card mb-3">
              <h5 className="dealer-settings-subtitle">3. Bots configurados</h5>
              {bots.map((bot) => (
                <div key={bot.bot_id} className="dealer-tg-bot-card">
                  <div className="dealer-tg-bot-head">
                    <div>
                      <strong>{bot.name || bot.bot_id}</strong>
                      {bot.username && <span className="dealer-tg-username"> @{bot.username}</span>}
                      <code className="dealer-tg-bot-id ms-2">{bot.bot_id}</code>
                      {bot.is_global && <Badge bg="info" className="ms-1">global</Badge>}
                    </div>
                    <div className="dealer-tg-bot-actions">
                      {!bot.is_global && (
                        <Button size="sm" variant="outline-secondary" disabled={busy || !canUseWs}
                          onClick={() => handleSetGlobal(bot.bot_id)} title="Bot global">
                          <TbStar />
                        </Button>
                      )}
                      <Button size="sm" variant="outline-secondary" disabled={busy || !canUseWs}
                        onClick={() => handleTest(bot.bot_id)}>
                        <TbSend /> Teste
                      </Button>
                      <Button size="sm" variant="outline-danger" disabled={busy || !canUseWs}
                        onClick={() => handleRemoveBot(bot.bot_id)}>
                        <TbTrash />
                      </Button>
                    </div>
                  </div>
                  <div className="dealer-tg-token">Token: {bot.token_masked || '—'}</div>
                  <div className="dealer-tg-chats">
                    <span className="dealer-tg-chats-label">Chats:</span>
                    {(bot.chat_ids || []).length === 0 ? (
                      <span className="dealer-hint"> nenhum — envie /start ou adicione abaixo</span>
                    ) : (
                      <ul className="dealer-tg-chat-list">
                        {bot.chat_ids.map((cid) => (
                          <li key={cid}>
                            <code>{cid}</code>
                            <Button size="sm" variant="link" className="dealer-tg-chat-remove"
                              disabled={busy || !canUseWs}
                              onClick={() => handleRemoveChat(bot.bot_id, cid)}>×</Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <InputGroup size="sm" className="dealer-tg-add-chat">
                    <Form.Control
                      placeholder="Novo chat ID"
                      value={newChatByBot[bot.bot_id] || ''}
                      onChange={(e) => setNewChatByBot((p) => ({ ...p, [bot.bot_id]: e.target.value }))}
                      disabled={busy || !canUseWs}
                    />
                    <Button variant="outline-secondary" disabled={busy || !canUseWs}
                      onClick={() => handleAddChat(bot.bot_id)}>
                      <TbPlus /> Chat
                    </Button>
                  </InputGroup>
                </div>
              ))}
            </div>
          )}

          <div className="dealer-settings-card mb-3">
            <h5 className="dealer-settings-subtitle">4. Por carteira (opcional)</h5>
            <p className="dealer-settings-desc">
              Bots específicos por wallet. O bot <strong>global</strong> continua recebendo tudo.
            </p>
            <Form.Group className="mb-3">
              <Form.Label>Carteira</Form.Label>
              <Form.Select size="sm" value={walletForm.wallet_name}
                onChange={(e) => loadWalletIntoForm(e.target.value)}
                disabled={busy || !canUseWs}>
                <option value="">— selecione —</option>
                {walletOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </Form.Select>
            </Form.Group>
            {walletForm.wallet_name && (
              <>
                <Form.Group className="mb-3">
                  <Form.Label>Bots desta carteira</Form.Label>
                  {bots.map((bot) => (
                    <Form.Check key={bot.bot_id} type="checkbox"
                      id={`wallet-bot-${bot.bot_id}`}
                      label={`${bot.name || bot.bot_id}${bot.is_global ? ' (global)' : ''}`}
                      checked={walletForm.bot_ids.includes(bot.bot_id)}
                      onChange={(e) => {
                        setWalletForm((wf) => {
                          const s = new Set(wf.bot_ids);
                          if (e.target.checked) s.add(bot.bot_id); else s.delete(bot.bot_id);
                          return { ...wf, bot_ids: [...s] };
                        });
                      }}
                      disabled={busy || !canUseWs}
                    />
                  ))}
                  {bots.length === 0 && <p className="dealer-hint mb-0">Cadastre um bot antes.</p>}
                </Form.Group>
                <Form.Check type="switch" className="dealer-settings-switch" label="Swaps"
                  checked={walletForm.notify_swaps}
                  onChange={(e) => setWalletForm((w) => ({ ...w, notify_swaps: e.target.checked }))}
                  disabled={busy || !canUseWs} />
                <Form.Check type="switch" className="dealer-settings-switch mt-2" label="Depósitos"
                  checked={walletForm.notify_deposits}
                  onChange={(e) => setWalletForm((w) => ({ ...w, notify_deposits: e.target.checked }))}
                  disabled={busy || !canUseWs} />
                <Form.Check type="switch" className="dealer-settings-switch mt-2" label="Saques"
                  checked={walletForm.notify_withdrawals}
                  onChange={(e) => setWalletForm((w) => ({ ...w, notify_withdrawals: e.target.checked }))}
                  disabled={busy || !canUseWs} />
                <div className="dealer-tg-wallet-actions mt-3">
                  <Button size="sm" className="dealer-btn-primary"
                    disabled={busy || !canUseWs} onClick={handleSaveWallet}>
                    Salvar carteira
                  </Button>
                  {walletConfigs[walletForm.wallet_name] && (
                    <Button size="sm" variant="outline-danger" disabled={busy || !canUseWs}
                      onClick={() => handleRemoveWallet(walletForm.wallet_name)}>
                      Remover config
                    </Button>
                  )}
                </div>
              </>
            )}
            {Object.keys(walletConfigs).length > 0 && (
              <ul className="dealer-settings-list mt-3">
                {Object.entries(walletConfigs).map(([name, wc]) => (
                  <li key={name}>
                    <button type="button" className="dealer-tg-wallet-link"
                      onClick={() => loadWalletIntoForm(name)}>{name}</button>
                    {' → '}{(wc.bots || []).join(', ') || '—'}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <details className="dealer-tg-help">
            <summary>Dicas (@BotFather, chat ID, /start)</summary>
            <ol className="dealer-settings-steps">
              <li>Telegram → <strong>@BotFather</strong> → <code>/newbot</code> → copie o token.</li>
              <li>Chat ID: <strong>@userinfobot</strong> ou envie <code>/start</code> ao seu bot e veja os logs do manager.</li>
              <li>Salve aqui — equivale a <code>TELEGRAM_BOT_TOKEN</code> + <code>TELEGRAM_CHAT_ID</code> no <code>.env</code>.</li>
              <li>Use <strong>Teste</strong> para confirmar entrega.</li>
            </ol>
          </details>
        </>
      )}

      {/* ── TIPOS DE ALERTA ── */}
      {activeSection === 'alertas' && (
        <div className="dealer-settings-card">
          <h5 className="dealer-settings-subtitle">
            <TbBell /> Tipos de alerta
          </h5>
          <p className="dealer-settings-desc">
            Controla quais eventos disparam mensagem Telegram globalmente.
            Alertas de risco são recomendados para produção.
          </p>
          {alertsConfig ? (
            <AlertsConfigPanel
              alerts={alertsConfig}
              onSave={handleSaveAlerts}
              busy={busy}
              canUseWs={canUseWs}
              lowBalanceThresholds={lowBalanceThresholds}
              onSaveThresholds={handleSaveThresholds}
            />
          ) : (
            <p className="dealer-hint">
              {wsStatus !== 'connected'
                ? 'Conecte ao relay para carregar.'
                : 'Carregando…'}
            </p>
          )}
        </div>
      )}

      {/* ── HISTÓRICO ── */}
      {activeSection === 'historico' && (
        <div className="dealer-settings-card">
          <h5 className="dealer-settings-subtitle">
            <TbHistory /> Histórico de notificações
          </h5>
          <p className="dealer-settings-desc">
            Últimas 200 notificações — enviadas, desabilitadas ou sem destino.
          </p>
          <NotificationHistoryPanel
            history={notificationHistory}
            onRefresh={loadHistory}
            loading={loadingHistory}
          />
        </div>
      )}
    </div>
  );
}
