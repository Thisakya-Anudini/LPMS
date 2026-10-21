import { query } from "../../db.js";
import { ROLES } from "../../constants/roles.js";

const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_SORT_COLUMNS = {
    startDate: "tr.start_date",
    endDate: "tr.end_date",
    durationHours: "tr.duration_hours",
    programName: "tr.program_name",
    employeeNumber: "tr.employee_number",
    fullName: "COALESCE(ap.name, tr.employee_number)",
    trainingType: "tr.training_type",
    status: "tr.status",
};

/**
 * Builds dynamic SQL parameter filters for training history queries.
 */
const buildHistoryFilters = (filters = {}, startIndex = 1) => {
    const conditions = [];
    const params = [];
    let index = startIndex;

    if (filters.startDate) {
        conditions.push(`tr.start_date >= $${index}`);
        params.push(filters.startDate);
        index++;
    }
    if (filters.endDate) {
        conditions.push(`tr.end_date <= $${index}`);
        params.push(filters.endDate);
        index++;
    }
    if (filters.trainingType && filters.trainingType !== "ALL") {
        conditions.push(`tr.training_type = $${index}`);
        params.push(filters.trainingType);
        index++;
    }
    if (filters.designation && filters.designation !== "ALL") {
        conditions.push(
            `tr.principal_id IN (SELECT principal_id FROM employees WHERE designation = $${index})`,
        );
        params.push(filters.designation);
        index++;
    }
    if (filters.search && String(filters.search).trim() !== "") {
        const searchPattern = `%${String(filters.search).trim()}%`;
        conditions.push(
            `(tr.program_name ILIKE $${index} OR tr.employee_number ILIKE $${index} OR ap.name ILIKE $${index})`,
        );
        params.push(searchPattern);
        index++;
    }

    const clause = conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : "";
    return { clause, params, nextIndex: index };
};

/**
 * Resolves the target identifier (UUID or employee service number).
 */
const resolveTarget = async (targetPrincipalId, employeeNumber) => {
    let resolvedPrincipalId = targetPrincipalId;
    const lookupEmpNo =
        employeeNumber ||
        (targetPrincipalId && !UUID_REGEX.test(targetPrincipalId)
            ? targetPrincipalId.replace(/^erp-learner-/, "")
            : null);

    if (targetPrincipalId && !UUID_REGEX.test(targetPrincipalId) && lookupEmpNo) {
        const empRes = await query(
            `SELECT principal_id FROM employees WHERE employee_number = $1 LIMIT 1;`,
            [lookupEmpNo],
        );
        if (empRes.rows.length > 0 && empRes.rows[0]?.principal_id) {
            resolvedPrincipalId = empRes.rows[0].principal_id;
        }
    }

    const isValidUuid = Boolean(
        resolvedPrincipalId && UUID_REGEX.test(resolvedPrincipalId),
    );

    return { resolvedPrincipalId, lookupEmpNo, isValidUuid };
};

/**
 * Fetches paginated training history records scoped to user's organizational tree.
 */
export const getPaginatedTrainingHistory = async ({
    callerRole,
    isLearningAdmin = false,
    targetPrincipalId,
    employeeNumber,
    isSelfView,
    filters = {},
    page = 1,
    pageSize = 10,
    sortBy = "startDate",
    sortOrder = "DESC",
}) => {
    const { resolvedPrincipalId, lookupEmpNo, isValidUuid } = await resolveTarget(
        targetPrincipalId,
        employeeNumber,
    );

    const isAdminGlobal =
        isSelfView &&
        (callerRole === ROLES.SUPER_ADMIN ||
            callerRole === ROLES.LEARNING_ADMIN ||
            Boolean(isLearningAdmin));

    const validPage = Math.max(1, parseInt(page, 10) || 1);
    const validPageSize = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 10));
    const offset = (validPage - 1) * validPageSize;

    const sortColumn = ALLOWED_SORT_COLUMNS[sortBy] || "tr.start_date";
    const validSortOrder =
        String(sortOrder).toUpperCase() === "ASC" ? "ASC" : "DESC";

    let scopeJoin = "";
    let scopeCondition = "";
    const initialParams = [];
    let paramIndex = 1;

    if (isAdminGlobal) {
        // Global scope: view all records
        scopeCondition = "1=1";
    } else if (isValidUuid) {
        // Supervisor scope: view all descendants in closure tree
        scopeJoin = `
      INNER JOIN org_hierarchy_closure ohc 
        ON tr.principal_id = ohc.descendant_principal_id
    `;
        scopeCondition = `ohc.ancestor_principal_id = $${paramIndex} AND ohc.depth > 0`;
        initialParams.push(resolvedPrincipalId);
        paramIndex++;
    } else {
        // Individual learner scope
        const selfParam = isValidUuid ? resolvedPrincipalId : lookupEmpNo;
        const selfField = isValidUuid ? "tr.principal_id" : "tr.employee_number";

        if (selfParam) {
            scopeCondition = `${selfField} = $${paramIndex}`;
            initialParams.push(selfParam);
            paramIndex++;
        } else {
            return { records: [], total: 0, page: validPage, pageSize: validPageSize, totalPages: 0 };
        }
    }

    const { clause: filterClause, params: filterParams, nextIndex } =
        buildHistoryFilters(filters, paramIndex);

    const queryParams = [...initialParams, ...filterParams];

    // 1. Get total record count matching filters
    const countSql = `
    SELECT COUNT(*)::int AS total
    FROM training_records tr
    LEFT JOIN auth_principals ap ON tr.principal_id = ap.id
    LEFT JOIN employees e ON tr.principal_id = e.principal_id
    ${scopeJoin}
    WHERE ${scopeCondition} ${filterClause};
  `;
    const countRes = await query(countSql, queryParams);
    const total = countRes.rows[0]?.total || 0;

    // 2. Query paginated records
    const limitIndex = nextIndex;
    const offsetIndex = nextIndex + 1;
    const paginationParams = [...queryParams, validPageSize, offset];

    const dataSql = `
    SELECT 
      tr.id,
      tr.employee_number AS "employeeNumber",
      COALESCE(ap.name, 'Employee ' || tr.employee_number) AS "fullName",
      COALESCE(e.designation, 'Employee') AS "designation",
      COALESCE(e.grade_name, 'General') AS "department",
      tr.program_name AS "programName",
      tr.training_type AS "trainingType",
      TO_CHAR(tr.start_date, 'YYYY-MM-DD') AS "startDate",
      TO_CHAR(tr.end_date, 'YYYY-MM-DD') AS "endDate",
      tr.duration_hours::numeric(10, 2) AS "durationHours",
      tr.status
    FROM training_records tr
    LEFT JOIN auth_principals ap ON tr.principal_id = ap.id
    LEFT JOIN employees e ON tr.principal_id = e.principal_id
    ${scopeJoin}
    WHERE ${scopeCondition} ${filterClause}
    ORDER BY ${sortColumn} ${validSortOrder}, tr.id ASC
    LIMIT $${limitIndex} OFFSET $${offsetIndex};
  `;

    const dataRes = await query(dataSql, paginationParams);

    const records = dataRes.rows.map((row) => ({
        ...row,
        durationHours: parseFloat(row.durationHours || "0"),
    }));

    const totalPages = Math.ceil(total / validPageSize);

    return {
        records,
        total,
        page: validPage,
        pageSize: validPageSize,
        totalPages,
    };
};

/**
 * Escapes values for safe RFC 4180 CSV output.
 */
const escapeCsvValue = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
};

/**
 * Generates an RFC 4180 compliant CSV stream/string of training history.
 * Includes UTF-8 BOM (\uFEFF) for immediate, native Microsoft Excel compatibility.
 */
export const generateTrainingHistoryCsv = async ({
    callerRole,
    isLearningAdmin = false,
    targetPrincipalId,
    employeeNumber,
    isSelfView,
    filters = {},
}) => {
    // Fetch up to 10,000 in-scope matching records for export
    const { records } = await getPaginatedTrainingHistory({
        callerRole,
        isLearningAdmin,
        targetPrincipalId,
        employeeNumber,
        isSelfView,
        filters,
        page: 1,
        pageSize: 10000,
        sortBy: "startDate",
        sortOrder: "DESC",
    });

    const headers = [
        "Record ID",
        "Employee Number",
        "Full Name",
        "Designation",
        "Department",
        "Program Name",
        "Training Type",
        "Start Date",
        "End Date",
        "Duration (Hours)",
        "Status",
    ];

    const rows = records.map((r) => [
        escapeCsvValue(r.id),
        escapeCsvValue(r.employeeNumber),
        escapeCsvValue(r.fullName),
        escapeCsvValue(r.designation),
        escapeCsvValue(r.department),
        escapeCsvValue(r.programName),
        escapeCsvValue(r.trainingType),
        escapeCsvValue(r.startDate),
        escapeCsvValue(r.endDate),
        escapeCsvValue(r.durationHours.toFixed(2)),
        escapeCsvValue(r.status),
    ]);

    // UTF-8 BOM + CSV content
    const csvContent =
        "\uFEFF" +
        [headers.join(","), ...rows.map((row) => row.join(","))].join("\r\n");

    return csvContent;
};
