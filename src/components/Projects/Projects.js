import React from "react";
import { Container, Row, Col } from "react-bootstrap";
import ProjectCard from "./ProjectCards";
import Particle from "../Particle";
import leaf from "../../Assets/Projects/leaf.png";
import emotion from "../../Assets/Projects/emotion.png";
import editor from "../../Assets/Projects/codeEditor.png";
import chatify from "../../Assets/Projects/chatify.png";
import logoSupra from "../../Assets/Projects/supra.png";
import logoPortalCidadao from "../../Assets/Projects/portalcidadao.png";
import logoScm from "../../Assets/Projects/scm.png";
import logoAtlasApp from "../../Assets/Projects/smart-phone-atlas-app.png";
import logoPortalApp from "../../Assets/Projects/smart-phone-portalcidadao-app.png";
import logoScmApp from "../../Assets/Projects/smart-phone-scm-app.png";


import suicide from "../../Assets/Projects/suicide.png";
import bitsOfCode from "../../Assets/Projects/blog.png";

function Projects() {
  return (
    <Container fluid className="project-section">
      <Particle />
      <Container>
        <h1 className="project-heading">
          My biggest <strong className="purple">Works </strong> | Maiores <strong className="purple">Trabalhos </strong> 
        </h1>
        <p style={{ color: "white" }}>
          Here are a few projects I've worked on recently.
        </p>
        <p style={{ color: "white" }}>
          Aqui estão alguns dos maiores trabalhos que realizei.
        </p>
        <Row style={{ justifyContent: "center", paddingBottom: "10px" }}>
          <Col md={4} className="project-card">
            <ProjectCard
              imgPath={logoSupra}
              isBlog={false}
              title="Supra"
              description="The Advanced Supervision System is a computerized process, developed and implemented at DNIT that resulted in transparency and availability of construction information in real time, making monitoring of works more efficient and dynamic, enabling more assertive decision-making and increasing the quality of services provided to society."
              subdescription="O Sistema de Supervisão Avançada é um processo informatizado, desenvolvido e implementado no DNIT que resultou em transparência e disponibilidade de informações de obras em tempo real, tornando o acompanhamento das obras mais eficiente e dinâmico, possibilitando tomadas de decisão mais assertivas e aumento da qualidade dos serviços prestados à sociedade."
              website="https://supra.dnit.gov.br"
            />
          </Col>

          <Col md={4} className="project-card">
            <ProjectCard
              imgPath={logoPortalCidadao}
              isBlog={false}
              title="Portal Cidadão"
              description="The 'DNIT Citizen Portal' refers to the online portal intended for citizens who wish to access information and services related to the National Department of Transport Infrastructure (DNIT) in Brazil. DNIT is responsible for the maintenance and development of federal road infrastructure in the country."
              subdescription="O 'Portal Cidadão DNIT' refere-se ao portal online destinado aos cidadãos que desejam acessar informações e serviços relacionados ao Departamento Nacional de Infraestrutura de Transportes (DNIT) no Brasil. O DNIT é responsável pela manutenção e desenvolvimento da infraestrutura rodoviária federal no país."
              website="https://servicos.dnit.gov.br/portalcidadao"
            />
          </Col>

          <Col md={4} className="project-card">
            <ProjectCard
              imgPath={logoScm}
              isBlog={false}
              title="SCM - DICI"
              description="The DICI 'Data, Information, Knowledge and Intelligence System' is Anatel's telecommunications sector data collection system, and it is mandatory for all providers to report data relating to the services provided, in addition to economic and infrastructure data."
              subdescription="O DICI 'Sistema de Dados, Informações, Conhecimento e Inteligência' é o sistema de coleta de dados setoriais de telecomunicações da Anatel, sendo obrigatório a todos os provedores informarem os dados referentes aos serviços prestados, além de dados econômicos e de infraestrutura."
              website="http://dici.scmengenharia.com.br"          
            />
          </Col>

          <Col md={4} className="project-card">
            <ProjectCard
              imgPath={logoAtlasApp}
              isBlog={false}
              title="Atlas - App"
              description="The Atlas application is used to download a .PDF by state in Brazil, showing all highway construction works and their status, strategic information for decision making."
              subdescription="O aplicativo Atlas é usado para realizar download de um .PDF por estados do Brasil, mostrando todas as obras de construção de rodovias e sua situação, informações estratégias para tomadas de decisão. "
              website="https://play.google.com/store/apps/details?id=br.gov.dnit.supra.atlas&pcampaignid=web_share"   
            />
          </Col>

          <Col md={4} className="project-card">
            <ProjectCard
              imgPath={logoPortalApp}
              isBlog={false}
              title="Portal Cidadão - App"
              description="The 'App DNIT Citizen Portal' refers to the online portal intended for citizens who wish to access information and services related to the National Department of Transport Infrastructure (DNIT) in Brazil. DNIT is responsible for the maintenance and development of federal road infrastructure in the country."
              subdescription="O 'App do Portal Cidadão DNIT' refere-se ao portal online destinado aos cidadãos que desejam acessar informações e serviços relacionados ao Departamento Nacional de Infraestrutura de Transportes (DNIT) no Brasil. O DNIT é responsável pela manutenção e desenvolvimento da infraestrutura rodoviária federal no país."
              website="https://play.google.com/store/apps/details?id=br.gov.dnit.servicos.portalcidadao&pcampaignid=web_share"
            />
          </Col>

          <Col md={4} className="project-card">
            <ProjectCard
              imgPath={logoScmApp}
              isBlog={false}
              title="SCM Engenharia - DICI - App"
              description="The app DICI 'Data, Information, Knowledge and Intelligence System' is Anatel's telecommunications sector data collection system, and it is mandatory for all providers to report data relating to the services provided, in addition to economic and infrastructure data."
              subdescription="O app DICI 'Sistema de Dados, Informações, Conhecimento e Inteligência' é o sistema de coleta de dados setoriais de telecomunicações da Anatel, sendo obrigatório a todos os provedores informarem os dados referentes aos serviços prestados, além de dados econômicos e de infraestrutura."
              website="https://play.google.com/store/apps/details?id=br.com.scmengenharia.dicii&pcampaignid=web_share"
            />
          </Col>
        </Row>
      </Container>
    </Container>
  );
}

export default Projects;
