import React, { useEffect, useRef, useState } from "react";

/**
 * ZohoPartnerForm Component
 * Securely embeds Zoho CRM Web-to-Lead/Partner Registration Form
 * with compact, pixel-perfect MaiHoonNa brand styling and dynamic auto-sizing.
 */
const ZohoPartnerForm = () => {
  const iframeRef = useRef(null);
  const [iframeHeight, setIframeHeight] = useState(520);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            background: transparent !important;
            color: #111827;
            overflow-x: hidden;
            width: 100%;
          }
          #crmWebToEntityForm {
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            background: transparent !important;
          }
          .zcwf_title {
            display: none !important;
          }
          .zcwf_row {
            margin: 10px 0 !important;
            padding: 0 !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 4px !important;
            width: 100% !important;
            float: none !important;
            clear: both !important;
          }
          .zcwf_col_lab {
            width: 100% !important;
            float: none !important;
            padding: 0 !important;
            margin: 0 !important;
            font-size: 12px !important;
            font-weight: 700 !important;
            color: #374151 !important;
            font-family: inherit !important;
            letter-spacing: 0.01em;
          }
          .zcwf_col_lab label {
            font-size: 12px !important;
            font-weight: 700 !important;
            color: #374151 !important;
            font-family: inherit !important;
            cursor: pointer;
          }
          .zcwf_col_lab span {
            color: #FE6700 !important;
            margin-left: 2px;
            font-weight: bold;
          }
          .zcwf_col_fld {
            width: 100% !important;
            float: none !important;
            padding: 0 !important;
            margin: 0 !important;
            position: relative;
          }
          .zcwf_col_fld input[type=text],
          .zcwf_col_fld input[type=password],
          .zcwf_col_fld textarea,
          .zcwf_col_fld_slt {
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
            padding: 9px 12px !important;
            font-size: 13.5px !important;
            color: #111827 !important;
            background: #F9FAFB !important;
            border: 1px solid #D1D5DB !important;
            border-radius: 8px !important;
            outline: none !important;
            font-family: inherit !important;
            transition: all 0.15s ease !important;
            float: none !important;
            display: block !important;
          }
          .zcwf_col_fld input[type=text]:focus,
          .zcwf_col_fld textarea:focus,
          .zcwf_col_fld_slt:focus {
            background: #FFFFFF !important;
            border-color: #FE6700 !important;
            box-shadow: 0 0 0 3px rgba(254, 103, 0, 0.12) !important;
          }
          .zcwf_col_fld textarea {
            min-height: 65px !important;
            height: 65px !important;
            resize: vertical !important;
          }
          .zcwf_file {
            width: 100% !important;
            font-size: 12px !important;
            color: #4B5563 !important;
            float: none !important;
            padding: 4px 0 !important;
          }
          .formsubmit.zcwf_button,
          input#formsubmit {
            background: #FE6700 !important;
            color: #FFFFFF !important;
            border: none !important;
            border-radius: 10px !important;
            padding: 12px 20px !important;
            font-size: 14.5px !important;
            font-weight: 700 !important;
            cursor: pointer !important;
            box-shadow: 0 4px 14px rgba(254, 103, 0, 0.3) !important;
            width: 100% !important;
            max-width: 100% !important;
            margin-right: 0 !important;
            margin-top: 10px !important;
            margin-bottom: 2px !important;
            transition: all 0.2s ease !important;
            text-align: center !important;
            display: block !important;
            font-family: inherit !important;
          }
          .formsubmit.zcwf_button:hover,
          input#formsubmit:hover {
            background: #E55D00 !important;
            transform: translateY(-1px);
            box-shadow: 0 6px 18px rgba(254, 103, 0, 0.4) !important;
          }
          .formsubmit.zcwf_button:disabled,
          input#formsubmit:disabled {
            opacity: 0.7 !important;
            cursor: not-allowed !important;
          }
          input.zcwf_button[name="reset"] {
            display: none !important;
          }
          .cBoth:after {
            content: '';
            display: block;
            clear: both;
          }
          .wf_customMessageBox {
            font-family: inherit !important;
            border-radius: 8px !important;
            border: 1px solid #86EFAC !important;
            background: #F0FDF4 !important;
            color: #166534 !important;
            font-weight: 600 !important;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1) !important;
          }
        </style>
      </head>
      <body>
        <script id="formScript1342119000000720001" src="https://crm.zoho.in/crm/WebFormServeServlet?rid=8af476b9e19b7e820ceffad692c972d6afd84053ee9027f03d57dc082ea5023fe26deb83a12112fc479fdd98fc536995gidac9e77d66d303eda7b8c03e411bc516bcbf80b06e3f5c6ba9fb5e96949defd20&script=$sYG"></script>
      </body>
      </html>
    `;

    doc.open();
    doc.write(htmlContent);
    doc.close();

    // Dynamically adjust iframe height to exact form content
    const updateHeight = () => {
      try {
        const formEl = doc.getElementById("crmWebToEntityForm") || doc.querySelector("form");
        if (formEl) {
          const boundingHeight = Math.ceil(formEl.getBoundingClientRect().height);
          const computedHeight = Math.max(boundingHeight, formEl.offsetHeight);
          if (computedHeight > 150) {
            setIframeHeight(computedHeight + 10);
          }
        }
      } catch (e) {}
    };

    const interval = setInterval(updateHeight, 300);
    const timeout = setTimeout(() => clearInterval(interval), 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  return (
    <iframe
      ref={iframeRef}
      title="Zoho Partner Registration Form"
      style={{
        width: "100%",
        height: `${iframeHeight}px`,
        border: "none",
        overflow: "hidden",
        display: "block",
        transition: "height 0.2s ease",
      }}
      scrolling="no"
    />
  );
};

export default ZohoPartnerForm;
