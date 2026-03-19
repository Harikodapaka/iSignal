import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import clientPromise from '@/lib/mongodb-client';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: MongoDBAdapter(clientPromise),
  providers: [Google],
  callbacks: {
    session({ session, user }) {
      // Attach MongoDB userId and profile image to every session
      session.user.id = user.id;
      if (user.image) session.user.image = user.image;
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
});
