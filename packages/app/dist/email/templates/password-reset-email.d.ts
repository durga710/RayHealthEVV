export interface PasswordResetEmailFields {
    resetUrl: string;
    supportEmail?: string;
}
export interface PasswordResetEmailPayload {
    subject: string;
    html: string;
    text: string;
}
export declare function renderPasswordResetEmail(fields: PasswordResetEmailFields): PasswordResetEmailPayload;
//# sourceMappingURL=password-reset-email.d.ts.map