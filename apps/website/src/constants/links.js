/**
 * Site-wide Hyperlinks and Configuration
 * Centralized links for social media, app store downloads, contact info, and site policies.
 */
export const SITE_LINKS = {
  // Social Media Channels
  social: {
    instagram: "https://www.instagram.com/maihoonna_eldercare/",
    twitter: "https://x.com/MaihoonnaElderC",
    facebook: "https://www.facebook.com/maihoonnaeldercare",
    youtube: "https://youtube.com/@maihoonna",
    linkedin: "https://www.linkedin.com/company/maihoonna-eldercare-private-limited/?viewAsMember=true",
  },

  // Mobile App Download Links
  appStore: {
    googlePlay: "https://play.google.com/store/apps/details?id=com.rajeev_23.maihoonna",
    appleAppStore: "https://apps.apple.com/app/maihoonna/id1234567890",
  },

  // Contact Info
  contact: {
    email: "info@maihoonna.in",
    phone: "+91 98765 43210",
    supportEmail: "support@maihoonna.in",
    address: "Gurugram Sectors 53 to 57, Haryana, India",
  },

  // About Us Links
  about: [
    { label: "Our Story", page: "story", href: "/story" },
    { label: "Contact Us", href: "mailto:info@maihoonna.in" },
  ],

  // Services Links
  services: [
    { label: "Care Mitra Visits", page: "services", href: "/services" },
    { label: "Saathi Network", page: "saathi", href: "/saathi" },
    { label: "Plans and Pricing", page: "plans", href: "/plans" },
  ],

  // Legal & Terms Policies
  policies: [
    { label: "Privacy Policy", page: "privacy", href: "/privacy" },
    { label: "Terms of Service", page: "terms", href: "/terms" },
    { label: "Refund Policy", page: "refund-policy", href: "/refund-policy" },
    { label: "Cookie Policy", page: "cookie-policy", href: "/cookie-policy" },
  ],

  // Footer Bottom Legal Links
  footerLegal: [
    { label: "Privacy", page: "privacy", href: "/privacy" },
    { label: "Terms", page: "terms", href: "/terms" },
    { label: "Cookies", page: "cookie-policy", href: "/cookie-policy" },
    { label: "Sitemap", href: "/sitemap.xml" },
  ],
};

export default SITE_LINKS;
