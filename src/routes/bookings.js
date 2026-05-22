const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

router.post('/bookings', async (req, res) => {
  try {
    const { carName, days, rentPerDay } = req.body;

    if (!carName || !days || !rentPerDay || typeof carName !== 'string' || !carName.trim()) {
      return res.status(400).json({ success: false, error: 'invalid inputs' });
    }

    const daysNum = Number(days);
    const rentNum = Number(rentPerDay);

    if (!Number.isInteger(daysNum) || !Number.isInteger(rentNum) || daysNum < 1 || rentNum < 1) {
      return res.status(400).json({ success: false, error: 'invalid inputs' });
    }

    if (daysNum >= 365) {
      return res.status(400).json({ success: false, error: 'invalid inputs' });
    }

    if (rentNum > 2000) {
      return res.status(400).json({ success: false, error: 'invalid inputs' });
    }

    const totalCost = daysNum * rentNum;

    const result = await pool.query(
      'INSERT INTO bookings (user_id, car_name, days, rent_per_day, status) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [req.user.userId, carName.trim(), daysNum, rentNum, 'booked']
    );

    res.status(201).json({
      success: true,
      data: {
        message: 'Booking created successfully',
        bookingId: result.rows[0].id,
        totalCost,
      },
    });
  } catch {
    res.status(400).json({ success: false, error: 'invalid inputs' });
  }
});

router.get('/bookings', async (req, res) => {
  try {
    const { bookingId, summary } = req.query;

    if (summary === 'true') {
      const result = await pool.query(
        `SELECT COUNT(*)::int AS "totalBookings", COALESCE(SUM(days * rent_per_day), 0)::int AS "totalAmountSpent"
         FROM bookings
         WHERE user_id = $1 AND status IN ('booked', 'completed')`,
        [req.user.userId]
      );

      return res.status(200).json({
        success: true,
        data: {
          userId: req.user.userId,
          username: req.user.username,
          totalBookings: result.rows[0].totalBookings,
          totalAmountSpent: result.rows[0].totalAmountSpent,
        },
      });
    }

    if (bookingId) {
      const result = await pool.query(
        'SELECT id, car_name, days, rent_per_day, status FROM bookings WHERE id = $1 AND user_id = $2',
        [Number(bookingId), req.user.userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'bookingId not found' });
      }

      const b = result.rows[0];
      return res.status(200).json({
        success: true,
        data: [
          {
            id: b.id,
            car_name: b.car_name,
            days: b.days,
            rent_per_day: b.rent_per_day,
            status: b.status,
            totalCost: b.days * b.rent_per_day,
          },
        ],
      });
    }

    const result = await pool.query(
      'SELECT id, car_name, days, rent_per_day, status FROM bookings WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.userId]
    );

    const bookings = result.rows.map((b) => ({
      id: b.id,
      car_name: b.car_name,
      days: b.days,
      rent_per_day: b.rent_per_day,
      status: b.status,
      totalCost: b.days * b.rent_per_day,
    }));

    res.status(200).json({ success: true, data: bookings });
  } catch {
    res.status(400).json({ success: false, error: 'invalid inputs' });
  }
});

router.put('/bookings/:bookingId', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { carName, days, rentPerDay, status } = req.body;

    const bookingResult = await pool.query('SELECT * FROM bookings WHERE id = $1', [Number(bookingId)]);
    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'booking not found' });
    }

    const booking = bookingResult.rows[0];

    if (booking.user_id !== req.user.userId) {
      return res.status(403).json({ success: false, error: 'booking does not belong to user' });
    }

    if (status !== undefined) {
      if (!['booked', 'completed', 'cancelled'].includes(status)) {
        return res.status(400).json({ success: false, error: 'invalid inputs' });
      }

      await pool.query('UPDATE bookings SET status = $1 WHERE id = $2', [status, bookingId]);

      const updated = await pool.query('SELECT id, car_name, days, rent_per_day, status FROM bookings WHERE id = $1', [bookingId]);
      const b = updated.rows[0];

      return res.status(200).json({
        success: true,
        data: {
          message: 'Booking updated successfully',
          booking: {
            id: b.id,
            car_name: b.car_name,
            days: b.days,
            rent_per_day: b.rent_per_day,
            status: b.status,
            totalCost: b.days * b.rent_per_day,
          },
        },
      });
    }

    if (carName !== undefined || days !== undefined || rentPerDay !== undefined) {
      const newCarName = carName !== undefined ? carName : booking.car_name;
      const newDays = days !== undefined ? Number(days) : booking.days;
      const newRent = rentPerDay !== undefined ? Number(rentPerDay) : booking.rent_per_day;

      if (
        typeof newCarName !== 'string' || !newCarName.trim() ||
        !Number.isInteger(newDays) || newDays < 1 ||
        !Number.isInteger(newRent) || newRent < 1
      ) {
        return res.status(400).json({ success: false, error: 'invalid inputs' });
      }

      if (newDays >= 365) {
        return res.status(400).json({ success: false, error: 'invalid inputs' });
      }

      if (newRent > 2000) {
        return res.status(400).json({ success: false, error: 'invalid inputs' });
      }

      await pool.query(
        'UPDATE bookings SET car_name = $1, days = $2, rent_per_day = $3 WHERE id = $4',
        [newCarName.trim(), newDays, newRent, bookingId]
      );

      const updated = await pool.query('SELECT id, car_name, days, rent_per_day, status FROM bookings WHERE id = $1', [bookingId]);
      const b = updated.rows[0];

      return res.status(200).json({
        success: true,
        data: {
          message: 'Booking updated successfully',
          booking: {
            id: b.id,
            car_name: b.car_name,
            days: b.days,
            rent_per_day: b.rent_per_day,
            status: b.status,
            totalCost: b.days * b.rent_per_day,
          },
        },
      });
    }

    return res.status(400).json({ success: false, error: 'invalid inputs' });
  } catch {
    res.status(400).json({ success: false, error: 'invalid inputs' });
  }
});

router.delete('/bookings/:bookingId', async (req, res) => {
  try {
    const { bookingId } = req.params;

    const result = await pool.query('SELECT * FROM bookings WHERE id = $1', [Number(bookingId)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'booking not found' });
    }

    if (result.rows[0].user_id !== req.user.userId) {
      return res.status(403).json({ success: false, error: 'booking does not belong to user' });
    }

    await pool.query('DELETE FROM bookings WHERE id = $1', [bookingId]);

    res.status(200).json({
      success: true,
      data: {
        message: 'Booking deleted successfully',
      },
    });
  } catch {
    res.status(400).json({ success: false, error: 'invalid inputs' });
  }
});

module.exports = router;
