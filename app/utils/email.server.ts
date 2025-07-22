// Email utility for handling contact form submissions
// Since Shopify doesn't provide email sending APIs for custom apps,
// you'll need to integrate with external email services.

interface ContactFormData {
  shop: string;
  name: string;
  email: string;
  subject: string;
  category: string;
  message: string;
  priority: string;
  timestamp: string;
}

// Configuration for different email services
interface EmailConfig {
  service: 'smtp' | 'sendgrid' | 'mailgun' | 'resend' | 'nodemailer';
  apiKey?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  fromEmail: string;
  toEmail: string;
}

/**
 * Send contact form email using external email service
 * 
 * To implement email sending, choose one of these options:
 * 
 * 1. SMTP (e.g., Gmail, Outlook, custom SMTP)
 * 2. SendGrid (popular email API service)
 * 3. Mailgun (email API service)
 * 4. Resend (modern email API)
 * 5. Nodemailer (flexible Node.js email library)
 * 
 * Example implementations:
 */

// Using Resend for email sending
export async function sendContactEmailWithResend(data: ContactFormData): Promise<boolean> {
  try {
    // Check if Resend API key is configured
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY environment variable is not set');
      // Log the data for development purposes
      console.log('📧 Contact form submission (Resend not configured):', {
        shop: data.shop,
        from: `${data.name} <${data.email}>`,
        subject: data.subject,
        category: data.category,
        priority: data.priority,
        timestamp: data.timestamp
      });
      return true; // Return true for development to avoid blocking the form
    }

    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Configure your support email addresses
    const supportEmail = process.env.SUPPORT_EMAIL || 'support@yourdomain.com';
    // Use Resend's default domain for sending (no custom domain verification needed)
    const fromEmail = process.env.FROM_EMAIL || 'support@resend.dev';

    const result = await resend.emails.send({
      from: `${data.name} via Shopify App <${fromEmail}>`,
      to: [supportEmail],
      subject: `[${data.priority.toUpperCase()}] Support Request: ${data.subject}`,
      html: generateEmailTemplate(data),
      replyTo: data.email, // This allows you to reply directly to the customer
      tags: [
        { name: 'category', value: data.category },
        { name: 'priority', value: data.priority },
        { name: 'shop', value: data.shop.replace(/[^a-zA-Z0-9_-]/g, '_') }
      ]
    });

    if (result.error) {
      console.error('Resend error:', result.error);
      return false;
    }

    console.log('✅ Email sent successfully via Resend:', {
      id: result.data?.id,
      to: supportEmail,
      subject: data.subject,
      shop: data.shop
    });

    return !!result.data?.id;
  } catch (error) {
    console.error('Failed to send email with Resend:', error);
    return false;
  }
}

// Example: Using SendGrid
export async function sendContactEmailWithSendGrid(data: ContactFormData): Promise<boolean> {
  try {
    // Uncomment and configure when ready to implement
    /*
    const sgMail = await import('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

    const msg = {
      to: 'support@yourdomain.com',
      from: 'noreply@yourdomain.com',
      subject: `Support Request: ${data.subject}`,
      html: generateEmailTemplate(data),
      replyTo: data.email,
    };

    await sgMail.send(msg);
    return true;
    */
    
    console.log('Contact form submission (SendGrid):', data);
    return true;
  } catch (error) {
    console.error('Failed to send email with SendGrid:', error);
    return false;
  }
}

// Example: Using Nodemailer with SMTP
export async function sendContactEmailWithSMTP(data: ContactFormData): Promise<boolean> {
  try {
    // Uncomment and configure when ready to implement
    /*
    const nodemailer = await import('nodemailer');
    
    const transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM_EMAIL,
      to: process.env.SUPPORT_EMAIL,
      subject: `Support Request: ${data.subject}`,
      html: generateEmailTemplate(data),
      replyTo: data.email,
    });

    return !!info.messageId;
    */
    
    console.log('Contact form submission (SMTP):', data);
    return true;
  } catch (error) {
    console.error('Failed to send email with SMTP:', error);
    return false;
  }
}

// Generate HTML email template
function generateEmailTemplate(data: ContactFormData): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Support Request</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { border-bottom: 2px solid #00a96e; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { color: #00a96e; margin: 0; font-size: 24px; }
        .field { margin-bottom: 20px; }
        .label { font-weight: bold; color: #333; display: block; margin-bottom: 5px; }
        .value { color: #666; background-color: #f8f9fa; padding: 10px; border-radius: 4px; border-left: 3px solid #00a96e; }
        .message-field { margin-top: 30px; }
        .message-field .value { white-space: pre-wrap; line-height: 1.6; }
        .priority { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
        .priority-high { background-color: #ff4757; color: white; }
        .priority-medium { background-color: #ffa726; color: white; }
        .priority-low { background-color: #26c6da; color: white; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #999; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎯 New Support Request</h1>
        </div>
        
        <div class="field">
          <span class="label">Shop:</span>
          <div class="value">${data.shop}</div>
        </div>
        
        <div class="field">
          <span class="label">Customer Name:</span>
          <div class="value">${data.name}</div>
        </div>
        
        <div class="field">
          <span class="label">Email:</span>
          <div class="value">${data.email}</div>
        </div>
        
        <div class="field">
          <span class="label">Subject:</span>
          <div class="value">${data.subject}</div>
        </div>
        
        <div class="field">
          <span class="label">Category:</span>
          <div class="value">${data.category}</div>
        </div>
        
        <div class="field">
          <span class="label">Priority:</span>
          <div class="value">
            <span class="priority priority-${data.priority}">${data.priority}</span>
          </div>
        </div>
        
        <div class="message-field">
          <span class="label">Message:</span>
          <div class="value">${data.message}</div>
        </div>
        
        <div class="footer">
          <p>Submitted on: ${new Date(data.timestamp).toLocaleString()}</p>
          <p>This email was generated automatically from your Shopify app support form.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Main function to send contact form email (uses Resend)
export async function sendContactFormEmail(data: ContactFormData): Promise<boolean> {
  return await sendContactEmailWithResend(data);
}

/**
 * Resend Setup Instructions (No Custom Domain Required):
 * 
 * 1. Install Resend package: ✅ DONE
 *    npm install resend
 * 
 * 2. Get your Resend API key: ✅ DONE
 *    - Sign up at https://resend.com
 *    - Go to API Keys in your dashboard
 *    - Create a new API key
 * 
 * 3. Set environment variables in your .env file:
 *    RESEND_API_KEY=your_actual_api_key_here ✅ DONE
 *    SUPPORT_EMAIL=your-actual-email@gmail.com (where you want to receive inquiries)
 *    FROM_EMAIL=support@resend.dev (optional - uses Resend's default domain)
 * 
 * 4. Update SUPPORT_EMAIL:
 *    - Change "support@yourdomain.com" to your actual email address
 *    - This is where customer inquiries will be sent
 *    - You can reply directly to customers (their email is set as reply-to)
 * 
 * 5. Test your setup:
 *    - Submit a test message through the contact form
 *    - Check your email inbox and Resend dashboard
 * 
 * Benefits of this approach:
 * - No domain verification needed
 * - Works immediately with any email address
 * - Customers can reply directly to their original inquiry
 * - Emails show customer name and "via Shopify App" for context
 */ 