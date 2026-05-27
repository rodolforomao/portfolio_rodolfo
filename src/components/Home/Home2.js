import React from "react";
import { Container, Row, Col } from "react-bootstrap";
import myImg from "../../Assets/avatar.svg";
import Tilt from "react-parallax-tilt";
import {
  AiFillGithub,
  AiFillInstagram,
  AiOutlineWhatsApp,
  AiOutlineMail,
} from "react-icons/ai";
import { FaLinkedinIn } from "react-icons/fa";

function Home2() {
  return (
    <Container fluid className="home-about-section" id="about">
      <Container>
        {/* English intro */}
        <Row className="align-items-center">
          <Col xs={12} md={8} className="home-about-description">
            <h1 style={{ fontSize: "clamp(1.6em, 4vw, 2.6em)" }}>
              Let me <span className="purple"> INTRODUCE </span> myself
            </h1>
            <p className="home-about-body">
              I have fallen in love with my job and keep learning every day… 😜🙃
              <br />I am fluent in classics like{" "}
              <i>
                <b className="purple">PHP, C#, Python and JavaScript.</b>
              </i>
              <br />My secondary languages include{" "}
              <i>
                <b className="purple">
                  Flutter, Java, TypeScript, HTML, CSS, C++ and SQL (other DB languages).
                </b>
              </i>
              <br />
              My field of interest is building{" "}
              <i>
                <b className="purple">Web Technologies and Products</b>
              </i>{" "}
              and areas related to{" "}
              <i>
                <b className="purple">Blockchain and new technologies.</b>
              </i>
            </p>
          </Col>
          <Col xs={12} md={4} className="myAvtar">
            <Tilt>
              <img src={myImg} className="img-fluid" alt="Rodolfo Romão avatar" />
            </Tilt>
          </Col>
        </Row>

        {/* Portuguese intro */}
        <Row className="align-items-center" style={{ marginTop: "1rem" }}>
          <Col xs={12} md={8} className="home-about-description">
            <h1 style={{ fontSize: "clamp(1.4em, 3.5vw, 2.2em)" }}>
              Vou falar um pouco <span className="purple">sobre mim</span>
            </h1>
            <p className="home-about-body">
              Me apaixonei pelo meu trabalho e aprendo novas coisas todos os dias… 😜🙃
              <br />Minhas habilidades primárias são{" "}
              <i>
                <b className="purple">PHP, C#, Python e JavaScript.</b>
              </i>
              <br />As habilidades secundárias incluem{" "}
              <i>
                <b className="purple">
                  Flutter, Java, TypeScript, HTML, CSS, C++ e SQL (outras linguagens de banco).
                </b>
              </i>
              <br />
              Meu campo de interesse é trabalhar com{" "}
              <i>
                <b className="purple">Tecnologias Web e Produtos</b>
              </i>{" "}
              e áreas relacionadas a{" "}
              <i>
                <b className="purple">Blockchain e novas tecnologias.</b>
              </i>
            </p>
          </Col>
        </Row>

        {/* Social links */}
        <Row>
          <Col xs={12} className="home-about-social">
            <h1>Find me on / Encontre-me</h1>
            <p>
              Feel free to <span className="purple">connect</span> with me
            </p>
            <ul className="home-about-social-links">
              <li className="social-icons">
                <a
                  href="https://github.com/rodolforomao"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="GitHub"
                  className="icon-colour home-social-icons"
                >
                  <AiFillGithub />
                </a>
              </li>
              <li className="social-icons">
                <a
                  href="https://www.linkedin.com/in/rodolfo-romao-oliveira/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn"
                  className="icon-colour home-social-icons"
                >
                  <FaLinkedinIn />
                </a>
              </li>
              <li className="social-icons">
                <a
                  href="https://www.instagram.com/dev.brincante"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="icon-colour home-social-icons"
                >
                  <AiFillInstagram />
                </a>
              </li>
              <li className="social-icons">
                <a
                  href="https://wa.me/5561981119944?text=Olá%20tudo%20bem"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="WhatsApp"
                  className="icon-colour home-social-icons"
                >
                  <AiOutlineWhatsApp />
                </a>
              </li>
              <li className="social-icons">
                <a
                  href="mailto:engenheirorodolforomao@gmail.com?subject=Contato%20via%20portfólio&body=Olá%20Rodolfo,%20gostaria%20de%20conversar%20sobre%20suas%20habilidades%20profissionais."
                  aria-label="E-mail"
                  className="icon-colour home-social-icons"
                >
                  <AiOutlineMail />
                </a>
              </li>
            </ul>
          </Col>
        </Row>
      </Container>
    </Container>
  );
}

export default Home2;
