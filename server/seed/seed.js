import { connectDB } from '../config/db.js';
import * as userModel from '../models/userModel.js';
import * as doctorModel from '../models/doctorModel.js';
import * as authService from '../services/authService.js';

const DEMO_USERS = [
  { name: 'Ava Administrator', email: 'admin@mediqueue.test', password: 'Admin@123', role: 'admin' },
  { name: 'Riya Reception', email: 'reception@mediqueue.test', password: 'Reception@123', role: 'receptionist' },
  { name: 'Dr. Sam Patel', email: 'doctor@mediqueue.test', password: 'Doctor@123', role: 'doctor' },
  { name: 'Nina Nurse', email: 'nurse@mediqueue.test', password: 'Nurse@123', role: 'nurse' },
];

async function seed() {
  const db = await connectDB();

  console.log('[seed] Seeding demo users...');

  for (const demo of DEMO_USERS) {
    let user = await userModel.findByEmail(demo.email);
    if (user) {
      console.log(`[seed] Skipping ${demo.email} (already exists)`);
    } else {
      const passwordHash = await authService.hashPassword(demo.password);
      user = await userModel.create({
        name: demo.name,
        email: demo.email,
        passwordHash,
        role: demo.role,
        isActive: true,
      });
      console.log(`[seed] Created ${demo.role}: ${demo.email}`);
    }

    if (demo.role === 'doctor') {
      const existingDoc = await doctorModel.findByUserId(user.id);
      if (!existingDoc) {
        const departments = db.data.departments || [];
        const dept = departments.find((d) => d.name === 'Cardiology' || d.name === 'General Medicine') || departments[0];
        if (dept) {
          await doctorModel.create({
            userId: user.id,
            name: demo.name,
            specialization: 'Cardiologist',
            departmentId: dept.id,
            avgConsultationMinutes: 15,
          });
          console.log(`[seed] Linked doctor profile for: ${demo.email}`);
        }
      }
    }
  }

  console.log('[seed] Done.');
  console.log('\nDemo credentials:');
  for (const demo of DEMO_USERS) {
    console.log(`  ${demo.role.padEnd(13)} ${demo.email.padEnd(28)} ${demo.password}`);
  }

  await db.write();
  process.exit(0);
}

seed().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
