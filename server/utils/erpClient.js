const DEFAULT_ERP_SUBORDINATES_URL =
  'https://oneidentitytest.slt.com.lk/ERPAPIs/api/ERPData/GetEmployeeSubordinatesDetailsList';

const getEprConfig = () => {
  const url = process.env.ERP_SUBORDINATES_URL || DEFAULT_ERP_SUBORDINATES_URL;
  const username = process.env.ERP_USERNAME;
  const password = process.env.ERP_PASSWORD;

  return { url, username, password };
};

const parseErpResponse = (rawText) => {
  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return rawText;
  }
};

export const fetchEmployeeSubordinates = async (employeeNo) => {
  const { url, username, password } = getEprConfig();
  if (!username || !password) {
    throw new Error('ERP credentials are not configured (ERP_USERNAME / ERP_PASSWORD).');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        accept: 'text/plain',
        UserName: username,
        Password: password,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ employeeNo }),
      signal: controller.signal
    });

    const rawText = await response.text();
    const data = parseErpResponse(rawText);

    if (!response.ok) {
      const error = new Error('ERP request failed.');
      error.status = response.status;
      error.details = data;
      throw error;
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
};
