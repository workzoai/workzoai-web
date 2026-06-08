# Supabase login callback fix

Replace/add:
- app/auth/callback/route.ts
- app/login/page.tsx

Supabase settings:
Authentication -> URL Configuration

Local testing:
Site URL: http://localhost:3000
Redirect URLs:
http://localhost:3000/**
https://workzoai.com/**
https://www.workzoai.com/**

Production:
Site URL: https://workzoai.com
Redirect URLs:
https://workzoai.com/**
https://www.workzoai.com/**
http://localhost:3000/**

Then:
npm run build
npm run dev
