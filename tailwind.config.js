/** @type {import('tailwindcss').Config} */
export default {
    content: ['./*.html', './js/**/*.js'],
    darkMode: 'class',
    theme: {
        extend: {
            animation: {
                'fade-in': 'fadeIn 0.45s ease-out'
            },
            keyframes: {
                fadeIn: {
                    from: { opacity: '0', transform: 'translateY(8px)' },
                    to: { opacity: '1', transform: 'translateY(0)' }
                }
            }
        }
    },
    plugins: []
};
