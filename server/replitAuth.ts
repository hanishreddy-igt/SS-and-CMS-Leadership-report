import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

// Allowed email domains for authentication
const ALLOWED_DOMAINS = ['ignitetech.com'];

function isAllowedDomain(email: string | null | undefined): boolean {
  if (!email) return false;
  
  const domain = email.split('@')[1];
  return ALLOWED_DOMAINS.includes(domain);
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: 'lax', // Required for OAuth redirects
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  const email = typeof claims["email"] === "string" ? claims["email"] : null;
  
  // Validate domain restriction
  if (!isAllowedDomain(email)) {
    throw new Error(`Access denied. Only @${ALLOWED_DOMAINS.join(' and @')} email addresses are allowed.`);
  }

  await storage.upsertUser({
    id: typeof claims["sub"] === "string" ? claims["sub"] : claims["sub"]?.toString(),
    email: email,
    firstName: typeof claims["first_name"] === "string" ? claims["first_name"] : null,
    lastName: typeof claims["last_name"] === "string" ? claims["last_name"] : null,
    profileImageUrl: typeof claims["profile_image_url"] === "string" ? claims["profile_image_url"] : null,
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    try {
      const claims = tokens.claims();
      const email = typeof claims?.["email"] === "string" ? claims["email"] : null;
      const sub = claims?.["sub"];
      const userId = typeof sub === "string" ? sub : (sub ? String(sub) : undefined);
      
      // Validate domain before creating session
      if (!isAllowedDomain(email)) {
        return verified(new Error(`Access denied. Only @${ALLOWED_DOMAINS.join(' and @')} email addresses are allowed.`), false);
      }

      // Store email domain in user object for revalidation
      const user: any = { 
        email: email,
        userId: userId,
      };
      updateUserSession(user, tokens);
      await upsertUser(claims);
      verified(null, user);
    } catch (error) {
      verified(error as Error, false);
    }
  };

  // Keep track of registered strategies per hostname
  const registeredStrategies = new Set<string>();

  // Helper to ensure strategy exists for a hostname
  const ensureStrategy = (hostname: string) => {
    const strategyName = `replitauth:${hostname}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${hostname}/api/callback`,
        },
        verify,
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login?error=unauthorized",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Revalidate domain restriction on every request
  const userEmail = user.email;
  if (!isAllowedDomain(userEmail)) {
    // Domain no longer allowed - destroy session
    req.logout(() => {
      res.status(403).json({ message: "Access denied. Your email domain is not authorized." });
    });
    return;
  }

  // Verify user still exists in database
  if (user.userId) {
    try {
      const dbUser = await storage.getUser(user.userId);
      if (!dbUser || !isAllowedDomain(dbUser.email)) {
        req.logout(() => {
          res.status(403).json({ message: "User account not found or domain not authorized." });
        });
        return;
      }
    } catch (error) {
      console.error("Error validating user:", error);
      return res.status(500).json({ message: "Error validating user" });
    }
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
