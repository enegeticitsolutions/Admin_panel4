import React, { useState, useEffect, useRef } from "react";
import { X, CheckCircle2, AlertCircle, Loader2, Sparkles, Send } from "lucide-react";
import { API_BASE } from "../../services/api";

/**
 * CustomizePlanModal Component
 * Opens when the user clicks 'Contact Us' on the 'Customize Your Own' card on /plans.
 * Maps and submits data directly to Zoho CRM Leads Module WebToLeadForm.
 */
export default function CustomizePlanModal({ isOpen, onClose }) {
  const [formData, setFormData] = useState({
    "Last Name": "",
    "Phone": "",
    "Address - Zip / Postal Code": "",
    "Email": "",
    "Description": "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const formRef = useRef(null);
  const initialInputRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Focus first input on open & inject Zoho tracking script
  useEffect(() => {
    if (isOpen) {
      setIsSubmitted(false);
      setErrorMessage("");
      setTimeout(() => {
        initialInputRef.current?.focus();
      }, 100);

      const trackingScriptId = "zoho-webform-tracking-1342119000000860003";
      if (!document.getElementById(trackingScriptId)) {
        const script = document.createElement("script");
        script.id = trackingScriptId;
        script.src = "https://crm.zohopublic.in/crm/WebFormServlet?rid=3726c403d1129a389a455d3000a07f5e639d049388a9c9093b2a0331ac418381";
        script.async = true;
        document.body.appendChild(script);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    let sanitized = value;

    if (name === "Phone") {
      sanitized = value.replace(/\D/g, "").slice(0, 10);
    } else if (name === "Address - Zip / Postal Code") {
      sanitized = value.replace(/\D/g, "").slice(0, 6);
    } else if (name === "Email") {
      sanitized = value.replace(/\s/g, "").slice(0, 100);
    } else if (name === "Last Name") {
      sanitized = value.slice(0, 80);
    } else if (name === "Description") {
      sanitized = value.slice(0, 255);
    }

    setFormData((prev) => ({ ...prev, [name]: sanitized }));
    if (errorMessage) setErrorMessage("");
  };

  const handleReset = () => {
    setFormData({
      "Last Name": "",
      "Phone": "",
      "Address - Zip / Postal Code": "",
      "Email": "",
      "Description": "",
    });
    setErrorMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    // 1. Validate Name
    if (!formData["Last Name"].trim()) {
      setErrorMessage("Please enter your Contact Name.");
      return;
    }

    // 2. Validate Phone
    const cleanPhone = formData["Phone"].trim();
    if (!cleanPhone || cleanPhone.length !== 10 || !/^[6-9]\d{9}$/.test(cleanPhone)) {
      setErrorMessage("Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).");
      return;
    }

    // 3. Validate Pin Code
    const cleanPincode = formData["Address - Zip / Postal Code"].trim();
    if (!cleanPincode || cleanPincode.length !== 6 || !/^\d{6}$/.test(cleanPincode)) {
      setErrorMessage("Please enter a valid 6-digit pin code (e.g. 122002).");
      return;
    }

    // 4. Validate Email
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!formData["Email"].trim() || !emailRegex.test(formData["Email"].trim())) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    // 5. Validate Required Services
    if (!formData["Description"].trim()) {
      setErrorMessage("Please describe your required services or care schedule.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        name: formData["Last Name"].trim(),
        phone: formData["Phone"].trim(),
        pincode: formData["Address - Zip / Postal Code"].trim(),
        email: formData["Email"].trim(),
        services: formData["Description"].trim(),
      };

      // 1. Send via Backend API relay (Bypasses localhost/CORS restrictions and syncs to Zoho CRM server-side)
      const endpoints = [
        `${API_BASE}/website/custom-plan`,
        "/api/website/custom-plan",
        "http://localhost:8001/api/website/custom-plan",
        "http://127.0.0.1:8001/api/website/custom-plan",
      ].filter(Boolean);

      let apiSynced = false;
      for (const endpoint of endpoints) {
        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.success) {
              apiSynced = true;
              break;
            }
          }
        } catch (apiErr) {
          // Continue fallback
        }
      }

      // 2. Direct browser WebToLeadForm submit as fallback / parallel sync
      if (!apiSynced && formRef.current) {
        try {
          const zohoData = new FormData(formRef.current);
          await fetch("https://crm.zoho.in/crm/WebToLeadForm", {
            method: "POST",
            body: zohoData,
            cache: "no-cache",
          });
        } catch (fetchErr) {
          // If browser CORS prevents reading response, trigger iframe submit
          if (formRef.current) {
            formRef.current.submit();
          }
        }
      }

      setIsSubmitted(true);
      handleReset();
    } catch (err) {
      console.error("Zoho form submission error:", err);
      setErrorMessage("Unable to submit right now. Please call us directly or try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customize-modal-title"
      onClick={onClose}
    >
      {/* Invisible target iframe for safe cross-origin Zoho CRM POST without page reload */}
      <iframe
        name="zoho_crm_custom_module_target"
        id="zoho_crm_custom_module_target"
        title="Zoho CRM Submission Target"
        style={{ display: "none", width: 0, height: 0, border: 0 }}
      />

      <div
        className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.25)",
        }}
      >
        {/* Modal Header */}
        <div className="relative px-6 pt-7 pb-5 bg-gradient-to-br from-orange-50/80 via-white to-amber-50/40 border-b border-orange-100/60">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FE6700]/10 text-[#FE6700]">
              <Sparkles className="w-3.5 h-3.5" />
              Bespoke Care Plan
            </span>
          </div>

          <h2 id="customize-modal-title" className="text-2xl font-bold text-slate-900 tracking-tight">
            Customize Your Eldercare Plan
          </h2>
          <p className="mt-1 text-sm text-slate-600 leading-relaxed">
            Tell us about your family’s unique requirements. Our care advisory team will design a customized care plan and reach out to you within 24 hours.
          </p>

          {/* Close Button (✕) */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="absolute top-5 right-5 w-9 h-9 flex items-center justify-center rounded-full bg-white/80 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors border border-slate-200/80 shadow-sm"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 md:p-8">
          {isSubmitted ? (
            <div className="py-8 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4 border border-emerald-200/80 shadow-sm">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                Thank You for Contacting Us!
              </h3>
              <p className="text-sm text-slate-600 max-w-md mx-auto mb-6 leading-relaxed">
                Your custom care request has been submitted directly to our Care Advisory Team. We will review your requirements and call you shortly to formulate the perfect care plan.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl font-semibold text-white bg-[#FE6700] hover:bg-[#EA580C] shadow-lg shadow-orange-500/25 transition-all text-sm"
              >
                Close Window
              </button>
            </div>
          ) : (
            <form
              ref={formRef}
              id="webform1342119000000860003"
              name="WebToLeads1342119000000860003"
              action="https://crm.zoho.in/crm/WebToLeadForm"
              method="POST"
              target="zoho_crm_custom_module_target"
              acceptCharset="UTF-8"
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              {/* ─── Mandatory Zoho CRM Leads Hidden Form Fields ─── */}
              <input
                type="hidden"
                name="xnQsjsdp"
                value="e9bb59978558fff5a7af05ce70e669bad0582f4d338dbfd3fa36b7273b8cf81b"
              />
              <input type="hidden" name="zc_gad" id="zc_gad" value="" />
              <input
                type="hidden"
                name="xmIwtLD"
                value="63178c43656bc8013a95b39f3827bfd32ca4c92efa41726aade16b71622b264ae96bb3372767efb4ecfb6a400d917f84"
              />
              <input type="hidden" name="actionType" value="TGVhZHM=" />
              <input type="hidden" name="returnURL" value="null" />
              <input type="hidden" name="Lead Source" value="Web Research" />
              <input type="hidden" name="aG9uZXlwb3Q" value="" />

              {/* Error Banner */}
              {errorMessage && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm animate-fadeIn">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Contact Name (Last Name in Zoho Leads) */}
              <div>
                <label htmlFor="Last_Name" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Contact Name <span className="text-red-500">*</span>
                </label>
                <input
                  ref={initialInputRef}
                  type="text"
                  id="Last_Name"
                  name="Last Name"
                  maxLength={80}
                  required
                  placeholder="e.g. Ramesh Sharma"
                  value={formData["Last Name"]}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 text-sm bg-slate-50/60 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#FE6700] focus:ring-2 focus:ring-[#FE6700]/20 transition-all"
                />
              </div>

              {/* Phone & Pin Code in Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Phone Number (Phone in Zoho Leads) */}
                <div>
                  <label htmlFor="Phone" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 text-xs font-semibold text-slate-500 select-none">
                      +91
                    </span>
                    <input
                      type="tel"
                      id="Phone"
                      name="Phone"
                      maxLength={10}
                      required
                      placeholder="9876543210"
                      value={formData["Phone"]}
                      onChange={handleChange}
                      className="w-full pl-12 pr-4 py-2.5 text-sm bg-slate-50/60 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#FE6700] focus:ring-2 focus:ring-[#FE6700]/20 transition-all font-mono"
                    />
                  </div>
                </div>

                {/* Pin Code (Address - Zip / Postal Code in Zoho Leads) */}
                <div>
                  <label htmlFor="Address_-_Zip_/_Postal_Code" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Pin Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="Address_-_Zip_/_Postal_Code"
                    name="Address - Zip / Postal Code"
                    maxLength={6}
                    required
                    placeholder="e.g. 122002"
                    value={formData["Address - Zip / Postal Code"]}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 text-sm bg-slate-50/60 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#FE6700] focus:ring-2 focus:ring-[#FE6700]/20 transition-all font-mono"
                  />
                </div>
              </div>

              {/* Email Address (Email in Zoho Leads) */}
              <div>
                <label htmlFor="Email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  id="Email"
                  name="Email"
                  maxLength={100}
                  required
                  placeholder="e.g. ramesh.sharma@example.com"
                  value={formData["Email"]}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 text-sm bg-slate-50/60 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#FE6700] focus:ring-2 focus:ring-[#FE6700]/20 transition-all"
                />
              </div>

              {/* Required Services (Description in Zoho Leads) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="Description" className="block text-xs font-semibold text-slate-700">
                    Required Services &amp; Schedule <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {formData["Description"].length}/255
                  </span>
                </div>
                <textarea
                  id="Description"
                  name="Description"
                  rows={3}
                  maxLength={255}
                  required
                  placeholder="e.g., Daily 4 hours companionship for elderly mother in Gurugram, vitals monitoring, hospital assistance, physiotherapy coordination..."
                  value={formData["Description"]}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 text-sm bg-slate-50/60 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#FE6700] focus:ring-2 focus:ring-[#FE6700]/20 transition-all resize-none"
                />
              </div>

              {/* Footer Actions */}
              <div className="pt-3 flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  Reset
                </button>
                <button
                  type="submit"
                  id="formsubmit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#FE6700] to-[#EA580C] hover:from-[#EA580C] hover:to-[#C2410C] shadow-lg shadow-orange-500/30 hover:shadow-orange-500/40 disabled:opacity-60 disabled:cursor-not-allowed transition-all transform active:scale-[0.98]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Request</span>
                      <Send className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              <p className="text-[11px] text-slate-400 text-center pt-2">
                🔒 Your information is confidential and protected under MaiHoonNa privacy policies.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

