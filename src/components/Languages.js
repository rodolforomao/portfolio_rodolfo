import React from "react";
import { Container, Row, Col } from "react-bootstrap";

import imageLanguagePhp from "../Assets/Languages/PHP-Dark.svg";
import imageLanguagePython from "../Assets/Languages/Python-Dark.svg";
import imageLanguageCss from "../Assets/Languages/CSS.svg";
import imageLanguageHTML from "../Assets/Languages/HTML.svg";
import imageLanguageJquery from "../Assets/Languages/JQuery.svg";
import imageLanguageGit from "../Assets/Languages/Github-Dark.svg";
import imageLanguageDotNet from "../Assets/Languages/DotNet.svg";
import imageLanguageJava from "../Assets/Languages/Java-Dark.svg";
import imageLanguageJS from "../Assets/Languages/JavaScript.svg";
import imageLanguageFlutter from "../Assets/Languages/Flutter-Dark.svg";


function Languages() {
  return (
    <Row>
    <Col md={1} style={{ paddingBottom: 20 }}>
    </Col>
    <Col md={1} style={{ paddingBottom: 20 }}>
        <img
          src={imageLanguagePhp}
          alt="home pic"
          className="img-fluid"
          style={{ maxHeight: "250px" }}
        />
      </Col>
      <Col md={1} style={{ paddingBottom: 20 }}>
        <img
          src={imageLanguagePython}
          alt="home pic"
          className="img-fluid"
          style={{ maxHeight: "250px" }}
        />
      </Col>
      <Col md={1} style={{ paddingBottom: 20 }}>
        <img
          src={imageLanguageDotNet}
          alt="home pic"
          className="img-fluid"
          style={{ maxHeight: "250px" }}
        />
      </Col>
      <Col md={1} style={{ paddingBottom: 20 }}>
        <img
          src={imageLanguageJava}
          alt="home pic"
          className="img-fluid"
          style={{ maxHeight: "250px" }}
        />
      </Col>
      <Col md={1} style={{ paddingBottom: 20 }}>
        <img
          src={imageLanguageFlutter}
          alt="home pic"
          className="img-fluid"
          style={{ maxHeight: "250px" }}
        />
      </Col>
      <Col md={1} style={{ paddingBottom: 20 }}>
        <img
          src={imageLanguageJS}
          alt="home pic"
          className="img-fluid"
          style={{ maxHeight: "250px" }}
        />
      </Col>
      
      <Col md={1} style={{ paddingBottom: 20 }}>
        <img
          src={imageLanguageCss}
          alt="home pic"
          className="img-fluid"
          style={{ maxHeight: "250px" }}
        />
      </Col>
      <Col md={1} style={{ paddingBottom: 20 }}>
        <img
          src={imageLanguageHTML}
          alt="home pic"
          className="img-fluid"
          style={{ maxHeight: "250px" }}
        />
      </Col>
      <Col md={1} style={{ paddingBottom: 20 }}>
        <img
          src={imageLanguageJquery}
          alt="home pic"
          className="img-fluid"
          style={{ maxHeight: "250px" }}
        />
      </Col>
      <Col md={1} style={{ paddingBottom: 20 }}>
        <img
          src={imageLanguageGit}
          alt="home pic"
          className="img-fluid"
          style={{ maxHeight: "250px" }}
        />
      </Col>
    </Row>
  );
}

export default Languages;
