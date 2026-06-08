'use client';

interface Props {
  text?: string;
  className?: string;
}

export default function LoadingSpinner({ text = '불러오는 중...', className = '' }: Props) {
  return (
    <div className={`flex items-center justify-center py-20 text-xs text-gray-400 ${className}`}>
      {text}
    </div>
  );
}
