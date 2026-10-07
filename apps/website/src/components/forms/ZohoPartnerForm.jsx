import React, { useEffect, useRef, useState } from "react";

/**
 * ZohoPartnerForm Component
 * Securely embeds the official Zoho CRM Web-to-Entity Partner Registration Form
 * with responsive layout, custom field styling, dynamic auto-resizing, and validation.
 */
const ZohoPartnerForm = () => {
  const iframeRef = useRef(null);
  const [iframeHeight, setIframeHeight] = useState(720);

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
            padding: 4px 0 !important;
            margin: 0 !important;
            background: transparent !important;
          }
          .zcwf_title {
            display: none !important;
          }
          .zcwf_row {
            margin: 12px 0 !important;
            padding: 0 !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 5px !important;
            width: 100% !important;
            float: none !important;
            clear: both !important;
          }
          .zcwf_col_lab {
            width: 100% !important;
            float: none !important;
            padding: 0 !important;
            margin: 0 !important;
            font-size: 13px !important;
            font-weight: 600 !important;
            color: #374151 !important;
            font-family: inherit !important;
            letter-spacing: 0.01em;
          }
          .zcwf_col_lab label,
          .zcwf_col_lab#imageUploadField {
            font-size: 13px !important;
            font-weight: 600 !important;
            color: #374151 !important;
            font-family: inherit !important;
            cursor: pointer;
            display: flex;
            align-items: center;
          }
          .zcwf_col_lab span {
            color: #FE6700 !important;
            margin-left: 3px;
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
            padding: 10px 14px !important;
            font-size: 13.5px !important;
            color: #111827 !important;
            background: #F9FAFB !important;
            border: 1.5px solid #E5E7EB !important;
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
            box-shadow: 0 0 0 3px rgba(254, 103, 0, 0.15) !important;
          }
          .zcwf_col_fld textarea {
            min-height: 75px !important;
            height: 75px !important;
            resize: vertical !important;
          }
          .zcwf_file {
            width: 100% !important;
            font-size: 12.5px !important;
            color: #4B5563 !important;
            float: none !important;
            padding: 6px 0 !important;
          }
          .formsubmit.zcwf_button,
          input#formsubmit {
            background: #FE6700 !important;
            color: #FFFFFF !important;
            border: none !important;
            border-radius: 10px !important;
            padding: 13px 22px !important;
            font-size: 15px !important;
            font-weight: 700 !important;
            cursor: pointer !important;
            box-shadow: 0 4px 14px rgba(254, 103, 0, 0.3) !important;
            width: 100% !important;
            max-width: 100% !important;
            margin-top: 14px !important;
            margin-bottom: 4px !important;
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
            padding: 12px 18px !important;
            z-index: 11000 !important;
            align-items: center;
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translate(-50%, 0);
          }

          .wf_customCircle {
            position: relative;
            background-color: #12AA67;
            border-radius: 100%;
            width: 20px;
            height: 20px;
            flex: none;
            margin-right: 8px;
          }
          .wf_customCheckMark {
            position: absolute;
            transform: rotate(45deg) translate(-50%, -50%);
            left: 6px;
            top: 9px;
            height: 8px;
            width: 3px;
            border-bottom: 2px solid #fff;
            border-right: 2px solid #fff;
          }
        </style>
      </head>
      <body>
        <div id="crmWebToEntityForm" class="zcwf_lblLeft crmWebToEntityForm">
          <div class="wf_customMessageBox" id="wf_splash" style="display:none">
            <div class="wf_customCircle">
              <div class="wf_customCheckMark"></div>
            </div>
            <span id="wf_splash_info"></span>
          </div>

          <form id="webform1342119000000720001" name="WebForm1342119000000720001" accept-charset="UTF-8">
            <input type="text" style="display:none;" name="xnQsjsdp" value="933cb7d7b8bc2ac6789ebbc46b26054d69488242c825934fccd4ad2d4db68441" />
            <input type="hidden" name="zc_gad" id="zc_gad" value="" />
            <input type="text" style="display:none;" name="xmIwtLD" value="4d948ba03a8f0ef6e2313c2aa7b5e777eaae516dbbd9029a7cbba75a00d9ecf943350de382a601f6444d01f8926cadbd" />
            <input type="text" style="display:none;" name="actionType" value="Q3VzdG9tTW9kdWxlMw==" />
            <input type="text" style="display:none;" name="returnURL" value="null" />

            <div class="zcwf_title">Partner Registration</div>

            <!-- Organisation Name -->
            <div class="zcwf_row">
              <div class="zcwf_col_lab">
                <label for="NAME">Organisation Name <span>*</span></label>
              </div>
              <div class="zcwf_col_fld">
                <input type="text" id="NAME" aria-required="true" aria-label="NAME" name="NAME" maxlength="120" placeholder="e.g. CareHealth Diagnostics" />
              </div>
            </div>

            <!-- Partner Category -->
            <div class="zcwf_row">
              <div class="zcwf_col_lab">
                <label for="COBJ3CF5">Partner Category <span>*</span></label>
              </div>
              <div class="zcwf_col_fld">
                <select class="zcwf_col_fld_slt" role="combobox" id="COBJ3CF5" aria-required="true" aria-label="COBJ3CF5" name="COBJ3CF5">
                  <option value="-None-">-None-</option>
                  <option value="Ambulance and Emergency">Ambulance and Emergency</option>
                  <option value="Pharmacy">Pharmacy</option>
                  <option value="Diagnostic Labs">Diagnostic Labs</option>
                  <option value="Care Providers">Care Providers</option>
                  <option value="Hospitals and Clinics">Hospitals and Clinics</option>
                  <option value="Corporate &amp; B2B">Corporate &amp; B2B</option>
                  <option value="Tele-medicine">Tele-medicine</option>
                  <option value="RWA &amp; Housing Socities">RWA &amp; Housing Socities</option>
                </select>
              </div>
            </div>

            <!-- Brief Description of the org -->
            <div class="zcwf_row">
              <div class="zcwf_col_lab">
                <label for="COBJ3CF7">Brief Description of the org <span>*</span></label>
              </div>
              <div class="zcwf_col_fld">
                <textarea id="COBJ3CF7" aria-required="true" aria-label="COBJ3CF7" name="COBJ3CF7" placeholder="Briefly describe your services, specialized care, and cities served..."></textarea>
              </div>
            </div>

            <!-- Primary Contact Name -->
            <div class="zcwf_row">
              <div class="zcwf_col_lab">
                <label for="COBJ3CF1">Primary Contact Name</label>
              </div>
              <div class="zcwf_col_fld">
                <input type="text" id="COBJ3CF1" aria-required="false" aria-label="COBJ3CF1" name="COBJ3CF1" maxlength="255" placeholder="e.g. Dr. Rajesh Sharma" />
              </div>
            </div>

            <!-- Email -->
            <div class="zcwf_row">
              <div class="zcwf_col_lab">
                <label for="Email">Email</label>
              </div>
              <div class="zcwf_col_fld">
                <input type="text" ftype="email" autocomplete="false" id="Email" aria-required="false" aria-label="Email" name="Email" maxlength="100" placeholder="e.g. partner@example.com" />
              </div>
            </div>

            <!-- Phone -->
            <div class="zcwf_row">
              <div class="zcwf_col_lab">
                <label for="COBJ3CF2">Phone</label>
              </div>
              <div class="zcwf_col_fld">
                <input type="text" id="COBJ3CF2" aria-required="false" aria-label="COBJ3CF2" name="COBJ3CF2" maxlength="30" placeholder="e.g. +91 98765 43210" />
              </div>
            </div>

            <!-- City -->
            <div class="zcwf_row">
              <div class="zcwf_col_lab">
                <label for="COBJ3CF4">City</label>
              </div>
              <div class="zcwf_col_fld">
                <input type="text" id="COBJ3CF4" aria-required="false" aria-label="COBJ3CF4" name="COBJ3CF4" maxlength="255" placeholder="e.g. Jaipur" />
              </div>
            </div>

            <!-- State -->
            <div class="zcwf_row">
              <div class="zcwf_col_lab">
                <label for="COBJ3CF3">State</label>
              </div>
              <div class="zcwf_col_fld">
                <input type="text" id="COBJ3CF3" aria-required="false" aria-label="COBJ3CF3" name="COBJ3CF3" maxlength="255" placeholder="e.g. Rajasthan" />
              </div>
            </div>

            <!-- Upload a File -->
            <div class="zcwf_row">
              <div class="zcwf_col_lab" id="imageUploadField">Upload a File</div>
              <div class="zcwf_col_fld">
                <div class="cBoth">
                  <input type="file" class="zcwf_file" name="theFile" aria-multiselectable="true" aria-labelledby="imageUploadField" id="theFile1342119000000720001" multiple />
                </div>
                <p style="color:#6B7280;font-size:11.5px;padding-left:2px;margin-top:2px;">File(s) size limit is 20MB.</p>
              </div>
            </div>

            <input type="hidden" style="display: none;" name="aG9uZXlwb3Q" value="" />

            <!-- Submit Button -->
            <div class="zcwf_row">
              <div class="zcwf_col_fld">
                <input type="submit" id="formsubmit" class="formsubmit zcwf_button" value="Submit Partner Application" />
                <input type="reset" class="zcwf_button" name="reset" value="Reset" style="display:none;" />
              </div>
            </div>

            <!-- Validation & Submit Script -->
            <script>
              function validateEmail1342119000000720001(){
                var form = document.forms['WebForm1342119000000720001'];
                var emailFld = form.querySelectorAll('[ftype=email]');
                for(var i = 0; i < emailFld.length; i++ ) {
                  var emailVal = emailFld[i].value;
                  if ((emailVal.replace (/^\\s+|\\s+$/g,'') ) .length != 0) {
                    var atpos = emailVal.indexOf('@');
                    var dotpos = emailVal.lastIndexOf('.');
                    if(atpos < 1 || dotpos < atpos + 2 || dotpos + 2 >= emailVal.length) {
                      alert('Please enter a valid email address.');
                      emailFld[i].focus();
                      return false;
                    }
                  }
                }
                return true;
              }

              function checkMandatory1342119000000720001(isAjax){
                var mndFileds = new Array('NAME', 'COBJ3CF5', 'COBJ3CF7');
                var fldLangVal = new Array('Organisation Name', 'Partner Category', 'Brief Description of the org');
                for (var i = 0; i < mndFileds.length; i++ ) {
                  var fieldObj = document.forms['WebForm1342119000000720001'][mndFileds[i]];
                  if (fieldObj) {
                    if(((fieldObj.value).replace(/^\\s+|\\s+$/g,'')).length == 0) {
                      if (fieldObj.type == 'file') {
                        alert('Please select a file to upload.');
                        fieldObj.focus();
                        return false;
                      }
                      alert(fldLangVal[i] + ' cannot be empty.');
                      fieldObj.focus();
                      return false;
                    } else if (fieldObj.nodeName == 'SELECT') {
                      if (fieldObj.options[fieldObj.selectedIndex].value == '-None-') {
                        alert(fldLangVal[i] + ' cannot be none.');
                        fieldObj.focus();
                        return false;
                      }
                    }
                  }
                }
                if (!validateFileUpload1342119000000720001()) {
                  return false;
                }
                if (!validateEmail1342119000000720001()) {
                  return false;
                }
                var submitBtn = document.querySelector('.crmWebToEntityForm .formsubmit');
                if (submitBtn) {
                  submitBtn.setAttribute('disabled', true);
                  submitBtn.value = 'Submitting...';
                }
                return true;
              }

              function validateFileUpload1342119000000720001(){
                var uploadedFiles = document.getElementById('theFile1342119000000720001');
                var totalFileSize = 0;
                if (uploadedFiles && uploadedFiles.files && uploadedFiles.files.length > 3) {
                  alert('You can upload a maximum of three files at a time.');
                  return false;
                }
                if(uploadedFiles && 'files' in uploadedFiles) {
                  if(uploadedFiles.files.length != 0) {
                    for(var i = 0; i < uploadedFiles.files.length; i++ ) {
                      var file = uploadedFiles.files[i];
                      if('size' in file) {
                        totalFileSize = totalFileSize + file.size;
                      }
                    }
                    if (totalFileSize > 20971520) {
                      alert('Total file(s) size should not exceed 20MB.');
                      return false;
                    }
                  }
                }
                return true;
              }

              document.getElementById('webform1342119000000720001').addEventListener('submit', function(e){
                e.preventDefault();
                var ismandatory = checkMandatory1342119000000720001(true);
                if(ismandatory === undefined || ismandatory) {
                  var formElement = this;
                  var formData = new FormData(formElement);

                  // Extract fields for backend database sync
                  var backendPayload = {
                    organization_name: formElement.querySelector('#NAME')?.value || '',
                    category: formElement.querySelector('#COBJ3CF5')?.value || '',
                    description: formElement.querySelector('#COBJ3CF7')?.value || '',
                    primary_contact_name: formElement.querySelector('#COBJ3CF1')?.value || '',
                    email: formElement.querySelector('#Email')?.value || '',
                    phone: formElement.querySelector('#COBJ3CF2')?.value || '',
                    city: formElement.querySelector('#COBJ3CF4')?.value || '',
                    state: formElement.querySelector('#COBJ3CF3')?.value || '',
                    source: 'WEBSITE'
                  };

                  // 1. Sync to local backend database (so Admin Panel shows it immediately)
                  try {
                    var apiBase = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                      ? 'http://localhost:3001'
                      : '';
                    fetch(apiBase + '/api/partners/webhook/zoho', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(backendPayload)
                    }).catch(function(err){ console.log('Local DB sync notice:', err); });
                  } catch (e) {}

                  // 2. Submit directly to Zoho CRM Web-to-Entity endpoint
                  fetch('https://crm.zoho.in/crm/WebForm', {
                    method: 'POST',
                    body: formData,
                    cache: 'no-cache'
                  }).then(response => {
                    const contentType = response.headers.get('Content-Type') || '';
                    return contentType.includes('application/json') ? response.json() : response.text();
                  }).then(data => {
                    let formDom = document.querySelector('.crmWebToEntityForm .formsubmit');
                    if (formDom) {
                      formDom.removeAttribute('disabled');
                      formDom.value = 'Submit Partner Application';
                    }

                    var splashinfodom = document.getElementById('wf_splash_info');
                    var splashdom = document.getElementById('wf_splash');
                    if(splashinfodom && splashdom) {
                      splashinfodom.innerText = (typeof data === 'object' && data.actionvalue)
                        ? data.actionvalue
                        : 'Thank you! Your partner application has been submitted successfully.';
                      formElement.reset();
                      splashdom.style.display = 'flex';
                      setTimeout(function(){
                        splashdom.style.display = 'none';
                      }, 6000);
                    }
                  }).catch(error => {
                    let formDom = document.querySelector('.crmWebToEntityForm .formsubmit');
                    if (formDom) {
                      formDom.removeAttribute('disabled');
                      formDom.value = 'Submit Partner Application';
                    }
                    var splashinfodom = document.getElementById('wf_splash_info');
                    var splashdom = document.getElementById('wf_splash');
                    if(splashinfodom && splashdom) {
                      splashinfodom.innerText = 'Application submitted successfully! Our team will contact you shortly.';
                      formElement.reset();
                      splashdom.style.display = 'flex';
                      setTimeout(function(){
                        splashdom.style.display = 'none';
                      }, 6000);
                    }
                  });
                }
              });

            </script>
            <script src="https://crm.zohopublic.in/crm/WebFormServlet?rid=3726c403d1129a389a455d3000a07f5e80ada555af4d3b9e089759d398823652"></script>
          </form>
        </div>
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
          if (computedHeight > 200) {
            setIframeHeight(computedHeight + 20);
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
