import {
  ERP_MOCK_DETAILS,
  ERP_MOCK_HIERARCHIES,
  ERP_MOCK_SUBORDINATES
} from '../mock/erpMockData.js';

const DEFAULT_ERP_SUBORDINATES_URL =
  'https://oneidentitytest.slt.com.lk/ERPAPIs/api/ERPData/GetEmployeeSubordinatesDetailsList';
const DEFAULT_ERP_DETAILS_URL =
  'https://oneidentitytest.slt.com.lk/ERPAPIs/api/ERPData/GetEmployeeDetailsForServiceNo';
const DEFAULT_ERP_HIERARCHY_URL =
  'https://oneidentitytest.slt.com.lk/ERPAPIs/api/ERPData/GetEmployeeDetailsHierarchy';

const getErpConfig = () => ({
  subordinatesUrl: process.env.ERP_SUBORDINATES_URL || DEFAULT_ERP_SUBORDINATES_URL,
  detailsUrl: process.env.ERP_DETAILS_URL || DEFAULT_ERP_DETAILS_URL,
  hierarchyUrl: process.env.ERP_HIERARCHY_URL || DEFAULT_ERP_HIERARCHY_URL,
  username: process.env.ERP_USERNAME,
  password: process.env.ERP_PASSWORD,
  useMock: String(process.env.ERP_USE_MOCK || 'true').toLowerCase() === 'true',
  fallbackToMock:
    String(process.env.ERP_FALLBACK_TO_MOCK || 'true').toLowerCase() === 'true',
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

const getMockEmployeeDetailsForServiceNo = (employeeNo) => {
  const detail = ERP_MOCK_DETAILS[employeeNo] || {
    employeeNumber: employeeNo,
    employeeInitials: 'M',
    employeeSurname: `Learner ${employeeNo}`,
    designation: 'Engineer',
    employeeName: `Mock Learner ${employeeNo}`,
    gradeName: 'A.5.',
    employeeSupervisorNumber: '',
    email: `${employeeNo}@mock.slt.com.lk`,
    mobileNo: null,
    dateOfBirth: null,
    gender: null,
    orgName: 'Mock Organization',
    empSection: 'Mock Section',
    empDivision: 'Mock Division',
    empGroup: 'Mock Group',
    sectionHead: null,
    divisionHead: null,
    groupHead: null,
    fingerScanLocation: null,
    employeeCostCode: '6221',
    employeeCostCentreName: 'Mock Cost Centre'
  };

  return buildSuccessResponse('Operation completed successfully', [detail]);
};

const getMockSubordinates = (employeeNo) =>
  buildSuccessResponse(
    'Operation completed successfully',
    ERP_MOCK_SUBORDINATES[employeeNo] || []
  );

const getMockHierarchy = (employeeNo) =>
  buildSuccessResponse('Success', ERP_MOCK_HIERARCHIES[employeeNo] || []);

const postErp = async ({ url, username, password, body }) => {
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
      body: JSON.stringify(body),
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
  if (config.useMock) {
    return getMockSubordinates(employeeNo);
  }

  try {
    return await postErp({
      url: config.subordinatesUrl,
      username: config.username,
      password: config.password,
      body: { employeeNo }
    });
  } catch (error) {
    if (config.fallbackToMock) {
      return getMockSubordinates(employeeNo);
    }
    throw error;
  }
};

export const fetchEmployeeDetailsForServiceNo = async (employeeNo) => {
  const config = getErpConfig();
  if (config.useMock) {
    return getMockEmployeeDetailsForServiceNo(employeeNo);
  }

  try {
    return await postErp({
      url: config.detailsUrl,
      username: config.username,
      password: config.password,
      body: {
        organizationID: config.defaultOrganizationId,
        costCenterCode: config.defaultCostCenterCode,
        employeeNo
      }
    });
  } catch (error) {
    if (config.fallbackToMock) {
      return getMockEmployeeDetailsForServiceNo(employeeNo);
    }
    throw error;
  }
};

export const fetchEmployeeHierarchy = async (employeeNo) => {
  const config = getErpConfig();
  if (config.useMock) {
    return getMockHierarchy(employeeNo);
  }

  try {
    return await postErp({
      url: config.hierarchyUrl,
      username: config.username,
      password: config.password,
      body: {
        organizationID: config.defaultOrganizationId,
        costCenterCode: config.defaultCostCenterCode,
        employeeNo
      }
    });
  } catch (error) {
    if (config.fallbackToMock) {
      return getMockHierarchy(employeeNo);
    }
    throw error;
  }
};
