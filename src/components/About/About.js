import React from "react";
import { Link } from "react-router-dom";
import { Container, Row, Col } from "react-bootstrap";
import Particle from "../Particle";
import Techstack from "./Techstack";
import Aboutcard from "./AboutCard";
import laptopImg from "../../Assets/about.png";
import Toolstack from "./Toolstack";
import Github from "./Github";

function About() {
  return (
    <Container fluid className="about-section">
      <Particle />
      <Container>
        <Row style={{ justifyContent: "center", padding: "10px" }}>
          <Col
            md={7}
            style={{
              justifyContent: "center",
              paddingTop: "30px",
              paddingBottom: "50px",
            }}
          >
            <h1 style={{ fontSize: "2.1em", paddingBottom: "20px" }}>
              Know Who <strong className="purple">I'M</strong> - Quem <strong className="purple">sou eu</strong>?
            </h1>
            <Aboutcard />
          </Col>
          <Col
            md={5}
            style={{ paddingTop: "120px", paddingBottom: "50px" }}
            className="about-img"
          >
            <img src={laptopImg} alt="about" className="img-fluid" />
          </Col>
        </Row>
        <h1 className="project-heading">
          Professional <strong className="purple">Skillset </strong> / <strong className="purple">Habilidades </strong> 
        </h1>

        <Techstack />

        <h1 className="project-heading">
          <strong className="purple">Tools</strong> I use / <strong className="purple">Ferramentas</strong>
        </h1>
        <Toolstack />

        <Github />

        <p style={{ color: "white", textAlign: "center", paddingTop: "10px" }}>
          See the <Link to="/project" style={{ color: "#b385f7" }}>full list of projects</Link>{" "}
          or the <Link to="/resume" style={{ color: "#b385f7" }}>complete résumé</Link> with
          dates and companies. You can also ask an AI about my background directly — type{" "}
          <code>ask &lt;your question&gt;</code> in the Terminal on the{" "}
          <Link to="/" style={{ color: "#b385f7" }}>home page</Link>.
        </p>
        <p style={{ color: "white", textAlign: "center" }}>
          Veja a <Link to="/project" style={{ color: "#b385f7" }}>lista completa de projetos</Link>{" "}
          ou o <Link to="/resume" style={{ color: "#b385f7" }}>currículo completo</Link> com datas
          e empresas. Você também pode perguntar a uma IA sobre minha trajetória — digite{" "}
          <code>ask &lt;sua pergunta&gt;</code> no Terminal da{" "}
          <Link to="/" style={{ color: "#b385f7" }}>página inicial</Link>.
        </p>
      </Container>
    </Container>
  );
}

export default About;
