import { Prose } from "@ngriffin_uk/polychat-component-content";
import {
  APP_NAME,
  CONTACT_LINK,
  PRIVACY_EFFECTIVE_DATE,
} from "@ngriffin_uk/polychat-library-client";

import { PageShell } from "../Shell/PageShell.js";
import { StandardSidebarContent } from "../Sidebar/StandardSidebarContent.js";
export function PrivacyPage() {
  return (
    <PageShell title="Privacy Policy" sidebarContent={<StandardSidebarContent />}>
      <Prose>
        <h2>1. Introduction</h2>
        <p>
          This Privacy Policy ("Policy") explains how {APP_NAME} ("we," "us," or "our") collects,
          uses, discloses, and safeguards your information when you access or use our AI assistant
          services across our website, desktop, mobile, watch and TV apps, command line tools and
          API ("Service"). We are committed to protecting your privacy and handling your data with
          transparency and care.
        </p>

        <h2>2. Information We Collect</h2>
        <h3>2.1 Personal Information</h3>
        <p>Information that can be used to identify you, such as:</p>
        <ul>
          <li>Name, email address, and contact details provided during registration</li>
          <li>
            Account credentials and profile information, including how you sign in (email link,
            passkey, GitHub or Apple)
          </li>
          <li>
            Whether you are 18 or over, and when you told us. We do not keep your date of birth
          </li>
          <li>
            Subscription and billing records. Stripe handles your card details, and we do not store
            them
          </li>
        </ul>

        <h3>2.2 Conversation Data</h3>
        <ul>
          <li>Text, voice, images and files you submit to the Service</li>
          <li>Content of conversations and interactions with the Service</li>
          <li>Memories, notes, sources, tasks, routines and other work you keep in the Service</li>
          <li>Images, video, audio and documents generated for you</li>
          <li>Preferences and settings related to your use of the Service</li>
        </ul>
        <p>
          Temporary chats stay on your device and are not saved to your account. Guests use
          temporary chats, and you can make them the default for your account in your settings.
        </p>

        <h3>2.3 Information You Connect</h3>
        <p>We only receive these if you choose to set them up:</p>
        <ul>
          <li>
            Connectors and MCP integrations: content from the services you connect, when a task or
            routine uses them
          </li>
          <li>Channels: messages you send to {APP_NAME} through Telegram, Slack or email</li>
          <li>Feeds and sources you follow for Discover</li>
          <li>
            Apple Health on iOS: yesterday's sleep, mindful and exercise minutes, used for one line
            in your Discover brief and never to choose topics. We keep only the latest summary
          </li>
          <li>Microphone audio, when you use voice features</li>
        </ul>

        <h3>2.4 Technical Information</h3>
        <ul>
          <li>IP address and location data</li>
          <li>Device information (browser type, operating system, hardware model)</li>
          <li>Log data and usage statistics</li>
          <li>Cookies and similar browser storage</li>
        </ul>

        <h3>2.5 Cookie Policy</h3>
        <p>We keep this small:</p>
        <ul>
          <li>Essential cookies: Keep you signed in, and recognise guests for usage limits</li>
          <li>Browser storage: Remembers your settings, preferences and temporary chats</li>
          <li>
            Analytics: Our own first-party measurement, sent to our servers. We do not use
            third-party analytics or advertising cookies
          </li>
        </ul>
        <p>
          You can clear cookies and browser storage through your browser settings, but you will be
          signed out and temporary chats on that device will be lost.
        </p>

        <h2>3. How We Use Your Information</h2>
        <h3>3.1 Providing and Maintaining the Service</h3>
        <ul>
          <li>Processing and responding to your queries</li>
          <li>Authenticating your identity and maintaining your account</li>
          <li>Delivering the core functionality of the Service</li>
          <li>Running the tasks, routines and scheduled work you set up</li>
        </ul>

        <h3>3.2 Improving and Developing the Service</h3>
        <ul>
          <li>Analyzing usage patterns to enhance performance</li>
          <li>Training our AI models to improve response quality</li>
          <li>Debugging and fixing technical issues</li>
        </ul>

        <h3>3.3 Personalization and User Experience</h3>
        <ul>
          <li>Customizing responses based on your interaction history and saved memories</li>
          <li>Remembering your preferences and settings</li>
          <li>
            Building your Discover feed and briefs from your interests, memories, recent chat titles
            and connected sources
          </li>
        </ul>

        <h3>3.4 Legal and Compliance Purposes</h3>
        <ul>
          <li>Complying with applicable laws and regulations</li>
          <li>Protecting our legal rights and preventing misuse</li>
          <li>Enforcing our Terms of Service</li>
        </ul>

        <h3>3.5 Training and Processing</h3>
        <ul>
          <li>
            Prompts and responses from conversations saved to your account may be used to train and
            improve AI models. This includes both training models through our AI providers and
            training our own fine-tuned models to improve {APP_NAME}'s performance. Temporary chats
            are not used.
          </li>
          <li>
            This is on by default. You can turn it off at any time with "Allow Prompt and Response
            Training Data" in your profile settings. We still collect operational usage and
            performance metrics, without prompt content.
          </li>
          <li>
            We will retain conversation data if you have asked us to store it as well as within our
            logs for as long as is permitted by law.
          </li>
        </ul>

        <h3>3.6 Safety</h3>
        <ul>
          <li>
            Age check: We ask for your date of birth before your first message and keep only the
            outcome
          </li>
          <li>AI disclosure: We tell you in the app that you are talking to an AI, not a person</li>
          <li>
            Crisis support: If a message or reply appears to involve suicide or self-harm, we
            automatically show support details alongside the reply. This is an automated check of
            the text. No person reviews it and it does not change your account
          </li>
          <li>
            Image and video safety: Where a model provider offers safety filters for generated
            images and video, they stay on and you cannot turn them down
          </li>
        </ul>

        <h3>3.7 Generated Media</h3>
        <p>
          Where the file format allows, images, video and audio generated with {APP_NAME} carry a
          machine-readable mark showing that AI made them, and any marks from the model provider are
          kept. We record each file's SHA-256 fingerprint with its model, provider and date, so that
          anyone holding the file can check it. These records do not name you. When you check a file
          at <a href="/verify">Check a file</a>, the file stays on your device and we only receive
          its fingerprint.
        </p>

        <h2>4. Data Security</h2>
        <p>
          We implement industry-standard technical and organizational measures to protect your
          information.
        </p>
        <h3>4.1 Data Breach Notification</h3>
        <p>
          In the event of a personal data breach that may pose a risk to your rights and freedoms:
        </p>
        <ul>
          <li>
            We will notify relevant supervisory authorities within 72 hours of becoming aware of the
            breach
          </li>
          <li>
            We will inform affected users without undue delay, with clear information about the
            breach and steps we're taking to address it
          </li>
          <li>We maintain internal breach detection and notification procedures</li>
        </ul>

        <h2>5. Sharing Your Information</h2>
        <h3>5.1 Third-Party Service Providers</h3>
        <p>
          We may share information with trusted third parties who assist us in operating our
          Service, conducting business, or servicing you, provided they agree to keep this
          information confidential.
        </p>
        <p>Our key service providers include:</p>
        <ul>
          <li>
            AI model providers: The provider behind the model you choose, or that {APP_NAME} chooses
            for you, such as OpenAI, Anthropic, Google, Mistral, Replicate and Cloudflare
          </li>
          <li>Cloud infrastructure, email and analytics storage: Cloudflare</li>
          <li>Payments: Stripe</li>
          <li>Connectors: Composio, and the services you connect</li>
          <li>Sign-in: GitHub and Apple, if you use them</li>
          <li>Spam protection: hCaptcha</li>
          <li>Error reporting: Sentry</li>
        </ul>
        <p>
          Your prompts and files go to the model provider that handles your request. Features such
          as Second opinion also send your question, the answer and related tool results to other
          models. The model picker shows where each model handles your data and links to the
          provider's own policy for location and retention. Where a provider does not document this,
          the label says unknown.
        </p>

        <h3>5.2 Legal Requirements</h3>
        <p>
          We may disclose your information if required by law, governmental request, or when
          necessary to protect our rights or the safety of users.
        </p>

        <h3>5.3 Business Transfers</h3>
        <p>
          If we are involved in a merger, acquisition, or sale of assets, your information may be
          transferred as part of that transaction.
        </p>

        <h3>5.4 With Your Consent</h3>
        <p>
          We may share your information with third parties when you explicitly consent to such
          sharing. This includes conversations you share, sites you publish, and actions you approve
          in connected services.
        </p>

        <h2>6. Your Rights and Choices</h2>
        <p>You have the right to:</p>
        <ul>
          <li>Access, correct, or delete your personal information</li>
          <li>Object to or restrict certain processing of your data</li>
          <li>Request portability of your personal data</li>
          <li>Opt out of certain communications and marketing</li>
          <li>Opt out of training data collection through your profile settings</li>
          <li>Withdraw consent where processing is based on consent</li>
        </ul>
        <h3>6.1 Exercising Your Rights</h3>
        <p>To exercise your data protection rights:</p>
        <ul>
          <li>
            For training data collection: Visit your profile settings and turn off "Allow Prompt and
            Response Training Data"
          </li>
          <li>
            To get a copy of your data: Go to Chat history in your profile and export it. The ZIP
            includes your chats, memory, sources, outputs, tasks, recipes and files, with a manifest
            of anything left out. Credentials and other people's work are never included
          </li>
          <li>To delete your conversations: Go to Chat history in your profile</li>
          <li>
            For other access, correction, or deletion requests, including closing your account:
            Contact us at <a href={CONTACT_LINK}>{CONTACT_LINK}</a> with the subject line "Data
            Rights Request"
          </li>
          <li>We will respond to all legitimate requests within 30 days</li>
          <li>
            We may request specific information to verify your identity before processing your
            request
          </li>
          <li>
            If you are unhappy with how we handle your data, you can complain to the UK Information
            Commissioner's Office at <a href="https://ico.org.uk/make-a-complaint/">ico.org.uk</a>{" "}
            or your local data protection authority
          </li>
        </ul>

        <h2>7. Data Retention</h2>
        <p>
          We retain your personal information for as long as necessary to fulfill the purposes
          outlined in this Policy, unless a longer retention period is required or permitted by law.
        </p>
        <ul>
          <li>Account information: Retained as long as your account is active</li>
          <li>Conversation data: Retained until you delete it or close your account</li>
          <li>Temporary chats: Kept only on your device</li>
          <li>Usage and analytical data: Retained for up to three years for analytics purposes</li>
          <li>
            Generated media records: Fingerprint records are kept so that files can still be checked
            later
          </li>
          <li>You can request deletion of your data at any time by contacting us</li>
        </ul>

        <h2>8. International Data Transfers</h2>
        <p>
          Your information may be transferred to and processed in countries other than your country
          of residence. We ensure appropriate safeguards are in place to protect your information
          during such transfers.
        </p>

        <h2>9. Children's Privacy</h2>
        <p>
          Our Service is only for people aged 18 or over and is not directed to children. Before
          your first message we ask for your date of birth, use it once to work out whether you are
          18 or over, and keep only that outcome and when you gave it. See{" "}
          <a href="/age-check">why we ask for your date of birth</a>.
        </p>

        <h2>10. Legal Compliance</h2>
        <h3>10.1 UK GDPR and EU GDPR</h3>
        <p>
          For users in the United Kingdom and the European Economic Area, we process personal data
          in accordance with UK GDPR and GDPR principles, including:
        </p>
        <ul>
          <li>Lawfulness, fairness, and transparency</li>
          <li>Purpose limitation and data minimization</li>
          <li>Accuracy and storage limitation</li>
          <li>Integrity, confidentiality, and accountability</li>
        </ul>
        <p>We process your data on the following legal bases:</p>
        <ul>
          <li>Performance of our contract with you to provide the Service</li>
          <li>Our legitimate interests in maintaining and improving the Service</li>
          <li>Your consent, where we specifically request it, such as for Apple Health data</li>
          <li>Compliance with our legal obligations</li>
        </ul>

        <h3>10.2 California Consumer Privacy Act (CCPA)</h3>
        <p>
          For California residents, we provide rights and protections as required by the CCPA,
          including:
        </p>
        <ul>
          <li>Right to know what personal information is collected</li>
          <li>Right to know whether personal information is sold or disclosed</li>
          <li>Right to opt-out of the sale of personal information</li>
          <li>Right to request deletion of personal information</li>
        </ul>

        <h2>11. Changes to This Policy</h2>
        <p>
          We may update this Policy from time to time. We will notify you of any changes by posting
          the new Policy on this page and updating the effective date. Continued use of the Service
          after such changes constitutes acceptance of the revised Policy.
        </p>

        <h2>12. Contact Us</h2>
        <p>
          If you have questions, concerns, or requests regarding this Privacy Policy or our data
          practices, please contact me at <a href={CONTACT_LINK}>{CONTACT_LINK}</a>.
        </p>

        <h2>13. Effective Date</h2>
        <p>This Privacy Policy is effective as of {PRIVACY_EFFECTIVE_DATE}.</p>

        <h2>14. Acceptance</h2>
        <p>
          By using {APP_NAME}, you acknowledge that you have read, understood, and agree to the
          terms of this Privacy Policy.
        </p>
      </Prose>
    </PageShell>
  );
}
