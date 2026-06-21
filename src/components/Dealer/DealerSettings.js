import React, { useCallback, useEffect, useState } from 'react';
import Nav from 'react-bootstrap/Nav';
import {
  TbLock, TbBrandTelegram, TbPlug, TbAdjustments,
} from 'react-icons/tb';
import VaultSetup from './VaultSetup';
import ConnectionSettings from './settings/ConnectionSettings';
import TelegramSettings from './settings/TelegramSettings';
import PreferencesSettings from './settings/PreferencesSettings';

const SECTIONS = [
  { key: 'vault', label: 'Vault', icon: TbLock },
  { key: 'telegram', label: 'Telegram', icon: TbBrandTelegram },
  { key: 'connection', label: 'Conexão', icon: TbPlug },
  { key: 'preferences', label: 'Preferências', icon: TbAdjustments },
];

export default function DealerSettings({
  sendCommand,
  wsStatus,
  agentConnected,
  wsUrl,
  onPreferencesChange,
}) {
  const [section, setSection] = useState('vault');
  const [backendSettings, setBackendSettings] = useState(null);

  const loadBackendSettings = useCallback(async () => {
    if (wsStatus !== 'connected' || !sendCommand) return;
    try {
      const result = await sendCommand('get_settings', {});
      if (result?.ok && result.data && !result.data.error) {
        setBackendSettings(result.data);
      }
    } catch {
      // silencioso — seções individuais tratam erro
    }
  }, [sendCommand, wsStatus]);

  useEffect(() => {
    loadBackendSettings();
  }, [loadBackendSettings]);

  const ActiveIcon = SECTIONS.find((s) => s.key === section)?.icon || TbLock;

  return (
    <div className="dealer-settings">
      <div className="dealer-settings-header">
        <h3><ActiveIcon /> Configurações</h3>
        <p className="dealer-settings-desc mb-0">
          Vault, Telegram, conexão com o manager e preferências do console.
        </p>
      </div>

      <div className="dealer-settings-layout">
        <Nav variant="pills" className="dealer-settings-nav flex-column">
          {SECTIONS.map(({ key, label, icon: Icon }) => (
            <Nav.Item key={key}>
              <Nav.Link
                active={section === key}
                onClick={() => setSection(key)}
                className="dealer-settings-nav-link"
              >
                <Icon /> {label}
              </Nav.Link>
            </Nav.Item>
          ))}
        </Nav>

        <div className="dealer-settings-content">
          {section === 'vault' && (
            <VaultSetup
              embedded
              onRequestKeySync={async () => {
                if (wsStatus !== 'connected' || !sendCommand) {
                  throw new Error('Manager offline');
                }
                const r = await sendCommand('vault_sync_keys', {});
                if (!r?.ok) throw new Error(r?.data?.error || 'Falha ao sincronizar chaves');
                return r.data;
              }}
            />
          )}
          {section === 'telegram' && (
            <TelegramSettings
              sendCommand={sendCommand}
              wsStatus={wsStatus}
              agentConnected={agentConnected}
            />
          )}
          {section === 'connection' && (
            <ConnectionSettings
              wsStatus={wsStatus}
              agentConnected={agentConnected}
              wsUrl={wsUrl}
              settings={backendSettings}
            />
          )}
          {section === 'preferences' && (
            <PreferencesSettings onPreferencesChange={onPreferencesChange} />
          )}
        </div>
      </div>
    </div>
  );
}
