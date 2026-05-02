import emailjs from '@emailjs/browser';

const SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID  || 'service_empay';
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || 'template_empay';
const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY  || '';

/**
 * Send employee credentials email via EmailJS.
 * Template variables: to_name, to_email, login_id, password, company_name
 */
export async function sendCredentialsEmail({ toName, toEmail, loginId, password }) {
  if (!PUBLIC_KEY) {
    console.warn('EmailJS not configured. Add VITE_EMAILJS_PUBLIC_KEY to .env');
    return { success: false, reason: 'not_configured' };
  }
  try {
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
      PUBLIC_KEY
    );
    return { success: true };
  } catch (err) {
    console.error('EmailJS error:', err);
    return { success: false, reason: err?.text || 'unknown' };
  }
}
