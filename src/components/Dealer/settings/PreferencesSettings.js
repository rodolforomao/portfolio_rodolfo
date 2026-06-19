import React, { useState } from 'react';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import {
  loadDealerPreferences,
  saveDealerPreferences,
} from '../utils/dealerPreferences';

export default function PreferencesSettings({ onPreferencesChange }) {
  const [prefs, setPrefs] = useState(() => loadDealerPreferences());
  const [saved, setSaved] = useState(false);

  const update = (key, value) => {
    setPrefs((p) => ({ ...p, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    const next = saveDealerPreferences(prefs);
    setPrefs(next);
    setSaved(true);
    onPreferencesChange?.(next);
  };

  return (
    <div className="dealer-settings-section">
      <h4>Preferências</h4>
      <p className="dealer-settings-desc">
        Opções salvas no navegador (localStorage). Valem só neste dispositivo.
      </p>

      <div className="dealer-settings-card">
        <Form.Check
          type="switch"
          id="pref-auto-refresh"
          className="dealer-settings-switch"
          label="Atualizar saldos automaticamente"
          checked={prefs.autoRefreshAssets}
          onChange={(e) => update('autoRefreshAssets', e.target.checked)}
        />

        <Form.Group className="mt-3">
          <Form.Label>Intervalo de refresh de saldos (segundos)</Form.Label>
          <Form.Control
            type="number"
            size="sm"
            min={5}
            max={120}
            value={prefs.autoRefreshIntervalSec}
            onChange={(e) => update('autoRefreshIntervalSec', Number(e.target.value) || 15)}
            disabled={!prefs.autoRefreshAssets}
          />
        </Form.Group>

        <Form.Check
          type="switch"
          id="pref-tx-sync"
          className="dealer-settings-switch mt-3"
          label="Sync de transações ao selecionar dealer"
          checked={prefs.transactionsSyncOnSelect}
          onChange={(e) => update('transactionsSyncOnSelect', e.target.checked)}
        />

        <Form.Group className="mt-3">
          <Form.Label>Destino padrão do send_history</Form.Label>
          <Form.Select
            size="sm"
            value={prefs.defaultHistoryDestination}
            onChange={(e) => update('defaultHistoryDestination', e.target.value)}
          >
            <option value="api">api</option>
            <option value="ssh">ssh</option>
          </Form.Select>
        </Form.Group>

        <Button
          className="dealer-btn-primary mt-3"
          size="sm"
          onClick={handleSave}
        >
          Salvar preferências
        </Button>

        {saved && (
          <p className="dealer-hint mt-2 mb-0">Preferências salvas.</p>
        )}
      </div>
    </div>
  );
}
