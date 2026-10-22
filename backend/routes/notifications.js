const express = require("express");
const pool = require("../config/db");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();
const parseNotificationId = (value) => {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

router.get("/", authenticateToken, async (req, res) => {
  const filter = String(req.query.filter || "unread").trim().toLowerCase();
  if (!["all", "read", "unread"].includes(filter)) {
    return res.status(400).json({
      success: false,
      message: "Notification filter must be all, read, or unread.",
    });
  }

  try {
    const [rows] = await pool.query(
      `SELECT id, title, message, type, is_read, created_at
       FROM notifications
       WHERE user_id = ?
         AND (? = 'all' OR (? = 'read' AND is_read = 1) OR (? = 'unread' AND is_read = 0))
       ORDER BY created_at DESC`,
      [req.user.id, filter, filter, filter],
    );
    return res.json({
      success: true,
      data: rows,
      unreadCount: rows.filter((notification) => !Number(notification.is_read)).length,
    });
  } catch (error) {
    console.error("Fetch notifications failed:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to load notifications." });
  }
});

router.put("/:id/read", authenticateToken, async (req, res) => {
  const notificationId = parseNotificationId(req.params.id);
  if (notificationId === null) {
    return res
      .status(400)
      .json({ success: false, message: "A valid notification ID is required." });
  }

  try {
    const [result] = await pool.query(
      "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?",
      [notificationId, req.user.id],
    );
    return res.json({ success: true, updated: result.affectedRows > 0 });
  } catch (error) {
    console.error("Mark notification read failed:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to update notification." });
  }
});

router.delete("/clear-all", authenticateToken, async (req, res) => {
  try {
    const [result] = await pool.query(
      "DELETE FROM notifications WHERE user_id = ?",
      [req.user.id],
    );
    return res.json({ success: true, deletedCount: result.affectedRows });
  } catch (error) {
    console.error("Clear notifications failed:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to clear notifications." });
  }
});

router.delete("/bulk-delete", authenticateToken, async (req, res) => {
  const rawIds = req.body?.ids;
  const parsedIds = Array.isArray(rawIds) ? rawIds.map(parseNotificationId) : [];
  const ids = [...new Set(parsedIds)];
  if (
    !ids.length ||
    rawIds.length > 500 ||
    ids.length > 500 ||
    ids.some((id) => id === null)
  ) {
    return res.status(400).json({
      success: false,
      message: "Provide between 1 and 500 valid notification IDs.",
    });
  }

  try {
    const placeholders = ids.map(() => "?").join(", ");
    const [result] = await pool.query(
      `DELETE FROM notifications
       WHERE user_id = ? AND id IN (${placeholders})`,
      [req.user.id, ...ids],
    );
    return res.json({ success: true, deletedCount: result.affectedRows });
  } catch (error) {
    console.error("Delete selected notifications failed:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to delete selected notifications." });
  }
});

router.delete("/:id", authenticateToken, async (req, res) => {
  const notificationId = parseNotificationId(req.params.id);
  if (notificationId === null) {
    return res
      .status(400)
      .json({ success: false, message: "A valid notification ID is required." });
  }

  try {
    const [result] = await pool.query(
      "DELETE FROM notifications WHERE id = ? AND user_id = ?",
      [notificationId, req.user.id],
    );
    if (!result.affectedRows) {
      return res
        .status(404)
        .json({ success: false, message: "Notification was not found." });
    }
    return res.json({ success: true, deletedCount: result.affectedRows });
  } catch (error) {
    console.error("Delete notification failed:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to delete notification." });
  }
});

module.exports = router;
