const emailjs = require('@emailjs/browser');

const SERVICE_ID  = process.env.EMAILJS_SERVICE_ID  || 'service_empay';
const TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID || 'template_empay';
const PUBLIC_KEY  = process.env.EMAILJS_PUBLIC_KEY  || '';

/**
 * Send employee credentials email via EmailJS.
 * Template variables: to_name, to_email, login_id, password, company_name
 */
async function sendCredentialsEmail({ toName, toEmail, loginId, password }) {
  if (!PUBLIC_KEY) {
    console.warn('EmailJS not configured. Add EMAILJS_PUBLIC_KEY to .env');
    return { success: false, reason: 'not_configured' };
  }
  try {
    // Note: EmailJS is a client-side library. Using it on the backend is
    // unconventional but possible. The 'send' method makes an HTTP request.
    await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID,
      {
        to_name:      toName,
        to_email:     toEmail,
        login_id:     loginId,
        password:     password,
        company_name: 'EmPay HRMS',
      },
      {
        publicKey: PUBLIC_KEY,
        // The private key is optional but recommended for server-side calls
        // to authenticate requests without exposing the public key.
        // privateKey: process.env.EMAILJS_PRIVATE_KEY 
      }
    );
    console.log('Credentials email sent to:', toEmail);
    return { success: true };
  } catch (err) {
    console.error('EmailJS error:', err);
    return { success: false, reason: err?.text || 'unknown' };
  }
}

module.exports = { sendCredentialsEmail };
