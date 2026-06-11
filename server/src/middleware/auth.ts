import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../env.js'
import { HttpError } from './error.js'

export type AuthPayload = {
  sub: string
  email: string
  role: 'ADMIN' | 'USUARIO'
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthPayload
    }
  }
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN })
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return next(new HttpError(401, 'Token ausente'))
  }
  const token = header.slice('Bearer '.length).trim()
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthPayload
    req.user = decoded
    next()
  } catch {
    next(new HttpError(401, 'Token inválido ou expirado'))
  }
}

export function requireRole(...roles: AuthPayload['role'][]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, 'Não autenticado'))
    if (!roles.includes(req.user.role)) {
      return next(new HttpError(403, 'Acesso negado'))
    }
    next()
  }
}
