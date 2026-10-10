'use client';

import React, { useState } from 'react';
import { AuthInput, type AuthInputProps } from './AuthInput';
import { LockIcon, EyeIcon, EyeOffIcon } from '@/components/icons';

export interface PasswordInputProps extends Omit<AuthInputProps, 'type' | 'icon' | 'rightElement'> {
  showToggle?: boolean;
}

export function PasswordInput({
  label = 'Password',
  id = 'password',
  showToggle = true,
  disabled,
  ...props
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  const toggleVisibility = () => {
    if (disabled) return;
    setShowPassword((prev) => !prev);
  };

  const rightToggle = showToggle ? (
    <button
      type="button"
      onClick={toggleVisibility}
      disabled={disabled}
      tabIndex={0}
      aria-label={showPassword ? 'Hide password' : 'Show password'}
      className="p-1.5 text-slate-400 hover:text-slate-600 focus:text-slate-700 rounded-lg hover:bg-slate-100/80 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 transition-colors"
    >
      {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
    </button>
  ) : undefined;

  return (
    <AuthInput
      id={id}
      label={label}
      type={showPassword ? 'text' : 'password'}
      icon={<LockIcon size={18} />}
      rightElement={rightToggle}
      disabled={disabled}
      autoComplete="current-password"
      {...props}
    />
  );
}
