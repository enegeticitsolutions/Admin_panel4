import React from 'react';

export const ValidatedInput = React.forwardRef(({ dataType, onChange, ...props }, ref) => {
  const handleChange = (e) => {
    if (dataType) {
      let val = e.target.value;
      if (dataType === 'integer') {
        val = val.replace(/[^0-9]/g, '');
      } else if (dataType === 'text-only') {
        val = val.replace(/[^a-zA-Z\s\-]/g, '');
      } else if (dataType === 'alphanumeric') {
        val = val.replace(/[^a-zA-Z0-9\s\-]/g, '');
      }
      e.target.value = val;
    }
    if (onChange) {
      onChange(e);
    }
  };

  return (
    <input
      ref={ref}
      onChange={handleChange}
      {...props}
    />
  );
});

ValidatedInput.displayName = 'ValidatedInput';
