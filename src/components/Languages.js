import React from "react";
import { Row, Col } from "react-bootstrap";
import { SiTypescript } from "react-icons/si";

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
import imageLanguageNode from "../Assets/Languages/Node-Dark.svg";
import imageLanguageReact from "../Assets/Languages/React-Dark.svg";

const colStyle = {
  paddingBottom: 12,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
};

const LANGUAGES = [
  { src: imageLanguagePhp, alt: "PHP" },
  { src: imageLanguagePython, alt: "Python" },
  { src: imageLanguageDotNet, alt: ".NET" },
  { src: imageLanguageJava, alt: "Java" },
  { src: imageLanguageFlutter, alt: "Flutter" },
  { src: imageLanguageJS, alt: "JavaScript" },
  {
    type: "icon",
    Icon: SiTypescript,
    color: "#3178c6",
    bg: "#ffffff",
    alt: "TypeScript",
  },
  { src: imageLanguageCss, alt: "CSS" },
  { src: imageLanguageHTML, alt: "HTML" },
  { src: imageLanguageJquery, alt: "jQuery" },
  { src: imageLanguageGit, alt: "Git" },
  { src: imageLanguageNode, alt: "Node.js" },
  { src: imageLanguageReact, alt: "React" },
];

function Languages() {
  return (
    <Row className="justify-content-center align-items-center" style={{ marginBottom: 16 }}>
      {LANGUAGES.map((item, index) => (
        <Col
          key={item.alt || index}
          xs={3}
          sm={2}
          md={2}
          lg={1}
          style={colStyle}
        >
          {item.type === "icon" ? (
            <div
              className="language-icon-wrapper"
              style={{
                width: 52,
                height: 52,
                backgroundColor: item.bg,
                borderRadius: "20%",
                padding: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <item.Icon style={{ color: item.color, fontSize: "2.2em" }} />
            </div>
          ) : (
            <img
              src={item.src}
              alt={item.alt}
              className="img-fluid"
              style={{ maxHeight: "52px", width: "auto" }}
            />
          )}
        </Col>
      ))}
    </Row>
  );
}

export default Languages;
