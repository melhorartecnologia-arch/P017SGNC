import type { NextFunction, Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message)
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'Dados inválidos',
      details: err.flatten(),
    })
  }

  if (err instanceof HttpError) {
    return res
      .status(err.status)
      .json({ error: err.name, message: err.message, details: err.details })
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[] | undefined)?.join(', ')
      return res.status(409).json({
        error: 'ConflictError',
        message: `Já existe registro com ${target ?? 'esse valor'}`,
      })
    }
    if (err.code === 'P2025') {
      return res.status(404).json({
        error: 'NotFoundError',
        message: 'Registro não encontrado',
      })
    }
  }

  console.error(err)
  res.status(500).json({ error: 'InternalServerError', message: 'Erro interno' })
}
