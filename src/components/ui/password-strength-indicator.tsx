import React from 'react';
import { cn } from '@/lib/utils';

interface PasswordStrengthIndicatorProps {
  password?: string;
}

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({ password = '' }) => {
  const hasMinLength = password.length >= 10;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const requirements = [
    { label: '10+ characters', met: hasMinLength },
    { label: 'Letter', met: hasLetter },
    { label: 'Number', met: hasDigit },
    { label: 'Symbol', met: hasSymbol },
  ];

  const typesCount = [hasLetter, hasDigit, hasSymbol].filter(Boolean).length;
  let strength = 0;
  if (password.length > 0) strength = 1;
  if (hasMinLength) strength += 1;
  if (typesCount >= 2) strength += 1;
  if (typesCount === 3 && hasMinLength) strength = 4;

  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const barColor = ['bg-muted', 'bg-destructive', 'bg-amber-500', 'bg-primary', 'bg-emerald-500'][strength];

  return (
    <div className="flex flex-col gap-2.5 mt-2 w-full">
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
          <div className={cn('h-full rounded-full transition-all duration-300', barColor)} style={{ width: `${strength * 25}%` }} />
        </div>
        <span className="text-xs font-semibold w-14 text-right text-muted-foreground">{labels[strength]}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {requirements.map((req) => (
          <span
            key={req.label}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
              req.met
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700'
                : 'bg-muted border-border text-muted-foreground'
            )}
          >
            {req.label}
          </span>
        ))}
      </div>
    </div>
  );
};
