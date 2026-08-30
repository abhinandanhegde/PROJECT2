export const API_URL: string =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'https://project2-production-526d.up.railway.app'
    : 'http://localhost:8000')