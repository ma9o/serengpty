import { NextRequest, NextResponse } from 'next/server';
import * as bcrypt from 'bcrypt';
import { prisma } from '../../../services/db/prisma';
import { azureContainerClient } from '../../../services/azure/storage';
import path from 'path';
import fs from 'fs';
import { getUniqueUsername } from '../../../actions/getUniqueUsername';
import { validateUsername } from '../../../actions/validateUsername';
import { StreamChat } from 'stream-chat';
import { signIn } from '../../../services/auth';

/**
 * Anonymous user signup API endpoint
 * Accepts conversation data and password, creates a user account
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const password = formData.get('password') as string;
    const conversationsJson = formData.get('conversations') as string;
    const customUsername = formData.get('username') as string | null;

    if (!password || !conversationsJson) {
      return NextResponse.json(
        { error: 'Password and conversations data are required' },
        { status: 400 }
      );
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(password, 10);

    // Use custom username if provided and valid, otherwise generate one
    let name: string;

    if (customUsername) {
      // Validate the custom username
      const { isValid, message } = await validateUsername(customUsername);

      if (!isValid) {
        return NextResponse.json(
          { error: message || 'Invalid username' },
          { status: 400 }
        );
      }

      name = customUsername;
    } else {
      // Generate a unique name using the existing function
      name = await getUniqueUsername();
    }

    // Create anonymous user with password hash and generated name
    const user = await prisma.user.create({
      data: {
        passwordHash,
        name,
      },
    });

    // Save the conversations.json file to Azure storage or local filesystem
    // depending on the environment
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction) {
      // Save to Azure Blob Storage
      // Create a blob name with user id and path that matches the expected structure
      // The path should match what's expected by the parsed_conversations asset
      const blobName = `api/${user.id}/openai/latest.json`;

      // Upload the conversations JSON as a blob
      const blockBlobClient = azureContainerClient.getBlockBlobClient(blobName);
      await blockBlobClient.upload(conversationsJson, conversationsJson.length);
    } else {
      // In development, save to local filesystem
      // Create local directory structure that matches the expected structure
      const localDataDir = path.join(process.cwd(), '../data-pipeline/data');
      const userDir = path.join(
        localDataDir,
        'api',
        user.id.toString(),
        'openai'
      );

      // Create directory if it doesn't exist
      await fs.promises.mkdir(userDir, { recursive: true });

      // Write the conversations JSON to file
      await fs.promises.writeFile(
        path.join(userDir, 'latest.json'),
        conversationsJson
      );
    }

    // Create a StreamChat user
    await StreamChat.getInstance(
      process.env.NEXT_PUBLIC_STREAM_CHAT_API_KEY!,
      process.env.STREAM_CHAT_API_SECRET!
    ).upsertUser({
      id: user.id,
      role: 'user',
      name: user.name,
    });

    // Authenticate the user
    await signIn('credentials', {
      username: user.name,
      password: password,
      redirect: false,
    });

    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      userId: user.id,
      username: user.name, // Include username in the response
    });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Failed to create user account' },
      { status: 500 }
    );
  }
}
