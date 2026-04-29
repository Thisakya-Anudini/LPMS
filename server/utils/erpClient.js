const getErpConfig = () => ({
  subordinatesUrl: process.env.ERP_SUBORDINATES_URL,
  detailsUrl: process.env.ERP_DETAILS_URL,
  hierarchyUrl: process.env.ERP_HIERARCHY_URL,
  partNameUrl: process.env.ERP_PART_NAME_URL,
  designationsUrl: process.env.ERP_DESIGNATIONS_URL,
  salaryGradesUrl: process.env.ERP_SALARY_GRADES_URL,
  organizationsUrl: process.env.ERP_ORGANIZATIONS_URL,
  employeeFilterUrl: process.env.ERP_EMPLOYEE_FILTER_URL,
  coursesUrl: process.env.ERP_COURSES_URL,
  username: process.env.ERP_USERNAME,
  password: process.env.ERP_PASSWORD,
  searchUsername: process.env.ERP_SEARCH_USERNAME || process.env.ERP_USERNAME,
  searchPassword: process.env.ERP_SEARCH_PASSWORD || process.env.ERP_PASSWORD,
  defaultCostCenterCode: process.env.ERP_DEFAULT_COST_CENTER_CODE || '6221',
  defaultOrganizationId: process.env.ERP_DEFAULT_ORGANIZATION_ID || 'string'
});

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

const buildSuccessResponse = (message, data) => ({
  success: true,
  message,
  data
});

const postErp = async ({ url, username, password, body, method = 'POST' }) => {
  if (!url) {
    throw new Error('ERP URL is not configured. Set ERP_*_URL in .env.');
  }
  if (!username || !password) {
    throw new Error('ERP credentials are not configured (ERP_USERNAME / ERP_PASSWORD).');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const upperMethod = String(method || 'POST').toUpperCase();
    const response = await fetch(url, {
      method: upperMethod,
      headers: {
        accept: 'text/plain',
        UserName: username,
        Password: password,
        'Content-Type': 'application/json'
      },
      body: upperMethod === 'GET' ? undefined : JSON.stringify(body ?? {}),
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

    return data || buildSuccessResponse('Success', []);
  } finally {
    clearTimeout(timeout);
  }
};

export const fetchEmployeeSubordinates = async (employeeNo) => {
  const config = getErpConfig();
  return postErp({
    url: config.subordinatesUrl,
    username: config.username,
    password: config.password,
    body: { employeeNo }
  });
};

export const fetchEmployeeDetailsForServiceNo = async (employeeNo) => {
  const config = getErpConfig();
  return postErp({
    url: config.detailsUrl,
    username: config.username,
    password: config.password,
    body: {
      organizationID: config.defaultOrganizationId,
      costCenterCode: config.defaultCostCenterCode,
      employeeNo
    }
  });
};

export const fetchEmployeeHierarchy = async (employeeNo) => {
  const config = getErpConfig();
  return postErp({
    url: config.hierarchyUrl,
    username: config.username,
    password: config.password,
    body: {
      organizationID: config.defaultOrganizationId,
      costCenterCode: config.defaultCostCenterCode,
      employeeNo
    }
  });
};

export const fetchEmployeesByPartialName = async (empName) => {
  const config = getErpConfig();
  return postErp({
    url: config.partNameUrl,
    username: config.searchUsername,
    password: config.searchPassword,
    body: { empName }
  });
};

export const fetchAllDesignations = async () => {
  const config = getErpConfig();
  return postErp({
    url: config.designationsUrl,
    username: config.searchUsername,
    password: config.searchPassword,
    body: {}
  });
};

export const fetchAllSalaryGrades = async () => {
  const config = getErpConfig();
  return postErp({
    url: config.salaryGradesUrl,
    username: config.searchUsername,
    password: config.searchPassword,
    body: {}
  });
};

export const fetchOrganizationList = async () => {
  const config = getErpConfig();
  return postErp({
    url: config.organizationsUrl,
    username: config.username,
    password: config.password,
    method: 'GET'
  });
};

export const fetchEmployeesByFilters = async ({
  designation,
  gradeName,
  orgName,
  payroll
}) => {
  const config = getErpConfig();
  return postErp({
    url: config.employeeFilterUrl,
    username: config.searchUsername,
    password: config.searchPassword,
    body: {
      designation,
      gradeName,
      orgName,
      payroll
    }
  });
};

export const fetchAllCourses = async () => {
  const config = getErpConfig();
  return postErp({
    url: config.coursesUrl,
    username: config.searchUsername,
    password: config.searchPassword,
    body: {}
  });
};
