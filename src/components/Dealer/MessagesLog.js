import React from 'react';
import { buildMessageFeed } from './utils/messages';

export default function MessagesLog({ stateMessages, wsMessages, limit = 80 }) {
  const feed = buildMessageFeed(stateMessages, wsMessages, limit);

  if (!feed.length) {
    return <p className="dealer-empty">Nenhuma mensagem ainda.</p>;
  }

  return (
    <>
      {feed.map((entry) => (
        <div key={entry.id} className="dealer-log-line">
          <span className="dealer-log-time">{entry.displayTime}</span>
          <span className="dealer-log-text">{entry.text}</span>
        </div>
      ))}
    </>
  );
}
