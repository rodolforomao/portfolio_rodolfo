import React, { useEffect, useMemo } from 'react';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import {
  TRADE_ASSET_OPTIONS,
  tradeDirsForPair,
  describeTrade,
  tradeDirOptionLabel,
} from './utils/marketCatalog';

function TradeSummary({ base, quote, tradeDir }) {
  if (!base || !quote) return null;
  const trade = describeTrade(base, quote, tradeDir);

  return (
    <div className="dealer-trade-summary">
      <div className="dealer-trade-pair">{trade.pairLabel}</div>
      <div className="dealer-trade-headline">{trade.headline}</div>
      <div className="dealer-trade-flow">{trade.flow}</div>
    </div>
  );
}

function FieldLabel({ children }) {
  return <div className="dealer-field-label">{children}</div>;
}

function pickQuoteOtherThan(base, currentQuote) {
  const next = TRADE_ASSET_OPTIONS.find((a) => a !== base);
  if (!next) return TRADE_ASSET_OPTIONS[0];
  if (currentQuote && currentQuote !== base && TRADE_ASSET_OPTIONS.includes(currentQuote)) {
    return currentQuote;
  }
  return next;
}

export default function PairSelectors({
  combinations,
  base,
  quote,
  tradeDir,
  onBaseChange,
  onQuoteChange,
  onTradeDirChange,
  showSummary = true,
}) {
  const dirs = useMemo(
    () => tradeDirsForPair(combinations, base, quote),
    [combinations, base, quote],
  );
  const trade = describeTrade(base, quote, tradeDir);
  const dirsKey = dirs.join('\0');

  useEffect(() => {
    if (!TRADE_ASSET_OPTIONS.includes(base)) {
      onBaseChange(TRADE_ASSET_OPTIONS[0]);
    }
  }, [base, onBaseChange]);

  useEffect(() => {
    const nextQuote = pickQuoteOtherThan(base, quote);
    if (quote !== nextQuote) {
      onQuoteChange(nextQuote);
    }
  }, [base, quote, onQuoteChange]);

  useEffect(() => {
    if (!base || !quote) return;
    const options = dirs.length ? dirs : ['Buy', 'Sell'];
    if (!options.includes(tradeDir)) {
      onTradeDirChange(options[0]);
    }
  }, [base, quote, tradeDir, dirsKey, onTradeDirChange, dirs]);

  const dirSelect = (options) => (
    <>
      <FieldLabel>Direção</FieldLabel>
      <Form.Select size="sm" value={tradeDir} onChange={(e) => onTradeDirChange(e.target.value)}>
        {options.map((d) => (
          <option key={d} value={d}>{tradeDirOptionLabel(base, quote, d)}</option>
        ))}
      </Form.Select>
    </>
  );

  return (
    <>
      {showSummary && <TradeSummary base={base} quote={quote} tradeDir={tradeDir} />}
      <Row className="g-2 mt-2">
        <Col xs={6}>
          <FieldLabel>{trade.baseLabel}</FieldLabel>
          <Form.Select size="sm" value={base} onChange={(e) => onBaseChange(e.target.value)}>
            {TRADE_ASSET_OPTIONS.map((asset) => (
              <option key={asset} value={asset}>{asset}</option>
            ))}
          </Form.Select>
        </Col>
        <Col xs={6}>
          <FieldLabel>{trade.quoteLabel}</FieldLabel>
          <Form.Select size="sm" value={quote} onChange={(e) => onQuoteChange(e.target.value)}>
            {TRADE_ASSET_OPTIONS.map((asset) => (
              <option key={asset} value={asset} disabled={asset === base}>
                {asset}
              </option>
            ))}
          </Form.Select>
        </Col>
        <Col xs={12}>
          {dirSelect(dirs.length ? dirs : ['Buy', 'Sell'])}
        </Col>
      </Row>
    </>
  );
}
