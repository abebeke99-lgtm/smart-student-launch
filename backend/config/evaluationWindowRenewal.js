const pool = require("./db");

let renewalInProgress = false;

const calculateRenewedWindow = (startAtValue, endAtValue, now = Date.now()) => {
  const startTime = Date.parse(startAtValue);
  const endTime = Date.parse(endAtValue);
  const duration = endTime - startTime;
  if (
    !Number.isFinite(startTime) ||
    !Number.isFinite(endTime) ||
    !Number.isFinite(now) ||
    duration <= 0 ||
    now < endTime
  ) {
    return null;
  }

  const elapsedWindows = Math.floor((now - endTime) / duration) + 1;
  return {
    startAt: new Date(startTime + duration * elapsedWindows).toISOString(),
    endAt: new Date(endTime + duration * elapsedWindows).toISOString(),
  };
};

const renewExpiredEvaluationWindow = async () => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [[activeSetting]] = await connection.query(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'active_evaluation_cycle_id' LIMIT 1 FOR UPDATE",
    );
    let activeCycleId = Number(activeSetting?.setting_value) || 0;
    let activeCycle = null;
    if (activeCycleId) {
      [[activeCycle]] = await connection.query(
        "SELECT id, start_at, end_at FROM evaluation_cycles WHERE id = ? LIMIT 1 FOR UPDATE",
        [activeCycleId],
      );
    } else {
      [[activeCycle]] = await connection.query(
        "SELECT id, start_at, end_at FROM evaluation_cycles WHERE status = 'active' ORDER BY id DESC LIMIT 1 FOR UPDATE",
      );
      activeCycleId = Number(activeCycle?.id) || 0;
    }

    const [[windowSetting]] = await connection.query(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'evaluation_window' LIMIT 1 FOR UPDATE",
    );
    let savedWindow = {};
    if (windowSetting?.setting_value) {
      try {
        savedWindow = JSON.parse(windowSetting.setting_value);
      } catch (error) {
        throw new Error("Stored evaluation window is invalid JSON.", { cause: error });
      }
    }

    const startAtValue = activeCycle?.start_at || savedWindow.startAt;
    const endAtValue = activeCycle?.end_at || savedWindow.endAt;
    const renewedWindow = calculateRenewedWindow(
      startAtValue,
      endAtValue,
      Date.now(),
    );
    if (!renewedWindow) {
      await connection.commit();
      return { renewed: false };
    }

    const { startAt, endAt } = renewedWindow;
    const nextWindow = JSON.stringify({ startAt, endAt });

    if (activeCycleId) {
      await connection.query(
        "UPDATE evaluation_cycles SET start_at = ?, end_at = ? WHERE id = ?",
        [startAt, endAt, activeCycleId],
      );
    }
    await connection.query(
      `INSERT INTO system_settings (setting_key, setting_value)
       VALUES ('evaluation_window', ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [nextWindow],
    );

    await connection.commit();
    return { renewed: true, startAt, endAt, cycleId: activeCycleId || null };
  } catch (error) {
    await connection.rollback().catch((rollbackError) => {
      console.error("Evaluation deadline renewal rollback failed:", rollbackError);
    });
    throw error;
  } finally {
    connection.release();
  }
};

const startEvaluationWindowRenewal = async () => {
  const runRenewal = async () => {
    if (renewalInProgress) return;
    renewalInProgress = true;
    try {
      const result = await renewExpiredEvaluationWindow();
      if (result.renewed) {
        console.log(
          `Evaluation deadline automatically renewed until ${result.endAt}.`,
        );
      }
    } catch (error) {
      console.error("Automatic evaluation deadline renewal failed:", error);
    } finally {
      renewalInProgress = false;
    }
  };

  await runRenewal();
  return setInterval(runRenewal, 60_000);
};

module.exports = {
  calculateRenewedWindow,
  renewExpiredEvaluationWindow,
  startEvaluationWindowRenewal,
};
