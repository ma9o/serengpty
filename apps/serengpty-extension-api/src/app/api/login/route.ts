import { NextResponse } from 'next/server';
import { db } from '../../services/db';
import { usersTable } from '../../services/db/schema';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { compare } from 'bcrypt';
import { sql } from 'drizzle-orm';

export async function POST(request: Request) {
  try {
    const { name, password } = await request.json();

    if (!name || !password) {
      return NextResponse.json(
        { error: 'Name and password are required' },
        { status: 400 }
      );
    }

    // Find user by name
    const existingUsers = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.name, name));

    if (existingUsers.length === 0) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const user = existingUsers[0];

    // Verify password
    const passwordMatch = await compare(password, user.passwordHash);
    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Generate new API token
    const apiToken = randomBytes(32).toString('hex');

    // Update user with new token and expiry
    await db
      .update(usersTable)
      .set({
        apiToken,
        apiTokenExpiresAt: sql`NOW() + INTERVAL '30 days'`,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, user.id));

    return NextResponse.json({ apiToken });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
