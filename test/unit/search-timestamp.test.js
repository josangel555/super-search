import { describe, it, expect } from 'bun:test';
import { run } from '../../src/search/timestamp.js';

describe('timestamp search', () => {
  it('finds tokens in range', () => {
    document.body.innerHTML = '<p>Times: 0:45 and 1:30 and 2:30 and 5:00</p>';
    const r = run('1:00-2:00', document.body);
    expect(r.matches.length).toBe(1);
    expect(r.matches[0].value).toBe('1:30');
  });

  it('inclusive at bounds', () => {
    document.body.innerHTML = '<p>1:00 2:00</p>';
    const r = run('1:00-2:00', document.body);
    expect(r.matches.length).toBe(2);
  });

  it('handles HH:MM:SS', () => {
    document.body.innerHTML = '<p>at 01:01:25 happens stuff</p>';
    const r = run('01:00:00-02:30:00', document.body);
    expect(r.matches.length).toBe(1);
    expect(r.matches[0].value).toBe('01:01:25');
  });

  it('returns [] on inverted range', () => {
    document.body.innerHTML = '<p>1:30</p>';
    const r = run('2:00-1:00', document.body);
    expect(r.matches.length).toBe(0);
  });

  it('returns [] on bad input', () => {
    document.body.innerHTML = '<p>1:30</p>';
    const r = run('abc', document.body);
    expect(r.matches.length).toBe(0);
  });
});
