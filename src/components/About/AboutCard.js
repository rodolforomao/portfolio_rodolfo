import React from "react";
import Card from "react-bootstrap/Card";
import { ImPointRight } from "react-icons/im";

function AboutCard() {
  return (
    <Card className="quote-card-view">
      <Card.Body>
        <blockquote className="blockquote mb-0">
          <p style={{ textAlign: "justify" }}>
            Hi Everyone, I am <span className="purple">Rodolfo Romão </span>
            from <span className="purple"> Brasília, Brazil.</span>
            <br />
            I am currently employed as a senior Fullstack Software Developer at DNIT (National Department of Transport Infrastructure from Brazil).
            <br />
            I have completed Graduation in Computer Engineer and Post Graduate in Process Governance at Universa Fundation - Catholic University of Brasília.
            <br />
            <br />
            Apart from coding, some other activities that I like...
          </p>
          <p style={{ textAlign: "justify" }}>
            Olá pessoal, sou o <span className="purple">Rodolfo Romão </span>
            de <span className="purple"> Brasília, Brasil.</span>
            <br />
            Atualmente sou contratado como Desenvolvedor de Software Fullstrack Senior no DNIT (Departamento Nacional de Infraestrutura de Transportes do Governo Brasileiro)
            <br />
            Eu graduei em engenharia de computação e fiz um MBA em Governança de processos de TI na universidade católica de brasília.
            <br />
            <br />
            Fora da área de TI, gosto de fazer outras atividades...
          </p>
          <ul>
            <li className="about-activity">
              <ImPointRight /> Running, swimming and Dancing - Corrida, Natação e Dança
            </li>
            <li className="about-activity">
              <ImPointRight /> Publish Tech on Instagram / Publicar Infos de TI
            </li>
            <li className="about-activity">
              <ImPointRight /> Travelling / Viajar
            </li>
          </ul>

          <p style={{ color: "rgb(155 126 172)" }}>
            "Work, study and dedication bring 'luck'! " 😉{" "}
          </p>
          <footer className="blockquote-footer">Rodolfo Romão</footer>
        </blockquote>
      </Card.Body>
    </Card>
  );
}

export default AboutCard;
