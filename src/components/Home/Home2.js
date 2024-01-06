import React from "react";
import { Container, Row, Col } from "react-bootstrap";
import myImg from "../../Assets/avatar.svg";
import Tilt from "react-parallax-tilt";
import {
  AiFillGithub,
  AiOutlineTwitter,
  AiFillInstagram,
  AiFillMail,
  AiOutlineWhatsApp,
  AiOutlineMail,
} from "react-icons/ai";
import { FaLinkedinIn } from "react-icons/fa";

function Home2() {
  return (
    <Container fluid className="home-about-section" id="about">
      <Container>
        <Row>
          <Col md={8} className="home-about-description">
            <h1 style={{ fontSize: "2.6em" }}>
              <p>Let me <span className="purple"> INTRODUCE </span> myself</p>
            </h1>
            <p className="home-about-body">
              I have had fell in love with my job and I have learnt
              a couple things… 😜🙃
              <br />I am fluent in classics like
              <i>
                <b className="purple"> PHP, C#, Python and Javascript. </b>
              </i>
              <br />My secundaries languages are
              <i>
                <b className="purple"> Flutter, Java, Typescript, HTML, CSS, C++ and SQL Server (others DB Languages). </b>
              </i>
              <br />
              My field of Interest's are building/supporting &nbsp;
              <i>
                <b className="purple">Web Technologies and Products </b> and
                also in areas related to{" "}
                <b className="purple">
                  Blockchain and new technologias.
                </b>
              </i>
            </p>
            
          </Col>
          <Col md={4} className="myAvtar">
            <Tilt>
              <img src={myImg} className="img-fluid" alt="avatar" />
            </Tilt>
          </Col>
        </Row>

        <Row>
          <Col md={8} className="home-about-description">
            <h1 style={{ fontSize: "2.6em" }}>
              <p>Vou falar um pouco sobre mim</p>
            </h1>
            
            <p className="home-about-body">
              Eu me apaixonei pela meu trabalho e venho aprendendo algumas coisas pelo caminho...😜🙃
              <br />Minha habilidades primárias são
              <i>
                <b className="purple"> PHP, C#, Python e Javascript. </b>
              </i>
              <br />As habilidades secundárias são
              <i>
                <b className="purple"> Flutter, Java, Typescript, HTML, CSS, C++ e SQL Server (Outras linguagens de banco). </b>
              </i>
              <br />
              Meu campo de interesse é trabalho com &nbsp;
              <i>
                <b className="purple">Tecnologias Web and Produtos </b> e
                também áreas relacionadas a {" "}
                <b className="purple">
                  Blockchain e novas tecnologias.
                </b>
              </i>
            </p>
          </Col>
          <Col md={4} className="myAvtar">
            <Tilt>
              <img src={myImg} className="img-fluid" alt="avatar" />
            </Tilt>
          </Col>
        </Row>
        <Row>
          <Col md={12} className="home-about-social">
            <h1>Find me on / Encontre-me</h1>
            <p>
              Feel free to <span className="purple">connect </span>with me
            </p>
            <p>
              Fique àvontade para <span className="purple">adicionar</span>-me
            </p>
            <ul className="home-about-social-links">
              <li className="social-icons">
                <a
                  href="https://github.com/rodolforomao"
                  target="_blank"
                  rel="noreferrer"
                  className="icon-colour  home-social-icons"
                >
                  <AiFillGithub />
                </a>
              </li>
              {/* <li className="social-icons">
                <a
                  href="https://twitter.com/Soumyajit4419"
                  target="_blank"
                  rel="noreferrer"
                  className="icon-colour  home-social-icons"
                >
                  <AiOutlineTwitter />
                </a>
              </li> */}
              <li className="social-icons">
                <a
                  href="https://www.linkedin.com/in/rodolfo-romao-oliveira/"
                  target="_blank"
                  rel="noreferrer"
                  className="icon-colour  home-social-icons"
                >
                  <FaLinkedinIn />
                </a>
              </li>
              <li className="social-icons">
                <a
                  href="https://www.instagram.com/dev.brincante"
                  target="_blank"
                  rel="noreferrer"
                  className="icon-colour home-social-icons"
                >
                  <AiFillInstagram />
                </a>
              </li>
              <li className="social-icons">
                <a
                  href="https://wa.me//5561981119944?text=Olá%20tudo%20bem"
                  target="_blank"
                  rel="noreferrer"
                  className="icon-colour home-social-icons"
                >
                  <AiOutlineWhatsApp />
                </a>
              </li>
              <li className="social-icons">
                <a
                  href="mailto:engenheirorodolforomao@gmail.com.br?subject=Quero marcar um reunião&cc=rodolforomao@gmail.com.br&body=Gostaria de marcar uma reunião sobre suas habilidades profissionais."
                  target="_blank"
                  rel="noreferrer"
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
