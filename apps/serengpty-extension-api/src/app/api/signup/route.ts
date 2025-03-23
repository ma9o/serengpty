import { NextResponse } from 'next/server';
import { db } from '../../services/db';
import { usersTable } from '../../services/db/schema';
import { generateUniqueUsername } from '@enclaveid/shared-utils';
import { eq } from 'drizzle-orm';
import { getStreamChatService } from '../../services/streamChat';

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

    // Create new user
    const results = await db
      .insert(usersTable)
      .values({
        name,
        updatedAt: new Date(),
      })
      .returning({ id: usersTable.id, name: usersTable.name });

    const user = results[0];

    // Create the user in Stream Chat
    await getStreamChatService().then((service) =>
      service.upsertUser({
        id: user.id,
        name: user.name,
        role: 'user',
      })
    );

    return NextResponse.json({ userId: user.id, name: user.name });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
