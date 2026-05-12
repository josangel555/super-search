import { describe, it, expect, beforeEach } from 'bun:test';
import * as bus from '../../src/bus.js';

describe('bus', () => {
  beforeEach(() => bus.clear());

  it('fires handlers in registration order', () => {
    const order = [];
    bus.on('x', () => order.push('a'));
    bus.on('x', () => order.push('b'));
    bus.emit('x');
    expect(order).toEqual(['a', 'b']);
  });

  it('does not throw if no handlers', () => {
    expect(() => bus.emit('nope')).not.toThrow();
  });

  it('unsubscribe stops further calls', () => {
    let count = 0;
    const unsub = bus.on('y', () => count++);
    bus.emit('y');
    unsub();
    bus.emit('y');
    expect(count).toBe(1);
  });

  it('catches handler errors so siblings still run', () => {
    let later = 0;
    bus.on('z', () => { throw new Error('boom'); });
    bus.on('z', () => later++);
    expect(() => bus.emit('z')).not.toThrow();
    expect(later).toBe(1);
  });
});
