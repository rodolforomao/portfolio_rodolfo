import React from "react";
import { Container, Row, Col } from "react-bootstrap";
import {
  AiFillGithub,
  AiFillInstagram,
  AiFillMail,
  AiOutlineWhatsApp,
} from "react-icons/ai";
import { FaLinkedinIn } from "react-icons/fa";

function Footer() {
  const year = new Date().getFullYear();
  return (
    <Container fluid className="footer">
      <Row className="align-items-center">
        <Col xs={12} md={4} className="footer-copywright">
          <h3>Designed and Developed by Rodolfo Romão</h3>
        </Col>
        <Col xs={12} md={4} className="footer-copywright">
          <h3>Copyright © {year} Rodolfo Romão</h3>
        </Col>
        <Col xs={12} md={4} className="footer-body">
          <ul className="footer-icons">
            <li className="social-icons">
              <a
                href="https://github.com/rodolforomao"
                style={{ color: "white" }}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
              >
                <AiFillGithub />
              </a>
            </li>
            <li className="social-icons">
              <a
                href="https://www.linkedin.com/in/rodolfo-romao-oliveira/"
                style={{ color: "white" }}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
              >
                <FaLinkedinIn />
              </a>
            </li>
            <li className="social-icons">
              <a
                href="https://www.instagram.com/dev.brincante"
                style={{ color: "white" }}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
              >
                <AiFillInstagram />
              </a>
            </li>
            <li className="social-icons">
              <a
                href="https://wa.me/5561981119944?text=Olá%20tudo%20bem"
                style={{ color: "white" }}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
              >
                <AiOutlineWhatsApp />
              </a>
            </li>
            <li className="social-icons">
              <a
                href="mailto:engenheirorodolforomao@gmail.com?subject=Contato%20via%20portfólio&body=Olá%20Rodolfo,%20gostaria%20de%20conversar%20sobre%20suas%20habilidades%20profissionais."
                style={{ color: "white" }}
                aria-label="E-mail"
              >
                <AiFillMail />
              </a>
            </li>
          </ul>
        </Col>
      </Row>
    </Container>
  );
}

export default Footer;
