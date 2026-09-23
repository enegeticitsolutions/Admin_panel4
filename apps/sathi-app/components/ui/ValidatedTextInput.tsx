import React, { forwardRef } from 'react';
import { TextInput, TextInputProps, Platform } from 'react-native';

export interface ValidatedTextInputProps extends TextInputProps {
  dataType?: 'integer' | 'text-only' | 'alphanumeric';
}

export const ValidatedTextInput = forwardRef<TextInput, ValidatedTextInputProps>(
  ({ dataType, onChangeText, keyboardType, ...props }, ref) => {
    
    // Automatically set the numeric keyboard if it's an integer field
    const effectiveKeyboardType = dataType === 'integer' ? 'numeric' : keyboardType;

    const handleChangeText = (text: string) => {
      if (dataType) {
        let val = text;
        if (dataType === 'integer') {
          val = val.replace(/[^0-9]/g, '');
        } else if (dataType === 'text-only') {
          val = val.replace(/[^a-zA-Z\s\-]/g, '');
        } else if (dataType === 'alphanumeric') {
          val = val.replace(/[^a-zA-Z0-9\s\-]/g, '');
        }
        
        if (onChangeText) {
          onChangeText(val);
        }
      } else {
        if (onChangeText) {
          onChangeText(text);
        }
      }
    };

    return (
      <TextInput
        ref={ref}
        onChangeText={handleChangeText}
        keyboardType={effectiveKeyboardType}
        {...props}
      />
    );
  }
);

ValidatedTextInput.displayName = 'ValidatedTextInput';
