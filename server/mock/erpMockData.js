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
  { employeeNumber: '008668', employeeInitials: 'M', employeeSurname: 'Giridaran', designation: 'Manager', gradeName: 'A.5.' },
  { employeeNumber: '010402', employeeInitials: 'L P', employeeSurname: 'Gallage', designation: 'Manager', gradeName: 'A.4.' },
  { employeeNumber: '010950', employeeInitials: 'B N', employeeSurname: 'Alwis', designation: 'Manager', gradeName: 'A.4.' },
  { employeeNumber: '011379', employeeInitials: 'E A T', employeeSurname: 'Edirisinghe', designation: 'Manager', gradeName: 'A.5.' },
  { employeeNumber: '012258', employeeInitials: 'J R A C P', employeeSurname: 'Samaranayaka', designation: 'Engineer', gradeName: 'A.4.' },
  { employeeNumber: '012459', employeeInitials: 'S V', employeeSurname: 'Amarasinghe', designation: 'Engineer', gradeName: 'A.4.' },
  { employeeNumber: '014050', employeeInitials: 'K D D S', employeeSurname: 'Weerasekera', designation: 'Engineer', gradeName: 'A.5.' },
  { employeeNumber: '014150', employeeInitials: 'E B L', employeeSurname: 'Geeganage', designation: 'Engineer', gradeName: 'A.4.' },
  { employeeNumber: '017837', employeeInitials: 'S', employeeSurname: 'Shankarnath', designation: 'Engineer', gradeName: 'A.5.' },
  { employeeNumber: '018972', employeeInitials: 'B P G', employeeSurname: 'Balasuriya', designation: 'Engineer', gradeName: 'A.5.' },
  { employeeNumber: '020998', employeeInitials: 'J A G G', employeeSurname: 'Jayasinghe', designation: 'Engineer', gradeName: 'A.5.' },
  { employeeNumber: '000000', employeeInitials: 'test', employeeSurname: 'test', designation: 'Engineer', gradeName: 'A.5.' }
];

const hierarchy011349Raw = [
  {
    employeeNumber: '011349',
    employeeInitials: 'Y A J',
    employeeSurname: 'Mohan',
    employeeName: 'Y A J Mohan',
    designation: 'Senior Assistant Manager (IT & NW) - A7',
    gradeName: 'A.7.B',
    email: 'mohan@slt.com.lk',
    employeeSupervisorNumber: '012258'
  },
  {
    employeeNumber: '012258',
    employeeInitials: 'J R A C P',
    employeeSurname: 'Samaranayaka',
    employeeName: 'J R A C P Samaranayaka',
    designation: 'Engineer',
    gradeName: 'A.4.',
    email: 'charitha@slt.com.lk',
    employeeSupervisorNumber: '011338'
  },
  {
    employeeNumber: '011338',
    employeeInitials: 'T M K B',
    employeeSurname: 'Tennakoon',
    employeeName: 'T M K B Tennakoon',
    designation: 'Deputy General Manager',
    gradeName: 'A.3.',
    email: 'kosalat@slt.com.lk',
    employeeSupervisorNumber: '010067'
  },
  {
    employeeNumber: '010067',
    employeeInitials: 'J C',
    employeeSurname: 'Harambearachchi',
    employeeName: 'J C Harambearachchi',
    designation: 'General Manager',
    gradeName: 'A.2.',
    email: 'jana@slt.com.lk',
    employeeSupervisorNumber: '009935'
  },
  {
    employeeNumber: '009935',
    employeeInitials: 'H K S K',
    employeeSurname: 'Abeysekara',
    employeeName: 'H K S K Abeysekara',
    designation: 'Chief Officer',
    gradeName: 'A.1.',
    email: 'samank@slt.com.lk',
    employeeSupervisorNumber: '020987'
  },
  {
    employeeNumber: '020987',
    employeeInitials: 'M R',
    employeeSurname: 'Rasheed',
    employeeName: 'M R Rasheed',
    designation: 'Chief Executive Officer',
    gradeName: 'C..Executive',
    email: 'riyaazmr@slt.com.lk',
    employeeSupervisorNumber: ''
  }
];

export const ERP_MOCK_SUBORDINATES = {
  '011338': subordinates011338Raw.map(MINIMAL_EMPLOYEE)
};

export const ERP_MOCK_HIERARCHIES = {
  '011349': hierarchy011349Raw.map(MINIMAL_EMPLOYEE)
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
        employeeSupervisorNumber: '011338'
      })
    );
  }
}

export const ERP_MOCK_DETAILS = Object.fromEntries(detailsMap.entries());

export const ERP_MOCK_EMPLOYEE_NUMBERS = Array.from(detailsMap.keys()).sort();

