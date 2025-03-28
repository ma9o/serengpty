import { NextRequest, NextResponse } from 'next/server';
import * as bcrypt from 'bcrypt';
import { getUniqueUsername } from '../../../actions/getUniqueUsername';
import { validateUsername } from '../../../actions/validateUsername';
import { signIn } from '../../../services/auth';
import { upsertStreamChatUser } from '../../../utils/upsertStreamChatUser';
import { BlobSASPermissions } from '@azure/storage-blob';
import { usersTable } from '@enclaveid/db';
import { db } from '@enclaveid/db';
import {
  getAzureContainerClient,
  usernameSchema,
} from '@enclaveid/shared-utils';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const customUsername = formData.get('username') as string | null;
    const password = formData.get('password') as string;
    const providerName = formData.get('providerName') as string;

    if (!password) {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(password, 10);

    // Use custom username if provided and valid, otherwise generate one
    let name: string;

    if (customUsername) {
      // First validate format with schema
      const schemaResult = usernameSchema.safeParse(customUsername);
      if (!schemaResult.success) {
        return NextResponse.json(
          { error: schemaResult.error.errors[0].message },
          { status: 400 }
        );
      }

      // Then check availability
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
    const user = (
      await db
        .insert(usersTable)
        .values({
          passwordHash,
          name,
        })
        .returning()
    )[0];

    let uploadUrl: string | null = null;

    // Generate Azure presigned URL for client-side upload
    // Create a blob name with user id and path that matches the expected structure
    const blobName = `api/${user.id}/${providerName}/latest.json`;

    // Get the block blob client and generate presigned URL
    const blockBlobClient =
      getAzureContainerClient().getBlockBlobClient(blobName);

    // Generate a SAS token that expires in 15 minutes
    uploadUrl = await blockBlobClient.generateSasUrl({
      permissions: BlobSASPermissions.from({
        read: true,
        write: true,
        create: true,
        delete: true,
      }),
      expiresOn: new Date(new Date().valueOf() + 15 * 60 * 1000), // 15 minutes
      contentType: 'application/json',
    });

    // Create a StreamChat user
    await upsertStreamChatUser(user);

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
      username: user.name,
      uploadUrl,
    });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Failed to create user account' },
      { status: 500 }
    );
  }
}
