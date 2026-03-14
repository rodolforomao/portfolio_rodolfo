import React from "react";
import { Row, Col } from "react-bootstrap";
import { FaNode } from "react-icons/fa";
import { SiReact, SiTypescript } from "react-icons/si";

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
  {
    type: "icon",
    Icon: FaNode,
    color: "#509941",
    bg: "#313131",
    alt: "Node.js",
  },
  {
    type: "icon",
    Icon: SiReact,
    color: "#5ed3f3",
    bg: "#242938",
    alt: "React",
  },
];

const colStyle = { paddingBottom: 20 };
const iconWrapperStyle = (bg) => ({
  ...colStyle,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
});

function Languages() {
  return (
    <Row sm={12} md={12} lg={12}>
      {LANGUAGES.map((item, index) => (
        <Col
          key={item.alt || index}
          sm={1}
          md={1}
          lg={1}
          style={item.type === "icon" ? iconWrapperStyle(item.bg) : colStyle}
        >
          {item.type === "icon" ? (
            <div
              className="language-icon-wrapper"
              style={{
                width: "100%",
                maxWidth: 80,
                maxHeight: 80,
                backgroundColor: item.bg,
                borderRadius: "20%",
                padding: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <item.Icon style={{ color: item.color }} />
            </div>
          ) : (
            <img
              src={item.src}
              alt={item.alt}
              className="img-fluid"
              style={{ maxHeight: "250px" }}
            />
          )}
        </Col>
      ))}
    </Row>
  );
}

export default Languages;
