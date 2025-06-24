// src/pages/RegisterPage.tsx
import React, {useCallback, useState} from 'react';
import {Link as RouterLink, useNavigate} from 'react-router-dom';
import {useSetAtom} from 'jotai';
import {currentUserAtom} from '@/store/atoms';
import * as apiService from '@/services/apiService';
import Button from '@/components/common/Button';
import Icon from '@/components/common/Icon';
import {twMerge} from 'tailwind-merge';

const RegisterPage: React.FC = () => {
    const [username, setUsername] = useState('');
    const [identifier, setIdentifier] = useState(''); // Can be email or phone
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [verificationCode, setVerificationCode] = useState('');

    const [isCodeSent, setIsCodeSent] = useState(false);
    const [isSendingCode, setIsSendingCode] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const setCurrentUser = useSetAtom(currentUserAtom);
    const navigate = useNavigate();

    const handleSendCode = useCallback(async () => {
        if (!identifier.trim()) {
            setError("Please enter your email or phone number.");
            return;
        }
        setIsSendingCode(true);
        setError(null);
        setMessage(null);
        const response = await apiService.apiSendCode(identifier, 'register');
        setIsSendingCode(false);
        if (response.success) {
            setIsCodeSent(true);
            setMessage(response.message || "Verification code sent.");
        } else {
            setError(response.error || "Failed to send verification code.");
        }
    }, [identifier]);

    const handleSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }
        if (password.length < 8) {
            setError("Password must be at least 8 characters long.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setMessage(null);

        const formData = new FormData();
        formData.append('username', username);
        formData.append('password', password);
        formData.append('code', verificationCode);
        if (identifier.includes('@')) {
            formData.append('email', identifier);
        } else {
            formData.append('phone', identifier);
        }

        const response = await apiService.apiRegisterWithCode(formData);

        setIsLoading(false);
        if (response.success && response.user) {
            setCurrentUser(response.user);
            navigate('/all', {replace: true});
        } else {
            setError(response.error || 'Registration failed. Please try again.');
        }
    }, [username, identifier, password, confirmPassword, verificationCode, setCurrentUser, navigate]);

    const inputBaseClasses = "w-full h-10 px-3 text-sm font-light rounded-base focus:outline-none bg-grey-ultra-light dark:bg-neutral-700 placeholder:text-grey-medium dark:placeholder:text-neutral-400 text-grey-dark dark:text-neutral-100 transition-colors duration-200 ease-in-out border border-grey-light dark:border-neutral-600 focus:border-primary dark:focus:border-primary-light focus:ring-1 focus:ring-primary dark:focus:ring-primary-light";

    return (
        <div className="flex items-center justify-center min-h-screen bg-grey-ultra-light dark:bg-grey-deep p-4">
            <div className="w-full max-w-sm p-6 sm:p-8 space-y-6 bg-white dark:bg-neutral-800 rounded-lg shadow-modal">
                <div className="text-center">
                    <Icon name="user" size={40} className="mx-auto text-primary dark:text-primary-light mb-3" strokeWidth={1.5}/>
                    <h1 className="text-xl sm:text-2xl font-medium text-grey-dark dark:text-neutral-100">
                        Create your Tada Account
                    </h1>
                </div>

                {message && !error && (
                    <p className="text-xs text-success dark:text-green-400 text-center bg-success/10 p-2 rounded-base">{message}</p>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label htmlFor="identifier-reg" className="sr-only">Email or Phone number</label>
                        <input id="identifier-reg" name="identifier" type="text" required
                               value={identifier} onChange={(e) => setIdentifier(e.target.value)}
                               className={inputBaseClasses} placeholder="Email or Phone number"
                               disabled={isLoading || isSendingCode || isCodeSent}/>
                    </div>

                    {!isCodeSent && (
                        <Button type="button" variant="secondary" fullWidth onClick={handleSendCode} loading={isSendingCode}
                                disabled={isLoading || isSendingCode || !identifier.trim()}
                                className="!h-10">
                            Send Verification Code
                        </Button>
                    )}

                    {isCodeSent && (
                        <>
                            <div>
                                <label htmlFor="verificationCode-reg" className="sr-only">Verification Code</label>
                                <input id="verificationCode-reg" name="verificationCode" type="text" inputMode="numeric" autoComplete="one-time-code" required
                                       value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)}
                                       className={inputBaseClasses} placeholder="Verification Code" disabled={isLoading}/>
                            </div>
                            <div>
                                <label htmlFor="name" className="sr-only">Username</label>
                                <input id="name" name="name" type="text" autoComplete="username" required
                                       value={username} onChange={(e) => setUsername(e.target.value)}
                                       className={inputBaseClasses} placeholder="Username" disabled={isLoading}/>
                            </div>
                            <div>
                                <label htmlFor="password-reg" className="sr-only">Password</label>
                                <input id="password-reg" name="password" type="password" autoComplete="new-password" required
                                       value={password} onChange={(e) => setPassword(e.target.value)}
                                       className={inputBaseClasses} placeholder="Password (min. 8 characters)" disabled={isLoading}/>
                            </div>
                            <div>
                                <label htmlFor="confirmPassword-reg" className="sr-only">Confirm Password</label>
                                <input id="confirmPassword-reg" name="confirmPassword" type="password" autoComplete="new-password" required
                                       value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                                       className={inputBaseClasses} placeholder="Confirm Password" disabled={isLoading}/>
                            </div>

                            {error && (<p className="text-xs text-error dark:text-red-400 text-center bg-error/10 p-2 rounded-base">{error}</p>)}

                            <Button type="submit" variant="primary" fullWidth size="lg" loading={isLoading} disabled={isLoading} className="!h-10">
                                Create Account
                            </Button>
                        </>
                    )}
                </form>

                <p className="mt-8 text-center text-xs text-grey-medium dark:text-neutral-400">
                    Already have an account?{' '}
                    <RouterLink to="/login" className="font-medium text-primary hover:text-primary-dark dark:text-primary-light dark:hover:text-primary transition-colors">
                        Sign in
                    </RouterLink>
                </p>
            </div>
        </div>
    );
};
RegisterPage.displayName = 'RegisterPage';
export default RegisterPage;