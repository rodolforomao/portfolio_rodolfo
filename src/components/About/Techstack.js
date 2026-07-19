import React from "react";
import { Col, Row } from "react-bootstrap";
import { CgCPlusPlus } from "react-icons/cg";
import {
  DiJavascript1,
  DiReact,
  DiNodejs,
  DiPython,
  DiGit,
  DiJava,
  DiPhp,
  DiHtml5,
  DiCss3,
  DiJqueryLogo,
} from "react-icons/di";
import { TbBrandCSharp, TbBrandFlutter } from "react-icons/tb";

const labelStyle = { fontSize: "13px", textAlign: "center", marginTop: "6px", opacity: 0.85 };

function Techstack() {
  return (
    <Row style={{ justifyContent: "center", paddingBottom: "50px" }}>
      <Col xs={4} sm={3} md={2} className="tech-icons">
        <DiPhp aria-label="PHP" />
        <p style={labelStyle}>PHP</p>
      </Col>
      <Col xs={4} sm={3} md={2} className="tech-icons">
        <DiPython aria-label="Python" />
        <p style={labelStyle}>Python</p>
      </Col>
      <Col xs={4} sm={3} md={2} className="tech-icons">
        <TbBrandCSharp aria-label="C#" />
        <p style={labelStyle}>C#</p>
      </Col>
      <Col xs={4} sm={3} md={2} className="tech-icons">
        <DiJava aria-label="Java" />
        <p style={labelStyle}>Java</p>
      </Col>
      <Col xs={4} sm={3} md={2} className="tech-icons">
        <TbBrandFlutter aria-label="Flutter" />
        <p style={labelStyle}>Flutter</p>
      </Col>
      <Col xs={4} sm={3} md={2} className="tech-icons">
        <CgCPlusPlus aria-label="C/C++" />
        <p style={labelStyle}>C/C++</p>
      </Col>
      <Col xs={4} sm={3} md={2} className="tech-icons">
        <DiJavascript1 aria-label="JavaScript" />
        <p style={labelStyle}>JavaScript</p>
      </Col>
      <Col xs={4} sm={3} md={2} className="tech-icons">
        <DiHtml5 aria-label="HTML5" />
        <p style={labelStyle}>HTML5</p>
      </Col>
      <Col xs={4} sm={3} md={2} className="tech-icons">
        <DiCss3 aria-label="CSS3" />
        <p style={labelStyle}>CSS3</p>
      </Col>
      <Col xs={4} sm={3} md={2} className="tech-icons">
        <DiJqueryLogo aria-label="jQuery" />
        <p style={labelStyle}>jQuery</p>
      </Col>
      <Col xs={4} sm={3} md={2} className="tech-icons">
        <DiGit aria-label="Git" />
        <p style={labelStyle}>Git</p>
      </Col>
      <Col xs={4} sm={3} md={2} className="tech-icons">
        <DiReact aria-label="React" />
        <p style={labelStyle}>React</p>
      </Col>
      <Col xs={4} sm={3} md={2} className="tech-icons">
        <DiNodejs aria-label="Node.js" />
        <p style={labelStyle}>Node.js</p>
      </Col>
    </Row>
  );
}

export default Techstack;
