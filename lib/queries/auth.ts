import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  outlet_id?: number;
  outlet_name?: string;
  created_at: string;
}

export async function getUserByEmail(email: string) {
  const result = await query(
    `SELECT u.*, o.name AS outlet_name FROM users u LEFT JOIN outlets o ON o.id = u.outlet_id WHERE u.email = $1`,
    [email]
  );
  return result.rows[0] ?? null;
}

export async function getUserById(id: number) {
  const result = await query(
    `SELECT u.*, o.name AS outlet_name FROM users u LEFT JOIN outlets o ON o.id = u.outlet_id WHERE u.id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function validatePassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, 12);
}

export async function getUsers() {
  const result = await query<User>(
    `SELECT u.id, u.name, u.email, u.role, u.outlet_id, u.created_at, o.name AS outlet_name
     FROM users u LEFT JOIN outlets o ON o.id = u.outlet_id
     ORDER BY u.name`
  );
  return result.rows;
}

export async function getDemoUsers() {
  const result = await query(
    'SELECT name, email, role, outlet_id FROM users ORDER BY id ASC'
  );
  return result.rows;
}

export async function createUser(data: {
  name: string;
  email: string;
  password?: string;
  role: string;
  outlet_id?: number;
}) {
  const hash = data.password ? await hashPassword(data.password) : null;
  const result = await query(
    `INSERT INTO users (name, email, password_hash, role, outlet_id) VALUES ($1,$2,$3,$4,$5) RETURNING id, name, email, role, outlet_id, created_at`,
    [data.name, data.email, hash, data.role, data.outlet_id ?? null]
  );
  return result.rows[0];
}

export async function updateUser(id: number, data: Partial<{ name: string; email: string; password: string; role: string; outlet_id: number | null }>) {
  const fields: string[] = [];
  const values: unknown[] = [id];
  let i = 2;

  if (data.name !== undefined) { fields.push(`name = $${i++}`); values.push(data.name); }
  if (data.email !== undefined) { fields.push(`email = $${i++}`); values.push(data.email); }
  if (data.password !== undefined) {
    const hash = await hashPassword(data.password);
    fields.push(`password_hash = $${i++}`); values.push(hash);
  }
  if (data.role !== undefined) { fields.push(`role = $${i++}`); values.push(data.role); }
  if (data.outlet_id !== undefined) { fields.push(`outlet_id = $${i++}`); values.push(data.outlet_id); }

  if (!fields.length) return null;
  const result = await query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $1 RETURNING id, name, email, role, outlet_id`,
    values
  );
  return result.rows[0] ?? null;
}
