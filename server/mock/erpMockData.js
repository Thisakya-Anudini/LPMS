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

const subordinates011338Raw = [
  { employeeNumber: 'EMP_SUB_A', employeeInitials: null, employeeSurname: null, designation: 'Manager', gradeName: null },
  { employeeNumber: 'EMP_SUB_B', employeeInitials: null, employeeSurname: null, designation: 'Manager', gradeName: null },
  { employeeNumber: 'EMP_SUB_C', employeeInitials: null, employeeSurname: null, designation: 'Manager', gradeName: null },
  { employeeNumber: 'EMP_SUB_D', employeeInitials: null, employeeSurname: null, designation: 'Manager', gradeName: null },
  { employeeNumber: 'EMP_SUB_E', employeeInitials: null, employeeSurname: null, designation: 'Engineer', gradeName: null },
  { employeeNumber: 'EMP_SUB_F', employeeInitials: null, employeeSurname: null, designation: 'Engineer', gradeName: null },
  { employeeNumber: 'EMP_SUB_G', employeeInitials: null, employeeSurname: null, designation: 'Engineer', gradeName: null },
  { employeeNumber: 'EMP_SUB_H', employeeInitials: null, employeeSurname: null, designation: 'Engineer', gradeName: null },
  { employeeNumber: 'EMP_SUB_I', employeeInitials: null, employeeSurname: null, designation: 'Engineer', gradeName: null },
  { employeeNumber: 'EMP_SUB_J', employeeInitials: null, employeeSurname: null, designation: 'Engineer', gradeName: null },
  { employeeNumber: 'EMP_SUB_K', employeeInitials: null, employeeSurname: null, designation: 'Engineer', gradeName: null },
  { employeeNumber: 'EMP_SUB_L', employeeInitials: null, employeeSurname: null, designation: 'Engineer', gradeName: null }
];

const hierarchy011349Raw = [
  {
    employeeNumber: 'EMP_TARGET',
    employeeInitials: null,
    employeeSurname: null,
    employeeName: null,
    designation: 'Senior Assistant Manager (IT & NW) - A7',
    gradeName: null,
    email: null,
    employeeSupervisorNumber: 'EMP_SUPERVISOR'
  },
  {
    employeeNumber: 'EMP_SUPERVISOR',
    employeeInitials: null,
    employeeSurname: null,
    employeeName: null,
    designation: 'Engineer',
    gradeName: null,
    email: null,
    employeeSupervisorNumber: 'EMP_DIRECTOR'
  },
  {
    employeeNumber: 'EMP_DIRECTOR',
    employeeInitials: null,
    employeeSurname: null,
    employeeName: null,
    designation: 'Deputy General Manager',
    gradeName: null,
    email: null,
    employeeSupervisorNumber: 'EMP_GM'
  },
  {
    employeeNumber: 'EMP_GM',
    employeeInitials: null,
    employeeSurname: null,
    employeeName: null,
    designation: 'General Manager',
    gradeName: null,
    email: null,
    employeeSupervisorNumber: 'EMP_CO'
  },
  {
    employeeNumber: 'EMP_CO',
    employeeInitials: null,
    employeeSurname: null,
    employeeName: null,
    designation: 'Chief Officer',
    gradeName: null,
    email: null,
    employeeSupervisorNumber: 'EMP_CEO'
  },
  {
    employeeNumber: 'EMP_CEO',
    employeeInitials: null,
    employeeSurname: null,
    employeeName: null,
    designation: 'Chief Executive Officer',
    gradeName: null,
    email: null,
    employeeSupervisorNumber: ''
  }
];

export const ERP_MOCK_SUBORDINATES = {
  EMP_DIRECTOR: subordinates011338Raw.map(MINIMAL_EMPLOYEE)
};

export const ERP_MOCK_HIERARCHIES = {
  EMP_TARGET: hierarchy011349Raw.map(MINIMAL_EMPLOYEE)
};

const detailsMap = new Map();
for (const row of hierarchy011349Raw) {
  detailsMap.set(row.employeeNumber, MINIMAL_EMPLOYEE(row));
}
for (const row of subordinates011338Raw) {
  if (!detailsMap.has(row.employeeNumber)) {
    detailsMap.set(
      row.employeeNumber,
      MINIMAL_EMPLOYEE({
        ...row,
        employeeName: null,
        email: `${row.employeeNumber}@mock.slt.com.lk`,
        employeeSupervisorNumber: 'EMP_DIRECTOR'
      })
    );
  }
}

export const ERP_MOCK_DETAILS = Object.fromEntries(detailsMap.entries());

export const ERP_MOCK_EMPLOYEE_NUMBERS = Array.from(detailsMap.keys()).sort();

