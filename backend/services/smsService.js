const cleanPhoneNumber = (value) => String(value || '').trim().replace(/\s+/g, '').replace(/[-()]/g, '');

const isValidPhoneNumber = (value) => /^(0[79]\d{8}|251[79]\d{8}|\+251[79]\d{8})$/.test(cleanPhoneNumber(value));

const normalizePhoneForProvider = (value) => {
  const phone = cleanPhoneNumber(value);

  if (!phone) return null;

  if (phone.startsWith('+251')) return phone;
  if (phone.startsWith('251')) return `+${phone}`;
  if (/^0[79]\d{8}$/.test(phone)) return `+251${phone.slice(1)}`;

  return null;
};

const parseJsonIfPossible = async (response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (_error) {
    return { raw: text };
  }
};

const buildProviderError = (provider, detail, responseBody = null) => ({
  sent: false,
  provider,
  reason: detail,
  response: responseBody,
});

const buildSkippedResult = (provider, reason) => ({
  sent: false,
  skipped: true,
  provider,
  reason,
  response: null,
});

const buildSimulationResult = (phoneNumber, message, reason) => {
  console.warn(`[SIMULATED SMS to ${phoneNumber}]: ${message}`);
  console.warn(`[SMS Mock] Live SMS skipped: ${reason}`);
  return {
    sent: true,
    simulated: true,
    provider: 'simulation',
    phoneNumber,
    reason,
    response: null,
  };
};

const isConfiguredValue = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return Boolean(normalized) && !normalized.startsWith('your_') && !normalized.startsWith('replace-with-');
};

const sendSms = async ({ phoneNumber, message }) => {
  const phone = String(phoneNumber || '').trim();
  if (!isValidPhoneNumber(phone)) {
    const result = buildSkippedResult('validation', 'invalid_phone_number');
    console.warn('[SMS Mock] SMS skipped due to invalid phone number:', phone || '(empty)');
    return result;
  }

  const smsMessage = String(message || '').trim();
  if (!smsMessage) {
    const result = buildSkippedResult('validation', 'empty_message');
    console.warn('[SMS Mock] SMS skipped due to empty message.');
    return result;
  }

  const defaultProvider = process.env.SMS_API_URL ? 'smsethiopia' : 'africastalking';
  const provider = String(process.env.SMS_PROVIDER || defaultProvider).trim().toLowerCase();
  const normalizedPhone = normalizePhoneForProvider(phone);

  if (!normalizedPhone) {
    const result = buildSkippedResult('validation', 'invalid_phone_number');
    console.warn('[SMS Mock] SMS skipped due to invalid phone number:', phone);
    return result;
  }

  if (provider === 'twilio') {
    const accountSid = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
    const authToken = String(process.env.TWILIO_AUTH_TOKEN || '').trim();
    const from = String(process.env.TWILIO_FROM || '').trim();

    if (!accountSid || !authToken || !from) {
      return buildSimulationResult(normalizedPhone, smsMessage, 'missing_twilio_credentials');
    }

    try {
      const params = new URLSearchParams({ To: normalizedPhone, From: from, Body: smsMessage });
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      const body = await parseJsonIfPossible(response);
      console.log('[SMS] Twilio response:', { status: response.status, body });

      if (!response.ok) {
        return buildProviderError('twilio', body?.message || body?.error_message || `twilio_http_${response.status}`, body);
      }

      return { sent: true, provider: 'twilio', offline: false, phoneNumber: phone, sid: body?.sid || null, response: body };
    } catch (error) {
      console.error('[SMS] Twilio HTTP request failed:', error);
      return buildProviderError('twilio', error.message || 'twilio_request_failed');
    }
  }

  if (provider === 'africastalking' || provider === 'at') {
    const username = String(process.env.AT_USERNAME || process.env.SMS_USERNAME || '').trim();
    const apiKey = String(process.env.AT_API_KEY || process.env.SMS_API_KEY || '').trim();
    const senderId = String(process.env.AT_SENDER_ID || process.env.SMS_SENDER_ID || '').trim();

    if (!isConfiguredValue(username) || !isConfiguredValue(apiKey)) {
      return buildSimulationResult(normalizedPhone, smsMessage, 'missing_africastalking_credentials');
    }

    try {
      const requestPayload = {
        username,
        to: normalizedPhone,
        message: smsMessage,
      };

      if (senderId) requestPayload.from = senderId;

      console.log('[SMS] Sending SMS via Africa\'s Talking:', {
        to: normalizedPhone,
        senderId: senderId || 'not_set',
        messageLength: smsMessage.length,
        payload: requestPayload,
      });

      const params = new URLSearchParams({
        username,
        to: normalizedPhone,
        message: smsMessage,
      });
      if (senderId) params.set('from', senderId);

      const response = await fetch('https://api.africastalking.com/version1/messaging', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          apikey: apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      const body = await parseJsonIfPossible(response);
      console.log('[SMS] Africa\'s Talking response:', { status: response.status, body });

      if (!response.ok) {
        return buildProviderError('africastalking', body?.errorMessage || body?.message || `africastalking_http_${response.status}`, body);
      }

      return { sent: true, provider: 'africastalking', offline: false, phoneNumber: phone, response: body };
    } catch (error) {
      console.error('[SMS] Africa\'s Talking HTTP request failed:', error);
      return buildProviderError('africastalking', error.message || 'africastalking_request_failed');
    }
  }

  if (provider === 'http' || provider === 'generic' || provider === 'smsethiopia') {
    const apiUrl = String(process.env.SMS_API_URL || '').trim();
    const apiKey = String(process.env.SMS_API_KEY || '').trim();
    const senderId = String(process.env.SMS_SENDER_ID || '').trim();

    if (!apiUrl || !apiKey || !senderId) {
      const missingSetting = !apiUrl ? 'sms_api_url' : !apiKey ? 'sms_api_key' : 'sms_sender_id';
      const reason = `missing_${missingSetting}`;
      console.error('[SMS] SMSEthiopia is not configured:', { missingSetting });
      return buildProviderError('smsethiopia', reason);
    }

    try {
      const payload = {
        phone_number: normalizedPhone,
        message: smsMessage,
        sender_id: senderId,
      };

      console.log('[SMS] Sending SMS via SMSEthiopia:', {
        url: apiUrl,
        phone_number: normalizedPhone,
        sender_id: senderId,
        messageLength: smsMessage.length,
      });

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const body = await parseJsonIfPossible(response);
      console.log('[SMS] SMSEthiopia response:', { status: response.status, body });

      if (!response.ok) {
        return buildProviderError('smsethiopia', body?.message || body?.error || `smsethiopia_http_${response.status}`, body);
      }

      return { sent: true, provider: 'smsethiopia', offline: false, phoneNumber: phone, response: body };
    } catch (error) {
      console.error('[SMS] SMSEthiopia HTTP request failed:', error);
      return buildProviderError('smsethiopia', error.message || 'smsethiopia_request_failed');
    }
  }

  return buildSimulationResult(normalizedPhone, smsMessage, `unsupported_sms_provider:${provider || 'empty'}`);
};

module.exports = { isValidPhoneNumber, normalizePhoneForProvider, sendSms };
