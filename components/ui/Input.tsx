import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export const Input: React.FC<InputProps> = ({ label, className, ...props }) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-400 mb-1">{label}</label>
    <input
      className={`w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:ring-2 focus:ring-primary focus:outline-none ${className}`}
      {...props}
    />
  </div>
);

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
}

export const TextArea: React.FC<TextAreaProps> = ({ label, className, ...props }) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-400 mb-1">{label}</label>
    <textarea
      className={`w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:ring-2 focus:ring-primary focus:outline-none ${className}`}
      {...props}
    />
  </div>
);
