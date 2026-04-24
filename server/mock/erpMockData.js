const MINIMAL_EMPLOYEE = (row) => ({
  employeeNumber: row.employeeNumber,
  employeeInitials: row.employeeInitials || null,
  employeeSurname: row.employeeSurname || null,
  employeeName: row.employeeName || null,
  designation: row.designation || null,
  gradeName: row.gradeName || null,
  email: row.email || null,
  employeeSupervisorNumber: row.employeeSupervisorNumber || null
});

const subordinates = [
  { employeeNumber: '000001', employeeInitials: 'LPMS-', employeeSurname: 'USER 2', designation: 'Engineer', gradeName: 'A.5.' },
];

const hierarchy = [
  {
    employeeNumber: '000001',
    employeeInitials: 'LPMS-',
    employeeSurname: 'USER 2',
    employeeName: 'LPMS-USER 2',
    designation: 'Engineer',
    gradeName: 'A.5.',
    email: null,
    employeeSupervisorNumber: '000000'
  },
  {
    employeeNumber: '000000',
    employeeInitials: 'LPMS-',
    employeeSurname: 'USER 1',
    employeeName: 'LPMS-USER 1',
    designation: 'General Manager',
    gradeName: 'A.1.',
    email:null,
    employeeSupervisorNumber: null
  }
];

export const ERP_MOCK_SUBORDINATES = {
  '000000': subordinates.map(MINIMAL_EMPLOYEE)
};

export const ERP_MOCK_HIERARCHIES = {
  '000000': hierarchy.map(MINIMAL_EMPLOYEE)
};

const detailsMap = new Map();
for (const row of hierarchy) {
  detailsMap.set(row.employeeNumber, MINIMAL_EMPLOYEE(row));
}
for (const row of subordinates) {
  if (!detailsMap.has(row.employeeNumber)) {
    detailsMap.set(
      row.employeeNumber,
      MINIMAL_EMPLOYEE({
        ...row,
        employeeName: null,
        email: `${row.employeeNumber}@mock.slt.com.lk`,
        employeeSupervisorNumber: '000000'
      })
    );
  }
}

export const ERP_MOCK_DETAILS = Object.fromEntries(detailsMap.entries());

export const ERP_MOCK_EMPLOYEE_NUMBERS = Array.from(detailsMap.keys()).sort();
