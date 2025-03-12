import NextAuth, { CredentialsSignin } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from './db/prisma';
import { PrismaClient } from '@prisma/client';
import { Adapter } from 'next-auth/adapters';
import * as bcrypt from 'bcrypt';

// fix: Record to delete does not exist. https://github.com/nextauthjs/next-auth/issues/4495
function CustomPrismaAdapter(p: PrismaClient): Adapter {
  const origin = PrismaAdapter(p);
  return {
    ...origin,
    deleteSession: async (sessionToken: string) => {
      try {
        return await p.session.deleteMany({ where: { sessionToken } });
      } catch (e) {
        console.error('Failed to delete session', e);
        return null;
      }
    },
    // Override createUser to allow for anonymous users
    createUser: async (user) => {
      // User name will be assigned by the adapter

      // Handle anonymous users without email
      return await p.user.create({
        data: {
          ...user,
          email: user.email || null, // Allow null emails
        },
      });
    },
  } as unknown as Adapter;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: CustomPrismaAdapter(prisma),
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
    // Add custom error page if needed
    error: '/auth/error',
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new CredentialsSignin();
        }

        // Find the user by username
        const user = await prisma.user.findUnique({
          where: {
            name: credentials.username as string,
          },
        });

        // If user is found, verify password
        if (user && user.passwordHash) {
          const isValid = await bcrypt.compare(
            credentials.password as string,
            user.passwordHash
          );

          if (isValid) {
            return {
              id: user.id,
              name: user.name,
              email: user.email || null,
            };
          }
        }

        throw new CredentialsSignin();
      },
    }),
  ],
  callbacks: {
    // Add custom callbacks as needed
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // Ensure name and email are properly handled for anonymous users
        token.name = user.name || null;
        token.email = user.email || null;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        // Ensure name and email are properly handled for anonymous users
        session.user.name = (token.name as string) || null;
        session.user.email = (token.email as string) || null;
      }
      return session;
    },
    authorized: async ({ auth }) => {
      // Logged in users are authenticated, otherwise redirect to login page
      return !!auth;
    },
  },
});
