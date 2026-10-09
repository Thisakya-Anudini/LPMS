import { query } from "../db.js";
import crypto from "crypto";

async function runSeed() {
    console.log("🌱 Starting Talent Dashboard data seeding...\n");

    try {
        // 1. Ensure a principal & employee record exists for the active session (008668)
        let userPrincipalRes = await query(
            `SELECT id FROM auth_principals WHERE email = $1 LIMIT 1;`,
            ["008668@lpms.local"],
        );

        let activePrincipalId;
        if (userPrincipalRes.rows.length === 0) {
            const newPrinc = await query(
                `INSERT INTO auth_principals (id, email, password_hash, role, name, principal_type)
         VALUES (gen_random_uuid(), $1, 'DUMMY_HASH', 'SUPERVISOR', 'Nirmana Herath', 'EMPLOYEE')
         RETURNING id;`,
                ["008668@lpms.local"],
            );
            activePrincipalId = newPrinc.rows[0].id;
        } else {
            activePrincipalId = userPrincipalRes.rows[0].id;
        }

        // Ensure employee record for 008668
        await query(
            `INSERT INTO employees (principal_id, employee_number, designation, grade_name)
       VALUES ($1, '008668', 'Software Engineer', 'G5')
       ON CONFLICT DO NOTHING;`,
            [activePrincipalId],
        );

        // Self closure
        await query(
            `INSERT INTO org_hierarchy_closure (ancestor_principal_id, descendant_principal_id, depth)
       VALUES ($1, $1, 0)
       ON CONFLICT DO NOTHING;`,
            [activePrincipalId],
        );

        // 2. Create 5 sample subordinates under 008668
        const mockSubordinates = [
            {
                empNo: "EMP-1001",
                name: "Kasun Perera",
                designation: "Senior Software Engineer",
                grade: "G6",
            },
            {
                empNo: "EMP-1002",
                name: "Dilini Fernando",
                designation: "QA Engineer",
                grade: "G4",
            },
            {
                empNo: "EMP-1003",
                name: "Amila Silva",
                designation: "UI/UX Designer",
                grade: "G4",
            },
            {
                empNo: "EMP-1004",
                name: "Sahan Jayawardena",
                designation: "DevOps Engineer",
                grade: "G5",
            },
            {
                empNo: "EMP-1005",
                name: "Nadeesha De Silva",
                designation: "Software Engineer",
                grade: "G4",
            },
        ];

        const subordinateIds = [];

        for (const sub of mockSubordinates) {
            let subPrinc = await query(
                `SELECT id FROM auth_principals WHERE email = $1 LIMIT 1;`,
                [`${sub.empNo.toLowerCase()}@lpms.local`],
            );
            let sId;
            if (subPrinc.rows.length === 0) {
                const ins = await query(
                    `INSERT INTO auth_principals (id, email, password_hash, role, name, principal_type)
           VALUES (gen_random_uuid(), $1, 'DUMMY_HASH', 'EMPLOYEE', $2, 'EMPLOYEE')
           RETURNING id;`,
                    [`${sub.empNo.toLowerCase()}@lpms.local`, sub.name],
                );
                sId = ins.rows[0].id;
            } else {
                sId = subPrinc.rows[0].id;
            }

            await query(
                `INSERT INTO employees (principal_id, employee_number, designation, grade_name, supervisor_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING;`,
                [sId, sub.empNo, sub.designation, sub.grade, activePrincipalId],
            );

            // Link in hierarchy closure under 008668 (depth = 1)
            await query(
                `INSERT INTO org_hierarchy_closure (ancestor_principal_id, descendant_principal_id, depth)
         VALUES ($1, $2, 1)
         ON CONFLICT (ancestor_principal_id, descendant_principal_id) 
         DO UPDATE SET depth = 1;`,
                [activePrincipalId, sId],
            );

            // Self closure for subordinate
            await query(
                `INSERT INTO org_hierarchy_closure (ancestor_principal_id, descendant_principal_id, depth)
         VALUES ($1, $1, 0)
         ON CONFLICT DO NOTHING;`,
                [sId],
            );

            subordinateIds.push({ id: sId, empNo: sub.empNo });
        }

        // 3. Clear existing test training records to prevent duplicates
        await query(`DELETE FROM training_records;`);

        // 4. Insert training records for 008668 (Personal: 18.5 hrs total -> 100% Target Met!)
        const personalRecords = [
            {
                program: "Full-Stack System Architecture & Next.js",
                type: "ONLINE",
                start: "2026-01-15",
                end: "2026-01-20",
                hours: 8.5,
            },
            {
                program: "PostgreSQL Advanced Indexing & Query Tuning",
                type: "CLASSROOM",
                start: "2026-02-10",
                end: "2026-02-14",
                hours: 6.0,
            },
            {
                program: "Enterprise Security & OWASP Top 10",
                type: "HYBRID",
                start: "2026-03-01",
                end: "2026-03-03",
                hours: 4.0,
            },
        ];

        for (const rec of personalRecords) {
            await query(
                `INSERT INTO training_records (principal_id, employee_number, program_name, training_type, start_date, end_date, duration_hours, status)
         VALUES ($1, '008668', $2, $3, $4, $5, $6, 'COMPLETED');`,
                [
                    activePrincipalId,
                    rec.program,
                    rec.type,
                    rec.start,
                    rec.end,
                    rec.hours,
                ],
            );
        }

        // 5. Insert training records for subordinates (Cumulative: ~75 hrs across 5 staff -> avg 15.0h)
        const teamRecords = [
            {
                subIdx: 0,
                program: "Kubernetes & Docker in Production",
                type: "ONLINE",
                hours: 20.0,
                date: "2026-02-15",
            },
            {
                subIdx: 1,
                program: "Automated Testing with Playwright & Vitest",
                type: "CLASSROOM",
                hours: 15.0,
                date: "2026-02-22",
            },
            {
                subIdx: 2,
                program: "Figma Design Systems & Accessibility",
                type: "ONLINE",
                hours: 12.0,
                date: "2026-03-01",
            },
            {
                subIdx: 3,
                program: "Cloud Infrastructure CI/CD Pipelines",
                type: "HYBRID",
                hours: 18.0,
                date: "2026-01-28",
            },
            {
                subIdx: 4,
                program: "Node.js Performance Optimization",
                type: "EXTERNAL",
                hours: 10.0,
                date: "2026-03-10",
            },
        ];

        for (const rec of teamRecords) {
            const sub = subordinateIds[rec.subIdx];
            await query(
                `INSERT INTO training_records (principal_id, employee_number, program_name, training_type, start_date, end_date, duration_hours, status)
         VALUES ($1, $2, $3, $4, $5, $5, $6, 'COMPLETED');`,
                [sub.id, sub.empNo, rec.program, rec.type, rec.date, rec.hours],
            );
        }

        console.log("✅ Seeding completed successfully!");
        console.log(
            "   • Active User (008668): 18.5 personal training hours (Target Met)",
        );
        console.log("   • Subordinates seeded: 5 staff members");
        console.log(
            "   • Total Team Hours: 75.0 hrs (Average: 15.0 hrs / staff vs 18.0h target)",
        );
    } catch (error) {
        console.error("❌ Seeding failed:", error);
    } finally {
        process.exit(0);
    }
}

runSeed();
