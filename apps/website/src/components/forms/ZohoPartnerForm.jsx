import React, { useState, useEffect } from "react";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

/**
 * ZohoPartnerForm Component
 * Submits partner application to Admin Backend and seamlessly pushes to Zoho CRM.
 * Newly registered partners immediately appear under 'Pending Review' in the Admin Panel
 * and in Zoho CRM under the 'Partner Registration' module.
 */
const ZohoPartnerForm = () => {
  const [formData, setFormData] = useState({
    name: "",
    category: "-None-",
    description: "",
    primaryContactName: "",
    email: "",
    phone: "",
    city: "",
    state: "",
  });

  const [categories, setCategories] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Dynamically load categories from database (Admin Panel sync)
  useEffect(() => {
    let isMounted = true;
    const fetchCategories = async () => {
      const urls = [
        import.meta.env.VITE_ADMIN_API_URL ? `${import.meta.env.VITE_ADMIN_API_URL}/api/partners/public` : null,
        "http://localhost:3001/api/partners/public",
        "http://127.0.0.1:3001/api/partners/public",
        "/api/partners/public",
      ].filter(Boolean);

      for (const url of urls) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            if (isMounted && data?.success && Array.isArray(data?.data?.categories)) {
              setCategories(data.data.categories);
              break;
            }
          }
        } catch (err) {
          // Continue fallback
        }
      }
    };
    fetchCategories();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errorMsg) setErrorMsg("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    // Validation checks
    if (!formData.name.trim()) {
      setErrorMsg("Organisation Name cannot be empty.");
      return;
    }
    if (!formData.category || formData.category === "-None-") {
      setErrorMsg("Please select a Partner Category.");
      return;
    }
    if (!formData.description.trim()) {
      setErrorMsg("Brief Description cannot be empty.");
      return;
    }

    if (formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        setErrorMsg("Please enter a valid email address.");
        return;
      }
    }

    setIsSubmitting(true);

    const backendPayload = {
      organization_name: formData.name.trim(),
      category: formData.category,
      description: formData.description.trim(),
      primary_contact_name: formData.primaryContactName.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      city: formData.city.trim(),
      state: formData.state.trim(),
      source: "WEBSITE",
    };

    const adminEndpoints = [
      import.meta.env.VITE_ADMIN_API_URL ? `${import.meta.env.VITE_ADMIN_API_URL}/api/partners/apply` : null,
      "http://localhost:3001/api/partners/apply",
      "http://127.0.0.1:3001/api/partners/apply",
      "/api/partners/apply",
      "http://localhost:3001/api/partners/webhook/zoho",
    ].filter(Boolean);

    let isSuccess = false;

    for (const endpoint of adminEndpoints) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(backendPayload),
        });
        if (res.ok) {
          const resData = await res.json();
          if (resData?.success) {
            isSuccess = true;
            break;
          }
        }
      } catch (dbErr) {
        console.warn(`Admin DB endpoint ${endpoint} attempt note:`, dbErr);
      }
    }

    setIsSubmitting(false);

    if (isSuccess) {
      setIsSubmitted(true);
      setFormData({
        name: "",
        category: "-None-",
        description: "",
        primaryContactName: "",
        email: "",
        phone: "",
        city: "",
        state: "",
      });
    } else {
      setErrorMsg("Unable to submit application at the moment. Please try again.");
    }
  };

  if (isSubmitted) {
    return (
      <div style={{
        background: "#ECFDF5",
        border: "1.5px solid #10B981",
        borderRadius: "16px",
        padding: "32px 24px",
        textAlign: "center",
        boxShadow: "0 4px 20px rgba(16, 185, 129, 0.12)",
        animation: "fadeIn 0.3s ease-in-out"
      }}>
        <div style={{
          width: "56px",
          height: "56px",
          background: "#D1FAE5",
          color: "#059669",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 16px"
        }}>
          <CheckCircle2 style={{ width: "32px", height: "32px" }} />
        </div>
        <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#065F46", marginBottom: "8px" }}>
          Application Submitted Successfully!
        </h3>
        <p style={{ fontSize: "14px", color: "#047857", lineHeight: "1.6", maxWidth: "420px", margin: "0 auto 20px" }}>
          Thank you for applying to become a partner with MaiHoonNa. Your application has been received and forwarded to our partner onboarding team. We will get in touch with you within 24–48 business hours.
        </p>
        <button
          type="button"
          onClick={() => setIsSubmitted(false)}
          style={{
            background: "#FE6700",
            color: "#FFFFFF",
            border: "none",
            borderRadius: "8px",
            padding: "10px 20px",
            fontSize: "13.5px",
            fontWeight: "600",
            cursor: "pointer",
            transition: "background 0.2s ease"
          }}
        >
          Submit Another Application
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ width: "100%", textAlign: "left" }}>
      {errorMsg && (
        <div style={{
          background: "#FEF2F2",
          border: "1px solid #FCA5A5",
          color: "#991B1B",
          borderRadius: "8px",
          padding: "10px 14px",
          marginBottom: "16px",
          fontSize: "13px",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          <AlertCircle style={{ width: "16px", height: "16px", flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Organisation Name */}
      <div style={{ marginBottom: "14px" }}>
        <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "5px" }}>
          Organisation Name <span style={{ color: "#FE6700", fontWeight: "bold" }}>*</span>
        </label>
        <input
          type="text"
          name="name"
          required
          maxLength={120}
          value={formData.name}
          onChange={handleChange}
          placeholder="e.g. CareHealth Diagnostics"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "10px 14px",
            fontSize: "13.5px",
            color: "#111827",
            background: "#F9FAFB",
            border: "1.5px solid #E5E7EB",
            borderRadius: "8px",
            outline: "none"
          }}
        />
      </div>

      {/* Partner Category */}
      <div style={{ marginBottom: "14px" }}>
        <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "5px" }}>
          Partner Category <span style={{ color: "#FE6700", fontWeight: "bold" }}>*</span>
        </label>
        <select
          name="category"
          required
          value={formData.category}
          onChange={handleChange}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "10px 14px",
            fontSize: "13.5px",
            color: "#111827",
            background: "#F9FAFB",
            border: "1.5px solid #E5E7EB",
            borderRadius: "8px",
            outline: "none",
            cursor: "pointer"
          }}
        >
          <option value="-None-">- Select Category -</option>
          {categories.length > 0 ? (
            categories.map((cat) => (
              <option key={cat.id || cat.name} value={cat.name}>
                {cat.name}
              </option>
            ))
          ) : (
            <>
              <option value="Ambulance and Emergency">Ambulance and Emergency</option>
              <option value="Pharmacy">Pharmacy</option>
              <option value="Diagnostic Labs">Diagnostic Labs</option>
              <option value="Care Providers">Care Providers</option>
              <option value="Hospitals and Clinics">Hospitals and Clinics</option>
              <option value="Corporate & B2B">Corporate & B2B</option>
              <option value="Tele-medicine">Tele-medicine</option>
              <option value="RWA & Housing Socities">RWA & Housing Socities</option>
            </>
          )}
        </select>
      </div>

      {/* Brief Description */}
      <div style={{ marginBottom: "14px" }}>
        <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "5px" }}>
          Brief Description of the org <span style={{ color: "#FE6700", fontWeight: "bold" }}>*</span>
        </label>
        <textarea
          name="description"
          required
          rows={3}
          value={formData.description}
          onChange={handleChange}
          placeholder="Briefly describe your services, specialized care, and cities served..."
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "10px 14px",
            fontSize: "13.5px",
            color: "#111827",
            background: "#F9FAFB",
            border: "1.5px solid #E5E7EB",
            borderRadius: "8px",
            outline: "none",
            resize: "vertical"
          }}
        />
      </div>

      {/* Primary Contact Name */}
      <div style={{ marginBottom: "14px" }}>
        <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "5px" }}>
          Primary Contact Name
        </label>
        <input
          type="text"
          name="primaryContactName"
          maxLength={255}
          value={formData.primaryContactName}
          onChange={handleChange}
          placeholder="e.g. Dr. Rajesh Sharma"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "10px 14px",
            fontSize: "13.5px",
            color: "#111827",
            background: "#F9FAFB",
            border: "1.5px solid #E5E7EB",
            borderRadius: "8px",
            outline: "none"
          }}
        />
      </div>

      {/* Email */}
      <div style={{ marginBottom: "14px" }}>
        <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "5px" }}>
          Email
        </label>
        <input
          type="email"
          name="email"
          maxLength={100}
          value={formData.email}
          onChange={handleChange}
          placeholder="e.g. partner@example.com"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "10px 14px",
            fontSize: "13.5px",
            color: "#111827",
            background: "#F9FAFB",
            border: "1.5px solid #E5E7EB",
            borderRadius: "8px",
            outline: "none"
          }}
        />
      </div>

      {/* Phone */}
      <div style={{ marginBottom: "14px" }}>
        <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "5px" }}>
          Phone
        </label>
        <input
          type="tel"
          name="phone"
          maxLength={30}
          value={formData.phone}
          onChange={handleChange}
          placeholder="e.g. +91 98765 43210"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "10px 14px",
            fontSize: "13.5px",
            color: "#111827",
            background: "#F9FAFB",
            border: "1.5px solid #E5E7EB",
            borderRadius: "8px",
            outline: "none"
          }}
        />
      </div>

      {/* City & State Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "18px" }}>
        <div>
          <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "5px" }}>
            City
          </label>
          <input
            type="text"
            name="city"
            maxLength={255}
            value={formData.city}
            onChange={handleChange}
            placeholder="e.g. Gurugram"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "10px 14px",
              fontSize: "13.5px",
              color: "#111827",
              background: "#F9FAFB",
              border: "1.5px solid #E5E7EB",
              borderRadius: "8px",
              outline: "none"
            }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "5px" }}>
            State
          </label>
          <input
            type="text"
            name="state"
            maxLength={255}
            value={formData.state}
            onChange={handleChange}
            placeholder="e.g. Haryana"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "10px 14px",
              fontSize: "13.5px",
              color: "#111827",
              background: "#F9FAFB",
              border: "1.5px solid #E5E7EB",
              borderRadius: "8px",
              outline: "none"
            }}
          />
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        style={{
          width: "100%",
          background: "#FE6700",
          color: "#FFFFFF",
          border: "none",
          borderRadius: "10px",
          padding: "14px 20px",
          fontSize: "15px",
          fontWeight: "700",
          cursor: isSubmitting ? "not-allowed" : "pointer",
          opacity: isSubmitting ? 0.75 : 1,
          boxShadow: "0 4px 14px rgba(254, 103, 0, 0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          transition: "all 0.2s ease"
        }}
      >
        {isSubmitting ? (
          <>
            <Loader2 style={{ width: "18px", height: "18px", animation: "spin 1s linear infinite" }} />
            <span>Submitting Application...</span>
          </>
        ) : (
          <span>Submit Partner Application</span>
        )}
      </button>
    </form>
  );
};

export default ZohoPartnerForm;
