import {
  ERP_MOCK_DETAILS,
  ERP_MOCK_HIERARCHIES,
  ERP_MOCK_SUBORDINATES
} from '../mock/erpMockData.js';

const getErpConfig = () => ({
  subordinatesUrl: process.env.ERP_SUBORDINATES_URL,
  detailsUrl: process.env.ERP_DETAILS_URL,
  hierarchyUrl: process.env.ERP_HIERARCHY_URL,
  partNameUrl: process.env.ERP_PART_NAME_URL,
  designationsUrl: process.env.ERP_DESIGNATIONS_URL,
  designationEmployeesUrl: process.env.ERP_DESIGNATION_EMPLOYEES_URL,
  salaryGradesUrl: process.env.ERP_SALARY_GRADES_URL,
  salaryGradeEmployeesUrl: process.env.ERP_SALARY_GRADE_EMPLOYEES_URL,
  organizationsUrl: process.env.ERP_ORGANIZATIONS_URL,
  organizationEmployeesUrl: process.env.ERP_ORGANIZATION_EMPLOYEES_URL,
  payrollEmployeesUrl: process.env.ERP_PAYROLL_EMPLOYEES_URL,
  username: process.env.ERP_USERNAME,
  password: process.env.ERP_PASSWORD,
  searchUsername: process.env.ERP_SEARCH_USERNAME || process.env.ERP_USERNAME,
  searchPassword: process.env.ERP_SEARCH_PASSWORD || process.env.ERP_PASSWORD,
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

const buildMinimalMockEmployee = (employeeNo, row = {}) => ({
  employeeNumber: employeeNo,
  employeeTitle: row.employeeTitle || 'MR.',
  employeeFirstName: row.employeeFirstName || null,
  employeeInitials: row.employeeInitials || null,
  employeeSurname: row.employeeSurname || null,
  designation: row.designation || '',
  employeeName: row.employeeName || null,
  gradeName: row.gradeName || '',
  officialAddress: row.officialAddress || null,
  employeeSupervisorNumber: row.employeeSupervisorNumber || '',
  email: row.email || null,
  mobileNo: row.mobileNo || null,
  dateOfBirth: row.dateOfBirth || null,
  gender: row.gender || null,
  orgName: row.orgName || '',
  empSection: row.empSection || '',
  empDivision: row.empDivision || '',
  empGroup: row.empGroup || '',
  sectionHead: row.sectionHead || '',
  divisionHead: row.divisionHead || '',
  groupHead: row.groupHead || '',
  fingerScanLocation: row.fingerScanLocation || '',
  employeeCostCode: row.employeeCostCode || '',
  employeeCostCentreName: row.employeeCostCentreName || ''
});

const getMockEmployeeDetailsForServiceNo = (employeeNo) => {
  const detail = buildMinimalMockEmployee(
    employeeNo,
    ERP_MOCK_DETAILS[employeeNo] || {
      employeeInitials: 'M',
      employeeSurname: `Learner ${employeeNo}`,
      designation: 'Engineer',
      employeeName: `Mock Learner ${employeeNo}`,
      gradeName: 'A.5.',
      email: `${employeeNo}@mock.slt.com.lk`,
      orgName: 'Mock Organization',
      empSection: 'Mock Section',
      empDivision: 'Mock Division',
      empGroup: 'Mock Group',
      employeeCostCode: '6221',
      employeeCostCentreName: 'Mock Cost Centre'
    }
  );

  return buildSuccessResponse('Operation completed successfully', [detail]);
};

const getMockSubordinates = (employeeNo) =>
  buildSuccessResponse(
    'Operation completed successfully',
    ERP_MOCK_SUBORDINATES[employeeNo] || []
  );

const getMockHierarchy = (employeeNo) =>
  buildSuccessResponse('Success', ERP_MOCK_HIERARCHIES[employeeNo] || []);

const getAllMockEmployees = () =>
  Object.entries(ERP_MOCK_DETAILS).map(([employeeNo, row]) => buildMinimalMockEmployee(employeeNo, row));

const getMockEmployeesByPartialName = (empName) => {
  const normalized = String(empName || '').trim().toLowerCase();
  const rows = getAllMockEmployees().filter((row) => {
    const fullName = String(row.employeeName || '').toLowerCase();
    const surname = String(row.employeeSurname || '').toLowerCase();
    return fullName.includes(normalized) || surname.includes(normalized);
  });
  return buildSuccessResponse('Operation completed successfully', rows);
};

const getMockDesignationList = () => {
  const data = Array.from(
    new Set(
      getAllMockEmployees()
        .map((row) => String(row.designation || '').trim())
        .filter(Boolean)
    )
  )
    .sort((a, b) => a.localeCompare(b))
    .map((designation) => ({ designation }));
  return buildSuccessResponse('Operation completed successfully', data);
};

const getMockEmployeesByDesignation = (designation) => {
  const normalized = String(designation || '').trim();
  const rows = getAllMockEmployees().filter((row) => String(row.designation || '').trim() === normalized);
  return buildSuccessResponse('Operation completed successfully', rows);
};

const getMockSalaryGradeList = () => {
  const data = Array.from(
    new Set(
      getAllMockEmployees()
        .map((row) => String(row.gradeName || '').trim())
        .filter(Boolean)
    )
  )
    .sort((a, b) => a.localeCompare(b))
    .map((salaryGrade) => ({ salaryGrade }));
  return buildSuccessResponse('Operation completed successfully', data);
};

const getMockEmployeesBySalaryGrade = (salaryGrade) => {
  const normalized = String(salaryGrade || '').trim();
  const rows = getAllMockEmployees().filter((row) => String(row.gradeName || '').trim() === normalized);
  return buildSuccessResponse('Operation completed successfully', rows);
};

const getMockOrganizations = () => {
  const seen = new Map();
  for (const row of getAllMockEmployees()) {
    const organizationName = String(row.orgName || '').trim();
    if (!organizationName || seen.has(organizationName)) {
      continue;
    }
    seen.set(organizationName, {
      organizationId: organizationName.toUpperCase().replace(/[^A-Z0-9]+/g, '_'),
      organizationName,
      parentOrganizationId: '',
      parentOrganizationName: ''
    });
  }
  return buildSuccessResponse('Success', Array.from(seen.values()));
};

const getMockEmployeesByOrganization = (organizationID) => {
  const normalized = String(organizationID || '').trim();
  const organizations = getMockOrganizations().data || [];
  const org = organizations.find((row) => row.organizationId === normalized);
  const rows = getAllMockEmployees().filter((employee) => String(employee.orgName || '').trim() === org?.organizationName);
  return buildSuccessResponse('Success', rows);
};

const isExecutiveGrade = (gradeName) => /^A\.[1-9](\.|$)/i.test(String(gradeName || '').trim());

const getMockEmployeesByPayroll = (payroll) => {
  const normalized = String(payroll || '').trim().toLowerCase();
  const executive = normalized.includes('executive');
  const rows = getAllMockEmployees().filter((row) =>
    executive ? isExecutiveGrade(row.gradeName) : !isExecutiveGrade(row.gradeName)
  );
  return buildSuccessResponse('Operation completed successfully', rows);
};

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

export const fetchEmployeesByPartialName = async (empName) => {
  const config = getErpConfig();
  if (config.useMock) {
    return getMockEmployeesByPartialName(empName);
  }

  try {
    return await postErp({
      url: config.partNameUrl,
      username: config.searchUsername,
      password: config.searchPassword,
      body: { empName }
    });
  } catch (error) {
    if (config.fallbackToMock) {
      return getMockEmployeesByPartialName(empName);
    }
    throw error;
  }
};

export const fetchAllDesignations = async () => {
  const config = getErpConfig();
  if (config.useMock) {
    return getMockDesignationList();
  }

  try {
    return await postErp({
      url: config.designationsUrl,
      username: config.searchUsername,
      password: config.searchPassword,
      body: {}
    });
  } catch (error) {
    if (config.fallbackToMock) {
      return getMockDesignationList();
    }
    throw error;
  }
};

export const fetchEmployeesByDesignation = async (designation) => {
  const config = getErpConfig();
  if (config.useMock) {
    return getMockEmployeesByDesignation(designation);
  }

  try {
    return await postErp({
      url: config.designationEmployeesUrl,
      username: config.searchUsername,
      password: config.searchPassword,
      body: { designation }
    });
  } catch (error) {
    if (config.fallbackToMock) {
      return getMockEmployeesByDesignation(designation);
    }
    throw error;
  }
};

export const fetchAllSalaryGrades = async () => {
  const config = getErpConfig();
  if (config.useMock) {
    return getMockSalaryGradeList();
  }

  try {
    return await postErp({
      url: config.salaryGradesUrl,
      username: config.searchUsername,
      password: config.searchPassword,
      body: {}
    });
  } catch (error) {
    if (config.fallbackToMock) {
      return getMockSalaryGradeList();
    }
    throw error;
  }
};

export const fetchEmployeesBySalaryGrade = async (salaryGrade) => {
  const config = getErpConfig();
  if (config.useMock) {
    return getMockEmployeesBySalaryGrade(salaryGrade);
  }

  try {
    return await postErp({
      url: config.salaryGradeEmployeesUrl,
      username: config.searchUsername,
      password: config.searchPassword,
      body: { salaryGrade }
    });
  } catch (error) {
    if (config.fallbackToMock) {
      return getMockEmployeesBySalaryGrade(salaryGrade);
    }
    throw error;
  }
};

export const fetchOrganizationList = async () => {
  const config = getErpConfig();
  if (config.useMock) {
    return getMockOrganizations();
  }

  try {
    return await postErp({
      url: config.organizationsUrl,
      username: config.username,
      password: config.password,
      method: 'GET'
    });
  } catch (error) {
    if (config.fallbackToMock) {
      return getMockOrganizations();
    }
    throw error;
  }
};

export const fetchEmployeesByOrganization = async (organizationID) => {
  const config = getErpConfig();
  if (config.useMock) {
    return getMockEmployeesByOrganization(organizationID);
  }

  try {
    return await postErp({
      url: config.organizationEmployeesUrl,
      username: config.username,
      password: config.password,
      body: {
        organizationID,
        costCenterCode: 'string'
      }
    });
  } catch (error) {
    if (config.fallbackToMock) {
      return getMockEmployeesByOrganization(organizationID);
    }
    throw error;
  }
};

export const fetchEmployeesByPayroll = async (payroll) => {
  const config = getErpConfig();
  if (config.useMock) {
    return getMockEmployeesByPayroll(payroll);
  }

  try {
    return await postErp({
      url: config.payrollEmployeesUrl,
      username: config.searchUsername,
      password: config.searchPassword,
      body: { payroll }
    });
  } catch (error) {
    if (config.fallbackToMock) {
      return getMockEmployeesByPayroll(payroll);
    }
    throw error;
  }
};
