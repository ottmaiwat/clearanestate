import React from 'react';

interface HoneypotFieldProps {
  value: string;
  onChange: (value: string) => void;
}

// Invisible to real visitors (off-screen, unfocusable, not in tab order) but present in the
// DOM for simple bots that blindly fill every form field. If this ends up non-empty, the
// backend silently discards the submission instead of processing it.
export const HoneypotField: React.FC<HoneypotFieldProps> = ({ value, onChange }) => (
  <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }} aria-hidden="true">
    <label htmlFor="hp-field">Leave this field blank</label>
    <input
      id="hp-field"
      name="hp"
      type="text"
      tabIndex={-1}
      autoComplete="off"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);
