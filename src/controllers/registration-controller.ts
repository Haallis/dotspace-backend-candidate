import { NextFunction, Request, Response } from 'express';
import { UniqueConstraintError } from 'sequelize';
import { Event, Registration, sequelize, User } from '../models';

function registrationJson(registration: Registration) {
  return {
    id: registration.id,
    eventId: registration.eventId,
    userId: registration.userId,
    createdAt: registration.createdAt,
  };
}

export async function registerForEvent(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const eventId = req.params.eventId as string;
    const { userId } = req.body as { userId?: string };

    const result = await sequelize.transaction(async (transaction) => {
      const event = await Event.findByPk(eventId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!event) {
        return { outcome: 'event-not-found' } as const;
      }

      const user = await User.findByPk(userId, { transaction });
      if (!user) {
        return { outcome: 'user-not-found' } as const;
      }

      const sameRegistration = await Registration.findOne({
        where: { eventId, userId: user.id },
        transaction,
      });

      if (sameRegistration) {
        return {
          outcome: 'registration',
          registration: sameRegistration,
          created: false,
        } as const;
      }

      const registrationsNow = await Registration.count({
        where: { eventId },
        transaction,
      });
      if (registrationsNow >= event.capacity) {
        return { outcome: 'event-full' } as const;
      }

      const registration = await Registration.create(
        { eventId, userId: user.id },
        { transaction },
      );

      return {
        outcome: 'registration',
        registration,
        created: true,
      } as const;
    });

    if (result.outcome === 'event-not-found') {
      res.status(404).json({
        error: { code: 'EVENT_NOT_FOUND', message: 'Event was not found' },
      });
      return;
    }

    if (result.outcome === 'user-not-found') {
      res.status(404).json({
        error: { code: 'USER_NOT_FOUND', message: 'User was not found' },
      });
      return;
    }

    if (result.outcome === 'event-full') {
      res.status(409).json({
        error: { code: 'EVENT_FULL', message: 'There are no free places' },
      });
      return;
    }

    res.status(result.created ? 201 : 200).json({
      registration: registrationJson(result.registration),
    });
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      const eventId = req.params.eventId as string;
      const { userId } = req.body as { userId?: string };

      if (typeof userId === 'string') {
        const registration = await Registration.findOne({
          where: { eventId, userId },
        });

        if (registration) {
          res.status(200).json({ registration: registrationJson(registration) });
          return;
        }
      }
    }

    next(error);
  }
}
