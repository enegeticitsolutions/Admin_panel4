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
    customCategory: "",
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
        import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/website/partners` : null,
        "/api/website/partners",
        import.meta.env.VITE_ADMIN_API_URL ? `${import.meta.env.VITE_ADMIN_API_URL}/api/partners/public` : null,
        "/api/partners/public",
        ...(window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
          ? ["http://localhost:3001/api/partners/public"]
          : []),
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
    let sanitizedValue = value;

    if (name === "phone") {
      // Strictly digits only, max 10 digits (Standard Indian Mobile format)
      sanitizedValue = value.replace(/\D/g, "").slice(0, 10);
    } else if (name === "primaryContactName") {
      // Strictly letters, spaces, dots (Dr./Mr.), and hyphens only (no digits or symbols)
      sanitizedValue = value.replace(/[^a-zA-Z\s.-]/g, "").slice(0, 60);
    } else if (name === "city" || name === "state") {
      // Strictly letters, spaces, and hyphens only (no numbers)
      sanitizedValue = value.replace(/[^a-zA-Z\s-]/g, "").slice(0, 50);
    } else if (name === "email") {
      // Prevent spaces in email, max 100 characters
      sanitizedValue = value.replace(/\s/g, "").slice(0, 100);
    } else if (name === "name") {
      // Organisation Name: letters, numbers, spaces, and standard business punctuation (&, ., -, ,, ', /, (, ))
      sanitizedValue = value.replace(/[^a-zA-Z0-9\s.&,\-/'()]/g, "").slice(0, 120);
    } else if (name === "customCategory") {
      // Custom category: letters, numbers, spaces, and company chars (&, ., -, /)
      sanitizedValue = value.replace(/[^a-zA-Z0-9\s.&,\-/'()]/g, "").slice(0, 60);
    } else if (name === "description") {
      // Brief description: max 1000 chars
      sanitizedValue = value.slice(0, 1000);
    }

    setFormData((prev) => ({ ...prev, [name]: sanitizedValue }));
    if (errorMsg) setErrorMsg("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    // 1. Organisation Name
    if (!formData.name.trim()) {
      setErrorMsg("Organisation Name is required.");
      return;
    }
    if (formData.name.trim().length < 2) {
      setErrorMsg("Please enter a valid Organisation Name (at least 2 characters).");
      return;
    }

    // 2. Partner Category (Supports both existing categories and custom "Other" categories)
    if (!formData.category || formData.category === "-None-") {
      setErrorMsg("Please select a Partner Category.");
      return;
    }
    if (formData.category === "Other") {
      if (!formData.customCategory.trim()) {
        setErrorMsg("Please specify your category or service.");
        return;
      }
      if (formData.customCategory.trim().length < 2) {
        setErrorMsg("Please enter a valid category name (at least 2 characters).");
        return;
      }
    }

    const effectiveCategory = formData.category === "Other"
      ? formData.customCategory.trim()
      : formData.category;

    // 3. Description
    if (!formData.description.trim()) {
      setErrorMsg("Brief Description of the organization is required.");
      return;
    }
    if (formData.description.trim().length < 15) {
      setErrorMsg("Please provide a bit more detail in the description (at least 15 characters).");
      return;
    }

    // 4. Primary Contact Name
    if (!formData.primaryContactName.trim()) {
      setErrorMsg("Primary Contact Name is required.");
      return;
    }
    if (formData.primaryContactName.trim().length < 2) {
      setErrorMsg("Please enter a valid Primary Contact Name.");
      return;
    }

    // 5. Email
    if (!formData.email.trim()) {
      setErrorMsg("Email address is required.");
      return;
    }
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(formData.email.trim())) {
      setErrorMsg("Please enter a valid email address (e.g. partner@example.com).");
      return;
    }

    // 6. Phone
    if (!formData.phone.trim()) {
      setErrorMsg("Phone number is required.");
      return;
    }
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(formData.phone.trim())) {
      setErrorMsg("Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.");
      return;
    }

    setIsSubmitting(true);

    const backendPayload = {
      organization_name: formData.name.trim(),
      organizationName: formData.name.trim(),
      name: formData.name.trim(),
      category: effectiveCategory,
      categoryName: effectiveCategory,
      description: formData.description.trim(),
      serviceDetails: formData.description.trim(),
      primary_contact_name: formData.primaryContactName.trim(),
      contactName: formData.primaryContactName.trim(),
      email: formData.email.trim().toLowerCase(),
      phone: formData.phone.trim(),
      city: formData.city.trim(),
      operatingCity: formData.city.trim(),
      state: formData.state.trim(),
      source: "WEBSITE",
    };

    const endpoints = [
      import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/website/partner-application` : null,
      "/api/website/partner-application",
      import.meta.env.VITE_ADMIN_API_URL ? `${import.meta.env.VITE_ADMIN_API_URL}/api/partners/apply` : null,
      "/api/partners/apply",
      ...(window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
        ? ["http://localhost:3001/api/partners/apply", "http://127.0.0.1:3001/api/partners/apply"]
        : []),
    ].filter(Boolean);

    let isSuccess = false;

    for (const endpoint of endpoints) {
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
        console.warn(`Partner endpoint ${endpoint} attempt note:`, dbErr);
      }
    }

    setIsSubmitting(false);

    if (isSuccess) {
      setIsSubmitted(true);
      setFormData({
        name: "",
        category: "-None-",
        customCategory: "",
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
    <form onSubmit={handleSubmit} style={{ width: "100%", textAlign: "left" }} noValidate>
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
          <span style={{ fontWeight: "500" }}>{errorMsg}</span>
        </div>
      )}

      {/* Organisation Name */}
      <div style={{ marginBottom: "14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "5px" }}>
          <label style={{ fontSize: "13px", fontWeight: "600", color: "#374151" }}>
            Organisation Name <span style={{ color: "#FE6700", fontWeight: "bold" }}>*</span>
          </label>
          <span style={{ fontSize: "11px", color: "#9CA3AF" }}>Max 120 chars</span>
        </div>
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "5px" }}>
          <label style={{ fontSize: "13px", fontWeight: "600", color: "#374151" }}>
            Partner Category <span style={{ color: "#FE6700", fontWeight: "bold" }}>*</span>
          </label>
          <span style={{ fontSize: "11px", color: "#9CA3AF" }}>Select or choose Other</span>
        </div>
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
            color: formData.category === "-None-" ? "#6B7280" : "#111827",
            background: "#F9FAFB",
            border: "1.5px solid #E5E7EB",
            borderRadius: "8px",
            outline: "none",
            cursor: "pointer"
          }}
        >
          <option value="-None-">- Select Category -</option>
          {categories.length > 0 ? (
            categories
              .filter((cat) => cat.name?.toLowerCase() !== "other")
              .map((cat) => (
                <option key={cat.id || cat.name} value={cat.name}>
                  {cat.name}
                </option>
              ))
          ) : (
            <>
              <option value="Ambulance & Emergency">Ambulance & Emergency</option>
              <option value="Pharmacy Partners">Pharmacy Partners</option>
              <option value="Diagnostic Labs">Diagnostic Labs</option>
              <option value="Care Providers">Care Providers</option>
              <option value="Hospitals & Clinics">Hospitals & Clinics</option>
              <option value="Corporate & B2B">Corporate & B2B</option>
              <option value="Tele-medicine">Tele-medicine</option>
              <option value="RWA & Housing Societies">RWA & Housing Societies</option>
            </>
          )}
          <option value="Other">Other (Specify your category)</option>
        </select>

        {/* Dynamic Custom Category Input when 'Other' is selected */}
        {formData.category === "Other" && (
          <div style={{ marginTop: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "5px" }}>
              <label style={{ fontSize: "12.5px", fontWeight: "600", color: "#FE6700" }}>
                Specify Your Category / Service <span style={{ color: "#FE6700", fontWeight: "bold" }}>*</span>
              </label>
              <span style={{ fontSize: "11px", color: "#9CA3AF" }}>Max 60 chars</span>
            </div>
            <input
              type="text"
              name="customCategory"
              required
              maxLength={60}
              value={formData.customCategory}
              onChange={handleChange}
              placeholder="e.g. Medical Equipment, Nutritionist, Senior Wellness..."
              autoFocus
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "10px 14px",
                fontSize: "13.5px",
                color: "#111827",
                background: "#FFFFFF",
                border: "1.5px solid #FE6700",
                borderRadius: "8px",
                outline: "none",
                boxShadow: "0 0 0 3px rgba(254, 103, 0, 0.12)"
              }}
            />
          </div>
        )}
      </div>

      {/* Brief Description */}
      <div style={{ marginBottom: "14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "5px" }}>
          <label style={{ fontSize: "13px", fontWeight: "600", color: "#374151" }}>
            Brief Description of the org <span style={{ color: "#FE6700", fontWeight: "bold" }}>*</span>
          </label>
          <span style={{ fontSize: "11px", color: formData.description.length >= 950 ? "#EF4444" : "#9CA3AF" }}>
            {formData.description.length}/1000
          </span>
        </div>
        <textarea
          name="description"
          required
          rows={3}
          maxLength={1000}
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

      {/* Primary Contact Name (Locked: Letters only) */}
      <div style={{ marginBottom: "14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "5px" }}>
          <label style={{ fontSize: "13px", fontWeight: "600", color: "#374151" }}>
            Primary Contact Name <span style={{ color: "#FE6700", fontWeight: "bold" }}>*</span>
          </label>
          <span style={{ fontSize: "11px", color: "#9CA3AF" }}>Letters only</span>
        </div>
        <input
          type="text"
          name="primaryContactName"
          required
          maxLength={60}
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

      {/* Email (Locked: Email format, no spaces) */}
      <div style={{ marginBottom: "14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "5px" }}>
          <label style={{ fontSize: "13px", fontWeight: "600", color: "#374151" }}>
            Email <span style={{ color: "#FE6700", fontWeight: "bold" }}>*</span>
          </label>
          <span style={{ fontSize: "11px", color: "#9CA3AF" }}>Valid email</span>
        </div>
        <input
          type="email"
          name="email"
          required
          maxLength={100}
          value={formData.email}
          onChange={handleChange}
          placeholder="e.g. partner@example.com"
          autoComplete="email"
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

      {/* Phone (Locked: Numbers only, exactly 10 digits with +91 badge) */}
      <div style={{ marginBottom: "14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "5px" }}>
          <label style={{ fontSize: "13px", fontWeight: "600", color: "#374151" }}>
            Phone Number <span style={{ color: "#FE6700", fontWeight: "bold" }}>*</span>
          </label>
          <span style={{ fontSize: "11px", color: "#9CA3AF" }}>10 digits (digits only)</span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            width: "100%",
            boxSizing: "border-box",
            background: "#F9FAFB",
            border: "1.5px solid #E5E7EB",
            borderRadius: "8px",
            padding: "0 14px",
            overflow: "hidden"
          }}
        >
          <span style={{ fontSize: "13.5px", fontWeight: "600", color: "#6B7280", marginRight: "10px", userSelect: "none" }}>
            +91
          </span>
          <input
            type="tel"
            name="phone"
            required
            maxLength={10}
            inputMode="numeric"
            value={formData.phone}
            onChange={handleChange}
            placeholder="98765 43210"
            style={{
              width: "100%",
              border: "none",
              background: "transparent",
              outline: "none",
              padding: "10px 0",
              fontSize: "13.5px",
              color: "#111827"
            }}
          />
        </div>
      </div>

      {/* City & State Grid (Locked: Letters only) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "18px" }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "5px" }}>
            <label style={{ fontSize: "13px", fontWeight: "600", color: "#374151" }}>
              City
            </label>
            <span style={{ fontSize: "10.5px", color: "#9CA3AF" }}>Letters only</span>
          </div>
          <input
            type="text"
            name="city"
            maxLength={50}
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "5px" }}>
            <label style={{ fontSize: "13px", fontWeight: "600", color: "#374151" }}>
              State
            </label>
            <span style={{ fontSize: "10.5px", color: "#9CA3AF" }}>Letters only</span>
          </div>
          <input
            type="text"
            name="state"
            maxLength={50}
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
