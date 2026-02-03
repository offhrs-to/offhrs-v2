/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  // Safelist design-system color classes so they are always generated (NativeWind/RN)
  safelist: [
    { pattern: /^(bg|text|border)-canvas$/ },
    { pattern: /^(bg|text|border)-card(-alt)?$/ },
    { pattern: /^(bg|text|border)-primary$/ },
    { pattern: /^(bg|text|border)-secondary$/ },
    { pattern: /^(bg|text|border)-pale-sage$/ },
    { pattern: /^text-text-main$/ },
    { pattern: /^text-text-muted$/ },
  ],
  theme: {
    extend: {
      colors: {
        // Design system: Mental Wellness / Farheen Shah
        canvas: '#ECEFE5',       // Background (main)
        card: '#FFFFFF',
        'card-alt': '#F4F6F0',
        primary: '#38511B',     // Deep Forest Green
        secondary: '#868F5C',   // Olive Green
        'pale-sage': '#C9D5B4', // Highlights/Pills
        'text-main': '#0A0A09', // Soft Black
        'text-muted': '#5E5F56',// Earthy Gray
      },
      borderRadius: {
        '3xl': '24px',
      },
      boxShadow: {
        soft: '0 8px 30px rgba(0,0,0,0.04)',
      },
    },
  },
  plugins: [],
}
