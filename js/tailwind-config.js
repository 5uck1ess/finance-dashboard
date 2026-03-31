// Tailwind CDN configuration
if (typeof window !== 'undefined') {
    window.tailwind = window.tailwind || {};
    window.tailwind.config = {
        darkMode: 'class',
        theme: {
            extend: {
                colors: {
                    primary: '#3b82f6',
                    success: '#10b981',
                    danger: '#ef4444',
                    dark: {
                        bg: '#111827',
                        card: '#1f2937',
                        text: '#f9fafb'
                    }
                }
            }
        }
    };
}
