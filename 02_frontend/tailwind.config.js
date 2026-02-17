/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        text: '#1A1A1A',
        bg: '#F8F7F4',
        primary: '#2C2C2C',
        secondary: '#E9E7E2',
        accent: '#3D5A40',
      },
      borderRadius: {
        'none': '0',
        'sm': '4px',
        DEFAULT: '8px',
        'md': '10px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '24px',
        'full': '9999px',
      },
      fontFamily: {
        sans: ["'Google Sans'", "'Inter'", 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
