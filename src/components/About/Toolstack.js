import React from "react";
import { Col, Row } from "react-bootstrap";
import {
  SiVisualstudiocode,
  SiPostman,
  SiVisualstudio,
  SiLinux,
  SiWindows,
  SiApachenetbeanside,
  SiMicrosoftsqlserver,
  SiDocker,
  SiNotepadplusplus,
  SiApache,
  SiNano,
  SiUbuntu,
  SiDebian,
} from "react-icons/si";

const labelStyle = { fontSize: "13px", textAlign: "center", marginTop: "6px", opacity: 0.85 };

function Toolstack() {
  return (
    <Row style={{ justifyContent: "center", paddingBottom: "50px" }}>
      <Col xs={4} sm={3} md={2} className="tech-icons">
        <SiVisualstudio aria-label="Visual Studio" />
        <p style={labelStyle}>Visual Studio</p>
      </Col>
      <Col xs={4} sm={3} md={2} className="tech-icons">
        <SiVisualstudiocode aria-label="VS Code" />
        <p style={labelStyle}>VS Code</p>
      </Col>
      <Col xs={4} sm={3} md={2} className="tech-icons">
        <SiPostman aria-label="Postman" />
        <p style={labelStyle}>Postman</p>
      </Col>
      <Col xs={4} sm={3} md={2} className="tech-icons">
        <SiLinux aria-label="Linux" />
        <p style={labelStyle}>Linux</p>
      </Col>
      <Col xs={4} sm={3} md={2} className="tech-icons">
        <SiDebian aria-label="Debian" />
        <p style={labelStyle}>Debian</p>
      </Col>
      <Col xs={4} sm={3} md={2} className="tech-icons">
        <SiUbuntu aria-label="Ubuntu" />
        <p style={labelStyle}>Ubuntu</p>
      </Col>
      <Col xs={4} sm={3} md={2} className="tech-icons">
        <SiWindows aria-label="Windows" />
        <p style={labelStyle}>Windows</p>
      </Col>
      <Col xs={4} sm={3} md={2} className="tech-icons">
        <SiApachenetbeanside aria-label="NetBeans" />
        <p style={labelStyle}>NetBeans</p>
      </Col>
      <Col xs={4} sm={3} md={2} className="tech-icons">
        <SiMicrosoftsqlserver aria-label="SQL Server" />
        <p style={labelStyle}>SQL Server</p>
      </Col>
      <Col xs={4} sm={3} md={2} className="tech-icons">
        <SiDocker aria-label="Docker" />
        <p style={labelStyle}>Docker</p>
      </Col>
      <Col xs={4} sm={3} md={2} className="tech-icons">
        <SiNotepadplusplus aria-label="Notepad++" />
        <p style={labelStyle}>Notepad++</p>
      </Col>
      <Col xs={4} sm={3} md={2} className="tech-icons">
        <SiApache aria-label="Apache" />
        <p style={labelStyle}>Apache</p>
      </Col>
      <Col xs={4} sm={3} md={2} className="tech-icons">
        <SiNano aria-label="Nano" />
        <p style={labelStyle}>Nano</p>
      </Col>
    </Row>
  );
}

export default Toolstack;
