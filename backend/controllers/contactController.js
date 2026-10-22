const pool = require("../config/db");
const { getSystemSetting, setSystemSetting } = require("../config/audit");
const { sendEmail } = require("../services/emailService");
const { isValidEmail } = require("../utils/inputValidation");

const getAdminContactSettings = async () => {
  const fallbackName = String(
    process.env.ADMIN_NAME || "Mekdela Amba University Admin",
  ).trim();
  const fallbackEmail = String(
    process.env.SMTP_TO ||
      process.env.ADMIN_EMAIL ||
      "enyihefikiradis@gmail.com",
  ).trim();
  const fallbackPhone = String(
    process.env.ADMIN_PHONE || "+251 332405111",
  ).trim();
  const fallbackLocation = String(
    process.env.ADMIN_LOCATION || "Gimba, Ethiopia",
  ).trim();

  const [
    name,
    email,
    phone,
    location,
    poBox,
    officeDays,
    officeHours,
    institution,
    region,
    landmark,
    mapQuery,
  ] = await Promise.all([
    getSystemSetting("admin_contact_name", fallbackName),
    getSystemSetting("admin_contact_email", fallbackEmail),
    getSystemSetting("admin_contact_phone", fallbackPhone),
    getSystemSetting("admin_contact_location", fallbackLocation),
    getSystemSetting("admin_contact_po_box", "P.O. Box 32"),
    getSystemSetting("admin_contact_office_days", "Mon-Fri"),
    getSystemSetting("admin_contact_office_hours", "9:00 AM - 5:00 PM"),
    getSystemSetting(
      "admin_contact_institution",
      "Mekdela Amba University (Main Campus - Tulu Awulia / Gimba)",
    ),
    getSystemSetting(
      "admin_contact_region",
      "Amhara Region, South Wollo, Ethiopia",
    ),
    getSystemSetting("admin_contact_landmark", "Near Gimba Masjid Al-Noor"),
    getSystemSetting(
      "admin_contact_map_query",
      "Mekdela Amba University Gimba Ethiopia",
    ),
  ]);

  return {
    name: String(name ?? fallbackName).trim(),
    email: String(email ?? fallbackEmail).trim(),
    phone: String(phone ?? fallbackPhone).trim(),
    location: String(location ?? fallbackLocation).trim(),
    poBox: String(poBox ?? "P.O. Box 32").trim(),
    officeDays: String(officeDays ?? "Mon-Fri").trim(),
    officeHours: String(officeHours ?? "9:00 AM - 5:00 PM").trim(),
    institution: String(
      institution ??
        "Mekdela Amba University (Main Campus - Tulu Awulia / Gimba)",
    ).trim(),
    region: String(region ?? "Amhara Region, South Wollo, Ethiopia").trim(),
    landmark: String(landmark ?? "Near Gimba Masjid Al-Noor").trim(),
    mapQuery: String(
      mapQuery ?? "Mekdela Amba University Gimba Ethiopia",
    ).trim(),
  };
};

const sendContactAdminEmail = async ({ name, email, subject, message }) => {
  const fallbackAdminEmail = String(
    process.env.SMTP_TO ||
      process.env.ADMIN_EMAIL ||
      "enyihefikiradis@gmail.com",
  ).trim();
  const adminEmail = String(
    await getSystemSetting("admin_contact_email", fallbackAdminEmail),
  ).trim();
  if (!isValidEmail(adminEmail)) {
    throw new Error("The configured admin contact email is invalid.");
  }

  const subjectLine =
    subject && subject.trim()
      ? `[Contact Us] ${subject.trim()}`
      : "New Contact Us message";
  const textMessage = [
    "New message submitted through the Contact Us form.",
    "",
    `Name: ${name}`,
    `Email: ${email}`,
    subject && subject.trim() ? `Subject: ${subject.trim()}` : "",
    "",
    "Message:",
    message,
  ]
    .filter(Boolean)
    .join("\n");

  const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (character) => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return entities[character];
    });

  await sendEmail({
    to: adminEmail,
    replyTo: email,
    subject: subjectLine,
    text: textMessage,
    html: `<p><strong>New message submitted through the Contact Us form.</strong></p><p><strong>Name:</strong> ${escapeHtml(name)}</p><p><strong>Email:</strong> ${escapeHtml(email)}</p>${subject && subject.trim() ? `<p><strong>Subject:</strong> ${escapeHtml(subject.trim())}</p>` : ""}<p><strong>Message:</strong></p><p>${escapeHtml(message).replace(/\n/g, "<br/>")}</p>`,
  });

  return { sent: true };
};

const getAdminContactInfo = async (req, res) => {
  try {
    const settings = await getAdminContactSettings();
    return res.json({
      success: true,
      message: {
        en: "Admin contact information retrieved successfully.",
        am: "የአስተዳዳሪ እውቂያ መረጃ በተሳካ ሁኔታ ተገኝቷል።",
      },
      data: settings,
    });
  } catch (error) {
    console.error("Error retrieving admin contact settings:", error);
    return res.status(500).json({
      success: false,
      message: {
        en: "Unable to retrieve admin contact information.",
        am: "የአስተዳዳሪ እውቂያ መረጃን ማግኘት አልተቻለም።",
      },
    });
  }
};

const updateAdminContactInfo = async (req, res) => {
  try {
    const fields = {
      name: ["admin_contact_name", 255, true],
      email: ["admin_contact_email", 254, true],
      phone: ["admin_contact_phone", 64, true],
      location: ["admin_contact_location", 255, true],
      poBox: ["admin_contact_po_box", 255, false],
      officeDays: ["admin_contact_office_days", 128, false],
      officeHours: ["admin_contact_office_hours", 128, false],
      institution: ["admin_contact_institution", 255, false],
      region: ["admin_contact_region", 255, false],
      landmark: ["admin_contact_landmark", 255, false],
      mapQuery: ["admin_contact_map_query", 255, false],
    };
    const updates = {};
    for (const [field, [settingKey, maxLength, required]] of Object.entries(
      fields,
    )) {
      if (!Object.prototype.hasOwnProperty.call(req.body || {}, field))
        continue;
      const value =
        typeof req.body[field] === "string" ? req.body[field].trim() : "";
      if ((required && !value) || value.length > maxLength) {
        return res.status(400).json({
          success: false,
          message: {
            en: `${field} is required and must be ${maxLength} characters or fewer.`,
            am: "እባክዎ የእውቂያ መረጃውን ያረጋግጡ።",
          },
        });
      }
      updates[settingKey] = value;
    }
    const email =
      typeof req.body?.email === "string" ? req.body.email.trim() : undefined;

    if (email !== undefined && !isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: {
          en: "Invalid admin email format.",
          am: "ልክ ያልሆነ የአስተዳዳሪ ኢሜይል ቅርጸት።",
        },
      });
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: {
          en: "At least one contact field is required.",
          am: "ቢያንስ አንድ የእውቂያ መስክ ያስፈልጋል።",
        },
      });
    }

    await Promise.all(
      Object.entries(updates).map(([key, value]) =>
        setSystemSetting(key, value),
      ),
    );

    const data = await getAdminContactSettings();
    return res.json({
      success: true,
      message: {
        en: "Admin contact information updated successfully.",
        am: "የአስተዳዳሪ እውቂያ መረጃ በተሳካ ሁኔታ ተዘምኗል።",
      },
      data,
    });
  } catch (error) {
    console.error("Error updating admin contact settings:", error);
    return res.status(500).json({
      success: false,
      message: {
        en: "Unable to update admin contact information.",
        am: "የአስተዳዳሪ እውቂያ መረጃን ማዘመን አልተቻለም።",
      },
    });
  }
};

const submitContactMessage = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: { en: "Name is required.", am: "ስም አስፈላጊ ነው።" },
      });
    }

    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: { en: "Email is required.", am: "ኢሜይል አስፈላጊ ነው።" },
      });
    }

    const cleanedEmail = email.trim();
    if (!isValidEmail(cleanedEmail)) {
      return res.status(400).json({
        success: false,
        message: { en: "Invalid email format.", am: "ልክ ያልሆነ ኢሜይል ቅርጸት።" },
      });
    }

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: { en: "Message is required.", am: "መልእክት አስፈላጊ ነው።" },
      });
    }

    const cleanedMessage = message.trim();
    if (cleanedMessage.length < 10) {
      return res.status(400).json({
        success: false,
        message: {
          en: "Message must be at least 10 characters long.",
          am: "መልእክት ቢያንስ 10 ፊደሎች ረዥም መሆን አለበት።",
        },
      });
    }

    const cleanedSubject = typeof subject === "string" ? subject.trim() : "";

    const [result] = await pool.query(
      "INSERT INTO contact_messages (name, email, subject, message, status) VALUES (?, ?, ?, ?, ?)",
      [
        name.trim(),
        cleanedEmail,
        cleanedSubject || null,
        cleanedMessage,
        "unread",
      ],
    );

    try {
      await sendContactAdminEmail({
        name: name.trim(),
        email: cleanedEmail,
        subject: cleanedSubject,
        message: cleanedMessage,
      });
    } catch (emailError) {
      console.error("Contact email sending failed.", {
        code: emailError?.code || "EMAIL_DELIVERY_FAILED",
        message: emailError?.message || "Email delivery failed.",
      });
      return res.status(201).json({
        success: true,
        code: emailError?.code || "EMAIL_DELIVERY_FAILED",
        message: {
          en: "Your message was saved, but the email notification could not be delivered. The university team will review your message.",
          am: "መልእክትዎ ተቀምጧል፣ ግን የኢሜይል ማሳወቂያው መድረስ አልቻለም። የዩኒቨርሲቲው ቡድን መልእክትዎን ይመለከታል።",
        },
        data: { id: result.insertId, emailSent: false },
      });
    }

    return res.status(201).json({
      success: true,
      message: {
        en: "Message received successfully! We will get back to you soon.",
        am: "መልእክትዎ በተሳካ ሁኔታ ደርሶናል! በቅርቡ እንመለሳለን።",
      },
      data: {
        id: result.insertId,
        timestamp: new Date().toISOString(),
        emailSent: true,
      },
    });
  } catch (error) {
    console.error("Error submitting contact message:", error);
    return res.status(500).json({
      success: false,
      message: {
        en: "Unable to send message. Please try again later.",
        am: "መልእክቱን ለመላክ ተስኖል። እባክዎ በኋላ ላይ ይሞክሩ።",
      },
    });
  }
};

const getContactMessages = async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    let query =
      "SELECT id, name, email, subject, message, status, created_at FROM contact_messages";
    const params = [];

    if (status && status !== "all") {
      query += " WHERE status = ?";
      params.push(status);
    }

    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(parseInt(limit, 10) || 50, parseInt(offset, 10) || 0);

    const [messages] = await pool.query(query, params);

    let countQuery = "SELECT COUNT(*) as total FROM contact_messages";
    const countParams = [];
    if (status && status !== "all") {
      countQuery += " WHERE status = ?";
      countParams.push(status);
    }
    const [countResult] = await pool.query(countQuery, countParams);

    return res.json({
      success: true,
      message: {
        en: "Contact messages retrieved successfully.",
        am: "ሕዝብ መልእክቶች በተሳካ ሁኔታ ተገኝቷል።",
      },
      data: {
        messages,
        total: countResult[0].total,
        limit: parseInt(limit, 10) || 50,
        offset: parseInt(offset, 10) || 0,
      },
    });
  } catch (error) {
    console.error("Error retrieving contact messages:", error);
    return res.status(500).json({
      success: false,
      message: {
        en: "Unable to retrieve messages.",
        am: "መልእክቶችን ማግኘት አልተቻለም።",
      },
    });
  }
};

const updateMessageStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["unread", "read", "replied"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: { en: "Invalid status.", am: "ልክ ያልሆነ ሁኔታ።" },
      });
    }

    const [result] = await pool.query(
      "UPDATE contact_messages SET status = ? WHERE id = ?",
      [status, id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: { en: "Message not found.", am: "መልእክት አልተገኘም።" },
      });
    }

    return res.json({
      success: true,
      message: {
        en: "Message status updated successfully.",
        am: "የመልእክቱ ሁኔታ በተሳካ ሁኔታ ተቀይሮ ነው።",
      },
    });
  } catch (error) {
    console.error("Error updating message status:", error);
    return res.status(500).json({
      success: false,
      message: { en: "Unable to update message.", am: "መልእክቱን ማቀየር አልተቻለም።" },
    });
  }
};

const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query(
      "DELETE FROM contact_messages WHERE id = ?",
      [id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: { en: "Message not found.", am: "መልእክት አልተገኘም።" },
      });
    }

    return res.json({
      success: true,
      message: {
        en: "Message deleted successfully.",
        am: "መልእክት በተሳካ ሁኔታ ተሰርዟል።",
      },
    });
  } catch (error) {
    console.error("Error deleting message:", error);
    return res.status(500).json({
      success: false,
      message: { en: "Unable to delete message.", am: "መልእክቱን ማጥፋት አልተቻለም።" },
    });
  }
};

module.exports = {
  submitContactMessage,
  getContactMessages,
  updateMessageStatus,
  deleteMessage,
  sendContactAdminEmail,
  getAdminContactInfo,
  updateAdminContactInfo,
  getAdminContactSettings,
};
