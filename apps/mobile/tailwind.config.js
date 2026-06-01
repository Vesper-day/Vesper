const { vesperPreset } = require('@vesper/ui/tailwind');

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [vesperPreset, require("nativewind/preset")],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};