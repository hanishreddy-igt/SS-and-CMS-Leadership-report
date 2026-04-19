import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";
import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

const GOOGLE_ISSUER_URL = "https://accounts.google.com";
const CALLBACK_PATH = "/api/auth/google/callback";

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(GOOGLE_ISSUER_URL),
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
    );
  },
  { maxAge: 3600 * 1000 },
);

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
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: sessionTtl,
    },
  });
}

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname.startsWith("127.");
}

function buildCallbackURL(req: { hostname: string; protocol: string; get: (h: string) => string | undefined }): string {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  const host = req.get("host") ?? req.hostname;
  const protocol = isLocalHost(req.hostname) ? "http" : "https";
  return `${protocol}://${host}${CALLBACK_PATH}`;
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any) {
  return await storage.upsertUser({
    id: typeof claims["sub"] === "string" ? claims["sub"] : String(claims["sub"]),
    email: typeof claims["email"] === "string" ? claims["email"] : null,
    firstName: typeof claims["given_name"] === "string" ? claims["given_name"] : null,
    lastName: typeof claims["family_name"] === "string" ? claims["family_name"] : null,
    profileImageUrl: typeof claims["picture"] === "string" ? claims["picture"] : null,
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
    verified: passport.AuthenticateCallback,
  ) => {
    try {
      const claims = tokens.claims();
      const email = typeof claims?.["email"] === "string" ? claims["email"] : null;
      const hd = typeof claims?.["hd"] === "string" ? claims["hd"] : null;
      const sub = claims?.["sub"];
      const userId = typeof sub === "string" ? sub : sub ? String(sub) : undefined;

      // Defense-in-depth: reject personal Gmail accounts.
      // The OAuth consent screen is configured as "Internal" in Google Cloud,
      // which is what actually enforces who can sign in. We check `hd` is
      // non-empty so we never compare against a hardcoded domain list — this
      // keeps the app open to every domain in the IgniteTech Workspace
      // (ignitetech.com, khoros.com, trilogy.com, devfactory.com, etc.).
      // Pass null as the error so passport routes to failureRedirect instead
      // of invoking the Express error handler (which crashes the process).
      if (!hd) {
        return verified(null, false);
      }

      const user: any = { email, userId };
      updateUserSession(user, tokens);
      const dbUser = await upsertUser(claims);
      // Existing users keep their original DB id (preserved by upsertUser's
      // email-first lookup), which may differ from Google's `sub`. Overwrite
      // claims.sub with the DB id so downstream `req.user.claims.sub`
      // lookups resolve to the correct row.
      if (dbUser?.id) {
        user.claims = { ...user.claims, sub: dbUser.id };
        user.userId = dbUser.id;
      }
      verified(null, user);
    } catch (error) {
      verified(error as Error, false);
    }
  };

  const registeredStrategies = new Set<string>();

  const ensureStrategy = (req: { hostname: string; protocol: string; get: (h: string) => string | undefined }) => {
    const strategyName = `google:${req.hostname}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile",
          callbackURL: buildCallbackURL(req),
        },
        verify,
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
    return strategyName;
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    const strategyName = ensureStrategy(req);
    passport.authenticate(strategyName, {
      scope: ["openid", "email", "profile"],
      prompt: "select_account",
    })(req, res, next);
  });

  app.get(CALLBACK_PATH, (req, res, next) => {
    const strategyName = ensureStrategy(req);
    passport.authenticate(strategyName, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/?error=unauthorized",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      req.session.destroy(() => {
        res.redirect("/");
      });
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Verify user still exists in the database.
  if (user.email) {
    try {
      const dbUser = await storage.getUserByEmail(user.email);
      if (!dbUser) {
        req.logout(() => {
          res.status(403).json({ message: "User account not found." });
        });
        return;
      }
    } catch (error) {
      console.error("Error validating user:", error);
      return res.status(500).json({ message: "Error validating user" });
    }
  }

  return next();
};
