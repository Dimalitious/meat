import dotenv from 'dotenv';
dotenv.config();

console.log('=== ENV CHECK ===');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'SET (' + process.env.JWT_SECRET.substring(0, 10) + '...)' : 'NOT SET');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
console.log('PORT:', process.env.PORT);
