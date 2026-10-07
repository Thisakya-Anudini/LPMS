import { query } from "../db.js";

const seed = async () => {
  try {
    console.log("Seeding sample training records...");

    // Fetch existing employees
    const employeesRes = await query(`
      SELECT e.principal_id, e.employee_number 
      FROM employees e 
      LIMIT 10;
    `);

    if (employeesRes.rows.length === 0) {
      console.log("No employees found to attach training records to.");
      process.exit(0);
    }

    const samplePrograms = [
      {
        name: "Full-Stack JavaScript Architecture",
        type: "ONLINE",
        hours: 8.5,
      },
      {
        name: "Enterprise Cloud Security & Compliance",
        type: "CLASSROOM",
        hours: 12.0,
      },
      {
        name: "Agile Leadership & Scrum Master Bootcamp",
        type: "HYBRID",
        hours: 16.0,
      },
      {
        name: "Database Optimization with PostgreSQL",
        type: "ONLINE",
        hours: 6.0,
      },
      {
        name: "Effective Cross-Functional Communication",
        type: "CLASSROOM",
        hours: 4.5,
      },
    ];

    for (const emp of employeesRes.rows) {
      for (let i = 0; i < 2; i++) {
        const prog =
          samplePrograms[Math.floor(Math.random() * samplePrograms.length)];
        await query(
          `
          INSERT INTO training_records (
            principal_id, 
            employee_number, 
            program_name, 
            training_type, 
            start_date, 
            end_date, 
            duration_hours, 
            status
          ) VALUES ($1, $2, $3, $4, '2026-01-15', '2026-02-10', $5, 'COMPLETED');
        `,
          [
            emp.principal_id,
            emp.employee_number,
            prog.name,
            prog.type,
            prog.hours,
          ],
        );
      }
    }

    console.log("Successfully seeded sample training records.");
    process.exit(0);
  } catch (error) {
    console.error("Failed to seed training records:", error);
    process.exit(1);
  }
};

seed();
