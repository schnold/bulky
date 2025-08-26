import jwt from "jsonwebtoken";

interface SessionTokenPayload {
  iss: string; // Issuer - should be https://[shop].myshopify.com/admin
  dest: string; // Destination - shop domain
  aud: string; // Audience - your app's client ID
  sub: string; // Subject - user ID who made the request
  exp: number; // Expiration timestamp
  nbf: number; // Not before timestamp
  iat: number; // Issued at timestamp
  jti: string; // JWT ID - unique identifier
  sid: string; // Session ID
}

interface SessionTokenVerificationResult {
  isValid: boolean;
  payload?: SessionTokenPayload;
  error?: string;
}

/**
 * Verify and decode a session token from Shopify
 */
export function verifySessionToken(
  token: string,
  appSecret: string,
  expectedClientId?: string
): SessionTokenVerificationResult {
  try {
    // Verify and decode the JWT
    const payload = jwt.verify(token, appSecret, {
      algorithms: ["HS256"],
    }) as SessionTokenPayload;

    // Validate timestamp fields
    const now = Math.floor(Date.now() / 1000);
    
    if (payload.exp <= now) {
      return { isValid: false, error: "Token has expired" };
    }

    if (payload.nbf > now) {
      return { isValid: false, error: "Token not yet valid (nbf)" };
    }

    // Validate audience (client ID) if provided
    if (expectedClientId && payload.aud !== expectedClientId) {
      return { isValid: false, error: "Invalid audience (client ID mismatch)" };
    }

    // Validate issuer and destination domains match
    try {
      const issuerURL = new URL(payload.iss);
      const destURL = new URL(`https://${payload.dest}`);
      
      if (issuerURL.hostname !== destURL.hostname) {
        return { isValid: false, error: "Issuer and destination domains don't match" };
      }
    } catch (urlError) {
      return { isValid: false, error: "Invalid issuer or destination URL" };
    }

    return { isValid: true, payload };
  } catch (error) {
    console.error("Session token verification failed:", error);
    return { 
      isValid: false, 
      error: error instanceof Error ? error.message : "Token verification failed" 
    };
  }
}

/**
 * Extract session token from request headers
 */
export function extractSessionTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  
  if (!authHeader) {
    return null;
  }

  // Check for Bearer token format
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch) {
    return bearerMatch[1];
  }

  return null;
}

/**
 * Session token authentication middleware for Remix loaders/actions
 */
export function createSessionTokenMiddleware(options: {
  appSecret: string;
  clientId?: string;
  required?: boolean;
}) {
  return (request: Request) => {
    const token = extractSessionTokenFromRequest(request);
    
    if (!token) {
      if (options.required) {
        throw new Response("Missing session token", { status: 401 });
      }
      return { isAuthenticated: false };
    }

    const verification = verifySessionToken(token, options.appSecret, options.clientId);
    
    if (!verification.isValid) {
      if (options.required) {
        throw new Response(
          `Session token verification failed: ${verification.error}`, 
          { status: 401 }
        );
      }
      return { 
        isAuthenticated: false, 
        error: verification.error 
      };
    }

    return {
      isAuthenticated: true,
      payload: verification.payload!,
      shop: verification.payload!.dest,
      userId: verification.payload!.sub,
    };
  };
}

/**
 * Verify session token and get shop/user info from request
 */
export async function getSessionTokenInfo(request: Request): Promise<{
  shop?: string;
  userId?: string;
  isValid: boolean;
  error?: string;
}> {
  const appSecret = process.env.SHOPIFY_API_SECRET;
  const clientId = process.env.SHOPIFY_API_KEY;

  if (!appSecret) {
    return { isValid: false, error: "App secret not configured" };
  }

  const token = extractSessionTokenFromRequest(request);
  if (!token) {
    return { isValid: false, error: "No session token found" };
  }

  const verification = verifySessionToken(token, appSecret, clientId);
  
  if (!verification.isValid) {
    return { 
      isValid: false, 
      error: verification.error 
    };
  }

  return {
    isValid: true,
    shop: verification.payload!.dest,
    userId: verification.payload!.sub,
  };
}

export type { SessionTokenPayload };