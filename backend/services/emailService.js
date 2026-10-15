const { Resend } = require("resend");
const nodemailer = require("nodemailer");

const getResendClient = () => {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) {
    const error = new Error("RESEND_API_KEY is not configured.");
    error.code = "EMAIL_PROVIDER_NOT_CONFIGURED";
    throw error;
  }
  return new Resend(apiKey);
};

const sendWithResend = async ({ to, replyTo, subject, text, html }) => {
  const resend = getResendClient();
  const sender = String(process.env.RESEND_FROM || "").trim();
  if (!sender) {
    const error = new Error(
      "RESEND_FROM is not configured. Verify a sending domain in Resend and set RESEND_FROM to an address on that domain.",
    );
    error.code = "EMAIL_SENDER_NOT_CONFIGURED";
    throw error;
  }

  const { data, error } = await resend.emails.send({
    from: sender,
    to: Array.isArray(to) ? to : [to],
    ...(replyTo ? { replyTo } : {}),
    subject,
    text,
    ...(html ? { html } : {}),
  });

  if (error) {
    const deliveryError = new Error(error.message || "Resend email delivery failed.");
    deliveryError.code = error.name || "EMAIL_DELIVERY_FAILED";
    deliveryError.details = error;
    throw deliveryError;
  }

  return data;
};

const sendWithSmtp = async ({ to, replyTo, subject, text, html }) => {
  const host = String(process.env.SMTP_HOST || "").trim();
  const user = String(process.env.SMTP_USER || "").trim();
  const password = String(process.env.SMTP_PASS || "").trim();
  const port = Number(process.env.SMTP_PORT) || 587;

  if (!host || !user || !password) {
    const missingSettings = [
      ["SMTP_HOST", host],
      ["SMTP_USER", user],
      ["SMTP_PASS", password],
    ]
      .filter(([, value]) => !value)
      .map(([name]) => name);
    const error = new Error(
      `${missingSettings.join(", ")} ${missingSettings.length === 1 ? "is" : "are"} required for SMTP email delivery.`,
    );
    error.code = "EMAIL_PROVIDER_NOT_CONFIGURED";
    throw error;
  }

  const secureValue = String(process.env.SMTP_SECURE || "").trim().toLowerCase();
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: secureValue ? ["true", "1", "yes"].includes(secureValue) : port === 465,
    auth: { user, pass: password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });

  return transporter.sendMail({
    from: String(process.env.SMTP_FROM || user).trim(),
    to,
    ...(replyTo ? { replyTo } : {}),
    subject,
    text,
    ...(html ? { html } : {}),
  });
};

const getConfiguredProvider = () => {
  const configuredProvider = String(
    process.env.EMAIL_PROVIDER || process.env.EMAIL_SERVICE || "",
  )
    .trim()
    .toLowerCase();

  const smtpConfigured = [
    process.env.SMTP_HOST,
    process.env.SMTP_USER,
    process.env.SMTP_PASS,
  ].every((value) => String(value || "").trim());
  const resendConfigured =
    String(process.env.RESEND_API_KEY || "").trim() &&
    String(process.env.RESEND_FROM || "").trim();

  if (
    (configuredProvider === "smtp" || configuredProvider === "gmail") &&
    smtpConfigured
  ) {
    return configuredProvider;
  }
  if (configuredProvider === "resend" && resendConfigured) {
    return "resend";
  }

  if (smtpConfigured) {
    if (configuredProvider && configuredProvider !== "smtp" && configuredProvider !== "gmail") {
      console.warn(
        `Configured email provider "${configuredProvider}" is incomplete; using configured SMTP instead.`,
      );
    }
    return "smtp";
  }
  if (resendConfigured) {
    if (configuredProvider && configuredProvider !== "resend") {
      console.warn(
        `Configured email provider "${configuredProvider}" is incomplete; using configured Resend instead.`,
      );
    }
    return "resend";
  }

  return configuredProvider || "resend";
};

const sendWithConfiguredProvider = (message) => {
  const provider = getConfiguredProvider();

  if (provider === "smtp" || provider === "gmail") {
    return sendWithSmtp(message);
  }
  if (provider === "resend") {
    return sendWithResend(message);
  }

  const error = new Error(`Unsupported email provider: ${provider}`);
  error.code = "EMAIL_PROVIDER_NOT_CONFIGURED";
  throw error;
};

const isNetworkConnectionError = (error) =>
  ["ENETUNREACH", "ETIMEDOUT", "ECONNECTION", "ESOCKET"].includes(
    String(error?.code || "").toUpperCase(),
  ) ||
  ["ENETUNREACH", "ETIMEDOUT"].includes(
    String(error?.errno || "").toUpperCase(),
  ) ||
  /(?:ENETUNREACH|ETIMEDOUT|connection timeout|timed? ?out|network unreachable)/i.test(
    String(error?.message || ""),
  );

const sendWithFallback = async (message) => {
  try {
    return await sendWithConfiguredProvider(message);
  } catch (error) {
    const provider = getConfiguredProvider();
    const canFallbackToResend =
      (provider === "smtp" || provider === "gmail") &&
      isNetworkConnectionError(error) &&
      String(process.env.RESEND_API_KEY || "").trim() &&
      String(process.env.RESEND_FROM || "").trim();

    if (canFallbackToResend) {
      console.warn("SMTP network connection failed; retrying email through Resend.", {
        code: error?.code || error?.errno || "ENETUNREACH",
        message: error?.message,
      });
      try {
        return await sendWithResend(message);
      } catch (fallbackError) {
        console.error("Resend fallback email delivery failed.", {
          code: fallbackError?.code || "EMAIL_DELIVERY_FAILED",
          message: fallbackError?.message,
          smtpCode: error?.code,
          smtpMessage: error?.message,
        });
        throw fallbackError;
      }
    }

    throw error;
  }
};

const sendEmail = async (message) => {
  try {
    return await sendWithFallback(message);
  } catch (error) {
    console.error("Email delivery failed.", {
      code: error?.code || "EMAIL_DELIVERY_FAILED",
      message: error?.message,
      details: error?.details,
      stack: error?.stack,
    });
    throw error;
  }
};

const sendRecoveryEmail = async ({
  toEmail,
  to,
  code,
  expiresInMinutes = 15,
}) => {
  try {
    const recipientEmail = String(toEmail ?? to ?? "").trim();
    if (!/^\d{6}$/.test(String(code || ""))) {
      throw new Error("Password recovery code must be exactly 6 digits.");
    }
    if (
      recipientEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)
    ) {
      throw new Error("Password recovery recipient must be a valid email address.");
    }

    const subject = "Your IPES password recovery code";
    const text = [
      "Instructor Performance Evaluation System (IPES) - Mekdela Amba University",
      "",
      `Your password recovery verification code is: ${code}`,
      `This code expires in ${expiresInMinutes} minutes.`,
      "If you did not request a password reset, you can ignore this email.",
    ].join("\n");
    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Instructor Performance Evaluation System (IPES) - Mekdela Amba University</title>
  </head>
  <body style="margin:0;padding:24px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#1e293b">
    <table role="presentation" style="width:100%;max-width:600px;margin:0 auto;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden">
      <tr><td style="padding:28px 32px;background:#1e3a8a;color:#fff">
        <h1 style="margin:0;font-size:21px;line-height:1.4">Instructor Performance Evaluation System (IPES)</h1>
        <p style="margin:6px 0 0;font-size:14px;color:#dbeafe">Mekdela Amba University</p>
      </td></tr>
      <tr><td style="padding:32px">
        <h2 style="margin:0 0 12px;font-size:20px">Password recovery</h2>
        <p style="margin:0 0 22px;line-height:1.6">Use the verification code below to continue resetting your password.</p>
        <div style="margin:0 auto 22px;padding:18px 24px;max-width:260px;border:1px solid #bfdbfe;border-radius:10px;background:#eff6ff;text-align:center">
          <span style="display:block;color:#475569;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase">Verification code</span>
          <strong style="display:block;margin-top:8px;color:#1d4ed8;font-size:34px;letter-spacing:8px">${code}</strong>
        </div>
        <p style="margin:0 0 10px;line-height:1.6">This code expires in <strong>${expiresInMinutes} minutes</strong>.</p>
        <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6">If you did not request a password reset, you can ignore this email.</p>
      </td></tr>
      <tr><td style="padding:16px 32px;background:#f8fafc;color:#64748b;font-size:12px">Mekdela Amba University · IPES</td></tr>
    </table>
  </body>
</html>`;

    return await sendWithFallback({
      to: recipientEmail,
      subject,
      text,
      html,
    });
  } catch (error) {
    if (error instanceof Error && !error.code) {
      error.code = "EMAIL_DELIVERY_FAILED";
    }
    console.error("Password recovery email delivery failed.", {
      code: error?.code || "EMAIL_DELIVERY_FAILED",
    });
    throw error;
  }
};

const sendPasswordResetEmail = async ({
  toEmail,
  resetUrl,
  expiresInMinutes = 15,
}) => {
  const recipientEmail = String(toEmail || "").trim();
  if (
    recipientEmail.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)
  ) {
    throw new Error("Password recovery recipient must be a valid email address.");
  }
  if (!/^https?:\/\/\S+$/i.test(String(resetUrl || ""))) {
    throw new Error("Password recovery URL must be a valid HTTP(S) URL.");
  }

  const subject = "Reset your IPES password";
  const escapedResetUrl = String(resetUrl).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
  const text = [
    "Instructor Performance Evaluation System (IPES) - Mekdela Amba University",
    "",
    "A password reset was requested for your account.",
    `Reset your password using this link: ${resetUrl}`,
    `This link expires in ${expiresInMinutes} minutes.`,
    "If you did not request a password reset, you can ignore this email.",
  ].join("\n");
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Reset your IPES password</title>
  </head>
  <body style="margin:0;padding:24px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#1e293b">
    <table role="presentation" style="width:100%;max-width:600px;margin:0 auto;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden">
      <tr><td style="padding:28px 32px;background:#1e3a8a;color:#fff">
        <h1 style="margin:0;font-size:21px;line-height:1.4">Instructor Performance Evaluation System (IPES)</h1>
        <p style="margin:6px 0 0;font-size:14px;color:#dbeafe">Mekdela Amba University</p>
      </td></tr>
      <tr><td style="padding:32px">
        <h2 style="margin:0 0 12px;font-size:20px">Password recovery</h2>
        <p style="margin:0 0 22px;line-height:1.6">Use the link below to set a new password. It expires in ${expiresInMinutes} minutes.</p>
        <p style="margin:0 0 22px"><a href="${escapedResetUrl}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#1d4ed8;color:#fff;text-decoration:none;font-weight:700">Reset password</a></p>
        <p style="margin:0 0 10px;color:#64748b;font-size:13px;line-height:1.6">If the button does not work, copy and paste this address into your browser:</p>
        <p style="margin:0 0 22px;word-break:break-all;font-size:13px"><a href="${escapedResetUrl}" style="color:#1d4ed8">${escapedResetUrl}</a></p>
        <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6">If you did not request a password reset, you can ignore this email.</p>
      </td></tr>
      <tr><td style="padding:16px 32px;background:#f8fafc;color:#64748b;font-size:12px">Mekdela Amba University · IPES</td></tr>
    </table>
  </body>
</html>`;

  return sendWithFallback({
    to: recipientEmail,
    subject,
    text,
    html,
  });
};

module.exports = { sendEmail, sendRecoveryEmail, sendPasswordResetEmail };
