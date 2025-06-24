// src/pages/ForgotPasswordPage.tsx
import React, { useState, useCallback } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import * as apiService from '@/services/apiService';
import Button from '@/components/common/Button';
import Icon from '@/components/common/Icon';
import { twMerge } from 'tailwind-merge';

const ForgotPasswordPage: React.FC = () => {
    const [identifier, setIdentifier] = useState('');
    const [code, setCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [step, setStep] = useState(1); // 1: enter identifier, 2: enter code and new password

    const [isSendingCode, setIsSendingCode] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const navigate = useNavigate();

    const handleSendCode = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsSendingCode(true);
        setError(null);
        setMessage(null);

        const response = await apiService.apiSendCode(identifier, 'reset_password');
        setIsSendingCode(false);

        if (response.success) {
            setMessage(response.message || 'Verification code sent.');
            setStep(2);
        } else {
            setError(response.error || 'Failed to send reset code.');
        }
    }, [identifier]);

    const handleResetPassword = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (newPassword.length < 8) {
            setError("Password must be at least 8 characters long.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setMessage(null);

        const response = await apiService.apiPasswordRecovery(identifier, code, newPassword);
        setIsLoading(false);

        if (response.success) {
            setMessage(response.message || 'Password reset successfully. Redirecting to login...');
            setTimeout(() => navigate('/login'), 3000);
        } else {
            setError(response.error || 'Failed to reset password. The code may be invalid or expired.');
        }
    }, [identifier, code, newPassword, navigate]);

    const inputBaseClasses = "w-full h-10 px-3 text-sm font-light rounded-base focus:outline-none bg-grey-ultra-light dark:bg-neutral-700 placeholder:text-grey-medium dark:placeholder:text-neutral-400 text-grey-dark dark:text-neutral-100 transition-colors duration-200 ease-in-out border border-grey-light dark:border-neutral-600 focus:border-primary dark:focus:border-primary-light focus:ring-1 focus:ring-primary dark:focus:ring-primary-light";

    return (
        <div className="flex items-center justify-center min-h-screen bg-grey-ultra-light dark:bg-grey-deep p-4">
            <div className="w-full max-w-sm p-8 space-y-6 bg-white dark:bg-neutral-800 rounded-lg shadow-modal">
                <div className="text-center">
                    <Icon name="lock" size={40} className="mx-auto text-primary dark:text-primary-light mb-3" strokeWidth={1.5}/>
                    <h1 className="text-2xl font-medium text-grey-dark dark:text-neutral-100">
                        Reset Password
                    </h1>
                </div>

                {message && !error && (
                    <p className="text-sm text-success dark:text-green-400 text-center bg-success/10 p-3 rounded-base">
                        {message}
                    </p>
                )}
                {error && (
                    <p className="text-xs text-error dark:text-red-400 text-center bg-error/10 p-2 rounded-base">{error}</p>
                )}

                {step === 1 && (
                    <form onSubmit={handleSendCode} className="space-y-6">
                        <p className="text-sm text-grey-medium dark:text-neutral-400 text-center">
                            Enter your email or phone number to receive a verification code.
                        </p>
                        <div>
                            <label htmlFor="identifier" className="sr-only">Email or Phone Number</label>
                            <input
                                id="identifier" name="identifier" type="text" autoComplete="email" required
                                value={identifier} onChange={(e) => setIdentifier(e.target.value)}
                                className={inputBaseClasses} placeholder="you@example.com or +1234567890"
                                disabled={isSendingCode}
                            />
                        </div>
                        <Button type="submit" variant="primary" fullWidth size="lg" loading={isSendingCode} disabled={isSendingCode || !identifier.trim()} className="!h-10">
                            Send Verification Code
                        </Button>
                    </form>
                )}

                {step === 2 && !message && (
                    <form onSubmit={handleResetPassword} className="space-y-4">
                        <div>
                            <label htmlFor="code" className="sr-only">Verification Code</label>
                            <input id="code" name="code" type="text" inputMode="numeric" required value={code} onChange={(e) => setCode(e.target.value)}
                                   className={inputBaseClasses} placeholder="Verification Code" disabled={isLoading} />
                        </div>
                        <div>
                            <label htmlFor="newPassword" className="sr-only">New Password</label>
                            <input id="newPassword" name="newPassword" type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                                   className={inputBaseClasses} placeholder="Enter new password (min. 8)" disabled={isLoading} />
                        </div>
                        <Button type="submit" variant="primary" fullWidth size="lg" loading={isLoading} disabled={isLoading || !code.trim() || !newPassword.trim()} className="!h-10 !mt-6">
                            Reset Password
                        </Button>
                    </form>
                )}

                <p className="mt-6 text-center text-xs text-grey-medium dark:text-neutral-400">
                    Remember your password?{' '}
                    <RouterLink to="/login" className="font-medium text-primary hover:text-primary-dark dark:text-primary-light dark:hover:text-primary transition-colors">
                        Sign in
                    </RouterLink>
                </p>
            </div>
        </div>
    );
};
ForgotPasswordPage.displayName = 'ForgotPasswordPage';
export default ForgotPasswordPage;