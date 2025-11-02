import { create } from "zustand";

interface CaptchaState {
	captchaToken: string | null;
	setCaptchaToken: (token: string | null) => void;
	isVerified: boolean;
	setIsVerified: (isVerified: boolean) => void;
}

export const useCaptchaStore = create<CaptchaState>()((set) => ({
	captchaToken: null,
	setCaptchaToken: (token) => set({ captchaToken: token }),
	isVerified: false,
	setIsVerified: (isVerified) => set({ isVerified }),
}));
