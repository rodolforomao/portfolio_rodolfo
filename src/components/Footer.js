import React from "react";
import { Container, Row, Col } from "react-bootstrap";
import {
  AiFillGithub,
  AiOutlineTwitter,
  AiFillInstagram,
  AiFillMail,
  AiOutlineWhatsApp,
  AiOutlineMail,
} from "react-icons/ai";
import { FaLinkedinIn } from "react-icons/fa";

function Footer() {
  let date = new Date();
  let year = date.getFullYear();
  return (
    <Container fluid className="footer">
      <Row>
        <Col md="4" className="footer-copywright">
          <h3>Designed and Developed by Rodolfo Romão</h3>
        </Col>
        <Col md="4" className="footer-copywright">
          <h3>Copyright © {year} Rodolfo Romão</h3>
        </Col>
        <Col md="4" className="footer-body">
          <ul className="footer-icons">
            <li className="social-icons">
              <a
                href="https://github.com/rodolforomao"
                style={{ color: "white" }}
                target="_blank" 
                rel="noopener noreferrer"
              >
                <AiFillGithub />
              </a>
            </li>
            {/* <li className="social-icons">
              <a
                href="https://twitter.com/Soumyajit4419"
                style={{ color: "white" }}
                target="_blank" 
                rel="noopener noreferrer"
              >
                <AiOutlineTwitter />
              </a>
            </li> */}
            <li className="social-icons">
              <a
                href="https://www.linkedin.com/in/rodolfo-romao-oliveira/"
                style={{ color: "white" }}
                target="_blank" 
                rel="noopener noreferrer"
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
              >
                <AiFillInstagram />
              </a>
            </li> 
            <li className="social-icons">
                <a
                  href="https://wa.me//5561981119944?text=Olá%20tudo%20bem"
                  style={{ color: "white" }}
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <AiOutlineWhatsApp />
                </a>
              </li>
              <li className="social-icons">
                <a
                  href="mailto:engenheirorodolforomao@gmail.com.br?subject=Quero marcar um reunião&cc=rodolforomao@gmail.com.br&body=Gostaria de marcar uma reunião sobre suas habilidades profissionais."
                  style={{ color: "white" }}
                target="_blank" 
                rel="noopener noreferrer"
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
