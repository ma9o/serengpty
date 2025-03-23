import { NextResponse } from 'next/server';
import { db } from '../../services/db';
import { usersTable } from '../../services/db/schema';
import { eq } from 'drizzle-orm';
import { getStreamChatService } from '../../services/streamChat';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Verify the user exists in our database
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, userId),
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Generate token
    const tokenResult = await getStreamChatService().then((service) =>
      service.generateToken(user.id)
    );

    return NextResponse.json(tokenResult);
  } catch (error) {
    console.error('Chat token error:', error);
    return NextResponse.json(
      { token: null, error: 'Failed to generate chat token' },
      { status: 500 }
    );
  }
}
