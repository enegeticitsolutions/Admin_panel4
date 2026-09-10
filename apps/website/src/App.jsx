import React, { useState, useEffect } from "react";
import Header from "./components/layout/Header";
import Footer from "./components/layout/Footer";
import WaitlistModal from "./components/modals/WaitlistModal";
import HomePage from "./pages/HomePage";
import ServicesPage from "./pages/ServicesPage";
import SaathiPage from "./pages/SaathiPage";
import AboutPage from "./pages/AboutPage";
import AuthPage from "./pages/AuthPage";
import AccountPage from "./pages/AccountPage";
import CheckoutPage from "./pages/CheckoutPage";
import PlansPage from "./pages/PlansPage";
import SiteGatekeeper from "./components/SiteGatekeeper";
import { fetchSubscriptionPackages, isTokenExpired } from "./services/api";

import SeoHead from "./components/seo/SeoHead";
import NotFoundPage from "./pages/NotFoundPage";
import LegalPage from "./pages/LegalPage";

/**
 * App Component - Root Application Shell & Router
 */
const App = () => {
  const getInitialPage = () => {
    if (typeof window === "undefined") return "home";

    const validPages = [
      "home", "services", "saathi", /* "plans", "auth", */
      "account", "checkout", "story", "about", "terms",
      "privacy", "refund-policy", "cookie-policy"
    ];

    // 1. Inspect direct pathname first (e.g., /services, /plans, /saathi, /about)
    const pathname = window.location.pathname.replace(/^\/+|\/+$/g, "").toLowerCase();
    if (pathname && validPages.includes(pathname)) {
      return pathname === "about" ? "story" : pathname;
    }

    // 2. Fallback to hash route (e.g., #services)
    const rawHash = (window.location.hash || "").replace(/^#/, "").toLowerCase();
    if (rawHash && validPages.includes(rawHash)) {
      return rawHash === "about" ? "story" : rawHash;
    }

    if (!pathname && !rawHash) return "home";
    return "not-found";
  };

  const [activePage, setActiveStatePage] = useState(getInitialPage);

  const setActivePage = (page) => {
    setActiveStatePage(page);
    try {
      const targetUrl = page === "home" ? "/" : `/${page}`;
      if (window.location.pathname !== targetUrl) {
        window.history.pushState(null, "", targetUrl);
      }
    } catch (e) { }
  };

  useEffect(() => {
    const handleNavigationChange = () => {
      setActiveStatePage(getInitialPage());
    };
    window.addEventListener("hashchange", handleNavigationChange);
    window.addEventListener("popstate", handleNavigationChange);
    return () => {
      window.removeEventListener("hashchange", handleNavigationChange);
      window.removeEventListener("popstate", handleNavigationChange);
    };
  }, []);

  // Scroll to top whenever the active page changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activePage]);

  const [isModalOpen, setIsModalOpen] = useState(false);

  // User Auth State
  const [user, setUser] = useState(() => {
    try {
      const storedToken = localStorage.getItem("mhn_token");
      if (!storedToken || isTokenExpired(storedToken)) {
        localStorage.removeItem("mhn_token");
        localStorage.removeItem("mhn_user");
        return null;
      }
      const u = localStorage.getItem("mhn_user");
      return u ? JSON.parse(u) : null;
    } catch (e) {
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    const storedToken = localStorage.getItem("mhn_token");
    if (!storedToken || isTokenExpired(storedToken)) {
      return "";
    }
    return storedToken;
  });

  // Listen for session expiry from API interceptor
  useEffect(() => {
    const handleExpired = () => {
      setUser(null);
      setToken("");
      if (activePage === "account" || activePage === "checkout") {
        setActivePage("auth");
      }
    };
    window.addEventListener("mhn:auth_expired", handleExpired);
    return () => window.removeEventListener("mhn:auth_expired", handleExpired);
  }, [activePage]);

  // Checkout package selection state
  const [selectedPackageForCheckout, setSelectedPackageForCheckout] = useState(null);
  const [pendingPackageForCheckout, setPendingPackageForCheckout] = useState(null);

  // Live Subscription Packages from API
  const [livePackages, setLivePackages] = useState([]);

  useEffect(() => {
    fetchSubscriptionPackages()
      .then((pkgs) => {
        if (Array.isArray(pkgs) && pkgs.length > 0) {
          setLivePackages(pkgs);
        }
      })
      .catch((err) =>
        console.log("Backend offline or packages endpoint unavailable, falling back to static plans.", err)
      );
  }, []);

  const handleAuthSuccess = (userData, tokenData) => {
    setUser(userData);
    setToken(tokenData);
    try {
      localStorage.setItem("mhn_user", JSON.stringify(userData));
      localStorage.setItem("mhn_token", tokenData);
    } catch (e) { }

    if (pendingPackageForCheckout) {
      setSelectedPackageForCheckout(pendingPackageForCheckout);
      setPendingPackageForCheckout(null);
      setActivePage("checkout");
    } else {
      setActivePage("account");
    }
  };

  const handleLogout = () => {
    setUser(null);
    setToken("");
    try {
      localStorage.removeItem("mhn_user");
      localStorage.removeItem("mhn_token");
    } catch (e) { }
    setActivePage("home");
  };


  const handleSelectPackageForBuy = (plan) => {
    if (!token || !user) {
      setPendingPackageForCheckout(plan);
      setActivePage("auth");
    } else {
      setSelectedPackageForCheckout(plan);
      setActivePage("checkout");
    }
  };

  const [initialEmail, setInitialEmail] = useState("");
  const openForm = (email = "") => {
    setInitialEmail(typeof email === "string" ? email : "");
    setIsModalOpen(true);
  };
  const closeForm = () => setIsModalOpen(false);

  const renderAppContent = () => {
    if (activePage === "checkout") {
      return (
        <CheckoutPage
          selectedPackage={selectedPackageForCheckout}
          token={token}
          user={user}
          onSuccess={() => setActivePage("account")}
          onGoBack={() => setActivePage("plans")}
        />
      );
    }

    return (
      <div className="site-shell">
        <noscript>
          <div className="noscript">
            MaiHoonNa - India's first connected senior care ecosystem. Please enable JavaScript to use the full site experience.
          </div>
        </noscript>

        <Header
          activePage={activePage}
          setActivePage={setActivePage}
          user={user}
          openForm={openForm}
        />

        {activePage === "home" ? (
          <HomePage openForm={openForm} />
        /* ) : activePage === "auth" ? (
          <AuthPage onAuthSuccess={handleAuthSuccess} onGoBack={() => setActivePage("home")} /> */
        ) : activePage === "account" ? (
          <AccountPage
            user={user}
            token={token}
            onLogout={handleLogout}
            onNavigateToPlans={() => setActivePage("plans")}
            onGoHome={() => setActivePage("home")}
          />
        ) : activePage === "services" ? (
          <ServicesPage setActivePage={setActivePage} openForm={openForm} />
        ) : activePage === "saathi" ? (
          <SaathiPage />
        ) : activePage === "story" ? (
          <AboutPage openForm={openForm} setActivePage={setActivePage} />
        /* ) : activePage === "plans" ? (
          <PlansPage
            livePackages={livePackages}
            onSelectPackage={handleSelectPackageForBuy}
            openForm={openForm}
          /> */
        ) : ["terms", "privacy", "refund-policy", "cookie-policy"].includes(activePage) ? (
          <LegalPage initialTab={activePage} setActivePage={setActivePage} />
        ) : (
          <NotFoundPage setActivePage={setActivePage} />
        )}

        <Footer setActivePage={setActivePage} />

        <WaitlistModal isOpen={isModalOpen} onClose={closeForm} initialEmail={initialEmail} />
      </div>
    );
  };

  return (
    <SiteGatekeeper>
      <SeoHead activePage={activePage} />
      {renderAppContent()}
    </SiteGatekeeper>
  );
};

export default App;
