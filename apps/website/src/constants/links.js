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
    linkedin: "https://www.linkedin.com/company/maihoonna-eldercare-private-limited/?viewAsMember=true",
  },

  // Mobile App Download Links
  appStore: {
    familyConnect: {
      googlePlay: "https://play.google.com/store/apps/details?id=com.maihoonna.app",
      appleAppStore: "https://apps.apple.com/in/app/maihoonna/id6801516827",
    },
    saathi: {
      googlePlay: "https://play.google.com/store/apps/details?id=com.maihoonna.sathiapp",
      appleAppStore: "https://apps.apple.com/in/app/maihoonna-saathi-app/id6802669670",
    },
    googlePlay: "https://play.google.com/store/apps/details?id=com.maihoonna.app",
    appleAppStore: "https://apps.apple.com/in/app/maihoonna/id6801516827",
  },

  // Contact Info
  contact: {
    email: "info@maihoonna.com",
    phone: "+91 85270 70049",
    supportEmail: "support@maihoonna.in",
    address: "Gurugram Sectors 53 to 57, Haryana, India",
  },

  // About Us Links
  about: [
    { label: "Our Story", page: "story", href: "/story" },
    { label: "Our Team", page: "team", href: "/team" },
    { label: "Contact Us", href: "mailto:info@maihoonna.com" },
  ],

  // Services Links
  services: [
    { label: "Care Mitra Visits", page: "services", href: "/services" },
    { label: "Saathi Network", page: "saathi", href: "/saathi" },
    { label: "Legacy Circle", page: "legacy", href: "/legacy" },
    // { label: "Plans and Pricing", page: "plans", href: "/plans" },
  ],

  // Legal & Terms Policies
  policies: [
    { label: "Privacy Policy", page: "privacy", href: "/privacy" },
    { label: "Terms of Service", page: "terms", href: "/terms" },
    { label: "Refund Policy", page: "refund-policy", href: "/refund-policy" },
    { label: "Cookie Policy", page: "cookie-policy", href: "/cookie-policy" },
    { label: "Child Safety Policy", page: "child-safety", href: "/child-safety" },
    { label: "Saathi T&C", page: "saathi-tc", href: "/saathi-tc" },
  ],

  // Footer Bottom Legal Links
  footerLegal: [
    { label: "Privacy", page: "privacy", href: "/privacy" },
    { label: "Terms", page: "terms", href: "/terms" },
    { label: "Cookies", page: "cookie-policy", href: "/cookie-policy" },
    { label: "Child Safety", page: "child-safety", href: "/child-safety" },
    { label: "Sitemap", href: "/sitemap.xml" },
  ],
};

export default SITE_LINKS;
