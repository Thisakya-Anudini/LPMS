import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, ShieldCheck, UserCheck, Users } from "lucide-react";
import { learningApi, superAdminApi, userApi } from "../../api/lpmsApi";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { ModalOverlay } from "../../components/ui/ModalOverlay";
import { Select } from "../../components/ui/Select";
import { Skeleton } from "../../components/ui/Skeleton";
import { useAuth } from "../../contexts/useAuth";
import { useToast } from "../../contexts/useToast";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "LEARNING_ADMIN" | "SUPERVISOR" | "EMPLOYEE";
  is_active: boolean;
};

type AssignableEmployeeRow = {
  employeeNumber: string;
  employeeName: string;
  employeeSurname: string;
  email: string;
  designation: string;
  grade_name: string;
  gradeName: string;
  organizationName: string;
  costCenterCode: string;
  costCenterName: string;
  employeeInitials: string;
  employeeSupervisorNumber: string;
  isLearningAdmin?: boolean;
};

type AssignedLearningAdminRow = {
  employee_number: string;
  principal_id: string;
  designation: string;
  grade_name: string;
  name: string;
  email: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const roleSections: {
  key: UserRow["role"];
  label: string;
  panelClass: string;
  headingClass: string;
  headRowClass: string;
}[] = [
  {
    key: "SUPER_ADMIN",
    label: "Super Admins",
    panelClass: "border-slate-200 bg-white",
    headingClass: "text-slate-900",
    headRowClass: "bg-slate-100 text-slate-700",
  },
];

const initialUserForm = {
  name: "",
  email: "",
  password: "",
  role: "SUPER_ADMIN",
};

export function AdminDashboard() {
  const { getAccessToken } = useAuth();
  const { showToast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [assignedLearningAdmins, setAssignedLearningAdmins] = useState<
    AssignedLearningAdminRow[]
  >([]);
  const [learnerTotal, setLearnerTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pendingDeleteUser, setPendingDeleteUser] = useState<UserRow | null>(
    null,
  );

  const [userForm, setUserForm] = useState(initialUserForm);
  const [userFormErrors, setUserFormErrors] = useState<{ name?: string }>({});
  const [userFormLoading, setUserFormLoading] = useState(false);
  const [assignOptionsLoading, setAssignOptionsLoading] = useState(true);
  const [assignSearchLoading, setAssignSearchLoading] = useState(false);
  const [assignEmployeeNoSearch, setAssignEmployeeNoSearch] = useState("");
  const [assignSurnameSearch, setAssignSurnameSearch] = useState("");
  const [assignSearchErrors, setAssignSearchErrors] = useState<{
    employeeNo?: string;
    name?: string;
  }>({});
  const [assignDesignationFilter, setAssignDesignationFilter] = useState("");
  const [assignGradeFilter, setAssignGradeFilter] = useState("");
  const [assignOrganizationFilter, setAssignOrganizationFilter] = useState("");
  const [assignPayrollFilter, setAssignPayrollFilter] = useState("");
  const [erpEmployees, setErpEmployees] = useState<AssignableEmployeeRow[]>([]);
  const [designationOptions, setDesignationOptions] = useState<string[]>([]);
  const [gradeOptions, setGradeOptions] = useState<string[]>([]);
  const [organizationOptions, setOrganizationOptions] = useState<
    Array<{
      organizationId: string;
      organizationName: string;
      parentOrganizationName: string;
    }>
  >([]);
  const recentUsersSkeletonRows = Array.from(
    { length: 3 },
    (_, index) => index,
  );
  const assignResultsSkeletonRows = Array.from(
    { length: 5 },
    (_, index) => index,
  );
  const hasAssignEmployeeNoSearch = assignEmployeeNoSearch.trim().length > 0;
  const hasAssignNameSearch = assignSurnameSearch.trim().length > 0;
  const hasAssignFilterSearch =
    Boolean(assignDesignationFilter) ||
    Boolean(assignGradeFilter) ||
    Boolean(assignOrganizationFilter) ||
    Boolean(assignPayrollFilter);

  const clearAssignFilters = () => {
    setAssignDesignationFilter("");
    setAssignGradeFilter("");
    setAssignOrganizationFilter("");
    setAssignPayrollFilter("");
  };

  const activateAssignEmployeeSearch = () => {
    setAssignSearchErrors((prev) => ({ ...prev, name: undefined }));
    if (hasAssignNameSearch) {
      setAssignSurnameSearch("");
    }
    if (hasAssignFilterSearch) {
      clearAssignFilters();
    }
  };

  const activateAssignNameSearch = () => {
    setAssignSearchErrors((prev) => ({ ...prev, employeeNo: undefined }));
    if (hasAssignEmployeeNoSearch) {
      setAssignEmployeeNoSearch("");
    }
    if (hasAssignFilterSearch) {
      clearAssignFilters();
    }
  };

  const activateAssignFilterSearch = () => {
    setAssignSearchErrors({});
    if (hasAssignEmployeeNoSearch) {
      setAssignEmployeeNoSearch("");
    }
    if (hasAssignNameSearch) {
      setAssignSurnameSearch("");
    }
  };

  const handleAssignEmployeeNoChange = (value: string) => {
    const sanitizedValue = value.replace(/\D/g, "");

    if (sanitizedValue.trim()) {
      activateAssignEmployeeSearch();
    }
    setAssignEmployeeNoSearch(sanitizedValue);
    setAssignSearchErrors((prev) => ({
      ...prev,
      employeeNo:
        value !== sanitizedValue ? "Only numbers are allowed." : undefined,
    }));
  };

  const handleAssignNameSearchChange = (value: string) => {
    const lettersOnlyValue = value.replace(/[^A-Za-z\s]/g, "");
    const sanitizedValue = lettersOnlyValue
      .replace(/\s+/g, " ")
      .replace(/^\s+/, "");
    const hasInvalidCharacters = value !== lettersOnlyValue;
    const hasExtraSpaces = lettersOnlyValue !== sanitizedValue;

    if (sanitizedValue.trim()) {
      activateAssignNameSearch();
    }
    setAssignSurnameSearch(sanitizedValue);
    setAssignSearchErrors((prev) => ({
      ...prev,
      name: hasInvalidCharacters
        ? "Only letters are allowed."
        : hasExtraSpaces
          ? "Use single spaces between names."
          : undefined,
    }));
  };

  const handleAssignDesignationChange = (value: string) => {
    if (value) {
      activateAssignFilterSearch();
    }
    setAssignDesignationFilter(value);
  };

  const handleAssignGradeChange = (value: string) => {
    if (value) {
      activateAssignFilterSearch();
    }
    setAssignGradeFilter(value);
  };

  const handleAssignOrganizationChange = (value: string) => {
    if (value) {
      activateAssignFilterSearch();
    }
    setAssignOrganizationFilter(value);
  };

  const handleAssignPayrollChange = (value: string) => {
    if (value) {
      activateAssignFilterSearch();
    }
    setAssignPayrollFilter(value);
  };

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setAssignOptionsLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        showToast("Session expired. Please login again.", "error");
        return;
      }

      const response = await userApi.listUsers(token);
      setUsers(response.users);
      const [learnerResponse, searchOptions, learningAdminAssignments] =
        await Promise.all([
          superAdminApi.getLearners(token, {
            page: 1,
            pageSize: 50,
          }),
          learningApi.getAssignableEmployeeSearchOptions(token),
          superAdminApi.getAssignedLearningAdmins(token),
        ]);
      setLearnerTotal(learnerResponse.pagination.total);
      setDesignationOptions(searchOptions.designations);
      setGradeOptions(searchOptions.grades);
      setOrganizationOptions(searchOptions.organizations);
      setAssignedLearningAdmins(learningAdminAssignments.learningAdmins);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to load users.",
        "error",
      );
    } finally {
      setLoading(false);
      setAssignOptionsLoading(false);
    }
  }, [getAccessToken, showToast]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const superAdminCount = users.filter(
    (user) => user.role === "SUPER_ADMIN",
  ).length;
  const learningAdminCount = assignedLearningAdmins.length;
  const dashboardStats = [
    {
      label: "Super Admins",
      value: superAdminCount,
      icon: UserCheck,
      iconClass: "bg-emerald-50 text-emerald-700 ring-emerald-100",
      detail: "Full platform access",
    },
    {
      label: "Learning Admins",
      value: learningAdminCount,
      icon: ShieldCheck,
      iconClass: "bg-amber-50 text-amber-700 ring-amber-100",
      detail: "Assigned from ERP employees",
    },
    {
      label: "Learners",
      value: learnerTotal,
      icon: Users,
      iconClass: "bg-sky-50 text-sky-700 ring-sky-100",
      detail: "Active learner records",
    },
  ];
  const usersByRole = useMemo(
    () =>
      roleSections.map((section) => ({
        ...section,
        users: users.filter((user) => user.role === section.key),
      })),
    [users],
  );

  const handleCreateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = userForm.name.trim();
    if (!trimmedName) {
      setUserFormErrors({ name: "Name cannot be blank." });
      return;
    }
    if (!/^[A-Za-z\s]+$/.test(trimmedName)) {
      setUserFormErrors({ name: "Only letters and spaces are allowed." });
      return;
    }

    setUserFormErrors({});
    setUserFormLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        showToast("Session expired. Please login again.", "error");
        return;
      }

      await userApi.createUser(token, {
        ...userForm,
        name: trimmedName,
        role: "SUPER_ADMIN",
      });
      showToast("User account created successfully.", "success");
      setUserForm(initialUserForm);
      setUserFormErrors({});
      await loadUsers();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to create user.",
        "error",
      );
    } finally {
      setUserFormLoading(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      const token = await getAccessToken();
      if (!token) {
        showToast("Session expired. Please login again.", "error");
        return;
      }
      await userApi.deleteUser(token, id);
      showToast("Account deleted successfully.", "success");
      setPendingDeleteUser(null);
      await loadUsers();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to delete account.",
        "error",
      );
    }
  };

  const handleAssignReset = () => {
    setAssignEmployeeNoSearch("");
    setAssignSurnameSearch("");
    setAssignDesignationFilter("");
    setAssignGradeFilter("");
    setAssignOrganizationFilter("");
    setAssignPayrollFilter("");
    setAssignSearchErrors({});
    setErpEmployees([]);
  };

  const handleAssignSearch = async () => {
    const employeeNo = assignEmployeeNoSearch.trim();
    const name = assignSurnameSearch.trim().replace(/\s+/g, " ");
    const nextErrors: { employeeNo?: string; name?: string } = {};

    if (employeeNo && !/^\d+$/.test(employeeNo)) {
      nextErrors.employeeNo = "Only numbers are allowed.";
    }
    if (name && !/^[A-Za-z]+(?:\s[A-Za-z]+)*$/.test(name)) {
      nextErrors.name = "Only letters and single spaces are allowed.";
    }

    if (nextErrors.employeeNo || nextErrors.name) {
      setAssignSearchErrors(nextErrors);
      return;
    }

    setAssignSearchErrors({});
    setAssignEmployeeNoSearch(employeeNo);
    setAssignSurnameSearch(name);

    try {
      setAssignSearchLoading(true);
      const token = await getAccessToken();
      if (!token) {
        showToast("Session expired. Please login again.", "error");
        return;
      }

      const response = await learningApi.searchAssignableEmployees(token, {
        employeeNo,
        surname: name,
        designation: assignDesignationFilter,
        grade: assignGradeFilter,
        organizationName: assignOrganizationFilter,
        payrollType: assignPayrollFilter as "" | "EXECUTIVE" | "NON_EXECUTIVE",
      });

      setErpEmployees(response.employees as AssignableEmployeeRow[]);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to search ERP employees.",
        "error",
      );
    } finally {
      setAssignSearchLoading(false);
    }
  };

  const handleAssignLearningAdmin = async (
    employee: AssignableEmployeeRow,
    shouldAssign: boolean,
  ) => {
    try {
      const token = await getAccessToken();
      if (!token) {
        showToast("Session expired. Please login again.", "error");
        return;
      }

      if (shouldAssign) {
        await superAdminApi.assignLearningAdmin(
          token,
          employee.employeeNumber,
          employee,
        );
        showToast("Employee assigned as Learning Admin.", "success");
      } else {
        await superAdminApi.removeLearningAdmin(token, employee.employeeNumber);
        showToast("Learning Admin access removed.", "success");
      }
      setErpEmployees((prev) =>
        prev.map((item) =>
          item.employeeNumber === employee.employeeNumber
            ? { ...item, isLearningAdmin: shouldAssign }
            : item,
        ),
      );
      await loadUsers();
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : "Failed to update Learning Admin assignment.",
        "error",
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Administration
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950">
              System Accounts
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Create, review, and manage Super Admin and Learning Admin access
              from a single control panel.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:w-auto sm:min-w-64">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <BriefcaseBusiness className="h-4 w-4 text-slate-500" />
              Account Overview
            </div>
            <p className="text-xs text-slate-500">
              {loading
                ? "Refreshing admin records..."
                : `${superAdminCount + learningAdminCount} privileged accounts managed`}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {dashboardStats.map((stat) => {
          const Icon = stat.icon;

          return (
            <Card
              key={stat.label}
              className="border-slate-200 shadow-sm"
              bodyClassName="p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    {stat.label}
                  </p>
                  {loading ? (
                    <Skeleton className="mt-3 h-9 w-20" />
                  ) : (
                    <p className="mt-2 text-3xl font-bold leading-none text-slate-950">
                      {stat.value}
                    </p>
                  )}
                  <p className="mt-3 text-xs font-medium text-slate-500">
                    {stat.detail}
                  </p>
                </div>
                <div className={`rounded-xl p-3 ring-1 ${stat.iconClass}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card
        title="Create Super Admin Account"
        description="Register a trusted administrator with full access to system account management."
        className="shadow-sm"
      >
        <form className="space-y-5" onSubmit={handleCreateUser}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Input
              label="Name"
              value={userForm.name}
              onChange={(event) => {
                const nextValue = event.target.value;
                setUserForm((prev) => ({ ...prev, name: nextValue }));
                if (!nextValue.trim()) {
                  setUserFormErrors((prev) => ({
                    ...prev,
                    name: "Name cannot be blank.",
                  }));
                } else if (!/^[A-Za-z\s]+$/.test(nextValue.trim())) {
                  setUserFormErrors((prev) => ({
                    ...prev,
                    name: "Only letters and spaces are allowed.",
                  }));
                } else {
                  setUserFormErrors((prev) => ({ ...prev, name: undefined }));
                }
              }}
              error={userFormErrors.name}
            />
            <Input
              label="Email"
              type="email"
              value={userForm.email}
              onChange={(event) =>
                setUserForm((prev) => ({ ...prev, email: event.target.value }))
              }
              required
            />
            <Input
              label="Password"
              type="password"
              value={userForm.password}
              onChange={(event) =>
                setUserForm((prev) => ({
                  ...prev,
                  password: event.target.value,
                }))
              }
              required
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" isLoading={userFormLoading}>
              Create Super Admin
            </Button>
          </div>
        </form>
      </Card>

      <Card
        title="Assign Learning Admin Access"
        description="Search ERP employees and grant or remove Learning Admin privileges."
        className="shadow-sm"
        bodyClassName="p-0"
      >
        <div className="bg-white">
          <div className="grid grid-cols-1 gap-4 border-b border-slate-200 bg-slate-50/80 p-4 md:grid-cols-2 xl:grid-cols-3">
            <Input
              label="Search by Employee No"
              value={assignEmployeeNoSearch}
              onFocus={activateAssignEmployeeSearch}
              onChange={(event) =>
                handleAssignEmployeeNoChange(event.target.value)
              }
              placeholder="e.g. 011338"
              inputMode="numeric"
              error={assignSearchErrors.employeeNo}
            />
            <Input
              label="Search by Name"
              value={assignSurnameSearch}
              onFocus={activateAssignNameSearch}
              onChange={(event) =>
                handleAssignNameSearchChange(event.target.value)
              }
              placeholder="e.g. Mohamed"
              error={assignSearchErrors.name}
            />
            <Select
              label="Filter by Designation"
              value={assignDesignationFilter}
              onFocus={activateAssignFilterSearch}
              onChange={(event) =>
                handleAssignDesignationChange(event.target.value)
              }
              options={[
                { value: "", label: "All Designations" },
                ...designationOptions.map((option) => ({
                  value: option,
                  label: option,
                })),
              ]}
              isLoading={assignOptionsLoading}
            />
            <Select
              label="Filter by Grade"
              value={assignGradeFilter}
              onFocus={activateAssignFilterSearch}
              onChange={(event) => handleAssignGradeChange(event.target.value)}
              options={[
                { value: "", label: "All Grades" },
                ...gradeOptions.map((option) => ({
                  value: option,
                  label: option,
                })),
              ]}
              isLoading={assignOptionsLoading}
            />
            <Select
              label="Filter by Organization"
              value={assignOrganizationFilter}
              onFocus={activateAssignFilterSearch}
              onChange={(event) =>
                handleAssignOrganizationChange(event.target.value)
              }
              options={[
                { value: "", label: "All Organizations" },
                ...organizationOptions.map((option) => ({
                  value: option.organizationName,
                  label: option.parentOrganizationName
                    ? `${option.organizationName} (${option.parentOrganizationName})`
                    : option.organizationName,
                })),
              ]}
              isLoading={assignOptionsLoading}
            />
            <Select
              label="Executive / Non Executive"
              value={assignPayrollFilter}
              onFocus={activateAssignFilterSearch}
              onChange={(event) =>
                handleAssignPayrollChange(event.target.value)
              }
              options={[
                { value: "", label: "All Payrolls" },
                { value: "EXECUTIVE", label: "Executive" },
                { value: "NON_EXECUTIVE", label: "Non Executive" },
              ]}
              isLoading={assignOptionsLoading}
            />
          </div>

          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-medium text-slate-500">
              ERP results: {erpEmployees.length}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleAssignReset}
                disabled={
                  !assignEmployeeNoSearch &&
                  !assignSurnameSearch &&
                  !assignDesignationFilter &&
                  !assignGradeFilter &&
                  !assignOrganizationFilter &&
                  !assignPayrollFilter &&
                  erpEmployees.length === 0
                }
              >
                Reset
              </Button>
              <Button
                type="button"
                onClick={handleAssignSearch}
                isLoading={assignSearchLoading}
                disabled={
                  Boolean(
                    assignSearchErrors.employeeNo || assignSearchErrors.name,
                  ) ||
                  (!assignEmployeeNoSearch.trim() &&
                    !assignSurnameSearch.trim() &&
                    !assignDesignationFilter &&
                    !assignGradeFilter &&
                    !assignOrganizationFilter &&
                    !assignPayrollFilter)
                }
              >
                Search
              </Button>
            </div>
          </div>

          <div className="max-h-[26rem] overflow-auto">
            {assignSearchLoading ? (
              <div className="min-w-[1080px]">
                <div className="grid grid-cols-[1.3fr_0.9fr_1.1fr_0.8fr_1.4fr_1.2fr_0.9fr] gap-3 border-b border-slate-200 bg-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <span>Name</span>
                  <span>Emp No</span>
                  <span>Designation</span>
                  <span>Grade</span>
                  <span>Organization</span>
                  <span>Email</span>
                  <span>Learning Admin</span>
                </div>
                {assignResultsSkeletonRows.map((row) => (
                  <div
                    key={`assign-skeleton-${row}`}
                    className="grid grid-cols-[1.3fr_0.9fr_1.1fr_0.8fr_1.4fr_1.2fr_0.9fr] items-center gap-3 border-b border-slate-100 px-4 py-3"
                  >
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-5 w-36" />
                    <Skeleton className="h-5 w-14" />
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-5 w-28" />
                    <Skeleton className="h-8 w-20 rounded-lg" />
                  </div>
                ))}
              </div>
            ) : erpEmployees.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">
                Search ERP to load employees for Learning Admin assignment.
              </p>
            ) : (
              <div className="min-w-[1080px]">
                <div className="grid grid-cols-[1.3fr_0.9fr_1.1fr_0.8fr_1.4fr_1.2fr_0.9fr] gap-3 border-b border-slate-200 bg-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <span>Name</span>
                  <span>Emp No</span>
                  <span>Designation</span>
                  <span>Grade</span>
                  <span>Organization</span>
                  <span>Email</span>
                  <span>Learning Admin</span>
                </div>
                {erpEmployees.map((employee) => (
                  <div
                    key={employee.employeeNumber}
                    className="grid grid-cols-[1.3fr_0.9fr_1.1fr_0.8fr_1.4fr_1.2fr_0.9fr] items-center gap-3 border-b border-slate-100 px-4 py-3 text-sm text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    <span className="font-semibold text-slate-900">
                      {employee.employeeName}
                    </span>
                    <span>{employee.employeeNumber}</span>
                    <span>{employee.designation || "-"}</span>
                    <span>{employee.gradeName || "-"}</span>
                    <span>{employee.organizationName || "-"}</span>
                    <span className="break-all">{employee.email || "-"}</span>
                    <span>
                      {employee.isLearningAdmin ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleAssignLearningAdmin(employee, false)
                          }
                        >
                          Remove
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() =>
                            handleAssignLearningAdmin(employee, true)
                          }
                        >
                          Assign
                        </Button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card className="shadow-sm" bodyClassName="p-5">
        <div className="space-y-6">
          {usersByRole.map((section) => (
            <div
              key={section.key}
              className={`rounded-xl border ${section.panelClass}`}
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <h3
                  className={`text-base font-semibold ${section.headingClass}`}
                >
                  {section.label}
                </h3>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {section.users.length} users
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full table-fixed text-sm">
                  <thead>
                    <tr
                      className={`text-left border-b border-slate-200 ${section.headRowClass}`}
                    >
                      <th className="py-3 px-4 w-1/4 font-semibold">Name</th>
                      <th className="py-3 px-4 w-2/5 font-semibold">Email</th>
                      <th className="py-3 px-4 w-1/5 font-semibold">Status</th>
                      <th className="py-3 px-4 w-1/6 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      recentUsersSkeletonRows.map((row) => (
                        <tr
                          key={`${section.key}-skeleton-${row}`}
                          className="border-b border-slate-100"
                        >
                          <td className="py-3 px-4">
                            <Skeleton className="h-5 w-28" />
                          </td>
                          <td className="py-3 px-4">
                            <Skeleton className="h-5 w-40" />
                          </td>
                          <td className="py-3 px-4">
                            <Skeleton className="h-5 w-16" />
                          </td>
                          <td className="py-3 px-4">
                            <Skeleton className="h-8 w-20 rounded-lg" />
                          </td>
                        </tr>
                      ))
                    ) : section.users.length ? (
                      section.users.map((user) => (
                        <tr
                          key={user.id}
                          className="border-b border-slate-100 last:border-0"
                        >
                          <td className="py-3 px-4 font-medium text-slate-900">
                            {user.name}
                          </td>
                          <td className="py-3 px-4 text-slate-700 break-words">
                            {user.email}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={
                                user.is_active
                                  ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                                  : "rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700"
                              }
                            >
                              {user.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {user.is_active ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setPendingDeleteUser(user)}
                              >
                                Delete
                              </Button>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="py-4 px-4 text-slate-500" colSpan={4}>
                          No users found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <h3 className="text-base font-semibold text-slate-900">
                Learning Admins
              </h3>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {assignedLearningAdmins.length} users
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-sm">
                <thead>
                  <tr className="text-left border-b border-slate-200 bg-slate-100 text-slate-700">
                    <th className="py-3 px-4 w-1/4 font-semibold">Name</th>
                    <th className="py-3 px-4 w-2/5 font-semibold">Email</th>
                    <th className="py-3 px-4 w-1/5 font-semibold">Status</th>
                    <th className="py-3 px-4 w-1/6 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    recentUsersSkeletonRows.map((row) => (
                      <tr
                        key={`learning-admin-skeleton-${row}`}
                        className="border-b border-slate-100"
                      >
                        <td className="py-3 px-4">
                          <Skeleton className="mb-2 h-5 w-28" />
                          <Skeleton className="h-4 w-20" />
                        </td>
                        <td className="py-3 px-4">
                          <Skeleton className="h-5 w-40" />
                        </td>
                        <td className="py-3 px-4">
                          <Skeleton className="h-5 w-16" />
                        </td>
                        <td className="py-3 px-4">
                          <Skeleton className="h-8 w-20 rounded-lg" />
                        </td>
                      </tr>
                    ))
                  ) : assignedLearningAdmins.length ? (
                    assignedLearningAdmins.map((admin) => (
                      <tr
                        key={admin.employee_number}
                        className="border-b border-slate-100 last:border-0"
                      >
                        <td className="py-3 px-4">
                          <p className="font-medium text-slate-900">
                            {admin.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {admin.employee_number}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-slate-700 break-words">
                          {admin.email}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={
                              admin.is_active
                                ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                                : "rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700"
                            }
                          >
                            {admin.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleAssignLearningAdmin(
                                {
                                  employeeNumber: admin.employee_number,
                                  employeeName: admin.name,
                                  employeeSurname: "",
                                  email: admin.email,
                                  designation: admin.designation,
                                  grade_name: admin.grade_name,
                                  gradeName: admin.grade_name,
                                  organizationName: "",
                                  costCenterCode: "",
                                  costCenterName: "",
                                  employeeInitials: "",
                                  employeeSupervisorNumber: "",
                                  isLearningAdmin: true,
                                },
                                false,
                              )
                            }
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="py-4 px-4 text-slate-500" colSpan={4}>
                        No learning admins assigned.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Card>

      {pendingDeleteUser ? (
        <ModalOverlay className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Delete Account
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                This will permanently remove the account and related records.
              </p>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-slate-700">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-slate-900">
                  {pendingDeleteUser.name}
                </span>
                ?
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {pendingDeleteUser.email}
              </p>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPendingDeleteUser(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => handleDeleteUser(pendingDeleteUser.id)}
              >
                Delete
              </Button>
            </div>
          </div>
        </ModalOverlay>
      ) : null}
    </div>
  );
}
