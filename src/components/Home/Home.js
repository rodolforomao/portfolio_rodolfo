import React from "react";
import { Container, Row, Col } from "react-bootstrap";


import homeLogo from "../../Assets/home-main.svg";
import Particle from "../Particle";
import Languages from "../Languages"
import Home2 from "./Home2";
import Type from "./Type";

function Home() {
  return (
    <section>
      <Container fluid className="home-section" id="home">
        <Particle />
        <Container className="home-content">
          <Languages/>
          <Row className="align-items-center">
            <Col xs={12} md={7} className="home-header">
              <h1 style={{ paddingBottom: 15 }} className="heading">
                Hi There, what's up? (Olá, tudo bem?){" "}
                <span className="wave" role="img" aria-labelledby="wave">
                  👋🏻
                </span>
              </h1>

              <h1 className="heading-name">
                I'm (Meu nome é)
                <strong className="main-name"> Rodolfo Romão</strong>
              </h1>

              <div style={{ paddingTop: 30, paddingBottom: 20, textAlign: "left" }}>
                <Type />
              </div>
            </Col>

            <Col xs={12} md={5} className="text-center" style={{ paddingBottom: 20 }}>
              <img
                src={homeLogo}
                alt="home pic"
                className="img-fluid"
                style={{ maxHeight: "400px", width: "100%" }}
              />
            </Col>
          </Row>
        </Container>
      </Container>
      <Home2 />
    </section>
  );
}

export default Home;
