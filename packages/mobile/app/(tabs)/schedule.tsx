import React from 'react';
import ComingSoon from '../../src/features/common/ComingSoon';

export default function ScheduleTab() {
  return (
    <ComingSoon
      title="Schedule"
      icon="calendar-outline"
      note="Your upcoming week of visits will appear here."
    />
  );
}
