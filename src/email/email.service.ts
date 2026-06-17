import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class EmailService {
  private transporter: Transporter;
  private readonly logger = new Logger(EmailService.name);
  private readonly fromName = 'ActiveBoost';
  private readonly fromEmail: string;

  constructor(private configService: ConfigService) {
    this.fromEmail = this.configService.get<string>('SMTP_USER', 'activeboost8@gmail.com');

    const smtpPort = this.configService.get<number>('SMTP_PORT', 587);
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST', 'smtp.gmail.com'),
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: this.fromEmail,
        pass: this.configService.get<string>('SMTP_PASS'),
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });
  }

  async sendMail(options: SendMailOptions): Promise<boolean> {
    try {
      const info = await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });
      this.logger.log(`Email sent to ${options.to}: ${info.messageId}`);
      return true;
    } catch (err) {
      this.logger.error(`Failed to send email to ${options.to}: ${err.message}`);
      return false;
    }
  }

  async sendOtpEmail(to: string, otp: string, purpose: string, name = 'Member'): Promise<boolean> {
    const purposeLabel = {
      EMAIL_VERIFICATION: 'Verify Your Email',
      LOGIN_2FA: 'Login Verification',
      PASSWORD_RESET: 'Reset Your Password',
      PHONE_VERIFICATION: 'Verify Your Phone',
    }[purpose] ?? 'OTP Verification';

    const purposeDesc = {
      EMAIL_VERIFICATION: 'Complete your account setup by verifying your email address.',
      LOGIN_2FA: 'Use this code to complete your login.',
      PASSWORD_RESET: 'Use this code to reset your ActiveBoost password.',
      PHONE_VERIFICATION: 'Use this code to verify your phone number.',
    }[purpose] ?? 'Use this code to verify your identity.';

    const html = this.getOtpEmailTemplate(name, otp, purposeLabel, purposeDesc);
    return this.sendMail({ to, subject: `${purposeLabel} — ${otp} is your ActiveBoost code`, html });
  }

  async sendWelcomeEmail(to: string, name: string, role: string): Promise<boolean> {
    const html = this.getWelcomeTemplate(name, role);
    return this.sendMail({ to, subject: `Welcome to ActiveBoost, ${name}!`, html });
  }

  async sendMembershipRenewalReminder(to: string, name: string, daysLeft: number, planType: string): Promise<boolean> {
    const html = this.getRenewalReminderTemplate(name, daysLeft, planType);
    return this.sendMail({ to, subject: `⏰ Your ${planType} membership expires in ${daysLeft} days`, html });
  }

  async sendPaymentConfirmation(to: string, name: string, amount: number, invoiceNo: string): Promise<boolean> {
    const html = this.getPaymentConfirmTemplate(name, amount, invoiceNo);
    return this.sendMail({ to, subject: `✅ Payment Confirmed — ${invoiceNo}`, html });
  }

  async sendAccountCreatedEmail(to: string, name: string, role: string, password: string, memberCode?: string): Promise<boolean> {
    const roleLabel: Record<string, string> = {
      SUPER_ADMIN: 'Super Administrator',
      GYM_ADMIN:   'Gym Administrator',
      TRAINER:     'Trainer',
      STAFF:       'Staff Member',
      MEMBER:      'Member',
    };
    const label = roleLabel[role] ?? 'Member';
    const loginUrl = this.configService.get('FRONTEND_URL', 'http://localhost:3000') + '/login';
    const memberIdRow = memberCode
      ? `<tr><td style="color:#666; padding:8px 0; border-top:1px solid #e8ecf0;">Member ID</td><td style="font-weight:900; font-family:monospace; font-size:16px; text-align:right; color:#059669;">${memberCode}</td></tr>`
      : '';
    const html = this.getEmailWrapper(`
      <h1>Your ActiveBoost Account is Ready 🎉</h1>
      <p>Hi <span class="highlight">${name}</span>,</p>
      <p>An administrator has created your <strong>ActiveBoost</strong> account with the role of <span class="badge">${label}</span>.</p>
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:24px; margin:20px 0;">
        <p style="font-size:13px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:1px; margin-bottom:12px;">Your Login Credentials</p>
        <table style="width:100%; font-size:15px; border-collapse:collapse;">
          <tr><td style="color:#666; padding:8px 0;">Email</td><td style="font-weight:700; text-align:right;">${to}</td></tr>
          <tr><td style="color:#666; padding:8px 0; border-top:1px solid #e8ecf0;">Password</td><td style="font-weight:700; font-family:monospace; font-size:17px; text-align:right; color:#ea580c;">${password}</td></tr>
          ${memberIdRow}
        </table>
      </div>
      <div class="alert-box">
        🔒 <strong>Important:</strong> Please change your password after your first login for security.
      </div>
      <div style="text-align:center; margin-top:28px;">
        <a href="${loginUrl}" class="btn">Login to Dashboard →</a>
      </div>
    `);
    return this.sendMail({ to, subject: `Your ActiveBoost ${label} account is ready`, html });
  }

  async sendPasswordChangedAlert(to: string, name: string): Promise<boolean> {
    const html = this.getPasswordChangedTemplate(name);
    return this.sendMail({ to, subject: '🔐 Your ActiveBoost password was changed', html });
  }

  // ─── Email Templates ────────────────────────────────────────────────────────

  private getEmailWrapper(content: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ActiveBoost</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f4f6f8; color: #1a1a2e; }
    .container { max-width: 580px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #f97316 0%, #ea580c 50%, #c2410c 100%); padding: 36px 40px; border-radius: 16px 16px 0 0; text-align: center; }
    .header-logo { display: inline-flex; align-items: center; gap: 10px; }
    .header-logo-icon { width: 44px; height: 44px; background: rgba(255,255,255,0.2); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; font-size: 22px; }
    .header-title { color: white; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
    .header-subtitle { color: rgba(255,255,255,0.85); font-size: 13px; margin-top: 4px; }
    .body { background: #ffffff; padding: 40px; border-left: 1px solid #e8ecf0; border-right: 1px solid #e8ecf0; }
    .footer { background: #f4f6f8; border: 1px solid #e8ecf0; border-top: none; border-radius: 0 0 16px 16px; padding: 24px 40px; text-align: center; }
    .footer p { color: #8a9ab0; font-size: 12px; line-height: 1.6; }
    .footer a { color: #f97316; text-decoration: none; }
    .btn { display: inline-block; padding: 14px 32px; border-radius: 10px; font-weight: 700; font-size: 15px; text-decoration: none; background: linear-gradient(135deg, #f97316, #ea580c); color: white; margin-top: 8px; }
    .otp-box { background: linear-gradient(135deg, #fff7ed, #fff0e0); border: 2px dashed #f97316; border-radius: 16px; padding: 28px; text-align: center; margin: 24px 0; }
    .otp-code { font-size: 48px; font-weight: 900; color: #ea580c; letter-spacing: 12px; font-family: 'Courier New', monospace; }
    .otp-expiry { color: #666; font-size: 13px; margin-top: 10px; }
    .divider { height: 1px; background: #e8ecf0; margin: 28px 0; }
    .alert-box { background: #fff3cd; border: 1px solid #ffc107; border-radius: 10px; padding: 14px 18px; font-size: 13px; color: #7d5a00; margin-top: 20px; }
    h1 { font-size: 24px; font-weight: 800; color: #1a1a2e; margin-bottom: 8px; }
    p { font-size: 15px; color: #4a5568; line-height: 1.7; margin-bottom: 12px; }
    .highlight { color: #f97316; font-weight: 700; }
    .badge { display: inline-block; background: #fff7ed; color: #ea580c; border: 1px solid #fed7aa; border-radius: 999px; padding: 4px 14px; font-size: 12px; font-weight: 600; }
  </style>
</head>
<body style="padding: 32px 16px;">
  <div class="container">
    <div class="header">
      <div class="header-logo">
        <div class="header-logo-icon">⚡</div>
        <span class="header-title">ActiveBoost</span>
      </div>
      <p class="header-subtitle">Premium Gym Management Platform</p>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      <p>© 2025 ActiveBoost. All rights reserved.<br/>
      This email was sent to you because an action was performed on your account.<br/>
      If you didn't request this, please <a href="mailto:activeboost8@gmail.com">contact support</a>.</p>
    </div>
  </div>
</body>
</html>`;
  }

  private getOtpEmailTemplate(name: string, otp: string, title: string, description: string): string {
    return this.getEmailWrapper(`
      <h1>${title}</h1>
      <p>Hi <span class="highlight">${name}</span>,</p>
      <p>${description}</p>
      <div class="otp-box">
        <p style="margin:0 0 8px; font-size:13px; font-weight:600; color:#666; text-transform:uppercase; letter-spacing:1px;">Your Verification Code</p>
        <div class="otp-code">${otp}</div>
        <p class="otp-expiry">⏰ This code expires in <strong>10 minutes</strong></p>
      </div>
      <div class="alert-box">
        🔒 <strong>Security Notice:</strong> Never share this code with anyone. ActiveBoost will never ask for your OTP via phone or chat.
      </div>
      <div class="divider"></div>
      <p style="font-size:13px; color:#8a9ab0;">If you didn't request this code, you can safely ignore this email. Your account is secure.</p>
    `);
  }

  private getWelcomeTemplate(name: string, role: string): string {
    const roleLabels: Record<string, string> = {
      SUPER_ADMIN: 'Super Administrator',
      GYM_ADMIN:   'Gym Administrator',
      TRAINER:     'Trainer',
      STAFF:       'Staff Member',
      MEMBER:      'Member',
    };
    const roleLabel = roleLabels[role] ?? 'Member';
    const bullets =
      role === 'MEMBER' ? `
        <li>Track your gym attendance with QR check-in</li>
        <li>Get AI-powered workout &amp; diet plans</li>
        <li>Shop for quality supplements</li>
        <li>Monitor your fitness progress</li>
      ` : role === 'GYM_ADMIN' ? `
        <li>Manage gym members &amp; memberships</li>
        <li>Track attendance with QR scanner</li>
        <li>Monitor revenue &amp; payments</li>
        <li>Manage trainers &amp; PT sessions</li>
      ` : role === 'TRAINER' ? `
        <li>View and manage your assigned members</li>
        <li>Schedule personal training sessions</li>
        <li>Create workout and diet plans</li>
      ` : role === 'STAFF' ? `
        <li>Scan QR codes for member check-in/out</li>
        <li>Manage daily attendance records</li>
        <li>Assist members at the front desk</li>
      ` : `
        <li>Oversee all gyms on the platform</li>
        <li>Manage subscriptions &amp; billing</li>
        <li>View platform-wide analytics</li>
      `;
    return this.getEmailWrapper(`
      <h1>Welcome to ActiveBoost! 🎉</h1>
      <p>Hi <span class="highlight">${name}</span>,</p>
      <p>You're now part of the <strong>ActiveBoost</strong> family! Your account has been created successfully with the role of <span class="badge">${roleLabel}</span>.</p>
      <div class="divider"></div>
      <p><strong>What you can do:</strong></p>
      <ul style="padding-left:20px; color:#4a5568; font-size:15px; line-height:2;">${bullets}</ul>
      <div style="text-align:center; margin-top:32px;">
        <a href="${this.configService.get('FRONTEND_URL', 'http://localhost:3000')}/login" class="btn">Login to Dashboard →</a>
      </div>
    `);
  }

  private getRenewalReminderTemplate(name: string, daysLeft: number, planType: string): string {
    const urgency = daysLeft <= 2 ? '🚨 Urgent: ' : daysLeft <= 7 ? '⏰ ' : '';
    return this.getEmailWrapper(`
      <h1>${urgency}Membership Expiring Soon</h1>
      <p>Hi <span class="highlight">${name}</span>,</p>
      <p>Your <strong>${planType}</strong> membership is expiring in <span class="highlight">${daysLeft} day${daysLeft === 1 ? '' : 's'}</span>. Don't let your fitness journey pause!</p>
      <div class="otp-box">
        <p style="font-size:36px; font-weight:900; color:#ea580c;">${daysLeft}</p>
        <p style="color:#666; font-weight:600;">days remaining</p>
      </div>
      <p>Renew now to:</p>
      <ul style="padding-left:20px; color:#4a5568; line-height:2;">
        <li>Continue uninterrupted gym access</li>
        <li>Keep your current membership benefits</li>
        <li>Maintain your streak and progress</li>
      </ul>
      <div style="text-align:center; margin-top:28px;">
        <a href="${this.configService.get('FRONTEND_URL', 'http://localhost:3000')}/user/membership" class="btn">Renew Membership →</a>
      </div>
    `);
  }

  private getPaymentConfirmTemplate(name: string, amount: number, invoiceNo: string, locale = 'en-IN'): string {
    // Currency stays INR (India-only) — only the digit-grouping/symbol-placement locale is parameterized.
    const formatted = new Intl.NumberFormat(locale, { style: 'currency', currency: 'INR' }).format(amount);
    return this.getEmailWrapper(`
      <h1>Payment Confirmed ✅</h1>
      <p>Hi <span class="highlight">${name}</span>,</p>
      <p>We've successfully received your payment. Here are the details:</p>
      <div style="background:#f8fffe; border:1px solid #d1fae5; border-radius:12px; padding:24px; margin:20px 0;">
        <table style="width:100%; font-size:15px; border-collapse:collapse;">
          <tr><td style="color:#666; padding:8px 0;">Invoice No.</td><td style="font-weight:700; text-align:right;">${invoiceNo}</td></tr>
          <tr><td style="color:#666; padding:8px 0; border-top:1px solid #e8ecf0;">Amount Paid</td><td style="font-weight:900; font-size:20px; color:#059669; text-align:right;">${formatted}</td></tr>
          <tr><td style="color:#666; padding:8px 0; border-top:1px solid #e8ecf0;">Status</td><td style="text-align:right;"><span style="background:#d1fae5; color:#059669; padding:4px 12px; border-radius:999px; font-size:13px; font-weight:700;">✅ PAID</span></td></tr>
        </table>
      </div>
      <p style="font-size:13px; color:#8a9ab0;">Keep this email as your payment receipt. You can also view all your invoices in the ActiveBoost app.</p>
    `);
  }

  private getPasswordChangedTemplate(name: string): string {
    return this.getEmailWrapper(`
      <h1>🔐 Password Changed</h1>
      <p>Hi <span class="highlight">${name}</span>,</p>
      <p>Your ActiveBoost account password was successfully changed.</p>
      <div class="alert-box" style="background:#fff0f0; border-color:#f87171; color:#991b1b;">
        ⚠️ <strong>Wasn't you?</strong> If you didn't change your password, your account may be compromised. Please contact support immediately.
      </div>
      <div style="text-align:center; margin-top:28px;">
        <a href="mailto:activeboost8@gmail.com" class="btn" style="background:linear-gradient(135deg,#ef4444,#dc2626);">Contact Support →</a>
      </div>
    `);
  }

  async sendWinbackEmail(to: string, firstName: string, gymName: string): Promise<boolean> {
    const html = this.getEmailWrapper(`
      <h1>💪 We Miss You, ${firstName}!</h1>
      <p>Hi <span class="highlight">${firstName}</span>,</p>
      <p>It's been a while since we've seen you at <strong>${gymName}</strong>. Your fitness journey matters to us, and we'd love to see you back!</p>
      <div class="alert-box" style="background:#f0fdf4; border-color:#86efac; color:#166534;">
        🎯 <strong>Your goals are waiting for you.</strong> Every workout counts — even a short session can restart your momentum.
      </div>
      <p style="margin-top:20px;">Log in to check your workout plan, track your progress, or book a session with your trainer.</p>
      <div style="text-align:center; margin-top:28px;">
        <a href="${this.configService.get('FRONTEND_URL', 'http://localhost:3000')}/user" class="btn">Get Back on Track →</a>
      </div>
      <p style="margin-top:24px; color:#6b7280; font-size:13px;">See you soon! 💪<br/>The ${gymName} Team</p>
    `);
    return this.sendMail({ to, subject: `${gymName} misses you! 💪 Come back & keep going`, html });
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      this.logger.log('SMTP connection verified successfully');
      return true;
    } catch (err) {
      this.logger.error(`SMTP verification failed: ${err.message}`);
      return false;
    }
  }
}
