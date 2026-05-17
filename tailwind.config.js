/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './*.html',
    './**/*.html',
    './js/**/*.js',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

// 需要 safelist 的动态类名（在 JS 中通过变量拼接构造，扫描器无法直接匹配）
// - bg-pink-600, text-white, text-gray-300 等用于 toggle 开关
// - opacity-50, cursor-not-allowed 用于翻页禁态
// - bg-gray-700, bg-[#222], hover:bg-[#333] 用于按钮状态
// - translate-x-6 用于 toggle dot
// - border-blue-500 用于拖拽区域
// 以上类名均为完整字符串出现在 JS 中，扫描器可以自动捕获，无需 safelist

