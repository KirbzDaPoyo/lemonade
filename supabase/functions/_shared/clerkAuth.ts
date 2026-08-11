import { createRemoteJWKSet, jwtVerify } from 'npm:jose@6.1.3';

const clerkIssuer =
  Deno.env.get('CLERK_ISSUER_URL') ??
  'https://warm-kiwi-31.clerk.accounts.dev';
const clerkJwks = createRemoteJWKSet(
  new URL(clerkIssuer + '/.well-known/jwks.json')
);

export class ClerkAuthenticationError extends Error {}

export const requireClerkUser = async (request: Request) => {
  const authorization = request.headers.get('Authorization');

  if (!authorization?.startsWith('Bearer ')) {
    throw new ClerkAuthenticationError('Authentication is required.');
  }

  const token = authorization.slice('Bearer '.length).trim();

  try {
    const { payload } = await jwtVerify(token, clerkJwks, {
      issuer: clerkIssuer
    });

    if (typeof payload.sub !== 'string' || payload.role !== 'authenticated') {
      throw new ClerkAuthenticationError('The authenticated session is invalid.');
    }

    return { userId: payload.sub };
  } catch (error) {
    if (error instanceof ClerkAuthenticationError) {
      throw error;
    }

    throw new ClerkAuthenticationError('The authenticated session is invalid.');
  }
};
