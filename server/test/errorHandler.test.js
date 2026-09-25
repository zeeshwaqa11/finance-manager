import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { errorHandler, notFoundHandler } from '../src/middleware/errorHandler.js';
import { HttpError } from '../src/middleware/validate.js';

function mockRes({ headersSent = false } = {}) {
  return {
    headersSent,
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

describe('errorHandler', () => {
  it('uses the status and message of an HttpError', () => {
    const res = mockRes();
    errorHandler(new HttpError(404, 'Account not found'), {}, res, () => {});
    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.body, { error: 'Account not found' });
  });

  it('honours 4xx statuses from body-parser style errors', () => {
    const res = mockRes();
    const err = Object.assign(new Error('Unexpected token'), { status: 400 });
    errorHandler(err, {}, res, () => {});
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, 'Unexpected token');
  });

  it('maps unique and foreign-key constraint errors to 409', () => {
    for (const code of ['SQLITE_CONSTRAINT_UNIQUE', 'SQLITE_CONSTRAINT_FOREIGNKEY']) {
      const res = mockRes();
      errorHandler(Object.assign(new Error('constraint'), { code }), {}, res, () => {});
      assert.equal(res.statusCode, 409, code);
      assert.ok(res.body.error);
    }
  });

  it('hides unexpected errors behind a generic 500', () => {
    const res = mockRes();
    const original = console.error;
    console.error = () => {};
    try {
      errorHandler(new Error('secret internals'), {}, res, () => {});
    } finally {
      console.error = original;
    }
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { error: 'Internal server error' });
  });

  it('delegates when a response has already started', () => {
    const res = mockRes({ headersSent: true });
    const err = new Error('late');
    let forwarded = null;
    errorHandler(err, {}, res, (e) => {
      forwarded = e;
    });
    assert.equal(forwarded, err);
    assert.equal(res.statusCode, null);
  });
});

describe('notFoundHandler', () => {
  it('returns a JSON 404 naming the route', () => {
    const res = mockRes();
    notFoundHandler({ method: 'GET', originalUrl: '/api/nope' }, res);
    assert.equal(res.statusCode, 404);
    assert.match(res.body.error, /GET \/api\/nope/);
  });
});
