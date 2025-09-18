import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#1D4ED8',
        accent: '#F97316'
      }
    }
  },
  plugins: []
};

export default config;
