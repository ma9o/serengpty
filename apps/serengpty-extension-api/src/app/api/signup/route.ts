import { NextResponse } from 'next/server';
import { db } from '../../services/db';
import { usersTable } from '../../services/db/schema';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { hash } from 'bcrypt';

export async function POST(request: Request) {
  try {
    const { name, password } = await request.json();

    if (!name || !password) {
      return NextResponse.json(
        { error: 'Name and password are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUsers = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.name, name));

    if (existingUsers.length > 0) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hash(password, 10);

    // Generate API token
    const apiToken = randomBytes(32).toString('hex');

    // Create new user
    await db
      .insert(usersTable)
      .values({
        name,
        passwordHash,
        apiToken,
        updatedAt: new Date(),
      })
      .returning({ id: usersTable.id });

    return NextResponse.json({ apiToken });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
