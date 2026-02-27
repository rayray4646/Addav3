# Deployment Instructions

## 1. Setup Supabase
1. Create a new project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor** and run the contents of `supabase_schema.sql`.
3. Go to **Authentication** -> **Providers** -> **Email** and disable "Confirm email" (for easier onboarding).
4. Copy your **Project URL** and **Anon Key**.

## 2. Deploy to Vercel
1. Push this code to a GitHub repository.
2. Go to [vercel.com](https://vercel.com) and create a new project.
3. Import your repository.
4. Add the following **Environment Variables**:
   - `VITE_SUPABASE_URL`: Your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase Anon Key
5. Click **Deploy**.

## 3. Final Config
1. Once deployed, copy your Vercel URL (e.g., `https://my-hangout.vercel.app`).
2. Go to Supabase Dashboard -> **Authentication** -> **URL Configuration**.
3. Add your Vercel URL to **Site URL** and **Redirect URLs**.
