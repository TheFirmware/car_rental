const request = require('supertest');
const pool = require('../src/db');
const app = require('../src/index');

let tokenA;
let tokenB;

beforeAll(async () => {
  await pool.query('DELETE FROM bookings');
  await pool.query('DELETE FROM users');
  await pool.query('ALTER SEQUENCE bookings_id_seq RESTART WITH 1');
  await pool.query('ALTER SEQUENCE users_id_seq RESTART WITH 1');
});

afterAll(async () => {
  await pool.end();
});

describe('POST /auth/signup', () => {
  it('creates a new user and returns 201', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({ username: 'rahul', password: '123' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toBe('User created successfully');
    expect(res.body.data.userId).toBe(1);
  });

  it('returns 409 for duplicate username', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({ username: 'rahul', password: '456' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('username already exists');
  });

  it('returns 400 when username is missing', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({ password: '123' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('invalid inputs');
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({ username: 'newuser' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('invalid inputs');
  });

  it('returns 400 when username is empty string', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({ username: '   ', password: '123' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('invalid inputs');
  });

  it('returns 400 when password is empty string', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({ username: 'someguy', password: '' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('invalid inputs');
  });

  it('creates a second user successfully', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({ username: 'ankit', password: 'pass' });

    expect(res.status).toBe(201);
    expect(res.body.data.userId).toBe(2);
  });
});

describe('POST /auth/login', () => {
  it('logs in with valid credentials and returns a token', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'rahul', password: '123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toBe('Login successful');
    expect(res.body.data.token).toBeDefined();
    tokenA = res.body.data.token;
  });

  it('returns 401 when user does not exist', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'nobody', password: '123' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('user does not exist');
  });

  it('returns 401 for incorrect password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'rahul', password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('incorrect password');
  });

  it('returns 400 when username is missing', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ password: '123' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('invalid inputs');
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'rahul' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('invalid inputs');
  });

  it('logs in second user to get their token', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'ankit', password: 'pass' });

    expect(res.status).toBe(200);
    tokenB = res.body.data.token;
  });
});

describe('Auth middleware', () => {
  it('returns 401 when authorization header is missing', async () => {
    const res = await request(app).get('/bookings');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Authorization header missing');
  });

  it('returns 401 when Bearer token is missing', async () => {
    const res = await request(app)
      .get('/bookings')
      .set('Authorization', 'Bearer ');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Token missing after Bearer');
  });

  it('returns 401 when token is invalid', async () => {
    const res = await request(app)
      .get('/bookings')
      .set('Authorization', 'Bearer some.junk.token');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Token invalid');
  });

  it('returns 401 when auth header has no Bearer prefix', async () => {
    const res = await request(app)
      .get('/bookings')
      .set('Authorization', 'blah');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Token missing after Bearer');
  });
});

describe('POST /bookings', () => {
  it('creates a booking and returns 201', async () => {
    const res = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ carName: 'Honda City', days: 3, rentPerDay: 1500 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toBe('Booking created successfully');
    expect(res.body.data.bookingId).toBe(1);
    expect(res.body.data.totalCost).toBe(4500);
  });

  it('creates a second booking', async () => {
    const res = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ carName: 'Verna', days: 2, rentPerDay: 1600 });

    expect(res.status).toBe(201);
    expect(res.body.data.bookingId).toBe(2);
    expect(res.body.data.totalCost).toBe(3200);
  });

  it('creates a booking for second user', async () => {
    const res = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ carName: 'Swift', days: 1, rentPerDay: 1000 });

    expect(res.status).toBe(201);
    expect(res.body.data.bookingId).toBe(3);
  });

  it('returns 400 when carName is missing', async () => {
    const res = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ days: 3, rentPerDay: 1500 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid inputs');
  });

  it('returns 400 when days is missing', async () => {
    const res = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ carName: 'Honda City', rentPerDay: 1500 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid inputs');
  });

  it('returns 400 when rentPerDay is missing', async () => {
    const res = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ carName: 'Honda City', days: 3 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid inputs');
  });

  it('returns 400 when days is 365 or more', async () => {
    const res = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ carName: 'Honda City', days: 365, rentPerDay: 500 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid inputs');
  });

  it('returns 400 when days is less than 365 but still rejected for being too high', async () => {
    const res = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ carName: 'Honda City', days: 364, rentPerDay: 500 });

    expect(res.status).toBe(201);
    expect(res.body.data.bookingId).toBeDefined();
  });

  it('returns 400 when rentPerDay exceeds 2000', async () => {
    const res = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ carName: 'BMW', days: 1, rentPerDay: 2001 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid inputs');
  });

  it('allows rentPerDay of exactly 2000', async () => {
    const res = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ carName: 'Mercedes', days: 1, rentPerDay: 2000 });

    expect(res.status).toBe(201);
  });

  it('returns 400 when days is not an integer', async () => {
    const res = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ carName: 'Honda City', days: 3.5, rentPerDay: 1500 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid inputs');
  });

  it('returns 400 when rentPerDay is not an integer', async () => {
    const res = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ carName: 'Honda City', days: 3, rentPerDay: 15.5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid inputs');
  });

  it('returns 400 when days is negative', async () => {
    const res = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ carName: 'Honda City', days: -1, rentPerDay: 1500 });

    expect(res.status).toBe(400);
  });

  it('returns 400 when days is zero', async () => {
    const res = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ carName: 'Honda City', days: 0, rentPerDay: 1500 });

    expect(res.status).toBe(400);
  });
});

describe('GET /bookings', () => {
  it('returns all bookings for the logged-in user', async () => {
    const res = await request(app)
      .get('/bookings')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(4);
  });

  it('returns a single booking by bookingId', async () => {
    const res = await request(app)
      .get('/bookings')
      .query({ bookingId: 1 })
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(1);
    expect(res.body.data[0].car_name).toBe('Honda City');
    expect(res.body.data[0].days).toBe(3);
    expect(res.body.data[0].rent_per_day).toBe(1500);
    expect(res.body.data[0].status).toBe('booked');
    expect(res.body.data[0].totalCost).toBe(4500);
  });

  it('returns 404 when bookingId does not belong to user', async () => {
    const res = await request(app)
      .get('/bookings')
      .query({ bookingId: 3 })
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('bookingId not found');
  });

  it('returns 404 when bookingId does not exist at all', async () => {
    const res = await request(app)
      .get('/bookings')
      .query({ bookingId: 999 })
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('bookingId not found');
  });

  it('returns summary for logged-in user', async () => {
    const res = await request(app)
      .get('/bookings')
      .query({ summary: 'true' })
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.userId).toBe(1);
    expect(res.body.data.username).toBe('rahul');
    expect(res.body.data.totalBookings).toBe(4);
  });

  it('summary ignores cancelled bookings', async () => {
    await pool.query(
      "UPDATE bookings SET status = 'cancelled' WHERE id = 5 AND user_id = 1"
    );

    const res = await request(app)
      .get('/bookings')
      .query({ summary: 'true' })
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalBookings).toBe(3);
    expect(res.body.data.totalAmountSpent).toBe(189700);
  });
});

describe('PUT /bookings/:bookingId', () => {
  it('updates booking details', async () => {
    const res = await request(app)
      .put('/bookings/1')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ carName: 'Verna', days: 4, rentPerDay: 1600 });

    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe('Booking updated successfully');
    expect(res.body.data.booking.car_name).toBe('Verna');
    expect(res.body.data.booking.days).toBe(4);
    expect(res.body.data.booking.rent_per_day).toBe(1600);
    expect(res.body.data.booking.totalCost).toBe(6400);
  });

  it('updates only status', async () => {
    const res = await request(app)
      .put('/bookings/1')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'completed' });

    expect(res.status).toBe(200);
    expect(res.body.data.booking.status).toBe('completed');
  });

  it('returns 403 when booking does not belong to user', async () => {
    const res = await request(app)
      .put('/bookings/3')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'cancelled' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('booking does not belong to user');
  });

  it('returns 404 when booking does not exist', async () => {
    const res = await request(app)
      .put('/bookings/999')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'completed' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('booking not found');
  });

  it('returns 400 for invalid status value', async () => {
    const res = await request(app)
      .put('/bookings/1')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'invalid_status' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid inputs');
  });

  it('returns 400 when updating with days >= 365', async () => {
    const res = await request(app)
      .put('/bookings/1')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ days: 365 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid inputs');
  });

  it('returns 400 when updating with rentPerDay > 2000', async () => {
    const res = await request(app)
      .put('/bookings/1')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ rentPerDay: 2001 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid inputs');
  });
});

describe('DELETE /bookings/:bookingId', () => {
  it('returns 403 when booking does not belong to user', async () => {
    const res = await request(app)
      .delete('/bookings/3')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('booking does not belong to user');
  });

  it('returns 404 when booking does not exist', async () => {
    const res = await request(app)
      .delete('/bookings/999')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('booking not found');
  });

  it('deletes a booking owned by the user', async () => {
    const res = await request(app)
      .delete('/bookings/2')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toBe('Booking deleted successfully');
  });

  it('confirms booking is actually deleted', async () => {
    const res = await request(app)
      .get('/bookings')
      .query({ bookingId: 2 })
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
  });
});
