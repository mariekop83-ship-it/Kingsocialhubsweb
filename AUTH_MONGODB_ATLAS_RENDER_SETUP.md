# King Social Hub — MongoDB Atlas + Render Authentication Setup

The existing Node.js/Express application now serves premium black-and-gold registration and sign-in pages at `/register` and `/login` (also `/signup` and `/signin`). They use the existing `/api/auth/register` and `/api/auth/login` routes and the existing MongoDB `User` model.

## 1. Create the MongoDB Atlas database
1. Create a free MongoDB Atlas project and cluster at https://www.mongodb.com/cloud/atlas.
2. Under **Database Access**, create a database user with a strong password. This is separate from your Atlas website login.
3. Under **Network Access**, add the outbound access required by your Render service. For a first deployment, `0.0.0.0/0` can be used only with a strong database username/password; restrict access further where your setup allows.
4. Select **Connect → Drivers**, copy the Node.js connection string, and replace the username, password, and database name. Keep this URI private.

## 2. Configure Render
Create or update a Render **Web Service** for this project. Build command: `npm install`; start command: `npm start`. Add these environment variables in Render's Environment page:
- `MONGODB_URI` — the Atlas connection string, including the intended database name.
- `JWT_SECRET` — a random secret of at least 32 characters.
- `ADMIN_PASSCODE` — a long, unique admin passcode.
- `ADMIN_SECRET_PATH` — a long, random secret path value if the admin route requires it.
- `NODE_ENV` — `production`.
- `SITE_URL` — your deployed HTTPS site URL.

Do not commit `.env` or send database credentials/API keys in chat. The `.env.example` file is a template only; it is not a working database connection.

## Authentication behavior
- Registration requires name, email, phone, and an 8-character minimum password.
- Passwords are hashed with bcrypt (12 rounds); raw passwords are not stored.
- Email is normalized to lowercase and protected by the existing unique MongoDB email field/index. Existing phone numbers are checked before registration.
- Successful sign-in returns the existing signed JWT, which the auth pages store for compatibility with this app's current client-side authentication system. The token expiry follows the existing server configuration.
- These changes are source-code changes, not a live deployment. After configuring Atlas and Render, test registration, duplicate email/phone rejection, sign-in, sign-out behavior, and dashboard access before launch.
