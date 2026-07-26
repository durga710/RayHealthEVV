import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  __registerShiftAlarmController,
  __resetPresentedShiftAlarms,
  isShiftAlarmPayload,
  presentShiftAlarm,
  shiftAlarmKey,
  type ShiftAlarmPayload,
} from './shift-alarm';

const payload: ShiftAlarmPayload = {
  assignmentId: 'a1',
  clientName: 'Pat Doe',
  scheduledTime: '2026-07-27T13:30:00.000Z',
  serviceCode: 'T1019',
  clientAddress: '12 Main St',
};

afterEach(() => {
  __registerShiftAlarmController(null);
  __resetPresentedShiftAlarms();
});

describe('isShiftAlarmPayload', () => {
  it('accepts a full payload', () => {
    expect(isShiftAlarmPayload(payload)).toBe(true);
  });

  it('accepts a payload without the optional fields', () => {
    expect(
      isShiftAlarmPayload({ assignmentId: 'a1', clientName: 'Pat', scheduledTime: 'iso' })
    ).toBe(true);
  });

  it('rejects null, primitives, and missing required fields', () => {
    expect(isShiftAlarmPayload(null)).toBe(false);
    expect(isShiftAlarmPayload('a1')).toBe(false);
    expect(isShiftAlarmPayload({ clientName: 'Pat', scheduledTime: 'iso' })).toBe(false);
    expect(isShiftAlarmPayload({ assignmentId: '', clientName: 'Pat', scheduledTime: 'iso' })).toBe(false);
    expect(isShiftAlarmPayload({ assignmentId: 'a1', clientName: 'Pat' })).toBe(false);
  });

  it('rejects optional fields with wrong types', () => {
    expect(
      isShiftAlarmPayload({ ...payload, serviceCode: 7 })
    ).toBe(false);
    expect(
      isShiftAlarmPayload({ ...payload, clientAddress: { street: 'x' } })
    ).toBe(false);
  });
});

describe('presentShiftAlarm', () => {
  it('presents once per shift occurrence, no matter how many triggers fire', () => {
    const present = vi.fn();
    __registerShiftAlarmController({ present });

    expect(presentShiftAlarm(payload)).toBe(true);
    expect(presentShiftAlarm(payload)).toBe(false);
    expect(presentShiftAlarm({ ...payload })).toBe(false);
    expect(present).toHaveBeenCalledTimes(1);
    expect(present).toHaveBeenCalledWith(payload);
  });

  it('treats the same assignment at a different time as a new occurrence', () => {
    const present = vi.fn();
    __registerShiftAlarmController({ present });

    expect(presentShiftAlarm(payload)).toBe(true);
    expect(
      presentShiftAlarm({ ...payload, scheduledTime: '2026-07-28T13:30:00.000Z' })
    ).toBe(true);
    expect(present).toHaveBeenCalledTimes(2);
  });

  it('does not consume the dedup slot while no host is mounted', () => {
    expect(presentShiftAlarm(payload)).toBe(false);

    const present = vi.fn();
    __registerShiftAlarmController({ present });
    expect(presentShiftAlarm(payload)).toBe(true);
    expect(present).toHaveBeenCalledTimes(1);
  });
});

describe('shiftAlarmKey', () => {
  it('keys on assignment and scheduled start', () => {
    expect(shiftAlarmKey(payload)).toBe('a1@2026-07-27T13:30:00.000Z');
  });
});
