import React, { useMemo } from 'react';
import Badge from 'react-bootstrap/Badge';
import Button from 'react-bootstrap/Button';
import { TbBook2, TbExternalLink, TbRefresh } from 'react-icons/tb';
import {
  sortBookSide,
  formatBookPrice,
  formatBookAmount,
  formatBookNotional,
} from './utils/sideswapBook';

const STATUS_LABEL = {
  idle: 'Sem ordens para acompanhar',
  connecting: 'Conectando à SideSwap…',
  connected: 'Conectado',
  reconnecting: 'Reconectando…',
  error: 'Falha ao conectar',
};

function BookSide({ side, label, orders, ourIds }) {
  if (!orders.length) {
    return (
      <div className="dealer-book-col">
        <div className={`dealer-book-col-header dealer-book-col-header-${side.toLowerCase()}`}>{label}</div>
        <p className="dealer-empty dealer-book-empty">Livro vazio.</p>
      </div>
    );
  }
  return (
    <div className="dealer-book-col">
      <div className={`dealer-book-col-header dealer-book-col-header-${side.toLowerCase()}`}>{label}</div>
      <div className="dealer-table-scroll dealer-book-table-scroll">
        <table className="dealer-book-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Preço</th>
              <th>Qtd</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o, idx) => {
              const mine = ourIds.has(String(o.order_id));
              return (
                <tr
                  key={o.order_id ?? idx}
                  className={`dealer-book-row${mine ? ' dealer-book-row-mine' : ''}`}
                >
                  <td>{idx + 1}</td>
                  <td>{formatBookPrice(o.price)}</td>
                  <td>{formatBookAmount(o.amount)}</td>
                  <td>{formatBookNotional(o.amount, o.price) || '—'}</td>
                  <td className="dealer-book-mine-tag">
                    {mine && <Badge bg="success">nossa · {o.order_id}</Badge>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PairBook({ pair, book, ourIds, ourCount }) {
  const sells = useMemo(() => sortBookSide(book, 'Sell'), [book]);
  const buys = useMemo(() => sortBookSide(book, 'Buy'), [book]);
  const foundCount = sells.filter((o) => ourIds.has(String(o.order_id))).length
    + buys.filter((o) => ourIds.has(String(o.order_id))).length;

  return (
    <div className="dealer-panel dealer-book-pair-card">
      <div className="dealer-book-pair-header">
        <h4>
          <TbBook2 /> {pair.base}/{pair.quote}
          {pair.hasInverted && (
            <span className="dealer-book-inverted-hint" title="Par invertido no livro público em relação ao dealer">
              (invertido)
            </span>
          )}
        </h4>
        <div className="dealer-book-pair-meta">
          <span className="dealer-order-pair-full">{pair.dealerLabels.join(' · ')}</span>
          <Badge bg={foundCount > 0 ? 'success' : 'secondary'}>
            {foundCount}/{ourCount} nossa{ourCount !== 1 ? 's' : ''} no livro
          </Badge>
          {pair.marketUrl && (
            <a href={pair.marketUrl} target="_blank" rel="noreferrer" className="dealer-book-pair-link">
              <TbExternalLink /> SideSwap
            </a>
          )}
        </div>
      </div>
      <div className="dealer-book-grid">
        <BookSide side="Sell" label="Venda" orders={sells} ourIds={ourIds} />
        <BookSide side="Buy" label="Compra" orders={buys} ourIds={ourIds} />
      </div>
    </div>
  );
}

export default function OrderBooksPanel({
  pairs = [],
  books = {},
  placements = [],
  status = 'idle',
  error = null,
  lastUpdate = null,
  reconnect,
}) {
  const ourIdsByPair = useMemo(() => {
    const map = new Map();
    placements.forEach((p) => {
      if (!p.pairKey || p.order?.order_id == null) return;
      if (!map.has(p.pairKey)) map.set(p.pairKey, new Set());
      map.get(p.pairKey).add(String(p.order.order_id));
    });
    return map;
  }, [placements]);

  const ourCountByPair = useMemo(() => {
    const map = new Map();
    ourIdsByPair.forEach((ids, key) => map.set(key, ids.size));
    return map;
  }, [ourIdsByPair]);

  return (
    <section className="dealer-order-books-panel">
      <div className="dealer-orders-header">
        <h3>
          <TbBook2 /> Livros de ordem
          <span className="dealer-assets-sub">
            {STATUS_LABEL[status] || status}
            {lastUpdate && ` · atualizado ${lastUpdate.toLocaleTimeString('pt-BR')}`}
          </span>
        </h3>
        <Button size="sm" variant="outline-secondary" onClick={reconnect}>
          <TbRefresh /> Reconectar
        </Button>
      </div>

      <p className="dealer-settings-desc">
        Mostra só os pares SideSwap onde temos ordens ativas, com o livro público completo
        de cada lado (venda/compra) — nossas ordens aparecem destacadas.
      </p>

      {error && <p className="dealer-clear-toml-hint">{error}</p>}

      {pairs.length === 0 ? (
        <p className="dealer-empty">Nenhuma ordem enviada no momento — o livro aparece aqui assim que houver ordens no SideSwap.</p>
      ) : (
        pairs.map((pair) => (
          <PairBook
            key={pair.key}
            pair={pair}
            book={books[pair.key] || []}
            ourIds={ourIdsByPair.get(pair.key) || new Set()}
            ourCount={ourCountByPair.get(pair.key) || 0}
          />
        ))
      )}
    </section>
  );
}
