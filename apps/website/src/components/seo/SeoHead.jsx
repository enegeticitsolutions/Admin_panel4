import { useEffect } from "react";

const BASE_URL = "https://maihoonna.in";

/**
 * Resolves the full absolute canonical URL strictly pointing to https://maihoonna.in
 * Eliminates URL hash fragments so search engines receive clean indexing targets.
 */
const resolveCanonicalUrl = (activePage) => {
  if (!activePage || activePage === "home") {
    return `${BASE_URL}/`;
  }
  const cleanPath = activePage === "about" ? "about" : activePage;
  return `${BASE_URL}/${cleanPath}`;
};

/**
 * Page-by-page SEO Metadata Configuration Map
 */
const SEO_CONFIG = {
  home: {
    title: "MaiHoonNa | Senior Care Companion in Gurugram & Delhi NCR",
    description:
      "Trusted care companions for elderly parents in Gurugram. Home visits, vitals checks & family updates. Book a free consultation for peace of mind today.",
    keywords:
      "senior care Gurugram, care for elderly parents Gurgaon, elder care for NRI families, Saathi volunteer senior care, elderly companionship India, senior health monitoring Gurugram",
    robots: "index, follow",
    ogType: "website",
    ogImage: "https://maihoonna.in/og-image.jpg",
    schemas: [
      {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        "@id": "https://maihoonna.in/#localbusiness",
        "name": "MaiHoonNa Eldercare",
        "alternateName": "MaiHoonNa Senior Care",
        "url": "https://maihoonna.in",
        "logo": "https://maihoonna.in/logo.svg",
        "image": "https://maihoonna.in/og-image.jpg",
        "description":
          "Trusted senior care companions and elder health monitoring in Gurugram & Delhi NCR. Care Mitra visits, Saathi companionship, and family updates.",
        "priceRange": "₹₹",
        "telephone": "+91-98765-43210",
        "email": "info@maihoonna.in",
        "address": {
          "@type": "PostalAddress",
          "streetAddress": "Gurugram Sectors 53 to 57",
          "addressLocality": "Gurugram",
          "addressRegion": "Haryana",
          "postalCode": "122002",
          "addressCountry": "IN"
        },
        "geo": {
          "@type": "GeoCoordinates",
          "latitude": "28.4419",
          "longitude": "77.0984"
        },
        "areaServed": [
          {
            "@type": "City",
            "name": "Gurugram"
          },
          {
            "@type": "AdministrativeArea",
            "name": "Delhi NCR"
          }
        ],
        "serviceType": [
          "Senior Care Companion",
          "Elder Health Monitoring",
          "Medication Adherence Tracking",
          "Saathi Volunteer Companionship"
        ]
      },
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        "@id": "https://maihoonna.in/#organization",
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
          "contactType": "customer service",
          "availableLanguage": ["en", "hi"]
        }
      },
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "@id": "https://maihoonna.in/#website",
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
            "name": "What is a Care Mitra in Gurugram?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text":
                "A Care Mitra is a trained, background-verified care companion who visits your elderly parent at home in Gurugram. Care Mitras are graded by skill level — from ANM to GNM, B.Sc Nurse, and Specialist Mitra — ensuring your parent is matched with someone qualified for their specific health and companionship needs."
            }
          },
          {
            "@type": "Question",
            "name": "How is MaiHoonNa different from hiring a domestic caregiver directly in Gurgaon?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text":
                "When you hire independently, you are responsible for background checks, training, and managing sudden leaves with no real visibility. MaiHoonNa handles verification and clinical training upfront, provides guaranteed replacement companions, and sends live visit logs, health vitals, and mood tracking to your app after every visit — plus an Emergency Response Coordinator on standby."
            }
          },
          {
            "@type": "Question",
            "name": "Can NRI adult children manage senior care for parents in India from abroad?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text":
                "Yes — this is one of the primary reasons families choose MaiHoonNa. The Family Connect mobile app lets NRI adult children track every companion visit, view real-time health vitals, message the local Gurugram care team, and receive instant emergency SOS alerts across all global time zones."
            }
          },
          {
            "@type": "Question",
            "name": "How does elderly vitals monitoring and medication tracking work?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text":
                "During each scheduled visit, the Care Mitra checks and logs key parameters including blood pressure, pulse, blood sugar, and temperature. Prescription medication schedules are reviewed to ensure adherence, with automated logs visible on the family app."
            }
          },
          {
            "@type": "Question",
            "name": "What is the Saathi Volunteer Network for seniors?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text":
                "The Saathi Network connects elderly citizens with verified community volunteers for meaningful conversation, walks, and hobby sharing. It directly combats loneliness and social isolation between clinical Care Mitra visits."
            }
          }
        ]
      }
    ]
  },

  services: {
    title: "Senior Care Services & Elderly Health Monitoring Gurugram | MaiHoonNa",
    description:
      "Explore senior care services in Gurugram & Delhi NCR: Care Mitra home visits, vitals tracking, medication adherence, clinic accompaniment, and 24/7 emergency response.",
    keywords:
      "senior care services Gurugram, elderly vitals monitoring Gurgaon, medication adherence seniors, Care Mitra visits Delhi NCR",
    robots: "index, follow",
    ogType: "website",
    ogImage: "https://maihoonna.in/og-image.jpg",
    schemas: [
      {
        "@context": "https://schema.org",
        "@type": "Service",
        "serviceType": "Senior Home Care & Vitals Monitoring",
        "provider": {
          "@type": "LocalBusiness",
          "name": "MaiHoonNa Eldercare",
          "url": "https://maihoonna.in"
        },
        "areaServed": [
          {
            "@type": "City",
            "name": "Gurugram"
          },
          {
            "@type": "AdministrativeArea",
            "name": "Delhi NCR"
          }
        ],
        "description":
          "In-home senior care in Gurugram including vitals tracking, prescription-linked medication reminders, mood logging, clinic accompaniment, and 24/7 emergency alert chain."
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
    if (config.keywords) {
      setMeta('meta[name="keywords"]', "name", "keywords", config.keywords);
    }

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
