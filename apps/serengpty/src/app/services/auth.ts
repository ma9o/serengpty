import NextAuth, { CredentialsSignin } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import * as bcrypt from 'bcrypt';
import {
  db,
  accountsTable,
  sessionsTable,
  usersTable,
  verificationTokensTable,
  authenticatorsTable,
} from '@enclaveid/db';
import { eq } from 'drizzle-orm';
export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db, {
    accountsTable,
    sessionsTable,
    verificationTokensTable,
    authenticatorsTable,
    usersTable,
  }),
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
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
        const user = await db.query.usersTable.findFirst({
          where: eq(usersTable.name, credentials.username as string),
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
        token.name = user.name || null;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        // Ensure name and email are properly handled for anonymous users
        session.user.name = (token.name as string) || null;
      }
      return session;
    },
    authorized: async ({ auth }) => {
      // Logged in users are authenticated, otherwise redirect to login page
      return !!auth;
    },
  },
});
