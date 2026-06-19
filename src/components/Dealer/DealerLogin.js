import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Container from 'react-bootstrap/Container';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Alert from 'react-bootstrap/Alert';
import { TbLock, TbLogin } from 'react-icons/tb';
import { validateCredentials, saveSession } from './config';
import './Dealer.css';

export default function DealerLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('Informe usuário e senha.');
      return;
    }

    const result = validateCredentials(username.trim(), password);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    saveSession();
    navigate('/dealer/console');
  };

  return (
    <div className="dealer-root">
      <Container className="dealer-login-wrap">
        <div className="dealer-login-card">
          <div className="dealer-login-header">
            <TbLock className="dealer-login-icon" />
            <h1>Dealer Console</h1>
            <p>Acesso restrito — informe suas credenciais.</p>
          </div>

          {error && <Alert variant="danger">{error}</Alert>}

          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Usuário</Form.Label>
              <Form.Control
                type="text"
                placeholder="usuário"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
              />
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Label>Senha</Form.Label>
              <Form.Control
                type="password"
                placeholder="senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </Form.Group>

            <Button type="submit" className="dealer-btn-primary w-100">
              <TbLogin /> Entrar
            </Button>
          </Form>

          <p className="dealer-login-footer">
            O agente local (manager_dealer) deve estar rodando com WS_RELAY_URL configurado.
          </p>
        </div>
      </Container>
    </div>
  );
}
