import Markdown from 'react-markdown';

export default function PrivacyPolicyPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {' '}
      {/* Adjust padding as needed */}
      {/* Apply prose classes to the wrapper div */}
      <div
        className="prose prose-sm dark:prose-invert max-w-none" // Added classes
      >
        <Markdown>{`
# Privacy Policy for SerenGPTy

**Effective Date:** March 29, 2025

Welcome to SerenGPTy! We are committed to protecting your privacy and being transparent about how we handle your information. Our core mission is to connect you with other AI chat users who share similar thought patterns and interests, based on the conversations you've had with AI assistants like ChatGPT and Claude, while prioritizing your anonymity.

This Privacy Policy explains what information we collect, how we use it, and your choices regarding your information.

## 1. Information We Collect

We collect information in the following ways:

*   **Information You Provide Directly:**
    *   **Account Information:** When you sign up, we collect a unique **username** you choose and a **hashed password** (we never store your plain text password). You may optionally provide your **country** (used only for display) and set a preference for matching based on potentially **sensitive conversation topics**. We **do not** require your email address or phone number for basic account creation.
    *   **Uploaded Conversation Data:** To enable matching, you upload a data export archive from ChatGPT or Claude. **Crucially, this archive is processed locally within your browser by our extension or website tools *before* anything is uploaded.** This local processing aims to:
        *   Anonymize potentially identifying information (like emails, phone numbers, high-entropy strings resembling keys/secrets) within the conversation text according to predefined rules.
        *   Extract relevant information needed for matching (e.g., conversation summaries, embeddings, or other derived, anonymized representations).
        *   The **anonymized, processed data** (not the raw, original archive content) is then uploaded to our servers.
*   **Information Collected Automatically:**
    *   **Usage Information:** We may collect standard web log information, such as your IP address (which we may anonymize), browser type, operating system, referring URLs, pages visited on our site, and timestamps. We use this for security, analytics, and improving our service.
    *   **Device Information:** We may collect information about the device you use to access SerenGPTy, such as hardware model and operating system version.
*   **Information from Third Parties:**
    *   **Chat Service:** When you use the chat feature to communicate with other users, messages are processed by our third-party chat provider, Stream (Stream.IO, Inc.). We receive metadata necessary to facilitate the chat (like participants and timestamps), but the message content is handled according to Stream's policies.

## 2. How We Use Your Information

We use the information we collect for the following purposes:

*   **To Provide and Operate the Service:**
    *   To create and manage your anonymous account.
    *   To process your uploaded, anonymized conversation data to generate representations (like embeddings or summaries) used for matching.
    *   To calculate similarity scores and identify potential matches with other users based on shared conversation themes.
    *   To display matched users and relevant (anonymized) path information within the service.
    *   To facilitate direct chat connections between matched users via our chat provider (Stream Chat).
*   **To Improve and Secure the Service:**
    *   To analyze usage patterns (on an aggregated, anonymized basis) to understand how our service is used and identify areas for improvement.
    *   To monitor for security threats, prevent fraud, and protect the integrity of our service and user data.
*   **To Communicate With You (Optional):** If you contact us directly, we will use your information to respond to your inquiries.

## 3. How We Share Your Information

We are committed to user privacy and **do not sell your personal information.** We share information only in the following limited circumstances:

*   **With Other Users (Limited):**
    *   When a match is found, your chosen **username**, **country flag** (if provided), and **identicon** are shared with the matched user(s).
    *   Summaries or snippets describing the *commonalities* and *differences* between matched conversation paths (derived from anonymized data) are displayed to facilitate connection. **Your raw or fully anonymized conversation text is not automatically shared with matches outside of the direct chat.**
    *   When you initiate or participate in a chat, your username and messages are shared with the other participant(s) via the Stream Chat service.
*   **With Service Providers:** We use third-party companies to help us operate and improve SerenGPTy. These include:
    *   **Hosting Providers (e.g., Microsoft Azure):** To host our servers and store processed data.
    *   **Chat Provider (Stream.IO, Inc.):** To enable the user-to-user chat functionality. Their handling of chat data is governed by their own privacy policy.
    *   **Analytics Providers (e.g., Vercel Analytics, Google Analytics):** To understand website usage (we strive to use privacy-focused analytics).
    These providers only have access to the information necessary to perform their functions and are obligated to protect it.
*   **For Legal Reasons:** We may disclose information if required by law, subpoena, or other legal process, or if we have a good faith belief that disclosure is necessary to protect our rights, protect your safety or the safety of others, investigate fraud, or respond to a government request.
*   **In Case of Business Transfer:** If SerenGPTy is involved in a merger, acquisition, or sale of assets, user information may be transferred as part of that transaction. We will notify users of any such change in ownership or control of their information.

## 4. Data Security

We implement technical and organizational measures designed to protect your information:

*   **Local Anonymization:** Sensitive data processing occurs in your browser before upload.
*   **Encryption:** Data is encrypted in transit (using HTTPS) and at rest.
*   **Password Hashing:** Passwords are securely hashed using industry-standard algorithms (bcrypt).
*   **Access Controls:** We limit access to user data to authorized personnel who need it to perform their job functions.
*   **Confidential Computing (Future Goal):** We are working towards implementing Zero Trust infrastructure using technologies like Confidential Containers to further enhance data security and transparency.

Despite these measures, no security system is impenetrable. We cannot guarantee the absolute security of your information.

## 5. Data Retention

We retain your account information and processed conversation data for as long as your account is active or as needed to provide you with the service. Usage logs and analytics data may be kept for a limited period for analysis and security purposes. Chat messages sent via Stream Chat are subject to Stream's data retention policies.

You can request the deletion of your account and associated data by contacting us.

## 6. Your Privacy Rights

Depending on your location, you may have certain rights regarding your personal information, such as the right to access, correct, or delete your data. Given the anonymous nature of the accounts (no email/phone):

*   **Access/Correction:** You can view and update your username, country, and sensitive matching preference through your account settings (Preferences page).
*   **Deletion:** You can request account deletion by contacting us at contact@serengpty.com. We will delete your account and associated processed data upon verification (we may need your username and potentially proof of control over the account if feasible). Please note that deleting your SerenGPTy account does not automatically delete chat history stored by Stream Chat; you may need to manage that separately if possible through their service.

## 7. Children's Privacy

SerenGPTy is not intended for individuals under the age of 16 (or the relevant age of digital consent in your jurisdiction). We do not knowingly collect personal information from children. If we become aware that we have inadvertently collected information from a child, we will take steps to delete it promptly.

## 8. Third-Party Services (Stream Chat)

Our chat feature is powered by Stream (Stream.IO, Inc.). Your use of the chat feature is subject to Stream's Terms of Service and Privacy Policy. We encourage you to review their policies:

*   Stream Privacy Policy: [https://getstream.io/legal/privacy/](https://getstream.io/legal/privacy/)
*   Stream Acceptable Use Policy: [https://getstream.io/legal](https://getstream.io/legal)

SerenGPTy is not responsible for the data practices of Stream Chat.

## 9. Changes to This Privacy Policy

We may update this Privacy Policy from time to time. If we make significant changes, we will notify users by posting the new policy on our website and updating the "Effective Date" at the top. We encourage you to review this policy periodically.

## 10. Contact Us

If you have any questions or concerns about this Privacy Policy or our data practices, please contact us at:
contact@serengpty.com
  `}</Markdown>
      </div>
    </div>
  );
}
