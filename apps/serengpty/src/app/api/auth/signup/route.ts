import { NextRequest, NextResponse } from 'next/server';
import * as bcrypt from 'bcrypt';
import { prisma } from '../../../services/db/prisma';

/**
 * Anonymous user signup API endpoint
 * Accepts conversation data and password, creates a user account
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const password = formData.get('password') as string;
    const conversationsJson = formData.get('conversations') as string;

    if (!password || !conversationsJson) {
      return NextResponse.json(
        { error: 'Password and conversations data are required' },
        { status: 400 }
      );
    }

    // Parse the conversations data
    const conversations = JSON.parse(conversationsJson);

    // Hash the password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create anonymous user with just the password hash
    const user = await prisma.user.create({
      data: {
        passwordHash,
      },
    });

    // Here you would process the conversations data
    // This is where your data processing logic would go
    // For example, extracting entities, computing embeddings, etc.

    // For demonstration, we'll just return success
    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      userId: user.id,
    });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Failed to create user account' },
      { status: 500 }
    );
  }
}