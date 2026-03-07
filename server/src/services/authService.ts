import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma/client';
import { ApiError } from '../middleware/errorHandler';

const SALT_ROUNDS = 12;

interface RegisterInput {
    email: string;
    password: string;
}

interface LoginInput {
    email: string;
    password: string;
}

interface AuthResult {
    id: string;
    token: string;
    role: string;
    email: string;
}

function generateToken(userId: string, email: string, role: string): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new ApiError(500, 'JWT secret not configured.', 'CONFIG_ERROR');
    // v2: role embedded in JWT so auth middleware can expose req.role
    return jwt.sign({ userId, email, role }, secret, { expiresIn: '7d' });
}

export async function register(input: RegisterInput): Promise<AuthResult> {
    const { email, password } = input;

    if (!email || !email.includes('@')) {
        throw new ApiError(400, 'A valid email is required.', 'INVALID_EMAIL');
    }
    if (!password || password.length < 8) {
        throw new ApiError(400, 'Password must be at least 8 characters.', 'INVALID_PASSWORD');
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        throw new ApiError(409, 'An account with this email already exists.', 'EMAIL_TAKEN');
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await prisma.user.create({
        data: { email, passwordHash },
    });

    const token = generateToken(user.id, user.email, user.role);
    // v2: return role so client can drive RoleRouter on registration
    return { id: user.id, token, role: user.role, email: user.email };
}

export async function login(input: LoginInput): Promise<AuthResult> {
    const { email, password } = input;

    if (!email || !password) {
        throw new ApiError(400, 'Email and password are required.', 'MISSING_FIELDS');
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        // Intentionally vague — do not reveal if email exists
        throw new ApiError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS');
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
        throw new ApiError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS');
    }

    const token = generateToken(user.id, user.email, user.role);
    // v2: return role so client RoleRouter can redirect to correct portal
    return { id: user.id, token, role: user.role, email: user.email };
}
