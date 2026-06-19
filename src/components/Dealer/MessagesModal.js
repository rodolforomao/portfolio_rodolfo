import React from 'react';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import { TbMessage, TbX } from 'react-icons/tb';
import MessagesLog from './MessagesLog';
import { buildMessageFeed } from './utils/messages';

export default function MessagesModal({
  show,
  onHide,
  stateMessages,
  wsMessages,
}) {
  const count = buildMessageFeed(stateMessages, wsMessages, 200).length;

  return (
    <Modal
      show={show}
      onHide={onHide}
      fullscreen="sm-down"
      size="lg"
      centered
      className="dealer-messages-modal"
      scrollable
    >
      <Modal.Header closeButton closeVariant="white" className="dealer-modal-header">
        <Modal.Title>
          <TbMessage /> Mensagens {count > 0 && <span className="dealer-modal-count">({count})</span>}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="dealer-modal-body">
        <div className="dealer-log dealer-log-modal">
          <MessagesLog stateMessages={stateMessages} wsMessages={wsMessages} limit={200} />
        </div>
      </Modal.Body>
      <Modal.Footer className="dealer-modal-footer">
        <Button variant="outline-secondary" size="sm" onClick={onHide}>
          <TbX /> Fechar
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
