import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

describe('debug', () => {
    it('fc is defined', () => {
        expect(typeof fc).toBe('object');
        expect(typeof fc.assert).toBe('function');
        expect(typeof fc.property).toBe('function');
        expect(typeof fc.string).toBe('function');
    });

    it('fc.assert runs basic property', () => {
        fc.assert(
            fc.property(fc.string(), (s) => typeof s === 'string'),
            { numRuns: 10 }
        );
    });
});
