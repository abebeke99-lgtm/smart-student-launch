const dotenv = require("dotenv");
const nodemailer = require("nodemailer");

dotenv.config();

const main = async () => {
  const host = String(process.env.SMTP_HOST || "").trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = String(process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || "").trim();

  if (!host || !user || !pass || !Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(
      "SMTP configuration is incomplete. Set valid SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS environment variables.",
    );
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user, pass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 15000,
    tls: { rejectUnauthorized: false },
  });

  try {
    await transporter.verify();
    console.log("SMTP credentials and server connection verified successfully.");
    const result = await transporter.sendMail({
      from: process.env.SMTP_FROM || user,
      to: user,
      subject: "IPES SMTP diagnostic test",
      text: "This is a test email confirming SMTP delivery for the Instructor Performance Evaluation System.",
    });
    console.log("Test email sent successfully.", {
      messageId: result.messageId,
      accepted: result.accepted,
    });
  } finally {
    transporter.close();
  }
};

main().catch((error) => {
  console.error("SMTP diagnostic failed:", error.stack || error);
  process.exitCode = 1;
});
