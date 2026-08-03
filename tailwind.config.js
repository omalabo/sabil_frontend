/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 🎨 Palette métier Sabil Al Ilm
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6', // Bleu principal
          600: '#2563eb',
          700: '#1d4ed8',
        },
        // 🟠 Orange = classe en pause
        warning: {
          50: '#fff7ed',
          500: '#f97316',
          600: '#ea580c',
        },
        // 🔴 Rouge = classe à supprimer / signalée
        danger: {
          50: '#fef2f2',
          500: '#ef4444',
          600: '#dc2626',
        },
        // 🟢 Vert = disponible / confirmé
        success: {
          50: '#f0fdf4',
          500: '#22c55e',
          600: '#16a34a',
        },
        // 🩶 Gris neutre pour textes et bordures
        neutral: {
          100: '#f3f4f6',
          300: '#d1d5db',
          500: '#6b7280',
          700: '#374151',
          900: '#111827',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}