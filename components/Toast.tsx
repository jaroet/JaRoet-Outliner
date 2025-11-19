
import React, { useState, useEffect, useCallback } from 'react';

export interface Toast {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
}

export const useToast = () => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
        const id = crypto.randomUUID();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            removeToast(id);
        }, 3000);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return { toasts, addToast, removeToast };
};

interface ToastContainerProps {
    toasts: Toast[];
    removeToast: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
    return (
        <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 flex flex-col gap-2 z-50 pointer-events-none">
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    className={`px-4 py-2 rounded-md shadow-lg text-white text-sm font-medium transition-all duration-300 animate-fade-in-up pointer-events-auto ${
                        toast.type === 'success' ? 'bg-green-600' : 
                        toast.type === 'error' ? 'bg-red-600' : 
                        'bg-gray-800 dark:bg-gray-600'
                    }`}
                    onClick={() => removeToast(toast.id)}
                >
                    {toast.message}
                </div>
            ))}
        </div>
    );
};
