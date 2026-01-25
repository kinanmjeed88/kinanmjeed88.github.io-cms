import { Layout, Gamepad2, Smartphone, Trophy } from 'lucide-react';
import React from 'react';

export const CATEGORIES = [
  { id: 'tech', label: 'تقنية', icon: <Layout className="w-4 h-4" /> },
  { id: 'apps', label: 'تطبيقات', icon: <Smartphone className="w-4 h-4" /> },
  { id: 'games', label: 'ألعاب', icon: <Gamepad2 className="w-4 h-4" /> },
  { id: 'sports', label: 'رياضة', icon: <Trophy className="w-4 h-4" /> },
];