// src/components/premium/PaymentModal.tsx
import React, {useCallback, useEffect, useState} from 'react';
import {useAtom, useSetAtom} from 'jotai';
import * as Dialog from '@radix-ui/react-dialog';
import { QRCodeCanvas } from 'qrcode.react';
import {twMerge} from 'tailwind-merge';
import Button from '../common/Button';
import Icon from '../common/Icon';
import * as api from '@/services/apiService';
import {
    addNotificationAtom,
    currentUserAtom,
    isPaymentModalOpenAtom,
    paymentModalConfigAtom
} from "@/store/atoms.ts";
import {useTranslation} from "react-i18next";

type PaymentPlatform = 'ALIPAY' | 'WECHAT_PAY';

const PaymentModal: React.FC = () => {
    const {t} = useTranslation();
    const [isOpen, setIsOpen] = useAtom(isPaymentModalOpenAtom);
    const [config, setConfig] = useAtom(paymentModalConfigAtom);
    const [platform, setPlatform] = useState<PaymentPlatform>('ALIPAY');
    const [isLoading, setIsLoading] = useState(false);
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const addNotification = useSetAtom(addNotificationAtom);
    const setCurrentUser = useSetAtom(currentUserAtom);

    const resetState = useCallback(() => {
        setIsLoading(false);
        setQrCodeUrl(null);
        setError(null);
        setPlatform('ALIPAY');
    }, []);

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (!open) {
            // Delay reset to allow for closing animation
            setTimeout(() => {
                setConfig(null);
                resetState();
            }, 300);
        }
    };

    const handleGenerateQrCode = useCallback(async () => {
        if (!config) return;
        setIsLoading(true);
        setError(null);
        try {
            const response = await api.apiCreatePaymentOrder(config.productId, platform);
            setQrCodeUrl(response.qrCodeUrl);
        } catch (e: any) {
            setError(e.message || `Failed to create ${platform} order.`);
        } finally {
            setIsLoading(false);
        }
    }, [config, platform]);

    useEffect(() => {
        if (isOpen && config && !qrCodeUrl && !isLoading && !error) {
            handleGenerateQrCode();
        }
    }, [isOpen, config, qrCodeUrl, isLoading, error, handleGenerateQrCode]);

    useEffect(() => {
        if (isOpen && config) {
            setQrCodeUrl(null);
            setError(null);
            // This will trigger handleGenerateQrCode
        }
    }, [platform, isOpen, config]);


    const handlePaymentComplete = () => {
        addNotification({type: 'success', message: 'Payment status will update shortly. Thank you!'});
        setCurrentUser(undefined); // Re-fetch user to get updated premium status
        handleOpenChange(false);
    }

    const platformConfig = {
        ALIPAY: {name: 'Alipay', icon: 'alipay-logo' as const, color: 'border-blue-500'},
        WECHAT_PAY: {name: 'WeChat Pay', icon: 'wechat-logo' as const, color: 'border-green-500'},
    }

    return (
        <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay
                    className="fixed inset-0 bg-grey-dark/30 dark:bg-black/60 data-[state=open]:animate-fadeIn data-[state=closed]:animate-fadeOut z-[51] backdrop-blur-sm"/>
                <Dialog.Content
                    className={twMerge(
                        "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[52]",
                        "bg-white dark:bg-neutral-800 w-full max-w-sm rounded-base shadow-modal flex flex-col p-6",
                        "data-[state=open]:animate-modalShow data-[state=closed]:animate-modalHide"
                    )}>
                    <div className="flex justify-between items-center mb-4">
                        <Dialog.Title className="text-[16px] font-normal text-grey-dark dark:text-neutral-100">
                            {config?.productName || 'Upgrade to Premium'}
                        </Dialog.Title>
                        <Dialog.Close asChild>
                            <Button variant="ghost" size="icon" icon="x"
                                    className="text-grey-medium hover:text-grey-dark w-6 h-6 -mr-1"/>
                        </Dialog.Close>
                    </div>

                    <div className="flex space-x-2 mb-4 p-1 bg-grey-ultra-light dark:bg-neutral-700 rounded-base">
                        {(['ALIPAY', 'WECHAT_PAY'] as PaymentPlatform[]).map(p => (
                            <button
                                key={p}
                                onClick={() => setPlatform(p)}
                                className={twMerge(
                                    "flex-1 flex items-center justify-center p-2 rounded-md text-sm transition-all duration-150 ease-in-out border-2",
                                    platform === p ? 'bg-white dark:bg-neutral-600 shadow-sm' : 'bg-transparent border-transparent opacity-60 hover:opacity-100',
                                    platform === p ? platformConfig[p].color : 'border-transparent'
                                )}
                            >
                                <Icon name={platformConfig[p].icon} size={20} className="mr-2"/>
                                {platformConfig[p].name}
                            </button>
                        ))}
                    </div>


                    <div className="relative w-48 h-48 mx-auto my-4 bg-grey-ultra-light dark:bg-neutral-700 rounded-lg flex items-center justify-center">
                        {isLoading && (
                            <Icon name="loader" size={32} className="text-primary animate-spin"/>
                        )}
                        {error && !isLoading && (
                            <div className="text-center p-4">
                                <Icon name="alert-circle" size={32} className="text-error mx-auto mb-2"/>
                                <p className="text-xs text-error">{error}</p>
                                <Button variant="link" size="sm" onClick={handleGenerateQrCode} className="mt-2">Try Again</Button>
                            </div>
                        )}
                        {qrCodeUrl && !isLoading && !error && (
                            <div className="p-2 bg-white rounded-md">
                                <QRCodeCanvas value={qrCodeUrl} size={176} level="M" />
                            </div>
                        )}
                    </div>

                    <p className="text-xs text-center text-grey-medium dark:text-neutral-400 mb-6">
                        Please use {platformConfig[platform].name} to scan the QR code to complete the payment.
                    </p>

                    <div className="flex justify-end space-x-2">
                        <Button variant="secondary" size="md" onClick={() => handleOpenChange(false)}>Cancel</Button>
                        <Button variant="primary" size="md" onClick={handlePaymentComplete}>I have paid</Button>
                    </div>

                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};

export default PaymentModal;