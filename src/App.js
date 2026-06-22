import React, { useState, useEffect } from "react";
import Preloader from "../src/components/Pre";
import Navbar from "./components/Navbar";
import Home from "./components/Home/Home";
import About from "./components/About/About";
import Projects from "./components/Projects/Projects";
import Footer from "./components/Footer";
import Resume from "./components/Resume/ResumeNew";
import MacroDashboard from "./components/Dashboard/index";
import DealerApp from "./components/Dealer/index";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
  useLocation,
} from "react-router-dom";
import ScrollToTop from "./components/ScrollToTop";
import "./style.css";
import "./App.css";
import "bootstrap/dist/css/bootstrap.min.css";

function AppShell() {
  const location = useLocation();
  const isDealerRoute = location.pathname.startsWith("/dealer");

  useEffect(() => {
    document.body.classList.toggle("dealer-route-active", isDealerRoute);
    return () => document.body.classList.remove("dealer-route-active");
  }, [isDealerRoute]);

  return (
    <>
      <Navbar />
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/project" element={<Projects />} />
        <Route path="/about" element={<About />} />
        <Route path="/resume" element={<Resume />} />
        <Route path="/macro-dashboard" element={<MacroDashboard />} />
        <Route path="/dealer/*" element={<DealerApp />} />
        <Route path="*" element={<Navigate to="/"/>} />
      </Routes>
      {!isDealerRoute && <Footer />}
    </>
  );
}

function App() {
  const [load, upadateLoad] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      upadateLoad(false);
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Router>
      <Preloader load={load} />
      <div className={`App${load ? "" : " app-ready"}`} id={load ? "no-scroll" : "scroll"}>
        <AppShell />
      </div>
    </Router>
  );
}

export default App;
