import { useEffect } from "react";

const BASE_URL = "https://maihoonna.in";

/**
 * Resolves the full absolute canonical URL dynamically based on the active page and browser location
 */
const resolveCanonicalUrl = (activePage) => {
  if (!activePage || activePage === "home") {
    return `${BASE_URL}/`;
  }

  if (typeof window !== "undefined") {
    // If accessed via a clean pathname (e.g. /services, /plans, /story)
    const pathname = window.location.pathname.replace(/\/+$/, "");
    if (pathname && pathname !== "" && pathname !== "/") {
      return `${BASE_URL}${pathname}`;
    }
    // If accessed via hash routing (e.g. #services, #story)
    if (window.location.hash) {
      const cleanHash = window.location.hash.replace(/^#/, "");
      return `${BASE_URL}/#${cleanHash}`;
    }
  }

  return `${BASE_URL}/#${activePage}`;
};

/**
 * Page-by-page SEO Metadata Configuration Map
 */
const SEO_CONFIG = {
  home: {
    title: "MaiHoonNa | Connected Senior Care & Elder Companionship Platform",
    description:
      "MaiHoonNa provides senior companionship, health monitoring, emotional wellness support, medication adherence tracking, and connected family care for elderly individuals in India.",
    robots: "index, follow",
    ogType: "website",
    ogImage: "https://maihoonna.in/og-image.jpg",
    schemas: [
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "MaiHoonNa Eldercare Private Limited",
        "url": "https://maihoonna.in",
        "logo": "https://maihoonna.in/logo.svg",
        "description":
          "India's connected senior care ecosystem — blending human companionship with smart healthcare technology.",
        "address": {
          "@type": "PostalAddress",
          "streetAddress": "Gurugram Sectors 53 to 57",
          "addressLocality": "Gurugram",
          "addressRegion": "Haryana",
          "addressCountry": "IN"
        },
        "contactPoint": {
          "@type": "ContactPoint",
          "email": "info@maihoonna.in",
          "contactType": "customer service"
        }
      },
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "MaiHoonNa",
        "url": "https://maihoonna.in",
        "description":
          "MaiHoonNa is India's first connected senior care ecosystem. We keep your parents safe, healthy, and emotionally fulfilled."
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "What is a Care Mitra?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text":
                "A Care Mitra is a trained, background-verified care companion who visits your parent at home. Care Mitras are graded by skill level — from ANM to GNM, B.Sc Nurse, and Specialist Mitra — so your parent is matched with someone qualified for their specific health needs, not a one-size-fits-all attendant."
            }
          },
          {
            "@type": "Question",
            "name": "How is MaiHoonNa different from hiring a caregiver directly?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text":
                "When you hire independently, you're responsible for verifying background, training, backups when someone falls sick or quits, and you have no visibility into what actually happens during a visit. MaiHoonNa handles verification and training upfront, provides a replacement if your Care Mitra is unavailable, and gives you visit logs, health vitals, and mood tracking after every visit — plus an Emergency Response Coordinator on standby. You're paying for accountability and continuity, not just a person's time."
            }
          },
          {
            "@type": "Question",
            "name": "Can I manage care from abroad as an NRI?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text":
                "Yes — this is one of the main reasons families use MaiHoonNa. The Family Connect app lets you track every visit, view health vitals, message the care team, and get emergency alerts in real time, from any time zone. Many of our subscribers are adult children living outside India who want a reliable, honest window into how their parent is actually doing."
            }
          },
          {
            "@type": "Question",
            "name": "How does the Happiness Score work?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text":
                "At each visit, your Care Mitra logs simple signals about your parent's mood and engagement, which we combine into a running Happiness Score you can see on the app. It's designed to catch a gradual decline — not just a bad day — so if the trend dips, both you and our care team are alerted to check in, well before a small issue becomes a bigger one."
            }
          },
          {
            "@type": "Question",
            "name": "What does the Saathi Network do?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text":
                "The Saathi Network is our community of volunteer companions who visit for conversation, company, and connection between your parent's scheduled Care Mitra visits — matched by gender, support needs, and proximity to keep visits comfortable and low-effort. It's built to address loneliness specifically, alongside the hands-on care your Care Mitra provides."
            }
          }
        ]
      }
    ]
  },

  services: {
    title: "Senior Care Services & Elderly Health Monitoring | MaiHoonNa",
    description:
      "Explore MaiHoonNa's senior care services in India: Care Mitra visits, vitals monitoring, medication adherence tracking, clinic accompaniment, and emergency response.",
    robots: "index, follow",
    ogType: "website",
    ogImage: "https://maihoonna.in/og-image.jpg",
    schemas: [
      {
        "@context": "https://schema.org",
        "@type": "Service",
        "serviceType": "Senior Home Care & Vitals Monitoring",
        "provider": {
          "@type": "Organization",
          "name": "MaiHoonNa",
          "url": "https://maihoonna.in"
        },
        "areaServed": {
          "@type": "Country",
          "name": "India"
        },
        "description":
          "In-home senior care including vitals tracking, prescription-linked medication reminders, mood logging, clinic accompaniment, and 24/7 emergency alert chain."
      }
    ]
  },

  saathi: {
    title: "Saathi Network | Senior Companionship & Volunteer Support | MaiHoonNa",
    description:
      "Connect your elderly parents with verified Saathi community companions for meaningful conversations, walks, hobbies, and loneliness support across India.",
    robots: "index, follow",
    ogType: "website",
    ogImage: "https://maihoonna.in/og-image.jpg",
    schemas: [
      {
        "@context": "https://schema.org",
        "@type": "Service",
        "serviceType": "Elderly Companionship & Volunteer Support",
        "provider": {
          "@type": "Organization",
          "name": "MaiHoonNa",
          "url": "https://maihoonna.in"
        },
        "description":
          "Community companionship program connecting verified volunteers with senior citizens for social interactions, walks, hobby sharing, and loneliness relief."
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "Who can become a Saathi volunteer?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text":
                "Anyone aged 18 and above with empathy, a commitment to senior care, and clean background records can apply. We welcome college students, working professionals, homemakers, and active retirees looking to make a meaningful difference."
            }
          },
          {
            "@type": "Question",
            "name": "How does the background verification (BGV) process work?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text":
                "We perform an Aadhaar-linked identity verification, criminal record background check, and contact two personal/professional references. Approval usually takes 3 to 5 working days before your first senior visit."
            }
          },
          {
            "@type": "Question",
            "name": "Are Saathi volunteers paid, or how are rewards earned?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text":
                "Saathis are community volunteers. For every verified hour spent with a senior, you earn Saathi Credit Points. Points can be redeemed for brand vouchers, merchandise, volunteer certificates for resumes, or donated to senior wellness funds."
            }
          },
          {
            "@type": "Question",
            "name": "How are visit locations and seniors assigned to me?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text":
                "Saathis are paired with seniors residing in their local area or sector (typically within a 3–5 km radius). Matching considers shared languages, hobbies, and your selected weekly availability schedule."
            }
          }
        ]
      }
    ]
  },

  plans: {
    title: "Senior Care Plans & Pricing | Transparent Elder Care | MaiHoonNa",
    description:
      "Transparent senior care subscription plans built around prepaid hours with 30-day rollover, no hidden fees, and full family connect app access for NRI families.",
    robots: "index, follow",
    ogType: "website",
    ogImage: "https://maihoonna.in/og-image.jpg",
    schemas: [
      {
        "@context": "https://schema.org",
        "@type": "OfferCatalog",
        "name": "MaiHoonNa Senior Care Plans",
        "url": "https://maihoonna.in/",
        "numberOfItems": 3,
        "itemListElement": [
          {
            "@type": "Offer",
            "name": "Saathi Starter Plan",
            "description": "Essential senior companionship and parameter logging hours."
          },
          {
            "@type": "Offer",
            "name": "Saathi Plus Plan",
            "description": "Comprehensive elderly home visits with vitals and medication adherence."
          },
          {
            "@type": "Offer",
            "name": "Saathi Premium Plan",
            "description": "Full senior care ecosystem support with priority emergency response."
          }
        ]
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "What is a Care Mitra?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text":
                "A Care Mitra is a trained, background-verified care companion who visits your parent at home. Care Mitras are graded by skill level — from ANM to GNM, B.Sc Nurse, and Specialist Mitra — so your parent is matched with someone qualified for their specific health needs, not a one-size-fits-all attendant."
            }
          },
          {
            "@type": "Question",
            "name": "How does the Happiness Score work?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text":
                "At each visit, your Care Mitra logs simple signals about your parent's mood and engagement, which we combine into a running Happiness Score you can see on the app. It's designed to catch a gradual decline — not just a bad day — so if the trend dips, both you and our care team are alerted to check in, well before a small issue becomes a bigger one."
            }
          },
          {
            "@type": "Question",
            "name": "Can I manage care from abroad as an NRI?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text":
                "Yes — this is one of the main reasons families use MaiHoonNa. The Family Connect app lets you track every visit, view health vitals, message the care team, and get emergency alerts in real time, from any time zone. Many of our subscribers are adult children living outside India who want a reliable, honest window into how their parent is actually doing."
            }
          },
          {
            "@type": "Question",
            "name": "Can I change or cancel my plan?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text":
                "You can move between plans (Saathi Starter, Plus, Premium) as your parent's needs change. Please refer to our Terms and Conditions for the cancellation policy."
            }
          }
        ]
      }
    ]
  },

  story: {
    title: "Our Story & Mission | MaiHoonNa Connected Senior Care",
    description:
      "Learn about MaiHoonNa's founding story by Sumit Kejriwal. Dedicated to caring for aging parents in India with trustworthy companionship, medical tracking, and NRI peace of mind.",
    robots: "index, follow",
    ogType: "website",
    ogImage: "https://maihoonna.in/og-image.jpg",
    schemas: [
      {
        "@context": "https://schema.org",
        "@type": "AboutPage",
        "name": "Our Story - MaiHoonNa Senior Care",
        "description":
          "MaiHoonNa was created to solve the silent crisis of aging parents living alone in India, connecting them with verified Care Mitras and loving Saathi companions.",
        "publisher": {
          "@type": "Organization",
          "name": "MaiHoonNa Eldercare Private Limited",
          "url": "https://maihoonna.in"
        }
      }
    ]
  },

  about: {
    title: "Our Story & Mission | MaiHoonNa Connected Senior Care",
    description:
      "Learn about MaiHoonNa's founding story by Sumit Kejriwal. Dedicated to caring for aging parents in India with trustworthy companionship, medical tracking, and NRI peace of mind.",
    robots: "index, follow",
    ogType: "website",
    ogImage: "https://maihoonna.in/og-image.jpg",
    schemas: [
      {
        "@context": "https://schema.org",
        "@type": "AboutPage",
        "name": "Our Story - MaiHoonNa Senior Care",
        "description":
          "MaiHoonNa was created to solve the silent crisis of aging parents living alone in India, connecting them with verified Care Mitras and loving Saathi companions.",
        "publisher": {
          "@type": "Organization",
          "name": "MaiHoonNa Eldercare Private Limited",
          "url": "https://maihoonna.in"
        }
      }
    ]
  },

  terms: {
    title: "Terms of Service | MaiHoonNa Eldercare Platform",
    description:
      "Read the terms and conditions governing the use of MaiHoonNa senior care and companionship services, subscription hours, and Care Mitra visits.",
    robots: "index, follow",
    ogType: "website",
    ogImage: "https://maihoonna.in/og-image.jpg"
  },

  privacy: {
    title: "Privacy Policy | MaiHoonNa Senior Care",
    description:
      "Learn how MaiHoonNa protects and respects your personal, health, and family data across our senior care mobile apps and web platform.",
    robots: "index, follow",
    ogType: "website",
    ogImage: "https://maihoonna.in/og-image.jpg"
  },

  "refund-policy": {
    title: "Refund & Cancellation Policy | MaiHoonNa",
    description:
      "Understand MaiHoonNa's subscription cancellation rules, refund criteria, and 30-day unused care hour rollover terms.",
    robots: "index, follow",
    ogType: "website",
    ogImage: "https://maihoonna.in/og-image.jpg"
  },

  "cookie-policy": {
    title: "Cookie Policy | MaiHoonNa Eldercare",
    description:
      "Information on how MaiHoonNa utilizes cookies and analytics to enhance user experience across our senior care website.",
    robots: "index, follow",
    ogType: "website",
    ogImage: "https://maihoonna.in/og-image.jpg"
  },

  auth: {
    title: "Sign Up & Login | MaiHoonNa Senior Care",
    description:
      "Sign up or log in to MaiHoonNa to access family connect dashboard, manage parent care, and track companion visits.",
    robots: "noindex, follow",
    ogType: "website",
    ogImage: "https://maihoonna.in/og-image.jpg"
  },

  account: {
    title: "My Account Dashboard | MaiHoonNa",
    description:
      "Manage active senior care subscriptions, view visit logs, and update parent care details.",
    robots: "noindex, follow",
    ogType: "website",
    ogImage: "https://maihoonna.in/og-image.jpg"
  },

  checkout: {
    title: "Complete Subscription | MaiHoonNa",
    description:
      "Securely finalize senior care plan subscription for your parents.",
    robots: "noindex, follow",
    ogType: "website",
    ogImage: "https://maihoonna.in/og-image.jpg"
  },

  "not-found": {
    title: "Page Not Found (404) | MaiHoonNa Senior Care",
    description:
      "The requested page does not exist on MaiHoonNa. Explore our senior care services, Saathi network, and subscription plans.",
    robots: "noindex, follow",
    ogType: "website",
    ogImage: "https://maihoonna.in/og-image.jpg"
  }
};

/**
 * SeoHead Component - Dynamic Metadata, Canonical & Schema Manager
 */
const SeoHead = ({ activePage = "home" }) => {
  useEffect(() => {
    const config = SEO_CONFIG[activePage] || SEO_CONFIG.home;
    const dynamicCanonical = resolveCanonicalUrl(activePage);

    // 1. Update Document Title
    document.title = config.title;

    // 2. Helper to set or create meta element
    const setMeta = (selector, attribute, attrName, content) => {
      let element = document.querySelector(selector);
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attribute, attrName);
        document.head.appendChild(element);
      }
      element.setAttribute("content", content);
    };

    // 3. Update Standard Meta Tags
    setMeta('meta[name="description"]', "name", "description", config.description);
    setMeta('meta[name="robots"]', "name", "robots", config.robots);

    // 4. Update Open Graph Meta Tags
    setMeta('meta[property="og:title"]', "property", "og:title", config.title);
    setMeta('meta[property="og:description"]', "property", "og:description", config.description);
    setMeta('meta[property="og:url"]', "property", "og:url", dynamicCanonical);
    setMeta('meta[property="og:type"]', "property", "og:type", config.ogType || "website");
    setMeta('meta[property="og:image"]', "property", "og:image", config.ogImage);

    // 5. Update Twitter Card Meta Tags
    setMeta('meta[name="twitter:title"]', "name", "twitter:title", config.title);
    setMeta('meta[name="twitter:description"]', "name", "twitter:description", config.description);
    setMeta('meta[name="twitter:image"]', "name", "twitter:image", config.ogImage);
    setMeta('meta[name="twitter:url"]', "name", "twitter:url", dynamicCanonical);

    // 6. Update Dynamic Canonical Link Element
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement("link");
      canonicalLink.setAttribute("rel", "canonical");
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute("href", dynamicCanonical);

    // 7. Inject / Update Dynamic JSON-LD Structured Data
    const existingScript = document.getElementById("mhn-dynamic-jsonld");
    if (existingScript) {
      existingScript.remove();
    }

    if (Array.isArray(config.schemas) && config.schemas.length > 0) {
      const script = document.createElement("script");
      script.id = "mhn-dynamic-jsonld";
      script.type = "application/ld+json";
      script.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@graph": config.schemas
      });
      document.head.appendChild(script);
    }
  }, [activePage]);

  return null;
};

export default SeoHead;
