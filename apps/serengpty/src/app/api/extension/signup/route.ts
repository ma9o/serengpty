import { NextResponse } from 'next/server';
import { db, usersTable } from '@enclaveid/db';
import { generateUniqueUsername } from '@enclaveid/shared-utils';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { upsertStreamChatUser } from '../../../utils/upsertStreamChatUser';

export async function POST() {
  try {
    let name = await generateUniqueUsername();

    // Make sure the name is not already taken
    let existingUser = await db.query.usersTable.findFirst({
      where: eq(usersTable.name, name),
    });

    while (existingUser) {
      name = await generateUniqueUsername();
      existingUser = await db.query.usersTable.findFirst({
        where: eq(usersTable.name, name),
      });
    }

    const randomPassword = Math.random().toString(36).substring(2, 15);

    // Create new user
    const results = await db
      .insert(usersTable)
      .values({
        name,
        passwordHash: await bcrypt.hash(randomPassword, 10), // Set random password hash that can be changed later
      })
      .returning();

    const user = results[0];

    await upsertStreamChatUser(user);

    return NextResponse.json({
      userId: user.id,
      name: user.name,
      apiKey: user.extensionApiKey,
    });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
